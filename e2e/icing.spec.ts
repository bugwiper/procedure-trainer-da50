import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { quantityOf, startRealistic, startScenario } from './support/session';
import { activate, activateAt } from './support/zoom';

// Unintentional Flight Into Icing (Phase 5.1, plans 03 and 04: the booklet page 23) as the pilot meets it on the
// built panel: the cloud scene with ice on both halves of the windscreen, the golden actions graded
// by control state, and the WIND SHIELD spray that keeps the pilot side clear while the co-pilot
// side stays iced. Titles with @hooks read the e2e window hook.

const ROW = 'icing.icing-unintentional';
const ICE_PILOT = '[data-cue="ice_pilot_side"]';
const ICE_COPILOT = '[data-cue="ice_copilot_side"]';
const CLOUD = '[data-layer="windscreen"] [data-scene="cloud"]';
const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);

/** The DE-ICE MODE toggle to HIGH: a tap in the top third of its hit area. */
async function deiceModeHigh(page: Page, hasTouch: boolean): Promise<void> {
  const box = await page.locator('[data-hit="sw.deice_mode"]').boundingBox();
  if (box === null) throw new Error('no hit box for the de-ice mode toggle');
  await activateAt(page, { x: box.x + box.width / 2, y: box.y + box.height / 6 }, hasTouch);
  await expect(control(page, 'sw.deice_mode')).toHaveAttribute('data-state', 'high');
}
/** Realistic shows the ice within 24 s of the onset (at most 6 s after the start); the spec allows 45 s. */
const SHOWS_WITHIN_MS = 45_000;
/** The spray lasts 10 s of run time and the protection far longer; 25 s after the press proves it. */
const STAYS_CLEAR_MS = 25_000;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  // The rotate hint of a portrait phone covers the panel until it is dismissed.
  const dismiss = page.getByTestId('rotate-hint-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByTestId('rotate-hint')).toBeHidden();
});

test('@hooks Unintentional Flight Into Icing: the cloud scene and the ice of both halves show on Easy, the golden run grades PASS', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ROW, 'easy');
  await expect(page.locator(CLOUD)).toHaveCount(1);
  await expect(page.locator(ICE_PILOT)).toHaveCount(1);
  await expect(page.locator(ICE_COPILOT)).toHaveCount(1);
  await expect(control(page, 'sw.pitot_stall_heat')).toHaveAttribute('data-state', 'off');
  await expect(control(page, 'sw.deice_mode')).toHaveAttribute('data-state', 'off');

  // Rows 1 to 3: the ice protection on HIGH, the prop de-ice, the pitot and stall heat.
  await deiceModeHigh(page, hasTouch);
  await activate(page.locator('[data-hit="sw.prop_deice"]'), hasTouch);
  await expect(control(page, 'sw.prop_deice')).toHaveAttribute('data-state', 'on');
  await activate(page.locator('[data-hit="sw.pitot_stall_heat"]'), hasTouch);
  await expect(control(page, 'sw.pitot_stall_heat')).toHaveAttribute('data-state', 'on');
  await activate(page.locator('[data-detent="lv.env_temp:warm"]'), hasTouch);
  await expect(control(page, 'lv.env_temp')).toHaveAttribute('data-state', 'warm');
  await activate(page.locator('[data-detent="lv.env_direction:defrost"]'), hasTouch);
  await expect(control(page, 'lv.env_direction')).toHaveAttribute('data-state', 'defrost');
  await activate(page.locator('[data-detent="lv.power:p100"]'), hasTouch);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p100');
  await activate(page.locator('[data-detent="lv.alt_air:open"]'), hasTouch);
  await expect(control(page, 'lv.alt_air')).toHaveAttribute('data-state', 'open');

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  for (const id of [
    'deice_high',
    'prop_deice_on',
    'pitot_heat_on',
    'cabin_heat_on',
    'cabin_air_defrost',
    'power_increase',
    'alt_air_open',
  ]) {
    await expect(page.locator(`[data-step-id="${id}"]`)).toHaveAttribute('data-verdict', 'Done');
  }
  // The ICE LIGHT and the emergency window rows are optional.
  for (const id of ['ice_light_on', 'windows_open']) {
    await expect(page.locator(`[data-step-id="${id}"]`)).toHaveAttribute(
      'data-verdict',
      'Not done',
    );
  }
});

test('@hooks Unintentional Flight Into Icing without the pitot heat grades FAIL', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ROW, 'easy');
  await deiceModeHigh(page, hasTouch);
  await activate(page.locator('[data-hit="sw.prop_deice"]'), hasTouch);
  await activate(page.locator('[data-detent="lv.env_temp:warm"]'), hasTouch);
  await activate(page.locator('[data-detent="lv.env_direction:defrost"]'), hasTouch);
  await activate(page.locator('[data-detent="lv.alt_air:open"]'), hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  await expect(page.locator('[data-step-id="pitot_heat_on"]')).toHaveAttribute(
    'data-verdict',
    'Missed',
  );
});

test('@hooks Realistic: the ice shows within the bound, WIND SHIELD clears the pilot side and it stays clear, the co-pilot side stays iced', async ({
  page,
  hasTouch,
}, testInfo) => {
  test.setTimeout(testInfo.timeout * 2);
  await startRealistic(page, hasTouch, ROW);
  // No ice at the start: the level Realistic begins without a cue.
  await expect(page.locator(CLOUD)).toHaveCount(1);
  await expect(page.locator(ICE_PILOT)).toHaveCount(1, { timeout: SHOWS_WITHIN_MS });
  await expect(page.locator(ICE_COPILOT)).toHaveCount(1, { timeout: SHOWS_WITHIN_MS });

  await activate(page.locator('[data-hit="btn.deice_windshield"]'), hasTouch);
  // The spray clears the pilot glass within about a second; the other half keeps its ice.
  await expect(page.locator(ICE_PILOT)).toHaveCount(0, { timeout: 5_000 });
  await expect(page.locator(ICE_COPILOT)).toHaveCount(1);
  // Well past the spray the pilot side is still clear (the protection of 10 minutes).
  await page.waitForTimeout(STAYS_CLEAR_MS);
  await expect(page.locator(ICE_PILOT)).toHaveCount(0);
  expect(await quantityOf(page, 'ice_pilot')).toBe(0);
  await expect(page.locator(ICE_COPILOT)).toHaveCount(1);
  expect(await quantityOf(page, 'ice_copilot')).toBeGreaterThan(0);
});
