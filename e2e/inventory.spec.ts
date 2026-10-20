import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Every control added by plan 01.1-05 (de-ice panel, LEVEL, environmental sliders, PARKING
// BRAKE) must operate on every device project.

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(target: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await target.tap();
  else await target.click();
}

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('de-ice WIND SHIELD flips by mouse or tap', async ({ page, hasTouch }) => {
  const sw = control(page, 'sw.deice_windshield');
  const hit = page.locator('[data-hit="sw.deice_windshield"]');
  await expect(sw).toHaveCount(1);
  await expect(sw).toHaveAttribute('data-state', 'off');
  await expect(sw.locator('[data-state-text]')).toHaveText('OFF');

  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-state', 'on');
  await expect(sw.locator('[data-state-text]')).toHaveText('ON');

  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-state', 'off');
  await expect(sw.locator('[data-state-text]')).toHaveText('OFF');
});
