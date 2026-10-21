import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DA50RG, VIEWBOX, VIEW_PROFILES } from '../src/aircraft/da50rg/panel';
import type { ControlDef, Rect } from '../src/engine/registry';
import {
  DOUBLE_TAP_MS,
  DOUBLE_TAP_PX,
  FULL_PANEL_GUARD_MS,
  MOUSE_SLOP_PX,
  TAP_MAX_MS,
  TOUCH_SLOP_PX,
  createDoubleTapTracker,
  isBackgroundTap,
  isStrayFullPanelClick,
  slopPx,
} from '../src/ui/panel/tap-intent';
import {
  BUTTON_BOX,
  BUTTON_CORNERS,
  BUTTON_INSET,
  MIN_VIEW_WIDTH,
  ZOOM_PAD,
  buttonBox,
  buttonOverlap,
  chooseButtonCorner,
  controlFootprints,
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
    const corner: Rect = { x: VIEWBOX.w - 300, y: 800, w: 300, h: 210 };
    const r = pinchRect(corner, { x: VIEWBOX.w, y: 1010 }, 0.8, VIEWBOX);
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

  it('a three-state toggle counts a third of its height (the ELT)', () => {
    const elt = DA50RG.get('sw.elt');
    expect(elt?.kind).toBe('toggle');
    if (elt === undefined) return;
    expect(targetSide(elt)).toBe(Math.min(elt.hit.w, elt.hit.h / 3));
    expect(targetSide(elt)).toBe(26);
  });

  it('a circuit breaker counts the smaller hit side (one tap toggles, the whole hit is the target)', () => {
    const base = {
      kind: 'circuit-breaker' as const,
      id: 'cb.fixture',
      label: 'FIXTURE',
      region: 'cb_essential',
      x: 50,
      y: 50,
      states: [
        { id: 'in', label: 'IN' },
        { id: 'out', label: 'OUT' },
      ] as const,
      default: 'in',
      rating: '5',
      labelLines: ['FIXTURE'],
      group: 'lower' as const,
    };
    expect(targetSide({ ...base, hit: { w: 28, h: 28 } })).toBe(28);
    expect(targetSide({ ...base, hit: { w: 24, h: 28 }, compact: true })).toBe(24);
    expect(targetSide({ ...base, hit: { w: 30, h: 26 } })).toBe(26);
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

  it('counts the whole footprint of a tap-toggle lever: the smaller side', () => {
    const flap: ControlDef = {
      id: 'lv.x',
      label: 'X',
      region: 'pedestal',
      x: 50,
      y: 100,
      hit: { w: 44, h: 88 },
      kind: 'detent-lever',
      detents: [
        { id: 'off', label: 'OFF', pos: 0 },
        { id: 'set', label: 'SET', pos: 1 },
      ],
      default: 'off',
      track: { length: 44, axis: 'v' },
      skin: 'parking-flap',
      tapToggle: true,
    };
    // The drag rule would give min(44, 88 - 44, 44) = 44 here; make the track long so it differs.
    expect(targetSide(flap)).toBe(44);
    expect(targetSide({ ...flap, track: { length: 80, axis: 'v' } })).toBe(44);
    expect(targetSide({ ...flap, hit: { w: 60, h: 40 } })).toBe(40);
    expect(targetSide(DA50RG.get('lv.parking_brake') as ControlDef)).toBe(44);
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

  it('every FAN click spot reaches 44 px at the env_control zoom on every profile (R2-4.1)', () => {
    const fan = DA50RG.get('sw.env_fan');
    const spots = fan?.kind === 'rotary' ? (fan.spots ?? []) : [];
    expect(spots).toHaveLength(4);
    const region = DA50RG.regions.find((r) => r.id === 'env_control');
    expect(region).toBeDefined();
    if (region === undefined || fan === undefined) return;
    for (const [name, screen] of Object.entries(VIEW_PROFILES)) {
      const scale = fitScale(zoomRect(region.bounds, VIEWBOX), screen);
      for (const spot of spots) {
        const side = Math.min(spot.w, spot.h) * scale;
        expect(side, `${spot.stop} on ${name}`).toBeGreaterThanOrEqual(MIN_TAP_PX);
      }
      // The rule counts the smallest spot side for a knob with spots.
      expect(targetSide(fan) * scale, `rule on ${name}`).toBeGreaterThanOrEqual(MIN_TAP_PX);
    }
  });

  it('the breaker region cb_essential keeps the 28 x 28 breaker at full size on every profile', () => {
    const region = DA50RG.regions.find((r) => r.id === 'cb_essential');
    expect(region?.controlIds).toContain('cb.pitot');
    if (region === undefined) return;
    const pitot = DA50RG.get('cb.pitot');
    if (pitot === undefined) return;
    expect(targetSide(pitot)).toBe(28);
    for (const [name, screen] of Object.entries(VIEW_PROFILES)) {
      const scale = fitScale(zoomRect(region.bounds, VIEWBOX), screen);
      expect(targetSide(pitot) * scale, name).toBeGreaterThanOrEqual(MIN_TAP_PX);
    }
    // The phone profile is the tightest: 51.3 px (UI-SPEC 01.2, Table W2).
    const phone = fitScale(zoomRect(region.bounds, VIEWBOX), VIEW_PROFILES.phone) * 28;
    expect(phone).toBeCloseTo(51.3, 1);
  });

  it('every breaker region reaches 44 px on all three profiles, with the phone values of the budget', () => {
    const phoneBudget: Record<string, number> = {
      cb_essential: 51.3,
      cb_main: 47.4,
      cb_low: 62.9,
      cb_strip: 116.1,
    };
    for (const [id, expected] of Object.entries(phoneBudget)) {
      const region = DA50RG.regions.find((r) => r.id === id);
      expect(region, id).toBeDefined();
      if (region === undefined) continue;
      const smallest = Math.min(...regionControls(id).map(targetSide));
      expect(regionControls(id).length, id).toBeGreaterThan(0);
      for (const [name, screen] of Object.entries(VIEW_PROFILES)) {
        const scale = fitScale(zoomRect(region.bounds, VIEWBOX), screen);
        expect(smallest * scale, `${id} on ${name}`).toBeGreaterThanOrEqual(MIN_TAP_PX);
      }
      const phone = fitScale(zoomRect(region.bounds, VIEWBOX), VIEW_PROFILES.phone) * smallest;
      expect(phone, `${id} phone`).toBeCloseTo(expected, 0);
    }
  });

  it('portrait via pinch: a MIN_VIEW_WIDTH-wide view brings every control to 44 px', () => {
    const screen = { w: 393, h: 631 };
    const view = { w: MIN_VIEW_WIDTH, h: (MIN_VIEW_WIDTH * screen.h) / screen.w };
    const smallest = Math.min(...DA50RG.controls.map(targetSide));
    expect(smallest * fitScale(view, screen)).toBeGreaterThanOrEqual(MIN_TAP_PX);
  });
});

describe('slopPx (R3-Z2 items 1 and 4)', () => {
  it('is 10 px for touch and pen and 5 px for the mouse, from the exported constants', () => {
    expect(slopPx('touch')).toBe(TOUCH_SLOP_PX);
    expect(slopPx('pen')).toBe(TOUCH_SLOP_PX);
    expect(slopPx('mouse')).toBe(MOUSE_SLOP_PX);
    expect(MOUSE_SLOP_PX).toBeLessThan(TOUCH_SLOP_PX);
  });
});

describe('isBackgroundTap (D-12)', () => {
  const tap = {
    kind: 'touch' as const,
    travelPx: 0,
    durationMs: 100,
    maxPointers: 1,
    startedOnTarget: false,
  };

  it('accepts a short, still, single-pointer gesture on the background', () => {
    expect(isBackgroundTap(tap)).toBe(true);
    expect(isBackgroundTap({ ...tap, travelPx: TOUCH_SLOP_PX, durationMs: TAP_MAX_MS })).toBe(true);
    expect(isBackgroundTap({ ...tap, durationMs: 0 })).toBe(true);
  });

  it('rejects a drag, a slow press, a second pointer and a start on a target', () => {
    expect(isBackgroundTap({ ...tap, travelPx: TOUCH_SLOP_PX + 1 })).toBe(false);
    expect(isBackgroundTap({ ...tap, durationMs: TAP_MAX_MS + 1 })).toBe(false);
    expect(isBackgroundTap({ ...tap, maxPointers: 2 })).toBe(false);
    expect(isBackgroundTap({ ...tap, startedOnTarget: true })).toBe(false);
  });

  it('uses the slop of the pointer kind: a mouse tolerates 5 px, touch and pen 10 px', () => {
    expect(isBackgroundTap({ ...tap, kind: 'mouse', travelPx: MOUSE_SLOP_PX })).toBe(true);
    expect(isBackgroundTap({ ...tap, kind: 'mouse', travelPx: MOUSE_SLOP_PX + 1 })).toBe(false);
    expect(isBackgroundTap({ ...tap, kind: 'pen', travelPx: TOUCH_SLOP_PX })).toBe(true);
    expect(isBackgroundTap({ ...tap, kind: 'pen', travelPx: TOUCH_SLOP_PX + 1 })).toBe(false);
    expect(isBackgroundTap({ ...tap, kind: 'touch', travelPx: MOUSE_SLOP_PX + 1 })).toBe(true);
  });
});

describe('createDoubleTapTracker (R2-Z1)', () => {
  const first = { x: 500, y: 400, at: 10_000 };
  const later = (dt: number, dx = 0) => ({ x: first.x + dx, y: first.y, at: first.at + dt });

  it('a lone tap never zooms, zoomed or not', () => {
    expect(createDoubleTapTracker().tap(first, false)).toBe('none');
    expect(createDoubleTapTracker().tap(first, true)).toBe('none');
  });

  it('a pair inside the limits zooms in from the full view and out while zoomed', () => {
    const a = createDoubleTapTracker();
    a.tap(first, false);
    expect(a.tap(later(150, 5), false)).toBe('zoom-in');
    const b = createDoubleTapTracker();
    b.tap(first, true);
    expect(b.tap(later(150, 5), true)).toBe('zoom-out');
  });

  it('the limits are inclusive: exactly DOUBLE_TAP_MS and DOUBLE_TAP_PX still pair', () => {
    const a = createDoubleTapTracker();
    a.tap(first, false);
    expect(a.tap(later(DOUBLE_TAP_MS), false)).toBe('zoom-in');
    const b = createDoubleTapTracker();
    b.tap(first, false);
    expect(b.tap(later(100, DOUBLE_TAP_PX), false)).toBe('zoom-in');
  });

  it('one ms or one px more is not a pair', () => {
    const a = createDoubleTapTracker();
    a.tap(first, false);
    expect(a.tap(later(DOUBLE_TAP_MS + 1), false)).toBe('none');
    const b = createDoubleTapTracker();
    b.tap(first, false);
    expect(b.tap(later(100, DOUBLE_TAP_PX + 1), false)).toBe('none');
  });

  it('a late or far second tap becomes the remembered first tap of a new pair', () => {
    const t = createDoubleTapTracker();
    t.tap(first, false);
    const second = later(DOUBLE_TAP_MS + 100);
    expect(t.tap(second, false)).toBe('none');
    expect(t.tap({ ...second, at: second.at + 120 }, false)).toBe('zoom-in');
    const far = createDoubleTapTracker();
    far.tap(first, false);
    const farSecond = later(100, DOUBLE_TAP_PX + 40);
    expect(far.tap(farSecond, false)).toBe('none');
    expect(far.tap({ ...farSecond, at: farSecond.at + 100 }, false)).toBe('zoom-in');
  });

  it('a pair is consumed: three quick taps give none, pair, none', () => {
    const t = createDoubleTapTracker();
    expect(t.tap(first, false)).toBe('none');
    expect(t.tap(later(100), false)).toBe('zoom-in');
    expect(t.tap(later(200), true)).toBe('none');
  });

  it('a reset between the taps (a control pointer went down) ends the pair', () => {
    const t = createDoubleTapTracker();
    t.tap(first, false);
    t.reset();
    expect(t.tap(later(100), false)).toBe('none');
    expect(t.tap(later(200), false)).toBe('zoom-in');
  });
});

describe('isStrayFullPanelClick (WebKit synthesized click after a double tap, plan 32)', () => {
  const shownAt = 1000;

  it('ignores a click that arrives right after the view changed and had no press on the button', () => {
    expect(isStrayFullPanelClick({ shownAt, pressedAt: null, clickAt: shownAt + 5 })).toBe(true);
    expect(isStrayFullPanelClick({ shownAt, pressedAt: null, clickAt: shownAt + 120 })).toBe(true);
    expect(
      isStrayFullPanelClick({
        shownAt,
        pressedAt: null,
        clickAt: shownAt + FULL_PANEL_GUARD_MS - 1,
      }),
    ).toBe(true);
  });

  it('ignores a click whose press happened before the button appeared', () => {
    expect(isStrayFullPanelClick({ shownAt, pressedAt: shownAt - 30, clickAt: shownAt + 10 })).toBe(
      true,
    );
  });

  it('accepts a click that follows a press on the button, however fast the tap', () => {
    expect(isStrayFullPanelClick({ shownAt, pressedAt: shownAt + 20, clickAt: shownAt + 60 })).toBe(
      false,
    );
    expect(isStrayFullPanelClick({ shownAt, pressedAt: shownAt, clickAt: shownAt + 1 })).toBe(
      false,
    );
  });

  it('accepts any click from FULL_PANEL_GUARD_MS on, with or without a recorded press', () => {
    expect(
      isStrayFullPanelClick({ shownAt, pressedAt: null, clickAt: shownAt + FULL_PANEL_GUARD_MS }),
    ).toBe(false);
    expect(isStrayFullPanelClick({ shownAt, pressedAt: null, clickAt: shownAt + 5000 })).toBe(
      false,
    );
  });

  it('accepts every click when no tap changed the view (shownAt null)', () => {
    expect(isStrayFullPanelClick({ shownAt: null, pressedAt: null, clickAt: 3 })).toBe(false);
  });

  it('guards for about 400 ms', () => {
    expect(FULL_PANEL_GUARD_MS).toBe(400);
  });
});

describe('Full panel button corner (R2-T1, D-13)', () => {
  const footprints = controlFootprints(DA50RG);
  const landscape = [
    ['desktop', VIEW_PROFILES.desktop],
    ['tablet', VIEW_PROFILES.tablet],
    ['phone', VIEW_PROFILES.phone],
    ['phone-chromium', { w: 863, h: 332 }],
  ] as const;

  it('has a footprint for every control and the lifted guard of every guarded toggle', () => {
    const guarded = DA50RG.controls.filter((d) => d.kind === 'guarded-toggle').length;
    const guards = DA50RG.controls.filter((d) => d.kind === 'guard').length;
    expect(guarded).toBeGreaterThan(0);
    expect(footprints.length).toBe(DA50RG.controls.length - guards + guarded);
  });

  for (const [name, screen] of landscape) {
    it(`covers no control footprint in any zoomed region on the ${name} size`, () => {
      expect(DA50RG.regions.length).toBeGreaterThan(0);
      let current: 'tr' | 'br' | 'bl' = 'tr';
      for (const region of DA50RG.regions) {
        const view = zoomRect(region.bounds, VIEWBOX);
        const corner = chooseButtonCorner({ view, screen, footprints, current: 'tr' });
        expect(buttonOverlap(corner, view, screen, footprints), `${region.id} on ${name}`).toBe(0);
        // The current corner is kept when free, so a chain of views never picks a covered corner.
        current = chooseButtonCorner({ view, screen, footprints, current });
        expect(buttonOverlap(current, view, screen, footprints), `${region.id} chained`).toBe(0);
      }
    });
  }

  it('moves off the top right corner for cb_main on the tablet, where it covers cb.main_pump', () => {
    const region = DA50RG.regions.find((r) => r.id === 'cb_main');
    expect(region).toBeDefined();
    if (region === undefined) return;
    const view = zoomRect(region.bounds, VIEWBOX);
    const screen = VIEW_PROFILES.tablet;
    expect(buttonOverlap('tr', view, screen, footprints)).toBeGreaterThan(0);
    const pump = DA50RG.get('cb.main_pump');
    const essential = DA50RG.regions.find((r) => r.id === 'cb_essential');
    expect(pump && essential).toBeTruthy();
    if (pump === undefined || essential === undefined) return;
    const pumpOnly = [
      {
        x: essential.bounds.x + pump.x - pump.hit.w / 2,
        y: essential.bounds.y + pump.y - pump.hit.h / 2,
        w: pump.hit.w,
        h: pump.hit.h,
      },
    ];
    expect(buttonOverlap('tr', view, screen, pumpOnly)).toBeGreaterThan(0);
    const corner = chooseButtonCorner({ view, screen, footprints, current: 'tr' });
    expect(corner).not.toBe('tr');
  });

  it('keeps a free current corner although a higher priority corner is also free', () => {
    const view = FULL;
    const screen = { w: 800, h: 400 };
    expect(chooseButtonCorner({ view, screen, footprints: [], current: 'bl' })).toBe('bl');
    expect(chooseButtonCorner({ view, screen, footprints: [], current: 'br' })).toBe('br');
    expect(chooseButtonCorner({ view, screen, footprints: [], current: 'tr' })).toBe('tr');
  });

  it('takes the first free corner in priority order when the current one is covered', () => {
    const screen = { w: 800, h: 400 };
    const view = { x: 0, y: 0, w: 800, h: 400 };
    const cover = (corner: 'tr' | 'br' | 'bl') => buttonBox(corner, screen);
    expect(chooseButtonCorner({ view, screen, footprints: [cover('tr')], current: 'tr' })).toBe(
      'br',
    );
    expect(
      chooseButtonCorner({ view, screen, footprints: [cover('tr'), cover('br')], current: 'tr' }),
    ).toBe('bl');
    expect(chooseButtonCorner({ view, screen, footprints: [cover('bl')], current: 'bl' })).toBe(
      'tr',
    );
  });

  it('treats touching as free and a one pixel overlap as covered', () => {
    const screen = { w: 800, h: 400 };
    const view = { x: 0, y: 0, w: 800, h: 400 };
    const box = buttonBox('tr', screen);
    const touching = { x: box.x - 20, y: box.y, w: 20, h: box.h };
    expect(buttonOverlap('tr', view, screen, [touching])).toBe(0);
    const over = { x: box.x - 20, y: box.y, w: 21, h: box.h };
    expect(buttonOverlap('tr', view, screen, [over])).toBeGreaterThan(0);
  });

  it('picks the least overlapping corner when all three are covered', () => {
    const screen = { w: 800, h: 400 };
    const view = { x: 0, y: 0, w: 800, h: 400 };
    const part = (corner: 'tr' | 'br' | 'bl', fraction: number) => {
      const b = buttonBox(corner, screen);
      return { x: b.x, y: b.y, w: b.w * fraction, h: b.h };
    };
    const footprints3 = [part('tr', 1), part('br', 0.25), part('bl', 0.5)];
    expect(chooseButtonCorner({ view, screen, footprints: footprints3, current: 'tr' })).toBe('br');
    // Equal overlap everywhere: the current corner wins, then the priority order.
    const equal = BUTTON_CORNERS.map((c) => part(c, 1));
    expect(chooseButtonCorner({ view, screen, footprints: equal, current: 'bl' })).toBe('bl');
    expect(chooseButtonCorner({ view, screen, footprints: equal, current: 'tr' })).toBe('tr');
  });

  it('puts the corner boxes 8 px from the two nearest edges', () => {
    const screen = { w: 800, h: 400 };
    expect(BUTTON_BOX).toEqual({ w: 112, h: 44 });
    expect(buttonBox('tr', screen)).toEqual({ x: 800 - BUTTON_INSET - 112, y: 8, w: 112, h: 44 });
    expect(buttonBox('br', screen)).toEqual({
      x: 800 - BUTTON_INSET - 112,
      y: 400 - BUTTON_INSET - 44,
      w: 112,
      h: 44,
    });
    expect(buttonBox('bl', screen)).toEqual({ x: 8, y: 400 - BUTTON_INSET - 44, w: 112, h: 44 });
  });

  it('on the portrait phone exactly deice_switches and engine_controls have no free corner (known list)', () => {
    const screen = { w: 393, h: 631 };
    const known = new Set(['deice_switches', 'engine_controls']);
    const covered: string[] = [];
    for (const region of DA50RG.regions) {
      const view = zoomRect(region.bounds, VIEWBOX);
      const free = BUTTON_CORNERS.some((c) => buttonOverlap(c, view, screen, footprints) === 0);
      if (!free) covered.push(region.id);
    }
    // Reason: the zoomed deice and engine regions are nearly as tall as the narrow screen, so all
    // three corners lie over a control. Best effort on the portrait phone; a stale entry or a new
    // region fails this test so an improvement or a regression is noticed.
    expect(covered.sort()).toEqual([...known].sort());
  });

  it('the .zoom-out box in stage.css equals BUTTON_BOX', () => {
    const css = readFileSync(new URL('../src/ui/stage.css', import.meta.url), 'utf8');
    const rule = /\.zoom-out\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(/(?<![-\w])width:\s*(\d+)px/.exec(rule)?.[1]).toBe(String(BUTTON_BOX.w));
    expect(/min-height:\s*(\d+)px/.exec(rule)?.[1]).toBe(String(BUTTON_BOX.h));
    for (const corner of BUTTON_CORNERS) expect(css).toContain(`data-corner='${corner}'`);
  });
});

describe('HTML chrome type scale (UI-SPEC Typography)', () => {
  it('uses 14px as the only font size in stage.css', () => {
    const css = readFileSync(new URL('../src/ui/stage.css', import.meta.url), 'utf8');
    const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1]?.trim());
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBe('14px');
  });
});
