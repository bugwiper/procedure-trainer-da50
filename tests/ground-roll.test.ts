import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_CUES } from '../src/aircraft/da50rg/cues';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { initialQuantities } from '../src/engine/predicates';
import { Run } from '../src/engine/run';
import { STEP_MS, simSetup, simulate } from '../src/engine/sim';
import type { SimEvent } from '../src/engine/sim';
import { PanelStore } from '../src/engine/store';
import { checkScenario } from '../src/scenario/lint';
import type { Scenario } from '../src/scenario/schema';
import { rollRate } from '../src/ui/panel/windscreen/roll-series';

// The ground speed model (Phase 5.1, P-03): POWER above idle accelerates, drag slows, the toe
// brakes and the parking brake stop the aircraft; only a scenario that sets ground_roll gets it.
// Runs on the fixture scenario of the windscreen physics tests (no shipped scenario sets
// ground_roll before plans 02 and 03), through simulate and a live Run.

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = checkScenario(
  readFileSync(`${root}tests/fixtures/scenarios/smoke-onset.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checked.ok) throw new Error(`the fixture does not pass: ${JSON.stringify(checked.issues)}`);
const fixture = (parameters: Readonly<Record<string, number>>): Scenario => ({
  ...checked.scenario,
  parameters,
  outcomes: [],
});

const SECOND_MS = 1000;
const ROLL = { ground_roll: 1 } as const;

function speedAt(
  scenario: Scenario,
  untilMs: number,
  events: readonly SimEvent[] = [],
  from = 0,
): number {
  const setup = simSetup(DA50RG_ENV, scenario);
  const state = simulate(setup, {
    events,
    start: { ...initialQuantities(scenario, DA50RG_ENV.quantities), ground_speed_kt: from },
    untilMs,
  }).state;
  const value = state.quantities['ground_speed_kt'];
  if (value === undefined) throw new Error('no ground speed');
  return value;
}

describe('the ground speed (P-03)', () => {
  it('is a hidden quantity from 0 to 100 knots at rest, read by the roll_speed cue from 0 to 60', () => {
    const def = DA50RG_QUANTITIES.get('ground_speed_kt');
    expect([def?.min, def?.max, def?.base]).toEqual([0, 100, 0]);
    const cue = DA50RG_CUES.get('roll_speed');
    expect([cue?.quantity, cue?.from, cue?.to]).toEqual(['ground_speed_kt', 0, 60]);
    expect(
      DA50RG_CUES.levels({ ...DA50RG_QUANTITIES.baseValues(), ground_speed_kt: 30 }),
    ).toMatchObject({ roll_speed: 0.5 });
  });

  it('holds still without the parameter, whatever the lever and the brakes do', () => {
    const events: SimEvent[] = [{ t: 0, id: 'lv.power', value: 'p100' }];
    expect(speedAt(fixture({}), 60 * SECOND_MS, events, 0)).toBe(0);
    expect(speedAt(fixture({}), 60 * SECOND_MS, events, 40)).toBe(40);
    const braked: SimEvent[] = [{ t: 0, id: 'lv.toe_brakes', value: 'applied' }];
    expect(speedAt(fixture({}), 60 * SECOND_MS, braked, 40)).toBe(40);
  });

  it('does not accelerate at idle: the aircraft stays at 0 and a rolling one slows down', () => {
    const idle: SimEvent[] = [{ t: 0, id: 'lv.power', value: 'p0' }];
    expect(speedAt(fixture(ROLL), 60 * SECOND_MS, idle, 0)).toBe(0);
    expect(speedAt(fixture(ROLL), 10 * SECOND_MS, idle, 30)).toBeLessThan(30);
  });

  it('accelerates only above idle: full POWER gains speed, more POWER gains more', () => {
    const at = (power: string): number =>
      speedAt(fixture(ROLL), 10 * SECOND_MS, [{ t: 0, id: 'lv.power', value: power }]);
    expect(at('p50')).toBeGreaterThan(0);
    expect(at('p100')).toBeGreaterThan(at('p50'));
    // 2.0 - 0.3 = 1.7 kt/s for 10 s.
    expect(at('p100')).toBeGreaterThan(16);
    expect(at('p100')).toBeLessThan(18);
  });

  it('is stopped by the toe brakes from 40 knots, and by the parking brake alike', () => {
    for (const brake of [
      { id: 'lv.toe_brakes', value: 'applied' },
      { id: 'lv.parking_brake', value: 'set' },
    ]) {
      const events: SimEvent[] = [
        { t: 0, id: 'lv.power', value: 'p0' },
        { t: 0, ...brake },
      ];
      expect(speedAt(fixture(ROLL), 2 * SECOND_MS, events, 40), brake.id).toBeLessThan(40);
      expect(speedAt(fixture(ROLL), 15 * SECOND_MS, events, 40), brake.id).toBe(0);
    }
  });

  it('stops under the brakes even at full POWER, and releasing them lets it roll again', () => {
    const braked: SimEvent[] = [
      { t: 0, id: 'lv.power', value: 'p100' },
      { t: 0, id: 'lv.toe_brakes', value: 'applied' },
    ];
    expect(speedAt(fixture(ROLL), 30 * SECOND_MS, braked, 40)).toBe(0);
    const released: SimEvent[] = [
      ...braked,
      { t: 20 * SECOND_MS, id: 'lv.toe_brakes', value: 'released' },
    ];
    expect(speedAt(fixture(ROLL), 40 * SECOND_MS, released, 40)).toBeGreaterThan(0);
  });

  it('slows faster with the engine off than with it running at idle', () => {
    const off: SimEvent[] = [{ t: 0, id: 'sw.engine_master', value: 'off' }];
    const idle: SimEvent[] = [{ t: 0, id: 'lv.power', value: 'p0' }];
    expect(speedAt(fixture(ROLL), 20 * SECOND_MS, off, 30)).toBeLessThan(
      speedAt(fixture(ROLL), 20 * SECOND_MS, idle, 30),
    );
  });

  it('never leaves its range', () => {
    const full: SimEvent[] = [{ t: 0, id: 'lv.power', value: 'p100' }];
    expect(speedAt(fixture(ROLL), 10 * 60 * SECOND_MS, full)).toBe(100);
  });

  it('a live run equals the replay at every step, to the last digit', () => {
    const scenario = fixture(ROLL);
    const setup = simSetup(DA50RG_ENV, scenario);
    const start = { ...initialQuantities(scenario, DA50RG_ENV.quantities), ground_speed_kt: 20 };
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const live = new Run({ setup, store, start });
    for (let n = 1; n <= 300; n++) {
      if (n === 1) store.dispatch('lv.power', 'p100', live.clock.now());
      if (n === 150) store.dispatch('lv.toe_brakes', 'applied', live.clock.now());
      live.step();
      const replay = simulate(setup, { events: store.events(), start, untilMs: n * STEP_MS });
      expect(live.state.quantities, `step ${String(n)}`).toEqual(replay.state.quantities);
    }
    expect(live.state.quantities['ground_speed_kt']).toBeGreaterThan(0);
  });
});

describe('the roll rate (P-04)', () => {
  it('follows the level, stands still at 0 and tops out at 1', () => {
    expect(rollRate(0)).toBe(0);
    expect(rollRate(0.25)).toBe(0.25);
    expect(rollRate(1)).toBe(1);
    expect(rollRate(7)).toBe(1);
  });

  it('counts a level that is not a number, or below 0, as standing still (T-05.1-02)', () => {
    for (const level of [Number.NaN, -1, -Infinity, Number.NEGATIVE_INFINITY]) {
      expect(rollRate(level), String(level)).toBe(0);
    }
    expect(rollRate(Infinity)).toBe(1);
  });
});
