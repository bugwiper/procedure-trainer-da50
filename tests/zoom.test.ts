import { describe, expect, it } from 'vitest';
import { DA50RG, VIEWBOX, VIEW_PROFILES } from '../src/aircraft/da50rg/panel';
import type { ControlDef, Rect } from '../src/engine/registry';
import {
  SUPPRESS_MS,
  SUPPRESS_PX,
  TAP_MAX_MS,
  TAP_SLOP_PX,
  isBackgroundTap,
  tapIntent,
} from '../src/ui/panel/tap-intent';
import {
  MIN_VIEW_WIDTH,
  ZOOM_PAD,
  fitScale,
  panRect,
  pinchRect,
  screenToView,
  targetSide,
  zoomRect,
} from '../src/ui/panel/viewport';

// View geometry for region zoom (PNL-09, D-20, D-21). Pure functions over the registry;
// the zoomed tap-size guarantee is checked for every region and device profile.

const FULL: Rect = { x: 0, y: 0, w: VIEWBOX.w, h: VIEWBOX.h };
const MIN_TAP_PX = 44;

function inside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x - 1e-9 &&
    inner.y >= outer.y - 1e-9 &&
    inner.x + inner.w <= outer.x + outer.w + 1e-9 &&
    inner.y + inner.h <= outer.y + outer.h + 1e-9
  );
}

function regionControls(regionId: string): ControlDef[] {
  const region = DA50RG.regions.find((r) => r.id === regionId);
  return (region?.controlIds ?? []).flatMap((id) => DA50RG.get(id) ?? []);
}

describe('fitScale', () => {
  it('returns the smaller of the two axis ratios', () => {
    expect(fitScale({ w: 100, h: 100 }, { w: 400, h: 200 })).toBe(2);
    expect(fitScale({ w: 100, h: 100 }, { w: 200, h: 400 })).toBe(2);
    expect(fitScale({ w: 200, h: 50 }, { w: 400, h: 400 })).toBe(2);
  });
});

describe('zoomRect', () => {
  it('pads the bounds by ZOOM_PAD', () => {
    const r = zoomRect({ x: 100, y: 200, w: 300, h: 150 }, VIEWBOX);
    expect(r).toEqual({
      x: 100 - ZOOM_PAD,
      y: 200 - ZOOM_PAD,
      w: 300 + 2 * ZOOM_PAD,
      h: 150 + 2 * ZOOM_PAD,
    });
  });

  it('never leaves the viewBox: an edge region is clamped, not shifted out', () => {
    const edge = zoomRect({ x: 0, y: 0, w: 100, h: 80 }, VIEWBOX);
    expect(edge).toEqual({ x: 0, y: 0, w: 100 + ZOOM_PAD, h: 80 + ZOOM_PAD });
    const far = zoomRect({ x: VIEWBOX.w - 50, y: VIEWBOX.h - 40, w: 50, h: 40 }, VIEWBOX);
    expect(far).toEqual({
      x: VIEWBOX.w - 50 - ZOOM_PAD,
      y: VIEWBOX.h - 40 - ZOOM_PAD,
      w: 50 + ZOOM_PAD,
      h: 40 + ZOOM_PAD,
    });
    for (const region of DA50RG.regions) {
      expect(inside(zoomRect(region.bounds, VIEWBOX), FULL), region.id).toBe(true);
    }
  });
});

describe('pinchRect', () => {
  const view: Rect = { x: 500, y: 300, w: 800, h: 400 };

  it('halves the width about the centre with factor 2', () => {
    const centre = { x: 900, y: 500 };
    const r = pinchRect(view, centre, 2, VIEWBOX);
    expect(r.w).toBeCloseTo(400);
    expect(r.h).toBeCloseTo(200);
    // The centre keeps its relative position inside the view.
    expect((centre.x - r.x) / r.w).toBeCloseTo((centre.x - view.x) / view.w);
    expect((centre.y - r.y) / r.h).toBeCloseTo((centre.y - view.y) / view.h);
  });

  it('never goes below MIN_VIEW_WIDTH', () => {
    const r = pinchRect(view, { x: 900, y: 500 }, 1000, VIEWBOX);
    expect(r.w).toBeCloseTo(MIN_VIEW_WIDTH);
  });

  it('never goes above the full viewBox and ends at the whole panel when pinching out', () => {
    expect(pinchRect(view, { x: 900, y: 500 }, 0.001, VIEWBOX)).toEqual(FULL);
    // A tall region reaches the full height first and still ends at the whole panel.
    const tall: Rect = { x: 947, y: 630, w: 231, h: 380 };
    expect(pinchRect(tall, { x: 1000, y: 800 }, 0.2, VIEWBOX)).toEqual(FULL);
  });

  it('stays inside the viewBox', () => {
    const corner: Rect = { x: 1700, y: 800, w: 300, h: 210 };
    const r = pinchRect(corner, { x: 2000, y: 1010 }, 0.8, VIEWBOX);
    expect(inside(r, FULL)).toBe(true);
    const r2 = pinchRect(view, { x: 0, y: 0 }, 3, VIEWBOX);
    expect(inside(r2, FULL)).toBe(true);
  });
});

describe('panRect', () => {
  const view: Rect = { x: 500, y: 300, w: 800, h: 400 };

  it('moves the rect', () => {
    expect(panRect(view, 25, -40, VIEWBOX)).toEqual({ x: 525, y: 260, w: 800, h: 400 });
  });

  it('clamps the rect inside the viewBox', () => {
    expect(panRect(view, -9999, -9999, VIEWBOX)).toEqual({ x: 0, y: 0, w: 800, h: 400 });
    expect(panRect(view, 9999, 9999, VIEWBOX)).toEqual({
      x: VIEWBOX.w - 800,
      y: VIEWBOX.h - 400,
      w: 800,
      h: 400,
    });
  });
});

describe('screenToView', () => {
  it('maps the centre of the screen to the centre of the view, with letterboxing', () => {
    const view: Rect = { x: 100, y: 50, w: 200, h: 100 };
    const p = screenToView(view, { w: 800, h: 800 }, 400, 400);
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(100);
    const corner = screenToView(view, { w: 800, h: 800 }, 0, 400 - 200);
    expect(corner.x).toBeCloseTo(100);
    expect(corner.y).toBeCloseTo(50);
  });
});

describe('targetSide', () => {
  it('uses the hit rect min side for toggles and buttons', () => {
    const toggle = DA50RG.controls.find((c) => c.kind === 'toggle');
    expect(toggle).toBeDefined();
    if (toggle === undefined) return;
    expect(targetSide(toggle)).toBe(Math.min(toggle.hit.w, toggle.hit.h));
  });

  it('includes the lifted-guard area for guarded toggles and guards', () => {
    const base = {
      label: 'X',
      region: 'deice',
      x: 50,
      y: 50,
      hit: { w: 60, h: 80 },
    } as const;
    const states = [
      { id: 'off', label: 'OFF' },
      { id: 'on', label: 'ON' },
    ] as const;
    const guarded: ControlDef = {
      ...base,
      id: 'sw.x',
      kind: 'guarded-toggle',
      states,
      default: 'off',
      guardOpenHit: { x: -30, y: -60, w: 60, h: 30 },
    };
    expect(targetSide(guarded)).toBe(30);
    const guard: ControlDef = {
      ...base,
      id: 'sw.x.guard',
      kind: 'guard',
      states,
      default: 'closed',
      guards: 'sw.x',
      openHit: { x: -30, y: -60, w: 20, h: 30 },
    };
    expect(targetSide(guard)).toBe(20);
    const button: ControlDef = {
      ...base,
      id: 'btn.x',
      kind: 'momentary-button',
      states,
      default: 'off',
    };
    expect(targetSide(button)).toBe(60);
  });

  it('follows the lever rule min(across, along - track length, smallest marker spacing)', () => {
    const lever: ControlDef = {
      id: 'lv.x',
      label: 'X',
      region: 'pedestal',
      x: 50,
      y: 100,
      hit: { w: 40, h: 140 },
      kind: 'detent-lever',
      detents: [
        { id: 'a', label: 'A', pos: 0 },
        { id: 'b', label: 'B', pos: 0.25 },
        { id: 'c', label: 'C', pos: 1 },
      ],
      default: 'a',
      track: { length: 100, axis: 'v' },
    };
    // across 40, along - length 40, smallest spacing 25
    expect(targetSide(lever)).toBe(25);
    expect(targetSide({ ...lever, markers: ['a', 'c'] })).toBe(40);
    // drag-only: no marker spacing
    expect(targetSide({ ...lever, dragOnly: true })).toBe(40);
    expect(
      targetSide({ ...lever, track: { length: 100, axis: 'h' }, hit: { w: 140, h: 30 } }),
    ).toBe(25);
  });

  it('matches the plan 03 rule for every control of DA50RG', () => {
    for (const def of DA50RG.controls) {
      expect(targetSide(def), def.id).toBeGreaterThan(0);
      expect(Number.isFinite(targetSide(def)), def.id).toBe(true);
    }
  });
});

describe('zoomed tap-size guarantee (D-21)', () => {
  const profiles = [
    ['phone', VIEW_PROFILES.phone],
    ['tablet', VIEW_PROFILES.tablet],
    ['desktop', VIEW_PROFILES.desktop],
  ] as const;

  for (const [name, screen] of profiles) {
    it(`every region with controls reaches ${MIN_TAP_PX} px when zoomed on the ${name} profile`, () => {
      let checked = 0;
      for (const region of DA50RG.regions) {
        const defs = regionControls(region.id);
        if (defs.length === 0) continue;
        checked += 1;
        const scale = fitScale(zoomRect(region.bounds, VIEWBOX), screen);
        const smallest = Math.min(...defs.map(targetSide));
        expect(smallest * scale, `${region.id} on ${name}`).toBeGreaterThanOrEqual(MIN_TAP_PX);
      }
      expect(checked).toBeGreaterThan(0);
    });
  }

  it('portrait via pinch: a MIN_VIEW_WIDTH-wide view brings every control to 44 px', () => {
    const screen = { w: 393, h: 631 };
    const view = { w: MIN_VIEW_WIDTH, h: (MIN_VIEW_WIDTH * screen.h) / screen.w };
    const smallest = Math.min(...DA50RG.controls.map(targetSide));
    expect(smallest * fitScale(view, screen)).toBeGreaterThanOrEqual(MIN_TAP_PX);
  });
});

describe('isBackgroundTap (D-12)', () => {
  const tap = { travelPx: 0, durationMs: 100, maxPointers: 1, startedOnTarget: false };

  it('accepts a short, still, single-pointer gesture on the background', () => {
    expect(isBackgroundTap(tap)).toBe(true);
    expect(isBackgroundTap({ ...tap, travelPx: TAP_SLOP_PX, durationMs: TAP_MAX_MS })).toBe(true);
    expect(isBackgroundTap({ ...tap, durationMs: 0 })).toBe(true);
  });

  it('rejects a drag, a slow press, a second pointer and a start on a target', () => {
    expect(isBackgroundTap({ ...tap, travelPx: TAP_SLOP_PX + 1 })).toBe(false);
    expect(isBackgroundTap({ ...tap, durationMs: TAP_MAX_MS + 1 })).toBe(false);
    expect(isBackgroundTap({ ...tap, maxPointers: 2 })).toBe(false);
    expect(isBackgroundTap({ ...tap, startedOnTarget: true })).toBe(false);
  });
});

describe('tapIntent (D-12)', () => {
  const at = { x: 500, y: 400, at: 10_000 };

  it('zooms fully out at once while zoomed, and in from the full view', () => {
    expect(tapIntent({ zoomed: true, lastChange: null }, at)).toBe('zoom-out');
    expect(tapIntent({ zoomed: false, lastChange: null }, at)).toBe('zoom-in');
  });

  it('ignores a tap just after a tap-driven change near the same place', () => {
    const last = { x: at.x + 20, y: at.y, at: at.at - 349 };
    expect(tapIntent({ zoomed: true, lastChange: last }, at)).toBe('none');
    expect(tapIntent({ zoomed: false, lastChange: last }, at)).toBe('none');
  });

  it('acts again once the window or the distance is exceeded', () => {
    const late = { x: at.x, y: at.y, at: at.at - (SUPPRESS_MS + 1) };
    expect(tapIntent({ zoomed: true, lastChange: late }, at)).toBe('zoom-out');
    const far = { x: at.x + SUPPRESS_PX + 1, y: at.y, at: at.at - 100 };
    expect(tapIntent({ zoomed: true, lastChange: far }, at)).toBe('zoom-out');
    expect(tapIntent({ zoomed: false, lastChange: far }, at)).toBe('zoom-in');
  });

  it('a double tap from the full view stays zoomed, from zoomed ends at the full view', () => {
    // Full view: first tap zooms in, the second is suppressed.
    expect(tapIntent({ zoomed: false, lastChange: null }, at)).toBe('zoom-in');
    const afterIn = { x: at.x, y: at.y, at: at.at };
    expect(tapIntent({ zoomed: true, lastChange: afterIn }, { ...at, at: at.at + 150 })).toBe(
      'none',
    );
    // Zoomed: first tap zooms out, the second is suppressed.
    expect(tapIntent({ zoomed: true, lastChange: null }, at)).toBe('zoom-out');
    const afterOut = { x: at.x, y: at.y, at: at.at };
    expect(tapIntent({ zoomed: false, lastChange: afterOut }, { ...at, at: at.at + 150 })).toBe(
      'none',
    );
  });
});
