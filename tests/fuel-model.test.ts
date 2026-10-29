import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import {
  DA50RG_PHYSICS,
  FUEL_SUPPLY_GPH,
  FUEL_TEMP_LH_OFFSET_C,
  FUEL_TRANSFER_PER_MIN,
} from '../src/aircraft/da50rg/physics';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import type { PhysicsInputs } from '../src/engine/physics';
import { initialQuantities } from '../src/engine/predicates';
import { Run } from '../src/engine/run';
import { STEP_MS, simSetup, simulate } from '../src/engine/sim';
import type { SimEvent } from '../src/engine/sim';
import { PanelStore } from '../src/engine/store';
import { checkScenario } from '../src/scenario/lint';

// The fuel model of Phase 6 (plan 06-01; D-04, D-04a to D-04d): which tank the FUEL selector draws,
// the supply, burn and return flow, starvation, the fuel flow and the gallons used, and the two
// fuel temperatures with the OAT and delta parameters. Expected rates are computed from the exported
// constants and the quantity data; the burn line comes from the two owner readings.

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = checkScenario(
  readFileSync(`${root}scenarios/engine/eng-oil-temp-green.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checked.ok) throw new Error('the blueprint does not pass the scenario check');
const scenario = { ...checked.scenario, parameters: {} };

const MINUTE = 60_000;
const LEFT = 'fuel_qty_lh_gal';
const RIGHT = 'fuel_qty_rh_gal';
const USED = 'fuel_used_gal';
const FLOW = 'fuel_flow_gph';
const TEMP_LEFT = 'fuel_temp_lh_c';
const TEMP_RIGHT = 'fuel_temp_rh_c';

/** The two readings of the owner (first live test, 2026-10-23): the burn line follows from them. */
const OWNER_LOW = { percent: 60, gph: 10.1 };
const OWNER_HIGH = { percent: 75, gph: 11.8 };
const SLOPE = (OWNER_HIGH.gph - OWNER_LOW.gph) / (OWNER_HIGH.percent - OWNER_LOW.percent);
/** The burn in gallons per minute at a POWER travel in percent. */
const burnPerMinute = (percent: number): number =>
  (OWNER_LOW.gph + SLOPE * (percent - OWNER_LOW.percent)) / 60;
const CRUISE_PERCENT = 70;
const SUPPLY_PER_MINUTE = FUEL_SUPPLY_GPH / 60;

const def = (id: string) => {
  const found = DA50RG_QUANTITIES.get(id);
  if (found === undefined) throw new Error(`no quantity ${id}`);
  return found;
};
const CAPACITY = def(LEFT).max;
const BASE_TANK = def(LEFT).base;

const setup = simSetup(DA50RG_ENV, scenario);
const start = initialQuantities(scenario, DA50RG_ENV.quantities);

const withControls = (
  controls: Record<string, string>,
  parameters: Record<string, number> = {},
) => {
  const given = { ...scenario, initial: { controls, quantities: {} }, parameters };
  return {
    setup: simSetup(DA50RG_ENV, given),
    start: initialQuantities(given, DA50RG_ENV.quantities),
  };
};

/** The quantities after `ms` virtual milliseconds, from the base values plus `from`. */
function settle(
  controls: Record<string, string>,
  ms: number,
  options: {
    parameters?: Record<string, number>;
    from?: Record<string, number>;
    events?: SimEvent[];
  } = {},
): Readonly<Record<string, number>> {
  const given = withControls(controls, options.parameters);
  return simulate(given.setup, {
    events: options.events ?? [],
    start: { ...given.start, ...options.from },
    untilMs: ms,
  }).state.quantities;
}

const q = (values: Readonly<Record<string, number>>, id: string): number => {
  const value = Object.hasOwn(values, id) ? values[id] : undefined;
  if (value === undefined) throw new Error(`no quantity ${id}`);
  return value;
};

const EMERGENCY = { 'sw.fuel_valve': 'emergency' };
const OFF = { 'sw.fuel_valve': 'off' };
const TRANS = { 'sw.fuel_trans': 'on' };

describe('the tank the FUEL selector draws', () => {
  it('NORMAL: the left tank falls by the burn, the right tank is unchanged', () => {
    const after = settle({}, 5 * MINUTE);
    expect(q(after, LEFT)).toBeCloseTo(BASE_TANK - 5 * burnPerMinute(CRUISE_PERCENT), 2);
    expect(q(after, RIGHT)).toBe(BASE_TANK);
  });

  it('OFF: nothing moves and the flow is 0', () => {
    const after = settle(OFF, 5 * MINUTE);
    expect(q(after, LEFT)).toBe(BASE_TANK);
    expect(q(after, RIGHT)).toBe(BASE_TANK);
    expect(q(after, FLOW)).toBe(0);
    expect(q(after, USED)).toBe(def(USED).base);
  });

  it('EMERGENCY: the right tank loses the supply flow, the left tank gains supply less burn', () => {
    const after = settle(EMERGENCY, MINUTE);
    expect(BASE_TANK - q(after, RIGHT)).toBeCloseTo(SUPPLY_PER_MINUTE, 2);
    expect(BASE_TANK - q(after, RIGHT)).toBeGreaterThan(burnPerMinute(CRUISE_PERCENT));
    expect(q(after, LEFT) - BASE_TANK).toBeCloseTo(
      SUPPLY_PER_MINUTE - burnPerMinute(CRUISE_PERCENT),
      2,
    );
  });

  it('EMERGENCY: the two tanks together lose exactly the burn (0.01 gal over five minutes)', () => {
    const after = settle(EMERGENCY, 5 * MINUTE);
    const lost = 2 * BASE_TANK - q(after, LEFT) - q(after, RIGHT);
    expect(Math.abs(lost - 5 * burnPerMinute(CRUISE_PERCENT))).toBeLessThan(0.01);
  });

  it('EMERGENCY with the left tank full: the right tank loses only the burn, the left stays full', () => {
    const after = settle(EMERGENCY, 5 * MINUTE, { from: { [LEFT]: CAPACITY } });
    expect(q(after, LEFT)).toBe(CAPACITY);
    expect(BASE_TANK - q(after, RIGHT)).toBeCloseTo(5 * burnPerMinute(CRUISE_PERCENT), 2);
  });

  it('EMERGENCY fills the left tank to its capacity and no further, fuel is neither made nor lost', () => {
    const after = settle(EMERGENCY, 10 * MINUTE, { from: { [LEFT]: CAPACITY - 1 } });
    expect(q(after, LEFT)).toBeLessThanOrEqual(CAPACITY);
    expect(q(after, LEFT)).toBeGreaterThan(CAPACITY - 0.01);
    const lost = BASE_TANK + CAPACITY - 1 - q(after, LEFT) - q(after, RIGHT);
    expect(Math.abs(lost - 10 * burnPerMinute(CRUISE_PERCENT))).toBeLessThan(0.01);
  });

  it('FUEL TRANS and EMERGENCY together: the rates add', () => {
    const after = settle({ ...EMERGENCY, ...TRANS }, MINUTE);
    expect(BASE_TANK - q(after, RIGHT)).toBeCloseTo(SUPPLY_PER_MINUTE + FUEL_TRANSFER_PER_MIN, 2);
    expect(q(after, LEFT) - BASE_TANK).toBeCloseTo(
      SUPPLY_PER_MINUTE - burnPerMinute(CRUISE_PERCENT) + FUEL_TRANSFER_PER_MIN,
      2,
    );
  });

  it('no tank leaves 0 to its capacity, whatever the controls', () => {
    for (const controls of [{ ...EMERGENCY, ...TRANS }, TRANS, EMERGENCY, {}]) {
      for (const from of [
        { [LEFT]: CAPACITY - 0.3, [RIGHT]: 0.3 },
        { [LEFT]: 0.3, [RIGHT]: CAPACITY - 0.3 },
      ]) {
        const after = settle(controls, 10 * MINUTE, { from });
        for (const id of [LEFT, RIGHT]) {
          expect(q(after, id), id).toBeGreaterThanOrEqual(0);
          expect(q(after, id), id).toBeLessThanOrEqual(CAPACITY);
        }
      }
    }
  });
});

describe('starvation', () => {
  it('an empty drawn tank stops the engine, switching to the other tank brings it back', () => {
    const base = def('rpm').base;
    const running = settle({}, MINUTE);
    expect(q(running, 'rpm')).toBe(base);

    const starved = settle({}, MINUTE, { from: { [LEFT]: 0 } });
    expect(q(starved, LEFT)).toBe(0);
    expect(q(starved, 'rpm')).toBeLessThan(base / 4);
    expect(q(starved, FLOW)).toBe(0);

    const switched = settle({}, 2 * MINUTE, {
      from: { [LEFT]: 0 },
      events: [{ t: MINUTE, id: 'sw.fuel_valve', value: 'emergency' }],
    });
    expect(q(switched, 'rpm')).toBeGreaterThan(base * 0.9);
    expect(q(switched, FLOW)).toBeGreaterThan(0);
    expect(q(switched, RIGHT)).toBeLessThan(BASE_TANK);
  });

  it('the engine stops when the drawn tank runs dry during the run', () => {
    const after = settle({}, 3 * MINUTE, { from: { [LEFT]: 0.05 } });
    expect(q(after, LEFT)).toBe(0);
    expect(q(after, 'rpm')).toBeLessThan(def('rpm').base / 4);
    expect(q(after, FLOW)).toBe(0);
  });
});

describe('fuel flow and gallons used', () => {
  it('reads the owner points: 10.1 gph at lever 60 percent, 11.8 gph at 75 percent, 0 stopped', () => {
    expect(q(settle({ 'lv.power': 'p60' }, 5 * STEP_MS), FLOW)).toBeCloseTo(OWNER_LOW.gph, 2);
    expect(q(settle({ 'lv.power': 'p75' }, 5 * STEP_MS), FLOW)).toBeCloseTo(OWNER_HIGH.gph, 2);
    expect(q(settle({ 'sw.engine_master': 'off' }, 5 * STEP_MS), FLOW)).toBe(0);
  });

  it('the base is the cruise equilibrium of the line', () => {
    expect(def(FLOW).base).toBeCloseTo(burnPerMinute(CRUISE_PERCENT) * 60, 2);
    expect(q(settle({}, 5 * STEP_MS), FLOW)).toBe(def(FLOW).base);
  });

  it('the gallons used rise by exactly the tank loss while running', () => {
    // Two minutes keep every tank clear of its bounds (the clamp would absorb a step's overshoot).
    for (const controls of [{}, EMERGENCY, { ...EMERGENCY, ...TRANS }]) {
      const after = settle(controls, 2 * MINUTE);
      const lost = 2 * BASE_TANK - q(after, LEFT) - q(after, RIGHT);
      const used = q(after, USED) - def(USED).base;
      // FUEL TRANS moves fuel between the tanks and loses none.
      expect(Math.abs(used - lost), JSON.stringify(controls)).toBeLessThan(0.001);
      expect(used).toBeCloseTo(2 * burnPerMinute(CRUISE_PERCENT), 2);
    }
  });
});

describe('fuel temperatures (D-04c, D-04d)', () => {
  const TEN_TIME_CONSTANTS = 12 * MINUTE;
  const MIN = def(TEMP_LEFT).bands[0]?.to ?? Number.NaN;
  const MAX = def(TEMP_LEFT).bands.find((b) => b.id === 'high_yellow')?.to ?? Number.NaN;

  it('settle at the OAT plus the offset (left) and the delta below that (right): 23 and 20 at normal', () => {
    const normal = settle({}, TEN_TIME_CONSTANTS);
    expect(q(normal, TEMP_LEFT)).toBe(def(TEMP_LEFT).base);
    expect(q(normal, TEMP_RIGHT)).toBe(def(TEMP_RIGHT).base);
    const oat = DA50RG_PHYSICS.normalParameters()['oat_c'] ?? Number.NaN;
    const delta = DA50RG_PHYSICS.normalParameters()['fuel_temp_delta_c'] ?? Number.NaN;
    expect(q(normal, TEMP_LEFT)).toBe(oat + FUEL_TEMP_LH_OFFSET_C);
    expect(q(normal, TEMP_RIGHT)).toBe(oat + FUEL_TEMP_LH_OFFSET_C - delta);
  });

  it('follow the OAT: 3 and 0 degrees at an OAT of -5', () => {
    const cold = settle({}, TEN_TIME_CONSTANTS, { parameters: { oat_c: -5 } });
    expect(q(cold, TEMP_LEFT)).toBeCloseTo(-5 + FUEL_TEMP_LH_OFFSET_C, 1);
    expect(q(cold, TEMP_RIGHT)).toBeCloseTo(-5 + FUEL_TEMP_LH_OFFSET_C - 3, 1);
  });

  it('a negative delta reverses the situation: the right tank is the warmer one', () => {
    const reversed = settle({}, TEN_TIME_CONSTANTS, { parameters: { fuel_temp_delta_c: -4 } });
    expect(q(reversed, TEMP_RIGHT) - q(reversed, TEMP_LEFT)).toBeCloseTo(4, 1);
  });

  it('a scenario profile with a reversed delta is in force from the first second, also before a Realistic onset (plan 06-03)', () => {
    const profiled = { ...scenario, profile: { fuel_temp_delta_c: -4 } };
    const onset = { window_s: [2, 6], quantities: {}, parameters: {}, controls: {}, cues: [] };
    const realistic = { ...profiled, onset } as unknown as typeof profiled;
    for (const [given, onsetAt] of [
      [profiled, undefined],
      [realistic, 20 * MINUTE],
    ] as const) {
      const profileSetup = simSetup(DA50RG_ENV, given, onsetAt === undefined ? {} : { onsetAt });
      const profileStart = initialQuantities(given, DA50RG_ENV.quantities);
      const first = simulate(profileSetup, { events: [], start: profileStart, untilMs: STEP_MS });
      // The right tank warms from its base toward the left tank plus 4 right away.
      expect(q(first.state.quantities, TEMP_RIGHT)).toBeGreaterThan(def(TEMP_RIGHT).base);
      const settled = simulate(profileSetup, {
        events: [],
        start: profileStart,
        untilMs: TEN_TIME_CONSTANTS,
      }).state.quantities;
      expect(q(settled, TEMP_RIGHT) - q(settled, TEMP_LEFT)).toBeCloseTo(4, 1);
    }
  });

  it('the lower limit holds at the lowest OAT', () => {
    const cold = settle({}, TEN_TIME_CONSTANTS, { parameters: { oat_c: -40 } });
    expect(q(cold, TEMP_LEFT)).toBeCloseTo(MIN, 1);
    expect(q(cold, TEMP_RIGHT)).toBeCloseTo(MIN, 1);
  });

  it('both limits hold for every parameter in range (the targets never enter a red zone)', () => {
    const inputsFor = (parameters: Record<string, number>): PhysicsInputs => ({
      controls: setup.baseline,
      parameters: { ...DA50RG_PHYSICS.normalParameters(), ...parameters },
      quantities: start,
      flags: {},
    });
    const targetOf = (id: string, inputs: PhysicsInputs): number => {
      const model = DA50RG_PHYSICS.models.find((m) => m.quantity === id);
      if (model?.mode !== 'lag') throw new Error(`no lag model of ${id}`);
      return model.target(inputs);
    };
    const oat = DA50RG_PHYSICS.parameter('oat_c');
    const delta = DA50RG_PHYSICS.parameter('fuel_temp_delta_c');
    if (oat === undefined || delta === undefined) throw new Error('missing parameter');
    for (let o = oat.min; o <= oat.max; o += 5) {
      for (const d of [delta.min, 0, delta.normal, delta.max]) {
        const inputs = inputsFor({ oat_c: o, fuel_temp_delta_c: d });
        for (const id of [TEMP_LEFT, TEMP_RIGHT]) {
          const target = targetOf(id, inputs);
          expect(target, `${id} oat ${o} delta ${d}`).toBeGreaterThanOrEqual(MIN);
          expect(target, `${id} oat ${o} delta ${d}`).toBeLessThanOrEqual(MAX);
        }
      }
    }
  });

  it('the engine-off targets of oil, coolant and gearbox follow the OAT and are unchanged at normal', () => {
    const off = { ...setup.baseline, 'sw.engine_master': 'off' };
    const targetAt = (id: string, oatC: number): number => {
      const model = DA50RG_PHYSICS.models.find((m) => m.quantity === id);
      if (model?.mode !== 'lag') throw new Error(`no lag model of ${id}`);
      return model.target({
        controls: off,
        parameters: { ...DA50RG_PHYSICS.normalParameters(), oat_c: oatC },
        quantities: start,
        flags: {},
      });
    };
    const normal = DA50RG_PHYSICS.normalParameters()['oat_c'] ?? Number.NaN;
    for (const id of ['oil_temp_c', 'coolant_temp_c', 'gearbox_temp_c']) {
      expect(targetAt(id, normal), id).toBe(normal);
      expect(targetAt(id, -5), id).toBe(-5);
      expect(targetAt(id, 30), id).toBe(30);
    }
  });
});

describe('a live run equals its replay', () => {
  it('at every step over a log with FUEL TRANS, EMERGENCY and back, and a power down', () => {
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const run = new Run({ setup, store, start });
    const script: Record<number, [string, string]> = {
      10: ['sw.fuel_trans', 'on'],
      40: ['sw.fuel_valve', 'emergency'],
      90: ['sw.fuel_valve', 'normal'],
      130: ['sw.fuel_trans', 'off'],
      160: ['sw.engine_master', 'off'],
    };
    for (let n = 1; n <= 220; n += 1) {
      const action = script[n];
      if (action !== undefined) {
        const result = store.dispatch(action[0], action[1], run.clock.now());
        if (!result.ok) throw new Error(`${action[0]} -> ${action[1]} rejected: ${result.reason}`);
      }
      run.step();
      const replay = simulate(setup, {
        events: store.events(),
        start,
        untilMs: run.state.t,
      }).state;
      expect(run.state, `step ${n}`).toEqual(replay);
    }
    // The script moved fuel: the log was not a no-op.
    expect(q(run.state.quantities, USED)).toBeGreaterThan(def(USED).base);
    expect(q(run.state.quantities, LEFT)).not.toBe(BASE_TANK);
    run.dispose();
  });
});
