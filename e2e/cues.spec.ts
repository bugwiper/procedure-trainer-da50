import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// The failure cues the simulation drives (Phase 5, plan 02), seen through the preview flags of the
// free panel (?q= and ?flags=), which also run against the live site: cabin smoke, windscreen ice
// and the WIND SHIELD spray. No hook is needed, only the DOM.

const SMOKE = '[data-cue="cabin_smoke"]';
const LIGHT = 'sw.light_taxi';

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

async function boxOf(page: Page, selector: string): Promise<Box | null> {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el === null) return null;
    const b = el.getBoundingClientRect();
    return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
  }, selector);
}

async function activate(hit: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await hit.tap();
  else await hit.click();
}

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`./${query}`);
  await expect(page.getByTestId('panel')).toBeVisible();
}

test('no cabin smoke on the free panel', async ({ page }) => {
  await open(page, '');
  await expect(page.locator(SMOKE)).toHaveCount(0);
});

test('?q=smoke_density:100 lays the smoke over the PFD box', async ({ page }) => {
  await open(page, '?q=smoke_density:100');
  await expect(page.locator(SMOKE)).toHaveCount(1);
  const smoke = await boxOf(page, SMOKE);
  const pfd = await boxOf(page, '[data-region-id="pfd"] [data-region-frame]');
  expect(smoke).not.toBeNull();
  expect(pfd).not.toBeNull();
  if (smoke === null || pfd === null) return;
  expect(smoke.left).toBeLessThanOrEqual(pfd.left);
  expect(smoke.right).toBeGreaterThanOrEqual(pfd.right);
  expect(smoke.top).toBeLessThanOrEqual(pfd.top);
  expect(smoke.bottom).toBeGreaterThanOrEqual(pfd.bottom);
  expect(await page.locator(SMOKE).getAttribute('pointer-events')).toBe('none');
  expect(await page.locator(`${SMOKE} text`).count()).toBe(0);
});

test('a light switch still toggles by click or tap through the smoke', async ({
  page,
  hasTouch,
}) => {
  await open(page, '?q=smoke_density:100');
  await expect(page.locator(SMOKE)).toHaveCount(1);
  const sw = page.locator(`[data-control-id="${LIGHT}"]`);
  const hit = page.locator(`[data-hit="${LIGHT}"]`);
  const before = await sw.getAttribute('data-state');
  await activate(hit, hasTouch);
  await expect.poll(async () => sw.getAttribute('data-state')).not.toBe(before);
  await expect(page.locator(SMOKE)).toHaveCount(1);
});

test('a smoke level below the visible one, or an unknown or out-of-range entry, shows nothing', async ({
  page,
}) => {
  await open(page, '?q=smoke_density:2,nonsense:5');
  await expect(page.locator(SMOKE)).toHaveCount(0);
  await open(page, '?q=smoke_density:500');
  await expect(page.locator(SMOKE)).toHaveCount(0);
});
