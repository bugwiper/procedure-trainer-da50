import { describe, expect, it } from 'vitest';
import { DA50RG_INDICATORS } from '../src/aircraft/da50rg/indicators';
import { DA50RG, VIEWBOX } from '../src/aircraft/da50rg/panel';
import { PLATES } from '../src/aircraft/da50rg/plates';
import { BEZEL_EXTRA } from '../src/engine/indicators';
import type { ControlDef, Rect } from '../src/engine/registry';
import {
  FRONT_PANEL_REGIONS,
  INDICATOR_POSITIONS,
  ORDERING,
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
  it('uses the true panel proportions (D-21)', () => {
    expect(VIEWBOX).toEqual({ w: 2000, h: 1300 });
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
  const BEZEL = 7 + BEZEL_EXTRA;

  it('every lamp bezel disc lies inside its region', () => {
    for (const lamp of DA50RG_INDICATORS.indicators) {
      const b = regionBounds(lamp.region);
      expect(lamp.r + BEZEL_EXTRA, `${lamp.id} bezel`).toBe(BEZEL);
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
        expect(distance, `${lamp.id} / ${id}`).toBeGreaterThanOrEqual(BEZEL);
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
  /** Regions rebuilt by plans 17 to 22; their footprints are checked once those plans land. */
  const FOOTPRINT_KNOWN_OPEN: readonly string[] = [
    'landing_gear',
    'right_panel',
    'env_control',
    'deice',
    'deice_switches',
  ];

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
      for (const p of PLATES) expect(overlaps(rectOf(p), bezel), `${p.id} / ${id}`).toBe(false);
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
