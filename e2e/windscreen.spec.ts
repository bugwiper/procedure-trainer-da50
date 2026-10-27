import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startRealistic, startScenario } from './support/session';
import { FULL_VIEWBOX, activateAt, afterPairWindow, doubleActivateAt } from './support/zoom';
import type { Point } from './support/zoom';

// The windscreen above the panel (Phase 5): its place in the full view, the zoom to it and the
// first failure cue, the flames of the Engine Fire, driven by the simulation.

const FIRE = 'engine.eng-fire-in-flight';

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

const REGION = '[data-region-id="windscreen"] [data-region-frame]';
const FLAMES = '[data-cue="flames"]';
const TOLERANCE = 1.5;

async function windscreenBox(page: Page): Promise<Box> {
  const box = await boxOf(page, REGION);
  if (box === null) throw new Error('no windscreen region');
  return box;
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('the windscreen lies inside the svg box at the full view and its layer draws no text', async ({
  page,
}) => {
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  const svg = await boxOf(page, '[data-testid="panel"]');
  const ws = await windscreenBox(page);
  expect(svg).not.toBeNull();
  if (svg === null) return;
  expect(ws.left).toBeGreaterThanOrEqual(svg.left - TOLERANCE);
  expect(ws.right).toBeLessThanOrEqual(svg.right + TOLERANCE);
  expect(ws.top).toBeGreaterThanOrEqual(svg.top - TOLERANCE);
  expect(ws.bottom).toBeLessThanOrEqual(svg.bottom + TOLERANCE);
  expect(ws.bottom - ws.top).toBeGreaterThan(20);
  const texts = await page
    .locator('[data-layer="windscreen"] text, [data-layer="windscreen"] tspan')
    .count();
  expect(texts).toBe(0);
  await expect(page.locator('[data-layer="windscreen"]')).toHaveCount(1);
});

test('a double tap on the windscreen zooms to it and Full panel returns to the extent', async ({
  page,
  hasTouch,
}) => {
  const ws = await windscreenBox(page);
  // A point in the upper part of the opening, clear of the Full panel corner.
  const p: Point = { x: (ws.left + ws.right) / 2, y: ws.top + (ws.bottom - ws.top) * 0.35 };
  await activateAt(page, p, hasTouch);
  await page.waitForTimeout(120);
  expect(await page.getByTestId('panel').getAttribute('viewBox')).toBe(FULL_VIEWBOX);
  await afterPairWindow(page);
  await doubleActivateAt(page, p, hasTouch);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  const view = ((await page.getByTestId('panel').getAttribute('viewBox')) ?? '')
    .split(' ')
    .map(Number);
  expect(view[3]).toBeLessThan(Number(FULL_VIEWBOX.split(' ')[3]));
  await expect(page.getByTestId('zoom-out')).toBeVisible();
  if (hasTouch) await page.getByTestId('zoom-out').tap();
  else await page.getByTestId('zoom-out').click();
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
});

test('no flames on the free panel', async ({ page }) => {
  await expect(page.locator(FLAMES)).toHaveCount(0);
});

test('Engine Fire on Easy shows the flames inside the windscreen from the start', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, FIRE, 'easy');
  await expect(page.locator(FLAMES)).toHaveCount(1);
  const flames = await boxOf(page, FLAMES);
  const ws = await windscreenBox(page);
  expect(flames).not.toBeNull();
  if (flames === null) return;
  expect(flames.left).toBeGreaterThanOrEqual(ws.left - TOLERANCE);
  expect(flames.right).toBeLessThanOrEqual(ws.right + TOLERANCE);
  expect(flames.top).toBeGreaterThanOrEqual(ws.top - TOLERANCE);
  expect(flames.bottom).toBeLessThanOrEqual(ws.bottom + TOLERANCE);
});

test('Engine Fire on Medium shows the flames from the start', async ({ page, hasTouch }) => {
  await startScenario(page, hasTouch, FIRE, 'medium');
  await expect(page.locator(FLAMES)).toHaveCount(1);
});

test('Engine Fire on Realistic shows no flames at the start and flames within 15 s', async ({
  page,
  hasTouch,
}) => {
  test.setTimeout(60_000);
  await startRealistic(page, hasTouch, FIRE);
  await expect(page.locator(FLAMES)).toHaveCount(0);
  await expect(page.locator(FLAMES)).toHaveCount(1, { timeout: 15_000 });
});
