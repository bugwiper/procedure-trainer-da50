import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_PHYSICS } from '../src/aircraft/da50rg/physics';
import { definePhysics } from '../src/engine/physics';
import { initialQuantities } from '../src/engine/predicates';
import { Run } from '../src/engine/run';
import {
  MAX_RUN_MS,
  STEP_MS,
  initSim,
  quantise,
  simSetup,
  simulate,
  stepSim,
} from '../src/engine/sim';
import type { SimEvent, SimState } from '../src/engine/sim';
import { PanelStore } from '../src/engine/store';
import { checkScenario } from '../src/scenario/lint';

// The fixed-step simulation (plan 03-01; D-01, D-02, C-01 to C-03, C-06, C-07, T-03-01, T-03-03):
// live stepping through Run and replaying through simulate give the identical state at every step,
// the event timing rule, quantisation and clamping, the parameters and the run cap.

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = checkScenario(
  readFileSync(`${root}scenarios/engine/eng-oil-temp-green.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checked.ok) throw new Error('the blueprint does not pass the scenario check');
const scenario = checked.scenario;

const setup = simSetup(DA50RG_ENV, scenario);
const start = initialQuantities(scenario, DA50RG_ENV.quantities);

const OIL_TEMP = 'oil_temp_c';
const OIL_PRESSURE = 'oil_pressure_bar';

function quantity(values: Readonly<Record<string, number>>, id: string): number {
  const value = Object.hasOwn(values, id) ? values[id] : undefined;
  if (value === undefined) throw new Error(`no quantity ${id}`);
  return value;
}

function controlOf(controls: Readonly<Record<string, string>>, id: string): string | undefined {
  return Object.hasOwn(controls, id) ? controls[id] : undefined;
}

describe('live stepping equals replay', () => {
  it('a Run over a real store equals simulate at every step from 1 to 300', () => {
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const run = new Run({ setup, store, start });
    // Events are dispatched at the run clock's time, between steps, like the UI does.
    const plan = new Map<number, [string, string]>([
      [20, ['lv.power', 'p50']],
      [45, ['lv.cowl_flap', 'open']],
      [100, ['lv.power', 'p60']],
      [101, ['lv.cowl_flap', 'closed']],
      [180, ['sw.engine_master', 'off']],
      [250, ['sw.engine_master', 'on']],
    ]);
    for (let n = 1; n <= 300; n++) {
      const action = plan.get(n - 1);
      if (action !== undefined) {
        expect(store.dispatch(action[0], action[1], run.clock.now()).ok).toBe(true);
      }
      run.step();
      const replay = simulate(setup, { events: store.events(), start, untilMs: n * STEP_MS });
      expect(run.state, `step ${String(n)}`).toEqual(replay.state);
      expect(run.clock.now()).toBe(n * STEP_MS);
    }
    expect(store.events()).toHaveLength(plan.size);
  });

  it('two simulate calls over the same log are identical', () => {
    const events: SimEvent[] = [
      { t: 300, id: 'lv.power', value: 'p50' },
      { t: 1250, id: 'lv.cowl_flap', value: 'open' },
    ];
    const a = simulate(setup, { events, start, untilMs: 60_000 });
    const b = simulate(setup, { events, start, untilMs: 60_000 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('a paused Run does not step, and onStep listeners see each new state', () => {
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const run = new Run({ setup, store, start });
    const seen: number[] = [];
    const stop = run.onStep((state) => seen.push(state.t));
    run.step();
    run.step();
    run.clock.pause();
    run.step();
    expect(run.clock.now()).toBe(2 * STEP_MS);
    expect(seen).toEqual([100, 200]);
    stop();
    run.clock.resume();
    run.step();
    expect(seen).toEqual([100, 200]);
    run.dispose();
  });

  it('an actuation at clock time T reaches the controls only after the next step', () => {
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const run = new Run({ setup, store, start });
    run.step();
    store.dispatch('lv.power', 'p50', run.clock.now());
    expect(controlOf(run.state.controls, 'lv.power')).toBe('p75');
    run.step();
    expect(controlOf(run.state.controls, 'lv.power')).toBe('p50');
  });

  it('a retracted event leaves the controls and the next event is not skipped', () => {
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const run = new Run({ setup, store, start });
    run.step();
    const first = store.dispatch('lv.power', 'p50', run.clock.now());
    run.step();
    run.step();
    expect(controlOf(run.state.controls, 'lv.power')).toBe('p50');
    if (!first.ok) throw new Error('power rejected');
    expect(store.retract(first.event.seq).ok).toBe(true);
    expect(controlOf(run.state.controls, 'lv.power')).toBe('p75');
    store.dispatch('lv.cowl_flap', 'open', run.clock.now());
    run.step();
    expect(controlOf(run.state.controls, 'lv.cowl_flap')).toBe('open');
    run.dispose();
  });
});

describe('event timing (C-02)', () => {
  const controlsAt = (events: SimEvent[], untilMs: number, id: string) =>
    controlOf(simulate(setup, { events, start, untilMs }).state.controls, id);

  it('an event at 150 is not in the state at 200 and is applied in the step from 200 to 300', () => {
    const events = [{ t: 150, id: 'lv.power', value: 'p50' }];
    expect(controlsAt(events, 200, 'lv.power')).toBe('p75');
    expect(controlsAt(events, 300, 'lv.power')).toBe('p50');
  });

  it('an event at exactly 200 is applied in the step from 200', () => {
    const events = [{ t: 200, id: 'lv.power', value: 'p50' }];
    expect(controlsAt(events, 200, 'lv.power')).toBe('p75');
    expect(controlsAt(events, 300, 'lv.power')).toBe('p50');
    const early = [{ t: 150, id: 'lv.power', value: 'p50' }];
    expect(simulate(setup, { events, start, untilMs: 500 })).toEqual(
      simulate(setup, { events: early, start, untilMs: 500 }),
    );
  });

  it('two events with equal t apply in log order', () => {
    const a = { t: 100, id: 'lv.power', value: 'p50' };
    const b = { t: 100, id: 'lv.power', value: 'p100' };
    expect(controlsAt([a, b], 300, 'lv.power')).toBe('p100');
    expect(controlsAt([b, a], 300, 'lv.power')).toBe('p50');
  });

  it('events are never sorted by t: a later one waits behind an earlier one of the log', () => {
    const events = [
      { t: 300, id: 'lv.power', value: 'p50' },
      { t: 100, id: 'lv.cowl_flap', value: 'open' },
    ];
    expect(controlsAt(events, 300, 'lv.cowl_flap')).toBe('closed');
    expect(controlsAt(events, 400, 'lv.cowl_flap')).toBe('open');
    expect(controlsAt(events, 400, 'lv.power')).toBe('p50');
  });

  it('an event naming an unknown control throws Error naming it', () => {
    const events = [{ t: 0, id: 'lv.nope', value: 'x' }];
    expect(() => simulate(setup, { events, start, untilMs: 100 })).toThrow(/lv\.nope/);
    expect(() => stepSim(setup, initSim(setup, start), events)).toThrow(/lv\.nope/);
  });
});

describe('quantities', () => {
  it('stay multiples of their scale inside their range', () => {
    const events: SimEvent[] = [
      { t: 5000, id: 'lv.power', value: 'p100' },
      { t: 90_000, id: 'lv.power', value: 'p0' },
      { t: 90_000, id: 'sw.engine_master', value: 'off' },
    ];
    for (let ms = STEP_MS; ms <= 300_000; ms += 5_000) {
      const { quantities } = simulate(setup, { events, start, untilMs: ms }).state;
      for (const def of DA50RG_ENV.quantities.all) {
        const value = quantity(quantities, def.id);
        expect(quantise(value, def.scale), `${def.id} at ${String(ms)}`).toBe(value);
        expect(value).toBeGreaterThanOrEqual(def.min);
        expect(value).toBeLessThanOrEqual(def.max);
      }
    }
  });

  it('a quantity without a model never changes', () => {
    const oilOnly = definePhysics(
      {
        parameters: [{ id: 'oil_cooling', min: 0.2, max: 1, normal: 1 }],
        models: DA50RG_ENV.physics.models.filter((m) => m.quantity === OIL_TEMP),
      },
      { registry: DA50RG, quantities: DA50RG_ENV.quantities },
    );
    const partial = simSetup({ ...DA50RG_ENV, physics: oilOnly }, scenario);
    const { quantities } = simulate(partial, { events: [], start, untilMs: 60_000 }).state;
    expect(quantity(quantities, OIL_PRESSURE)).toBe(quantity(start, OIL_PRESSURE));
  });

  it('a quantity scale of its own keeps a burn that the default 0.01 would round away', () => {
    const lh = DA50RG_ENV.quantities.get('fuel_qty_lh_gal');
    expect(lh?.scale).toBeGreaterThan(100);
    expect(quantise(0.001, 100)).toBe(0);
    expect(quantise(0.001, lh?.scale)).toBe(0.001);
    const { quantities } = simulate(setup, { events: [], start, untilMs: 60_000 }).state;
    expect(quantity(quantities, 'fuel_qty_lh_gal')).toBeLessThan(
      quantity(start, 'fuel_qty_lh_gal'),
    );
  });

  it('clamp at the range: an ignored failure stops at the quantity maximum', () => {
    const max = DA50RG_ENV.quantities.get(OIL_TEMP)?.max ?? Number.NaN;
    const { state } = simulate(setup, { events: [], start, untilMs: 600_000 });
    expect(quantity(state.quantities, OIL_TEMP)).toBe(max);
  });

  it('quantise rounds to 0.01 and never returns minus zero', () => {
    expect(quantise(1.004)).toBe(1);
    expect(quantise(1.006)).toBe(1.01);
    expect(Object.is(quantise(-0.001), 0)).toBe(true);
  });

  it('start quantities not named by the scenario take the base value', () => {
    const state = initSim(setup, { [OIL_TEMP]: 100 });
    expect(quantity(state.quantities, OIL_TEMP)).toBe(100);
    expect(quantity(state.quantities, OIL_PRESSURE)).toBe(
      DA50RG_ENV.quantities.baseValues()[OIL_PRESSURE],
    );
    expect(state.t).toBe(0);
  });
});

describe('parameters and onset (C-07)', () => {
  it('the faulted record is the normal record overlaid with the scenario parameters', () => {
    expect(setup.normalParameters).toEqual(DA50RG_ENV.physics.normalParameters());
    expect(setup.faultedParameters).toEqual({
      ...DA50RG_ENV.physics.normalParameters(),
      ...scenario.parameters,
    });
    expect(setup.faultedParameters).not.toEqual(setup.normalParameters);
    expect(setup.onsetAt).toBe(0);
  });

  it('with onsetAt 0 the faulted record is in force from the first step', () => {
    const faulted = stepSim(setup, initSim(setup, start), []).state;
    expect(quantity(faulted.quantities, OIL_TEMP)).toBeGreaterThan(quantity(start, OIL_TEMP));
    const late = simSetup(DA50RG_ENV, scenario, { onsetAt: 10_000 });
    const normal = stepSim(late, initSim(late, start), []).state;
    expect(quantity(normal.quantities, OIL_TEMP)).toBeLessThan(quantity(start, OIL_TEMP));
  });

  it('switches to the scenario values at the onset step', () => {
    const late = simSetup(DA50RG_ENV, scenario, { onsetAt: 300 });
    let state = initSim(late, start);
    const temps: number[] = [];
    for (let i = 0; i < 6; i++) {
      state = stepSim(late, state, []).state;
      temps.push(quantity(state.quantities, OIL_TEMP));
    }
    // Steps starting at 0, 100, 200 use the normal cooling (falls); from 300 the fault (rises).
    expect(temps[0]).toBeLessThan(quantity(start, OIL_TEMP));
    expect(temps[2]).toBeLessThan(temps[1] ?? Number.NaN);
    expect(temps[4]).toBeGreaterThan(temps[3] ?? Number.NaN);
  });
});

describe('the run cap (T-03-01)', () => {
  it('stops at MAX_RUN_MS when untilMs is larger', () => {
    expect(MAX_RUN_MS).toBe(1_800_000);
    const { state } = simulate(setup, { events: [], start, untilMs: 10 * MAX_RUN_MS });
    expect(state.t).toBe(MAX_RUN_MS);
  });

  it('stepSim reports no fired reaction when no due event arms one', () => {
    expect(stepSim(setup, initSim(setup, start), []).fired).toEqual([]);
    const power = [{ t: 0, id: 'lv.power', value: 'p50' }];
    expect(stepSim(setup, initSim(setup, start), power).fired).toEqual([]);
  });
});

// The de-ice MAX run (plan 03-04; D-04, SCN-06, C-20): an event-armed, timed, one-shot reaction.
// Every duration is read from the reaction definition, never typed in here.
describe('the de-ice MAX reaction (C-20)', () => {
  const reaction = DA50RG_PHYSICS.reactions.find((r) => r.id === 'deice_max');
  if (reaction === undefined) throw new Error('the aircraft has no deice_max reaction');
  const FLAG = reaction.flag;
  const MODE = 'sw.deice_mode';
  const MAX = reaction.on.control;
  const PRESSED = reaction.on.value;
  /** Steps a reaction stays in force: the duration over the step length. */
  const N = reaction.durationMs / STEP_MS;

  /** Steps from a start state; `at` gives the events due in the step that starts at t. */
  function walk(
    steps: number,
    at: (t: number) => SimEvent[],
    from: SimState = initSim(setup, start),
  ): { states: SimState[]; fired: (readonly number[])[] } {
    const states: SimState[] = [];
    const fired: (readonly number[])[] = [];
    let state = from;
    for (let i = 0; i < steps; i++) {
      const result = stepSim(setup, state, at(state.t));
      state = result.state;
      states.push(state);
      fired.push(result.fired);
    }
    return { states, fired };
  }

  const event = (id: string, value: string): SimEvent => ({ t: 0, id, value });
  const flagOf = (state: SimState): boolean => state.flags[FLAG] === true;

  it('the reaction is armed by the MAX button entering pressed and lasts a whole number of steps', () => {
    expect(reaction.on).toEqual({ control: 'btn.deice_max', value: 'pressed' });
    expect(Number.isInteger(N)).toBe(true);
    expect(N).toBeGreaterThan(1);
  });

  it('a press at step k on HIGH: off before, on in every state for the duration, off afterwards', () => {
    const k = 4;
    const t0 = (k - 1) * STEP_MS;
    const { states, fired } = walk(k + N + 5, (t) =>
      t === 0
        ? [event(MODE, 'high')]
        : t === t0
          ? [event(MAX, PRESSED), event(MAX, 'released')]
          : [],
    );
    // State after step i (1-based) is states[i - 1]; j counts the steps from the press step.
    states.forEach((state, index) => {
      const j = index + 1 - k + 1;
      const expected = j >= 1 && j <= N - 1;
      expect(flagOf(state), `after step ${String(index + 1)}`).toBe(expected);
      expect(
        Object.hasOwn(state.timers, reaction.id),
        `timer after step ${String(index + 1)}`,
      ).toBe(expected);
    });
    expect(fired.map((list, index) => (list.length > 0 ? index + 1 : 0)).filter(Boolean)).toEqual([
      k,
    ]);
    expect(fired[k - 1]).toEqual([0]);
    // The press step leaves the full duration less one step; the run is over at t0 + duration.
    expect(states[k - 1]?.timers[reaction.id]).toBe(reaction.durationMs - STEP_MS);
    expect(states[k - 1 + N - 1]?.t).toBe(t0 + reaction.durationMs);
    expect(flagOf(states[k - 1 + N - 1] as SimState)).toBe(false);
    expect(flagOf(states[k - 1 + N - 2] as SimState)).toBe(true);
  });

  it('the models read the flag for exactly the duration of the reaction', () => {
    const PER_STEP = 0.01;
    const counting = definePhysics(
      {
        parameters: [],
        models: [
          {
            quantity: 'battery_pct',
            mode: 'rate',
            perMinute: (inputs) => (inputs.flags[FLAG] === true ? -(PER_STEP * 600) : 0),
          },
        ],
        reactions: DA50RG_PHYSICS.reactions,
      },
      DA50RG_ENV,
    );
    const counted = simSetup({ ...DA50RG_ENV, physics: counting }, scenario);
    let state = initSim(counted, start);
    const base = quantity(state.quantities, 'battery_pct');
    for (let i = 0; i < N + 20; i++) {
      const due = i === 0 ? [event(MODE, 'high')] : i === 1 ? [event(MAX, PRESSED)] : [];
      state = stepSim(counted, state, due).state;
    }
    expect(quantity(state.quantities, 'battery_pct')).toBeCloseTo(base - N * PER_STEP, 6);
  });

  it('leaving HIGH clears the flag in the step that applies the change', () => {
    const { states } = walk(30, (t) =>
      t === 0
        ? [event(MODE, 'high'), event(MAX, PRESSED)]
        : t === 10 * STEP_MS
          ? [event(MODE, 'norm')]
          : [],
    );
    expect(flagOf(states[9] as SimState)).toBe(true);
    expect(flagOf(states[10] as SimState)).toBe(false);
    expect(states[10]?.timers).toEqual({});
    expect(states[10]?.flags).toEqual({});
    // And it stays out: NORM is not HIGH, and no new press was made.
    expect(states.slice(10).every((state) => !flagOf(state))).toBe(true);
  });

  it('a press with the mode on NORM or OFF never sets the flag and fires nothing', () => {
    for (const mode of ['norm', 'off']) {
      const { states, fired } = walk(20, (t) =>
        t === 0 ? [event(MODE, mode)] : t === STEP_MS ? [event(MAX, PRESSED)] : [],
      );
      expect(
        states.every((state) => !flagOf(state)),
        mode,
      ).toBe(true);
      expect(fired.every((list) => list.length === 0)).toBe(true);
      expect(states.at(-1)?.timers).toEqual({});
    }
  });

  it('the press is the trigger: the mode already on HIGH without a press never sets the flag', () => {
    const { states } = walk(20, (t) => (t === 0 ? [event(MODE, 'high')] : []));
    expect(states.every((state) => !flagOf(state))).toBe(true);
  });

  it('the condition is checked at the press in log order, not at the end of the step', () => {
    const before = initSim(setup, start);
    // The mode reaches HIGH first, then the press: the reaction starts.
    const ordered = stepSim(setup, before, [event(MODE, 'high'), event(MAX, PRESSED)]);
    expect(flagOf(ordered.state)).toBe(true);
    expect(ordered.fired).toEqual([1]);
    // The press comes first, then the mode: at the press the mode was not HIGH.
    const reversed = stepSim(setup, before, [event(MAX, PRESSED), event(MODE, 'high')]);
    expect(flagOf(reversed.state)).toBe(false);
    expect(reversed.fired).toEqual([]);
  });

  it('a second press while active does not restart the timer', () => {
    const second = 50;
    const { states, fired } = walk(N + 10, (t) =>
      t === 0
        ? [event(MODE, 'high'), event(MAX, PRESSED)]
        : t === second * STEP_MS
          ? [event(MAX, 'released'), event(MAX, PRESSED)]
          : [],
    );
    expect(fired[0]).toEqual([1]);
    expect(fired[second]).toEqual([]);
    expect(states[second]?.timers[reaction.id]).toBe(reaction.durationMs - (second + 1) * STEP_MS);
    // The run still ends at the first press plus the duration.
    expect(flagOf(states[N - 2] as SimState)).toBe(true);
    expect(flagOf(states[N - 1] as SimState)).toBe(false);
  });

  it('a press after the run ended starts a new run', () => {
    const again = N + 5;
    const { states, fired } = walk(again + 10, (t) =>
      t === 0
        ? [event(MODE, 'high'), event(MAX, PRESSED)]
        : t === (again - 1) * STEP_MS
          ? [event(MAX, 'released'), event(MAX, PRESSED)]
          : [],
    );
    expect(flagOf(states[N] as SimState)).toBe(false);
    expect(fired[again - 1]).toEqual([1]);
    expect(flagOf(states[again - 1] as SimState)).toBe(true);
    expect(states[again - 1]?.timers[reaction.id]).toBe(reaction.durationMs - STEP_MS);
  });

  it('a press and its release inside one step still start the run, and replay agrees', () => {
    const events: SimEvent[] = [
      { t: 0, id: MODE, value: 'high' },
      { t: 150, id: MAX, value: PRESSED },
      { t: 160, id: MAX, value: 'released' },
    ];
    const replay = simulate(setup, { events, start, untilMs: 1000 });
    expect(flagOf(replay.state)).toBe(true);
    expect(replay.state.controls[MAX]).toBe('released');
    const stop = simulate(setup, { events, start, untilMs: reaction.durationMs + 1000 });
    expect(flagOf(stop.state)).toBe(false);
  });

  it('a Run raises the consumed watermark at the step that starts the run, never earlier', () => {
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const run = new Run({ setup, store, start });
    store.dispatch(MODE, 'high', run.clock.now());
    run.step();
    const press = store.dispatch(MAX, PRESSED, run.clock.now());
    if (!press.ok) throw new Error('press rejected');
    expect(store.consumedThrough).toBe(-1);
    run.step();
    expect(store.consumedThrough).toBe(press.event.seq);
    run.dispose();
  });
});
