import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PANEL_VIEWBOX } from '../tests/layout-reference';
import { MOUSE_SLOP_PX, TOUCH_SLOP_PX } from '../src/ui/panel/tap-intent';
import { touchSender } from './support/touch';
import { FULL_VIEWBOX, backgroundPoint, zoomIntoRegion } from './support/zoom';
import type { Point } from './support/zoom';

// Latching controls act on release (R3-Z2, PNL-11, PNL-15, PNL-06): a press is pending and shows
// the pressed ring, a lift within the slop is a tap and actuates once, a drag beyond the slop is a
// pan (when zoomed) and does not actuate, a second finger pinches. The slop numbers come from
// src/ui/panel/tap-intent.ts, never typed here. Every case reads data-state and the viewBox, so
// it runs in the live rehearsal; only the @hooks cases read the event log.

interface HookHost {
  __panel?: { events(): { id: string; value: string }[] };
}

/** Table T2: the case table, extended by plans 38 and 39. */
interface PressCase {
  readonly name: string;
  /** The data-hit value of the hit element, also the control id of the group that shows the state. */
  readonly hit: string;
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
    hit: 'sw.engine_master',
    region: 'switch_bank',
    before: 'on',
    after: 'off',
    ring: true,
  },
  {
    name: 'circuit breaker',
    hit: 'cb.pitot',
    region: 'cb_essential',
    before: 'in',
    after: 'out',
    ring: true,
  },
  {
    name: 'guard cover',
    hit: 'sw.deice_alternate.guard',
    region: 'deice',
    before: 'closed',
    after: 'open',
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

/** The centre of a hit element in whole client px, so slop distances are exact. */
async function hitCentre(page: Page, hit: string): Promise<Point> {
  const box = await page.locator(`[data-hit="${hit}"]`).boundingBox();
  if (box === null) throw new Error(`no box for ${hit}`);
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
      const group = control(page, c.hit);
      await expect(group).toHaveAttribute('data-state', c.before);
      const p = await hitCentre(page, c.hit);
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
      const group = control(page, c.hit);
      const p = await hitCentre(page, c.hit);
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
      const group = control(page, c.hit);
      const before = await viewNumbers(page);
      const by = await panVector(page, MOUSE_SLOP_PX + 25);
      await mouseDrag(page, await hitCentre(page, c.hit), by);
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
      const group = control(page, c.hit);
      const before = await viewNumbers(page);
      const by = await panVector(page, TOUCH_SLOP_PX + 25);
      await touchDrag(page, await hitCentre(page, c.hit), by);
      const after = await viewNumbers(page);
      expect(Math.abs(after.x - before.x) + Math.abs(after.y - before.y)).toBeGreaterThan(0.5);
      expect(after.w).toBeCloseTo(before.w);
      await expect(group).toHaveAttribute('data-state', c.before);
      await expect(group).not.toHaveAttribute('data-pressed', 'true');
    });

    test('mouse: a move of exactly the slop is a tap, one pixel more is a pan', async ({
      page,
    }, testInfo) => {
      test.skip(!isMouseProject(testInfo.project.name), 'mouse path');
      await zoomIntoRegion(page, false, c.region);
      const group = control(page, c.hit);
      const start = await viewNumbers(page);
      const p = await hitCentre(page, c.hit);

      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + MOUSE_SLOP_PX, p.y);
      await page.mouse.up();
      await expect(group).toHaveAttribute('data-state', c.after);
      const tapped = await viewNumbers(page);
      expect([tapped.x, tapped.y, tapped.w]).toEqual([start.x, start.y, start.w]);

      // The same press, one pixel beyond the slop, discards: the state stays where the tap left it.
      const q = await hitCentre(page, c.hit);
      await page.mouse.move(q.x, q.y);
      await page.mouse.down();
      await page.mouse.move(q.x + MOUSE_SLOP_PX + 1, q.y);
      await page.mouse.up();
      await expect(group).toHaveAttribute('data-state', c.after);
      const panned = await viewNumbers(page);
      expect(Math.abs(panned.x - tapped.x) + Math.abs(panned.y - tapped.y)).toBeGreaterThan(0.01);
    });

    test('touch: a move of exactly the slop is a tap, one pixel more is a pan', async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
      await zoomIntoRegion(page, true, c.region);
      const group = control(page, c.hit);
      const start = await viewNumbers(page);
      const send = await touchSender(page);
      const p = await hitCentre(page, c.hit);

      await send('touchStart', [p]);
      await send('touchMove', [{ x: p.x + TOUCH_SLOP_PX, y: p.y }]);
      await send('touchEnd', []);
      await expect(group).toHaveAttribute('data-state', c.after);
      const tapped = await viewNumbers(page);
      expect([tapped.x, tapped.y, tapped.w]).toEqual([start.x, start.y, start.w]);

      const q = await hitCentre(page, c.hit);
      await send('touchStart', [q]);
      await send('touchMove', [{ x: q.x + TOUCH_SLOP_PX + 1, y: q.y }]);
      await send('touchEnd', []);
      await expect(group).toHaveAttribute('data-state', c.after);
      const panned = await viewNumbers(page);
      expect(Math.abs(panned.x - tapped.x) + Math.abs(panned.y - tapped.y)).toBeGreaterThan(0.01);
    });

    test('at the full view a drag from the hit changes neither state nor view', async ({
      page,
    }, testInfo) => {
      const name = testInfo.project.name;
      test.skip(!isMouseProject(name) && name !== 'phone-chromium', 'Chromium gestures only');
      const group = control(page, c.hit);
      const p = await hitCentre(page, c.hit);
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
      const group = control(page, c.hit);
      const p = await hitCentre(page, c.hit);
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
  const a = await hitCentre(page, idA);
  const b = await hitCentre(page, idB);
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
    const p = await hitCentre(page, hit);
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
    await hitCentre(page, 'sw.deice_alternate.guard'),
    await panVector(page, slop + 25),
  );
  const v1 = await viewNumbers(page);
  expect(Math.abs(v1.x - v0.x) + Math.abs(v1.y - v0.y)).toBeGreaterThan(0.5);
  await expect(guard).toHaveAttribute('data-state', 'closed');

  await tapOn('sw.deice_alternate.guard', guard, 'closed', 'open');
  await expect(sw).toHaveAttribute('data-state', 'off');
  await tapOn('sw.deice_alternate', sw, 'off', 'on');

  // A drag from the switch pans and does not flip it.
  const v2 = await viewNumbers(page);
  await drag(page, await hitCentre(page, 'sw.deice_alternate'), await panVector(page, slop + 25));
  const v3 = await viewNumbers(page);
  expect(Math.abs(v3.x - v2.x) + Math.abs(v3.y - v2.y)).toBeGreaterThan(0.5);
  await expect(sw).toHaveAttribute('data-state', 'on');
  await expect(guard).toHaveAttribute('data-state', 'open');
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
      await drag(page, await hitCentre(page, c.hit), { x: slop + 25, y: slop + 25 });
      expect(await eventCount(page)).toBe(0);
      await zoomIntoRegion(page, touch, c.region);
      await drag(page, await hitCentre(page, c.hit), await panVector(page, slop + 25));
      expect(await eventCount(page)).toBe(0);

      const p = await hitCentre(page, c.hit);
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
      expect(events.map((e) => [e.id, e.value])).toEqual([[c.hit, c.after]]);
    });
  }
});
