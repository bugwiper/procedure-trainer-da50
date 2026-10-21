import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here
// because the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
  state(): Record<string, string>;
}
type HookHost = { __panel?: PanelHook };

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(
  target: Locator,
  hasTouch: boolean,
  position?: { x: number; y: number },
): Promise<void> {
  if (hasTouch) await target.tap(position === undefined ? undefined : { position });
  else await target.click(position === undefined ? undefined : { position });
}

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

async function eventCount(page: Page): Promise<number> {
  return page.evaluate(() => (globalThis as HookHost).__panel?.events().length ?? -1);
}

async function box(target: Locator): Promise<{ x: number; y: number; w: number; h: number }> {
  const b = await target.boundingBox();
  if (b === null) throw new Error('no bounding box');
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

/** Taps the right (clockwise) or left half of a knob, at 75 or 25 percent of its width. */
async function tapHalf(
  page: Page,
  id: string,
  half: 'right' | 'left',
  hasTouch: boolean,
): Promise<void> {
  const hit = page.locator(`[data-hit="${id}"]`);
  const b = await box(hit);
  await activate(hit, hasTouch, { x: b.w * (half === 'right' ? 0.75 : 0.25), y: b.h / 2 });
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('FUEL TRANS is a knob that starts OFF and toggles ON and OFF by tap or click', async ({
  page,
  hasTouch,
}) => {
  const knob = control(page, 'sw.fuel_trans');
  const hit = page.locator('[data-hit="sw.fuel_trans"]');
  await expect(knob).toHaveCount(1);
  await expect(knob).toHaveAttribute('data-kind', 'rotary');
  await expect(knob).toHaveAttribute('data-state', 'off');

  await activate(hit, hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'on');

  await activate(hit, hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'off');
});

test('a two-stop knob toggles from either half', async ({ page, hasTouch }) => {
  const knob = control(page, 'sw.fuel_trans');
  await tapHalf(page, 'sw.fuel_trans', 'left', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'on');
  await tapHalf(page, 'sw.fuel_trans', 'left', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'off');
  await tapHalf(page, 'sw.fuel_trans', 'right', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'on');
});

test('@hooks each tap on FUEL TRANS appends exactly one event, a cancelled pointer none', async ({
  page,
  hasTouch,
}) => {
  const hit = page.locator('[data-hit="sw.fuel_trans"]');
  expect(await eventCount(page)).toBe(0);

  await activate(hit, hasTouch);
  await expect.poll(() => eventCount(page)).toBe(1);
  await activate(hit, hasTouch);
  await expect.poll(() => eventCount(page)).toBe(2);

  // A pointer that goes down and is cancelled records nothing, even if a pointerup follows.
  await hit.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const init = {
      pointerId: 91,
      isPrimary: true,
      bubbles: true,
      clientX: r.left + r.width * 0.75,
      clientY: r.top + r.height / 2,
    };
    el.dispatchEvent(new PointerEvent('pointerdown', init));
    el.dispatchEvent(new PointerEvent('pointercancel', init));
    el.dispatchEvent(new PointerEvent('pointerup', init));
  });
  expect(await eventCount(page)).toBe(2);

  const events = await page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(events.map((e) => [e.id, e.value])).toEqual([
    ['sw.fuel_trans', 'on'],
    ['sw.fuel_trans', 'off'],
  ]);
});

// Multi-stop knobs (Task 2).

const WEBKIT_TOUCH_NOTE =
  'WebKit cannot emulate touch drags (RESEARCH Pitfall 3); the real-device check covers it';

interface Point {
  x: number;
  y: number;
}

async function centre(target: Locator): Promise<Point> {
  const b = await box(target);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** Screen px per viewBox unit, from the 60-unit-wide hit rect of a dimmer. */
async function unitPx(page: Page, id: string, widthUnits: number): Promise<number> {
  const b = await box(page.locator(`[data-hit="${id}"]`));
  return b.w / widthUnits;
}

async function stateOf(page: Page, id: string): Promise<string> {
  return (await control(page, id).getAttribute('data-state')) ?? '';
}

test('INSTRUMENT LIGHT steps one stop per tap on the right half and back on the left half', async ({
  page,
  hasTouch,
}) => {
  const knob = control(page, 'sw.instr_light');
  await expect(knob).toHaveAttribute('data-kind', 'rotary');
  await expect(knob).toHaveAttribute('data-state', 'off');

  await tapHalf(page, 'sw.instr_light', 'right', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 's25');
  await tapHalf(page, 'sw.instr_light', 'right', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 's50');

  await tapHalf(page, 'sw.instr_light', 'left', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 's25');
  await tapHalf(page, 'sw.instr_light', 'left', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'off');
});

test('a left tap at OFF stays at OFF (no wrap-around)', async ({ page, hasTouch }) => {
  await tapHalf(page, 'sw.flood_light', 'left', hasTouch);
  await tapHalf(page, 'sw.flood_light', 'left', hasTouch);
  await expect(control(page, 'sw.flood_light')).toHaveAttribute('data-state', 'off');
});

test('@hooks four right taps from OFF end at MAX and a fifth records no event', async ({
  page,
  hasTouch,
}) => {
  const knob = control(page, 'sw.instr_light');
  for (const expected of ['s25', 's50', 's75', 'max']) {
    await tapHalf(page, 'sw.instr_light', 'right', hasTouch);
    await expect(knob).toHaveAttribute('data-state', expected);
  }
  await expect(knob).toHaveAttribute('data-state', 'max');
  expect(await eventCount(page)).toBe(4);

  await tapHalf(page, 'sw.instr_light', 'right', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'max');
  expect(await eventCount(page)).toBe(4);
});

test('FAN sets each position by a tap on its spot and a tap on the current one changes nothing', async ({
  page,
  hasTouch,
}) => {
  const knob = control(page, 'sw.env_fan');
  await expect(knob).toHaveAttribute('data-state', 'off');
  for (const state of ['f2', 'f3', 'f1', 'off'] as const) {
    await activate(page.locator(`[data-detent="sw.env_fan:${state}"]`), hasTouch);
    await expect(knob).toHaveAttribute('data-state', state);
  }
});

test('@hooks a FAN spot records exactly one event with the stop id, the current stop none', async ({
  page,
  hasTouch,
}) => {
  const spot = (stop: string) => page.locator(`[data-detent="sw.env_fan:${stop}"]`);
  expect(await eventCount(page)).toBe(0);
  await activate(spot('f2'), hasTouch);
  await expect.poll(() => eventCount(page)).toBe(1);
  await activate(spot('f2'), hasTouch);
  await activate(spot('off'), hasTouch);
  await expect.poll(() => eventCount(page)).toBe(2);
  const events = await page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(events.map((e) => [e.id, e.value])).toEqual([
    ['sw.env_fan', 'f2'],
    ['sw.env_fan', 'off'],
  ]);
});

/** Taps a knob-local point of the FAN (units from its centre) by page coordinates. */
async function tapFanAt(page: Page, hasTouch: boolean, ux: number, uy: number): Promise<void> {
  const hit = page.locator('[data-hit="sw.env_fan"]');
  await hit.scrollIntoViewIfNeeded();
  const b = await box(hit);
  const unit = b.w / 112;
  const x = b.x + b.w / 2 + ux * unit;
  const y = b.y + b.h / 2 + uy * unit;
  if (hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test('@hooks FAN: a tap on each mark and on the body sets one stop and records one event', async ({
  page,
  hasTouch,
}) => {
  const knob = control(page, 'sw.env_fan');
  // The marks take no pointer events: the centre of the OFF word and a point inside each glyph, by
  // coordinates. The f1 and f3 points sit 5.5 units inside their spot (spots span x -55.5..-18.5,
  // -18.5..18.5 and 18.5..55.5, y -40.5..-3.5), not on the glyph centre 0.6 units from the f2 edge,
  // where WebKit and Chromium round the boundary differently.
  const steps: [string, number, number][] = [
    ['f1', -24, -11],
    ['f2', 0, -22],
    ['f3', 24, -11],
    ['off', 0, 21.5],
    // The body between the spots: the right half at half height gives f3, the left half f1.
    ['f3', 28, 0],
    ['f1', -28, 0],
  ];
  let count = 0;
  for (const [stop, ux, uy] of steps) {
    await tapFanAt(page, hasTouch, ux, uy);
    await expect(knob, stop).toHaveAttribute('data-state', stop);
    count += 1;
    expect(await eventCount(page), stop).toBe(count);
  }
  // The exact centre does nothing (the dead zone is 2 units wide, tests/rotary.test.ts checks it
  // exactly), and the repeated tap on the current stop records no event. Touch coordinates round to
  // whole px, so the centre is only a fair test when 2 units span more than 1 px; at the full
  // phone view a unit is 0.24 px and the rounding alone moves the tap onto a stop.
  const unit = (await box(page.locator('[data-hit="sw.env_fan"]'))).w / 112;
  if (!hasTouch || unit * 2 > 1) await tapFanAt(page, hasTouch, 0, 0);
  await tapFanAt(page, hasTouch, -28, 0);
  await expect(knob).toHaveAttribute('data-state', 'f1');
  expect(await eventCount(page)).toBe(count);
  const events = await page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(events.map((e) => [e.id, e.value])).toEqual(steps.map(([stop]) => ['sw.env_fan', stop]));
});

test('FAN reaches OFF, 1, 2 and 3 by a drag toward each stop and prints only OFF', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop mouse path');
  const hit = page.locator('[data-hit="sw.env_fan"]');
  const c = await centre(hit);
  const unit = await unitPx(page, 'sw.env_fan', 112);
  // Directions clockwise from 12 o'clock: f1 300, f2 360, f3 420 (60), off 180.
  const targets: [string, number][] = [
    ['f1', 300],
    ['f2', 0],
    ['f3', 60],
    ['off', 180],
  ];
  for (const [stop, deg] of targets) {
    const rad = (deg * Math.PI) / 180;
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x + 26 * unit * Math.sin(rad), c.y - 26 * unit * Math.cos(rad), {
      steps: 6,
    });
    await page.mouse.up();
    await expect(control(page, 'sw.env_fan'), stop).toHaveAttribute('data-state', stop);
  }
  await expect(control(page, 'sw.env_fan').locator('text')).toHaveText(['OFF']);
});

test('a mouse drag to the 3 o clock direction snaps INSTRUMENT LIGHT to 75 on release', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop mouse path');
  const hit = page.locator('[data-hit="sw.instr_light"]');
  const c = await centre(hit);
  const unit = await unitPx(page, 'sw.instr_light', 60);

  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 8 * unit, c.y, { steps: 3 });
  await page.mouse.move(c.x + 26 * unit, c.y, { steps: 5 });
  // The pointer follows the finger but nothing is committed before the release.
  await expect(control(page, 'sw.instr_light')).toHaveAttribute('data-state', 'off');
  await page.mouse.up();
  await expect(control(page, 'sw.instr_light')).toHaveAttribute('data-state', 's75');
});

test('@hooks a drag in progress records nothing and a drag back to the same stop records no event', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop mouse path');
  const hit = page.locator('[data-hit="sw.flood_light"]');
  const c = await centre(hit);
  const unit = await unitPx(page, 'sw.flood_light', 60);
  expect(await eventCount(page)).toBe(0);

  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 26 * unit, c.y, { steps: 5 });
  await page.mouse.move(c.x, c.y - 26 * unit, { steps: 5 });
  expect(await eventCount(page)).toBe(0);
  // Back to the lower left, the OFF position at 225 degrees.
  await page.mouse.move(c.x - 18 * unit, c.y + 18 * unit, { steps: 5 });
  await page.mouse.up();
  expect(await eventCount(page)).toBe(0);
  expect(await stateOf(page, 'sw.flood_light')).toBe('off');

  // A real drag to the top records exactly one event with the stop id, never an angle.
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x, c.y - 26 * unit, { steps: 6 });
  await page.mouse.up();
  await expect(control(page, 'sw.flood_light')).toHaveAttribute('data-state', 's50');
  const events = await page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(events.map((e) => [e.id, e.value])).toEqual([['sw.flood_light', 's50']]);
});

test('@hooks a mouse move under 4 px acts as a tap', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop mouse path');
  const hit = page.locator('[data-hit="sw.instr_light"]');
  const b = await box(hit);
  const from = { x: b.x + b.w * 0.75, y: b.y + b.h / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 2, from.y + 1);
  await page.mouse.up();
  await expect(control(page, 'sw.instr_light')).toHaveAttribute('data-state', 's25');
  expect(await eventCount(page)).toBe(1);
});

test('touch drag on a dimmer snaps to the nearest stop without scrolling', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-chromium', WEBKIT_TOUCH_NOTE);
  const hit = page.locator('[data-hit="sw.instr_light"]');
  const c = await centre(hit);
  const unit = await unitPx(page, 'sw.instr_light', 60);

  const cdp = await page.context().newCDPSession(page);
  const touch = (x: number, y: number) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(c.x, c.y) });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touch(c.x + (26 * unit * i) / 6, c.y),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(control(page, 'sw.instr_light')).toHaveAttribute('data-state', 's75');
});
