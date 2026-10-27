import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { WINDSHIELD_SPRAY_ACTIVE } from '../src/aircraft/da50rg/indicators';

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

const ICE_PILOT = '[data-cue="ice_pilot_side"]';
const ICE_COPILOT = '[data-cue="ice_copilot_side"]';
const SPRAY = '[data-spray="pilot"]';
const TOLERANCE = 1.5;

test('no ice and no spray on the free panel', async ({ page }) => {
  await open(page, '');
  await expect(page.locator(ICE_PILOT)).toHaveCount(0);
  await expect(page.locator(ICE_COPILOT)).toHaveCount(0);
  await expect(page.locator(SPRAY)).toHaveCount(0);
});

test('?q=ice_pilot:80,ice_copilot:80 shows both veils, one on each half of the windscreen', async ({
  page,
}) => {
  await open(page, '?q=ice_pilot:80,ice_copilot:80');
  await expect(page.locator(ICE_PILOT)).toHaveCount(1);
  await expect(page.locator(ICE_COPILOT)).toHaveCount(1);
  const pilot = await boxOf(page, ICE_PILOT);
  const copilot = await boxOf(page, ICE_COPILOT);
  const ws = await boxOf(page, '[data-region-id="windscreen"] [data-region-frame]');
  expect(pilot).not.toBeNull();
  expect(copilot).not.toBeNull();
  expect(ws).not.toBeNull();
  if (pilot === null || copilot === null || ws === null) return;
  // The pilot half is the left one, the halves meet at the strut and fill the opening.
  expect(pilot.left).toBeLessThanOrEqual(ws.left + TOLERANCE);
  expect(copilot.right).toBeGreaterThanOrEqual(ws.right - TOLERANCE);
  expect(Math.abs(pilot.right - copilot.left)).toBeLessThanOrEqual(TOLERANCE);
  expect(await page.locator(`${ICE_PILOT} text, ${ICE_COPILOT} text`).count()).toBe(0);
  await expect(page.locator(SPRAY)).toHaveCount(0);
});

test('one side iced shows that side only', async ({ page }) => {
  await open(page, '?q=ice_copilot:60');
  await expect(page.locator(ICE_COPILOT)).toHaveCount(1);
  await expect(page.locator(ICE_PILOT)).toHaveCount(0);
});

test('the spray flag shows the spray on the pilot half only', async ({ page }) => {
  await open(page, `?q=ice_pilot:80,ice_copilot:80&flags=${WINDSHIELD_SPRAY_ACTIVE}`);
  await expect(page.locator(SPRAY)).toHaveCount(1);
  const spray = await boxOf(page, SPRAY);
  const pilot = await boxOf(page, ICE_PILOT);
  const copilot = await boxOf(page, ICE_COPILOT);
  expect(spray).not.toBeNull();
  expect(pilot).not.toBeNull();
  expect(copilot).not.toBeNull();
  if (spray === null || pilot === null || copilot === null) return;
  expect(spray.right).toBeLessThanOrEqual(copilot.left + TOLERANCE);
  expect(spray.left).toBeLessThanOrEqual(pilot.left + TOLERANCE);
  await expect(page.locator(`${SPRAY} text`)).toHaveCount(0);
});

test('an unknown flag name shows no spray', async ({ page }) => {
  await open(page, '?flags=deice.nothing');
  await expect(page.locator(SPRAY)).toHaveCount(0);
});
