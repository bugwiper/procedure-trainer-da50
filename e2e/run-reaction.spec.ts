import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { quantityOf, startScenario } from './support/session';
import { activate, afterPairWindow } from './support/zoom';

// SCN-06, PNL-04 (plan 03-01): the simulation reaches the built panel. While the pilot does nothing
// the oil temperature of ENG OIL TEMP rises and the MFD gauge follows; after POWER is reduced and
// the cowl flap opened it falls. Plan 03-04 adds the event-triggered reaction: MAX pressed with the
// de-ice mode on HIGH lights the top amber lamp, leaving HIGH puts it out. Reads the e2e-only
// window hook, so the title carries @hooks.

/** Mirror of the indicators() read-only hook of the e2e build (src/ui/bridge.ts); no DOM lib here. */
type LampHost = { __panel?: { indicators(): Record<string, 'lit' | 'off'> } };

const ROW = 'engine.eng-oil-temp-green';
const OIL_TEMP = 'oil_temp_c';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('@hooks the oil temperature rises while ignored and falls after POWER down and the cowl flap open', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ROW);
  const gauge = page.locator('[data-region-id="mfd"] [data-gauge="Oil temp"]');

  const v0 = await quantityOf(page, OIL_TEMP);
  expect(v0).toBeGreaterThan(100);
  const firstText = await gauge.textContent();

  // Ignored: the value climbs and the gauge text follows it.
  await expect.poll(() => quantityOf(page, OIL_TEMP), { timeout: 10_000 }).toBeGreaterThan(v0 + 1);
  await expect.poll(() => gauge.textContent(), { timeout: 10_000 }).not.toBe(firstText);

  // The correct actions: POWER to the 50 % marker, the cowl flap to the open marker.
  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(page.locator('[data-control-id="lv.power"]')).toHaveAttribute('data-state', 'p50');
  await activate(page.locator('[data-detent="lv.cowl_flap:open"]'), hasTouch);
  await expect(page.locator('[data-control-id="lv.cowl_flap"]')).toHaveAttribute(
    'data-state',
    'open',
  );

  const peak = await quantityOf(page, OIL_TEMP);
  await expect.poll(() => quantityOf(page, OIL_TEMP), { timeout: 15_000 }).toBeLessThan(peak - 1);
});

test('@hooks switching ENGINE MASTER off drops RPM, oil and fuel pressure and Amps on the engine page', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ROW);
  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);
  await expect(page.getByTestId('mfd-engine-page')).toBeVisible();
  const rpmGauge = page.locator('[data-region-id="mfd"] [data-gauge="RPM"]');
  const before = await rpmGauge.textContent();

  // The engine runs in cruise, so every engine quantity reads a running value.
  expect(await quantityOf(page, 'rpm')).toBeGreaterThan(1000);
  expect(await quantityOf(page, 'oil_pressure_bar')).toBeGreaterThan(2);
  expect(await quantityOf(page, 'fuel_pressure_bar')).toBeGreaterThan(0.1);
  expect(await quantityOf(page, 'alt1_amps')).toBeGreaterThan(1);

  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(page.locator('[data-control-id="sw.engine_master"]')).toHaveAttribute(
    'data-state',
    'off',
  );

  await expect.poll(() => quantityOf(page, 'rpm'), { timeout: 8_000 }).toBeLessThan(500);
  await expect.poll(() => quantityOf(page, 'oil_pressure_bar'), { timeout: 8_000 }).toBeLessThan(2);
  await expect
    .poll(() => quantityOf(page, 'fuel_pressure_bar'), { timeout: 8_000 })
    .toBeLessThan(0.1);
  await expect.poll(() => quantityOf(page, 'alt1_amps'), { timeout: 8_000 }).toBeLessThan(1);
  await expect.poll(() => rpmGauge.textContent(), { timeout: 8_000 }).not.toBe(before);
});

/** Taps one third of the de-ice MODE toggle: 1/6 is HIGH, 1/2 is NORM, 5/6 is OFF. */
async function tapMode(
  page: Page,
  hasTouch: boolean,
  fraction: number,
  state: string,
): Promise<void> {
  await afterPairWindow(page);
  const hit = page.locator('[data-hit="sw.deice_mode"]');
  const box = await hit.boundingBox();
  if (box === null) throw new Error('no hit box for the de-ice mode toggle');
  const position = { x: box.width / 2, y: box.height * fraction };
  if (hasTouch) await hit.tap({ position });
  else await hit.click({ position });
  await expect(page.locator('[data-control-id="sw.deice_mode"]')).toHaveAttribute(
    'data-state',
    state,
  );
}

const lampOf = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => (globalThis as LampHost).__panel?.indicators()['lt.deice_max']);

test('@hooks MAX on HIGH lights the top lamp during a run, leaving HIGH puts it out, MAX on NORM lights nothing', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ROW);
  expect(await lampOf(page)).toBe('off');

  await tapMode(page, hasTouch, 1 / 6, 'high');
  await activate(page.locator('[data-hit="btn.deice_max"]'), hasTouch);
  await expect.poll(() => lampOf(page), { timeout: 2_000 }).toBe('lit');

  await tapMode(page, hasTouch, 1 / 2, 'norm');
  await expect.poll(() => lampOf(page), { timeout: 2_000 }).toBe('off');

  // MAX with the mode on NORM starts nothing.
  await activate(page.locator('[data-hit="btn.deice_max"]'), hasTouch);
  await page.waitForTimeout(1_000);
  expect(await lampOf(page)).toBe('off');
});
