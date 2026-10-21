import { describe, expect, it } from 'vitest';
import {
  BUS_ORDER,
  BUS_OUTLINES,
  BUS_PLUGS,
  BUS_PUMP_BOXES,
  BUS_SUBPANEL,
  BUS_CORNER_RADIUS,
  BUS_TITLES,
  BUS_TITLE_STYLE,
  busTitleCut,
} from '../src/aircraft/da50rg/bus-boxes';
import type { BusId } from '../src/aircraft/da50rg/bus-boxes';
import { CB_REGIONS } from '../src/aircraft/da50rg/controls/breakers';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { PLATES } from '../src/aircraft/da50rg/plates';
import type { CircuitBreakerDef } from '../src/engine/registry';

// D-01: the bus panel art is data. The vertex tables below are typed in as literals (UI-SPEC 01.2
// Table B3), independent of the data file, so a moved corner fails here.

interface Pt {
  readonly x: number;
  readonly y: number;
}

const EXPECTED_OUTLINES: Readonly<Record<BusId, readonly (readonly [number, number])[]>> = {
  essential: [
    [1888, 223],
    [2104, 223],
    [2104, 319],
    [1996, 319],
    [1996, 375],
    [1888, 375],
  ],
  main: [
    [1996, 319],
    [2140, 319],
    [2140, 426],
    [2032, 426],
    [2032, 477],
    [1888, 477],
    [1888, 375],
    [1996, 375],
  ],
  avionics: [
    [2032, 426],
    [2140, 426],
    [2140, 531],
    [1888, 531],
    [1888, 477],
    [2032, 477],
  ],
};

const EXPECTED_TITLES = [
  { bus: 'essential', text: 'ESSENTIAL BUS', x: 1996, y: 226 },
  { bus: 'main', text: 'MAIN BUS', x: 1924, y: 378 },
  { bus: 'avionics', text: 'AVIONICS BUS', x: 1960, y: 480 },
] as const;

const plate = PLATES.find((p) => p.id === 'bus-panel');

function insidePlate(pt: Pt): boolean {
  if (plate === undefined) return false;
  return (
    pt.x >= plate.x && pt.x <= plate.x + plate.w && pt.y >= plate.y && pt.y <= plate.y + plate.h
  );
}

describe('bus panel outlines (D-01, Table B3)', () => {
  it('has the three buses in drawing order', () => {
    expect([...BUS_ORDER]).toEqual(['essential', 'main', 'avionics']);
  });

  it.each(BUS_ORDER)('the %s outline equals the Table B3 vertices', (bus) => {
    expect(BUS_OUTLINES[bus].map((p) => [p.x, p.y])).toEqual(EXPECTED_OUTLINES[bus]);
  });

  it.each(BUS_ORDER)('the %s outline has at least four vertices', (bus) => {
    expect(BUS_OUTLINES[bus].length).toBeGreaterThanOrEqual(4);
  });

  it.each(BUS_ORDER)('every edge of the %s outline is horizontal or vertical', (bus) => {
    const pts = BUS_OUTLINES[bus];
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      if (b === undefined) throw new Error('no next vertex');
      expect(a.x === b.x || a.y === b.y, `${bus} edge ${i}`).toBe(true);
      expect(a.x === b.x && a.y === b.y, `${bus} edge ${i} has length`).toBe(false);
    });
  });

  it.each(BUS_ORDER)('every vertex of the %s outline lies inside the bus-panel plate', (bus) => {
    expect(plate).toBeDefined();
    for (const p of BUS_OUTLINES[bus]) expect(insidePlate(p), `${bus} ${p.x},${p.y}`).toBe(true);
  });
});

describe('bus panel titles (D-01)', () => {
  it('are ESSENTIAL BUS, MAIN BUS and AVIONICS BUS at the Table B3 anchors', () => {
    expect(BUS_TITLES.map((t) => ({ bus: t.bus, text: t.text, x: t.x, y: t.y }))).toEqual(
      EXPECTED_TITLES,
    );
  });

  it.each(EXPECTED_TITLES)('the $text title sits on a horizontal edge of its own outline', (t) => {
    const title = BUS_TITLES.find((x) => x.bus === t.bus);
    expect(title).toBeDefined();
    if (title === undefined) return;
    const pts = BUS_OUTLINES[title.bus];
    const edges = pts.flatMap((a, i) => {
      const b = pts[(i + 1) % pts.length];
      if (b === undefined || a.y !== b.y) return [];
      return [{ y: a.y, x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x) }];
    });
    const hit = edges.filter(
      (e) => title.y >= e.y && title.y - e.y <= 4 && title.x >= e.x1 && title.x <= e.x2,
    );
    expect(hit.length).toBeGreaterThanOrEqual(1);
  });
});

// R3-1.1 (owner finding, iPhone Safari): the titles are unstroked text and the edge behind each is
// cut by a plate-coloured rectangle. Table B4 expected widths are typed in here: six units per
// character plus eight.
describe('bus panel title cuts (R3-1.1, Table B4)', () => {
  const FONT_SIZE = 8;
  const EXPECTED_WIDTH: Readonly<Record<BusId, number>> = {
    essential: 86,
    main: 56,
    avionics: 80,
  };

  /** Horizontal edges of an outline that carry the title: the one at most 4 above the baseline. */
  function ownEdge(bus: BusId): { y: number; x1: number; x2: number } {
    const title = BUS_TITLES.find((t) => t.bus === bus);
    if (title === undefined) throw new Error(`no title for ${bus}`);
    const pts = BUS_OUTLINES[bus];
    const edges = pts.flatMap((a, i) => {
      const b = pts[(i + 1) % pts.length];
      if (b === undefined || a.y !== b.y) return [];
      return [{ y: a.y, x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x) }];
    });
    const hit = edges.find(
      (e) => title.y >= e.y && title.y - e.y <= 4 && title.x >= e.x1 && title.x <= e.x2,
    );
    if (hit === undefined) throw new Error(`no edge for ${bus}`);
    return hit;
  }

  const titleOf = (bus: BusId) => {
    const t = BUS_TITLES.find((x) => x.bus === bus);
    if (t === undefined) throw new Error(`no title for ${bus}`);
    return t;
  };

  it('the title style has a fill and the plate colour and no stroke width', () => {
    expect(BUS_TITLE_STYLE.fill).toBe('#c9d0d8');
    expect(Object.keys(BUS_TITLE_STYLE).sort()).toEqual(['cut', 'fill']);
  });

  it.each(BUS_ORDER)('the %s cut is as wide as Table B4 says', (bus) => {
    expect(busTitleCut(titleOf(bus)).w).toBe(EXPECTED_WIDTH[bus]);
  });

  it.each(BUS_ORDER)('the %s cut contains the edge line with 2 units to each side', (bus) => {
    const cut = busTitleCut(titleOf(bus));
    const edge = ownEdge(bus);
    expect(edge.y - cut.y).toBeGreaterThanOrEqual(2);
    expect(cut.y + cut.h - edge.y).toBeGreaterThanOrEqual(2);
  });

  it.each(BUS_ORDER)('the %s cut is centred on the title anchor', (bus) => {
    const t = titleOf(bus);
    const cut = busTitleCut(t);
    expect(cut.x + cut.w / 2).toBe(t.x);
  });

  it.each(BUS_ORDER)('the %s cut is wider than the glyph estimate by at least 6', (bus) => {
    const t = titleOf(bus);
    const glyphs = t.text.length * 0.62 * FONT_SIZE;
    expect(busTitleCut(t).w).toBeGreaterThanOrEqual(glyphs + 6);
  });

  it.each(BUS_ORDER)('the %s cut touches no corner of its outline', (bus) => {
    const cut = busTitleCut(titleOf(bus));
    const edge = ownEdge(bus);
    expect(cut.x).toBeGreaterThanOrEqual(edge.x1 + BUS_CORNER_RADIUS + 2);
    expect(cut.x + cut.w).toBeLessThanOrEqual(edge.x2 - BUS_CORNER_RADIUS - 2);
  });

  it.each(BUS_ORDER)('the %s cut lies inside the bus-panel plate', (bus) => {
    const cut = busTitleCut(titleOf(bus));
    expect(plate).toBeDefined();
    if (plate === undefined) return;
    expect(cut.x).toBeGreaterThanOrEqual(plate.x);
    expect(cut.y).toBeGreaterThanOrEqual(plate.y);
    expect(cut.x + cut.w).toBeLessThanOrEqual(plate.x + plate.w);
    expect(cut.y + cut.h).toBeLessThanOrEqual(plate.y + plate.h);
  });

  it.each(BUS_ORDER)('the %s cut overlaps no breaker hit rectangle and no plug disc', (bus) => {
    const cut = busTitleCut(titleOf(bus));
    const breakers = DA50RG.controls.filter(
      (c): c is CircuitBreakerDef => c.kind === 'circuit-breaker',
    );
    expect(breakers.length).toBeGreaterThan(30);
    for (const b of breakers) {
      const region = DA50RG.regions.find((r) => r.id === b.region);
      if (region === undefined) throw new Error(`no region ${b.region}`);
      const foot = {
        x: region.bounds.x + b.x - b.hit.w / 2,
        y: region.bounds.y + b.y - b.hit.h / 2,
        w: b.hit.w,
        h: b.hit.h,
      };
      expect(overlapArea(cut, foot), `${bus} cut and ${b.id}`).toBe(0);
    }
    for (const p of BUS_PLUGS) {
      const nearX = Math.min(Math.max(p.x, cut.x), cut.x + cut.w);
      const nearY = Math.min(Math.max(p.y, cut.y), cut.y + cut.h);
      expect(Math.hypot(p.x - nearX, p.y - nearY), `${bus} cut and ${p.id}`).toBeGreaterThan(p.r);
    }
  });
});

// Table B3: pump boxes, lower-row sub-panel and blank plugs, typed in as literals.

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const overlapArea = (a: Box, b: Box): number => {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

/** Point in a rectilinear polygon, boundary inclusive. */
function inPolygon(pt: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    if (b === undefined) return;
    const onEdge =
      a.x === b.x
        ? pt.x === a.x && pt.y >= Math.min(a.y, b.y) && pt.y <= Math.max(a.y, b.y)
        : pt.y === a.y && pt.x >= Math.min(a.x, b.x) && pt.x <= Math.max(a.x, b.x);
    if (onEdge) inside = true;
  });
  if (inside) return true;
  let crossings = 0;
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    if (b === undefined || a.x !== b.x) return;
    const lo = Math.min(a.y, b.y);
    const hi = Math.max(a.y, b.y);
    if (a.x > pt.x && pt.y >= lo && pt.y < hi) crossings += 1;
  });
  return crossings % 2 === 1;
}

/** Distance from a point to the nearest outline edge. */
function edgeDistance(pt: Pt, poly: readonly Pt[]): number {
  let best = Infinity;
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    if (b === undefined) return;
    const cx = Math.min(Math.max(pt.x, Math.min(a.x, b.x)), Math.max(a.x, b.x));
    const cy = Math.min(Math.max(pt.y, Math.min(a.y, b.y)), Math.max(a.y, b.y));
    best = Math.min(best, Math.hypot(pt.x - cx, pt.y - cy));
  });
  return best;
}

describe('bus panel pump boxes (D-01, Table B3)', () => {
  const EXPECTED: readonly (readonly [string, Box])[] = [
    ['EMERG PUMP', { x: 2106, y: 275, w: 32, h: 44 }],
    ['MAIN PUMP', { x: 2106, y: 319, w: 32, h: 44 }],
    ['XFR PUMP', { x: 2106, y: 382, w: 32, h: 44 }],
  ];

  it('are the three Table B3 rectangles', () => {
    expect(BUS_PUMP_BOXES.map((b) => [b.name, { x: b.x, y: b.y, w: b.w, h: b.h }])).toEqual(
      EXPECTED,
    );
    for (const b of BUS_PUMP_BOXES) expect(b.rx).toBe(3);
  });

  it('do not overlap each other with positive area (touching is allowed)', () => {
    for (let i = 0; i < BUS_PUMP_BOXES.length; i++) {
      for (let j = i + 1; j < BUS_PUMP_BOXES.length; j++) {
        const a = BUS_PUMP_BOXES[i];
        const b = BUS_PUMP_BOXES[j];
        if (a === undefined || b === undefined) continue;
        expect(overlapArea(a, b), `${a.name} / ${b.name}`).toBe(0);
      }
    }
  });

  it('EMERG PUMP stands right of the ESSENTIAL outline within its vertical range', () => {
    const box = BUS_PUMP_BOXES.find((b) => b.name === 'EMERG PUMP');
    expect(box).toBeDefined();
    if (box === undefined) return;
    const xs = BUS_OUTLINES.essential.map((p) => p.x);
    const ys = BUS_OUTLINES.essential.map((p) => p.y);
    expect(box.x).toBeGreaterThanOrEqual(Math.max(...xs));
    expect(box.y).toBeGreaterThanOrEqual(Math.min(...ys));
    expect(box.y + box.h).toBeLessThanOrEqual(Math.max(...ys));
    // 275 to 319 against 223 to 319.
    expect([box.y, box.y + box.h]).toEqual([275, 319]);
  });

  it('MAIN PUMP and XFR PUMP lie inside the MAIN outline', () => {
    for (const name of ['MAIN PUMP', 'XFR PUMP']) {
      const box = BUS_PUMP_BOXES.find((b) => b.name === name);
      expect(box, name).toBeDefined();
      if (box === undefined) continue;
      for (const corner of [
        { x: box.x, y: box.y },
        { x: box.x + box.w, y: box.y },
        { x: box.x, y: box.y + box.h },
        { x: box.x + box.w, y: box.y + box.h },
      ]) {
        expect(inPolygon(corner, BUS_OUTLINES.main), `${name} ${corner.x},${corner.y}`).toBe(true);
      }
    }
  });
});

describe('bus panel lower-row sub-panel (D-01, Table B3)', () => {
  it('is the Table B3 rectangle', () => {
    expect([BUS_SUBPANEL.x, BUS_SUBPANEL.y, BUS_SUBPANEL.w, BUS_SUBPANEL.h]).toEqual([
      1878, 642, 272, 68,
    ]);
    expect(BUS_SUBPANEL.rx).toBe(4);
  });

  it('lies inside the plate, below the AVIONICS outline, and contains the whole cb_low region', () => {
    expect(plate).toBeDefined();
    if (plate === undefined) return;
    expect(BUS_SUBPANEL.x).toBeGreaterThanOrEqual(plate.x);
    expect(BUS_SUBPANEL.y).toBeGreaterThanOrEqual(plate.y);
    expect(BUS_SUBPANEL.x + BUS_SUBPANEL.w).toBeLessThanOrEqual(plate.x + plate.w);
    expect(BUS_SUBPANEL.y + BUS_SUBPANEL.h).toBeLessThanOrEqual(plate.y + plate.h);
    expect(BUS_SUBPANEL.y).toBeGreaterThan(Math.max(...BUS_OUTLINES.avionics.map((p) => p.y)));
    const low = CB_REGIONS.find((r) => r.id === 'cb_low');
    expect(low).toBeDefined();
    if (low === undefined) return;
    expect(low.bounds.x).toBeGreaterThanOrEqual(BUS_SUBPANEL.x);
    expect(low.bounds.y).toBeGreaterThanOrEqual(BUS_SUBPANEL.y);
    expect(low.bounds.x + low.bounds.w).toBeLessThanOrEqual(BUS_SUBPANEL.x + BUS_SUBPANEL.w);
    expect(low.bounds.y + low.bounds.h).toBeLessThanOrEqual(BUS_SUBPANEL.y + BUS_SUBPANEL.h);
  });
});

describe('bus panel blank plugs (D-01, Table B3)', () => {
  it('are three plugs of radius 11 at the Table B3 centres with their printed labels', () => {
    expect(BUS_PLUGS.map((p) => [p.x, p.y, p.r, [...p.labelLines]])).toEqual([
      [1978, 349, 11, []],
      [2086, 456, 11, ['ADF']],
      [2122, 514, 11, ['DATA', 'LINK']],
    ]);
  });

  it('the first plug is inside ESSENTIAL, the other two inside AVIONICS, whole discs', () => {
    const buses = BUS_PLUGS.map((p) => p.bus);
    expect(buses).toEqual(['essential', 'avionics', 'avionics']);
    for (const p of BUS_PLUGS) {
      const poly = BUS_OUTLINES[p.bus];
      expect(inPolygon(p, poly), p.id).toBe(true);
      expect(edgeDistance(p, poly), `${p.id} clears the edges`).toBeGreaterThanOrEqual(p.r);
    }
  });

  it('every plug lies inside the bus-panel plate and carries no control id', () => {
    expect(plate).toBeDefined();
    for (const p of BUS_PLUGS) {
      expect(insidePlate(p), p.id).toBe(true);
      expect(p.id.startsWith('cb.'), p.id).toBe(false);
    }
  });
});
