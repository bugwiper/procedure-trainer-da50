import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { activate } from './support/zoom';

// SCN-08 (phase 02): the run's virtual clock advances with real frames only while the run is live
// and no modal is open. Every case reads an e2e-only window hook, so all titles carry @hooks.

// Mirror of the read-only session hook of the e2e build (the e2e project has no DOM lib).
type HookHost = { __panelSession?: { now(): number | null } };

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

function clockNow(page: Page): Promise<number | null> {
  return page.evaluate(() => (globalThis as HookHost).__panelSession?.now() ?? null);
}

async function startRun(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-session-hit="session.new"]'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
}

test('@hooks the run clock advances in real time after NEW SITUATION', async ({
  page,
  hasTouch,
}) => {
  expect(await clockNow(page)).toBeNull();
  await startRun(page, hasTouch);
  await page.waitForTimeout(1500);
  expect(await clockNow(page)).toBeGreaterThanOrEqual(1000);
});

test('@hooks the run clock waits while About is open and goes on after it closes', async ({
  page,
  hasTouch,
}) => {
  await startRun(page, hasTouch);
  await page.waitForTimeout(300);
  await activate(page.getByTestId('about-open'), hasTouch);
  await expect(page.getByTestId('about')).toBeVisible();
  // One frame may still be in flight when About opens; read after it.
  await page.waitForTimeout(100);
  const frozen = await clockNow(page);
  await page.waitForTimeout(700);
  expect(await clockNow(page)).toBe(frozen);

  await activate(page.getByTestId('about-close'), hasTouch);
  await expect(page.getByTestId('about')).toBeHidden();
  await expect.poll(() => clockNow(page)).toBeGreaterThan(frozen ?? Infinity);
});

test('@hooks the run clock stops at Procedure complete', async ({ page, hasTouch }) => {
  await startRun(page, hasTouch);
  await page.waitForTimeout(300);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
  await page.waitForTimeout(100);
  const stopped = await clockNow(page);
  expect(stopped).not.toBeNull();
  await page.waitForTimeout(700);
  expect(await clockNow(page)).toBe(stopped);
});
