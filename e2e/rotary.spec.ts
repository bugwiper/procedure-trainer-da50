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
  await expect(knob.locator('[data-state-text]')).toHaveText('OFF');

  await activate(hit, hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'on');
  await expect(knob.locator('[data-state-text]')).toHaveText('ON');

  await activate(hit, hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'off');
  await expect(knob.locator('[data-state-text]')).toHaveText('OFF');
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
  await expect(knob.locator('[data-state-text]')).toHaveText('OFF');

  await tapHalf(page, 'sw.instr_light', 'right', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 's25');
  await expect(knob.locator('[data-state-text]')).toHaveText('25');
  await tapHalf(page, 'sw.instr_light', 'right', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 's50');
  await expect(knob.locator('[data-state-text]')).toHaveText('50');

  await tapHalf(page, 'sw.instr_light', 'left', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 's25');
  await tapHalf(page, 'sw.instr_light', 'left', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'off');
});

test('a left tap at OFF stays at OFF (no wrap-around)', async ({ page, hasTouch }) => {
  await tapHalf(page, 'sw.flood_light', 'left', hasTouch);
  await tapHalf(page, 'sw.flood_light', 'left', hasTouch);
  await expect(control(page, 'sw.flood_light')).toHaveAttribute('data-state', 'off');
  await expect(control(page, 'sw.flood_light').locator('[data-state-text]')).toHaveText('OFF');
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
  await expect(knob.locator('[data-state-text]')).toHaveText('MAX');
  expect(await eventCount(page)).toBe(4);

  await tapHalf(page, 'sw.instr_light', 'right', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'max');
  expect(await eventCount(page)).toBe(4);
});

test('FAN steps OFF, 1, 2, 3, 4 and clamps at both ends', async ({ page, hasTouch }) => {
  const knob = control(page, 'sw.env_fan');
  await expect(knob).toHaveAttribute('data-state', 'off');
  await expect(knob.locator('[data-state-text]')).toHaveText('OFF');
  for (const [state, text] of [
    ['f1', '1'],
    ['f2', '2'],
    ['f3', '3'],
    ['f4', '4'],
    ['f4', '4'],
  ] as const) {
    await tapHalf(page, 'sw.env_fan', 'right', hasTouch);
    await expect(knob).toHaveAttribute('data-state', state);
    await expect(knob.locator('[data-state-text]')).toHaveText(text);
  }
  await tapHalf(page, 'sw.env_fan', 'left', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'f3');
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
  await expect(control(page, 'sw.instr_light').locator('[data-state-text]')).toHaveText('75');
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

test('a mouse move under 4 px acts as a tap', async ({ page }, testInfo) => {
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
