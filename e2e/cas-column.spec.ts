import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
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

test('two cautions stack as thin touching rows, PITOT HEAT above STALL HEAT', async ({
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
