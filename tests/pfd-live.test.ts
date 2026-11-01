import { describe, expect, it } from 'vitest';
import {
  ALTITUDE_TICK_COUNT,
  ALTITUDE_TICK_PX,
  AV_MASTER_CONTROL,
  BANK_SCALE_MAX_DEG,
  PFD_ALTITUDE_QUANTITY,
  PFD_BANK_QUANTITY,
  PFD_PITCH_QUANTITY,
  PFD_VERTICAL_SPEED_QUANTITY,
  PITCH_LADDER_MAX_DEG,
  PITCH_LADDER_STEP_DEG,
  PITCH_LADDER_STEP_PX,
  altitudeReadout,
  altitudeTickOffsets,
  horizonRotationDeg,
  pitchShiftPx,
} from '../src/aircraft/da50rg/avionics';
import {
  VS_HALF_HEIGHT,
  VS_SCALE_MAX_FPM,
  verticalSpeedPointerPx,
  verticalSpeedReadout,
} from '../src/aircraft/da50rg/pfd-layout';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import type { PanelBridge } from '../src/ui/bridge';
import { PfdFrame } from '../src/ui/panel/frames/PfdFrame';
import { ZONE_REF } from './pfd-layout-reference';
import { expand, findElements, textOf } from './vnode-walk';
import type { El } from './vnode-walk';

// The live PFD (Phase 6, plan 03; V-06): the pure helpers of the altitude tape and the readouts, and
// the frame drawn from a fake bridge. The flight models are tested in tests/flight-profile.test.ts.

const region = (() => {
  const found = DA50RG.regions.find((r) => r.id === 'pfd');
  if (found === undefined) throw new Error('no pfd region');
  return found;
})();

const baseValues = DA50RG_QUANTITIES.baseValues();

function render(values: Record<string, number>): El {
  const bridge = {
    registry: DA50RG,
    stateOf: (id: string) => ({ value: id === AV_MASTER_CONTROL ? 'on' : 'map' }),
    quantities: { value: values },
    cas: { value: [] },
  } as unknown as PanelBridge;
  return expand(PfdFrame({ region, bridge }));
}

const pointerTransform = (tree: El): unknown =>
  findElements(tree, (e) => 'data-vs-pointer' in e.props)[0]?.props['transform'];

const readout = (tree: El, attribute: string): string =>
  textOf(findElements(tree, (e) => e.props[attribute] !== undefined)[0] ?? tree);

describe('altitudeReadout', () => {
  it('rounds to the nearest 10 ft', () => {
    expect(altitudeReadout(1400)).toBe(1400);
    expect(altitudeReadout(1404.9)).toBe(1400);
    expect(altitudeReadout(1405)).toBe(1410);
    expect(altitudeReadout(4499.99)).toBe(4500);
  });

  it('never reads below 0 and gives the base for a missing or broken reading', () => {
    expect(altitudeReadout(-20)).toBe(0);
    expect(altitudeReadout(undefined)).toBe(DA50RG_QUANTITIES.get(PFD_ALTITUDE_QUANTITY)?.base);
    expect(altitudeReadout(Number.NaN)).toBe(1400);
  });
});

describe('altitudeTickOffsets', () => {
  const rest = Array.from(
    { length: ALTITUDE_TICK_COUNT },
    (_, i) => ALTITUDE_TICK_PX / 2 + i * ALTITUDE_TICK_PX,
  );

  it('puts the ticks of a multiple of 100 ft at the rest places of the static art', () => {
    for (const feet of [0, 100, 1400, 4500, 19900]) {
      expect(altitudeTickOffsets(feet), String(feet)).toEqual(rest);
    }
  });

  it('keeps seven ticks and moves them down by 30 px per 100 ft, wrapping inside the band', () => {
    const span = ALTITUDE_TICK_COUNT * ALTITUDE_TICK_PX;
    const moved = altitudeTickOffsets(1440);
    expect(moved).toHaveLength(ALTITUDE_TICK_COUNT);
    moved.forEach((offset, i) => {
      const before = altitudeTickOffsets(1400)[i] ?? Number.NaN;
      expect((offset - before + span) % span).toBeCloseTo(12, 9);
    });
    // 1480 ft pushes the last tick (195 + 24 = 219) past 210: it wraps to the top.
    expect(Math.min(...altitudeTickOffsets(1480))).toBeCloseTo(9, 9);
    for (const y of altitudeTickOffsets(1480)) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(span);
    }
  });

  it('gives the rest places for a missing reading', () => {
    expect(altitudeTickOffsets(undefined)).toEqual(rest);
    expect(altitudeTickOffsets(Number.NaN)).toEqual(rest);
  });
});

describe('verticalSpeedPointerPx', () => {
  it('stands on the zero line at 0, also for a negative zero', () => {
    expect(verticalSpeedPointerPx(0)).toBe(0);
    expect(Object.is(verticalSpeedPointerPx(0), 0)).toBe(true);
    expect(Object.is(verticalSpeedPointerPx(-0), 0)).toBe(true);
  });

  it('moves up for a climb and down for a sink, linear over the half height', () => {
    expect(verticalSpeedPointerPx(VS_SCALE_MAX_FPM)).toBe(-VS_HALF_HEIGHT);
    expect(verticalSpeedPointerPx(-VS_SCALE_MAX_FPM)).toBe(VS_HALF_HEIGHT);
    expect(verticalSpeedPointerPx(500)).toBeCloseTo(-VS_HALF_HEIGHT / 6, 9);
    expect(verticalSpeedPointerPx(1000)).toBeCloseTo(-28, 9);
    expect(verticalSpeedPointerPx(-700)).toBeCloseTo(19.6, 9);
  });

  it('is symmetric about the zero line', () => {
    for (const fpm of [50, 500, 1234, 2999, 3000]) {
      expect(verticalSpeedPointerPx(fpm) + verticalSpeedPointerPx(-fpm), String(fpm)).toBe(0);
    }
  });

  it('clamps at both ends of the scale', () => {
    expect(verticalSpeedPointerPx(3500)).toBe(-VS_HALF_HEIGHT);
    expect(verticalSpeedPointerPx(-9999)).toBe(VS_HALF_HEIGHT);
  });

  it('reads the base (0) for a missing or non-finite reading', () => {
    expect(verticalSpeedPointerPx(undefined)).toBe(0);
    expect(verticalSpeedPointerPx(Number.NaN)).toBe(0);
    expect(verticalSpeedPointerPx(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('has the scale maximum of the quantity data', () => {
    const def = DA50RG_QUANTITIES.get(PFD_VERTICAL_SPEED_QUANTITY);
    expect(def?.max).toBe(VS_SCALE_MAX_FPM);
    expect(def?.min).toBe(-VS_SCALE_MAX_FPM);
    expect(def?.base).toBe(0);
  });
});

describe('verticalSpeedReadout', () => {
  it('is the bare number rounded to the nearest 50 fpm', () => {
    expect(verticalSpeedReadout(1200)).toBe('1200');
    expect(verticalSpeedReadout(1224)).toBe('1200');
    expect(verticalSpeedReadout(1225)).toBe('1250');
    expect(verticalSpeedReadout(500)).toBe('500');
    expect(verticalSpeedReadout(24)).toBe('0');
    expect(verticalSpeedReadout(25)).toBe('50');
  });

  it('never carries a sign: a sink reads the same number, and never "-0"', () => {
    expect(verticalSpeedReadout(-700)).toBe('700');
    expect(verticalSpeedReadout(-704)).toBe('700');
    expect(verticalSpeedReadout(-1224)).toBe('1200');
    expect(verticalSpeedReadout(-4)).toBe('0');
    expect(verticalSpeedReadout(-0)).toBe('0');
    expect(verticalSpeedReadout(0)).toBe('0');
    for (const fpm of [-3000, -25, -24, -0.4, 0, 0.4, 25, 3000]) {
      expect(verticalSpeedReadout(fpm), String(fpm)).toMatch(/^\d+$/);
    }
  });

  it('is clamped at the ends of the scale and reads 0 for a missing reading', () => {
    expect(verticalSpeedReadout(4000)).toBe('3000');
    expect(verticalSpeedReadout(-4000)).toBe('3000');
    expect(verticalSpeedReadout(undefined)).toBe('0');
    expect(verticalSpeedReadout(Number.NaN)).toBe('0');
  });
});

describe('the PFD frame', () => {
  it('reads the static 1400 ft and 0 fpm with the base values: the free panel', () => {
    const tree = render(baseValues);
    expect(readout(tree, 'data-altitude-readout')).toBe('1400');
    expect(readout(tree, 'data-vs-readout')).toBe('0');
    expect(pointerTransform(tree)).toBe('translate(0 0.00)');
  });

  it('shows the altitude and the vertical speed of the quantities', () => {
    const tree = render({
      ...baseValues,
      [PFD_ALTITUDE_QUANTITY]: 4507,
      [PFD_VERTICAL_SPEED_QUANTITY]: -704,
    });
    expect(readout(tree, 'data-altitude-readout')).toBe('4510');
    // A sink of 704 fpm: the number is bare and rounded to 50, the box lies below the zero line.
    expect(readout(tree, 'data-vs-readout')).toBe('700');
    expect(pointerTransform(tree)).toBe(`translate(0 ${((704 / 3000) * 84).toFixed(2)})`);
  });

  it('puts the box above the zero line for a climb and moves it with the reading', () => {
    const climb = render({ ...baseValues, [PFD_VERTICAL_SPEED_QUANTITY]: 1200 });
    expect(readout(climb, 'data-vs-readout')).toBe('1200');
    expect(pointerTransform(climb)).toBe('translate(0 -33.60)');
    const pegged = render({ ...baseValues, [PFD_VERTICAL_SPEED_QUANTITY]: 3000 });
    expect(pointerTransform(pegged)).toBe('translate(0 -84.00)');
  });

  it('draws the altitude tape ticks at the offsets of the helper', () => {
    const tape = (values: Record<string, number>): number[] =>
      findElements(
        findElements(render(values), (e) => e.props['data-testid'] === 'pfd-altitude')[0] ??
          render(values),
        (e) => e.tag === 'line',
      ).map((e) => Number(e.props['y1']) - 34 - 9);
    expect(tape(baseValues)).toEqual(altitudeTickOffsets(1400));
    const moved = tape({ ...baseValues, [PFD_ALTITUDE_QUANTITY]: 1437 });
    altitudeTickOffsets(1437).forEach((offset, i) => {
      expect(moved[i]).toBeCloseTo(offset, 9);
    });
  });

  it('prints no label VS and keeps the readout inside the moving box', () => {
    const tree = render(baseValues);
    expect(findElements(tree, (e) => e.tag === 'text' && textOf(e) === 'VS')).toHaveLength(0);
    const box = findElements(tree, (e) => 'data-vs-pointer' in e.props)[0];
    expect(findElements(box ?? tree, (e) => 'data-vs-readout' in e.props)).toHaveLength(1);
  });
});

describe('pitchShiftPx and horizonRotationDeg', () => {
  it('a level horizon is the identity, also for a negative zero', () => {
    expect(pitchShiftPx(0)).toBe(0);
    expect(pitchShiftPx(-0)).toBe(0);
    expect(Object.is(horizonRotationDeg(0), 0)).toBe(true);
    expect(Object.is(horizonRotationDeg(-0), 0)).toBe(true);
    expect(pitchShiftPx(undefined)).toBe(0);
    expect(horizonRotationDeg(undefined)).toBe(0);
  });

  it('a nose-up pitch moves the horizon down by one ladder step per 5 degrees', () => {
    expect(pitchShiftPx(5)).toBe(PITCH_LADDER_STEP_PX);
    expect(pitchShiftPx(10)).toBe(2 * PITCH_LADDER_STEP_PX);
    expect(pitchShiftPx(-5)).toBe(-PITCH_LADDER_STEP_PX);
    expect(pitchShiftPx(8.2)).toBeCloseTo((8.2 / PITCH_LADDER_STEP_DEG) * PITCH_LADDER_STEP_PX, 9);
  });

  it('a right bank turns the horizon counter-clockwise: minus the bank', () => {
    expect(horizonRotationDeg(20)).toBe(-20);
    expect(horizonRotationDeg(-35)).toBe(35);
  });

  it('clamps to the ladder and to the bank scale, and ignores a broken reading', () => {
    const top = (PITCH_LADDER_MAX_DEG / PITCH_LADDER_STEP_DEG) * PITCH_LADDER_STEP_PX;
    expect(pitchShiftPx(90)).toBe(top);
    expect(pitchShiftPx(-90)).toBe(-top);
    expect(horizonRotationDeg(200)).toBe(-BANK_SCALE_MAX_DEG);
    expect(horizonRotationDeg(-200)).toBe(BANK_SCALE_MAX_DEG);
    expect(pitchShiftPx(Number.NaN)).toBe(0);
    expect(horizonRotationDeg(Number.NaN)).toBe(0);
  });
});

describe('the attitude art', () => {
  const group = (tree: El): El => {
    const found = findElements(tree, (e) => e.props['data-horizon'] !== undefined);
    expect(found).toHaveLength(1);
    return found[0] ?? tree;
  };
  const pointerHolder = (tree: El): El | undefined =>
    findElements(tree, (e) => e.tag === 'g').find(
      (g) =>
        findElements(g, (e) => e.props['data-roll-pointer'] !== undefined).length === 1 &&
        g.children.length === 1,
    );

  it('at pitch 0 and bank 0 the horizon group moves nothing: rotation 0 and shift 0', () => {
    const transform = String(group(render(baseValues)).props['transform']);
    expect(transform).toBe('rotate(0.00 247.50 150.00) translate(0 0.00)');
  });

  it('turns by minus the bank about the attitude centre and shifts by the pitch', () => {
    const tree = render({ ...baseValues, [PFD_PITCH_QUANTITY]: 10, [PFD_BANK_QUANTITY]: 20 });
    expect(group(tree).props['transform']).toBe('rotate(-20.00 247.50 150.00) translate(0 44.00)');
  });

  it('keeps the synthetic vision, the horizon line and the ladder inside the one group', () => {
    const inside = group(render(baseValues));
    // Plan 06.1-02: sky and ground are one synthetic vision group (sky, ground, haze rectangles).
    expect(findElements(inside, (e) => e.props['data-svt'] !== undefined)).toHaveLength(1);
    expect(findElements(inside, (e) => e.tag === 'rect')).toHaveLength(3);
    // The horizon line and one line per ladder step (every 5 degrees to 30, 0 excluded).
    const lines = findElements(inside, (e) => e.tag === 'line');
    expect(lines).toHaveLength(1 + (2 * PITCH_LADDER_MAX_DEG) / PITCH_LADDER_STEP_DEG);
    expect(findElements(inside, (e) => e.props['data-pitch-mark'] !== undefined)).toHaveLength(
      (2 * PITCH_LADDER_MAX_DEG) / PITCH_LADDER_STEP_DEG,
    );
  });

  it('clips the group to the whole content zone', () => {
    const tree = render(baseValues);
    const holders = findElements(tree, (e) => e.props['clip-path'] !== undefined);
    expect(holders).toHaveLength(1);
    const id = /url\(#(.+)\)/.exec(String(holders[0]?.props['clip-path']))?.[1];
    const clip = findElements(tree, (e) => e.tag === 'clipPath' && e.props['id'] === id);
    expect(clip).toHaveLength(1);
    const rect = findElements(clip[0] ?? tree, (e) => e.tag === 'rect')[0];
    expect([
      rect?.props['x'],
      rect?.props['y'],
      rect?.props['width'],
      rect?.props['height'],
    ]).toEqual([ZONE_REF.x0, ZONE_REF.y0, ZONE_REF.x1 - ZONE_REF.x0, ZONE_REF.y1 - ZONE_REF.y0]);
    expect(
      findElements(holders[0] ?? tree, (e) => e.props['data-horizon'] !== undefined),
    ).toHaveLength(1);
  });

  it('the roll pointer turns with the horizon, the bank scale and the aircraft symbol stay fixed', () => {
    const rest = render(baseValues);
    const banked = render({ ...baseValues, [PFD_BANK_QUANTITY]: 30 });
    expect(pointerHolder(rest)?.props['transform']).toBe('rotate(0.00 247.50 150.00)');
    expect(pointerHolder(banked)?.props['transform']).toBe('rotate(-30.00 247.50 150.00)');
    const fixed = (tree: El): unknown =>
      JSON.stringify(
        findElements(tree, (e) => e.props['data-bank-tick'] !== undefined).map((e) => e.props),
      );
    expect(fixed(banked)).toBe(fixed(rest));
  });

  it('heading stays static: 360 whatever the attitude', () => {
    const tree = render({ ...baseValues, [PFD_PITCH_QUANTITY]: 12, [PFD_BANK_QUANTITY]: -25 });
    const head = findElements(tree, (e) => e.props['data-testid'] === 'pfd-heading')[0];
    expect(findElements(head ?? tree, (e) => e.tag === 'text').map(textOf)).toEqual(['360', 'HDG']);
  });
});

describe('vertical speed numerals stay inside the strip (review WR-01)', () => {
  it('every numeral glyph box lies within the strip', async () => {
    const { VS_NUMERAL_FPM, VS_STRIP, vsNumeralBaseline } =
      await import('../src/aircraft/da50rg/pfd-layout');
    for (const fpm of [...VS_NUMERAL_FPM, ...VS_NUMERAL_FPM.map((v) => 0 - v)]) {
      const base = vsNumeralBaseline(fpm);
      expect(base).toBeLessThanOrEqual(VS_STRIP.y + VS_STRIP.height);
      expect(base - VS_STRIP.numeralSize * 0.72).toBeGreaterThanOrEqual(VS_STRIP.y);
    }
  });
});
