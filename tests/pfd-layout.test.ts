import { describe, expect, it } from 'vitest';
import {
  ATTITUDE,
  CAS_COLUMN,
  PFD_ZONE,
  ALTITUDE_BLOCK,
  casColumnRows,
} from '../src/aircraft/da50rg/pfd-layout';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { MAX_CAS_CHIPS } from '../src/engine/cas';
import type { PanelBridge } from '../src/ui/bridge';
import { PfdFrame } from '../src/ui/panel/frames/PfdFrame';
import {
  ALTITUDE_READOUT_REF,
  ATTITUDE_REF,
  ALTITUDE_TAPE_REF,
  BARO_BOX_REF,
  CAS_REF,
  COMPASS_BOX_REF,
  GLASS_FONT_SCALE,
  HEADING_BOX_REF,
  INSET_MAP_REF,
  SPEED_TAPE_REF,
  VS_BOX_REF,
  ZONE_MARGIN,
  ZONE_REF,
  insideZone,
  overlaps,
} from './pfd-layout-reference';
import type { RectRef } from './pfd-layout-reference';
import { expand, findElements } from './vnode-walk';
import type { El } from './vnode-walk';

// The PFD layout data against the independent reference (tests/pfd-layout-reference.ts): the zone,
// the moved altitude block as drawn, the CAS column geometry, and the column against every other
// part (inside the zone with a margin, no overlap).

const pfdRegion = DA50RG.regions.find((r) => r.id === 'pfd');
if (pfdRegion === undefined) throw new Error('no pfd region');

const bridge = {
  registry: DA50RG,
  stateOf: () => ({ value: 'map' }),
  quantities: { value: DA50RG_QUANTITIES.baseValues() },
  cas: { value: [] },
} as unknown as PanelBridge;
const tree = expand(PfdFrame({ region: pfdRegion, bridge }));

/** The rectangle of a rect element, read from its attributes. */
function rectOf(el: El | undefined): RectRef {
  if (el === undefined) throw new Error('no element');
  return {
    x: Number(el.props['x']),
    y: Number(el.props['y']),
    w: Number(el.props['width']),
    h: Number(el.props['height']),
  };
}

const byTestId = (id: string): El => {
  const found = findElements(tree, (e) => e.props['data-testid'] === id)[0];
  if (found === undefined) throw new Error(`no element ${id}`);
  return found;
};
const rectsIn = (el: El): El[] => findElements(el, (e) => e.tag === 'rect');

describe('the zone data', () => {
  it('equals the reference zone', () => {
    expect([PFD_ZONE.x0, PFD_ZONE.x1, PFD_ZONE.y0, PFD_ZONE.y1]).toEqual([
      ZONE_REF.x0,
      ZONE_REF.x1,
      ZONE_REF.y0,
      ZONE_REF.y1,
    ]);
  });
});

describe('the attitude centre data', () => {
  it('equals the reference centre and reach', () => {
    expect(ATTITUDE).toEqual(ATTITUDE_REF);
  });

  it('reaches past the zone at the largest pitch shift and a bank turn', () => {
    // Half diagonal of the zone about the centre, plus the pitch shift of 30 degrees (132 units).
    const dx = Math.max(ATTITUDE_REF.cx - ZONE_REF.x0, ZONE_REF.x1 - ATTITUDE_REF.cx);
    const dy = Math.max(ATTITUDE_REF.cy - ZONE_REF.y0, ZONE_REF.y1 - ATTITUDE_REF.cy);
    expect(Math.hypot(dx, dy) + 132).toBeLessThan(ATTITUDE_REF.reach);
  });
});

describe('the altitude block as drawn (moved 50 units left)', () => {
  it('starts at the reference x', () => {
    expect(ALTITUDE_BLOCK.x).toBe(ALTITUDE_TAPE_REF.x);
  });

  it('draws the tape, the readout box, the baro box and the VS box at the reference rectangles', () => {
    const altitude = byTestId('pfd-altitude');
    const [tape, readout] = rectsIn(altitude);
    expect(rectOf(tape)).toEqual(ALTITUDE_TAPE_REF);
    expect(rectOf(readout)).toEqual(ALTITUDE_READOUT_REF);
    const baro = findElements(tree, (e) => 'data-baro-box' in e.props)[0];
    const vs = findElements(tree, (e) => 'data-vs-box' in e.props)[0];
    expect(rectOf(baro)).toEqual(BARO_BOX_REF);
    expect(rectOf(vs)).toEqual(VS_BOX_REF);
  });

  it('leaves the speed tape where it was', () => {
    expect(rectOf(rectsIn(byTestId('pfd-airspeed'))[0])).toEqual(SPEED_TAPE_REF);
  });

  it('leaves the inset map and the heading frame where they were', () => {
    expect(rectOf(findElements(tree, (e) => 'data-inset-map' in e.props)[0])).toEqual(
      INSET_MAP_REF,
    );
    expect(rectOf(rectsIn(byTestId('pfd-heading'))[0])).toEqual(HEADING_BOX_REF);
  });
});

describe('the CAS column data', () => {
  it('equals the reference: x, width, row height, bottom edge and the maximum rows', () => {
    expect(CAS_COLUMN.x).toBe(CAS_REF.x);
    expect(CAS_COLUMN.width).toBe(CAS_REF.width);
    expect(CAS_COLUMN.rowHeight).toBe(CAS_REF.rowHeight);
    expect(CAS_COLUMN.bottom).toBe(CAS_REF.bottom);
    expect(CAS_COLUMN.maxRows).toBe(CAS_REF.maxRows);
    expect(MAX_CAS_CHIPS).toBe(CAS_REF.maxRows);
  });

  it('is about half as wide and much finer than the old chip', () => {
    expect(CAS_COLUMN.width).toBeGreaterThanOrEqual(CAS_REF.widthRange.min);
    expect(CAS_COLUMN.width).toBeLessThanOrEqual(CAS_REF.widthRange.max);
    expect(CAS_COLUMN.width).toBeLessThan(CAS_REF.OLD_CHIP_WIDTH);
    expect(CAS_COLUMN.rowHeight).toBeGreaterThanOrEqual(CAS_REF.rowHeightRange.min);
    expect(CAS_COLUMN.rowHeight).toBeLessThanOrEqual(CAS_REF.rowHeightRange.max);
    expect(CAS_COLUMN.rowHeight).toBeLessThan(CAS_REF.OLD_CHIP_HEIGHT);
  });

  it('sets the type in the smallest size of the glass scale', () => {
    expect(CAS_COLUMN.fontSize).toBe(Math.min(...GLASS_FONT_SCALE));
  });

  it('puts the text baseline inside the row', () => {
    expect(CAS_COLUMN.textBaseline).toBeGreaterThan(0);
    expect(CAS_COLUMN.textBaseline).toBeLessThan(CAS_COLUMN.rowHeight);
  });
});

describe('a full column against the rest of the PFD', () => {
  const rows = casColumnRows(CAS_REF.maxRows);
  const full: RectRef = {
    x: rows[0]?.x ?? Number.NaN,
    y: rows[0]?.y ?? Number.NaN,
    w: rows[0]?.width ?? Number.NaN,
    h: rows.length * CAS_COLUMN.rowHeight,
  };
  const furniture: Record<string, RectRef> = {
    'speed tape': SPEED_TAPE_REF,
    'altitude tape': ALTITUDE_TAPE_REF,
    'altitude readout': ALTITUDE_READOUT_REF,
    'baro box': BARO_BOX_REF,
    'vs box': VS_BOX_REF,
    compass: COMPASS_BOX_REF,
    'inset map': INSET_MAP_REF,
  };

  it('has the six rows of the maximum', () => {
    expect(rows).toHaveLength(CAS_REF.maxRows);
  });

  it('lies inside the content zone with a margin of 2', () => {
    expect(ZONE_MARGIN).toBe(2);
    expect(insideZone(full, ZONE_MARGIN)).toBe(true);
  });

  it('overlaps no other part of the PFD', () => {
    for (const [name, rect] of Object.entries(furniture)) {
      expect(overlaps(full, rect), name).toBe(false);
    }
  });

  it('keeps every part of the reference inside the zone as well', () => {
    for (const [name, rect] of Object.entries(furniture)) {
      expect(insideZone(rect, 0), name).toBe(true);
    }
  });

  it('the overlap helper does report an overlap and an adjacency', () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(insideZone({ x: 0, y: 40, w: 10, h: 10 }, 0)).toBe(false);
  });
});
