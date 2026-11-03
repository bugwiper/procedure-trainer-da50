import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { carryOf } from '../src/engine/carry';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { PredicateError, baselineOf, initialQuantities } from '../src/engine/predicates';
import { Run } from '../src/engine/run';
import { STEP_MS, simSetup, simulate } from '../src/engine/sim';
import { PanelStore } from '../src/engine/store';
import { checkScenario } from '../src/scenario/lint';
import type { Scenario } from '../src/scenario/schema';

// The carried panel (Phase 9, plan 09-05, R-14, P-04, P-05): the capture of the panel a run left,
// the baseline with a carry, grading and the replay from it, and the lint boundary (the file's own
// baseline is judged, so a carried start can be passed by a pilot who left everything right).
// Hand-written cases over the real aircraft and the synthetic fixtures of tests/fixtures/scenarios/.

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string): string => readFileSync(`${root}${path}`, 'utf8');
const check = (text: string): Scenario => {
  const checked = checkScenario(text, DA50RG_ENV);
  if (!checked.ok) throw new Error(`the scenario does not check: ${JSON.stringify(checked)}`);
  return checked.scenario;
};

const FIXTURE = check(read('tests/fixtures/scenarios/landing-fixture.toon'));
const OIL = check(read('scenarios/engine/eng-oil-temp-green.toon'));
const OFF_LANDING = check(read('scenarios/landing/landing-engine-off.toon'));

/** The registry defaults as a state map: what a fresh panel shows. */
const defaults = (): Record<string, string> => ({ ...new PanelStore(DA50RG).snapshot() });
const recording = (
  scenario: Scenario,
  events: Recording['events'],
  carry: Recording['carry'],
  completedAt = 10_000,
): Recording => ({
  scenarioId: scenario.id,
  completedAt,
  events,
  ...(carry === undefined ? {} : { carry }),
});

describe('carryOf (R-14, P-04)', () => {
  it('has one entry for every control of the registry, frozen', () => {
    const carry = carryOf(DA50RG, defaults());
    expect(Object.keys(carry).sort()).toEqual(DA50RG.controls.map((def) => def.id).sort());
    expect(Object.isFrozen(carry)).toBe(true);
    // A fresh panel carries the registry defaults.
    expect(carry).toEqual(defaults());
  });

  it('reads the states the events left', () => {
    const store = new PanelStore(DA50RG);
    store.dispatch('sw.engine_master', 'off', 100);
    store.dispatch('sw.elect_master', 'off', 200);
    store.dispatch('lv.power', 'p40', 300);
    store.dispatch('sw.fuel_trans', 'on', 400);
    const carry = carryOf(DA50RG, store.snapshot());
    expect(carry['sw.engine_master']).toBe('off');
    expect(carry['sw.elect_master']).toBe('off');
    expect(carry['lv.power']).toBe('p40');
    expect(carry['sw.fuel_trans']).toBe('on');
    // Everything not touched is as the registry has it.
    expect(carry['lv.cowl_flap']).toBe(defaults()['lv.cowl_flap']);
  });

  it('puts a momentary button at its rest state, however it stood', () => {
    const momentary = DA50RG.controls.filter((def) => def.kind === 'momentary-button');
    expect(momentary.length).toBeGreaterThan(0);
    const state = defaults();
    for (const def of momentary) {
      if (def.kind !== 'momentary-button') continue;
      state[def.id] = def.states[1].id;
    }
    const carry = carryOf(DA50RG, state);
    for (const def of momentary) expect(carry[def.id], def.id).toBe(def.default);
  });

  it('throws a RangeError naming the control when the state map lacks one', () => {
    const state = defaults();
    delete state['sw.fuel_valve'];
    expect(() => carryOf(DA50RG, state)).toThrow(RangeError);
    expect(() => carryOf(DA50RG, state)).toThrow(/sw\.fuel_valve/);
  });
});

describe('baselineOf with a carry (R-14 c)', () => {
  it('lays the carry over the initial controls of the file for every control it names', () => {
    expect(FIXTURE.initial.controls['lv.power']).toBe('p60');
    const carry = { ...defaults(), 'lv.power': 'p40', 'sw.elect_master': 'off' };
    const baseline = baselineOf(FIXTURE, DA50RG, carry);
    // The file's own start control loses against the carry, even where the carry holds the default.
    expect(baseline['lv.power']).toBe('p40');
    expect(baseline['sw.elect_master']).toBe('off');
    expect(baseline).toEqual(carry);
    const atDefault = baselineOf(FIXTURE, DA50RG, defaults());
    expect(atDefault['lv.power']).toBe(defaults()['lv.power']);
  });

  it('a partial carry changes only what it names', () => {
    const baseline = baselineOf(FIXTURE, DA50RG, { 'sw.elect_master': 'off' });
    expect(baseline['sw.elect_master']).toBe('off');
    expect(baseline['lv.power']).toBe('p60');
  });

  it('is exactly the old result without a carry', () => {
    const old = baselineOf(FIXTURE, DA50RG);
    expect(baselineOf(FIXTURE, DA50RG, undefined)).toEqual(old);
    expect(baselineOf(FIXTURE, DA50RG, null)).toEqual(old);
    expect(baselineOf(FIXTURE, DA50RG, {})).toEqual(old);
  });

  it('throws a PredicateError for an unknown control and for a state that is not legal', () => {
    expect(() => baselineOf(FIXTURE, DA50RG, { 'lv.nope': 'on' })).toThrow(PredicateError);
    expect(() => baselineOf(FIXTURE, DA50RG, { constructor: 'on' })).toThrow(PredicateError);
    expect(() => baselineOf(FIXTURE, DA50RG, { 'sw.elect_master': 'sideways' })).toThrow(
      PredicateError,
    );
    expect(() => baselineOf(FIXTURE, DA50RG, { 'lv.power': 'p42' })).toThrow(/lv\.power/);
  });
});

describe('grade with a carry (R-14 e, f)', () => {
  const stepOf = (scenario: Scenario, rec: Recording, id: string) =>
    grade(scenario, DA50RG_ENV, rec).steps.find((step) => step.id === id);

  it('credits a step that holds through the carry at the start, with no event', () => {
    const carried = { ...defaults(), 'sw.elect_master': 'off' };
    const verdict = stepOf(FIXTURE, recording(FIXTURE, [], carried), 'elect_master_off');
    expect(verdict?.credited).toBe(true);
    expect(verdict?.enteredAt).toBe(-1);
    // The same file without the carry: nothing is credited.
    expect(stepOf(FIXTURE, recording(FIXTURE, [], undefined), 'elect_master_off')?.credited).toBe(
      false,
    );
    expect(grade(FIXTURE, DA50RG_ENV, recording(FIXTURE, [], carried)).result).toBe('pass');
  });

  it('uncredits it when the pilot makes it false and does not restore it, credits it again when restored', () => {
    const carried = { ...defaults(), 'sw.elect_master': 'off' };
    const undone = recording(FIXTURE, [{ t: 1000, id: 'sw.elect_master', value: 'on' }], carried);
    expect(stepOf(FIXTURE, undone, 'elect_master_off')?.credited).toBe(false);
    expect(grade(FIXTURE, DA50RG_ENV, undone).result).toBe('fail');
    const restored = recording(
      FIXTURE,
      [
        { t: 1000, id: 'sw.elect_master', value: 'on' },
        { t: 2000, id: 'sw.elect_master', value: 'off' },
      ],
      carried,
    );
    const verdict = stepOf(FIXTURE, restored, 'elect_master_off');
    expect(verdict?.credited).toBe(true);
    expect(verdict?.enteredAt).toBe(1);
  });

  it('credits a step that does not hold through the carry after its action', () => {
    const carried = defaults();
    expect(carried['sw.elect_master']).not.toBe('off');
    const done = recording(FIXTURE, [{ t: 1500, id: 'sw.elect_master', value: 'off' }], carried);
    const verdict = stepOf(FIXTURE, done, 'elect_master_off');
    expect(verdict?.credited).toBe(true);
    expect(verdict?.enteredAt).toBe(0);
  });

  it('measures travel_rel from the carried position', () => {
    // A step "power lowered by at least 20 percent of the travel", relative to the start.
    const relative = check(
      read('tests/fixtures/scenarios/landing-fixture.toon').replace(
        'check: state\n          control: sw.elect_master\n          is: off',
        'check: travel_rel\n          control: lv.power\n          op: lte\n          delta: -20',
      ),
    );
    // From the file's own p60, p40 is 20 down; from a carried p80, p40 is 40 down and p70 is only 10.
    const at = (carry: Recording['carry'], power: string) =>
      stepOf(
        relative,
        recording(relative, [{ t: 1000, id: 'lv.power', value: power }], carry),
        'elect_master_off',
      )?.credited;
    expect(at(undefined, 'p40')).toBe(true);
    expect(at(undefined, 'p50')).toBe(false);
    const high = { ...defaults(), 'lv.power': 'p80' };
    expect(at(high, 'p60')).toBe(true);
    expect(at(high, 'p70')).toBe(false);
    // A carry at the file's own p60 behaves like no carry.
    const same = { ...defaults(), 'lv.power': 'p60' };
    expect(at(same, 'p40')).toBe(true);
    expect(at(same, 'p50')).toBe(false);
  });

  it('does not count a forbidden item that holds through the carry until it is made false and true again', () => {
    const forbidden = check(
      read('tests/fixtures/scenarios/fire-ordered.toon').replace(/\n$/, '\n'),
    );
    const item = forbidden.forbidden.find((entry) => entry.id === 'emerg_fuel_pump_on');
    expect(item).toBeDefined();
    const pumpOn = { ...defaults(), 'sw.emerg_fuel_pump': 'on' };
    const held = grade(forbidden, DA50RG_ENV, recording(forbidden, [], pumpOn));
    expect(held.harmful.filter((entry) => entry.id === 'emerg_fuel_pump_on')).toEqual([]);
    const again = grade(
      forbidden,
      DA50RG_ENV,
      recording(
        forbidden,
        [
          { t: 1000, id: 'sw.emerg_fuel_pump', value: 'off' },
          { t: 2000, id: 'sw.emerg_fuel_pump', value: 'on' },
        ],
        pumpOn,
      ),
    );
    expect(again.harmful.filter((entry) => entry.id === 'emerg_fuel_pump_on')).toHaveLength(1);
  });

  it('a carry equal to the full baseline of the file grades JSON-identically to no carry', () => {
    const own = baselineOf(FIXTURE, DA50RG);
    const events = [
      { t: 1000, id: 'sw.elect_master', value: 'off' },
      { t: 2000, id: 'lv.power', value: 'p30' },
    ];
    expect(JSON.stringify(grade(FIXTURE, DA50RG_ENV, recording(FIXTURE, events, own)))).toBe(
      JSON.stringify(grade(FIXTURE, DA50RG_ENV, recording(FIXTURE, events, undefined))),
    );
    // And the field being null is the same as absent.
    expect(
      JSON.stringify(grade(FIXTURE, DA50RG_ENV, { ...recording(FIXTURE, events, null) })),
    ).toBe(JSON.stringify(grade(FIXTURE, DA50RG_ENV, recording(FIXTURE, events, undefined))));
  });

  it('throws for a carry with an unknown control or an illegal state', () => {
    expect(() =>
      grade(FIXTURE, DA50RG_ENV, recording(FIXTURE, [], { ...defaults(), 'lv.nope': 'on' })),
    ).toThrow(PredicateError);
    expect(() =>
      grade(FIXTURE, DA50RG_ENV, recording(FIXTURE, [], { ...defaults(), 'lv.power': 'p42' })),
    ).toThrow(PredicateError);
  });
});

describe('the replay agrees with the live run from a carried start (T-09-14)', () => {
  it('a stepped run over a store reset to the carried baseline equals simulate at every step', () => {
    const carry = {
      ...defaults(),
      'lv.cowl_flap': 'open',
      'lv.power': 'p50',
      'sw.deice_mode': 'off',
    };
    const setup = simSetup(DA50RG_ENV, OIL, { carry });
    const start = initialQuantities(OIL, DA50RG_ENV.quantities);
    const store = new PanelStore(DA50RG);
    store.reset({ ...OIL.initial.controls, ...carry });
    // The store at t 0 is the baseline of the simulation (the one expression of start() and baselineOf).
    expect({ ...store.snapshot() }).toEqual({ ...setup.baseline });
    expect(setup.baseline).toEqual(baselineOf(OIL, DA50RG, carry));
    const run = new Run({ setup, store, start });
    for (let i = 0; i < 60; i += 1) {
      if (i === 25) store.dispatch('lv.power', 'p30', run.clock.now());
      run.step();
      const replay = simulate(setup, {
        events: store.events(),
        start,
        untilMs: run.state.t,
      }).state;
      expect(run.state.controls, `step ${String(i)}`).toEqual(replay.controls);
      expect(run.state.quantities, `step ${String(i)}`).toEqual(replay.quantities);
    }
    expect(run.state.t).toBe(60 * STEP_MS);
    // The carried control stood on the panel from the first step, the event moved the lever later.
    expect(run.state.controls['lv.cowl_flap']).toBe('open');
    expect(run.state.controls['lv.power']).toBe('p30');
  });

  it('the quantities start from the file and move toward the carried controls within their time constants', () => {
    // The file's start values stand at t 0 whatever the carry says; the model then moves them.
    const carry = { ...defaults(), 'lv.power': 'p20' };
    const setup = simSetup(DA50RG_ENV, OIL, { carry });
    const start = initialQuantities(OIL, DA50RG_ENV.quantities);
    const first = simulate(setup, { events: [], start, untilMs: 0 }).state;
    expect(first.quantities['load_pct']).toBe(start['load_pct']);
    const later = simulate(setup, { events: [], start, untilMs: 120_000 }).state;
    expect(later.quantities['load_pct']).not.toBe(start['load_pct']);
  });
});

describe('the dead engine of the shipped engine-off landing under a carry (P-05)', () => {
  const carryEngineOn = { ...defaults(), 'sw.engine_master': 'on', 'sw.fuel_valve': 'normal' };

  it('stays at rpm 0 with a carried engine master ON, while the carried switch position stays', () => {
    const setup = simSetup(DA50RG_ENV, OFF_LANDING, { carry: carryEngineOn });
    const start = initialQuantities(OFF_LANDING, DA50RG_ENV.quantities);
    for (const untilMs of [0, 5_000, 60_000]) {
      const state = simulate(setup, { events: [], start, untilMs }).state;
      expect(state.quantities['rpm'], String(untilMs)).toBe(0);
      expect(state.controls['sw.engine_master']).toBe('on');
    }
  });

  it('leaves row 4 uncredited until the pilot switches the engine master off', () => {
    const row = (events: Recording['events']) =>
      grade(OFF_LANDING, DA50RG_ENV, recording(OFF_LANDING, events, carryEngineOn)).steps.find(
        (step) => step.id === 'engine_master_off',
      );
    expect(row([])?.credited).toBe(false);
    expect(row([{ t: 1000, id: 'sw.engine_master', value: 'off' }])?.credited).toBe(true);
  });
});

describe('the lint boundary (R-14 g)', () => {
  it('the shipped landing file checks clean on its own baseline, with no carry', () => {
    expect(checkScenario(read('scenarios/landing/landing-engine-off.toon'), DA50RG_ENV).ok).toBe(
      true,
    );
  });

  it('a do-nothing run of the file fails with the critical rows missed', () => {
    const result = grade(OFF_LANDING, DA50RG_ENV, recording(OFF_LANDING, [], undefined));
    expect(result.result).toBe('fail');
    const missed = result.steps.filter((step) => step.severity === 'critical' && !step.credited);
    expect(missed.map((step) => step.id).sort()).toEqual([
      'elect_master_off',
      'engine_master_off',
      'fuel_valve_off',
    ]);
  });

  it('a recording that carries the panel of a right fire run does not miss them: the documented difference', () => {
    const fireRun = {
      ...defaults(),
      'sw.engine_master': 'off',
      'sw.fuel_valve': 'off',
      'sw.elect_master': 'off',
      'sw.emerg_fuel_pump': 'off',
    };
    const result = grade(OFF_LANDING, DA50RG_ENV, recording(OFF_LANDING, [], fireRun));
    expect(result.steps.filter((step) => step.severity === 'critical' && !step.credited)).toEqual(
      [],
    );
    expect(result.result).toBe('pass');
  });
});
