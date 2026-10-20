import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Switch skins (PNL-11, D-08): the rocker half pressed follows the state on every device.

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(hit: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await hit.tap();
  else await hit.click();
}

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('ELECT. MASTER is the big red rocker and its pressed half follows its state', async ({
  page,
  hasTouch,
}) => {
  const sw = control(page, 'sw.elect_master');
  const hit = page.locator('[data-hit="sw.elect_master"]');
  await expect(sw).toHaveCount(1);
  await expect(sw).toHaveAttribute('data-skin', 'rocker');
  await expect(sw).toHaveAttribute('data-size', 'L');
  await expect(sw).toHaveAttribute('data-colour', 'red');
  await expect(sw).toHaveAttribute('data-pressed-half', 'upper');
  await expect(sw.locator('[data-state-text]')).toHaveText('ON');

  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-pressed-half', 'lower');
  await expect(sw.locator('[data-state-text]')).toHaveText('OFF');

  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-pressed-half', 'upper');
  await expect(sw.locator('[data-state-text]')).toHaveText('ON');
});
