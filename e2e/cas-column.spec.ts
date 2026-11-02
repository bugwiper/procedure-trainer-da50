import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
import { advisoryQuery, messagesQuery, warningQuery } from './support/cas-messages';
import { activate } from './support/zoom';

// The CAS column on the PFD (Phase 6.1, plan 01; PNL-25): the messages stand as black rows joined
// without a gap at the lower right, grow upward and keep their texts. The specs read drawn chips
// only (the rect attributes are region-local units), so they also run against the live site.

const HEAT = 'sw.pitot_stall_heat';
const text = (id: string): string => DA50RG_CAS.get(id)?.text ?? '';

const chips = (page: Page) => page.locator('[data-testid="cas-chip"]');

/** The region-local rectangle of a chip, read from its rect attributes. */
async function rowOf(chip: Locator): Promise<{ x: number; y: number; w: number; h: number }> {
  const rect = chip.locator('rect');
  const read = async (name: string): Promise<number> =>
    Number((await rect.getAttribute(name)) ?? Number.NaN);
  return {
    x: await read('x'),
    y: await read('y'),
    w: await read('width'),
    h: await read('height'),
  };
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  const dismiss = page.getByTestId('rotate-hint-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByTestId('rotate-hint')).toBeHidden();
});

test('two cautions stack as thin touching rows, PITOT HT OFF above STALL HT OFF', async ({
  page,
  hasTouch,
}) => {
  await activate(page.locator(`[data-hit="${HEAT}"]`), hasTouch);
  await expect(page.locator(`[data-control-id="${HEAT}"]`)).toHaveAttribute('data-state', 'off');
  await expect(chips(page)).toHaveCount(2);

  const first = await rowOf(chips(page).nth(0));
  const second = await rowOf(chips(page).nth(1));
  // The rows touch: the second starts exactly where the first ends, same x and width.
  expect(second.y).toBe(first.y + first.h);
  expect(second.x).toBe(first.x);
  expect(second.w).toBe(first.w);
  // About half as wide and much finer than the old 100 x 20 chip.
  expect(first.w).toBeLessThan(60);
  expect(first.h).toBeLessThan(11);
  expect(second.h).toBeLessThan(11);
  // The order in the document is the display order, top first.
  await expect(chips(page).nth(0)).toHaveAttribute('data-cas-id', 'pitot_heat');
  await expect(chips(page).nth(1)).toHaveAttribute('data-cas-id', 'stall_heat');
  await expect(chips(page).nth(0)).toContainText(text('pitot_heat'));
  await expect(chips(page).nth(1)).toContainText(text('stall_heat'));
});

/** Open the free panel with a preview query and, when asked, turn the PITOT/STALL HEAT rocker off. */
async function open(page: Page, query: string, heatOff: boolean, hasTouch: boolean): Promise<void> {
  await page.goto(query === '' ? './' : `./?q=${query}`);
  await expect(page.getByTestId('panel')).toBeVisible();
  const dismiss = page.getByTestId('rotate-hint-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByTestId('rotate-hint')).toBeHidden();
  if (heatOff) {
    await activate(page.locator(`[data-hit="${HEAT}"]`), hasTouch);
    await expect(page.locator(`[data-control-id="${HEAT}"]`)).toHaveAttribute('data-state', 'off');
  }
}

/** Top y, bottom y and row count of the drawn column. */
async function extent(page: Page): Promise<{ top: number; bottom: number; count: number }> {
  const count = await chips(page).count();
  const first = await rowOf(chips(page).nth(0));
  const last = await rowOf(chips(page).nth(count - 1));
  return { top: first.y, bottom: last.y + last.h, count };
}

test('a warning, two cautions and an advisory show in that order from the top', async ({
  page,
  hasTouch,
}) => {
  await open(page, `${warningQuery()},${advisoryQuery()}`, true, hasTouch);
  await expect(chips(page)).toHaveCount(4);
  const levels = await chips(page).evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('data-level')),
  );
  expect(levels).toEqual(['warning', 'caution', 'caution', 'advisory']);
  const ids = await chips(page).evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('data-cas-id')),
  );
  expect(ids).toEqual(['eng_oil_temp', 'pitot_heat', 'stall_heat', 'fuel_trans']);
  // The drawn order is the vertical order: each row lies below the one before it.
  const ys: number[] = [];
  for (let i = 0; i < 4; i += 1) ys.push((await rowOf(chips(page).nth(i))).y);
  expect([...ys].sort((a, b) => a - b)).toEqual(ys);
});

test('the bottom edge stays put while the top edge rises by one row per message', async ({
  page,
  hasTouch,
}) => {
  const small = await (async () => {
    await open(page, warningQuery(), false, hasTouch);
    await expect(chips(page)).toHaveCount(1);
    return extent(page);
  })();
  await open(page, advisoryQuery(), true, hasTouch);
  await expect(chips(page)).toHaveCount(3);
  const three = await extent(page);
  await open(page, `${warningQuery()},${advisoryQuery()}`, true, hasTouch);
  await expect(chips(page)).toHaveCount(4);
  const four = await extent(page);
  expect(three.bottom).toBe(small.bottom);
  expect(four.bottom).toBe(small.bottom);
  const row = (await rowOf(chips(page).nth(0))).h;
  expect(small.top - three.top).toBe(2 * row);
  expect(three.top - four.top).toBe(row);
});

test('six messages: every text fits its row with room to spare and the column stays in the glass', async ({
  page,
  hasTouch,
}, testInfo) => {
  // The fonts of macOS and Linux differ by under a unit; the 2 unit room on each side covers it.
  test.skip(testInfo.project.name !== 'desktop-chromium', 'text fit runs on desktop-chromium');
  await open(page, messagesQuery(), true, hasTouch);
  await expect(chips(page)).toHaveCount(6);
  const fits = await chips(page).evaluateAll((nodes) =>
    nodes.map((n) => {
      const text = n.querySelector('text') as unknown as SVGTextElement;
      const rect = n.querySelector('rect');
      return {
        text: (text.textContent ?? '').trim(),
        textWidth: text.getBBox().width,
        rowWidth: Number(rect?.getAttribute('width')),
      };
    }),
  );
  for (const fit of fits) {
    expect(fit.textWidth, fit.text).toBeLessThanOrEqual(fit.rowWidth - 2);
  }
  const full = await extent(page);
  expect(full.count).toBe(6);
  expect(full.top).toBeGreaterThanOrEqual(30 + 2);
  expect(full.bottom).toBeLessThanOrEqual(343 - 2);
});
