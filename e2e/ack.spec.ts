import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ACK_STORAGE_KEY } from '../src/ui/ack';
import { activate, activateAt } from './support/zoom';

// PLT-04, D-17 (phase 02): the first-run training-aid acknowledgment on a fresh browser context.
// Every other spec starts accepted (storage seeded in playwright.config.ts); this one starts empty.
test.use({ storageState: { cookies: [], origins: [] } });

// Mirror of the read-only storage access in the page (the e2e project has no DOM lib).
type StorageHost = {
  localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
};

const ackDialog = (page: Page) => page.getByRole('dialog', { name: 'Training aid only' });

test('a fresh visitor must accept the training-aid notice once', async ({ page, hasTouch }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();

  const dialog = ackDialog(page);
  await expect(dialog).toBeVisible();
  const accept = page.getByRole('button', { name: 'I understand' });
  await expect(accept).toBeFocused();

  // Escape does not close it.
  if (!hasTouch) {
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
  }

  // A tap on the MFD page softkey behind the scrim reaches no control.
  const softkey = page.locator('[data-hit="sw.mfd_page"]');
  const control = page.locator('[data-control-id="sw.mfd_page"]');
  const before = await control.getAttribute('data-state');
  const box = await softkey.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) return;
  await activateAt(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, hasTouch);
  await expect(control).toHaveAttribute('data-state', before ?? '');
  await expect(dialog).toBeVisible();

  await activate(accept, hasTouch);
  await expect(dialog).toBeHidden();

  // Remembered: a reload does not bring it back.
  await page.reload();
  await expect(page.getByTestId('panel')).toBeVisible();
  await expect(dialog).toBeHidden();
});

test('an older accepted version asks again', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await page.evaluate((key) => {
    (globalThis as unknown as StorageHost).localStorage.setItem(key, '0');
  }, ACK_STORAGE_KEY);
  await page.reload();
  await expect(ackDialog(page)).toBeVisible();
});
