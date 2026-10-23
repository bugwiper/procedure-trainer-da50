import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_PHYSICS } from '../src/aircraft/da50rg/physics';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { definePhysics } from '../src/engine/physics';
import { PredicateError, initialQuantities, realisticQuantities } from '../src/engine/predicates';
import { Run } from '../src/engine/run';
import {
  MAX_RUN_MS,
  STEP_MS,
  initSim,
  mulberry32,
  onsetFromSeed,
  quantise,
  simSetup,
  simulate,
  stepSim,
} from '../src/engine/sim';
import type { SimEvent, SimState } from '../src/engine/sim';
import { PanelStore } from '../src/engine/store';
import { resolveVariant } from '../src/engine/variants';
import { checkScenario } from '../src/scenario/lint';
import { parseScenario } from '../src/scenario/parse';
import { MINIMAL } from './scenario-text';

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

// The physics and reaction cases below run on the blueprint without its outcome, so an ignored run
// keeps simulating; the outcome rules have their own describe block.
const setup = simSetup(DA50RG_ENV, { ...scenario, outcomes: [] });
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
        parameters: DA50RG_ENV.physics.parameters,
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

describe('outcomes and hold timers (C-25, D-06)', () => {
  const COWL = 'lv.cowl_flap';
  const outcomeText = (id: string, holdS: number): string =>
    [
      `  - id: ${id}`,
      '    text: Engine failure from overheating',
      `    hold_s: ${String(holdS)}`,
      '    when:',
      '      check: state',
      `      control: ${COWL}`,
      '      is: open',
      '',
    ].join('\n');

  /** The small scenario of the case, with the given outcomes (hold times in seconds), declared in order. */
  function setupWith(holds: readonly (readonly [string, number])[]) {
    const text = `${MINIMAL}outcomes[${String(holds.length)}]:\n${holds
      .map(([id, holdS]) => outcomeText(id, holdS))
      .join('')}`;
    const parsed = parseScenario(text);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    return {
      setup: simSetup(DA50RG_ENV, parsed.value),
      start: initialQuantities(parsed.value, DA50RG_ENV.quantities),
    };
  }

  const open = (t: number): SimEvent => ({ t, id: COWL, value: 'open' });
  const closed = (t: number): SimEvent => ({ t, id: COWL, value: 'closed' });
  const stepsOf = (holdS: number): number => (holdS * 1000) / STEP_MS;

  it('fires after exactly hold_s times 1000 over STEP_MS holding steps and not one step earlier', () => {
    const holdS = 2;
    const { setup: small, start: from } = setupWith([['slow_failure', holdS]]);
    const events = [open(0)];
    const fireAt = stepsOf(holdS) * STEP_MS;

    const before = simulate(small, { events, start: from, untilMs: fireAt - STEP_MS }).state;
    expect(before.outcome).toBeNull();
    expect(before.holds['slow_failure']).toBe(fireAt - STEP_MS);

    const at = simulate(small, { events, start: from, untilMs: fireAt }).state;
    expect(at.outcome).toEqual({ id: 'slow_failure', t: fireAt });
    expect(at.t).toBe(fireAt);
  });

  it('an interruption resets the held time', () => {
    const holdS = 2;
    const { setup: small, start: from } = setupWith([['slow_failure', holdS]]);
    const closedAt = 1000;
    const reopenedAt = 1500;
    const events = [open(0), closed(closedAt), open(reopenedAt)];

    const interrupted = simulate(small, { events, start: from, untilMs: closedAt + STEP_MS }).state;
    expect(interrupted.holds).toEqual({});
    expect(interrupted.outcome).toBeNull();

    const fireAt = reopenedAt + holdS * 1000;
    const before = simulate(small, { events, start: from, untilMs: fireAt - STEP_MS }).state;
    expect(before.outcome).toBeNull();
    const at = simulate(small, { events, start: from, untilMs: fireAt }).state;
    expect(at.outcome).toEqual({ id: 'slow_failure', t: fireAt });
  });

  it('hold_s 0 fires in the first holding step; without a holding step nothing fires', () => {
    const { setup: small, start: from } = setupWith([['at_once', 0]]);
    const fired = simulate(small, { events: [open(0)], start: from, untilMs: 5000 }).state;
    expect(fired.outcome).toEqual({ id: 'at_once', t: STEP_MS });
    const idle = simulate(small, { events: [], start: from, untilMs: 5000 }).state;
    expect(idle.outcome).toBeNull();
    expect(idle.holds).toEqual({});
  });

  it('of two outcomes the first declared one that completes its hold wins', () => {
    const slowFirst = setupWith([
      ['slow_one', 2],
      ['quick_one', 1],
    ]);
    const quick = simulate(slowFirst.setup, {
      events: [open(0)],
      start: slowFirst.start,
      untilMs: 5000,
    }).state;
    expect(quick.outcome).toEqual({ id: 'quick_one', t: 1000 });

    const tie = setupWith([
      ['first_one', 1],
      ['second_one', 1],
    ]);
    const tied = simulate(tie.setup, { events: [open(0)], start: tie.start, untilMs: 5000 }).state;
    expect(tied.outcome).toEqual({ id: 'first_one', t: 1000 });
  });

  it('a state with an outcome is final: stepSim returns it unchanged and simulate stops there', () => {
    const { setup: small, start: from } = setupWith([['at_once', 0]]);
    const final = simulate(small, { events: [open(0)], start: from, untilMs: 5000 }).state;
    expect(final.t).toBe(STEP_MS);
    const again = stepSim(small, final, [closed(final.t)]);
    expect(again.state).toBe(final);
    expect(again.fired).toEqual([]);
  });

  it('the blueprint outcome: a Run over a store equals simulate until it ends, then stops', () => {
    const live = simSetup(DA50RG_ENV, scenario);
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const run = new Run({ setup: live, store, start });
    let steps = 0;
    while (run.state.outcome === null && steps < MAX_RUN_MS / STEP_MS) {
      run.step();
      steps += 1;
      // The ignored run is about 1700 steps long: a full replay at every 50th step and at the end
      // (the shorter cases above and below compare every single step).
      if (steps % 50 !== 0 && run.state.outcome === null) continue;
      const replay = simulate(live, { events: store.events(), start, untilMs: steps * STEP_MS });
      expect(run.state, `step ${String(steps)}`).toEqual(replay.state);
    }
    expect(run.state.outcome).not.toBeNull();
    expect(run.state.outcome?.t).toBe(run.clock.now());
    const final = run.state;
    run.step();
    expect(run.state).toBe(final);
    expect(run.clock.now()).toBe(final.t);
  });
});

describe('seeded onset (D-05, C-32)', () => {
  const WINDOW = [5, 20] as const;

  it('mulberry32 is a pinned regression record and stays in [0, 1)', () => {
    const take = (seed: number) => {
      const next = mulberry32(seed);
      return [next(), next(), next()];
    };
    expect(take(0)).toEqual([0.26642920868471265, 0.0003297457005828619, 0.2232720274478197]);
    expect(take(1)).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
    const next = mulberry32(123456789);
    for (let i = 0; i < 1000; i++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('a seed repeats; a negative or large seed is read as an unsigned 32-bit integer', () => {
    expect(mulberry32(42)()).toBe(mulberry32(42)());
    expect(mulberry32(-1)()).toBe(mulberry32(4294967295)());
  });

  it('onsetFromSeed lies inside the window, on a step boundary, and varies with the seed', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 100; seed++) {
      const at = onsetFromSeed(seed, WINDOW);
      expect(at).toBeGreaterThanOrEqual(WINDOW[0] * 1000);
      expect(at).toBeLessThanOrEqual(WINDOW[1] * 1000);
      expect(at % STEP_MS).toBe(0);
      seen.add(at);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });

  it('a one-second window gives that second; a degenerate window is not an error', () => {
    expect(onsetFromSeed(3, [7, 7])).toBe(7000);
  });

  it('before the onset no faulted parameter acts; after it ENG OIL TEMP appears', () => {
    const onsetAt = 10_000;
    const realistic = simSetup(DA50RG_ENV, scenario, { onsetAt });
    let state = initSim(realistic, {});
    let shownAfter = false;
    while (state.t < onsetAt + 300_000 && state.outcome === null) {
      const ctx = {
        controls: state.controls,
        baseline: realistic.baseline,
        quantities: state.quantities,
      };
      const ids = DA50RG_ENV.cas.active(ctx, DA50RG_ENV).map((m) => m.id);
      if (state.t <= onsetAt) {
        expect(ids, `t ${String(state.t)}`).toEqual([]);
        // The normal aircraft drifts toward its equilibrium at the scenario's controls, in the green.
        expect(quantity(state.quantities, OIL_TEMP)).toBeLessThan(115);
      } else if (ids.includes('eng_oil_temp')) {
        shownAfter = true;
      }
      state = stepSim(realistic, state, []).state;
    }
    expect(shownAfter).toBe(true);
  });
});

describe('the Realistic setup (plan 03-11, C-58 to C-61, C-65)', () => {
  const onset = scenario.onset;
  if (onset === undefined) throw new Error('the blueprint declares no onset');
  const [lo, hi] = onset.window_s;
  const atOf = (second: number): number => STEP_MS * Math.round((second * 1000) / STEP_MS);
  const band = (id: string) => DA50RG_QUANTITIES.get(OIL_TEMP)?.bands.find((b) => b.id === id);
  const greenTop = band('green')?.to ?? Number.NaN;
  const redFrom = band('high_yellow')?.to ?? Number.NaN;
  const message = scenario.annunciations[0] ?? '';
  const realisticStart = realisticQuantities(scenario, DA50RG_ENV.quantities);

  /** The ids of the CAS messages active in a state of a run of this setup. */
  const activeIds = (setupOf: ReturnType<typeof simSetup>, state: SimState): string[] =>
    DA50RG_ENV.cas
      .active(
        { controls: state.controls, baseline: setupOf.baseline, quantities: state.quantities },
        DA50RG_ENV,
      )
      .map((m) => m.id);

  /** The ignored run of the blueprint from the Easy and Medium start: the timeline in ms of run time. */
  function easyTimeline(): { messageAt: number | null; outcomeAt: number | null } {
    const easy = simSetup(DA50RG_ENV, scenario);
    let state = initSim(easy, start);
    let messageAt: number | null = null;
    while (state.outcome === null && state.t < MAX_RUN_MS) {
      if (messageAt === null && activeIds(easy, state).includes(message)) messageAt = state.t;
      state = stepSim(easy, state, []).state;
    }
    return { messageAt, outcomeAt: state.outcome?.t ?? null };
  }

  it('a do-nothing Easy run ends in the named outcome at 173200 ms, about 3 minutes (owner, 2026-10-23)', () => {
    // It was 42 600 ms until the owner's retest asked for about 3 minutes (rate curve, plan 03-11 follow-up).
    const { state } = simulate(simSetup(DA50RG_ENV, scenario), {
      events: [],
      start,
      untilMs: MAX_RUN_MS,
    });
    expect(state.outcome?.t).toBe(173_200);
    expect(state.outcome?.id).toBe(scenario.outcomes[0]?.id);
  });

  it('on Easy and Medium the failure is there from the start: red with the message at once', () => {
    // The start reading 128 is already in the red band; there is no yellow phase to wait for.
    expect(easyTimeline()).toEqual({ messageAt: 0, outcomeAt: 173_200 });
  });

  describe('simSetup folds the onset parameters in only when an onset time is given (C-59)', () => {
    it('without onsetAt the faulted record is the normal record overlaid with the scenario parameters', () => {
      const plain = simSetup(DA50RG_ENV, scenario);
      expect(plain.faultedParameters).toEqual({
        ...DA50RG_ENV.physics.normalParameters(),
        ...scenario.parameters,
      });
    });

    it('with onsetAt it is overlaid with the onset parameters as well, whatever the time', () => {
      // The shipped file sets no onset parameter since the rate curve; the overlay is still the rule.
      const hotter = { ...scenario, onset: { ...onset, parameters: { oil_cooling: 0.4 } } };
      for (const onsetAt of [0, atOf(lo), atOf(hi)]) {
        const timed = simSetup(DA50RG_ENV, hotter, { onsetAt });
        expect(timed.faultedParameters, String(onsetAt)).toEqual({
          ...DA50RG_ENV.physics.normalParameters(),
          ...scenario.parameters,
          oil_cooling: 0.4,
        });
        expect(timed.normalParameters).toEqual(DA50RG_ENV.physics.normalParameters());
      }
      expect(Object.keys(onset.parameters)).toEqual([]);
    });

    it('a scenario without an onset block is untouched by an onset time', () => {
      const bare = { ...scenario, onset: undefined };
      expect(simSetup(DA50RG_ENV, bare, { onsetAt: 1000 }).faultedParameters).toEqual(
        simSetup(DA50RG_ENV, bare).faultedParameters,
      );
    });
  });

  describe('realisticQuantities (C-61)', () => {
    it('is the base values laid over by the onset quantities, not by the initial ones', () => {
      expect(realisticStart).toEqual({
        ...DA50RG_ENV.quantities.baseValues(),
        ...onset.quantities,
      });
      expect(realisticStart[OIL_TEMP]).not.toBe(start[OIL_TEMP]);
    });

    it('gives exactly the base values for a scenario without onset quantities or without an onset', () => {
      const empty = { ...scenario, onset: { ...onset, quantities: {} } };
      expect(realisticQuantities(empty, DA50RG_ENV.quantities)).toEqual(
        DA50RG_ENV.quantities.baseValues(),
      );
      const bare = { ...scenario, onset: undefined };
      expect(realisticQuantities(bare, DA50RG_ENV.quantities)).toEqual(
        DA50RG_ENV.quantities.baseValues(),
      );
    });

    it('throws PredicateError for an unknown quantity id', () => {
      const bad = { ...scenario, onset: { ...onset, quantities: { no_such_quantity: 1 } } };
      expect(() => realisticQuantities(bad, DA50RG_ENV.quantities)).toThrow(PredicateError);
    });
  });

  /**
   * The measured timeline of the ignored Realistic run at the two ends of the window, in ms after
   * the onset (instructor-review values, owner retest 2026-10-23: yellow about 1 s, red about 20 s,
   * the end about 3 minutes after the start of red). The yellow time differs between the ends only
   * because the oil temperature cools toward its normal value until the onset.
   */
  const PINNED_REALISTIC: Readonly<
    Record<number, { yellow: number; red: number; outcome: number }>
  > = {
    2: { yellow: 800, red: 19_600, outcome: 206_200 },
    6: { yellow: 1200, red: 20_100, outcome: 206_700 },
  };

  describe.each([
    ['the lower', lo],
    ['the upper', hi],
  ])('the timeline at %s end of the window', (_name, second) => {
    const onsetAt = atOf(second);
    const realistic = simSetup(DA50RG_ENV, scenario, { onsetAt });

    /** The do-nothing timeline of this onset, in ms after the onset, and the clean start before it. */
    function ignoredTimeline(): { yellow: number; red: number; outcome: number } {
      let state = initSim(realistic, realisticStart);
      let yellowAt: number | null = null;
      let messageAt: number | null = null;
      while (state.outcome === null && state.t < MAX_RUN_MS) {
        if (state.t <= onsetAt) {
          expect(activeIds(realistic, state), `t ${String(state.t)}`).toEqual([]);
          expect(quantity(state.quantities, OIL_TEMP), `t ${String(state.t)}`).toBeLessThanOrEqual(
            greenTop,
          );
        }
        state = stepSim(realistic, state, []).state;
        if (yellowAt === null && quantity(state.quantities, OIL_TEMP) > greenTop) {
          yellowAt = state.t - onsetAt;
        }
        if (messageAt === null && activeIds(realistic, state).includes(message)) {
          messageAt = state.t - onsetAt;
        }
      }
      expect(yellowAt).not.toBeNull();
      expect(messageAt).not.toBeNull();
      expect(state.outcome).not.toBeNull();
      return {
        yellow: yellowAt ?? Number.NaN,
        red: messageAt ?? Number.NaN,
        outcome: (state.outcome?.t ?? Number.NaN) - onsetAt,
      };
    }

    it('is clean before the onset; yellow about 1 s, red with the message about 20 s after it', () => {
      const { yellow, red } = ignoredTimeline();
      expect(yellow).toBeGreaterThanOrEqual(500);
      expect(yellow).toBeLessThanOrEqual(1500);
      expect(red).toBeGreaterThanOrEqual(19_000);
      expect(red).toBeLessThanOrEqual(21_000);
      // The bound of the scenario file (lint L15) holds with a margin.
      expect(red).toBeLessThan((onset.message_within_s ?? Number.NaN) * 1000);
    });

    it('the named outcome ends the ignored run about 3 minutes after the start of red', () => {
      const { red, outcome } = ignoredTimeline();
      expect(outcome - red).toBeGreaterThanOrEqual(175_000);
      expect(outcome - red).toBeLessThanOrEqual(190_000);
    });

    it('the timeline is the pinned one', () => {
      expect(ignoredTimeline()).toEqual(PINNED_REALISTIC[second]);
    });

    /** Handles the failure (POWER p60, cowl flap open) when the reading first reaches `reading`. */
    function handledAt(reading: number): { goneAfter: number; greenAfter: number } {
      let state = initSim(realistic, realisticStart);
      while (quantity(state.quantities, OIL_TEMP) < reading) {
        state = stepSim(realistic, state, []).state;
      }
      const at = state.t;
      const handled: SimEvent[] = [
        { t: at, id: 'lv.power', value: 'p60' },
        { t: at, id: 'lv.cowl_flap', value: 'open' },
      ];
      state = stepSim(realistic, state, handled).state;
      let goneAfter: number | null = null;
      let greenAfter: number | null = null;
      while (state.t < at + 240_000) {
        expect(state.outcome, `t ${String(state.t)}`).toBeNull();
        if (goneAfter === null && !activeIds(realistic, state).includes(message)) {
          goneAfter = state.t - at;
        }
        if (greenAfter === null && quantity(state.quantities, OIL_TEMP) <= greenTop) {
          greenAfter = state.t - at;
        }
        state = stepSim(realistic, state, []).state;
      }
      expect(goneAfter).not.toBeNull();
      expect(greenAfter).not.toBeNull();
      return { goneAfter: goneAfter ?? Number.NaN, greenAfter: greenAfter ?? Number.NaN };
    }

    it('POWER p60 with the cowl open at the first sign of red clears the message at once, green in about a minute', () => {
      const { goneAfter, greenAfter } = handledAt(redFrom + 0.01);
      expect(goneAfter).toBeLessThanOrEqual(1000);
      expect(greenAfter).toBeLessThanOrEqual(90_000);
    });

    it('the same handling late, at 139 degrees, still clears the message in 60 s and returns to green in 150 s', () => {
      const { goneAfter, greenAfter } = handledAt(139);
      expect(goneAfter).toBeLessThanOrEqual(60_000);
      expect(greenAfter).toBeLessThanOrEqual(150_000);
    });
  });

  it('a live Run over a store equals simulate at every step for 40 s of a Realistic start', () => {
    const onsetAt = atOf(lo);
    const realistic = simSetup(DA50RG_ENV, scenario, { onsetAt });
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const run = new Run({ setup: realistic, store, start: realisticStart });
    const plan = new Map<number, [string, string]>([
      [120, ['lv.power', 'p60']],
      [135, ['lv.cowl_flap', 'open']],
    ]);
    for (let n = 1; n <= 400; n++) {
      const action = plan.get(n - 1);
      if (action !== undefined) {
        expect(store.dispatch(action[0], action[1], run.clock.now()).ok).toBe(true);
      }
      run.step();
      const replay = simulate(realistic, {
        events: store.events(),
        start: realisticStart,
        untilMs: n * STEP_MS,
      });
      expect(run.state, `step ${String(n)}`).toEqual(replay.state);
    }
  });
});

describe('faulted controls at the onset (phase 3.1, V-06)', () => {
  const file = checkScenario(
    readFileSync(new URL('../scenarios/electrical/elec-altn1-fail.toon', import.meta.url), 'utf8'),
    DA50RG_ENV,
  );
  if (!file.ok) throw new Error('the ALTN 1 FAIL file does not pass the scenario check');
  const popped = resolveVariant(file.scenario, 'breaker_popped', true);
  const ONSET_AT = 3000;
  const altSetup = simSetup(DA50RG_ENV, popped, { onsetAt: ONSET_AT });
  const altStart = realisticQuantities(popped, DA50RG_ENV.quantities);
  const BREAKER = 'cb.alt1';

  it('the setup carries the onset controls only when an onset time is given', () => {
    expect(altSetup.faultedControls).toEqual({ [BREAKER]: 'out' });
    expect(simSetup(DA50RG_ENV, popped).faultedControls).toEqual({});
  });

  it('sets the control in the one step that contains the onset, and reports it once', () => {
    let state = initSim(altSetup, altStart);
    const reported: { at: number; id: string; value: string }[] = [];
    while (state.t < ONSET_AT + 1000) {
      const result = stepSim(altSetup, state, []);
      for (const change of result.injected) reported.push({ at: state.t, ...change });
      if (state.t < ONSET_AT) expect(state.controls[BREAKER]).toBe('in');
      state = result.state;
      if (state.t > ONSET_AT) expect(state.controls[BREAKER]).toBe('out');
    }
    expect(reported).toEqual([{ at: ONSET_AT, t: ONSET_AT + STEP_MS, id: BREAKER, value: 'out' }]);
  });

  it('an onset between two step boundaries lands in the step that contains it', () => {
    const odd = simSetup(DA50RG_ENV, popped, { onsetAt: 3050 });
    const state = initSim(odd, altStart);
    const before = stepSim(odd, { ...state, t: 2900 }, []);
    expect(before.injected).toEqual([]);
    const at = stepSim(odd, { ...state, t: 3000 }, []);
    expect(at.injected).toHaveLength(1);
  });

  it('does not set a control that is already in that state, and pilot pushes afterwards stay', () => {
    const pulled = { ...initSim(altSetup, altStart), t: ONSET_AT };
    const sameState = { ...pulled, controls: { ...pulled.controls, [BREAKER]: 'out' } };
    expect(stepSim(altSetup, sameState, []).injected).toEqual([]);
    // After the onset step the simulation never sets it again: the pilot's push holds.
    let state = initSim(altSetup, altStart);
    while (state.t <= ONSET_AT) state = stepSim(altSetup, state, []).state;
    const pushed = stepSim(altSetup, state, [{ t: state.t, id: BREAKER, value: 'in' }]);
    expect(pushed.injected).toEqual([]);
    expect(pushed.state.controls[BREAKER]).toBe('in');
  });

  it('simulate skips events of source sim, regenerates the change and says where it happened', () => {
    const push = { t: 5000, id: BREAKER, value: 'in' };
    const pilot = simulate(altSetup, { events: [push], start: altStart, untilMs: 8000 });
    expect(pilot.injected).toEqual([
      { t: ONSET_AT + STEP_MS, id: BREAKER, value: 'out', before: 0 },
    ]);
    const withSim = simulate(altSetup, {
      events: [{ t: ONSET_AT + STEP_MS, id: BREAKER, value: 'out', source: 'sim' }, push],
      start: altStart,
      untilMs: 8000,
    });
    expect(withSim).toEqual(pilot);
    expect(pilot.state.controls[BREAKER]).toBe('in');
    // An event due in the very step of the onset counts as applied before the change.
    const early = simulate(altSetup, {
      events: [{ t: ONSET_AT, id: 'sw.alternator_1', value: 'off' }],
      start: altStart,
      untilMs: 4000,
    });
    expect(early.injected[0]?.before).toBe(1);
  });

  it('a scenario without faulted controls changes nothing and reports nothing', () => {
    const result = simulate(setup, { events: [], start, untilMs: 5000 });
    expect(result.injected).toEqual([]);
  });
});
