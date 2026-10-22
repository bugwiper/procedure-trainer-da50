import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { shippedScenarios, startScenario } from './support/session';
import { activate } from './support/zoom';

// CNT-01 (phase 03): the shipped pack as the pilot meets it on the built panel. CHOOSE SITUATION
// lists every scenario of scenarios/, and the Electrical Failure (ALTN 1 FAIL) golden run grades
// PASS. Row counts and titles are read from the shipped manifests in node, never typed in. Both
// cases use the e2e-only window hook, so the titles carry @hooks.

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
