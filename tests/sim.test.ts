import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG } from '../src/aircraft/da50rg/panel';
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
import type { SimEvent } from '../src/engine/sim';
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
  it('stay multiples of 0.01 inside their range, and an unmodelled quantity never changes', () => {
    const events: SimEvent[] = [
      { t: 5000, id: 'lv.power', value: 'p100' },
      { t: 90_000, id: 'lv.power', value: 'p0' },
      { t: 90_000, id: 'sw.engine_master', value: 'off' },
    ];
    for (let ms = STEP_MS; ms <= 300_000; ms += 5_000) {
      const { quantities } = simulate(setup, { events, start, untilMs: ms }).state;
      for (const def of DA50RG_ENV.quantities.all) {
        const value = quantity(quantities, def.id);
        expect(quantise(value), `${def.id} at ${String(ms)}`).toBe(value);
        expect(value).toBeGreaterThanOrEqual(def.min);
        expect(value).toBeLessThanOrEqual(def.max);
      }
      expect(quantity(quantities, OIL_PRESSURE)).toBe(quantity(start, OIL_PRESSURE));
    }
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

  it('start quantities not named by the scenario take the idle value', () => {
    const state = initSim(setup, { [OIL_TEMP]: 100 });
    expect(quantity(state.quantities, OIL_TEMP)).toBe(100);
    expect(quantity(state.quantities, OIL_PRESSURE)).toBe(
      DA50RG_ENV.quantities.idleValues()[OIL_PRESSURE],
    );
    expect(state.t).toBe(0);
  });
});

describe('parameters and onset (C-07)', () => {
  it('the faulted record is the normal record overlaid with the scenario parameters', () => {
    expect(setup.normalParameters).toEqual({ oil_cooling: 1 });
    expect(setup.faultedParameters).toEqual({ oil_cooling: scenario.parameters['oil_cooling'] });
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

  it('stepSim reports no fired reactions in this plan', () => {
    expect(stepSim(setup, initSim(setup, start), []).fired).toEqual([]);
  });
});
