import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { forceVariant, shippedScenarios, startScenario } from './support/session';
import { activate, activateAt, afterPairWindow, leaveZoom, zoomIntoRegion } from './support/zoom';

// CNT-01 (phase 03): the shipped pack as the pilot meets it on the built panel. CHOOSE SITUATION
// lists every scenario of scenarios/, and the Electrical Failure (ALTN 1 FAIL) and Engine Fire
// golden runs grade PASS. Row counts and titles are read from the shipped manifests in node, never
// typed in. All cases use the e2e-only window hook, so the titles carry @hooks.

/** The 400 ms input shield of a freshly shown list or overlay (U-12) plus 100 ms of margin. */
const SHIELD_WAIT_MS = 500;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);

test('@hooks CHOOSE SITUATION lists every shipped scenario', async ({ page, hasTouch }) => {
  const shipped = shippedScenarios();
  expect(shipped.length).toBeGreaterThan(1);

  await activate(page.locator('[data-session-hit="session.choose"]'), hasTouch);
  await page.waitForTimeout(SHIELD_WAIT_MS);
  const rows = page.locator('[data-session-hit^="session.row."]');
  await expect(rows).toHaveCount(shipped.length);
  for (const [i, scenario] of shipped.entries()) {
    await expect(rows.nth(i)).toHaveAttribute('data-session-hit', `session.row.${scenario.row}`);
    await expect(page.getByRole('button', { name: `Open briefing: ${scenario.title}` })).toHaveText(
      scenario.title,
    );
  }
});

test('@hooks ALTN 1 FAIL: the golden run grades PASS', async ({ page, hasTouch }) => {
  // The cause is drawn by seed; this run is the one with the breaker in and a dead alternator.
  await forceVariant(page, 'electrical/elec-altn1-fail', 'alternator_dead');
  await startScenario(page, hasTouch, 'electrical.elec-altn1-fail', 'easy');

  // The yellow caution shows from the start.
  const chip = page.locator('[data-testid="cas-chip"]');
  await expect(chip).toHaveCount(1);
  await expect(chip).toHaveAttribute('data-cas-id', 'altn_1_fail');
  await expect(chip).toHaveAttribute('data-level', 'caution');
  await expect(chip).toHaveText('ALTN 1 FAIL');

  await activate(page.locator('[data-hit="sw.alternator_1"]'), hasTouch);
  await expect(control(page, 'sw.alternator_1')).toHaveAttribute('data-state', 'off');
  await activate(page.locator('[data-hit="sw.ess_bus"]'), hasTouch);
  await expect(control(page, 'sw.ess_bus')).toHaveAttribute('data-state', 'on');

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
});

/** Taps the right (clockwise) half of the FUEL selector, at 75 percent of its width. */
async function tapFuelSelectorRight(page: Page, hasTouch: boolean): Promise<void> {
  const b = await page.locator('[data-hit="sw.fuel_valve"]').boundingBox();
  if (b === null) throw new Error('no bounding box for the FUEL selector');
  await activateAt(page, { x: b.x + b.width * 0.75, y: b.y + b.height / 2 }, hasTouch);
}

test('@hooks Engine Fire: the golden run with squawk 7700 grades PASS', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, 'engine.eng-fire-in-flight', 'easy');

  // The squawk: zoom into the transponder, key 7, 7, 0, 0, leave the zoom.
  await zoomIntoRegion(page, hasTouch, 'transponder');
  for (const key of ['7', '7', '0', '0']) {
    await activate(page.locator(`[data-detent="kp.squawk:${key}"]`), hasTouch);
  }
  await leaveZoom(page, hasTouch);
  await expect(control(page, 'kp.squawk')).toHaveAttribute('data-state', '7700');

  // No message shows from the start: the fire is seen, not announced.
  await expect(page.locator('[data-testid="cas-chip"]')).toHaveCount(0);

  await expect(control(page, 'lv.env_circ')).toHaveAttribute('data-state', 'recirc');
  await activate(page.locator('[data-detent="lv.env_circ:fresh"]'), hasTouch);
  await expect(control(page, 'lv.env_circ')).toHaveAttribute('data-state', 'fresh');
  await activate(page.locator('[data-detent="lv.ecs_shutoff:pulled"]'), hasTouch);
  await expect(control(page, 'lv.ecs_shutoff')).toHaveAttribute('data-state', 'pulled');
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'off');

  // The FUEL selector: NORMAL, EMERGENCY, OFF by two right-half taps on the zoomed pedestal.
  await zoomIntoRegion(page, hasTouch, 'pedestal');
  await tapFuelSelectorRight(page, hasTouch);
  await afterPairWindow(page);
  await tapFuelSelectorRight(page, hasTouch);
  await expect(control(page, 'sw.fuel_valve')).toHaveAttribute('data-state', 'off');
  await leaveZoom(page, hasTouch);

  await activate(page.locator('[data-hit="sw.elect_master"]'), hasTouch);
  await expect(control(page, 'sw.elect_master')).toHaveAttribute('data-state', 'off');

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  await expect(page.locator('[data-step-id="squawk_7700"]')).toHaveAttribute(
    'data-verdict',
    'Done',
  );
});
