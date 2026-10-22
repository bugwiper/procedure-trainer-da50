import { expect, test } from '@playwright/test';
import { quantityOf, startScenario } from './support/session';
import { activate } from './support/zoom';

// SCN-06, PNL-04 (plan 03-01): the simulation reaches the built panel. While the pilot does nothing
// the oil temperature of ENG OIL TEMP rises and the MFD gauge follows; after POWER is reduced and
// the cowl flap opened it falls. Reads the e2e-only window hook, so the title carries @hooks.

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
