import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

// Mouse projects click, touch projects tap; both reach the same handlers.
async function activate(el: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await el.tap();
  else await el.click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('About opens from the footer and shows the policy', async ({ page, hasTouch }) => {
  await activate(page.getByTestId('about-open'), hasTouch);
  const about = page.getByTestId('about');
  await expect(about).toBeVisible();
  await expect(about.getByRole('heading', { name: 'About this trainer' })).toBeVisible();
  await expect(page.getByTestId('policy-text')).toContainText('## 3. What must never be committed');

  await activate(page.getByTestId('about-close'), hasTouch);
  await expect(about).toBeHidden();
});

test('Escape closes About', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'no keyboard on touch projects');
  await page.getByTestId('about-open').click();
  await expect(page.getByTestId('about')).toBeVisible();
  // Focus moves to Close once the dialog's effects have run and the key listener exists.
  await expect(page.getByTestId('about-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('about')).toBeHidden();
});
