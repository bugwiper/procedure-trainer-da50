import { describe, expect, it } from 'vitest';
import {
  ALTITUDE_TICK_COUNT,
  ALTITUDE_TICK_PX,
  AV_MASTER_CONTROL,
  PFD_ALTITUDE_QUANTITY,
  PFD_VERTICAL_SPEED_QUANTITY,
  altitudeReadout,
  altitudeTickOffsets,
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
