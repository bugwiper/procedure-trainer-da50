import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { initialQuantities, realisticQuantities } from '../src/engine/predicates';
import { Run } from '../src/engine/run';
import { STEP_MS, simSetup, simulate } from '../src/engine/sim';
import { PanelStore } from '../src/engine/store';
import type { ControlEvent } from '../src/engine/store';
import { resolveVariant } from '../src/engine/variants';
import { checkScenario } from '../src/scenario/lint';

// The run and the action log (plan 03-04; D-03, C-21, C-22, T-03-09, T-03-10): a reaction that
// fires makes the event it used consumed, a retract of an event the simulation already applied
// rebuilds the run by replaying the remaining log, and a retract of an event not yet applied
// causes no rebuild and arms nothing. Real PanelStore over the DA50 RG, events dispatched at the
// run clock's time between steps, like the UI does.

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = checkScenario(
  readFileSync(`${root}scenarios/engine/eng-oil-temp-green.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checked.ok) throw new Error('the blueprint does not pass the scenario check');
const scenario = checked.scenario;
const setup = simSetup(DA50RG_ENV, scenario);
const start = initialQuantities(scenario, DA50RG_ENV.quantities);

const MODE = 'sw.deice_mode';
const MAX = 'btn.deice_max';
const MAX_FLAG = 'deice.max_active';
const MAX_REACTION = 'deice_max';

interface Fixture {
  readonly store: PanelStore;
  readonly run: Run;
}

function fixture(): Fixture {
  const store = new PanelStore(DA50RG);
  store.reset(scenario.initial.controls);
  return { store, run: new Run({ setup, store, start }) };
}

function act(f: Fixture, id: string, value: string): ControlEvent {
  const result = f.store.dispatch(id, value, f.run.clock.now());
  if (!result.ok) throw new Error(`${id} -> ${value} rejected: ${result.reason}`);
  return result.event;
}

function steps(f: Fixture, n: number): void {
  for (let i = 0; i < n; i++) f.run.step();
}

/** What a replay of the store's current log gives at the run's current time. */
function replayOf(f: Fixture) {
  return simulate(setup, { events: f.store.events(), start, untilMs: f.run.state.t }).state;
}

describe('a retract of an event the simulation already applied (C-22)', () => {
  it('leaves a state deep-equal to a run that never had the event', () => {
    const a = fixture();
    steps(a, 3);
    act(a, 'lv.cowl_flap', 'open');
    steps(a, 2);
    const power = act(a, 'lv.power', 'p50');
    steps(a, 20);

    const b = fixture();
    steps(b, 3);
    act(b, 'lv.cowl_flap', 'open');
    steps(b, 22);

    // The event is applied and has moved the state before it is retracted.
    expect(a.run.state.controls['lv.power']).toBe('p50');
    expect(a.run.state.quantities['load_pct']).not.toBe(b.run.state.quantities['load_pct']);

    expect(a.store.retract(power.seq).ok).toBe(true);
    expect(a.run.state).toEqual(b.run.state);
    expect(a.run.state).toEqual(replayOf(a));
    // The rebuild is exact, so the two runs stay identical from here on.
    steps(a, 10);
    steps(b, 10);
    expect(a.run.state).toEqual(b.run.state);
    a.run.dispose();
    b.run.dispose();
  });

  it('notifies the step listeners with the rebuilt state', () => {
    const f = fixture();
    const seen: number[] = [];
    f.run.onStep((state) => seen.push(state.quantities['load_pct'] ?? Number.NaN));
    steps(f, 2);
    const power = act(f, 'lv.power', 'p50');
    steps(f, 10);
    const before = seen.length;
    expect(f.store.retract(power.seq).ok).toBe(true);
    expect(seen).toHaveLength(before + 1);
    expect(seen.at(-1)).toBe(f.run.state.quantities['load_pct']);
    f.run.dispose();
  });

  it('takes the cursor back with the log: a reused seq is applied, never skipped', () => {
    const f = fixture();
    steps(f, 2);
    const first = act(f, 'lv.power', 'p50');
    steps(f, 3);
    expect(f.run.state.controls['lv.power']).toBe('p50');
    expect(f.store.retract(first.seq).ok).toBe(true);
    expect(f.run.state.controls['lv.power']).toBe('p75');

    const second = act(f, 'lv.cowl_flap', 'open');
    expect(second.seq).toBe(first.seq);
    steps(f, 1);
    expect(f.run.state.controls['lv.cowl_flap']).toBe('open');
    expect(f.run.state.controls['lv.power']).toBe('p75');
    expect(f.run.state).toEqual(replayOf(f));
    f.run.dispose();
  });
});

describe('a retract of an event no step has applied yet (D-03)', () => {
  it('causes no rebuild and the state after more steps equals a run that never had it', () => {
    const a = fixture();
    steps(a, 5);
    const power = act(a, 'lv.power', 'p50');
    const before = a.run.state;
    let notified = 0;
    a.run.onStep(() => {
      notified += 1;
    });
    expect(a.store.retract(power.seq).ok).toBe(true);
    // Nothing was rebuilt: the very same state object, no listener call.
    expect(a.run.state).toBe(before);
    expect(notified).toBe(0);
    steps(a, 10);

    const b = fixture();
    steps(b, 15);
    expect(a.run.state).toEqual(b.run.state);
    a.run.dispose();
    b.run.dispose();
  });

  it('never fires what the removed event would have armed', () => {
    const f = fixture();
    act(f, MODE, 'high');
    steps(f, 2);
    const press = act(f, MAX, 'pressed');
    expect(f.store.retract(press.seq).ok).toBe(true);
    steps(f, 20);
    expect(f.run.state.flags).toEqual({});
    expect(f.run.state.timers).toEqual({});
    expect(f.store.consumedThrough).toBe(-1);
    f.run.dispose();
  });
});

describe('a reaction that fires consumes its event (D-03, C-21, T-03-09)', () => {
  it('refuses the retract of the press that started the MAX run, with the reason consumed', () => {
    const f = fixture();
    const mode = act(f, MODE, 'high');
    steps(f, 2);
    const press = act(f, MAX, 'pressed');
    expect(f.store.consumedThrough).toBe(-1);
    steps(f, 1);

    expect(f.run.state.flags[MAX_FLAG]).toBe(true);
    expect(f.store.consumedThrough).toBe(press.seq);
    expect(f.store.retract(press.seq)).toEqual({ ok: false, reason: 'consumed' });
    // The watermark covers every older event too.
    expect(f.store.retract(mode.seq)).toEqual({ ok: false, reason: 'consumed' });
    expect(f.store.events()).toHaveLength(2);
    f.run.dispose();
  });

  it('does not consume anything for a press that starts no reaction', () => {
    const f = fixture();
    act(f, MODE, 'norm');
    steps(f, 2);
    const press = act(f, MAX, 'pressed');
    steps(f, 2);
    expect(f.run.state.flags).toEqual({});
    expect(f.store.consumedThrough).toBe(-1);
    expect(f.store.retract(press.seq).ok).toBe(true);
    f.run.dispose();
  });

  it('does not consume anything for a press while the reaction is already active', () => {
    const f = fixture();
    act(f, MODE, 'high');
    steps(f, 1);
    const press = act(f, MAX, 'pressed');
    steps(f, 1);
    act(f, MAX, 'released');
    steps(f, 5);
    const again = act(f, MAX, 'pressed');
    steps(f, 1);
    // The second press started nothing, so only the first one is consumed and it can be undone.
    expect(f.store.consumedThrough).toBe(press.seq);
    expect(f.store.retract(again.seq).ok).toBe(true);
    expect(f.run.state).toEqual(replayOf(f));
    expect(f.run.state.flags[MAX_FLAG]).toBe(true);
    f.run.dispose();
  });

  it('still allows the retract of the release, and the MAX run re-fires identically', () => {
    const f = fixture();
    act(f, MODE, 'high');
    steps(f, 2);
    act(f, MAX, 'pressed');
    steps(f, 1);
    const release = act(f, MAX, 'released');

    // Not applied yet: nothing is rebuilt.
    const unapplied = f.run.state;
    expect(f.store.retract(release.seq).ok).toBe(true);
    expect(f.run.state).toBe(unapplied);

    // Applied: dispatch it again, let a step apply it, then retract it.
    const again = act(f, MAX, 'released');
    steps(f, 5);
    expect(f.run.state.controls[MAX]).toBe('released');
    expect(f.store.retract(again.seq).ok).toBe(true);

    const reference = fixture();
    act(reference, MODE, 'high');
    steps(reference, 2);
    act(reference, MAX, 'pressed');
    steps(reference, 1);
    steps(reference, 5);
    expect(f.run.state.controls[MAX]).toBe('pressed');
    expect(f.run.state).toEqual(reference.run.state);
    expect(f.run.state.flags[MAX_FLAG]).toBe(true);
    expect(f.run.state.timers[MAX_REACTION]).toBe(reference.run.state.timers[MAX_REACTION]);
    f.run.dispose();
    reference.run.dispose();
  });

  it('keeps the MAX run alive when a mode change that cleared it is retracted', () => {
    const f = fixture();
    act(f, MODE, 'high');
    steps(f, 1);
    act(f, MAX, 'pressed');
    steps(f, 2);
    const leave = act(f, MODE, 'norm');
    steps(f, 3);
    expect(f.run.state.flags).toEqual({});
    // Leaving HIGH is not an event a reaction used, so it can be undone, and the run is back.
    expect(f.store.retract(leave.seq).ok).toBe(true);
    expect(f.run.state.flags[MAX_FLAG]).toBe(true);
    expect(f.run.state).toEqual(replayOf(f));
    f.run.dispose();
  });
});

describe('incremental stepping equals simulate (D-02, C-22)', () => {
  it('holds at every step of a recording with a MAX press and a retract', () => {
    const f = fixture();
    const plan = new Map<number, () => void>([
      [3, () => act(f, 'lv.cowl_flap', 'open')],
      [5, () => act(f, MODE, 'high')],
      [9, () => act(f, MAX, 'pressed')],
      [10, () => act(f, MAX, 'released')],
      [14, () => act(f, 'lv.power', 'p50')],
      [
        20,
        () => {
          const newest = f.store.events().at(-1);
          if (newest === undefined) throw new Error('no event to retract');
          expect(f.store.retract(newest.seq).ok).toBe(true);
        },
      ],
      [24, () => act(f, 'lv.power', 'p60')],
      [30, () => act(f, MODE, 'norm')],
    ]);
    for (let n = 1; n <= 60; n++) {
      plan.get(n - 1)?.();
      f.run.step();
      expect(f.run.state, `step ${String(n)}`).toEqual(replayOf(f));
      expect(f.run.clock.now()).toBe(n * STEP_MS);
    }
    f.run.dispose();
  });
});

describe('a control the simulation sets at the onset (phase 3.1, V-06)', () => {
  const file = checkScenario(
    readFileSync(`${root}scenarios/electrical/elec-altn1-fail.toon`, 'utf8'),
    DA50RG_ENV,
  );
  if (!file.ok) throw new Error('the ALTN 1 FAIL file does not pass the scenario check');
  const popped = resolveVariant(file.scenario, 'breaker_popped', true);
  const ONSET_AT = 3000;
  const altSetup = simSetup(DA50RG_ENV, popped, { onsetAt: ONSET_AT });
  const altStart = realisticQuantities(popped, DA50RG_ENV.quantities);
  const BREAKER = 'cb.alt1';

  function altFixture(): Fixture {
    const store = new PanelStore(DA50RG);
    store.reset(popped.initial.controls);
    return { store, run: new Run({ setup: altSetup, store, start: altStart }) };
  }

  const altReplay = (f: Fixture) =>
    simulate(altSetup, { events: f.store.events(), start: altStart, untilMs: f.run.state.t }).state;

  it('the breaker is in until the onset, then out, as a log event of the simulation', () => {
    const f = altFixture();
    steps(f, ONSET_AT / STEP_MS);
    expect(f.store.get(BREAKER)).toBe('in');
    expect(f.store.events()).toEqual([]);
    steps(f, 1);
    expect(f.store.get(BREAKER)).toBe('out');
    expect(f.store.events()).toEqual([
      { seq: 0, t: ONSET_AT + STEP_MS, id: BREAKER, value: 'out', source: 'sim' },
    ]);
    steps(f, 100);
    expect(f.store.events()).toHaveLength(1);
    expect(f.run.state.controls[BREAKER]).toBe('out');
  });

  it('live stepping equals the replay at every step, also with a push in the onset step', () => {
    const f = altFixture();
    // The pilot pulls the breaker at 1000 and pushes it in again in the very step of the onset.
    const plan = new Map<number, string>([
      [10, 'out'],
      [30, 'in'],
    ]);
    for (let n = 1; n <= 200; n++) {
      const value = plan.get(n - 1);
      if (value !== undefined)
        expect(f.store.dispatch(BREAKER, value, f.run.clock.now()).ok).toBe(true);
      f.run.step();
      expect(f.run.state, `step ${String(n)}`).toEqual(altReplay(f));
      expect(f.store.get(BREAKER), `store at step ${String(n)}`).toBe(
        f.run.state.controls[BREAKER],
      );
    }
    expect(f.store.get(BREAKER)).toBe('out');
    expect(f.store.events().map((e) => e.source)).toEqual(['user', 'user', 'sim']);
  });

  it('a push after the onset holds, and a retract of it rebuilds equal to the replay', () => {
    const f = altFixture();
    steps(f, ONSET_AT / STEP_MS + 5);
    expect(f.store.get(BREAKER)).toBe('out');
    const push = act(f, BREAKER, 'in');
    steps(f, 20);
    expect(f.run.state.controls[BREAKER]).toBe('in');
    expect(f.store.retract(push.seq).ok).toBe(true);
    expect(f.store.get(BREAKER)).toBe('out');
    expect(f.run.state).toEqual(altReplay(f));
    steps(f, 20);
    expect(f.run.state).toEqual(altReplay(f));
    expect(f.store.events().map((e) => e.source)).toEqual(['sim']);
  });

  it('the change of the simulation cannot be retracted', () => {
    const f = altFixture();
    steps(f, ONSET_AT / STEP_MS + 2);
    expect(f.store.retract(0)).toEqual({ ok: false, reason: 'system' });
    expect(f.store.get(BREAKER)).toBe('out');
  });
});

describe('a shorted alternator pops its breaker again (phase 3.1, V-09)', () => {
  const BREAKER = 'cb.alt1';
  const shorted = {
    ...scenario,
    outcomes: [],
    initial: { ...scenario.initial, controls: { ...scenario.initial.controls, [BREAKER]: 'out' } },
    parameters: { ...scenario.parameters, alt1_short: 1 },
  };
  const shortSetup = simSetup(DA50RG_ENV, shorted);
  const shortStart = initialQuantities(scenario, DA50RG_ENV.quantities);
  const DELAY_STEPS = 20;

  function shortFixture(): Fixture {
    const store = new PanelStore(DA50RG);
    store.reset(shorted.initial.controls);
    return { store, run: new Run({ setup: shortSetup, store, start: shortStart }) };
  }
  const shortReplay = (f: Fixture) =>
    simulate(shortSetup, {
      events: f.store.events(),
      start: shortStart,
      untilMs: f.run.state.t,
    }).state;

  it('the pop is a sim event in the log, and live stepping equals the replay at every step', () => {
    const f = shortFixture();
    act(f, BREAKER, 'in');
    for (let n = 1; n <= DELAY_STEPS + 10; n++) {
      f.run.step();
      expect(f.run.state, `step ${String(n)}`).toEqual(shortReplay(f));
      expect(f.store.get(BREAKER), `store at step ${String(n)}`).toBe(
        f.run.state.controls[BREAKER],
      );
    }
    expect(f.store.events().map((e) => [e.id, e.value, e.source, e.t])).toEqual([
      [BREAKER, 'in', 'user', 0],
      [BREAKER, 'out', 'sim', DELAY_STEPS * STEP_MS],
    ]);
    expect(f.store.get(BREAKER)).toBe('out');
    f.run.dispose();
  });

  it('a retract of the push before the delay leaves nothing armed', () => {
    const a = shortFixture();
    const pushed = act(a, BREAKER, 'in');
    steps(a, 5);
    expect(a.run.state.trips).not.toEqual({});
    expect(a.store.retract(pushed.seq).ok).toBe(true);
    expect(a.run.state.trips).toEqual({});
    const b = shortFixture();
    steps(b, 5);
    expect(a.run.state).toEqual(b.run.state);
    steps(a, 2 * DELAY_STEPS);
    expect(a.store.events()).toEqual([]);
    expect(a.store.get(BREAKER)).toBe('out');
    a.run.dispose();
    b.run.dispose();
  });

  it('a retract after the pop is refused: the push is not the newest event, the pop is the simulation', () => {
    const f = shortFixture();
    const pushed = act(f, BREAKER, 'in');
    steps(f, DELAY_STEPS + 1);
    const log = f.store.events();
    expect(log).toHaveLength(2);
    expect(f.store.retract(pushed.seq)).toMatchObject({ ok: false, reason: 'not-last' });
    expect(f.store.retract(1)).toMatchObject({ ok: false, reason: 'system' });
    f.run.dispose();
  });
});
