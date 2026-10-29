import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { COLUMN_ORDER, GAUGE_ROWS, LABELS } from '../tests/engine-page-reference';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
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
const ICING_ROW = 'icing.icing-unintentional';
const DEICE_MODE = 'sw.deice_mode';
const ENGINE_MASTER = 'sw.engine_master';
const CRUISE_FLOW = DA50RG_QUANTITIES.get('fuel_flow_gph')?.base ?? Number.NaN;
// The shipped ENG OIL TEMP scenario starts with POWER one marker above the cruise lever (p75, about
// 0.6 gal/h more), so the flow is compared with the cruise flow within 1 gal/h, not 0.2.
const FLOW_TOLERANCE = 1;

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
/**
 * The position of a Fuel Qty pointer on the bar (the first coordinate of its path, the tip): the
 * number is a whole number now, the pointer still moves with every fraction of a gallon.
 */
const fuelQty = async (page: Page, which: '1' | '2'): Promise<number> => {
  const d = await mfd(page)
    .locator(`[data-gauge="Fuel qty"] [data-dual-pointer="${which}"]`)
    .getAttribute('d');
  return Number(/^M ([\d.-]+) /.exec(d ?? '')?.[1]);
};

const readout = (page: Page, id: string): Locator => mfd(page).locator(`[data-readout="${id}"]`);

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

test('in a run the fuel flow reads the cruise flow, and with ENGINE MASTER off 0.0 and no endurance', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ROW, 'easy');
  await openEnginePage(page, hasTouch);
  const textsBefore = await staticTexts(page);
  await page.waitForTimeout(1_500);
  expect(Math.abs((await numberOf(readout(page, 'fuel_flow'))) - CRUISE_FLOW)).toBeLessThanOrEqual(
    FLOW_TOLERANCE,
  );
  await expect(readout(page, 'calc_endurance')).toHaveText(/^\d+:\d\d$/);

  await activate(page.locator(`[data-hit="${ENGINE_MASTER}"]`), hasTouch);
  await expect(page.locator(`[data-control-id="${ENGINE_MASTER}"]`)).toHaveAttribute(
    'data-state',
    'off',
  );
  await expect(readout(page, 'fuel_flow')).toHaveText('0.0', { timeout: SETTLE_MS });
  await expect(readout(page, 'calc_endurance')).toHaveText('--:--');
  // Numbers changed, words did not.
  expect(await staticTexts(page)).toEqual(textsBefore);
  expect(new Set(await staticTexts(page))).toEqual(new Set(LABELS));
});

test('the free panel prints the base of every row of the page', async ({ page, hasTouch }) => {
  await openEnginePage(page, hasTouch);
  await expect(readout(page, 'fuel_flow')).toHaveText(CRUISE_FLOW.toFixed(1));
  await expect(readout(page, 'service_hours')).toHaveText(
    (DA50RG_QUANTITIES.get('service_hours')?.base ?? Number.NaN).toFixed(1),
  );
  await expect(readout(page, 'endurance_norm')).toHaveText(/^\d+:\d\d$/);
  await expect(readout(page, 'endurance_high')).toHaveText(/^\d+:\d\d$/);
});

/** Minutes of an endurance text H:MM. */
const minutesOf = async (readout: Locator): Promise<number> => {
  const [h, m] = ((await readout.textContent()) ?? '').split(':');
  return Number(h) * 60 + Number(m);
};

test('in the Easy icing run with DE-ICE MODE on HIGH the US gal number falls and the High endurance shrinks', async ({
  page,
  hasTouch,
}) => {
  // The number has one decimal: it drops after about 30 s of run time at the HIGH flow.
  test.setTimeout(120_000);
  await startScenario(page, hasTouch, ICING_ROW, 'easy');
  await openEnginePage(page, hasTouch);
  const gallons = mfd(page).locator('[data-gauge="Us gal"] text.glass-digits');
  const high = readout(page, 'endurance_high');
  const textsBefore = await staticTexts(page);
  const before = await numberOf(gallons);
  const enduranceBefore = await minutesOf(high);
  expect(before).toBeGreaterThan(0);

  // The mode toggle: a tap in the top third is HIGH.
  const box = await page.locator(`[data-hit="${DEICE_MODE}"]`).boundingBox();
  if (box === null) throw new Error('no hit box for the de-ice mode toggle');
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 6 };
  if (hasTouch) await page.touchscreen.tap(target.x, target.y);
  else await page.mouse.click(target.x, target.y);
  await expect(page.locator(`[data-control-id="${DEICE_MODE}"]`)).toHaveAttribute(
    'data-state',
    'high',
  );
  // 6 gal/h is 0.1 gal a minute: the number (one decimal) drops by 0.1 within about a minute of
  // run time, and the High endurance (whole minutes) shrinks with it.
  await expect.poll(() => numberOf(gallons), { timeout: 90_000 }).toBeLessThan(before);
  await expect.poll(() => minutesOf(high), { timeout: 90_000 }).toBeLessThan(enduranceBefore);
  expect(await staticTexts(page)).toEqual(textsBefore);
});
