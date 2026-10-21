import { describe, expect, it } from 'vitest';
import { BUS_ORDER, BUS_OUTLINES, BUS_TITLES } from '../src/aircraft/da50rg/bus-boxes';
import type { BusId } from '../src/aircraft/da50rg/bus-boxes';
import { PLATES } from '../src/aircraft/da50rg/plates';

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
