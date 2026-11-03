import { describe, expect, it } from 'vitest';
import {
  ALTITUDE_READOUT,
  ALTITUDE_TAPE,
  ATTITUDE,
  CAS_COLUMN,
  COMPASS,
  FT_LABEL,
  HEADING_BOX,
  HEADING_FRAME,
  INSET_MAP,
  KT_LABEL,
  SPEED_READOUT,
  SPEED_TAPE,
  QNH_READOUT,
  TAPE_OPACITY,
  VS_BOX,
  VS_HALF_HEIGHT,
  VS_NUMERAL_FPM,
  VS_SCALE_MAX_FPM,
  VS_STRIP,
  VS_TICK_STEP_FPM,
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
  BACKING_BOX_REF,
  BACKING_OPACITY_REF,
  CAS_REF,
  COMPASS_BOX_REF,
  COMPASS_REF,
  GLASS_FONT_SCALE,
  HEADING_BLOCK_REF,
  HEADING_BOX_REF,
  INSET_MAP_REF,
  LABELS_REF,
  SPEED_READOUT_REF,
  SPEED_TAPE_REF,
  TAPE_OPACITY_RANGE,
  TAPE_OPACITY_REF,
  TAPE_TICKS_REF,
  QNH_BOX_REF,
  QNH_REF,
  READOUT_FONT_REF,
  SIDE_MARGIN_REF,
  TAPE_WIDTH_REF,
  VS_REF,
  VS_STRIP_REF,
  VS_TRAVEL_REF,
  ZONE_MARGIN,
  ZONE_REF,
  insideZone,
  overlaps,
} from './pfd-layout-reference';
import type { RectRef } from './pfd-layout-reference';
import { expand, findElements, textOf } from './vnode-walk';
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
  cueLevels: { value: {} },
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

/** A rectangle of the data object with width and height, as a reference-shaped rectangle. */
const asRect = (r: { x: number; y: number; width: number; height: number }): RectRef => ({
  x: r.x,
  y: r.y,
  w: r.width,
  h: r.height,
});

describe('the tape, readout, label, compass and map data', () => {
  it('equals the reference rectangles', () => {
    expect(asRect(SPEED_TAPE)).toEqual(SPEED_TAPE_REF);
    expect(asRect(ALTITUDE_TAPE)).toEqual(ALTITUDE_TAPE_REF);
    expect(asRect(SPEED_READOUT)).toEqual(SPEED_READOUT_REF);
    expect(asRect(ALTITUDE_READOUT)).toEqual(ALTITUDE_READOUT_REF);
    expect(asRect(HEADING_FRAME)).toEqual(HEADING_BOX_REF);
    expect(asRect(HEADING_BOX)).toEqual(HEADING_BLOCK_REF);
    expect(asRect(INSET_MAP)).toEqual(INSET_MAP_REF);
  });

  it('equals the reference tick geometry and label anchors', () => {
    expect([SPEED_TAPE.tickX1, SPEED_TAPE.tickX2, SPEED_TAPE.tickTop]).toEqual([
      TAPE_TICKS_REF.speedX1,
      TAPE_TICKS_REF.speedX2,
      TAPE_TICKS_REF.top,
    ]);
    expect([ALTITUDE_TAPE.tickLength, ALTITUDE_TAPE.tickTop]).toEqual([
      TAPE_TICKS_REF.altitudeLength,
      TAPE_TICKS_REF.top,
    ]);
    expect(KT_LABEL).toEqual(LABELS_REF.KT);
    expect(FT_LABEL).toEqual(LABELS_REF.FT);
  });

  it('equals the reference compass, and the backing is a little larger than the rose', () => {
    expect([COMPASS.cx, COMPASS.cy, COMPASS.r, COMPASS.backingR]).toEqual([
      COMPASS_REF.cx,
      COMPASS_REF.cy,
      COMPASS_REF.r,
      COMPASS_REF.backingR,
    ]);
    expect(COMPASS.backingR).toBeGreaterThan(COMPASS.r);
    expect(COMPASS.backingOpacity).toBe(BACKING_OPACITY_REF);
    expect(BACKING_BOX_REF).toEqual({
      x: COMPASS_REF.cx - COMPASS_REF.backingR,
      y: COMPASS_REF.cy - COMPASS_REF.backingR,
      w: 2 * COMPASS_REF.backingR,
      h: COMPASS_REF.backingR,
    });
  });

  it('centres both readout boxes on the attitude centre height', () => {
    expect(SPEED_READOUT.y + SPEED_READOUT.height / 2).toBe(ATTITUDE_REF.cy);
    expect(ALTITUDE_READOUT.y + ALTITUDE_READOUT.height / 2).toBe(ATTITUDE_REF.cy);
  });
});

describe('the tapes and the compass as drawn', () => {
  it('draws both tape rectangles as dark glass at the one opacity constant', () => {
    expect(TAPE_OPACITY).toBe(TAPE_OPACITY_REF);
    expect(TAPE_OPACITY).toBeGreaterThanOrEqual(TAPE_OPACITY_RANGE.min);
    expect(TAPE_OPACITY).toBeLessThanOrEqual(TAPE_OPACITY_RANGE.max);
    for (const id of ['pfd-airspeed', 'pfd-altitude']) {
      const tape = rectsIn(byTestId(id))[0];
      expect(tape?.props['fill-opacity'], id).toBe(TAPE_OPACITY_REF);
    }
  });

  it('keeps the readout boxes opaque black with a white frame', () => {
    for (const id of ['pfd-airspeed', 'pfd-altitude']) {
      const readout = rectsIn(byTestId(id))[1];
      expect(readout?.props['fill'], id).toBe('#000000');
      expect(readout?.props['stroke'], id).toBe('#ffffff');
      expect(readout?.props['fill-opacity'], id).toBeUndefined();
    }
  });

  it('draws the readout boxes and the labels at the reference', () => {
    expect(rectOf(rectsIn(byTestId('pfd-airspeed'))[1])).toEqual(SPEED_READOUT_REF);
    expect(rectOf(rectsIn(byTestId('pfd-altitude'))[1])).toEqual(ALTITUDE_READOUT_REF);
    const label = (id: string, s: string): El | undefined =>
      findElements(byTestId(id), (e) => e.tag === 'text' && textOf(e) === s)[0];
    expect([
      label('pfd-airspeed', 'KT')?.props['x'],
      label('pfd-airspeed', 'KT')?.props['y'],
    ]).toEqual([LABELS_REF.KT.x, LABELS_REF.KT.y]);
    expect([
      label('pfd-altitude', 'FT')?.props['x'],
      label('pfd-altitude', 'FT')?.props['y'],
    ]).toEqual([LABELS_REF.FT.x, LABELS_REF.FT.y]);
  });

  it('draws the compass backing first, translucent dark glass, as a half disc over the arc side', () => {
    const backing = findElements(tree, (e) => 'data-compass-backing' in e.props);
    expect(backing).toHaveLength(1);
    expect(backing[0]?.props['fill-opacity']).toBe(BACKING_OPACITY_REF);
    const d = String(backing[0]?.props['d']);
    // Left point, arc of the backing radius over the top, right point, closed along the flat side.
    expect(d).toContain(`A ${COMPASS_REF.backingR} ${COMPASS_REF.backingR} 0 0 1`);
    expect(d.trim().endsWith('Z')).toBe(true);
    const group = findElements(tree, (e) =>
      e.children.some((c) => typeof c !== 'string' && 'data-compass-backing' in c.props),
    )[0];
    const first = group?.children[0];
    expect(
      typeof first === 'string' ? undefined : first?.props['data-compass-backing'],
    ).toBeDefined();
  });

  it('keeps the compass rose plain: 12 ticks, one arc', () => {
    expect(findElements(tree, (e) => 'data-compass-tick' in e.props)).toHaveLength(
      COMPASS_REF.ticks,
    );
    expect(findElements(tree, (e) => 'data-compass-arc' in e.props)).toHaveLength(1);
  });
});

describe('the altitude block as drawn', () => {
  it('starts at the reference x', () => {
    expect(ALTITUDE_BLOCK.x).toBe(ALTITUDE_TAPE_REF.x);
  });

  it('draws the tape and the readout box at the reference rectangles', () => {
    const altitude = byTestId('pfd-altitude');
    const [tape, readout] = rectsIn(altitude);
    expect(rectOf(tape)).toEqual(ALTITUDE_TAPE_REF);
    expect(rectOf(readout)).toEqual(ALTITUDE_READOUT_REF);
    expect(findElements(tree, (e) => 'data-baro-box' in e.props)).toHaveLength(0);
  });

  it('draws the speed tape at the reference rectangle', () => {
    expect(rectOf(rectsIn(byTestId('pfd-airspeed'))[0])).toEqual(SPEED_TAPE_REF);
  });

  it('leaves the inset map and the heading frame where they were', () => {
    expect(rectOf(findElements(tree, (e) => 'data-inset-map' in e.props)[0])).toEqual(
      INSET_MAP_REF,
    );
    expect(rectOf(rectsIn(byTestId('pfd-heading'))[0])).toEqual(HEADING_BOX_REF);
  });
});

describe('the symmetric arrangement of the tapes and the margins', () => {
  const vsRight = VS_STRIP_REF.x + VS_STRIP_REF.w;

  it('has both tapes at the reference width, clearly narrower than the old 80', () => {
    expect(SPEED_TAPE.width).toBe(TAPE_WIDTH_REF);
    expect(ALTITUDE_TAPE.width).toBe(TAPE_WIDTH_REF);
    expect(SPEED_TAPE_REF.w).toBe(TAPE_WIDTH_REF);
    expect(ALTITUDE_TAPE_REF.w).toBe(TAPE_WIDTH_REF);
    expect(TAPE_WIDTH_REF).toBeLessThanOrEqual(60);
  });

  it('keeps the left margin and the right margin equal to the reference margin', () => {
    expect(SPEED_TAPE_REF.x - ZONE_REF.x0).toBe(SIDE_MARGIN_REF);
    expect(ZONE_REF.x1 - vsRight).toBe(SIDE_MARGIN_REF);
    expect(SPEED_TAPE.x - PFD_ZONE.x0).toBe(PFD_ZONE.x1 - (VS_STRIP.x + VS_STRIP.width));
  });

  it('sets the readout numbers in the reference size and keeps the boxes inside their tapes', () => {
    expect(SPEED_READOUT.textSize).toBe(READOUT_FONT_REF);
    expect(ALTITUDE_READOUT.textSize).toBe(READOUT_FONT_REF);
    expect(GLASS_FONT_SCALE).toContain(READOUT_FONT_REF);
    expect(SPEED_READOUT_REF.x + SPEED_READOUT_REF.w).toBeLessThanOrEqual(
      SPEED_TAPE_REF.x + SPEED_TAPE_REF.w,
    );
    expect(ALTITUDE_READOUT_REF.x).toBeGreaterThanOrEqual(ALTITUDE_TAPE_REF.x);
    expect(ALTITUDE_READOUT_REF.x + ALTITUDE_READOUT_REF.w).toBeLessThanOrEqual(
      ALTITUDE_TAPE_REF.x + ALTITUDE_TAPE_REF.w,
    );
  });

  it('puts the CAS column in the right margin, right of the strip and the whole travel of the box', () => {
    expect(CAS_REF.x).toBeGreaterThanOrEqual(VS_TRAVEL_REF.x + VS_TRAVEL_REF.w);
    expect(CAS_REF.x + CAS_REF.width).toBeLessThanOrEqual(ZONE_REF.x1 - ZONE_MARGIN);
  });

  it('starts the CAS column in the lower third of the zone', () => {
    const lowerThird = ZONE_REF.y0 + (2 * (ZONE_REF.y1 - ZONE_REF.y0)) / 3;
    expect(CAS_REF.bottom).toBeGreaterThanOrEqual(lowerThird);
    expect(CAS_REF.bottom).toBeLessThanOrEqual(ZONE_REF.y1);
  });

  it('keeps the tip of the box clear of the altitude tape', () => {
    expect(VS_TRAVEL_REF.x).toBeGreaterThanOrEqual(ALTITUDE_TAPE_REF.x + ALTITUDE_TAPE_REF.w);
  });
});

describe('the vertical speed scale data and drawing', () => {
  const vs = byTestId('pfd-vs');
  const strip = findElements(vs, (e) => 'data-vs-strip' in e.props)[0];

  it('equals the reference scale: range, half height, step, numeral values, strip rectangle', () => {
    expect(VS_SCALE_MAX_FPM).toBe(VS_REF.maxFpm);
    expect(VS_HALF_HEIGHT).toBe(VS_REF.halfHeight);
    expect(VS_TICK_STEP_FPM).toBe(VS_REF.tickStepFpm);
    expect([...VS_NUMERAL_FPM]).toEqual([...VS_REF.numeralFpm]);
    expect(asRect(VS_STRIP)).toEqual(VS_STRIP_REF);
    expect(VS_STRIP.y + VS_HALF_HEIGHT).toBe(VS_REF.zeroY);
    expect(VS_REF.zeroY).toBe(ATTITUDE_REF.cy);
  });

  it('is linear: the half height times 2 is the strip height, 28 units per 1000 fpm', () => {
    expect(2 * VS_HALF_HEIGHT).toBe(VS_STRIP.height);
    expect((VS_HALF_HEIGHT / VS_SCALE_MAX_FPM) * 1000).toBe(28);
    expect(VS_REF.maxFpm).toBe(DA50RG_QUANTITIES.get('vertical_speed_fpm')?.max);
  });

  it('draws the strip at the reference rectangle, narrow and right of the altitude tape', () => {
    expect(rectOf(strip)).toEqual(VS_STRIP_REF);
    expect(VS_STRIP_REF.x).toBeGreaterThanOrEqual(ALTITUDE_TAPE_REF.x + ALTITUDE_TAPE_REF.w);
    expect(VS_STRIP_REF.w).toBeLessThanOrEqual(30);
  });

  it('draws the counts of the reference: 13 ticks, 6 numerals with the texts 1, 2, 3 twice', () => {
    expect((2 * VS_REF.maxFpm) / VS_REF.tickStepFpm + 1).toBe(VS_REF.tickCount);
    expect(2 * VS_REF.numeralFpm.length).toBe(VS_REF.numeralCount);
    expect(findElements(vs, (e) => 'data-vs-tick' in e.props)).toHaveLength(VS_REF.tickCount);
    const numerals = findElements(vs, (e) => 'data-vs-numeral' in e.props);
    expect(numerals).toHaveLength(VS_REF.numeralCount);
    expect(numerals.map(textOf).sort()).toEqual([...VS_REF.numeralTexts]);
  });

  it('draws the ticks symmetric about the zero line, the thousands longer', () => {
    const ticks = findElements(vs, (e) => 'data-vs-tick' in e.props);
    const ys = ticks.map((t) => Number(t.props['y1'])).sort((a, b) => a - b);
    ys.forEach((y, i) => {
      expect(y + (ys[ys.length - 1 - i] ?? Number.NaN)).toBeCloseTo(2 * VS_REF.zeroY, 9);
    });
    expect(ys[0]).toBeCloseTo(VS_REF.zeroY - VS_REF.halfHeight, 9);
    const length = (t: El): number => Number(t.props['x2']) - Number(t.props['x1']);
    const atY = (y: number): El | undefined => ticks.find((t) => Number(t.props['y1']) === y);
    expect(length(atY(VS_REF.zeroY) as El)).toBeGreaterThan(length(atY(VS_REF.zeroY - 14) as El));
  });

  it('draws the readout box at the zero line: 22 x 11 body, tip toward the tape, centred on 150', () => {
    const pointer = findElements(vs, (e) => 'data-vs-pointer' in e.props)[0];
    expect(pointer?.props['transform']).toBe('translate(0 0.00)');
    expect(VS_BOX.x).toBe(VS_REF.box.x);
    expect(VS_BOX.width).toBe(VS_REF.box.w);
    expect(VS_BOX.height).toBe(VS_REF.box.h);
    expect(VS_BOX.tipLength).toBe(VS_REF.box.tip);
    // The tip points toward the tape: it reaches left of the body and not into the tape.
    expect(VS_BOX.x - VS_BOX.tipLength).toBeGreaterThanOrEqual(
      ALTITUDE_TAPE_REF.x + ALTITUDE_TAPE_REF.w,
    );
    // The body straddles the strip: it starts inside it and reaches past its right edge.
    expect(VS_BOX.x).toBeGreaterThan(VS_STRIP_REF.x);
    expect(VS_BOX.x + VS_BOX.width).toBeGreaterThan(VS_STRIP_REF.x + VS_STRIP_REF.w);
  });

  it('keeps the whole travel of the box inside the strip height plus half its own', () => {
    expect(VS_TRAVEL_REF.x).toBe(VS_REF.box.x - VS_REF.box.tip);
    expect(VS_TRAVEL_REF.x + VS_TRAVEL_REF.w).toBe(VS_REF.box.x + VS_REF.box.w);
    expect(VS_TRAVEL_REF.y).toBe(VS_REF.zeroY - VS_REF.halfHeight - VS_REF.box.h / 2);
    expect(VS_TRAVEL_REF.h).toBe(2 * VS_REF.halfHeight + VS_REF.box.h);
  });
});

describe('the barometer setting data and drawing', () => {
  it('equals the reference anchors', () => {
    expect({ ...QNH_READOUT }).toEqual({ ...QNH_REF });
  });

  it('draws the value and the unit on the baseline of the reference, under the FT label', () => {
    const value = findElements(tree, (e) => 'data-qnh-readout' in e.props)[0];
    const unit = findElements(tree, (e) => e.tag === 'text' && textOf(e) === 'HPA')[0];
    expect([value?.props['x'], value?.props['y'], value?.props['font-size']]).toEqual([
      QNH_REF.valueRight,
      QNH_REF.baseline,
      QNH_REF.valueSize,
    ]);
    expect([unit?.props['x'], unit?.props['y'], unit?.props['font-size']]).toEqual([
      QNH_REF.unitX,
      QNH_REF.baseline,
      QNH_REF.unitSize,
    ]);
    // Below the unit label FT and the tape, inside the altitude block's columns.
    expect(QNH_REF.baseline - QNH_REF.valueSize).toBeGreaterThan(LABELS_REF.FT.y);
    expect(QNH_BOX_REF.y).toBeGreaterThan(ALTITUDE_TAPE_REF.y + ALTITUDE_TAPE_REF.h);
    expect(QNH_BOX_REF.x).toBeGreaterThanOrEqual(ALTITUDE_TAPE_REF.x);
    // Clear of the CAS column to its right.
    expect(QNH_BOX_REF.x + QNH_BOX_REF.w).toBeLessThan(CAS_REF.x);
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
    'qnh text': QNH_BOX_REF,
    'vs strip': VS_STRIP_REF,
    'vs travel': VS_TRAVEL_REF,
    compass: COMPASS_BOX_REF,
    'compass backing': BACKING_BOX_REF,
    'speed readout': SPEED_READOUT_REF,
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

  it('no two parts of the furniture overlap each other', () => {
    // The readout boxes lie inside their tapes and the compass box inside its backing by design.
    const apart: Record<string, RectRef> = {
      'speed tape': SPEED_TAPE_REF,
      'altitude tape': ALTITUDE_TAPE_REF,
      'compass backing': BACKING_BOX_REF,
      'inset map': INSET_MAP_REF,
      'qnh text': QNH_BOX_REF,
      'vs travel': VS_TRAVEL_REF,
      'cas column': full,
    };
    const names = Object.keys(apart);
    for (const [i, a] of names.entries()) {
      for (const b of names.slice(i + 1)) {
        expect(overlaps(apart[a] as RectRef, apart[b] as RectRef), `${a} / ${b}`).toBe(false);
      }
    }
  });

  it('the overlap helper does report an overlap and an adjacency', () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(insideZone({ x: 0, y: 40, w: 10, h: 10 }, 0)).toBe(false);
  });
});
