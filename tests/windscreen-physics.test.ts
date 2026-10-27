import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { initialQuantities } from '../src/engine/predicates';
import { Run } from '../src/engine/run';
import { STEP_MS, simSetup, simulate } from '../src/engine/sim';
import type { SimEvent } from '../src/engine/sim';
import { PanelStore } from '../src/engine/store';
import { checkScenario } from '../src/scenario/lint';
import type { Scenario } from '../src/scenario/schema';

// The simulated effects of the windscreen layer (Phase 5, C-02, C-04, C-06): cabin smoke, windscreen
// ice with warm air and the WIND SHIELD spray, the oil film. They run on a fixture scenario under
// tests/fixtures/scenarios (C-07), because no shipped scenario uses them yet. Everything goes
// through simulate or a live Run; there is no UI here.

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = checkScenario(
  readFileSync(`${root}tests/fixtures/scenarios/smoke-onset.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checked.ok)
  throw new Error(`the smoke fixture does not pass: ${JSON.stringify(checked.issues)}`);
/** The fixture scenario with its parameters replaced and no outcome, so a run keeps simulating. */
const fixture = (parameters: Readonly<Record<string, number>>): Scenario => ({
  ...checked.scenario,
  parameters,
  outcomes: [],
});

const MINUTE_MS = 60_000;

function quantity(values: Readonly<Record<string, number>>, id: string): number {
  const value = Object.hasOwn(values, id) ? values[id] : undefined;
  if (value === undefined) throw new Error(`no quantity ${id}`);
  return value;
}

/** A do-nothing or scripted replay of `scenario`; `start` overlays the base quantities. */
function run(
  scenario: Scenario,
  untilMs: number,
  events: readonly SimEvent[] = [],
  start: Readonly<Record<string, number>> = {},
) {
  const setup = simSetup(DA50RG_ENV, scenario);
  return simulate(setup, {
    events,
    start: { ...initialQuantities(scenario, DA50RG_ENV.quantities), ...start },
    untilMs,
  }).state;
}

describe('cabin smoke (C-02)', () => {
  it('follows the scenario parameter: the density heads for 100 times it with a time constant of 15 s', () => {
    const full = run(fixture({ smoke_source: 1 }), 15_000).quantities;
    // One time constant of the lag: about 63 % of the way.
    expect(quantity(full, 'smoke_density')).toBeGreaterThan(61);
    expect(quantity(full, 'smoke_density')).toBeLessThan(65);
    expect(
      quantity(run(fixture({ smoke_source: 1 }), 5 * MINUTE_MS).quantities, 'smoke_density'),
    ).toBeGreaterThan(99.9);
    const half = run(fixture({ smoke_source: 0.5 }), 5 * MINUTE_MS).quantities;
    expect(quantity(half, 'smoke_density')).toBeGreaterThan(49.9);
    expect(quantity(half, 'smoke_density')).toBeLessThan(50.1);
  });

  it('normal parameters keep the cabin clear: the density stays 0', () => {
    const state = run(fixture({}), 10 * MINUTE_MS);
    expect(quantity(state.quantities, 'smoke_density')).toBe(0);
  });

  it('has no ventilation effect: the ECS and circulating air controls change nothing', () => {
    const events: SimEvent[] = [
      { t: 0, id: 'lv.env_circ', value: 'fresh' },
      { t: 0, id: 'lv.ecs_shutoff', value: 'pulled' },
    ];
    const plain = run(fixture({ smoke_source: 1 }), MINUTE_MS);
    const handled = run(fixture({ smoke_source: 1 }), MINUTE_MS, events);
    expect(quantity(handled.quantities, 'smoke_density')).toBe(
      quantity(plain.quantities, 'smoke_density'),
    );
  });

  it('a live run equals the replay at every step, to the last digit', () => {
    const scenario = fixture({ smoke_source: 0.8 });
    const setup = simSetup(DA50RG_ENV, scenario);
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const live = new Run({ setup, store, start });
    for (let n = 1; n <= 400; n++) {
      live.step();
      const replay = simulate(setup, { events: store.events(), start, untilMs: n * STEP_MS });
      expect(live.state.quantities, `step ${String(n)}`).toEqual(replay.state.quantities);
    }
    expect(quantity(live.state.quantities, 'smoke_density')).toBeGreaterThan(0);
  });
});
