import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { COLUMN_ORDER, GAUGE_ROWS, LABELS } from '../tests/engine-page-reference';
import { startScenario } from './support/session';
import { activate } from './support/zoom';

// Phase 6 (plan 02): the MFD engine page on the built app. The order of the boxes and the set of
// static texts come from the independent reference (tests/engine-page-reference.ts); the numbers
// are read from the drawn text, so the spec also runs against the live site.

const ROW = 'engine.eng-oil-temp-green';
const PORTRAIT_NOTE =
  'Portrait phones are covered by the rotate hint (D-02); pinch zoom reaches full tap size there';
const FUEL_TRANS = 'sw.fuel_trans';
const SETTLE_MS = 20_000;

const mfd = (page: Page): Locator => page.locator('[data-region-id="mfd"]');
const enginePage = (page: Page): Locator => page.getByTestId('mfd-engine-page');

/** The element of a box id of the reference: a gauge by its label, any other box by its id. */
function boxOf(page: Page, id: string): Locator {
  const gauge = GAUGE_ROWS.find((g) => g.id === id);
  return gauge === undefined
    ? mfd(page).locator(`[data-box="${id}"]`)
    : mfd(page).locator(`[data-gauge="${gauge.label}"]`);
}

async function openEnginePage(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);
  await expect(enginePage(page)).toBeVisible();
}

const numberOf = async (readout: Locator): Promise<number> =>
  Number.parseFloat((await readout.textContent()) ?? 'NaN');
const fuelQty = (page: Page, which: '1' | '2'): Promise<number> =>
  numberOf(mfd(page).locator(`[data-gauge="Fuel qty"] [data-dual-readout="${which}"]`));

/** Every drawn text of the page that is not a readout number, trimmed. */
const staticTexts = (page: Page): Promise<string[]> =>
  enginePage(page).evaluate((g) =>
    Array.from(g.querySelectorAll('text'))
      .filter((t) => !t.classList.contains('glass-digits'))
      .map((t) => (t.textContent ?? '').trim()),
  );

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('every box of the reference lies in its column in the order of the reference', async ({
  page,
  hasTouch,
}) => {
  await openEnginePage(page, hasTouch);
  const rects: Record<string, { left: number; top: number; right: number; bottom: number }> = {};
  for (const id of Object.values(COLUMN_ORDER).flat()) {
    const box = await boxOf(page, id).boundingBox();
    if (box === null) throw new Error(`box ${id} is not drawn`);
    rects[id] = { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
  }
  const SLACK = 1;
  const columns = Object.values(COLUMN_ORDER).map((ids) => ids.map((id) => rects[id]));
  for (const column of columns) {
    column.forEach((r, i) => {
      const next = column[i + 1];
      if (r === undefined || next === undefined) return;
      expect(r.bottom, `column box ${String(i)} above ${String(i + 1)}`).toBeLessThanOrEqual(
        next.top + SLACK,
      );
    });
  }
  const edges = columns.map((column) => ({
    left: Math.min(...column.map((r) => r?.left ?? Infinity)),
    right: Math.max(...column.map((r) => r?.right ?? -Infinity)),
  }));
  edges.forEach((edge, i) => {
    const next = edges[i + 1];
    if (next !== undefined) expect(edge.right).toBeLessThanOrEqual(next.left + SLACK);
  });
});

test('the page draws no text outside the reference label table, and no ENGINE heading', async ({
  page,
  hasTouch,
}) => {
  await openEnginePage(page, hasTouch);
  const texts = await staticTexts(page);
  expect(texts).not.toContain('ENGINE');
  expect(new Set(texts)).toEqual(new Set(LABELS));
});

test('in a run the left fuel quantity rises and the right one falls with FUEL TRANS on', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ROW, 'easy');
  await openEnginePage(page, hasTouch);
  const textsBefore = await staticTexts(page);
  const left = await fuelQty(page, '1');
  const right = await fuelQty(page, '2');

  await activate(page.locator(`[data-hit="${FUEL_TRANS}"]`), hasTouch);
  await expect(page.locator(`[data-control-id="${FUEL_TRANS}"]`)).toHaveAttribute(
    'data-state',
    'on',
  );
  await expect.poll(() => fuelQty(page, '1'), { timeout: SETTLE_MS }).toBeGreaterThan(left);
  await expect.poll(() => fuelQty(page, '2'), { timeout: SETTLE_MS }).toBeLessThan(right);
  // Only numbers moved: the static texts are the same.
  expect(await staticTexts(page)).toEqual(textsBefore);
});
