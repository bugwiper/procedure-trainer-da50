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
  verticalSpeedText,
} from '../src/aircraft/da50rg/avionics';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import type { PanelBridge } from '../src/ui/bridge';
import { PfdFrame } from '../src/ui/panel/frames/PfdFrame';
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

describe('verticalSpeedText', () => {
  it('rounds to the nearest 10 fpm, with a plus sign for a climb and 0 plain', () => {
    expect(verticalSpeedText(500)).toBe('+500');
    expect(verticalSpeedText(504)).toBe('+500');
    expect(verticalSpeedText(505)).toBe('+510');
    expect(verticalSpeedText(-700)).toBe('-700');
    expect(verticalSpeedText(-4)).toBe('0');
    expect(verticalSpeedText(4)).toBe('0');
    expect(verticalSpeedText(0)).toBe('0');
  });

  it('gives the base (0) for a missing reading', () => {
    expect(verticalSpeedText(undefined)).toBe('0');
    expect(verticalSpeedText(Number.NaN)).toBe('0');
    expect(DA50RG_QUANTITIES.get(PFD_VERTICAL_SPEED_QUANTITY)?.base).toBe(0);
  });
});

describe('the PFD frame', () => {
  it('reads the static 1400 ft and 0 fpm with the base values: the free panel', () => {
    const tree = render(baseValues);
    expect(readout(tree, 'data-altitude-readout')).toBe('1400');
    expect(readout(tree, 'data-vs-readout')).toBe('0');
  });

  it('shows the altitude and the vertical speed of the quantities', () => {
    const tree = render({
      ...baseValues,
      [PFD_ALTITUDE_QUANTITY]: 4507,
      [PFD_VERTICAL_SPEED_QUANTITY]: -704,
    });
    expect(readout(tree, 'data-altitude-readout')).toBe('4510');
    expect(readout(tree, 'data-vs-readout')).toBe('-700');
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

  it('prints the static label VS beside the number, in a box under the barometer box', () => {
    const tree = render(baseValues);
    const label = findElements(tree, (e) => e.tag === 'text' && textOf(e) === 'VS')[0];
    expect(label).toBeDefined();
    expect([6, 8, 10, 14]).toContain(label?.props['font-size']);
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

  it('keeps the sky, the ground, the horizon line and the ladder inside the one group', () => {
    const inside = group(render(baseValues));
    expect(findElements(inside, (e) => e.tag === 'rect')).toHaveLength(2);
    // The horizon line and one line per ladder step (every 5 degrees to 30, 0 excluded).
    const lines = findElements(inside, (e) => e.tag === 'line');
    expect(lines).toHaveLength(1 + (2 * PITCH_LADDER_MAX_DEG) / PITCH_LADDER_STEP_DEG);
    expect(findElements(inside, (e) => e.props['data-pitch-mark'] !== undefined)).toHaveLength(
      (2 * PITCH_LADDER_MAX_DEG) / PITCH_LADDER_STEP_DEG,
    );
  });

  it('clips the group to the attitude rectangle', () => {
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
    ]).toEqual([100, 34, 295, 232]);
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
