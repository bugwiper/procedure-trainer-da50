import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DA50RG_INDICATORS,
  GEAR_IN_TRANSIT,
  flapLamps,
  gearLamps,
} from '../src/aircraft/da50rg/indicators';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { IndicatorError, defineIndicators, evaluateIndicator } from '../src/engine/indicators';
import type { IndicatorSpec } from '../src/engine/indicators';
import { defineRegistry } from '../src/engine/registry';
import type { ControlSpec, RegionDef } from '../src/engine/registry';
import { PanelStore } from '../src/engine/store';
import { LAMP_COLOURS, LampBody } from '../src/ui/panel/widgets/IndicatorLight';
import { countElements, expand } from './vnode-walk';

// Derived indicators (PNL-14, D-11): derive logic, definition invariants, lamp
// contrast and the node cap of the lamp art. Indicators are never controls (PD-07).

const GEAR_IDS = ['lt.gear_nose', 'lt.gear_left', 'lt.gear_right', 'lt.gear_unsafe'] as const;
const FLAP_IDS = ['lt.flap_up', 'lt.flap_to', 'lt.flap_ldg'] as const;

function litMap(
  snapshot: Readonly<Record<string, string>>,
  flags: Readonly<Record<string, boolean>> = {},
): Record<string, boolean> {
  return Object.fromEntries(
    DA50RG_INDICATORS.indicators.map((d) => [d.id, evaluateIndicator(d, snapshot, flags)]),
  );
}

describe('gearLamps', () => {
  it('gear up with no transit lights nothing', () => {
    expect(gearLamps('up', false)).toEqual({
      nose: false,
      left: false,
      right: false,
      unsafe: false,
    });
  });

  it('gear down lights the three greens and not the red lamp', () => {
    expect(gearLamps('down', false)).toEqual({
      nose: true,
      left: true,
      right: true,
      unsafe: false,
    });
  });

  it('in transit lights only the red lamp, whichever way the lever points', () => {
    for (const gear of ['down', 'up']) {
      expect(gearLamps(gear, true)).toEqual({
        nose: false,
        left: false,
        right: false,
        unsafe: true,
      });
    }
  });
});

describe('flapLamps', () => {
  it('lights exactly the lamp that matches the lever', () => {
    expect(flapLamps('up')).toEqual({ up: true, to: false, ldg: false });
    expect(flapLamps('to')).toEqual({ up: false, to: true, ldg: false });
    expect(flapLamps('ldg')).toEqual({ up: false, to: false, ldg: true });
  });
});

describe('DA50RG indicators', () => {
  it('has seven lamps and no group readouts, all indicator ids outside the control registry', () => {
    expect(DA50RG_INDICATORS.indicators).toHaveLength(7);
    expect(Object.keys(DA50RG_INDICATORS).sort()).toEqual(['get', 'inRegion', 'indicators']);
    for (const def of DA50RG_INDICATORS.indicators) {
      expect(def.id.startsWith('lt.')).toBe(true);
      expect(DA50RG.get(def.id)).toBeUndefined();
    }
  });

  it('with the store defaults (gear up, flaps up) no gear lamp is lit and UP is lit', () => {
    const lit = litMap(new PanelStore(DA50RG).snapshot());
    for (const id of GEAR_IDS) expect(lit[id], id).toBe(false);
    expect(lit['lt.flap_up']).toBe(true);
    expect(lit['lt.flap_to']).toBe(false);
    expect(lit['lt.flap_ldg']).toBe(false);
  });

  it('the UNSAFE lamp is off for every reachable lever state', () => {
    for (const gear of ['up', 'down']) {
      for (const flaps of ['up', 'to', 'ldg']) {
        const lit = litMap({ 'lv.gear': gear, 'lv.flaps': flaps });
        expect(lit['lt.gear_unsafe'], `${gear} ${flaps}`).toBe(false);
      }
    }
  });

  it('a fixture with the in-transit flag set lights the UNSAFE lamp only', () => {
    const lit = litMap({ 'lv.gear': 'down', 'lv.flaps': 'up' }, { [GEAR_IN_TRANSIT]: true });
    expect(lit['lt.gear_unsafe']).toBe(true);
    for (const id of ['lt.gear_nose', 'lt.gear_left', 'lt.gear_right']) expect(lit[id]).toBe(false);
  });

  it('exactly one flap lamp is lit for each FLAPS state', () => {
    for (const flaps of ['up', 'to', 'ldg']) {
      const lit = litMap({ 'lv.gear': 'up', 'lv.flaps': flaps });
      expect(FLAP_IDS.filter((id) => lit[id] === true)).toHaveLength(1);
    }
  });

  it('the store answers any lt. id with unknown and logs nothing', () => {
    const store = new PanelStore(DA50RG);
    for (const def of DA50RG_INDICATORS.indicators) {
      expect(store.dispatch(def.id, 'on', 0)).toEqual({ ok: false, reason: 'unknown' });
    }
    expect(store.events()).toHaveLength(0);
  });

  it('evaluateIndicator passes the lit function only the declared reads', () => {
    let seen: string[] = [];
    const spy: IndicatorSpec = {
      id: 'lt.spy',
      label: 'SPY',
      region: 'r1',
      x: 20,
      y: 20,
      r: 7,
      colour: 'green',
      caption: 'above',
      reads: ['sw.a'],
      lit: (inputs) => {
        seen = Object.keys(inputs.controls);
        return inputs.flags['f'] === true;
      },
    };
    const set = defineIndicators(FIXTURE_REGISTRY, { indicators: [spy] });
    const def = set.get('lt.spy');
    if (def === undefined) throw new Error('missing');
    expect(evaluateIndicator(def, { 'sw.a': 'on', 'sw.b': 'on' })).toBe(false);
    expect(seen).toEqual(['sw.a']);
    expect(evaluateIndicator(def, { 'sw.a': 'on' }, { f: true })).toBe(true);
  });
});

const REGIONS: readonly RegionDef[] = [
  { id: 'r1', name: 'R1', bounds: { x: 0, y: 0, w: 100, h: 100 } },
  { id: 'r2', name: 'R2', bounds: { x: 100, y: 0, w: 100, h: 100 } },
];
const SWITCH: ControlSpec = {
  kind: 'toggle',
  id: 'sw.a',
  label: 'A',
  region: 'r1',
  x: 50,
  y: 50,
  hit: { w: 20, h: 20 },
  states: [
    { id: 'off', label: 'OFF' },
    { id: 'on', label: 'ON' },
  ],
  default: 'off',
};
const FIXTURE_REGISTRY = defineRegistry({
  viewBox: { w: 200, h: 100 },
  regions: REGIONS,
  controls: [SWITCH],
});

function lamp(over: Partial<IndicatorSpec> = {}): IndicatorSpec {
  return {
    id: 'lt.one',
    label: 'ONE',
    region: 'r1',
    x: 20,
    y: 20,
    r: 7,
    colour: 'green',
    caption: 'above',
    reads: ['sw.a'],
    lit: () => true,
    ...over,
  };
}

function build(indicators: IndicatorSpec[]) {
  return defineIndicators(FIXTURE_REGISTRY, { indicators });
}

function expectRejected(build_: () => unknown, needle: string): void {
  expect(build_).toThrow(IndicatorError);
  expect(build_).toThrow(needle);
}

const SWITCH_DEF = FIXTURE_REGISTRY.get('sw.a');

describe('defineIndicators invariants', () => {
  it('accepts a well-formed lamp', () => {
    const set = build([lamp()]);
    expect(set.inRegion('r1')).toHaveLength(1);
    expect(set.inRegion('r2')).toHaveLength(0);
  });

  it('rejects an id without the lt. prefix', () => {
    expectRejected(() => build([lamp({ id: 'ind.one' })]), 'ind.one');
  });

  it('rejects a duplicate id', () => {
    expectRejected(() => build([lamp(), lamp()]), 'lt.one');
  });

  it('rejects an id equal to a control id (a registry that knows the id)', () => {
    // The kind prefix rule keeps a real registry from holding an lt. control; the check is a
    // second line of defence, so it is exercised with a registry stub that answers for the id.
    const stub = {
      ...FIXTURE_REGISTRY,
      get: (id: string) => (id === 'lt.same' ? SWITCH_DEF : FIXTURE_REGISTRY.get(id)),
    };
    expect(() => defineIndicators(stub, { indicators: [lamp({ id: 'lt.same' })] })).toThrow(
      'lt.same',
    );
  });

  it('rejects an unknown region', () => {
    expectRejected(() => build([lamp({ region: 'nowhere' })]), 'nowhere');
  });

  it('rejects an empty reads list and a read that is not a control', () => {
    expectRejected(() => build([lamp({ reads: [] })]), 'lt.one');
    expectRejected(() => build([lamp({ reads: ['sw.missing'] })]), 'sw.missing');
  });

  it('rejects a lamp disc outside its region', () => {
    expectRejected(() => build([lamp({ x: 4 })]), 'outside');
    expectRejected(() => build([lamp({ y: 97 })]), 'outside');
    expectRejected(() => build([lamp({ r: 0 })]), 'lt.one');
  });
});

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

describe('lamp art', () => {
  it('the lit fill is at least 3:1 brighter than the unlit fill for every colour', () => {
    for (const [name, c] of Object.entries(LAMP_COLOURS)) {
      const ratio = (luminance(c.lit) + 0.05) / (luminance(c.unlit) + 0.05);
      expect(ratio, name).toBeGreaterThanOrEqual(3);
    }
  });

  it('LampBody has at most 40 elements, lit and unlit', () => {
    for (const colour of ['green', 'red', 'white'] as const) {
      for (const lit of [true, false]) {
        const tree = expand(
          LampBody({ label: 'T/O 133 KIAS', colour, r: 7, lit, caption: 'right' }),
        );
        expect(countElements(tree), `${colour} ${String(lit)}`).toBeLessThanOrEqual(40);
      }
    }
  });

  it('lit lamps have a thicker ring than unlit lamps (state without colour)', () => {
    const strokes = (lit: boolean) =>
      JSON.stringify(
        expand(LampBody({ label: 'X', colour: 'green', r: 7, lit, caption: 'above' })),
      );
    expect(strokes(true)).toContain('"stroke-width":2');
    expect(strokes(false)).not.toContain('"stroke-width":2');
  });

  it('IndicatorLight.tsx uses only the font sizes 6, 8, 10, 14', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../src/ui/panel/widgets/IndicatorLight.tsx', import.meta.url)),
      'utf8',
    );
    const sizes = [...source.matchAll(/font-size=\{(\d+(?:\.\d+)?)\}/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect([6, 8, 10, 14]).toContain(size);
  });
});
