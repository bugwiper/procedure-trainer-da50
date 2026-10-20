import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Gear and flap lamps (PNL-14, D-11): derived from the levers, never operable, never graded.

async function activate(target: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await target.tap();
  else await target.click();
}

function lamp(page: Page, id: string): Locator {
  return page.locator(`[data-indicator-id="${id}"]`);
}

const GEAR_LAMPS = ['lt.gear_nose', 'lt.gear_left', 'lt.gear_right', 'lt.gear_unsafe'] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('GEAR DOWN lights the three green lamps and GEAR UP turns all four off', async ({
  page,
  hasTouch,
}) => {
  for (const id of GEAR_LAMPS) await expect(lamp(page, id)).toHaveAttribute('data-lit', 'false');

  await activate(page.locator('[data-detent="lv.gear:down"]'), hasTouch);
  await expect(lamp(page, 'lt.gear_nose')).toHaveAttribute('data-lit', 'true');
  await expect(lamp(page, 'lt.gear_left')).toHaveAttribute('data-lit', 'true');
  await expect(lamp(page, 'lt.gear_right')).toHaveAttribute('data-lit', 'true');
  await expect(lamp(page, 'lt.gear_unsafe')).toHaveAttribute('data-lit', 'false');

  await activate(page.locator('[data-detent="lv.gear:up"]'), hasTouch);
  for (const id of GEAR_LAMPS) await expect(lamp(page, id)).toHaveAttribute('data-lit', 'false');
});
