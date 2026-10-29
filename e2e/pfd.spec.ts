import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startScenario } from './support/session';

// The live PFD (Phase 6, plan 03): the altitude and vertical speed readouts follow the simulated
// quantities in a situation and keep the static base values on the free panel. Everything is read
// from the drawn text, so the specs also run against the live site (no hook).

const ALTITUDE = '[data-testid="pfd-altitude"] [data-altitude-readout]';
const VS = '[data-vs-readout]';
const NO_ABORT_ROW = 'fire.takeoff-fire-no-abort';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  // The rotate hint of a portrait phone covers the panel until it is dismissed.
  const dismiss = page.getByTestId('rotate-hint-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByTestId('rotate-hint')).toBeHidden();
});

const numberOf = async (page: Page, selector: string): Promise<number> =>
  Number(await page.locator(selector).first().textContent());

test('the free panel reads the static altitude and vertical speed of old', async ({ page }) => {
  await expect(page.locator(ALTITUDE)).toHaveText('1400');
  await expect(page.locator(VS)).toHaveText('0');
  await page.waitForTimeout(1500);
  await expect(page.locator(ALTITUDE)).toHaveText('1400');
  await expect(page.locator(VS)).toHaveText('0');
});

test('the vertical speed box carries the static label VS', async ({ page }) => {
  const box = page.locator('[data-glass-zone="content"] text', { hasText: /^VS$/ });
  await expect(box.first()).toBeVisible();
});

test('T/O FIRE NO ABORT, Easy: the altitude rises and the vertical speed reads a plus number', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, NO_ABORT_ROW, 'easy');
  const start = await numberOf(page, ALTITUDE);
  expect(start).toBeGreaterThanOrEqual(1450);
  await expect.poll(() => numberOf(page, ALTITUDE), { timeout: 10_000 }).toBeGreaterThan(start);
  await expect(page.locator(VS)).toHaveText(/^\+\d+$/, { timeout: 10_000 });
});
