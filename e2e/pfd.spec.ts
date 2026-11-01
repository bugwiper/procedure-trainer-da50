import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { VS_SCALE_MAX_FPM, verticalSpeedPointerPx } from '../src/aircraft/da50rg/pfd-layout';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { DEFAULT_SCENE, SCENE_IDS } from '../src/aircraft/da50rg/scenes';
import { startScenario } from './support/session';
import { activate } from './support/zoom';

// The live PFD (Phase 6, plan 03): the altitude and vertical speed readouts follow the simulated
// quantities in a situation and keep the static base values on the free panel. Everything is read
// from the drawn text, so the specs also run against the live site (no hook).

const ALTITUDE = '[data-testid="pfd-altitude"] [data-altitude-readout]';
const VS = '[data-vs-readout]';
const VS_POINTER = '[data-testid="pfd-vs"] [data-vs-pointer]';
const QNH = '[data-qnh-readout]';
const NO_ABORT_ROW = 'fire.takeoff-fire-no-abort';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  // The rotate hint of a portrait phone covers the panel until it is dismissed.
  const dismiss = page.getByTestId('rotate-hint-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByTestId('rotate-hint')).toBeHidden();
});

/** The y offset of the moving vertical speed box from the zero line, read from its transform. */
async function pointerY(page: Page): Promise<number> {
  const transform = (await page.locator(VS_POINTER).getAttribute('transform')) ?? '';
  const match = /^translate\(0 (-?[\d.]+)\)$/.exec(transform);
  if (match?.[1] === undefined) throw new Error(`unexpected pointer transform "${transform}"`);
  return Number(match[1]);
}

const numberOf = async (page: Page, selector: string): Promise<number> =>
  Number(await page.locator(selector).first().textContent());

test('the free panel reads the static altitude and vertical speed of old', async ({ page }) => {
  await expect(page.locator(ALTITUDE)).toHaveText('1400');
  await expect(page.locator(VS)).toHaveText('0');
  expect(await pointerY(page)).toBe(0);
  await page.waitForTimeout(1500);
  await expect(page.locator(ALTITUDE)).toHaveText('1400');
  await expect(page.locator(VS)).toHaveText('0');
  expect(await pointerY(page)).toBe(0);
});

test('the vertical speed strip carries the static numerals 1, 2 and 3 and no label VS', async ({
  page,
}) => {
  const numerals = page.locator('[data-testid="pfd-vs"] [data-vs-numeral]');
  await expect(numerals).toHaveCount(6);
  expect((await numerals.allTextContents()).sort()).toEqual(['1', '1', '2', '2', '3', '3']);
  await expect(page.locator('[data-glass-zone="content"] text', { hasText: /^VS$/ })).toHaveCount(
    0,
  );
});

// The barometer setting (Phase 6.1, plan 03): a static display quantity, in turquoise under the tape.
const QNH_DEF = DA50RG_QUANTITIES.get('qnh_hpa');
if (QNH_DEF === undefined) throw new Error('no qnh_hpa');

test('the free panel reads the base QNH with the static unit HPA and no baro box', async ({
  page,
}) => {
  await expect(page.locator(QNH)).toHaveText(String(QNH_DEF.base));
  await expect(page.locator('[data-glass-zone="content"] text', { hasText: /^HPA$/ })).toHaveCount(
    1,
  );
  await expect(page.locator('[data-baro-box]')).toHaveCount(0);
});

test('?q=qnh_hpa: sets the readout and ignores a value outside the range', async ({ page }) => {
  await page.goto('./?q=qnh_hpa:1021');
  await expect(page.getByTestId('panel')).toBeVisible();
  await expect(page.locator(QNH)).toHaveText('1021');
  for (const bad of [QNH_DEF.max + 1, QNH_DEF.min - 1, 99999]) {
    await page.goto(`./?q=qnh_hpa:${String(bad)}`);
    await expect(page.getByTestId('panel')).toBeVisible();
    await expect(page.locator(QNH)).toHaveText(String(QNH_DEF.base));
  }
});

test('?q=vertical_speed_fpm: puts the box on the scale, a climb above the zero line', async ({
  page,
}) => {
  await page.goto('./?q=vertical_speed_fpm:1000');
  await expect(page.getByTestId('panel')).toBeVisible();
  expect(await pointerY(page)).toBe(verticalSpeedPointerPx(1000));
  expect(await pointerY(page)).toBeLessThan(0);
  await expect(page.locator(VS)).toHaveText('1000');
  await page.goto('./?q=vertical_speed_fpm:-700');
  await expect(page.getByTestId('panel')).toBeVisible();
  expect(await pointerY(page)).toBeGreaterThan(0);
  // A sink reads the bare number: the sign shows by the place of the box only.
  await expect(page.locator(VS)).toHaveText('700');
  await page.goto(`./?q=vertical_speed_fpm:${String(VS_SCALE_MAX_FPM)}`);
  await expect(page.getByTestId('panel')).toBeVisible();
  expect(await pointerY(page)).toBe(verticalSpeedPointerPx(VS_SCALE_MAX_FPM));
});

test('T/O FIRE NO ABORT, Easy: the altitude rises and the vertical speed box moves above the zero line', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, NO_ABORT_ROW, 'easy');
  const start = await numberOf(page, ALTITUDE);
  expect(start).toBeGreaterThanOrEqual(1450);
  await expect.poll(() => numberOf(page, ALTITUDE), { timeout: 10_000 }).toBeGreaterThan(start);
  await expect.poll(() => pointerY(page), { timeout: 10_000 }).toBeLessThan(0);
  await expect(page.locator(VS)).toHaveText(/^[1-9]\d*$/);
});

// The horizon and the flight regimes of the profile (task 2).
const HORIZON = '[data-testid="pfd-attitude"] [data-horizon]';
const ENGINE_FIRE_ROW = 'engine.eng-fire-in-flight';

/** The rotation in degrees and the shift in px of the horizon group, read from its transform. */
async function horizonOf(page: Page): Promise<{ rotation: number; shift: number }> {
  const transform = (await page.locator(HORIZON).getAttribute('transform')) ?? '';
  const match = /^rotate\((-?[\d.]+) [\d.]+ [\d.]+\) translate\(0 (-?[\d.]+)\)$/.exec(transform);
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new Error(`unexpected horizon transform "${transform}"`);
  }
  return { rotation: Number(match[1]), shift: Number(match[2]) };
}

test('the horizon group is the identity at the base values of the free panel', async ({ page }) => {
  expect(await horizonOf(page)).toEqual({ rotation: 0, shift: 0 });
});

test('?q=bank_deg:20 turns the horizon by minus the bank, ?q=pitch_deg:10 shifts it down', async ({
  page,
}) => {
  await page.goto('./?q=bank_deg:20');
  await expect(page.getByTestId('panel')).toBeVisible();
  expect(await horizonOf(page)).toEqual({ rotation: -20, shift: 0 });
  await page.goto('./?q=pitch_deg:10');
  await expect(page.getByTestId('panel')).toBeVisible();
  const pitched = await horizonOf(page);
  expect(pitched.rotation).toBe(0);
  expect(pitched.shift).toBeGreaterThan(0);
});

test('a value outside the range of the flag leaves the horizon level', async ({ page }) => {
  await page.goto('./?q=bank_deg:500,pitch_deg:nonsense');
  await expect(page.getByTestId('panel')).toBeVisible();
  expect(await horizonOf(page)).toEqual({ rotation: 0, shift: 0 });
});

test('ENGINE FIRE in flight, Easy: level before the engine stop, then the glide shows on the PFD', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ENGINE_FIRE_ROW, 'easy');
  const level = await numberOf(page, ALTITUDE);
  await page.waitForTimeout(1500);
  expect(await numberOf(page, ALTITUDE)).toBe(level);
  await expect(page.locator(VS)).toHaveText('0');
  expect(await pointerY(page)).toBe(0);
  // ENGINE MASTER off: the aircraft glides, the vertical speed turns negative and the altitude falls.
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(page.locator('[data-control-id="sw.engine_master"]')).toHaveAttribute(
    'data-state',
    'off',
  );
  await expect.poll(() => pointerY(page), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect(page.locator(VS)).toHaveText(/^[1-9]\d*$/);
  await expect.poll(() => numberOf(page, ALTITUDE), { timeout: 20_000 }).toBeLessThan(level);
});

// The synthetic vision under the whole glass (Phase 6.1, plan 02): the scene of the session is drawn
// inside the horizon group, so it turns and shifts with the attitude. Scene ids come from the
// aircraft data, never from literals.
const SVT = `${HORIZON} [data-svt]`;

test('the free panel draws one synthetic vision group in the horizon group, the default scene', async ({
  page,
}) => {
  await expect(page.locator(SVT)).toHaveCount(1);
  await expect(page.locator(SVT)).toHaveAttribute('data-svt-scene', DEFAULT_SCENE);
});

for (const id of SCENE_IDS) {
  test(`?scene=${id} draws that scene under the PFD`, async ({ page }) => {
    await page.goto(`./?scene=${id}`);
    await expect(page.getByTestId('panel')).toBeVisible();
    await expect(page.locator(SVT)).toHaveAttribute('data-svt-scene', id);
    await expect(page.locator(SVT)).toHaveCount(1);
  });
}

test('with pitch and bank set the synthetic vision sits inside the transformed horizon group', async ({
  page,
}) => {
  await page.goto('./?q=pitch_deg:10,bank_deg:20');
  await expect(page.getByTestId('panel')).toBeVisible();
  expect(await horizonOf(page)).toEqual({ rotation: -20, shift: 44 });
  await expect(page.locator(SVT)).toHaveCount(1);
  await expect(page.locator(SVT)).toHaveAttribute('data-svt-scene', DEFAULT_SCENE);
});

test('inside a situation the PFD draws the scene id of the windscreen layer', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, NO_ABORT_ROW, 'easy');
  const windscreen = await page.locator('[data-layer="windscreen"]').getAttribute('data-scene-id');
  expect(windscreen).not.toBeNull();
  await expect(page.locator(SVT)).toHaveAttribute('data-svt-scene', windscreen ?? '');
});
