import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import {
  OIL_PRESSURE_IDLE_CURVE,
  OIL_PRESSURE_SLOPE_CURVE,
} from '../src/aircraft/da50rg/oil-pressure-curve';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_PHYSICS } from '../src/aircraft/da50rg/physics';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { interpolate } from '../src/engine/curve';
import type { PhysicsInputs } from '../src/engine/physics';
import { baselineOf, initialQuantities, travelPercent } from '../src/engine/predicates';
import { Run } from '../src/engine/run';
import { simSetup, simulate } from '../src/engine/sim';
import { PanelStore } from '../src/engine/store';
import { checkScenario } from '../src/scenario/lint';

// The oil pressure of Phase 6 (plan 06-04; O-01, O-02, D-10): the model target is the table value at
// idle for the live oil temperature plus the table slope times the lever travel. Every expectation
// is read through the model's own target function at a FIXED oil temperature, so the cases do not
// depend on how fast the oil heats; band bounds come from the quantity data, never typed in.

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = checkScenario(
  readFileSync(`${root}scenarios/engine/eng-oil-temp-green.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checked.ok) throw new Error('the blueprint does not pass the scenario check');
const scenario = checked.scenario;

const PRESSURE = 'oil_pressure_bar';
const OIL = 'oil_temp_c';
const def = DA50RG_QUANTITIES.get(PRESSURE);
if (def === undefined) throw new Error('no oil pressure quantity');
const bandTop = (id: string): number => {
  const found = def.bands.find((b) => b.id === id);
  if (found === undefined) throw new Error(`no band ${id}`);
  return found.to;
};
const greenBottom = bandTop('low_yellow');
const greenTop = bandTop('green');
/** The lower third of the green band, computed from the band table: bottom plus a third of its height. */
const lowerThirdTop = greenBottom + (greenTop - greenBottom) / 3;

const POWER = DA50RG.get('lv.power');
if (POWER?.kind !== 'detent-lever') throw new Error('no POWER lever');
const LEVERS = POWER.detents.map((d) => d.id);
const IDLE = 'p0';
const CRUISE = POWER.default;
const travel = (lever: string): number => travelPercent(POWER, lever);

const model = DA50RG_PHYSICS.models.find((m) => m.quantity === PRESSURE);
if (model?.mode !== 'lag') throw new Error('no lag model of the oil pressure');
const base = DA50RG_QUANTITIES.baseValues();
const defaults = baselineOf({ ...scenario, initial: { controls: {}, quantities: {} } }, DA50RG);

/** The model's target pressure at a fixed oil temperature, lever and engine state. */
const targetAt = (oilC: number, lever: string, controls: Record<string, string> = {}): number => {
  const inputs: PhysicsInputs = {
    controls: { ...defaults, 'lv.power': lever, ...controls },
    parameters: DA50RG_PHYSICS.normalParameters(),
    quantities: { ...base, [OIL]: oilC },
    flags: {},
  };
  return model.target(inputs);
};
/** The band the (quantised) reading falls into. */
const bandOf = (value: number): string | undefined => DA50RG_QUANTITIES.bandOf(PRESSURE, value);

const HOT_C = 125;
const COLD_C = [15, 30];
const COLDEST_C = -25;
const tablePoints = [
  ...new Set([...OIL_PRESSURE_IDLE_CURVE, ...OIL_PRESSURE_SLOPE_CURVE].map((p) => p.x)),
].sort((a, b) => a - b);

describe('the anchor and the engine off', () => {
  it('oil at the base reading and the cruise lever give the base pressure (C-09)', () => {
    const oilBase = base[OIL] ?? Number.NaN;
    expect(targetAt(oilBase, CRUISE)).toBeCloseTo(base[PRESSURE] ?? Number.NaN, 9);
  });

  it('the engine stopped gives 0, whatever the oil temperature and the lever', () => {
    for (const oil of [COLDEST_C, 91, HOT_C]) {
      const stops: Record<string, string>[] = [
        { 'sw.engine_master': 'off' },
        { 'sw.fuel_valve': 'off' },
      ];
      for (const stopped of stops) {
        expect(targetAt(oil, 'p70', stopped), `${String(oil)} ${JSON.stringify(stopped)}`).toBe(0);
      }
    }
  });
});

describe('hot oil (owner, D-10)', () => {
  it('at the cruise lever the pressure lies in the lower third of the green band', () => {
    const value = targetAt(HOT_C, CRUISE);
    expect(value).toBeGreaterThan(greenBottom);
    expect(value).toBeLessThanOrEqual(lowerThirdTop);
    expect(bandOf(value)).toBe('green');
  });

  it('at idle it is not lower than the table says, never red, and may be in the low yellow band', () => {
    const value = targetAt(HOT_C, IDLE);
    expect(value).toBe(interpolate(OIL_PRESSURE_IDLE_CURVE, HOT_C));
    expect(value).toBeGreaterThan(bandTop('low_red'));
    expect(['low_yellow', 'green']).toContain(bandOf(value));
  });

  it('never reaches a red band for any hot oil temperature at any lever', () => {
    for (const oil of tablePoints.filter((x) => x >= 91)) {
      for (const lever of LEVERS) {
        expect(bandOf(targetAt(oil, lever)), `${String(oil)} ${lever}`).not.toMatch(/red/);
      }
    }
  });
});

describe('a cold engine (owner, D-10)', () => {
  it('at idle it is in the high yellow band', () => {
    for (const oil of COLD_C) {
      expect(bandOf(targetAt(oil, IDLE)), `oil ${String(oil)}`).toBe('high_yellow');
    }
  });

  it('at the coldest table point and idle it is not below the high yellow band', () => {
    expect(targetAt(COLDEST_C, IDLE)).toBeGreaterThan(greenTop);
  });

  it('with the lever at 25 percent or more it is in the high red band', () => {
    for (const oil of COLD_C) {
      for (const lever of LEVERS.filter((l) => travel(l) >= 25)) {
        expect(bandOf(targetAt(oil, lever)), `oil ${String(oil)} ${lever}`).toBe('high_red');
      }
    }
  });

  it('one lever step above idle on a cold engine raises it, and it stays inside the quantity range', () => {
    const [idle, next] = LEVERS;
    if (idle === undefined || next === undefined) throw new Error('no lever steps');
    for (const oil of COLD_C) {
      expect(targetAt(oil, next)).toBeGreaterThan(targetAt(oil, idle));
    }
    // The stepper clamps the reading to the range; the target itself may lie above it.
    expect(def.max).toBeGreaterThan(bandTop('high_yellow'));
  });
});

describe('the dependence on the lever and on the oil temperature', () => {
  it('at a fixed oil temperature the pressure rises with the lever at every point of the table', () => {
    for (const oil of tablePoints) {
      let previous = -Infinity;
      for (const lever of LEVERS) {
        const value = targetAt(oil, lever);
        expect(value, `oil ${String(oil)} ${lever}`).toBeGreaterThan(previous);
        previous = value;
      }
    }
  });

  it('at a fixed lever it falls as the oil gets hotter from 30 degrees up, between the points too', () => {
    const from = 30;
    const temps = [];
    for (let t = from; t <= 150; t += 2.5) temps.push(t);
    for (const lever of LEVERS) {
      let previous = Infinity;
      for (const oil of temps) {
        const value = targetAt(oil, lever);
        expect(value, `oil ${String(oil)} ${lever}`).toBeLessThan(previous);
        previous = value;
      }
    }
  });

  it('both tables are finite and the slope is above 0 everywhere (defineCurve checks the order)', () => {
    for (const point of [...OIL_PRESSURE_IDLE_CURVE, ...OIL_PRESSURE_SLOPE_CURVE]) {
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
    }
    for (const point of OIL_PRESSURE_SLOPE_CURVE) expect(point.y).toBeGreaterThan(0);
  });
});

describe('the ENG OIL TEMP situation (O-02)', () => {
  const start = initialQuantities(scenario, DA50RG_ENV.quantities);
  const oil = start[OIL] ?? Number.NaN;
  const lever = scenario.initial.controls['lv.power'] ?? CRUISE;

  it('starts at the model equilibrium of its oil temperature and lever, in the green band', () => {
    const settled = targetAt(oil, lever);
    expect(start[PRESSURE]).toBeCloseTo(settled, 2);
    expect(bandOf(start[PRESSURE] ?? Number.NaN)).toBe('green');
  });

  it('keeps the reading inside the green band over the first 20 s of an ignored run', () => {
    const setup = simSetup(DA50RG_ENV, scenario);
    for (let ms = 0; ms <= 20_000; ms += 5_000) {
      const state = simulate(setup, { events: [], start, untilMs: ms }).state;
      expect(bandOf(state.quantities[PRESSURE] ?? Number.NaN), `t ${String(ms)}`).toBe('green');
    }
  });
});

describe('a live run equals its replay', () => {
  it('at sampled steps over a log with a power change and an engine stop', () => {
    const setup = simSetup(DA50RG_ENV, scenario);
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const run = new Run({ setup, store, start });
    const script: Record<number, [string, string]> = {
      20: ['lv.power', 'p0'],
      90: ['lv.power', 'p100'],
      150: ['sw.engine_master', 'off'],
    };
    for (let n = 1; n <= 220; n += 1) {
      const action = script[n];
      if (action !== undefined) {
        const result = store.dispatch(action[0], action[1], run.clock.now());
        if (!result.ok) throw new Error(`${action[0]} -> ${action[1]} rejected: ${result.reason}`);
      }
      run.step();
      if (n % 11 === 0 || n === 21 || n === 151) {
        const replay = simulate(setup, {
          events: store.events(),
          start,
          untilMs: run.state.t,
        }).state;
        expect(run.state, `step ${String(n)}`).toEqual(replay);
      }
    }
    // The script moved the pressure: the engine stop drove it toward 0.
    expect(run.state.quantities[PRESSURE]).toBeLessThan(greenBottom);
    run.dispose();
  });
});
