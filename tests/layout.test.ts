import { describe, expect, it } from 'vitest';
import { DA50RG_INDICATORS } from '../src/aircraft/da50rg/indicators';
import { DA50RG, VIEWBOX } from '../src/aircraft/da50rg/panel';
import { PLACARDS, placardLineY } from '../src/aircraft/da50rg/placards';
import {
  BRACKET_GROUPS,
  BRACKET_TITLE_DROP,
  GEAR_BLOCK,
  PLATES,
  PLATE_HEADINGS,
} from '../src/aircraft/da50rg/plates';
import { BEZEL_EXTRA } from '../src/engine/indicators';
import type { ControlDef, Rect } from '../src/engine/registry';
import { bracketPath, glyphWidth } from '../src/ui/panel/PanelShell';
import { BEZEL_RADIUS, buttonTextLayout, textWidth } from '../src/ui/panel/skins/PushButton';
import { togglePosition } from '../src/ui/panel/widgets/Toggle';
import {
  ALL_REGION_IDS,
  CB_REFERENCE,
  FRONT_PANEL_REGIONS,
  INDICATOR_POSITIONS,
  ORDERING,
  PANEL_VIEWBOX,
  REFERENCE_POSITIONS,
  UNDER_PANEL_REGIONS,
} from './layout-reference';
import type { Relation } from './layout-reference';

// Layout gate (PNL-02, PNL-08, D-03, D-19, D-21). Pure geometry over the registry: controls
// added by later plans are checked automatically. The reference tables live in
// tests/layout-reference.ts; their positions are layout facts read from private photos and
// never copied or traced (D-06).

function overlaps(a: Rect, b: Rect): boolean {
  // Strict inequality on both axes: shared edges do not overlap.
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function inside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function footprint(def: ControlDef): Rect {
  return { x: def.x - def.hit.w / 2, y: def.y - def.hit.h / 2, w: def.hit.w, h: def.hit.h };
}

function regionBounds(id: string): Rect {
  const region = DA50RG.regions.find((r) => r.id === id);
  if (region === undefined) throw new Error(`unknown region ${id}`);
  return region.bounds;
}

function globalCentre(def: { region: string; x: number; y: number }): {
  x: number;
  y: number;
} {
  const b = regionBounds(def.region);
  return { x: b.x + def.x, y: b.y + def.y };
}

interface Subject {
  readonly isRegion: boolean;
  readonly cx: number;
  readonly cy: number;
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
}

function subject(ref: string): Subject | undefined {
  if (ref.startsWith('region:')) {
    const b = regionBounds(ref.slice('region:'.length));
    return {
      isRegion: true,
      cx: b.x + b.w / 2,
      cy: b.y + b.h / 2,
      x1: b.x,
      x2: b.x + b.w,
      y1: b.y,
      y2: b.y + b.h,
    };
  }
  const lamp = DA50RG_INDICATORS.get(ref);
  const def = lamp ?? DA50RG.get(ref);
  if (def === undefined) return undefined;
  const c = globalCentre(def);
  return { isRegion: false, cx: c.x, cy: c.y, x1: c.x, x2: c.x, y1: c.y, y2: c.y };
}

function holds(a: Subject, relation: Relation, b: Subject | number): boolean {
  if (relation === 'x-greater-than') return typeof b === 'number' && a.cx > b;
  if (typeof b === 'number') throw new Error(`relation ${relation} needs a subject`);
  switch (relation) {
    case 'left-of':
      return a.x2 <= b.x1 && a.cx < b.cx;
    case 'right-of':
      return a.x1 >= b.x2 && a.cx > b.cx;
    case 'above':
      return a.y2 <= b.y1 && a.cy < b.cy;
    case 'below':
      return a.y1 >= b.y2 && a.cy > b.cy;
    case 'x-within':
      return a.cx >= b.x1 && a.cx <= b.x2;
    case 'same-row':
      return Math.abs(a.cy - b.cy) <= 10;
    case 'under-left-quarter-of':
      // Just below the display, within the leftmost quarter of its x-span.
      return a.cx >= b.x1 && a.cx <= b.x1 + (b.x2 - b.x1) / 4 && a.cy >= b.y2 && a.cy <= b.y2 + 60;
  }
}

describe('viewBox and regions', () => {
  it('uses the true panel proportions with the 180 unit right extension (D-21, U-01)', () => {
    expect(VIEWBOX).toEqual(PANEL_VIEWBOX);
  });

  it('the widening is right-only: every pre-phase control and lamp lies left of x 1980', () => {
    for (const row of [...REFERENCE_POSITIONS, ...INDICATOR_POSITIONS]) {
      expect(row.x, row.id).toBeLessThan(1980);
    }
    // The circuit-breaker regions (cb_*) are the new content of the widened strip.
    const rights = DA50RG.regions
      .filter((r) => !r.id.startsWith('cb_') && r.bounds.x + r.bounds.w > 1980)
      .map((r) => r.id);
    expect(rights).toEqual([]);
  });

  it('PFD and MFD are the same display: 495x367, aspect 1.35, starting at y 200', () => {
    for (const id of ['pfd', 'mfd']) {
      const b = regionBounds(id);
      expect([b.w, b.h, b.y]).toEqual([495, 367, 200]);
    }
    expect(495 / 367).toBeCloseTo(1.35, 2);
  });

  it('region ids are unique', () => {
    const ids = DA50RG.regions.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every region lies inside the viewBox', () => {
    const box: Rect = { x: 0, y: 0, w: VIEWBOX.w, h: VIEWBOX.h };
    for (const r of DA50RG.regions) expect(inside(r.bounds, box), r.id).toBe(true);
  });

  it('the four breaker regions have the Table B1 bounds, typed in independently of the data', () => {
    const expected: Readonly<Record<string, Rect>> = {
      cb_essential: { x: 1884, y: 215, w: 260, h: 152 },
      cb_main: { x: 1884, y: 368, w: 260, h: 166 },
      cb_low: { x: 1884, y: 648, w: 260, h: 56 },
      cb_strip: { x: 1441, y: 648, w: 118, h: 56 },
    };
    for (const [id, bounds] of Object.entries(expected)) {
      expect(regionBounds(id), id).toEqual(bounds);
    }
    expect(DA50RG.regions).toHaveLength(ALL_REGION_IDS.length);
  });

  it('no two regions overlap with positive area', () => {
    const regions = DA50RG.regions;
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        const a = regions[i];
        const b = regions[j];
        if (a === undefined || b === undefined) continue;
        expect(overlaps(a.bounds, b.bounds), `${a.id} / ${b.id}`).toBe(false);
      }
    }
  });
});

describe('control footprints', () => {
  it('every footprint lies inside its region', () => {
    for (const def of DA50RG.controls) {
      const b = regionBounds(def.region);
      expect(inside(footprint(def), { x: 0, y: 0, w: b.w, h: b.h }), def.id).toBe(true);
    }
  });

  it('footprints of different controls in a region never overlap (touching is allowed)', () => {
    for (const region of DA50RG.regions) {
      const defs = region.controlIds.flatMap((id) => DA50RG.get(id) ?? []);
      for (let i = 0; i < defs.length; i++) {
        for (let j = i + 1; j < defs.length; j++) {
          const a = defs[i];
          const b = defs[j];
          if (a === undefined || b === undefined) continue;
          // A guard covers its own switch by design.
          if (a.kind === 'guard' && a.guards === b.id) continue;
          if (b.kind === 'guard' && b.guards === a.id) continue;
          expect(overlaps(footprint(a), footprint(b)), `${a.id} / ${b.id}`).toBe(false);
        }
      }
    }
  });

  it('every lifted-guard area lies inside the region and overlaps no footprint', () => {
    for (const def of DA50RG.controls) {
      if (def.kind !== 'guard') continue;
      const b = regionBounds(def.region);
      const open: Rect = {
        x: def.x + def.openHit.x,
        y: def.y + def.openHit.y,
        w: def.openHit.w,
        h: def.openHit.h,
      };
      expect(inside(open, { x: 0, y: 0, w: b.w, h: b.h }), `${def.id} inside`).toBe(true);
      const region = DA50RG.regions.find((r) => r.id === def.region);
      for (const id of region?.controlIds ?? []) {
        const other = DA50RG.get(id);
        if (other === undefined) continue;
        expect(overlaps(open, footprint(other)), `${def.id} open area / ${id}`).toBe(false);
      }
    }
  });

  it('detent levers have positive, non-overlapping handle and marker squares that fit', () => {
    for (const def of DA50RG.controls) {
      if (def.kind !== 'detent-lever') continue;
      const along = def.track.axis === 'v' ? def.hit.h : def.hit.w;
      const across = def.track.axis === 'v' ? def.hit.w : def.hit.h;
      const markerIds = def.dragOnly === true ? [] : (def.markers ?? def.detents.map((d) => d.id));
      const positions = def.detents
        .filter((d) => markerIds.includes(d.id))
        .map((d) => d.pos * def.track.length)
        .sort((p, q) => p - q);
      let spacing = Infinity;
      for (let i = 1; i < positions.length; i++) {
        spacing = Math.min(spacing, (positions[i] ?? 0) - (positions[i - 1] ?? 0));
      }
      const s = Math.min(across, along - def.track.length, spacing);
      expect(s, `${def.id} square side`).toBeGreaterThan(0);
      expect(def.track.length + s, `${def.id} track plus handle`).toBeLessThanOrEqual(along);
      for (let i = 1; i < positions.length; i++) {
        expect(
          (positions[i] ?? 0) - (positions[i - 1] ?? 0),
          `${def.id} marker ${i}`,
        ).toBeGreaterThanOrEqual(s);
      }
    }
  });
});

describe('true-proportion reference positions (D-21)', () => {
  for (const { id, x, y, tol, review } of [
    ...REFERENCE_POSITIONS,
    ...CB_REFERENCE,
    ...INDICATOR_POSITIONS,
  ]) {
    const def = DA50RG_INDICATORS.get(id) ?? DA50RG.get(id);
    (def === undefined ? it.skip : it)(
      `${id} sits at ${x}, ${y} within ${tol}${review ? ' (review)' : ''}`,
      () => {
        if (def === undefined) return;
        const c = globalCentre(def);
        expect(Math.abs(c.x - x)).toBeLessThanOrEqual(tol);
        expect(Math.abs(c.y - y)).toBeLessThanOrEqual(tol);
      },
    );
  }

  it('the reference tables cover every non-guard control and every lamp exactly once', () => {
    const controlRows = [...REFERENCE_POSITIONS, ...CB_REFERENCE].map((r) => r.id);
    const lampRows = INDICATOR_POSITIONS.map((r) => r.id);
    expect(new Set(controlRows).size, 'duplicate id in the control reference tables').toBe(
      controlRows.length,
    );
    expect(new Set(lampRows).size, 'duplicate id in INDICATOR_POSITIONS').toBe(lampRows.length);
    expect([...controlRows].sort()).toEqual(
      DA50RG.controls
        .filter((c) => c.kind !== 'guard')
        .map((c) => c.id)
        .sort(),
    );
    expect([...lampRows].sort()).toEqual(DA50RG_INDICATORS.indicators.map((l) => l.id).sort());
  });

  it('every non-guard control appears in the reference table', () => {
    const known = new Set([...REFERENCE_POSITIONS, ...CB_REFERENCE].map((r) => r.id));
    for (const def of DA50RG.controls) {
      if (def.kind === 'guard') continue;
      expect(known.has(def.id), `${def.id} has no reference position`).toBe(true);
    }
  });
});

describe('indicator lamps (PNL-14, D-11)', () => {
  // Each lamp has its own bezel: r 7 for the gear and flap lamps, r 4 for the small ELT lamp.
  const bezelOf = (lamp: { r: number }) => lamp.r + BEZEL_EXTRA;

  it('every lamp bezel disc lies inside its region', () => {
    for (const lamp of DA50RG_INDICATORS.indicators) {
      const b = regionBounds(lamp.region);
      const BEZEL = bezelOf(lamp);
      expect(lamp.r, `${lamp.id} radius`).toBeGreaterThanOrEqual(4);
      expect(lamp.x - BEZEL, `${lamp.id} left`).toBeGreaterThanOrEqual(0);
      expect(lamp.y - BEZEL, `${lamp.id} top`).toBeGreaterThanOrEqual(0);
      expect(lamp.x + BEZEL, `${lamp.id} right`).toBeLessThanOrEqual(b.w);
      expect(lamp.y + BEZEL, `${lamp.id} bottom`).toBeLessThanOrEqual(b.h);
    }
  });

  it('no lamp bezel overlaps a control footprint of its region', () => {
    for (const lamp of DA50RG_INDICATORS.indicators) {
      const region = DA50RG.regions.find((r) => r.id === lamp.region);
      for (const id of region?.controlIds ?? []) {
        const def = DA50RG.get(id);
        if (def === undefined) continue;
        const distance = distanceToRect(lamp.x, lamp.y, footprint(def));
        expect(distance, `${lamp.id} / ${id}`).toBeGreaterThanOrEqual(bezelOf(lamp));
      }
    }
  });
});

/** Hit footprints in global coordinates, including lifted-guard areas. */
function globalFootprints(): Rect[] {
  const out: Rect[] = [];
  for (const def of DA50RG.controls) {
    const b = regionBounds(def.region);
    const f = footprint(def);
    out.push({ x: b.x + f.x, y: b.y + f.y, w: f.w, h: f.h });
    const open =
      def.kind === 'guarded-toggle' ? def.guardOpenHit : def.kind === 'guard' ? def.openHit : null;
    if (open !== null) {
      out.push({ x: b.x + def.x + open.x, y: b.y + def.y + open.y, w: open.w, h: open.h });
    }
  }
  return out;
}

function distanceToRect(px: number, py: number, r: Rect): number {
  const dx = Math.max(r.x - px, 0, px - (r.x + r.w));
  const dy = Math.max(r.y - py, 0, py - (r.y + r.h));
  return Math.hypot(dx, dy);
}

describe('background clearance for region tap (PNL-09)', () => {
  const MIN_CLEARANCE = 7;
  const STEPS = 48;

  it(`every region keeps a background point at least ${MIN_CLEARANCE} units from every control`, () => {
    const all = globalFootprints();
    for (const region of DA50RG.regions) {
      const b = region.bounds;
      let best = 0;
      for (let i = 0; i < STEPS; i++) {
        for (let j = 0; j < STEPS; j++) {
          const x = b.x + (0.1 + (0.8 * (i + 0.5)) / STEPS) * b.w;
          const y = b.y + (0.1 + (0.8 * (j + 0.5)) / STEPS) * b.h;
          let nearest = Infinity;
          for (const r of all) nearest = Math.min(nearest, distanceToRect(x, y, r));
          best = Math.max(best, nearest);
        }
      }
      expect(best, `${region.id} best clearance ${best.toFixed(1)}`).toBeGreaterThanOrEqual(
        MIN_CLEARANCE,
      );
    }
  });
});

// Plan 28 (R2-4.1): the FAN has four direct click spots; the footprint grew to hold them.
describe('FAN click spots (plan 28, R2-4.1)', () => {
  const fan = DA50RG.get('sw.env_fan');
  const rotary = fan?.kind === 'rotary' ? fan : undefined;
  const spots = rotary?.spots ?? [];
  const global = (): Rect => {
    if (rotary === undefined) throw new Error('no FAN');
    const b = regionBounds(rotary.region);
    const f = footprint(rotary);
    return { x: b.x + f.x, y: b.y + f.y, w: f.w, h: f.h };
  };

  it('the FAN footprint lies inside env_control and on the environmental plate', () => {
    expect(rotary).toBeDefined();
    if (rotary === undefined) return;
    expect(
      inside(footprint(rotary), {
        x: 0,
        y: 0,
        w: regionBounds('env_control').w,
        h: regionBounds('env_control').h,
      }),
    ).toBe(true);
    const plate = PLATES.find((p) => p.id === 'environmental');
    expect(plate).toBeDefined();
    if (plate === undefined) return;
    expect(inside(global(), { x: plate.x, y: plate.y, w: plate.w, h: plate.h })).toBe(true);
  });

  it('the footprint sits at global x 964 to 1076 and y 889 to 975 (Table F1)', () => {
    const g = global();
    expect([g.x, g.x + g.w, g.y, g.y + g.h]).toEqual([964, 1076, 889, 975]);
  });

  it('no other control footprint overlaps the FAN footprint (touching allowed)', () => {
    const mine = global();
    for (const def of DA50RG.controls) {
      if (def.id === 'sw.env_fan') continue;
      const b = regionBounds(def.region);
      const f = footprint(def);
      const other = { x: b.x + f.x, y: b.y + f.y, w: f.w, h: f.h };
      expect(overlaps(mine, other), `FAN / ${def.id}`).toBe(false);
    }
  });

  it('every spot lies inside the footprint and holds the mark of its own stop', () => {
    expect(spots).toHaveLength(4);
    if (rotary === undefined) return;
    for (const spot of spots) {
      const stop = rotary.stops.find((s) => s.id === spot.stop);
      expect(stop, spot.stop).toBeDefined();
      if (stop === undefined) continue;
      expect(Math.abs(spot.x) + spot.w / 2, spot.stop).toBeLessThanOrEqual(rotary.hit.w / 2);
      expect(Math.abs(spot.y) + spot.h / 2, spot.stop).toBeLessThanOrEqual(rotary.hit.h / 2);
      const a = (stop.angle * Math.PI) / 180;
      const mark = { x: (rotary.r + 8) * Math.sin(a), y: -(rotary.r + 8) * Math.cos(a) };
      expect(Math.abs(mark.x - spot.x), `${spot.stop} mark x`).toBeLessThanOrEqual(spot.w / 2);
      expect(Math.abs(mark.y - spot.y), `${spot.stop} mark y`).toBeLessThanOrEqual(spot.h / 2);
    }
  });

  it('no spot reaches another control footprint of the panel', () => {
    if (rotary === undefined) return;
    const b = regionBounds(rotary.region);
    for (const spot of spots) {
      const rect: Rect = {
        x: b.x + rotary.x + spot.x - spot.w / 2,
        y: b.y + rotary.y + spot.y - spot.h / 2,
        w: spot.w,
        h: spot.h,
      };
      for (const def of DA50RG.controls) {
        if (def.id === 'sw.env_fan') continue;
        const rb = regionBounds(def.region);
        const f = footprint(def);
        const other = { x: rb.x + f.x, y: rb.y + f.y, w: f.w, h: f.h };
        expect(overlaps(rect, other), `${spot.stop} / ${def.id}`).toBe(false);
      }
    }
  });
});

// Owner finding G-2: the landing gear block reads heading, speed line, then lamps and toggle,
// all on the gear plate and inside the landing_gear region. Glyph tops use 0.7 of the font size.
describe('landing gear block order (G-2)', () => {
  const CAP = 0.7;
  const gearRegion = (): Rect => regionBounds('landing_gear');
  const plate = (): Rect => {
    const p = PLATES.find((q) => q.id === 'strip-gear');
    if (p === undefined) throw new Error('no strip-gear plate');
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  };
  const lamps = () => DA50RG_INDICATORS.indicators.filter((d) => d.region === 'landing_gear');
  const toggle = () => {
    const def = DA50RG.get('btn.stall_gear_test');
    if (def === undefined) throw new Error('no toggle');
    return def;
  };

  it('the heading sits above the speed line', () => {
    expect(GEAR_BLOCK.headingY).toBeLessThan(GEAR_BLOCK.speedLineY);
  });

  it('the speed line lies above every lamp caption and the toggle captions', () => {
    const tops: [string, number][] = [];
    for (const d of lamps()) {
      const g = globalCentre(d);
      tops.push([d.id, g.y - (d.r + BEZEL_EXTRA + 3) - 6 * CAP]);
    }
    const t = globalCentre(toggle());
    tops.push(['toggle captions', t.y - toggle().hit.h / 2 - 8 - 6 * CAP]);
    for (const [name, top] of tops) {
      expect(GEAR_BLOCK.speedLineY, name).toBeLessThan(top);
    }
  });

  it('every lamp bezel and caption and the toggle with its captions lie in plate and region', () => {
    const boxes: [string, Rect][] = [];
    for (const d of lamps()) {
      const g = globalCentre(d);
      const reach = d.r + BEZEL_EXTRA;
      boxes.push([d.id, { x: g.x - 14, y: g.y - reach - 9, w: 28, h: 2 * reach + 9 }]);
    }
    const t = globalCentre(toggle());
    const h = toggle().hit;
    boxes.push(['toggle', { x: t.x - h.w / 2, y: t.y - h.h / 2 - 15, w: h.w, h: h.h + 15 }]);
    for (const [name, box] of boxes) {
      expect(inside(box, plate()), `${name} in plate`).toBe(true);
      expect(inside(box, gearRegion()), `${name} in region`).toBe(true);
    }
  });

  it('the NO SMOKING placard overlaps no lamp', () => {
    const placard: Rect = { x: 965, y: 725, w: 64, h: 14 };
    for (const d of lamps()) {
      const g = globalCentre(d);
      const reach = d.r + BEZEL_EXTRA;
      const lamp: Rect = { x: g.x - reach, y: g.y - reach, w: 2 * reach, h: 2 * reach };
      expect(overlaps(lamp, placard), d.id).toBe(false);
    }
  });
});

describe('reference ordering (PNL-08, D-19)', () => {
  for (const [a, relation, b] of ORDERING) {
    const sa = subject(a);
    const sb = typeof b === 'number' ? b : subject(b);
    const present = sa !== undefined && sb !== undefined;
    (present ? it : it.skip)(`${a} ${relation} ${String(b)}`, () => {
      if (sa === undefined || sb === undefined) return;
      expect(holds(sa, relation, sb)).toBe(true);
    });
  }

  it('under-panel and pedestal controls sit below every front-panel region', () => {
    const frontBottom = Math.max(
      ...FRONT_PANEL_REGIONS.map((id) => {
        const b = regionBounds(id);
        return b.y + b.h;
      }),
    );
    for (const def of DA50RG.controls) {
      if (!UNDER_PANEL_REGIONS.includes(def.region)) continue;
      expect(globalCentre(def).y, def.id).toBeGreaterThan(frontBottom);
    }
  });
});

// Completeness gate (D-10, PNL-08). The per-row tests above skip a row whose control does not
// exist yet (so later phases can add rows early); this block is what fails if a control or
// lamp of the inventory goes missing, so no reference or ordering row is ever skipped silently.
describe('inventory complete', () => {
  // The counts come from the independent reference tables, never from the registry under test
  // and never from a literal: a new control, lamp or region must be added to its table first.
  it('the control, lamp and region counts equal the independent reference tables', () => {
    expect(DA50RG.controls.filter((c) => c.kind !== 'guard')).toHaveLength(
      REFERENCE_POSITIONS.length + CB_REFERENCE.length,
    );
    expect(DA50RG_INDICATORS.indicators).toHaveLength(INDICATOR_POSITIONS.length);
    expect(DA50RG.regions.map((r) => r.id).sort()).toEqual([...ALL_REGION_IDS].sort());
  });

  it('every reference position resolves to a DA50RG control', () => {
    for (const row of [...REFERENCE_POSITIONS, ...CB_REFERENCE]) {
      expect(DA50RG.get(row.id), row.id).toBeDefined();
    }
  });

  it('every indicator position resolves to a DA50RG_INDICATORS lamp', () => {
    for (const row of INDICATOR_POSITIONS) {
      expect(DA50RG_INDICATORS.get(row.id), row.id).toBeDefined();
    }
  });

  it('every ordering subject and object resolves, so no ordering row skips', () => {
    for (const [a, relation, b] of ORDERING) {
      expect(subject(a), `${a} ${relation} ${String(b)} (subject)`).toBeDefined();
      if (typeof b !== 'number') {
        expect(subject(b), `${a} ${relation} ${b} (object)`).toBeDefined();
      }
    }
  });
});

// Plates (owner finding G-0.5): the dark plates seen on screen are data. Parts that do not fit
// are fixed by enlarging the plate or the region, never by shrinking a tap target.
describe('plates', () => {
  // Bezel growth (Table D1): 16 on the top, left and right, 41 on the bottom (the softkey lip).
  const BEZEL_GROW = 16;
  const BEZEL_GROW_BOTTOM = 41;
  /** No region is open any more: plans 21 and 22 rebuilt the de-ice unit and it passes. */
  const FOOTPRINT_KNOWN_OPEN: readonly string[] = [];

  const rectOf = (p: { x: number; y: number; w: number; h: number }): Rect => ({
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
  });

  it('plate ids are unique and every plate lies inside the viewBox', () => {
    const ids = PLATES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const box: Rect = { x: 0, y: 0, w: VIEWBOX.w, h: VIEWBOX.h };
    for (const p of PLATES) expect(inside(rectOf(p), box), p.id).toBe(true);
  });

  it('no two plates overlap with positive area', () => {
    for (let i = 0; i < PLATES.length; i++) {
      for (let j = i + 1; j < PLATES.length; j++) {
        const a = PLATES[i];
        const b = PLATES[j];
        if (a === undefined || b === undefined) continue;
        expect(overlaps(rectOf(a), rectOf(b)), `${a.id} / ${b.id}`).toBe(false);
      }
    }
  });

  it('the bezels span y 184 to 608 and x 346..873 and 1253..1780', () => {
    for (const [id, x] of [
      ['pfd', 346],
      ['mfd', 1253],
    ] as const) {
      const b = regionBounds(id);
      expect([b.x - BEZEL_GROW, b.x + b.w + BEZEL_GROW], id).toEqual([x, x + 527]);
      expect([b.y - BEZEL_GROW, b.y + b.h + BEZEL_GROW_BOTTOM], id).toEqual([184, 608]);
    }
  });

  it('no plate overlaps the PFD or MFD bezel (region grown by 16, and by 41 below)', () => {
    for (const id of ['pfd', 'mfd']) {
      const b = regionBounds(id);
      const bezel: Rect = {
        x: b.x - BEZEL_GROW,
        y: b.y - BEZEL_GROW,
        w: b.w + 2 * BEZEL_GROW,
        h: b.h + BEZEL_GROW + BEZEL_GROW_BOTTOM,
      };
      for (const p of PLATES) {
        // The gear plate runs under the PFD bezel corner (the shell draws it below the bezel,
        // G-2): allowed for that one pair, and only as a sliver of at most 28 units (the bezel
        // lip grew to 41 below the screen).
        if (p.id === 'strip-gear' && id === 'pfd') {
          expect(p.y + 28, 'strip-gear sliver under the PFD bezel').toBeGreaterThanOrEqual(
            bezel.y + bezel.h,
          );
          continue;
        }
        expect(overlaps(rectOf(p), bezel), `${p.id} / ${id}`).toBe(false);
      }
    }
  });

  it('the bus-panel plate has the Table B2 rectangle and carries the three bus regions', () => {
    const bus = PLATES.find((p) => p.id === 'bus-panel');
    expect(bus).toBeDefined();
    if (bus === undefined) return;
    expect([bus.x, bus.y, bus.w, bus.h, bus.rx]).toEqual([1874, 205, 280, 540, 8]);
    expect([...bus.regions]).toEqual(['cb_essential', 'cb_main', 'cb_low']);
    // Inside the face plate (right edge x 2160, plan 01) with 6 units to spare.
    expect(bus.x + bus.w).toBe(2154);
    expect(bus.x + bus.w).toBeLessThanOrEqual(2160);
    // The old narrow bus rectangle (x 1836, 144 wide) is gone: the plate starts right of right_panel.
    const rp = regionBounds('right_panel');
    expect(bus.x).toBeGreaterThanOrEqual(rp.x + rp.w);
  });

  it('the flap strip plate carries flaps, right_panel and the cb_strip breaker region', () => {
    const strip = PLATES.find((p) => p.id === 'strip-flaps');
    expect(strip).toBeDefined();
    if (strip === undefined) return;
    expect([strip.x, strip.y, strip.w, strip.h]).toEqual([1150, 608, 680, 137]);
    expect([...strip.regions]).toEqual(['flaps', 'right_panel', 'cb_strip']);
  });

  it('the footprint of cb.pitot lies inside the bus-panel plate', () => {
    const bus = PLATES.find((p) => p.id === 'bus-panel');
    const def = DA50RG.get('cb.pitot');
    expect(bus).toBeDefined();
    expect(def).toBeDefined();
    if (bus === undefined || def === undefined) return;
    const c = globalCentre(def);
    const global: Rect = {
      x: c.x - def.hit.w / 2,
      y: c.y - def.hit.h / 2,
      w: def.hit.w,
      h: def.hit.h,
    };
    expect(inside(global, rectOf(bus))).toBe(true);
  });

  it('every region a plate names exists and is carried by one plate only', () => {
    const seen = new Set<string>();
    for (const p of PLATES) {
      for (const id of p.regions) {
        expect(
          DA50RG.regions.some((r) => r.id === id),
          `${p.id} names ${id}`,
        ).toBe(true);
        expect(seen.has(id), `${id} on two plates`).toBe(false);
        seen.add(id);
      }
    }
  });

  it('every control footprint of a carried region lies inside its plate', () => {
    const offenders: string[] = [];
    for (const p of PLATES) {
      for (const id of p.regions) {
        if (FOOTPRINT_KNOWN_OPEN.includes(id)) continue;
        const b = regionBounds(id);
        for (const def of DA50RG.controls) {
          if (def.region !== id) continue;
          const f = footprint(def);
          const global: Rect = { x: b.x + f.x, y: b.y + f.y, w: f.w, h: f.h };
          if (!inside(global, rectOf(p))) offenders.push(`${def.id} on plate ${p.id}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// Phase 01.2 plan 06: the inert avionics units. The numbers are typed in by hand from the UI-SPEC
// tables (E1 regions, E2 plates), never read from the data files under test.
describe('avionics unit regions and plates (plan 06)', () => {
  const UNIT_REGIONS: readonly (readonly [string, string, number, number, number, number])[] = [
    ['pfd_bezel_right', 'PFD KNOBS RIGHT', 875, 196, 68, 378],
    ['audio_panel', 'AUDIO PANEL', 946, 196, 60, 378],
    ['standby_efis', 'BACKUP EFIS', 1026, 296, 120, 278],
    ['pfd_bezel_left', 'PFD KNOBS LEFT', 274, 196, 68, 408],
    ['autopilot_panel', 'AUTOPILOT PANEL', 1164, 196, 86, 408],
    ['mfd_bezel_right', 'MFD KNOBS RIGHT', 1782, 196, 84, 378],
  ];
  const UNIT_PLATES: readonly (readonly [string, number, number, number, number, number])[] = [
    ['centre-stack', 875, 185, 285, 390, 8],
    ['ap-unit', 1162, 185, 89, 421, 8],
    ['pfd-left-unit', 272, 185, 72, 421, 8],
    ['mfd-right-unit', 1782, 185, 84, 421, 8],
  ];

  it.each(UNIT_REGIONS)(
    'region %s has the Table E1 bounds and holds no control',
    (id, name, x, y, w, h) => {
      const region = DA50RG.regions.find((r) => r.id === id);
      expect(region).toBeDefined();
      expect(region?.name).toBe(name);
      expect(region?.bounds).toEqual({ x, y, w, h });
      expect(region?.controlIds).toEqual([]);
      expect(inside({ x, y, w, h }, { x: 0, y: 0, w: PANEL_VIEWBOX.w, h: PANEL_VIEWBOX.h })).toBe(
        true,
      );
    },
  );

  it('no region overlaps another region', () => {
    const regions = DA50RG.regions;
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        const a = regions[i];
        const b = regions[j];
        if (a === undefined || b === undefined) continue;
        expect(overlaps(a.bounds, b.bounds), `${a.id} / ${b.id}`).toBe(false);
      }
    }
  });

  it.each(UNIT_PLATES)('plate %s has the Table E2 rectangle', (id, x, y, w, h, rx) => {
    const plate = PLATES.find((p) => p.id === id);
    expect(plate).toBeDefined();
    expect([plate?.x, plate?.y, plate?.w, plate?.h, plate?.rx]).toEqual([x, y, w, h, rx]);
  });

  it('the centre-stack plate carries the dimmer knobs, the PFD right column, audio and backup EFIS', () => {
    const plate = PLATES.find((p) => p.id === 'centre-stack');
    expect([...(plate?.regions ?? [])]).toEqual([
      'light_knobs',
      'pfd_bezel_right',
      'audio_panel',
      'standby_efis',
    ]);
  });

  it('the three unit plates carry exactly their region and there are 13 plates', () => {
    const carried = (id: string) => [...(PLATES.find((p) => p.id === id)?.regions ?? [])];
    expect(carried('ap-unit')).toEqual(['autopilot_panel']);
    expect(carried('pfd-left-unit')).toEqual(['pfd_bezel_left']);
    expect(carried('mfd-right-unit')).toEqual(['mfd_bezel_right']);
    expect(PLATES).toHaveLength(13);
  });

  it('keeps its clearances to the neighbours (strip-flaps, gear plate, bezels, bus plate)', () => {
    const r = (id: string): Rect => regionBounds(id);
    // pfd_bezel_left ends left of pfd_softkeys; autopilot_panel ends above flaps and left of the MFD bezel.
    expect(r('pfd_bezel_left').x + r('pfd_bezel_left').w).toBe(342);
    expect(r('pfd_softkeys').x).toBe(356);
    expect(r('autopilot_panel').y + r('autopilot_panel').h).toBe(604);
    expect(r('flaps').y).toBe(608);
    expect(r('mfd_bezel_right').x + r('mfd_bezel_right').w).toBe(1866);
    const bus = PLATES.find((p) => p.id === 'bus-panel');
    expect(bus?.x).toBe(1874);
    const ap = PLATES.find((p) => p.id === 'ap-unit');
    const flaps = PLATES.find((p) => p.id === 'strip-flaps');
    expect((ap?.y ?? 0) + (ap?.h ?? 0)).toBe(606);
    expect(flaps?.y).toBe(608);
    const stack = PLATES.find((p) => p.id === 'centre-stack');
    expect((stack?.x ?? 0) + (stack?.w ?? 0)).toBe(1160);
    expect(ap?.x).toBe(1162);
    expect((stack?.y ?? 0) + (stack?.h ?? 0)).toBe(575);
    expect(PLATES.find((p) => p.id === 'strip-gear')?.y).toBe(580);
  });

  it('both dimmer knob footprints still lie inside the centre-stack plate', () => {
    const plate = PLATES.find((p) => p.id === 'centre-stack');
    if (plate === undefined) throw new Error('no centre-stack plate');
    for (const id of ['sw.instr_light', 'sw.flood_light']) {
      const def = DA50RG.get(id);
      if (def === undefined) throw new Error(`no ${id}`);
      const c = globalCentre(def);
      const f: Rect = {
        x: c.x - def.hit.w / 2,
        y: c.y - def.hit.h / 2,
        w: def.hit.w,
        h: def.hit.h,
      };
      expect(inside(f, { x: plate.x, y: plate.y, w: plate.w, h: plate.h }), id).toBe(true);
    }
  });

  it('the dimmer knobs keep their positions', () => {
    for (const [id, x, y] of [
      ['sw.instr_light', 1047, 238],
      ['sw.flood_light', 1126, 238],
    ] as const) {
      const def = DA50RG.get(id);
      if (def === undefined) throw new Error(`no ${id}`);
      expect(globalCentre(def)).toEqual({ x, y });
    }
  });
});

// Owner finding G-1: the upper block of the de-ice unit. Three lamps stand between the mode toggle
// and the guarded ALTERNATE switch, top to bottom amber, amber, white, all inside region deice and
// clear of every control footprint of that region (local coordinates, same region).
describe('de-ice upper block (plan 21, G-1)', () => {
  const LAMP_IDS = ['lt.deice_max', 'lt.deice_high', 'lt.deice_norm'] as const;
  const lamp = (id: string) => {
    const d = DA50RG_INDICATORS.get(id);
    if (d === undefined) throw new Error(`no lamp ${id}`);
    return d;
  };
  const bezel = (id: string): Rect => {
    const d = lamp(id);
    const reach = d.r + BEZEL_EXTRA;
    return { x: d.x - reach, y: d.y - reach, w: 2 * reach, h: 2 * reach };
  };

  it('has three lamps of r 15 with no caption, amber, amber, white from the top', () => {
    expect(LAMP_IDS.map((id) => lamp(id).colour)).toEqual(['amber', 'amber', 'white']);
    for (const id of LAMP_IDS) {
      expect(lamp(id).r, id).toBe(15);
      expect(lamp(id).caption, id).toBe('none');
      expect(lamp(id).region, id).toBe('deice');
    }
  });

  it('stacks the lamps top to bottom in one column with their bezels apart', () => {
    const [a, b, c] = LAMP_IDS.map((id) => lamp(id));
    expect(a?.x).toBe(b?.x);
    expect(b?.x).toBe(c?.x);
    expect(a?.y ?? 0).toBeLessThan(b?.y ?? 0);
    expect(b?.y ?? 0).toBeLessThan(c?.y ?? 0);
    expect(overlaps(bezel('lt.deice_max'), bezel('lt.deice_high'))).toBe(false);
    expect(overlaps(bezel('lt.deice_high'), bezel('lt.deice_norm'))).toBe(false);
  });

  it('keeps every lamp bezel inside region deice and off every control footprint of it', () => {
    const region = regionBounds('deice');
    const local: Rect = { x: 0, y: 0, w: region.w, h: region.h };
    const controls = DA50RG.controls.filter((c) => c.region === 'deice');
    expect(controls.length).toBeGreaterThanOrEqual(3);
    for (const id of LAMP_IDS) {
      expect(inside(bezel(id), local), `${id} inside the region`).toBe(true);
      for (const c of controls) {
        expect(overlaps(bezel(id), footprint(c)), `${id} over ${c.id}`).toBe(false);
        if (c.kind === 'guard') {
          const open: Rect = {
            x: c.x + c.openHit.x,
            y: c.y + c.openHit.y,
            w: c.openHit.w,
            h: c.openHit.h,
          };
          expect(overlaps(bezel(id), open), `${id} over the open guard`).toBe(false);
        }
      }
    }
  });
});

// Owner finding G-1, plan 22: the lower row, the ALTERNATE switch with its stacked letters and the
// framed heading, all global units, all on the de-ice plate and clear of each other.
describe('de-ice unit, lower row, ALTERNATE and heading (plan 22, G-1)', () => {
  const plate = PLATES.find((p) => p.id === 'deice');
  const globalFootprint = (id: string): Rect => {
    const def = DA50RG.get(id);
    if (def === undefined) throw new Error(`no control ${id}`);
    const c = globalCentre(def);
    return { x: c.x - def.hit.w / 2, y: c.y - def.hit.h / 2, w: def.hit.w, h: def.hit.h };
  };
  /** Glyph box of one placard line: width 0.62 of the size per character, cap height 0.7. */
  const lineBoxes = (near: string): Rect[] =>
    PLACARDS.filter((p) => p.near === near).flatMap((p) => {
      const def = DA50RG.get(near);
      if (def === undefined) throw new Error(`no control ${near}`);
      const c = globalCentre(def);
      return p.lines.map((line, i) => {
        const w = line.length * p.size * 0.62;
        const x =
          p.anchor === 'start'
            ? c.x + p.dx
            : p.anchor === 'end'
              ? c.x + p.dx - w
              : c.x + p.dx - w / 2;
        const y = c.y + placardLineY(p, i);
        return { x, y: y - p.size * 0.7, w, h: p.size * 0.7 };
      });
    });
  const DEICE_IDS = [
    'btn.deice_max',
    'sw.deice_mode',
    'sw.deice_alternate',
    'btn.deice_windshield',
    'sw.deice_ice_light',
    'sw.deice_pump',
  ];

  it('the lower row is exactly the WIND SHIELD button, the ICE LIGHT toggle and the PUMP toggle', () => {
    const lower = DA50RG.controls.filter((c) => c.region === 'deice_switches').map((c) => c.id);
    expect(new Set(lower)).toEqual(
      new Set(['btn.deice_windshield', 'sw.deice_ice_light', 'sw.deice_pump']),
    );
    const upper = DA50RG.controls.filter((c) => c.region === 'deice').map((c) => c.id);
    expect(new Set(upper)).toEqual(
      new Set(['btn.deice_max', 'sw.deice_mode', 'sw.deice_alternate', 'sw.deice_alternate.guard']),
    );
  });

  it('the three lower controls stand left to right on one row, 12 units either way', () => {
    const [w, i, p] = ['btn.deice_windshield', 'sw.deice_ice_light', 'sw.deice_pump'].map((id) =>
      globalCentre(DA50RG.get(id) as ControlDef),
    );
    expect(w?.x ?? 0).toBeLessThan(i?.x ?? 0);
    expect(i?.x ?? 0).toBeLessThan(p?.x ?? 0);
    expect(Math.abs((w?.y ?? 0) - (i?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((i?.y ?? 0) - (p?.y ?? 0))).toBeLessThanOrEqual(1);
  });

  it('every de-ice footprint lies on the de-ice plate', () => {
    expect(plate).toBeDefined();
    if (plate === undefined) return;
    for (const id of DEICE_IDS) {
      expect(inside(globalFootprint(id), plate), id).toBe(true);
    }
  });

  it('the lifted guard is a flap at global y 214 to 246 above the footprint, inside the region and on the plate', () => {
    const alt = DA50RG.get('sw.deice_alternate.guard');
    if (alt?.kind !== 'guard') throw new Error('no guard');
    const c = globalCentre(alt);
    const flap: Rect = {
      x: c.x + alt.openHit.x,
      y: c.y + alt.openHit.y,
      w: alt.openHit.w,
      h: alt.openHit.h,
    };
    expect([flap.y, flap.y + flap.h]).toEqual([214, 246]);
    expect(flap.y + flap.h).toBeLessThanOrEqual(globalFootprint('sw.deice_alternate').y);
    expect(inside(flap, regionBounds('deice'))).toBe(true);
    if (plate !== undefined) expect(inside(flap, plate)).toBe(true);
    for (const id of DEICE_IDS) expect(overlaps(flap, globalFootprint(id)), id).toBe(false);
  });

  it('the stacked ALTERNATE letters stand left of the guard, lie in the region and touch no footprint, lamp or flap', () => {
    const letters = lineBoxes('sw.deice_alternate');
    expect(letters).toHaveLength(9);
    const region = regionBounds('deice');
    for (const [i, box] of letters.entries()) {
      expect(inside(box, region), `letter ${i} in the region`).toBe(true);
      if (plate !== undefined) expect(inside(box, plate), `letter ${i} on the plate`).toBe(true);
      for (const id of DEICE_IDS)
        expect(overlaps(box, globalFootprint(id)), `letter ${i} / ${id}`).toBe(false);
      for (const lamp of ['lt.deice_max', 'lt.deice_high', 'lt.deice_norm']) {
        const d = DA50RG_INDICATORS.get(lamp);
        if (d === undefined) throw new Error(lamp);
        const reach = d.r + BEZEL_EXTRA;
        const bezel: Rect = {
          x: region.x + d.x - reach,
          y: region.y + d.y - reach,
          w: 2 * reach,
          h: 2 * reach,
        };
        expect(overlaps(box, bezel), `letter ${i} / ${lamp}`).toBe(false);
      }
    }
    // One column, centred on the height of the switch, 7.2 apart.
    const alt = globalCentre(DA50RG.get('sw.deice_alternate') as ControlDef);
    const xs = new Set(letters.map((b) => b.x + b.w / 2));
    expect(xs.size).toBe(1);
    expect([...xs][0]).toBeLessThan(alt.x - 26);
    const mid = (letters[0]!.y + letters[8]!.y + letters[8]!.h) / 2;
    expect(Math.abs(mid - alt.y)).toBeLessThanOrEqual(6);
    for (let i = 1; i < letters.length; i++) {
      expect((letters[i]!.y - letters[i - 1]!.y).toFixed(1)).toBe('7.2');
    }
  });

  it('the DE ICE heading frame overlaps no footprint, lamp, flap, MAX label or placard', () => {
    const [heading] = PLATE_HEADINGS;
    if (heading === undefined) throw new Error('no heading');
    const frame: Rect = { x: heading.x, y: heading.y, w: heading.w, h: heading.h };
    const region = regionBounds('deice');
    for (const id of DEICE_IDS) expect(overlaps(frame, globalFootprint(id)), id).toBe(false);
    const alt = DA50RG.get('sw.deice_alternate.guard');
    if (alt?.kind !== 'guard') throw new Error('no guard');
    const c = globalCentre(alt);
    const flap: Rect = {
      x: c.x + alt.openHit.x,
      y: c.y + alt.openHit.y,
      w: alt.openHit.w,
      h: alt.openHit.h,
    };
    expect(overlaps(frame, flap)).toBe(false);
    for (const lamp of ['lt.deice_max', 'lt.deice_high', 'lt.deice_norm']) {
      const d = DA50RG_INDICATORS.get(lamp);
      if (d === undefined) throw new Error(lamp);
      const reach = d.r + BEZEL_EXTRA;
      const bezel: Rect = {
        x: region.x + d.x - reach,
        y: region.y + d.y - reach,
        w: 2 * reach,
        h: 2 * reach,
      };
      expect(overlaps(frame, bezel), lamp).toBe(false);
    }
    // The MAX label above its button.
    const max = DA50RG.get('btn.deice_max');
    if (max?.kind !== 'momentary-button') throw new Error('no MAX');
    const mc = globalCentre(max);
    const layout = buttonTextLayout(max, BEZEL_RADIUS['black-dome']);
    layout.labelLines.forEach((line, i) => {
      const w = textWidth(line, layout.labelSize);
      const label: Rect = {
        x: mc.x - w / 2,
        y: mc.y + (layout.labelYs[i] ?? 0) - layout.labelSize * 0.75,
        w,
        h: layout.labelSize * 0.95,
      };
      expect(overlaps(frame, label), 'MAX label').toBe(false);
    });
    for (const p of PLACARDS) {
      for (const box of lineBoxes(p.near)) expect(overlaps(frame, box), p.id).toBe(false);
    }
  });

  it('every de-ice placard lies inside its region or the plate and clear of every other footprint', () => {
    const owners = ['sw.deice_mode', 'sw.deice_ice_light', 'sw.deice_pump'];
    for (const near of owners) {
      for (const box of lineBoxes(near)) {
        if (plate !== undefined) expect(inside(box, plate), near).toBe(true);
        for (const id of DEICE_IDS) {
          // A placard may stand over the hit of the toggle it names, never over another control.
          if (id === near) continue;
          expect(overlaps(box, globalFootprint(id)), `${near} placard / ${id}`).toBe(false);
        }
      }
    }
  });
});

// Owner finding R2-5.2, plan 29: the engine strip as in the aircraft. The FADEC group (heading with
// a curved bracket line, AUTO above and FORCE B below the switch, TEST above the button) and the
// ALTERNATOR group (plan 29, task 2) are plate text; the parts print nothing. Global units.
describe('engine strip labels (plan 29, R2-5.2)', () => {
  const plate = PLATES.find((p) => p.id === 'engine');
  const STRIP_IDS = ['sw.fadec', 'btn.fadec_test', 'sw.alternator_1', 'sw.alternator_2'];
  const globalFootprint = (id: string): Rect => {
    const def = DA50RG.get(id);
    if (def === undefined) throw new Error(`no control ${id}`);
    const c = globalCentre(def);
    return { x: c.x - def.hit.w / 2, y: c.y - def.hit.h / 2, w: def.hit.w, h: def.hit.h };
  };
  /** Glyph boxes of the placards of one control: 0.62 of the size per character, cap height 0.7. */
  const placardBoxes = (near: string): { id: string; box: Rect }[] =>
    PLACARDS.filter((p) => p.near === near).flatMap((p) => {
      const def = DA50RG.get(near);
      if (def === undefined) throw new Error(`no control ${near}`);
      const c = globalCentre(def);
      return p.lines.map((line, i) => {
        const w = line.length * p.size * 0.62;
        const x =
          p.anchor === 'start'
            ? c.x + p.dx
            : p.anchor === 'end'
              ? c.x + p.dx - w
              : c.x + p.dx - w / 2;
        const y = c.y + placardLineY(p, i);
        return { id: p.id, box: { x, y: y - p.size * 0.7, w, h: p.size * 0.7 } };
      });
    });
  const titleBox = (id: string): Rect => {
    const g = BRACKET_GROUPS.find((b) => b.id === id);
    if (g === undefined) throw new Error(`no bracket group ${id}`);
    const w = glyphWidth(g.title, g.size);
    return {
      x: (g.x1 + g.x2) / 2 - w / 2,
      y: g.y + BRACKET_TITLE_DROP - g.size * 0.7,
      w,
      h: g.size * 0.7,
    };
  };
  /** The two stubs of a bracket group as thin boxes (stroke 1). */
  const stubBoxes = (id: string): Rect[] => {
    const g = BRACKET_GROUPS.find((b) => b.id === id);
    if (g === undefined) throw new Error(`no bracket group ${id}`);
    return [g.x1, g.x2].map((x) => ({ x: x - 0.5, y: g.y, w: 1, h: g.drop }));
  };

  it('the four strip controls keep their reference positions, none moved', () => {
    for (const id of STRIP_IDS) {
      const ref = REFERENCE_POSITIONS.find((r) => r.id === id);
      const def = DA50RG.get(id);
      if (ref === undefined || def === undefined) throw new Error(id);
      const c = globalCentre(def);
      expect(Math.abs(c.x - ref.x), `${id} x`).toBeLessThanOrEqual(ref.tol);
      expect(Math.abs(c.y - ref.y), `${id} y`).toBeLessThanOrEqual(ref.tol);
    }
  });

  it('sw.fadec orders force_b then auto, defaults to auto and draws the default as the upper position', () => {
    const def = DA50RG.get('sw.fadec');
    if (def?.kind !== 'toggle') throw new Error('no FADEC switch');
    expect(def.states.map((st) => st.id)).toEqual(['force_b', 'auto']);
    expect(def.default).toBe('auto');
    const index = def.states.findIndex((st) => st.id === def.default);
    expect(togglePosition(index, def.states.length)).toBe('high');
    expect(def.nameless).toBe(true);
    const test = DA50RG.get('btn.fadec_test');
    expect(test?.nameless).toBe(true);
  });

  it('AUTO stands above FORCE B, both centred on the switch; TEST is centred on the button', () => {
    const [auto] = placardBoxes('sw.fadec').filter((b) => b.id === 'fadec.auto');
    const [force] = placardBoxes('sw.fadec').filter((b) => b.id === 'fadec.force_b');
    const [test] = placardBoxes('btn.fadec_test').filter((b) => b.id === 'fadec.test');
    if (auto === undefined || force === undefined || test === undefined) throw new Error('missing');
    expect(auto.box.y + auto.box.h).toBeLessThan(force.box.y);
    const sw = globalFootprint('sw.fadec');
    const btn = globalFootprint('btn.fadec_test');
    expect(auto.box.x + auto.box.w / 2).toBeCloseTo(sw.x + sw.w / 2, 5);
    expect(force.box.x + force.box.w / 2).toBeCloseTo(sw.x + sw.w / 2, 5);
    expect(test.box.x + test.box.w / 2).toBeCloseTo(btn.x + btn.w / 2, 5);
    // The words match the drawn heights of the handle: AUTO above its tip, FORCE B below its tip.
    const pivot = sw.y + sw.h / 2 + 4.5;
    expect(auto.box.y + auto.box.h).toBeLessThanOrEqual(pivot - 14);
    expect(force.box.y).toBeGreaterThanOrEqual(pivot + 14);
  });

  it('every FADEC glyph box lies on the engine plate and overlaps no other glyph box or stub', () => {
    if (plate === undefined) throw new Error('no engine plate');
    const boxes: { name: string; box: Rect }[] = [
      ...placardBoxes('sw.fadec').map((b) => ({ name: b.id, box: b.box })),
      ...placardBoxes('btn.fadec_test').map((b) => ({ name: b.id, box: b.box })),
      { name: 'title FADEC', box: titleBox('fadec') },
    ];
    expect(boxes).toHaveLength(4);
    for (const { name, box } of boxes) expect(inside(box, plate), name).toBe(true);
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        expect(overlaps(a.box, b.box), `${a.name} / ${b.name}`).toBe(false);
      }
      for (const stub of stubBoxes('fadec')) expect(overlaps(a.box, stub), a.name).toBe(false);
    }
  });

  it('AUTO, FORCE B and TEST cover no footprint other than the one of the control they name', () => {
    for (const near of ['sw.fadec', 'btn.fadec_test']) {
      for (const { id, box } of placardBoxes(near)) {
        for (const other of STRIP_IDS) {
          if (other === near) continue;
          expect(overlaps(box, globalFootprint(other)), `${id} / ${other}`).toBe(false);
        }
      }
    }
  });

  it('the FADEC bracket and its stubs lie on the engine plate', () => {
    const g = BRACKET_GROUPS.find((b) => b.id === 'fadec');
    if (g === undefined || plate === undefined) throw new Error('no FADEC bracket');
    expect(g.plate).toBe('engine');
    const hull: Rect = { x: g.x1 - 0.5, y: g.y - 0.5, w: g.x2 - g.x1 + 1, h: g.drop + 1 };
    expect(inside(hull, plate)).toBe(true);
    expect(g.title).toBe('FADEC');
  });

  it('the bracket path runs stub bottom to stub bottom with two corner arcs and a gap wider than the title', () => {
    for (const g of BRACKET_GROUPS) {
      const d = bracketPath(g);
      expect(d.startsWith(`M${g.x1} ${g.y + g.drop}`), g.id).toBe(true);
      expect(d.endsWith(`${g.x2} ${g.y + g.radius}V${g.y + g.drop}`), g.id).toBe(true);
      expect(d.match(/A/g), g.id).toHaveLength(2);
      expect(d, g.id).toContain(`A${g.radius} ${g.radius} 0 0 1`);
      const left = /H([\d.]+)M([\d.]+) /.exec(d);
      if (left === null) throw new Error(`no gap in ${d}`);
      const gap = Number(left[2]) - Number(left[1]);
      expect(gap, g.id).toBeGreaterThanOrEqual(glyphWidth(g.title, g.size) + 6 - 1e-9);
      // Centred between the stubs.
      expect((Number(left[1]) + Number(left[2])) / 2, g.id).toBeCloseTo((g.x1 + g.x2) / 2, 5);
    }
  });
});
