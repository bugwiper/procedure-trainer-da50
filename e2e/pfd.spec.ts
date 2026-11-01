import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DEFAULT_SCENE, SCENE_IDS } from '../src/aircraft/da50rg/scenes';
import { startScenario } from './support/session';
import { activate } from './support/zoom';

// The live PFD (Phase 6, plan 03): the altitude and vertical speed readouts follow the simulated
// quantities in a situation and keep the static base values on the free panel. Everything is read
// from the drawn text, so the specs also run against the live site (no hook).

const ALTITUDE = '[data-testid="pfd-altitude"] [data-altitude-readout]';
const VS = '[data-vs-readout]';
const NO_ABORT_ROW = 'fire.takeoff-fire-no-abort';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  // The rotate hint of a portrait phone covers the panel until it is dismissed.
  const dismiss = page.getByTestId('rotate-hint-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByTestId('rotate-hint')).toBeHidden();
});

const numberOf = async (page: Page, selector: string): Promise<number> =>
  Number(await page.locator(selector).first().textContent());

test('the free panel reads the static altitude and vertical speed of old', async ({ page }) => {
  await expect(page.locator(ALTITUDE)).toHaveText('1400');
  await expect(page.locator(VS)).toHaveText('0');
  await page.waitForTimeout(1500);
  await expect(page.locator(ALTITUDE)).toHaveText('1400');
  await expect(page.locator(VS)).toHaveText('0');
});

test('the vertical speed box carries the static label VS', async ({ page }) => {
  const box = page.locator('[data-glass-zone="content"] text', { hasText: /^VS$/ });
  await expect(box.first()).toBeVisible();
});

test('T/O FIRE NO ABORT, Easy: the altitude rises and the vertical speed reads a plus number', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, NO_ABORT_ROW, 'easy');
  const start = await numberOf(page, ALTITUDE);
  expect(start).toBeGreaterThanOrEqual(1450);
  await expect.poll(() => numberOf(page, ALTITUDE), { timeout: 10_000 }).toBeGreaterThan(start);
  await expect(page.locator(VS)).toHaveText(/^\+\d+$/, { timeout: 10_000 });
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
  // ENGINE MASTER off: the aircraft glides, the vertical speed turns negative and the altitude falls.
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(page.locator('[data-control-id="sw.engine_master"]')).toHaveAttribute(
    'data-state',
    'off',
  );
  await expect(page.locator(VS)).toHaveText(/^-\d+$/, { timeout: 20_000 });
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
