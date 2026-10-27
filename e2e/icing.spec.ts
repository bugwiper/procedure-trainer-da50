import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { quantityOf, startRealistic, startScenario } from './support/session';
import { activate } from './support/zoom';

// Unintentional Flight Into Icing Conditions (Phase 5.1, plan 03) as the pilot meets it on the
// built panel: the cloud scene with ice on both halves of the windscreen, the golden actions graded
// by control state, and the WIND SHIELD spray that keeps the pilot side clear while the co-pilot
// side stays iced. Titles with @hooks read the e2e window hook.

const ROW = 'icing.icing-unintentional';
const ICE_PILOT = '[data-cue="ice_pilot_side"]';
const ICE_COPILOT = '[data-cue="ice_copilot_side"]';
const CLOUD = '[data-layer="windscreen"] [data-scene="cloud"]';
const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);
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
  await activate(page.locator('[data-detent="lv.alt_static:open"]'), hasTouch);
  await expect(control(page, 'lv.alt_static')).toHaveAttribute('data-state', 'open');

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  for (const id of [
    'pitot_heat_on',
    'cabin_heat_on',
    'cabin_air_defrost',
    'power_increase',
    'alt_air_open',
    'alt_static_open',
  ]) {
    await expect(page.locator(`[data-step-id="${id}"]`)).toHaveAttribute('data-verdict', 'Done');
  }
  await expect(page.locator('[data-step-id="windows_open"]')).toHaveAttribute(
    'data-verdict',
    'Not done',
  );
});

test('@hooks Unintentional Flight Into Icing without the pitot heat grades FAIL', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ROW, 'easy');
  await activate(page.locator('[data-detent="lv.env_temp:warm"]'), hasTouch);
  await activate(page.locator('[data-detent="lv.env_direction:defrost"]'), hasTouch);
  await activate(page.locator('[data-detent="lv.alt_air:open"]'), hasTouch);
  await activate(page.locator('[data-detent="lv.alt_static:open"]'), hasTouch);
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
