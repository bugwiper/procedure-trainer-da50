import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
  FULL_VIEWBOX,
  activate,
  activateAt,
  afterPairWindow,
  doubleActivateAt,
  zoomIntoRegion,
} from './support/zoom';

// The two controls of the Engine Fire checklist that the panel gained in phase 03 plan 10 (owner
// decision 2026-10-22): the FUEL selector on the pedestal and the ECS SHUTOFF pull under the panel.
// Both follow the gesture contract (PNL-15): a tap acts on release and never zooms, the recognised
// pair retracts the first tap from the log, and no printed text changes with a state (G-0.1).

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here because
// the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
  state(): Record<string, string>;
}
type HookHost = { __panel?: PanelHook };

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

async function box(target: Locator): Promise<Box> {
  const b = await target.boundingBox();
  if (b === null) throw new Error('no bounding box');
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

/** Taps the right (clockwise) or left half of the FUEL selector, at 75 or 25 percent of its width. */
async function tapHalf(page: Page, half: 'right' | 'left', hasTouch: boolean): Promise<void> {
  const b = await box(page.locator('[data-hit="sw.fuel_valve"]'));
  await activateAt(
    page,
    { x: b.x + b.w * (half === 'right' ? 0.75 : 0.25), y: b.y + b.h / 2 },
    hasTouch,
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('FUEL selector steps NORMAL, EMERGENCY, OFF by right-half taps and back by a left-half tap', async ({
  page,
  hasTouch,
}) => {
  await zoomIntoRegion(page, hasTouch, 'pedestal');
  const panel = page.getByTestId('panel');
  const regionView = await panel.getAttribute('viewBox');
  expect(regionView).not.toBe(FULL_VIEWBOX);

  const knob = control(page, 'sw.fuel_valve');
  await expect(knob).toHaveCount(1);
  await expect(knob).toHaveAttribute('data-kind', 'rotary');
  await expect(knob).toHaveAttribute('data-state', 'normal');
  const printed = await knob.locator('text').allTextContents();
  expect([...printed].sort()).toEqual(['EMERGENCY', 'NORMAL', 'OFF']);

  await tapHalf(page, 'right', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'emergency');
  await expect(panel).toHaveAttribute('viewBox', regionView ?? '');
  expect(await knob.locator('text').allTextContents()).toEqual(printed);

  await afterPairWindow(page);
  await tapHalf(page, 'right', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'off');
  await expect(panel).toHaveAttribute('viewBox', regionView ?? '');
  expect(await knob.locator('text').allTextContents()).toEqual(printed);

  await afterPairWindow(page);
  await tapHalf(page, 'left', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'emergency');
  await expect(panel).toHaveAttribute('viewBox', regionView ?? '');
  expect(await knob.locator('text').allTextContents()).toEqual(printed);
});

test('ECS SHUTOFF pulls by its marker and the in marker pushes it back', async ({
  page,
  hasTouch,
}) => {
  const panel = page.getByTestId('panel');
  const lever = control(page, 'lv.ecs_shutoff');
  await expect(lever).toHaveCount(1);
  await expect(lever).toHaveAttribute('data-skin', 'pull-ecs');
  await expect(lever).toHaveAttribute('data-state', 'in');
  await expect(panel).toHaveAttribute('viewBox', FULL_VIEWBOX);

  const head = lever.locator('circle');
  const stowed = await box(head);
  expect((await lever.textContent())?.trim()).toBe('ECS SHUTOFF');

  await activate(page.locator('[data-detent="lv.ecs_shutoff:pulled"]'), hasTouch);
  await expect(lever).toHaveAttribute('data-state', 'pulled');
  await expect(panel).toHaveAttribute('viewBox', FULL_VIEWBOX);
  const pulled = await box(head);
  // Pulled: lower, and drawn to the left of the stowed head (pseudo-perspective, down-left).
  expect(pulled.y + pulled.h / 2).toBeGreaterThan(stowed.y + stowed.h / 2);
  expect(pulled.x + pulled.w / 2).toBeLessThan(stowed.x + stowed.w / 2);
  expect((await lever.textContent())?.trim()).toBe('ECS SHUTOFF');

  await afterPairWindow(page);
  await activate(page.locator('[data-detent="lv.ecs_shutoff:in"]'), hasTouch);
  await expect(lever).toHaveAttribute('data-state', 'in');
  await expect(panel).toHaveAttribute('viewBox', FULL_VIEWBOX);
  expect((await lever.textContent())?.trim()).toBe('ECS SHUTOFF');
});

test('@hooks a double tap on the ECS marker retracts the pull', async ({ page, hasTouch }) => {
  const lever = control(page, 'lv.ecs_shutoff');
  const marker = await box(page.locator('[data-detent="lv.ecs_shutoff:pulled"]'));
  await doubleActivateAt(
    page,
    { x: Math.round(marker.x + marker.w / 2), y: Math.round(marker.y + marker.h / 2) },
    hasTouch,
  );
  // The first tap pulled it, the recognised pair retracted it: pushed in, and not in the log.
  await expect(lever).toHaveAttribute('data-state', 'in');
  const events = await page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(events.filter((e) => e.id === 'lv.ecs_shutoff')).toEqual([]);
});
