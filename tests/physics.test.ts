import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_PHYSICS } from '../src/aircraft/da50rg/physics';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { PhysicsError, definePhysics } from '../src/engine/physics';
import type {
  PhysicsInputs,
  PhysicsSpec,
  QuantityModel,
  ReactionSpec,
} from '../src/engine/physics';
import { baselineOf, initialQuantities } from '../src/engine/predicates';
import { MAX_RUN_MS, STEP_MS, simSetup, simulate } from '../src/engine/sim';
import type { SimEvent } from '../src/engine/sim';
import { checkScenario } from '../src/scenario/lint';

// definePhysics validation and the DA50 RG oil temperature model (plan 03-01; D-01, D-02, C-03,
// C-05, Table P1). The model relations are tested through the model's own target function; the
// green band bounds come from DA50RG_QUANTITIES, the degraded cooling from the blueprint file.

const env = { registry: DA50RG, quantities: DA50RG_QUANTITIES };
const OIL_TEMP = 'oil_temp_c';

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = checkScenario(
  readFileSync(`${root}scenarios/engine/eng-oil-temp-green.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checked.ok) throw new Error('the blueprint does not pass the scenario check');
const scenario = checked.scenario;
const DEGRADED = scenario.parameters['oil_cooling'];
if (DEGRADED === undefined) throw new Error('the blueprint sets no oil_cooling');
const START_TEMP = scenario.initial.quantities[OIL_TEMP];
if (START_TEMP === undefined) throw new Error('the blueprint sets no oil temperature');

const checkedFire = checkScenario(
  readFileSync(`${root}scenarios/engine/eng-fire-in-flight.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checkedFire.ok) throw new Error('the Engine Fire scenario does not pass the scenario check');
const fireScenario = checkedFire.scenario;
const FIRE_OUTCOME = fireScenario.outcomes[0];
if (FIRE_OUTCOME?.when.check !== 'quantity') throw new Error('the fire outcome reads no quantity');
/** The intensity at which the outcome of the fire scenario counts, read from the scenario file. */
const FIRE_THRESHOLD = FIRE_OUTCOME.when.value;

const GOOD_MODEL: QuantityModel = {
  quantity: OIL_TEMP,
  mode: 'lag',
  tauMs: 30_000,
  target: () => 90,
};
const spec = (overrides: Partial<PhysicsSpec> = {}): PhysicsSpec => ({
  parameters: [{ id: 'cooling', min: 0.2, max: 1, normal: 1 }],
  models: [GOOD_MODEL],
  ...overrides,
});

describe('definePhysics', () => {
  it('accepts a valid spec, resolves parameters through a Map and freezes the result', () => {
    const physics = definePhysics(spec(), env);
    expect(physics.parameter('cooling')).toEqual({ id: 'cooling', min: 0.2, max: 1, normal: 1 });
    expect(physics.parameter('constructor')).toBeUndefined();
    expect(physics.normalParameters()).toEqual({ cooling: 1 });
    expect(Object.isFrozen(physics)).toBe(true);
    expect(Object.isFrozen(physics.models)).toBe(true);
  });

  it('accepts a rate model and a quantity without a model', () => {
    const rate: QuantityModel = { quantity: OIL_TEMP, mode: 'rate', perMinute: () => 1 };
    expect(definePhysics(spec({ models: [rate] }), env).models).toHaveLength(1);
    expect(definePhysics(spec({ models: [] }), env).models).toHaveLength(0);
  });

  it('throws PhysicsError naming an unknown quantity', () => {
    const bad = { ...GOOD_MODEL, quantity: 'oil_nope' };
    expect(() => definePhysics(spec({ models: [bad] }), env)).toThrow(PhysicsError);
    expect(() => definePhysics(spec({ models: [bad] }), env)).toThrow(/oil_nope/);
  });

  it('throws for two models of one quantity', () => {
    expect(() => definePhysics(spec({ models: [GOOD_MODEL, GOOD_MODEL] }), env)).toThrow(
      /more than one model/,
    );
  });

  it('throws for a tauMs below STEP_MS or not finite', () => {
    for (const tauMs of [STEP_MS - 1, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const bad = { ...GOOD_MODEL, tauMs };
      expect(() => definePhysics(spec({ models: [bad] }), env), String(tauMs)).toThrow(
        PhysicsError,
      );
    }
    expect(() =>
      definePhysics(spec({ models: [{ ...GOOD_MODEL, tauMs: STEP_MS }] }), env),
    ).not.toThrow();
  });

  it('throws for a normal value outside its range and for a non-finite range', () => {
    const outside = [{ id: 'cooling', min: 0.2, max: 1, normal: 2 }];
    expect(() => definePhysics(spec({ parameters: outside }), env)).toThrow(/cooling/);
    const infinite = [{ id: 'cooling', min: 0, max: Number.POSITIVE_INFINITY, normal: 1 }];
    expect(() => definePhysics(spec({ parameters: infinite }), env)).toThrow(PhysicsError);
  });

  it('throws for a duplicate or malformed parameter id', () => {
    const one = { id: 'cooling', min: 0, max: 1, normal: 1 };
    expect(() => definePhysics(spec({ parameters: [one, one] }), env)).toThrow(/duplicate/);
    for (const id of ['Cooling', '1cooling', 'cool-ing', '']) {
      expect(() => definePhysics(spec({ parameters: [{ ...one, id }] }), env), id).toThrow(
        PhysicsError,
      );
    }
  });
});

describe('definePhysics reactions (plan 03-04, C-20)', () => {
  const GOOD_REACTION: ReactionSpec = {
    id: 'deice_max',
    on: { control: 'btn.deice_max', value: 'pressed' },
    when: () => true,
    flag: 'deice.max_active',
    durationMs: 2 * STEP_MS,
    clearsWhen: () => false,
  };
  const withReaction = (overrides: Partial<ReactionSpec>): PhysicsSpec =>
    spec({ reactions: [{ ...GOOD_REACTION, ...overrides }] });

  it('accepts a valid reaction, none at all, and freezes what it keeps', () => {
    const physics = definePhysics(spec({ reactions: [GOOD_REACTION] }), env);
    expect(physics.reactions).toHaveLength(1);
    expect(Object.isFrozen(physics.reactions)).toBe(true);
    expect(Object.isFrozen(physics.reactions[0])).toBe(true);
    expect(definePhysics(spec(), env).reactions).toEqual([]);
  });

  it('accepts the shortest and the longest legal duration', () => {
    expect(() => definePhysics(withReaction({ durationMs: STEP_MS }), env)).not.toThrow();
    expect(() => definePhysics(withReaction({ durationMs: MAX_RUN_MS }), env)).not.toThrow();
  });

  it('throws for a reaction armed by an unknown control', () => {
    const bad = withReaction({ on: { control: 'btn.nope', value: 'pressed' } });
    expect(() => definePhysics(bad, env)).toThrow(PhysicsError);
    expect(() => definePhysics(bad, env)).toThrow(/btn\.nope/);
  });

  it('throws for a reaction armed by an illegal state of a known control', () => {
    const bad = withReaction({ on: { control: 'btn.deice_max', value: 'held' } });
    expect(() => definePhysics(bad, env)).toThrow(PhysicsError);
    expect(() => definePhysics(bad, env)).toThrow(/held/);
  });

  it('throws for a duration below STEP_MS, above MAX_RUN_MS or not finite', () => {
    for (const durationMs of [
      0,
      STEP_MS - 1,
      -STEP_MS,
      MAX_RUN_MS + 1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() => definePhysics(withReaction({ durationMs }), env), String(durationMs)).toThrow(
        PhysicsError,
      );
    }
  });

  it('throws for a duplicate reaction id', () => {
    expect(() => definePhysics(spec({ reactions: [GOOD_REACTION, GOOD_REACTION] }), env)).toThrow(
      /duplicate reaction id "deice_max"/,
    );
  });

  it('throws for a malformed reaction id or flag name', () => {
    for (const id of ['Deice', '1deice', 'deice-max', 'deice.max', '']) {
      expect(() => definePhysics(withReaction({ id }), env), id).toThrow(PhysicsError);
    }
    for (const flag of ['Deice.max', 'deice..max', '.deice', 'deice.', 'deice max', '', 'DEICE']) {
      expect(() => definePhysics(withReaction({ flag }), env), flag).toThrow(PhysicsError);
    }
    expect(() => definePhysics(withReaction({ flag: 'gear' }), env)).not.toThrow();
  });

  it('the shipped reactions pass their own validation and name registry controls', () => {
    expect(DA50RG_PHYSICS.reactions.map((r) => r.id)).toContain('deice_max');
    for (const reaction of DA50RG_PHYSICS.reactions) {
      expect(DA50RG.get(reaction.on.control), reaction.id).toBeDefined();
      expect(reaction.durationMs, reaction.id).toBeGreaterThanOrEqual(STEP_MS);
      expect(reaction.durationMs, reaction.id).toBeLessThanOrEqual(MAX_RUN_MS);
    }
  });
});

describe('DA50 oil temperature model (Table P1)', () => {
  const model = DA50RG_PHYSICS.models.find((m) => m.quantity === OIL_TEMP);
  if (model?.mode !== 'lag') throw new Error('the oil temperature has no lag model');
  const base = baselineOf(scenario, DA50RG);

  /** The model's target for the given controls and cooling. */
  const target = (controls: Record<string, string>, cooling: number): number => {
    const inputs: PhysicsInputs = {
      controls: { ...base, ...controls },
      parameters: { oil_cooling: cooling },
      // The fire term of the model reads fire_intensity (plan 03-08): the base reading is 0.
      quantities: DA50RG_QUANTITIES.baseValues(),
      flags: {},
    };
    return model.target(inputs);
  };

  const green = DA50RG_QUANTITIES.get(OIL_TEMP)?.bands.find((b) => b.id === 'green');
  const bandIndex = DA50RG_QUANTITIES.get(OIL_TEMP)?.bands.findIndex((b) => b.id === 'green') ?? -1;
  const greenLow = DA50RG_QUANTITIES.get(OIL_TEMP)?.bands[bandIndex - 1]?.to ?? Number.NaN;
  const greenHigh = green?.to ?? Number.NaN;

  it('P1-a: the registry defaults at normal cooling settle inside the green band', () => {
    const a = target({ 'lv.power': 'p70', 'lv.cowl_flap': 'closed' }, 1);
    expect(a).toBeGreaterThan(greenLow);
    expect(a).toBeLessThanOrEqual(greenHigh);
  });

  it('P1-b: ignored at degraded cooling, the target is above 140', () => {
    expect(target({ 'lv.power': 'p75', 'lv.cowl_flap': 'closed' }, DEGRADED)).toBeGreaterThan(140);
  });

  it('P1-c: handled (POWER p50, cowl flap open) the target is at most 110, inside the green band', () => {
    const c = target({ 'lv.power': 'p50', 'lv.cowl_flap': 'open' }, DEGRADED);
    expect(c).toBeLessThanOrEqual(110);
    expect(c).toBeGreaterThan(greenLow);
    expect(c).toBeLessThanOrEqual(greenHigh);
  });

  it('P1-d and P1-e: power only and cowl only each stay below the ignored target', () => {
    const b = target({ 'lv.power': 'p75', 'lv.cowl_flap': 'closed' }, DEGRADED);
    expect(target({ 'lv.power': 'p60', 'lv.cowl_flap': 'closed' }, DEGRADED)).toBeLessThan(b);
    expect(target({ 'lv.power': 'p75', 'lv.cowl_flap': 'open' }, DEGRADED)).toBeLessThan(b);
  });

  it('with the engine master off the target is ambient, below the green band', () => {
    const off = target({ 'sw.engine_master': 'off' }, DEGRADED);
    expect(off).toBeLessThan(greenLow);
    expect(off).toBeGreaterThanOrEqual(DA50RG_QUANTITIES.get(OIL_TEMP)?.min ?? Number.NaN);
  });

  it('uses a time constant between 20 s and 60 s', () => {
    expect(model.tauMs).toBeGreaterThanOrEqual(20_000);
    expect(model.tauMs).toBeLessThanOrEqual(60_000);
  });

  it('the cooling parameter is declared with its normal value 1', () => {
    const def = DA50RG_PHYSICS.parameter('oil_cooling');
    expect(def?.normal).toBe(1);
    expect(def?.max).toBe(1);
    expect(def?.min).toBeGreaterThan(0);
    expect(DEGRADED).toBeGreaterThanOrEqual(def?.min ?? Number.NaN);
    expect(DEGRADED).toBeLessThan(def?.normal ?? Number.NaN);
  });

  const setup = simSetup(DA50RG_ENV, scenario);
  const start = initialQuantities(scenario, DA50RG_ENV.quantities);
  const after = (events: SimEvent[], ms: number): number =>
    simulate(setup, { events, start, untilMs: ms }).state.quantities[OIL_TEMP] ?? Number.NaN;

  it('P1-b: from the start value the ignored failure rises by at least 1 degree within 3 s', () => {
    expect(after([], 3000)).toBeGreaterThanOrEqual(START_TEMP + 1);
  });

  it('P1-c: after POWER p50 and the cowl flap open it falls by at least 1 degree within 3 s', () => {
    const handled: SimEvent[] = [
      { t: 0, id: 'lv.power', value: 'p50' },
      { t: 0, id: 'lv.cowl_flap', value: 'open' },
    ];
    expect(after(handled, 3000)).toBeLessThanOrEqual(START_TEMP - 1);
  });

  it('an engine shut down cools the oil toward ambient', () => {
    const off: SimEvent[] = [{ t: 0, id: 'sw.engine_master', value: 'off' }];
    expect(after(off, 60_000)).toBeLessThan(after([], 60_000));
    expect(after(off, 60_000)).toBeLessThan(START_TEMP);
  });
});

describe('DA50 RG models for every quantity (plan 03-02, Table P2, C-09)', () => {
  const baseValues = DA50RG_QUANTITIES.baseValues();
  const defaultsScenario = { ...scenario, parameters: {} };

  /** A setup at the registry defaults plus the given controls and parameters, normal otherwise. */
  const setupWith = (
    controls: Record<string, string> = {},
    parameters: Record<string, number> = {},
  ) => {
    const given = {
      ...defaultsScenario,
      initial: { controls, quantities: {} },
      parameters,
    };
    return {
      setup: simSetup(DA50RG_ENV, given),
      start: initialQuantities(given, DA50RG_ENV.quantities),
    };
  };

  /** The quantities after ms virtual milliseconds. */
  const settle = (
    controls: Record<string, string>,
    ms: number,
    options: {
      parameters?: Record<string, number>;
      start?: Record<string, number>;
      events?: SimEvent[];
    } = {},
  ): Readonly<Record<string, number>> => {
    const { setup, start } = setupWith(controls, options.parameters);
    return simulate(setup, {
      events: options.events ?? [],
      start: { ...start, ...options.start },
      untilMs: ms,
    }).state.quantities;
  };
  const q = (values: Readonly<Record<string, number>>, id: string): number => {
    const value = Object.hasOwn(values, id) ? values[id] : undefined;
    if (value === undefined) throw new Error(`no quantity ${id}`);
    return value;
  };
  const baseOf = (id: string): number => q(baseValues, id);
  const bandTop = (id: string, band: string): number => {
    const found = DA50RG_QUANTITIES.get(id)?.bands.find((b) => b.id === band);
    if (found === undefined) throw new Error(`no band ${band} of ${id}`);
    return found.to;
  };
  const MINUTE = 60_000;
  /** Off values are a small fraction of the running value (the 0.01 rounding stops a lag near 0). */
  const nearZero = (value: number, running: number): number => {
    expect(value).toBeLessThan(running / 4);
    return value;
  };

  it('every quantity has exactly one model', () => {
    const modelled = DA50RG_PHYSICS.models.map((m) => m.quantity).sort();
    expect(modelled).toEqual(DA50RG_QUANTITIES.all.map((d) => d.id).sort());
  });

  it('C-09: at the registry defaults every lag target equals the base', () => {
    const { setup, start } = setupWith();
    const inputs: PhysicsInputs = {
      controls: setup.baseline,
      parameters: setup.normalParameters,
      quantities: start,
      flags: {},
    };
    for (const model of DA50RG_PHYSICS.models) {
      if (model.mode === 'lag') {
        expect(model.target(inputs), model.quantity).toBeCloseTo(baseOf(model.quantity), 9);
      }
    }
  });

  it('C-09: 600 steps from the base leave every quantity but the two fuel quantities at its base', () => {
    const after = settle({}, 600 * STEP_MS);
    for (const def of DA50RG_QUANTITIES.all) {
      if (def.id.startsWith('fuel_qty')) continue;
      expect(q(after, def.id), def.id).toBe(def.base);
    }
  });

  it('the fuel quantities stay inside the green band at the defaults for a minute and fall slowly', () => {
    const after = settle({}, MINUTE);
    expect(q(after, 'fuel_qty_lh_gal')).toBeLessThan(baseOf('fuel_qty_lh_gal'));
    expect(q(after, 'fuel_qty_lh_gal')).toBeGreaterThan(bandTop('fuel_qty_lh_gal', 'low_red'));
    expect(q(after, 'fuel_qty_rh_gal')).toBe(baseOf('fuel_qty_rh_gal'));
  });

  it('no CAS rule fires at the base values with the controls at their defaults', () => {
    const { setup } = setupWith();
    const ctx = { controls: setup.baseline, baseline: setup.baseline, quantities: baseValues };
    expect(DA50RG_CAS.active(ctx, DA50RG_ENV)).toEqual([]);
  });

  describe('engine speed, load and pressures', () => {
    it('rpm rises with POWER 100 % and stays at most the top of its yellow band', () => {
      const cruise = settle({}, MINUTE);
      const full = settle({ 'lv.power': 'p100' }, MINUTE);
      expect(q(full, 'rpm')).toBeGreaterThan(q(cruise, 'rpm'));
      expect(q(full, 'rpm')).toBeLessThanOrEqual(bandTop('rpm', 'high_yellow'));
      expect(q(full, 'load_pct')).toBeGreaterThan(q(cruise, 'load_pct'));
    });

    it('load follows the POWER travel and oil pressure rises a little with the load', () => {
      const half = settle({ 'lv.power': 'p50' }, MINUTE);
      const full = settle({ 'lv.power': 'p100' }, MINUTE);
      expect(q(half, 'load_pct')).toBeLessThan(q(full, 'load_pct'));
      expect(q(half, 'oil_pressure_bar')).toBeLessThan(q(full, 'oil_pressure_bar'));
      expect(q(full, 'oil_pressure_bar')).toBeLessThanOrEqual(bandTop('oil_pressure_bar', 'green'));
    });

    it('ENGINE MASTER off drops rpm, load, oil pressure, fuel pressure and Amps', () => {
      const off = settle({ 'sw.engine_master': 'off' }, MINUTE);
      nearZero(q(off, 'rpm'), baseOf('rpm'));
      nearZero(q(off, 'load_pct'), baseOf('load_pct'));
      nearZero(q(off, 'oil_pressure_bar'), baseOf('oil_pressure_bar'));
      nearZero(q(off, 'fuel_pressure_bar'), baseOf('fuel_pressure_bar'));
      nearZero(q(off, 'alt1_amps'), baseOf('alt1_amps'));
    });

    it('the EMERG FUEL PUMP raises the fuel pressure inside green, also with the engine off', () => {
      const plain = settle({}, MINUTE);
      const pumped = settle({ 'sw.emerg_fuel_pump': 'on' }, MINUTE);
      expect(q(pumped, 'fuel_pressure_bar')).toBeGreaterThan(q(plain, 'fuel_pressure_bar'));
      expect(q(pumped, 'fuel_pressure_bar')).toBeLessThanOrEqual(
        bandTop('fuel_pressure_bar', 'green'),
      );
      const offPlain = settle({ 'sw.engine_master': 'off' }, MINUTE);
      const offPumped = settle({ 'sw.engine_master': 'off', 'sw.emerg_fuel_pump': 'on' }, MINUTE);
      expect(q(offPumped, 'fuel_pressure_bar')).toBeGreaterThan(q(offPlain, 'fuel_pressure_bar'));
      expect(q(offPumped, 'fuel_pressure_bar')).toBeLessThanOrEqual(
        bandTop('fuel_pressure_bar', 'green'),
      );
    });
  });

  describe('temperatures', () => {
    it('coolant and gearbox rise with the load', () => {
      const cruise = settle({}, 3 * MINUTE);
      const full = settle({ 'lv.power': 'p100' }, 3 * MINUTE);
      expect(q(full, 'coolant_temp_c')).toBeGreaterThan(q(cruise, 'coolant_temp_c'));
      expect(q(full, 'gearbox_temp_c')).toBeGreaterThan(q(cruise, 'gearbox_temp_c'));
      expect(q(full, 'fuel_temp_c')).toBeGreaterThan(q(cruise, 'fuel_temp_c'));
      const idle = settle({ 'lv.power': 'p0' }, 3 * MINUTE);
      expect(q(idle, 'fuel_temp_c')).toBeLessThan(q(cruise, 'fuel_temp_c'));
    });

    it('the coolant is lower with the cowl flap open', () => {
      const closed = settle({}, 3 * MINUTE);
      const open = settle({ 'lv.cowl_flap': 'open' }, 3 * MINUTE);
      expect(q(open, 'coolant_temp_c')).toBeLessThan(q(closed, 'coolant_temp_c'));
    });

    it('coolant and gearbox cool toward ambient with the engine off', () => {
      const running = settle({}, 3 * MINUTE);
      const off = settle({ 'sw.engine_master': 'off' }, 3 * MINUTE);
      expect(q(off, 'coolant_temp_c')).toBeLessThan(q(running, 'coolant_temp_c'));
      expect(q(off, 'gearbox_temp_c')).toBeLessThan(q(running, 'gearbox_temp_c'));
    });

    it('uses the time constant ranges of Table P2', () => {
      const tau = (id: string): number => {
        const model = DA50RG_PHYSICS.models.find((m) => m.quantity === id);
        if (model?.mode !== 'lag') throw new Error(`no lag model of ${id}`);
        return model.tauMs;
      };
      for (const id of ['rpm', 'oil_pressure_bar']) {
        expect(tau(id)).toBeGreaterThanOrEqual(1_000);
        expect(tau(id)).toBeLessThanOrEqual(3_000);
      }
      expect(tau('coolant_temp_c')).toBeGreaterThanOrEqual(20_000);
      expect(tau('coolant_temp_c')).toBeLessThanOrEqual(60_000);
      expect(tau('gearbox_temp_c')).toBeGreaterThanOrEqual(30_000);
      expect(tau('gearbox_temp_c')).toBeLessThanOrEqual(90_000);
      expect(tau('fuel_temp_c')).toBeGreaterThanOrEqual(60_000);
      expect(tau('fuel_temp_c')).toBeLessThanOrEqual(180_000);
    });
  });

  describe('fuel', () => {
    it('the left tank burns while running, more at POWER 100 % and nothing with the engine off', () => {
      const start = baseOf('fuel_qty_lh_gal');
      const cruise = q(settle({}, 10 * MINUTE), 'fuel_qty_lh_gal');
      const half = q(settle({ 'lv.power': 'p50' }, 10 * MINUTE), 'fuel_qty_lh_gal');
      const full = q(settle({ 'lv.power': 'p100' }, 10 * MINUTE), 'fuel_qty_lh_gal');
      expect(cruise).toBeLessThan(start);
      expect(full).toBeLessThan(cruise);
      expect(half).toBeGreaterThan(cruise);
      expect(q(settle({ 'sw.engine_master': 'off' }, 10 * MINUTE), 'fuel_qty_lh_gal')).toBe(start);
    });

    it('the burn is about a tenth of a gallon a minute at cruise', () => {
      const burned = baseOf('fuel_qty_lh_gal') - q(settle({}, 10 * MINUTE), 'fuel_qty_lh_gal');
      expect(burned / 10).toBeGreaterThan(0.05);
      expect(burned / 10).toBeLessThan(0.2);
    });

    it('FUEL TRANS on moves fuel from the right tank to the left one', () => {
      const off = settle({}, 2 * MINUTE);
      const on = settle({ 'sw.fuel_trans': 'on' }, 2 * MINUTE);
      expect(q(on, 'fuel_qty_lh_gal')).toBeGreaterThan(q(off, 'fuel_qty_lh_gal'));
      expect(q(on, 'fuel_qty_rh_gal')).toBeLessThan(q(off, 'fuel_qty_rh_gal'));
    });

    it('the transfer stops at the green top of the left tank and when the right tank is nearly empty', () => {
      const top = bandTop('fuel_qty_lh_gal', 'green');
      const full = settle({ 'sw.fuel_trans': 'on' }, 5 * MINUTE, {
        start: { fuel_qty_lh_gal: top - 0.5 },
      });
      // The transfer checks the level at the start of a step, so it may pass the bound by one step.
      expect(q(full, 'fuel_qty_lh_gal')).toBeLessThan(top + 0.01);
      const floor = bandTop('fuel_qty_rh_gal', 'low_red');
      const dry = settle({ 'sw.fuel_trans': 'on' }, 5 * MINUTE, {
        start: { fuel_qty_rh_gal: floor },
      });
      expect(q(dry, 'fuel_qty_rh_gal')).toBe(floor);
    });
  });

  describe('electrical bus (D-10)', () => {
    const failed = { alt1_output: 0 };

    it('alt1_output 0 drops the alternator current and the bus falls to the battery value', () => {
      const after = settle({}, 30_000, { parameters: failed });
      nearZero(q(after, 'alt1_amps'), baseOf('alt1_amps'));
      expect(q(after, 'bus_volts')).toBeLessThan(baseOf('bus_volts'));
      expect(q(after, 'bus_volts')).toBeLessThanOrEqual(
        22 + (4 * baseOf('battery_pct')) / 100 + 0.1,
      );
    });

    it('the battery then discharges and the bus voltage falls with it', () => {
      const early = settle({}, 20_000, { parameters: failed });
      const late = settle({}, 2 * MINUTE, { parameters: failed });
      expect(q(late, 'battery_pct')).toBeLessThan(q(early, 'battery_pct'));
      expect(q(late, 'bus_volts')).toBeLessThan(q(early, 'bus_volts'));
      const empty = settle({}, 6 * MINUTE, { parameters: failed });
      expect(q(empty, 'battery_pct')).toBe(0);
    });

    it('an empty-in-about-four-minutes battery: nearly empty after four minutes', () => {
      const after = settle({}, 4 * MINUTE, { parameters: failed });
      expect(q(after, 'battery_pct')).toBeLessThan(baseOf('battery_pct') / 10);
    });

    it('ESS BUS on with alternator 2 running brings the bus back and the battery charges again', () => {
      const drained = settle({}, 2 * MINUTE, { parameters: failed });
      const helped = settle({ 'sw.ess_bus': 'on' }, 2 * MINUTE, {
        parameters: failed,
        start: { battery_pct: q(drained, 'battery_pct'), bus_volts: q(drained, 'bus_volts') },
      });
      expect(q(helped, 'bus_volts')).toBeGreaterThan(q(drained, 'bus_volts'));
      expect(q(helped, 'bus_volts')).toBeGreaterThanOrEqual(baseOf('bus_volts') - 0.2);
      expect(q(helped, 'battery_pct')).toBeGreaterThan(q(drained, 'battery_pct'));
      expect(q(helped, 'alt2_amps')).toBeGreaterThan(baseOf('alt2_amps'));
    });

    it('alternator 2 alone does not supply the main bus while ESS BUS is off', () => {
      const after = settle({}, 30_000, { parameters: failed });
      expect(q(after, 'alt2_amps')).toBeCloseTo(baseOf('alt2_amps'), 1);
      expect(q(after, 'bus_volts')).toBeLessThan(baseOf('bus_volts'));
    });

    it('ALTERNATOR 1 off and cb.alt1 out act like a failed alternator 1', () => {
      const reference = settle({}, MINUTE, { parameters: failed });
      for (const controls of [{ 'sw.alternator_1': 'off' }, { 'cb.alt1': 'out' }] as Record<
        string,
        string
      >[]) {
        expect(settle(controls, MINUTE), Object.keys(controls).join()).toEqual(reference);
      }
    });

    it('alternator 2 off and cb.alt2 out drop its current and leave the bus on alternator 1', () => {
      for (const controls of [{ 'sw.alternator_2': 'off' }, { 'cb.alt2': 'out' }] as Record<
        string,
        string
      >[]) {
        const after = settle(controls, MINUTE);
        nearZero(q(after, 'alt2_amps'), baseOf('alt2_amps'));
        expect(q(after, 'bus_volts')).toBe(baseOf('bus_volts'));
        expect(q(after, 'alt1_amps')).toBe(baseOf('alt1_amps'));
      }
    });

    it('ELECT. MASTER off reads the scale minimum and leaves the battery alone', () => {
      const after = settle({ 'sw.elect_master': 'off' }, MINUTE);
      expect(q(after, 'bus_volts')).toBe(DA50RG_QUANTITIES.get('bus_volts')?.min);
      expect(q(after, 'battery_pct')).toBe(baseOf('battery_pct'));
      nearZero(q(after, 'alt1_amps'), baseOf('alt1_amps'));
    });

    it('the engine off takes the alternators away: the bus falls to the battery', () => {
      const after = settle({ 'sw.engine_master': 'off' }, MINUTE);
      expect(q(after, 'bus_volts')).toBeLessThan(baseOf('bus_volts'));
      expect(q(after, 'battery_pct')).toBeLessThan(baseOf('battery_pct'));
    });

    it('alt1_output is a parameter between 0 and 1 with the normal value 1', () => {
      const def = DA50RG_PHYSICS.parameter('alt1_output');
      expect(def).toEqual({ id: 'alt1_output', min: 0, max: 1, normal: 1 });
    });
  });

  describe('engine fire (plan 03-08, C-44)', () => {
    const FIRE = { engine_fire: 1 };
    const PUMP = { 'sw.emerg_fuel_pump': 'on' };
    const at = (values: Readonly<Record<string, number>>) => q(values, 'fire_intensity');
    /** A fire that burned for a while, then the given controls are set at time 0 of the next run. */
    const burning = (): Record<string, number> => ({ fire_intensity: 60 });

    it('with no fire parameter the intensity stays 0 and the temperatures stay at their base', () => {
      const after = settle({}, 5 * MINUTE);
      expect(at(after)).toBe(0);
      for (const id of ['oil_temp_c', 'coolant_temp_c', 'gearbox_temp_c']) {
        expect(q(after, id), id).toBe(baseOf(id));
      }
    });

    it('engine_fire is a parameter between 0 and 1 with the normal value 0', () => {
      expect(DA50RG_PHYSICS.parameter('engine_fire')).toEqual({
        id: 'engine_fire',
        min: 0,
        max: 1,
        normal: 0,
      });
    });

    it('fire_intensity is hidden and starts at 0 with one unmarked band', () => {
      const def = DA50RG_QUANTITIES.get('fire_intensity');
      expect(def?.base).toBe(0);
      expect(def?.bands).toEqual([{ id: 'unmarked', colour: 'none', to: def?.max }]);
    });

    it('an ignored fire grows with the engine running and passes the outcome threshold', () => {
      const early = settle({}, 10_000, { parameters: FIRE });
      const late = settle({}, 5 * MINUTE, { parameters: FIRE });
      expect(at(early)).toBeGreaterThan(0);
      expect(at(late)).toBeGreaterThan(at(early));
      expect(at(late)).toBeGreaterThan(FIRE_THRESHOLD);
    });

    it('the oil, coolant and gearbox temperatures rise above their values without fire', () => {
      const plain = settle({}, 3 * MINUTE);
      const fire = settle({}, 3 * MINUTE, { parameters: FIRE });
      for (const id of ['oil_temp_c', 'coolant_temp_c', 'gearbox_temp_c']) {
        expect(q(fire, id), id).toBeGreaterThan(q(plain, id) + 5);
      }
    });

    it('the temperature rise is the only sign: no CAS rule fires from the fire alone', () => {
      const { setup } = setupWith({}, FIRE);
      const after = settle({}, 5 * MINUTE, { parameters: FIRE });
      const ctx = { controls: setup.baseline, baseline: setup.baseline, quantities: after };
      expect(DA50RG_CAS.active(ctx, DA50RG_ENV)).toEqual([]);
    });

    it('ENGINE MASTER OFF makes the fire decay below the outcome threshold and below its start', () => {
      const after = settle({ 'sw.engine_master': 'off' }, 2 * MINUTE, {
        parameters: FIRE,
        start: burning(),
      });
      expect(at(after)).toBeLessThan(FIRE_THRESHOLD);
      expect(at(after)).toBeLessThan(60);
    });

    it('the FUEL selector OFF alone makes the fire decay as well', () => {
      const after = settle({ 'sw.fuel_valve': 'off' }, 2 * MINUTE, {
        parameters: FIRE,
        start: burning(),
      });
      expect(at(after)).toBeLessThan(FIRE_THRESHOLD);
      expect(at(after)).toBeLessThan(60);
    });

    it('the EMERG FUEL PUMP raises the fire, unless the FUEL selector is OFF', () => {
      const plain = settle({}, MINUTE, { parameters: FIRE });
      const pumped = settle(PUMP, MINUTE, { parameters: FIRE });
      expect(at(pumped)).toBeGreaterThan(at(plain));

      const cut = settle({ 'sw.fuel_valve': 'off' }, MINUTE, {
        parameters: FIRE,
        start: burning(),
      });
      const cutPumped = settle({ 'sw.fuel_valve': 'off', ...PUMP }, MINUTE, {
        parameters: FIRE,
        start: burning(),
      });
      expect(at(cutPumped)).toBe(at(cut));
    });

    it('the pump keeps feeding a fire after ENGINE MASTER OFF, and the engine off alone is weaker', () => {
      const off = settle({ 'sw.engine_master': 'off' }, 3 * MINUTE, {
        parameters: FIRE,
        start: burning(),
      });
      const offPumped = settle({ 'sw.engine_master': 'off', ...PUMP }, 3 * MINUTE, {
        parameters: FIRE,
        start: burning(),
      });
      expect(at(offPumped)).toBeGreaterThan(at(off));
    });

    it('the temperatures fall once the fire is out', () => {
      const hot = settle({}, 3 * MINUTE, { parameters: FIRE });
      const handled = settle({ 'sw.engine_master': 'off', 'sw.fuel_valve': 'off' }, 3 * MINUTE, {
        parameters: FIRE,
        start: hot,
      });
      expect(q(handled, 'oil_temp_c')).toBeLessThan(q(hot, 'oil_temp_c'));
      expect(q(handled, 'coolant_temp_c')).toBeLessThan(q(hot, 'coolant_temp_c'));
      expect(q(handled, 'gearbox_temp_c')).toBeLessThan(q(hot, 'gearbox_temp_c'));
    });
  });

  describe('the fuel cut of the FUEL selector (plan 03-08, C-44)', () => {
    it('OFF drops rpm, load, oil pressure, fuel pressure and Amps like ENGINE MASTER OFF', () => {
      const cut = settle({ 'sw.fuel_valve': 'off' }, MINUTE);
      const off = settle({ 'sw.engine_master': 'off' }, MINUTE);
      for (const id of ['rpm', 'load_pct', 'oil_pressure_bar', 'fuel_pressure_bar', 'alt1_amps']) {
        nearZero(q(cut, id), baseOf(id));
        expect(q(cut, id), id).toBe(q(off, id));
      }
    });

    it('OFF also cuts the pressure of the EMERG FUEL PUMP', () => {
      const cutPumped = settle({ 'sw.fuel_valve': 'off', 'sw.emerg_fuel_pump': 'on' }, MINUTE);
      const cut = settle({ 'sw.fuel_valve': 'off' }, MINUTE);
      expect(q(cutPumped, 'fuel_pressure_bar')).toBe(q(cut, 'fuel_pressure_bar'));
    });

    it('EMERGENCY reads like NORMAL for every quantity', () => {
      expect(settle({ 'sw.fuel_valve': 'emergency' }, MINUTE)).toEqual(settle({}, MINUTE));
    });
  });
});
