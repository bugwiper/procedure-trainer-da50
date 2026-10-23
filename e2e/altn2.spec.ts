import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { forceVariant, startScenario } from './support/session';
import { activate } from './support/zoom';

// Phase 4 (plan 02): ALTN 2 FAIL played on the built panel. The draw is forced with forceVariant, so
// the titles carry @hooks.

const FILE = 'electrical/elec-altn2-fail';
const ROW = 'electrical.elec-altn2-fail';

const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);
const chip = (page: Page) => page.locator('[data-testid="cas-chip"]');

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('@hooks ALTN 2 FAIL: the dead alternator is switched off and the run grades PASS', async ({
  page,
  hasTouch,
}) => {
  await forceVariant(page, FILE, 'alternator_dead');
  await startScenario(page, hasTouch, ROW, 'easy');

  await expect(chip(page)).toHaveCount(1);
  await expect(chip(page)).toHaveAttribute('data-cas-id', 'altn_2_fail');
  await expect(chip(page)).toHaveAttribute('data-level', 'caution');
  await expect(chip(page)).toHaveText('ALTN 2 FAIL');

  await activate(page.locator('[data-hit="sw.alternator_2"]'), hasTouch);
  await expect(control(page, 'sw.alternator_2')).toHaveAttribute('data-state', 'off');
  // A dead alternator stays flagged.
  await expect(chip(page)).toHaveCount(1);

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
});
