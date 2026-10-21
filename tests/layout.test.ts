import { describe, expect, it } from 'vitest';
import { DA50RG_INDICATORS } from '../src/aircraft/da50rg/indicators';
import { DA50RG, VIEWBOX } from '../src/aircraft/da50rg/panel';
import { PLACARDS, placardLineY } from '../src/aircraft/da50rg/placards';
import { GEAR_BLOCK, PLATES, PLATE_HEADINGS } from '../src/aircraft/da50rg/plates';
import { BEZEL_EXTRA } from '../src/engine/indicators';
import type { ControlDef, Rect } from '../src/engine/registry';
import { BEZEL_RADIUS, buttonTextLayout, textWidth } from '../src/ui/panel/skins/PushButton';
import {
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
    const rights = DA50RG.regions.filter((r) => r.bounds.x + r.bounds.w > 1980).map((r) => r.id);
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
  for (const { id, x, y, tol, review } of [...REFERENCE_POSITIONS, ...INDICATOR_POSITIONS]) {
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
    const controlRows = REFERENCE_POSITIONS.map((r) => r.id);
    const lampRows = INDICATOR_POSITIONS.map((r) => r.id);
    expect(new Set(controlRows).size, 'duplicate id in REFERENCE_POSITIONS').toBe(
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
    const known = new Set(REFERENCE_POSITIONS.map((r) => r.id));
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
  // Final inventory after the gap-closure plans 12 to 22 (plan 23, Table F1): the de-ice unit lost
  // the lever, the WIND SHIELD toggle, the two PUMP toggles and the ANNUN TEST button and gained the
  // mode toggle, MAX, the WIND SHIELD button and one PUMP toggle (net minus one from 42).
  it('has exactly 41 non-guard controls, 13 lamps and 19 regions', () => {
    expect(DA50RG.controls.filter((c) => c.kind !== 'guard')).toHaveLength(41);
    expect(DA50RG_INDICATORS.indicators).toHaveLength(13);
    expect(DA50RG.regions).toHaveLength(19);
  });

  it('every reference position resolves to a DA50RG control', () => {
    for (const row of REFERENCE_POSITIONS) {
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
  const BEZEL_GROW = 16;
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

  it('no plate overlaps the PFD or MFD bezel (region grown by 16)', () => {
    for (const id of ['pfd', 'mfd']) {
      const b = regionBounds(id);
      const bezel: Rect = {
        x: b.x - BEZEL_GROW,
        y: b.y - BEZEL_GROW,
        w: b.w + 2 * BEZEL_GROW,
        h: b.h + 2 * BEZEL_GROW,
      };
      for (const p of PLATES) {
        // The gear plate runs under the PFD bezel corner (the shell draws it below the bezel,
        // G-2): allowed for that one pair, and only as a sliver of at most 4 units.
        if (p.id === 'strip-gear' && id === 'pfd') {
          expect(p.y + 4, 'strip-gear sliver under the PFD bezel').toBeGreaterThanOrEqual(
            bezel.y + bezel.h,
          );
          continue;
        }
        expect(overlaps(rectOf(p), bezel), `${p.id} / ${id}`).toBe(false);
      }
    }
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
