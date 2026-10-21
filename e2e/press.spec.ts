import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PANEL_VIEWBOX } from '../tests/layout-reference';
import { DRAG_START_PX, MOMENTARY_HOLD_MS } from '../src/ui/panel/press-arbiter';
import {
  DOUBLE_TAP_PX,
  MOUSE_SLOP_PX,
  TAP_MAX_MS,
  TOUCH_SLOP_PX,
} from '../src/ui/panel/tap-intent';
import { touchSender } from './support/touch';
import {
  FULL_VIEWBOX,
  activateAt,
  afterPairWindow,
  backgroundPoint,
  doubleActivateAt,
  zoomIntoRegion,
} from './support/zoom';
import type { Point } from './support/zoom';

// Latching controls act on release (R3-Z2, PNL-11, PNL-15, PNL-06): a press is pending and shows
// the pressed ring, a lift within the slop is a tap and actuates once, a drag beyond the slop is a
// pan (when zoomed) and does not actuate, a second finger pinches. The slop numbers come from
// src/ui/panel/tap-intent.ts, never typed here. Every case reads data-state and the viewBox, so
// it runs in the live rehearsal; only the @hooks cases read the event log.

interface HookHost {
  __panel?: { events(): { id: string; value: string }[] };
}

/** Table T2 and T3: the case table, extended by plans 38 and 39. */
interface PressCase {
  readonly name: string;
  /** Selector of the hit element a press lands on. */
  readonly selector: string;
  /** The control id of the group that shows the state (data-state). */
  readonly id: string;
  readonly region: string;
  /** The state before a tap and the state a tap on the hit centre leads to. */
  readonly before: string;
  readonly after: string;
  /** The group shows data-pressed while the press is pending. */
  readonly ring: boolean;
}

const CASES: readonly PressCase[] = [
  {
    name: 'engine master toggle',
    selector: '[data-hit="sw.engine_master"]',
    id: 'sw.engine_master',
    region: 'switch_bank',
    before: 'on',
    after: 'off',
    ring: true,
  },
  {
    name: 'circuit breaker',
    selector: '[data-hit="cb.pitot"]',
    id: 'cb.pitot',
    region: 'cb_essential',
    before: 'in',
    after: 'out',
    ring: true,
  },
  {
    name: 'guard cover',
    selector: '[data-hit="sw.deice_alternate.guard"]',
    id: 'sw.deice_alternate.guard',
    region: 'deice',
    before: 'closed',
    after: 'open',
    ring: false,
  },
  {
    name: 'parking brake flap',
    selector: '[data-hit="lv.parking_brake"]',
    id: 'lv.parking_brake',
    region: 'pedestal',
    before: 'off',
    after: 'set',
    ring: true,
  },
  {
    name: 'flaps marker T/O',
    selector: '[data-detent="lv.flaps:to"]',
    id: 'lv.flaps',
    region: 'flaps',
    before: 'up',
    after: 'to',
    ring: false,
  },
  {
    name: 'FAN spot f2',
    selector: '[data-detent="sw.env_fan:f2"]',
    id: 'sw.env_fan',
    region: 'env_control',
    before: 'off',
    after: 'f2',
    ring: false,
  },
];

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

function isMouseProject(name: string): boolean {
  return name.startsWith('desktop-');
}

async function viewNumbers(page: Page): Promise<{ x: number; y: number; w: number; h: number }> {
  const raw = (await page.getByTestId('panel').getAttribute('viewBox')) ?? '';
  const [x, y, w, h] = raw.split(' ').map(Number);
  return { x: x ?? NaN, y: y ?? NaN, w: w ?? NaN, h: h ?? NaN };
}

/** The centre of a hit element (by selector) in whole client px, so slop distances are exact. */
async function hitCentre(page: Page, selector: string): Promise<Point> {
  const box = await page.locator(selector).boundingBox();
  if (box === null) throw new Error(`no box for ${selector}`);
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

/** A diagonal drag of `d` px per axis, away from the clamped edges of the current view. */
async function panVector(page: Page, d: number): Promise<Point> {
  const v = await viewNumbers(page);
  return {
    x: v.x > (PANEL_VIEWBOX.w - v.w) / 2 ? d : -d,
    y: v.y > (PANEL_VIEWBOX.h - v.h) / 2 ? d : -d,
  };
}

async function eventCount(page: Page): Promise<number> {
  return page.evaluate(() => (globalThis as unknown as HookHost).__panel?.events().length ?? -1);
}

async function mouseDrag(page: Page, from: Point, by: Point): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 6 });
  await page.mouse.up();
}

async function touchDrag(page: Page, from: Point, by: Point): Promise<void> {
  const send = await touchSender(page);
  await send('touchStart', [from]);
  for (let i = 1; i <= 6; i++) {
    await send('touchMove', [{ x: from.x + (by.x * i) / 6, y: from.y + (by.y * i) / 6 }]);
  }
  await send('touchEnd', []);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

for (const c of CASES) {
  test.describe(c.name, () => {
    test('mouse: the press is pending, the lift actuates', async ({ page }, testInfo) => {
      test.skip(!isMouseProject(testInfo.project.name), 'mouse path');
      const group = control(page, c.id);
      await expect(group).toHaveAttribute('data-state', c.before);
      const p = await hitCentre(page, c.selector);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await expect(group).toHaveAttribute('data-state', c.before);
      if (c.ring) await expect(group).toHaveAttribute('data-pressed', 'true');
      await page.mouse.up();
      await expect(group).toHaveAttribute('data-state', c.after);
      await expect(group).not.toHaveAttribute('data-pressed', 'true');
    });

    test('touch: touchStart leaves the state, touchEnd actuates', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
      const group = control(page, c.id);
      const p = await hitCentre(page, c.selector);
      const send = await touchSender(page);
      await send('touchStart', [p]);
      await expect(group).toHaveAttribute('data-state', c.before);
      if (c.ring) await expect(group).toHaveAttribute('data-pressed', 'true');
      await send('touchEnd', []);
      await expect(group).toHaveAttribute('data-state', c.after);
      await expect(group).not.toHaveAttribute('data-pressed', 'true');
    });

    test('mouse: a drag from the hit pans the zoomed view and does not actuate', async ({
      page,
    }, testInfo) => {
      test.skip(!isMouseProject(testInfo.project.name), 'mouse path');
      await zoomIntoRegion(page, false, c.region);
      const group = control(page, c.id);
      const before = await viewNumbers(page);
      const by = await panVector(page, MOUSE_SLOP_PX + 25);
      await mouseDrag(page, await hitCentre(page, c.selector), by);
      const after = await viewNumbers(page);
      expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(0.5);
      expect(after.w).toBeCloseTo(before.w);
      await expect(group).toHaveAttribute('data-state', c.before);
      await expect(group).not.toHaveAttribute('data-pressed', 'true');
    });

    test('touch: a drag from the hit pans the zoomed view and does not actuate', async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
      await zoomIntoRegion(page, true, c.region);
      const group = control(page, c.id);
      const before = await viewNumbers(page);
      const by = await panVector(page, TOUCH_SLOP_PX + 25);
      await touchDrag(page, await hitCentre(page, c.selector), by);
      const after = await viewNumbers(page);
      expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(0.5);
      expect(after.w).toBeCloseTo(before.w);
      await expect(group).toHaveAttribute('data-state', c.before);
      await expect(group).not.toHaveAttribute('data-pressed', 'true');
    });

    // The press one pixel beyond the slop comes first: a tap that actuates can move the lever
    // handle over a marker, and a press on the handle is its own drag, not the case under test.
    test('mouse: one pixel more than the slop is a pan, exactly the slop is a tap', async ({
      page,
    }, testInfo) => {
      test.skip(!isMouseProject(testInfo.project.name), 'mouse path');
      await zoomIntoRegion(page, false, c.region);
      const group = control(page, c.id);
      const start = await viewNumbers(page);
      const dir = (await panVector(page, 1)).x;

      const q = await hitCentre(page, c.selector);
      await page.mouse.move(q.x, q.y);
      await page.mouse.down();
      await page.mouse.move(q.x + dir * (MOUSE_SLOP_PX + 1), q.y);
      await page.mouse.up();
      await expect(group).toHaveAttribute('data-state', c.before);
      const panned = await viewNumbers(page);
      expect(Math.abs(panned.x - start.x) + Math.abs(panned.y - start.y)).toBeGreaterThan(0.01);

      const p = await hitCentre(page, c.selector);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + MOUSE_SLOP_PX, p.y);
      await page.mouse.up();
      await expect(group).toHaveAttribute('data-state', c.after);
      const tapped = await viewNumbers(page);
      expect([tapped.x, tapped.y, tapped.w]).toEqual([panned.x, panned.y, panned.w]);
    });

    test('touch: one pixel more than the slop is a pan, exactly the slop is a tap', async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
      await zoomIntoRegion(page, true, c.region);
      const group = control(page, c.id);
      const start = await viewNumbers(page);
      const send = await touchSender(page);
      const dir = (await panVector(page, 1)).x;

      const q = await hitCentre(page, c.selector);
      await send('touchStart', [q]);
      await send('touchMove', [{ x: q.x + dir * (TOUCH_SLOP_PX + 1), y: q.y }]);
      await send('touchEnd', []);
      await expect(group).toHaveAttribute('data-state', c.before);
      const panned = await viewNumbers(page);
      expect(Math.abs(panned.x - start.x) + Math.abs(panned.y - start.y)).toBeGreaterThan(0.01);

      const p = await hitCentre(page, c.selector);
      await send('touchStart', [p]);
      await send('touchMove', [{ x: p.x + TOUCH_SLOP_PX, y: p.y }]);
      await send('touchEnd', []);
      await expect(group).toHaveAttribute('data-state', c.after);
      const tapped = await viewNumbers(page);
      expect([tapped.x, tapped.y, tapped.w]).toEqual([panned.x, panned.y, panned.w]);
    });

    test('at the full view a drag from the hit changes neither state nor view', async ({
      page,
    }, testInfo) => {
      const name = testInfo.project.name;
      test.skip(!isMouseProject(name) && name !== 'phone-chromium', 'Chromium gestures only');
      const group = control(page, c.id);
      const p = await hitCentre(page, c.selector);
      if (name === 'phone-chromium') {
        await touchDrag(page, p, { x: TOUCH_SLOP_PX + 25, y: TOUCH_SLOP_PX + 25 });
      } else {
        await mouseDrag(page, p, { x: MOUSE_SLOP_PX + 25, y: MOUSE_SLOP_PX + 25 });
      }
      await expect(group).toHaveAttribute('data-state', c.before);
      await expect(group).not.toHaveAttribute('data-pressed', 'true');
      await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
    });

    test('touch: a second finger on the background starts a pinch, the control does not act', async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
      const group = control(page, c.id);
      const p = await hitCentre(page, c.selector);
      const spare = await backgroundPoint(page, c.region);
      const send = await touchSender(page);
      await send('touchStart', [p]);
      if (c.ring) await expect(group).toHaveAttribute('data-pressed', 'true');
      await send('touchStart', [p, spare]);
      await expect(group).not.toHaveAttribute('data-pressed', 'true');
      const away = (f: number): Point[] => [
        { x: p.x - (spare.x - p.x) * f * 0.5, y: p.y - (spare.y - p.y) * f * 0.5 },
        { x: spare.x + (spare.x - p.x) * f * 0.5, y: spare.y + (spare.y - p.y) * f * 0.5 },
      ];
      for (let i = 1; i <= 8; i++) await send('touchMove', away(i / 2));
      await send('touchEnd', []);
      const view = await viewNumbers(page);
      expect(view.w).toBeLessThan(PANEL_VIEWBOX.w);
      await expect(group).toHaveAttribute('data-state', c.before);
    });
  });
}

test('touch: a pinch whose two fingers both start on switches zooms and leaves both unchanged', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
  const ids = await page
    .locator('[data-region-id="switch_bank"] [data-hit][data-press="latch"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-hit') ?? ''));
  expect(ids.length).toBeGreaterThanOrEqual(2);
  const [idA, idB] = [ids[0] ?? '', ids[1] ?? ''];
  const stateA = await control(page, idA).getAttribute('data-state');
  const stateB = await control(page, idB).getAttribute('data-state');
  const a = await hitCentre(page, `[data-hit="${idA}"]`);
  const b = await hitCentre(page, `[data-hit="${idB}"]`);
  const send = await touchSender(page);
  await send('touchStart', [a, b]);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (let i = 1; i <= 8; i++) {
    const f = (i / 8) * 1.5;
    await send('touchMove', [
      { x: a.x - dx * f * 0.5, y: a.y - dy * f * 0.5 },
      { x: b.x + dx * f * 0.5, y: b.y + dy * f * 0.5 },
    ]);
  }
  await send('touchEnd', []);
  expect((await viewNumbers(page)).w).toBeLessThan(PANEL_VIEWBOX.w);
  expect(await control(page, idA).getAttribute('data-state')).toBe(stateA);
  expect(await control(page, idB).getAttribute('data-state')).toBe(stateB);
});

test('the guard: a drag from the cover or the switch pans, a tap lifts and flips on release', async ({
  page,
}, testInfo) => {
  const name = testInfo.project.name;
  test.skip(!isMouseProject(name) && name !== 'phone-chromium', 'Chromium gestures only');
  const touch = name === 'phone-chromium';
  const guard = control(page, 'sw.deice_alternate.guard');
  const sw = control(page, 'sw.deice_alternate');
  await zoomIntoRegion(page, touch, 'deice');
  const slop = touch ? TOUCH_SLOP_PX : MOUSE_SLOP_PX;
  const drag = touch ? touchDrag : mouseDrag;

  // A tap whose lift is separate from its press: nothing changes before the lift.
  const tapOn = async (hit: string, control: Locator, before: string, after: string) => {
    const p = await hitCentre(page, `[data-hit="${hit}"]`);
    if (touch) {
      const send = await touchSender(page);
      await send('touchStart', [p]);
      await expect(control).toHaveAttribute('data-state', before);
      await send('touchEnd', []);
    } else {
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await expect(control).toHaveAttribute('data-state', before);
      await page.mouse.up();
    }
    await expect(control).toHaveAttribute('data-state', after);
  };

  // A drag from the closed cover pans and does not lift it.
  const v0 = await viewNumbers(page);
  await drag(
    page,
    await hitCentre(page, '[data-hit="sw.deice_alternate.guard"]'),
    await panVector(page, slop + 25),
  );
  const v1 = await viewNumbers(page);
  expect(Math.abs(v1.x - v0.x) + Math.abs(v1.y - v0.y)).toBeGreaterThan(0.5);
  await expect(guard).toHaveAttribute('data-state', 'closed');

  await tapOn('sw.deice_alternate.guard', guard, 'closed', 'open');
  await expect(sw).toHaveAttribute('data-state', 'off');
  await afterPairWindow(page);
  await tapOn('sw.deice_alternate', sw, 'off', 'on');

  // A drag from the switch pans and does not flip it.
  const v2 = await viewNumbers(page);
  await drag(
    page,
    await hitCentre(page, '[data-hit="sw.deice_alternate"]'),
    await panVector(page, slop + 25),
  );
  const v3 = await viewNumbers(page);
  expect(Math.abs(v3.x - v2.x) + Math.abs(v3.y - v2.y)).toBeGreaterThan(0.5);
  await expect(sw).toHaveAttribute('data-state', 'on');
  await expect(guard).toHaveAttribute('data-state', 'open');
});

test('a tap on the drag-only EMERGENCY GEAR EXTENSION lever, on its handle or its far track end, changes nothing', async ({
  page,
}, testInfo) => {
  const name = testInfo.project.name;
  test.skip(!isMouseProject(name) && name !== 'phone-chromium', 'Chromium gestures only');
  const touch = name === 'phone-chromium';
  await zoomIntoRegion(page, touch, 'under_panel_centre');
  const lever = control(page, 'lv.emerg_gear');
  await expect(lever).toHaveAttribute('data-state', 'normal');
  // The track runs 60 units along y: the handle rests at +30 (normal), the far end is at -30.
  const points = await page.evaluate(() => {
    const g = document.querySelector('[data-control-id="lv.emerg_gear"]');
    if (!(g instanceof SVGGraphicsElement)) return null;
    const m = g.getScreenCTM();
    if (m === null) return null;
    const at = (y: number) => {
      const p = new DOMPoint(0, y).matrixTransform(m);
      return { x: Math.round(p.x), y: Math.round(p.y) };
    };
    return { handle: at(30), far: at(-30), middle: at(0) };
  });
  if (points === null) throw new Error('no lever geometry');
  for (const p of [points.handle, points.far, points.middle]) {
    if (touch) {
      await page.touchscreen.tap(p.x, p.y);
    } else {
      await page.mouse.click(p.x, p.y);
    }
    await expect(lever).toHaveAttribute('data-state', 'normal');
  }
  expect(await eventCount(page)).toBeLessThanOrEqual(0);
});

test.describe('@hooks the event log', () => {
  for (const c of CASES) {
    test(`${c.name}: nothing is recorded by a drag, one event by a tap`, async ({
      page,
    }, testInfo) => {
      const name = testInfo.project.name;
      test.skip(!isMouseProject(name) && name !== 'phone-chromium', 'Chromium gestures only');
      const touch = name === 'phone-chromium';
      expect(await eventCount(page)).toBe(0);

      // A drag at the full view, then a drag while zoomed, then a boundary-plus-one move.
      const slop = touch ? TOUCH_SLOP_PX : MOUSE_SLOP_PX;
      const drag = touch ? touchDrag : mouseDrag;
      await drag(page, await hitCentre(page, c.selector), { x: slop + 25, y: slop + 25 });
      expect(await eventCount(page)).toBe(0);
      await zoomIntoRegion(page, touch, c.region);
      await drag(page, await hitCentre(page, c.selector), await panVector(page, slop + 25));
      expect(await eventCount(page)).toBe(0);

      const p = await hitCentre(page, c.selector);
      if (touch) {
        const send = await touchSender(page);
        await send('touchStart', [p]);
        expect(await eventCount(page)).toBe(0);
        await send('touchEnd', []);
      } else {
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        expect(await eventCount(page)).toBe(0);
        await page.mouse.up();
      }
      await expect.poll(() => eventCount(page)).toBe(1);
      const events = await page.evaluate(
        () => (globalThis as unknown as HookHost).__panel?.events() ?? [],
      );
      expect(events.map((e) => [e.id, e.value])).toEqual([[c.id, c.after]]);
    });
  }
});

// Momentary controls commit after MOMENTARY_HOLD_MS held still (R3-Z2 item 2, plan 39). Table M1.
// The hold time comes from src/ui/panel/press-arbiter.ts, never typed here.

interface MomentaryCase {
  readonly name: string;
  readonly id: string;
  readonly region: string;
  readonly rest: string;
  /** Where on the hit (fraction of its width) a press lands and the state it commits. */
  readonly presses: readonly { readonly fraction: number; readonly state: string }[];
}

const MOMENTARY: readonly MomentaryCase[] = [
  {
    name: 'ENGINE START',
    id: 'btn.engine_start',
    region: 'switch_bank',
    rest: 'released',
    presses: [{ fraction: 0.5, state: 'pressed' }],
  },
  {
    name: 'FADEC TEST',
    id: 'btn.fadec_test',
    region: 'engine_controls',
    rest: 'released',
    presses: [{ fraction: 0.5, state: 'pressed' }],
  },
  {
    name: 'STALL TEST / GEAR TEST',
    id: 'btn.stall_gear_test',
    region: 'landing_gear',
    rest: 'neutral',
    presses: [
      { fraction: 0.25, state: 'stall_test' },
      { fraction: 0.75, state: 'gear_test' },
    ],
  },
  {
    name: 'DE-ICE MAX',
    id: 'btn.deice_max',
    region: 'deice',
    rest: 'released',
    presses: [{ fraction: 0.5, state: 'pressed' }],
  },
  {
    name: 'WIND SHIELD',
    id: 'btn.deice_windshield',
    region: 'deice_switches',
    rest: 'released',
    presses: [{ fraction: 0.5, state: 'pressed' }],
  },
  {
    name: 'LEVEL',
    id: 'btn.level',
    region: 'level',
    rest: 'released',
    presses: [{ fraction: 0.5, state: 'pressed' }],
  },
];

/** A point at a fraction of the width and the middle of the height of a hit element, in whole px. */
async function pointAt(page: Page, selector: string, fraction: number): Promise<Point> {
  const box = await page.locator(selector).boundingBox();
  if (box === null) throw new Error(`no box for ${selector}`);
  return { x: Math.round(box.x + box.width * fraction), y: Math.round(box.y + box.height / 2) };
}

/** Both view numbers equal, to compare a view before and after a gesture. */
async function viewString(page: Page): Promise<string | null> {
  return page.getByTestId('panel').getAttribute('viewBox');
}

/** Waits long enough for a pending press to have committed if it was going to. */
async function pastHold(page: Page): Promise<void> {
  await page.waitForTimeout(MOMENTARY_HOLD_MS + 150);
}

function gestureKind(name: string): 'mouse' | 'touch' | null {
  return isMouseProject(name) ? 'mouse' : name === 'phone-chromium' ? 'touch' : null;
}

for (const c of MOMENTARY) {
  const selector = `[data-hit="${c.id}"]`;

  test.describe(`momentary ${c.name}`, () => {
    test('mouse: held past the hold time it is pressed, the lift returns it to rest', async ({
      page,
    }, testInfo) => {
      test.skip(!isMouseProject(testInfo.project.name), 'mouse path');
      const group = control(page, c.id);
      await expect(group).toHaveAttribute('data-state', c.rest);
      for (const press of c.presses) {
        const at = await pointAt(page, selector, press.fraction);
        await page.mouse.move(at.x, at.y);
        const t0 = Date.now();
        await page.mouse.down();
        const early = await group.getAttribute('data-state');
        // The commit is not instant: a read right after the press still sees the rest state (only
        // asserted when the read really was early, so a slow runner cannot make it flaky).
        if (Date.now() - t0 < MOMENTARY_HOLD_MS / 2) expect(early).toBe(c.rest);
        await expect(group).toHaveAttribute('data-state', press.state);
        await page.mouse.up();
        await expect(group).toHaveAttribute('data-state', c.rest);
      }
    });

    test('touch: held past the hold time it is pressed, the lift returns it to rest', async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
      const group = control(page, c.id);
      const send = await touchSender(page);
      for (const press of c.presses) {
        await send('touchStart', [await pointAt(page, selector, press.fraction)]);
        await expect(group).toHaveAttribute('data-state', press.state);
        await send('touchEnd', []);
        await expect(group).toHaveAttribute('data-state', c.rest);
      }
    });

    test('a press that moves beyond the slop before the hold pans and never presses', async ({
      page,
    }, testInfo) => {
      const kind = gestureKind(testInfo.project.name);
      test.skip(kind === null, 'Chromium gestures only');
      const touch = kind === 'touch';
      await zoomIntoRegion(page, touch, c.region);
      const group = control(page, c.id);
      const before = await viewNumbers(page);
      const by = await panVector(page, (touch ? TOUCH_SLOP_PX : MOUSE_SLOP_PX) + 25);
      const from = await pointAt(page, selector, c.presses[0]?.fraction ?? 0.5);
      if (touch) {
        const send = await touchSender(page);
        await send('touchStart', [from]);
        await send('touchMove', [{ x: from.x + by.x, y: from.y + by.y }]);
        await pastHold(page);
        await expect(group).toHaveAttribute('data-state', c.rest);
        await send('touchEnd', []);
      } else {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x + by.x, from.y + by.y);
        await pastHold(page);
        await expect(group).toHaveAttribute('data-state', c.rest);
        await page.mouse.up();
      }
      await expect(group).toHaveAttribute('data-state', c.rest);
      const after = await viewNumbers(page);
      expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(0.5);
      expect(after.w).toBeCloseTo(before.w);
    });

    test('touch: a second finger before the hold pinches and the button never presses', async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
      const group = control(page, c.id);
      const p = await pointAt(page, selector, c.presses[0]?.fraction ?? 0.5);
      const spare = await backgroundPoint(page, c.region);
      const send = await touchSender(page);
      await send('touchStart', [p]);
      await send('touchStart', [p, spare]);
      const away = (f: number): Point[] => [
        { x: p.x - (spare.x - p.x) * f * 0.5, y: p.y - (spare.y - p.y) * f * 0.5 },
        { x: spare.x + (spare.x - p.x) * f * 0.5, y: spare.y + (spare.y - p.y) * f * 0.5 },
      ];
      for (let i = 1; i <= 8; i++) await send('touchMove', away(i / 2));
      await pastHold(page);
      await expect(group).toHaveAttribute('data-state', c.rest);
      await send('touchEnd', []);
      await expect(group).toHaveAttribute('data-state', c.rest);
      expect((await viewNumbers(page)).w).toBeLessThan(PANEL_VIEWBOX.w);
    });

    test('after the commit a far move does not pan and the lift still releases it', async ({
      page,
    }, testInfo) => {
      const kind = gestureKind(testInfo.project.name);
      test.skip(kind === null, 'Chromium gestures only');
      const touch = kind === 'touch';
      await zoomIntoRegion(page, touch, c.region);
      const group = control(page, c.id);
      const press = c.presses[0];
      if (press === undefined) throw new Error('no press');
      const view = await viewString(page);
      const by = await panVector(page, (touch ? TOUCH_SLOP_PX : MOUSE_SLOP_PX) + 60);
      const from = await pointAt(page, selector, press.fraction);
      if (touch) {
        const send = await touchSender(page);
        await send('touchStart', [from]);
        await expect(group).toHaveAttribute('data-state', press.state);
        for (let i = 1; i <= 6; i++) {
          await send('touchMove', [{ x: from.x + (by.x * i) / 6, y: from.y + (by.y * i) / 6 }]);
        }
        await expect(group).toHaveAttribute('data-state', press.state);
        await send('touchEnd', []);
      } else {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await expect(group).toHaveAttribute('data-state', press.state);
        await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 6 });
        await expect(group).toHaveAttribute('data-state', press.state);
        await page.mouse.up();
      }
      await expect(group).toHaveAttribute('data-state', c.rest);
      expect(await viewString(page)).toBe(view);
    });

    test('touch: after the commit a second finger on the background is ignored', async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
      const group = control(page, c.id);
      const press = c.presses[0];
      if (press === undefined) throw new Error('no press');
      const p = await pointAt(page, selector, press.fraction);
      const spare = await backgroundPoint(page, c.region);
      const send = await touchSender(page);
      await send('touchStart', [p]);
      await expect(group).toHaveAttribute('data-state', press.state);
      await send('touchStart', [p, spare]);
      const away = (f: number): Point[] => [
        { x: p.x, y: p.y },
        { x: spare.x + (spare.x - p.x) * f * 0.5, y: spare.y + (spare.y - p.y) * f * 0.5 },
      ];
      for (let i = 1; i <= 8; i++) await send('touchMove', away(i / 2));
      await expect(group).toHaveAttribute('data-state', press.state);
      expect(await viewString(page)).toBe(FULL_VIEWBOX);
      await send('touchEnd', []);
      await expect(group).toHaveAttribute('data-state', c.rest);
      expect(await viewString(page)).toBe(FULL_VIEWBOX);
    });
  });
}

test.describe('@hooks momentary controls and the event log', () => {
  const events = (page: Page) =>
    page.evaluate(() => (globalThis as unknown as HookHost).__panel?.events() ?? []);

  for (const c of MOMENTARY) {
    const selector = `[data-hit="${c.id}"]`;

    test(`${c.name}: a quick tap records pressed then released`, async ({ page }, testInfo) => {
      const kind = gestureKind(testInfo.project.name);
      test.skip(kind === null && testInfo.project.name !== 'tablet-chromium', 'Chromium only');
      const press = c.presses[0];
      if (press === undefined) throw new Error('no press');
      const at = await pointAt(page, selector, press.fraction);
      if (kind === 'mouse') {
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.up();
      } else if (kind === 'touch') {
        const send = await touchSender(page);
        await send('touchStart', [at]);
        await send('touchEnd', []);
      } else {
        await page.touchscreen.tap(at.x, at.y);
      }
      await expect(control(page, c.id)).toHaveAttribute('data-state', c.rest);
      expect((await events(page)).map((e) => [e.id, e.value])).toEqual([
        [c.id, press.state],
        [c.id, c.rest],
      ]);
    });

    test(`${c.name}: a press moved beyond the slop or pinched records nothing`, async ({
      page,
    }, testInfo) => {
      const kind = gestureKind(testInfo.project.name);
      test.skip(kind === null, 'Chromium gestures only');
      const touch = kind === 'touch';
      expect(await eventCount(page)).toBe(0);
      const from = await pointAt(page, selector, c.presses[0]?.fraction ?? 0.5);
      const d = (touch ? TOUCH_SLOP_PX : MOUSE_SLOP_PX) + 25;
      if (touch) {
        const send = await touchSender(page);
        await send('touchStart', [from]);
        await send('touchMove', [{ x: from.x + d, y: from.y + d }]);
        await pastHold(page);
        await send('touchEnd', []);
        // A pinch: a second finger before the hold.
        const spare = await backgroundPoint(page, c.region);
        const q = await pointAt(page, selector, c.presses[0]?.fraction ?? 0.5);
        await send('touchStart', [q]);
        await send('touchStart', [q, spare]);
        await pastHold(page);
        await send('touchEnd', []);
      } else {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x + d, from.y + d);
        await pastHold(page);
        await page.mouse.up();
      }
      expect(await eventCount(page)).toBe(0);
    });
  }

  test('two quick presses of ENGINE START record pressed, released, pressed, released and leave the view', async ({
    page,
  }, testInfo) => {
    const kind = gestureKind(testInfo.project.name);
    test.skip(kind === null && testInfo.project.name !== 'tablet-chromium', 'Chromium only');
    const selector = '[data-hit="btn.engine_start"]';
    const at = await pointAt(page, selector, 0.5);
    for (let i = 0; i < 2; i++) {
      if (kind === 'mouse') {
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.up();
      } else {
        await page.touchscreen.tap(at.x, at.y);
      }
    }
    await expect.poll(() => eventCount(page)).toBe(4);
    expect((await events(page)).map((e) => [e.id, e.value])).toEqual([
      ['btn.engine_start', 'pressed'],
      ['btn.engine_start', 'released'],
      ['btn.engine_start', 'pressed'],
      ['btn.engine_start', 'released'],
    ]);
    expect(await viewString(page)).toBe(FULL_VIEWBOX);
  });
});

// Drag controls keep their gesture (R3-Z2 item 3, plan 39): a lever handle or a knob body is an
// own target. Before it has travelled DRAG_START_PX a second finger takes the press away and
// pinches; from then on the control owns its pointer and other pointers are ignored.

const KNOB = 'sw.instr_light';
const LEVER = 'lv.power';

/** The id of the region a control sits in, read from the page. */
async function regionOfControl(page: Page, id: string): Promise<string> {
  const region = await page.evaluate((controlId) => {
    const group = document.querySelector(`[data-control-id="${controlId}"]`);
    return group?.closest('[data-region-id]')?.getAttribute('data-region-id') ?? null;
  }, id);
  if (region === null) throw new Error(`no region for ${id}`);
  return region;
}

/** A point `fraction` of the knob hit width to the right of the hit centre (3 o'clock direction). */
async function knobTarget(page: Page, fraction: number): Promise<{ from: Point; to: Point }> {
  const box = await page.locator(`[data-hit="${KNOB}"]`).boundingBox();
  if (box === null) throw new Error('no knob box');
  const from = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  return { from, to: { x: Math.round(from.x + box.width * fraction), y: from.y } };
}

/** The transform of the lever handle group, to see that no stale drag position remains. */
async function handleTransform(page: Page, id: string): Promise<string | null> {
  return page.locator(`g[data-control-id="${id}"] > g[transform]`).getAttribute('transform');
}

test.describe('drag controls', () => {
  test('mouse: a drag from a lever handle moves the lever and does not pan the zoomed view', async ({
    page,
  }, testInfo) => {
    test.skip(!isMouseProject(testInfo.project.name), 'mouse path');
    await zoomIntoRegion(page, false, 'pedestal');
    const view = await viewString(page);
    const handle = await page.locator(`[data-hit="${LEVER}"]`).boundingBox();
    const low = await page.locator(`[data-detent="${LEVER}:p0"]`).boundingBox();
    const high = await page.locator(`[data-detent="${LEVER}:p100"]`).boundingBox();
    if (handle === null || low === null || high === null) throw new Error('no lever boxes');
    const centreOf = (b: { x: number; y: number; width: number; height: number }): Point => ({
      x: b.x + b.width / 2,
      y: b.y + b.height / 2,
    });
    const from = centreOf(handle);
    const a = centreOf(low);
    const b = centreOf(high);
    await expect(control(page, LEVER)).toHaveAttribute('data-state', 'p70');
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(a.x + (b.x - a.x) * 0.9, a.y + (b.y - a.y) * 0.9, { steps: 8 });
    await page.mouse.up();
    await expect(control(page, LEVER)).toHaveAttribute('data-state', 'p90');
    expect(await viewString(page)).toBe(view);
  });

  test('mouse: a drag from a knob body turns the knob and does not pan the zoomed view, a tap still steps it on release', async ({
    page,
  }, testInfo) => {
    test.skip(!isMouseProject(testInfo.project.name), 'mouse path');
    await zoomIntoRegion(page, false, await regionOfControl(page, KNOB));
    const view = await viewString(page);
    const knob = control(page, KNOB);
    await expect(knob).toHaveAttribute('data-state', 'off');
    const { from, to } = await knobTarget(page, 0.43);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await expect(knob).toHaveAttribute('data-state', 'off');
    await page.mouse.up();
    await expect(knob).toHaveAttribute('data-state', 's75');
    expect(await viewString(page)).toBe(view);

    // A tap on the right half steps one stop clockwise on the lift, not on the press.
    const tapAt = await knobTarget(page, 0.25);
    await page.mouse.move(tapAt.to.x, tapAt.to.y);
    await page.mouse.down();
    await expect(knob).toHaveAttribute('data-state', 's75');
    await page.mouse.up();
    await expect(knob).not.toHaveAttribute('data-state', 's75');
  });

  test('touch: a finger on the throttle handle that has not moved, then a second finger on the background, pinches and the throttle keeps its detent', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
    const lever = control(page, LEVER);
    await expect(lever).toHaveAttribute('data-state', 'p70');
    const rest = await handleTransform(page, LEVER);
    const p = await hitCentre(page, `[data-hit="${LEVER}"]`);
    const spare = await backgroundPoint(page, 'pedestal');
    const send = await touchSender(page);
    await send('touchStart', [p]);
    await send('touchStart', [p, spare]);
    const away = (f: number): Point[] => [
      { x: p.x - (spare.x - p.x) * f * 0.5, y: p.y - (spare.y - p.y) * f * 0.5 },
      { x: spare.x + (spare.x - p.x) * f * 0.5, y: spare.y + (spare.y - p.y) * f * 0.5 },
    ];
    for (let i = 1; i <= 8; i++) await send('touchMove', away(i / 2));
    await send('touchEnd', []);
    expect((await viewNumbers(page)).w).toBeLessThan(PANEL_VIEWBOX.w);
    await expect(lever).toHaveAttribute('data-state', 'p70');
    expect(await handleTransform(page, LEVER)).toBe(rest);
  });

  test('touch: a knob body dragged past the drag threshold owns its finger, a second finger is ignored and the knob snaps on the lift', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
    const knob = control(page, KNOB);
    await expect(knob).toHaveAttribute('data-state', 'off');
    const { from, to } = await knobTarget(page, 0.43);
    expect(Math.hypot(to.x - from.x, to.y - from.y)).toBeGreaterThan(DRAG_START_PX);
    const spare = await backgroundPoint(page, await regionOfControl(page, KNOB));
    const send = await touchSender(page);
    await send('touchStart', [from]);
    for (let i = 1; i <= 6; i++) {
      await send('touchMove', [
        { x: from.x + ((to.x - from.x) * i) / 6, y: from.y + ((to.y - from.y) * i) / 6 },
      ]);
    }
    await send('touchStart', [to, spare]);
    for (let i = 1; i <= 8; i++) await send('touchMove', [to, { x: spare.x + i * 8, y: spare.y }]);
    expect(await viewString(page)).toBe(FULL_VIEWBOX);
    await send('touchEnd', []);
    await expect(knob).toHaveAttribute('data-state', 's75');
    expect(await viewString(page)).toBe(FULL_VIEWBOX);
  });
});

test('the classification gate: every hit and detent element has the data-press class of its control kind', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', 'portrait is not a panel layout');
  const found = await page.evaluate(() => {
    const rows: { key: string; kind: string; skin: string; isDetent: boolean; press: string }[] =
      [];
    for (const el of Array.from(document.querySelectorAll('[data-hit], [data-detent]'))) {
      const group = el.closest('[data-control-id]');
      rows.push({
        key: el.getAttribute('data-detent') ?? el.getAttribute('data-hit') ?? '',
        kind: group?.getAttribute('data-kind') ?? 'none',
        skin: group?.getAttribute('data-skin') ?? '',
        isDetent: el.hasAttribute('data-detent'),
        press: el.getAttribute('data-press') ?? 'missing',
      });
    }
    return rows;
  });
  expect(found.length).toBeGreaterThan(50);

  // Table M2.
  const expected = (r: (typeof found)[number]): string => {
    switch (r.kind) {
      case 'momentary-button':
        return 'momentary';
      case 'rotary':
        return r.isDetent ? 'latch' : 'own';
      case 'detent-lever':
        return r.isDetent || r.skin === 'parking-flap' ? 'latch' : 'own';
      case 'toggle':
      case 'guarded-toggle':
      case 'guard':
      case 'circuit-breaker':
        return 'latch';
      default:
        return `unknown kind ${r.kind}`;
    }
  };
  const wrong = found.filter((r) => r.press !== expected(r)).map((r) => `${r.key}: ${r.press}`);
  expect(wrong).toEqual([]);

  const totals = new Map<string, number>();
  for (const r of found) totals.set(r.press, (totals.get(r.press) ?? 0) + 1);
  for (const cls of ['momentary', 'own', 'latch']) {
    expect(totals.get(cls) ?? 0, cls).toBeGreaterThan(0);
  }
});

// Double click or double tap on a latching control (R3-Z3, PNL-15, Table D1): the first tap
// actuates at once, the recognised pair retracts it and zooms, so the control keeps its state.
// Two taps on two different hit elements, a momentary or drag control, a slow second tap and two
// taps that are too far apart are not a pair. Mouse projects use dblclick, touch projects two
// taps in a row; state and view are read from the page, the log only in the @hooks cases. The
// limits come from src/ui/panel/tap-intent.ts, never typed here.

const LATCHING_CASES = CASES.filter((c) => c.name !== 'guard cover');

async function startState(page: Page, id: string): Promise<string> {
  return (await control(page, id).getAttribute('data-state')) ?? '';
}

test.describe('a double click or double tap on a latching control zooms and leaves it unchanged', () => {
  for (const c of LATCHING_CASES) {
    test(`${c.name}: zooms in, then out, and the state never changes`, async ({
      page,
      hasTouch,
    }, testInfo) => {
      test.skip(testInfo.project.name === 'phone-portrait', 'portrait is not a panel layout');
      const group = control(page, c.id);
      await expect(group).toHaveAttribute('data-state', c.before);

      await doubleActivateAt(page, await hitCentre(page, c.selector), hasTouch);
      await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
      await expect(group).toHaveAttribute('data-state', c.before);

      // Zoomed: the same pair zooms fully out and the control is still unchanged.
      await afterPairWindow(page);
      await doubleActivateAt(page, await hitCentre(page, c.selector), hasTouch);
      await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
      await expect(group).toHaveAttribute('data-state', c.before);
    });
  }

  test('the closed guard cover of the de-ice ALTERNATE switch: zooms, the guard stays closed and the switch off', async ({
    page,
    hasTouch,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'phone-portrait', 'portrait is not a panel layout');
    const guard = control(page, 'sw.deice_alternate.guard');
    const sw = control(page, 'sw.deice_alternate');
    await doubleActivateAt(
      page,
      await hitCentre(page, '[data-hit="sw.deice_alternate.guard"]'),
      hasTouch,
    );
    await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
    await expect(guard).toHaveAttribute('data-state', 'closed');
    await expect(sw).toHaveAttribute('data-state', 'off');
  });

  test('three quick taps on a toggle: the pair zooms and leaves it unchanged, the third tap actuates', async ({
    page,
    hasTouch,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'phone-portrait', 'portrait is not a panel layout');
    const group = control(page, 'sw.engine_master');
    const before = await startState(page, 'sw.engine_master');
    const selector = '[data-hit="sw.engine_master"]';
    await doubleActivateAt(page, await hitCentre(page, selector), hasTouch);
    await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
    await expect(group).toHaveAttribute('data-state', before);
    // The view changed: the third tap goes to the control where it is now.
    await activateAt(page, await hitCentre(page, selector), hasTouch);
    await expect(group).not.toHaveAttribute('data-state', before);
  });

  test('the background double click still zooms in and out', async ({
    page,
    hasTouch,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'phone-portrait', 'portrait is not a panel layout');
    const p = await backgroundPoint(page, 'switch_bank');
    await doubleActivateAt(page, p, hasTouch);
    await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
    await afterPairWindow(page);
    await doubleActivateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
    await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  });
});

/** Distance (client px) between the centres of two hit elements. */
async function centreDistance(page: Page, a: string, b: string): Promise<number> {
  const pa = await hitCentre(page, a);
  const pb = await hitCentre(page, b);
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

test.describe('@hooks double tap pairs that are not pairs', () => {
  const eventsOf = (page: Page) =>
    page.evaluate(() => (globalThis as unknown as HookHost).__panel?.events() ?? []);

  test('a double click or double tap on every latching control leaves the log unchanged, at the full view and zoomed', async ({
    page,
    hasTouch,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'phone-portrait', 'portrait is not a panel layout');
    expect(await eventCount(page)).toBe(0);
    for (const c of CASES) {
      await afterPairWindow(page);
      await doubleActivateAt(page, await hitCentre(page, c.selector), hasTouch);
      await expect(page.getByTestId('panel'), c.name).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
      expect(await eventCount(page), `${c.name} at the full view`).toBe(0);
      await afterPairWindow(page);
      await doubleActivateAt(page, await hitCentre(page, c.selector), hasTouch);
      await expect(page.getByTestId('panel'), c.name).toHaveAttribute('viewBox', FULL_VIEWBOX);
      expect(await eventCount(page), `${c.name} zoomed`).toBe(0);
    }
  });

  const CROSSING: readonly { name: string; a: string; b: string; id: string; last: string }[] = [
    {
      name: 'FAN spots f1 then f2',
      a: '[data-detent="sw.env_fan:f1"]',
      b: '[data-detent="sw.env_fan:f2"]',
      id: 'sw.env_fan',
      last: 'f2',
    },
    {
      name: 'flaps markers T/O then LDG',
      a: '[data-detent="lv.flaps:to"]',
      b: '[data-detent="lv.flaps:ldg"]',
      id: 'lv.flaps',
      last: 'ldg',
    },
  ];
  for (const x of CROSSING) {
    test(`two quick taps on two different hit elements (${x.name}) are two actuations and no zoom`, async ({
      page,
      hasTouch,
    }, testInfo) => {
      test.skip(testInfo.project.name === 'phone-portrait', 'portrait is not a panel layout');
      const d = await centreDistance(page, x.a, x.b);
      test.skip(
        d > DOUBLE_TAP_PX,
        `the two hit centres are ${d.toFixed(1)} px apart on this project`,
      );
      await activateAt(page, await hitCentre(page, x.a), hasTouch);
      await activateAt(page, await hitCentre(page, x.b), hasTouch);
      await expect(control(page, x.id)).toHaveAttribute('data-state', x.last);
      expect(await eventCount(page)).toBe(2);
      expect(await viewString(page)).toBe(FULL_VIEWBOX);
    });
  }

  test('ENGINE MASTER then ESS BUS within the distance limit are two actuations and no zoom', async ({
    page,
    hasTouch,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'phone-chromium',
      'the switches are close on the phone only',
    );
    const a = '[data-hit="sw.engine_master"]';
    const b = '[data-hit="sw.ess_bus"]';
    const d = await centreDistance(page, a, b);
    test.skip(
      d > DOUBLE_TAP_PX,
      `the two hit centres are ${d.toFixed(1)} px apart on this project`,
    );
    await activateAt(page, await hitCentre(page, a), hasTouch);
    await activateAt(page, await hitCentre(page, b), hasTouch);
    expect(await eventCount(page)).toBe(2);
    expect(await viewString(page)).toBe(FULL_VIEWBOX);
  });

  test('a second tap that lasts longer than the tap limit does not pair', async ({
    page,
  }, testInfo) => {
    const name = testInfo.project.name;
    test.skip(!isMouseProject(name) && name !== 'phone-chromium', 'Chromium gestures only');
    const p = await hitCentre(page, '[data-hit="sw.engine_master"]');
    if (name === 'phone-chromium') {
      const send = await touchSender(page);
      await send('touchStart', [p]);
      await send('touchEnd', []);
      await send('touchStart', [p]);
      await page.waitForTimeout(TAP_MAX_MS + 10);
      await send('touchEnd', []);
    } else {
      await page.mouse.click(p.x, p.y);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.waitForTimeout(TAP_MAX_MS + 10);
      await page.mouse.up();
    }
    await expect.poll(() => eventCount(page)).toBe(2);
    expect(await viewString(page)).toBe(FULL_VIEWBOX);
  });

  test('two quick taps on the far ends of the parking brake footprint are further apart than the limit and do not pair', async ({
    page,
  }, testInfo) => {
    test.skip(
      !isMouseProject(testInfo.project.name),
      'the footprint is long enough on desktop only',
    );
    const box = await page.locator('[data-hit="lv.parking_brake"]').boundingBox();
    if (box === null) throw new Error('no brake box');
    const long = box.width >= box.height;
    const reach = (long ? box.width : box.height) - 4;
    test.skip(
      reach <= DOUBLE_TAP_PX,
      `the footprint is ${reach.toFixed(1)} px long on this project`,
    );
    const at = (end: number): Point =>
      long
        ? { x: Math.round(box.x + 2 + end * reach), y: Math.round(box.y + box.height / 2) }
        : { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + 2 + end * reach) };
    await page.mouse.click(at(0).x, at(0).y);
    await page.mouse.click(at(1).x, at(1).y);
    await expect.poll(() => eventCount(page)).toBe(2);
    expect(await viewString(page)).toBe(FULL_VIEWBOX);
  });

  test('two quick presses of ENGINE START are two presses, two quick taps on a knob body step it twice, two taps on a lever handle record nothing, and none of them zoom', async ({
    page,
    hasTouch,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'phone-portrait', 'portrait is not a panel layout');
    // Momentary: pressed, released, pressed, released.
    await doubleActivateAt(
      page,
      await pointAt(page, '[data-hit="btn.engine_start"]', 0.5),
      hasTouch,
    );
    await expect.poll(() => eventCount(page)).toBe(4);
    expect((await eventsOf(page)).map((e) => e.value)).toEqual([
      'pressed',
      'released',
      'pressed',
      'released',
    ]);
    expect(await viewString(page)).toBe(FULL_VIEWBOX);

    // Knob body: a tap on the right half steps it, twice.
    await afterPairWindow(page);
    const before = await eventCount(page);
    await doubleActivateAt(page, await pointAt(page, `[data-hit="${KNOB}"]`, 0.75), hasTouch);
    await expect.poll(() => eventCount(page)).toBe(before + 2);
    expect(await viewString(page)).toBe(FULL_VIEWBOX);

    // Lever handle: a tap records nothing.
    await afterPairWindow(page);
    const beforeLever = await eventCount(page);
    await doubleActivateAt(page, await hitCentre(page, `[data-hit="${LEVER}"]`), hasTouch);
    await page.waitForTimeout(150);
    expect(await eventCount(page)).toBe(beforeLever);
    expect(await viewString(page)).toBe(FULL_VIEWBOX);
  });
});
