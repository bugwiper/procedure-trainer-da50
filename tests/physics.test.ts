import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_PHYSICS } from '../src/aircraft/da50rg/physics';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { PhysicsError, definePhysics } from '../src/engine/physics';
import type { PhysicsInputs, PhysicsSpec, QuantityModel } from '../src/engine/physics';
import { baselineOf, initialQuantities } from '../src/engine/predicates';
import { STEP_MS, simSetup, simulate } from '../src/engine/sim';
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

describe('DA50 oil temperature model (Table P1)', () => {
  const model = DA50RG_PHYSICS.models.find((m) => m.quantity === OIL_TEMP);
  if (model?.mode !== 'lag') throw new Error('the oil temperature has no lag model');
  const base = baselineOf(scenario, DA50RG);

  /** The model's target for the given controls and cooling. */
  const target = (controls: Record<string, string>, cooling: number): number => {
    const inputs: PhysicsInputs = {
      controls: { ...base, ...controls },
      parameters: { oil_cooling: cooling },
      quantities: {},
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
