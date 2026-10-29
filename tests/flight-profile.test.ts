import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_PHYSICS } from '../src/aircraft/da50rg/physics';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { initialQuantities, realisticQuantities } from '../src/engine/predicates';
import { Run } from '../src/engine/run';
import { STEP_MS, simSetup, simulate } from '../src/engine/sim';
import type { SimEvent } from '../src/engine/sim';
import { PanelStore } from '../src/engine/store';
import { checkScenario } from '../src/scenario/lint';
import type { Scenario } from '../src/scenario/schema';

// The flight state of the PFD (Phase 6, plan 03; D-08, D-09): the vertical speed, the altitude and,
// from task 2, the airspeed regimes, pitch and bank follow the scripted profile of a scenario. The
// scenario is a fixture made from the blueprint (outcomes removed), the profile is the variable.

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = checkScenario(
  readFileSync(`${root}scenarios/engine/eng-oil-temp-green.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checked.ok) throw new Error('the blueprint does not pass the scenario check');
const blueprint = checked.scenario;

const SECOND_MS = 1000;
const MINUTE_MS = 60_000;
const ALT = 'altitude_ft';
const VS = 'vertical_speed_fpm';

const def = (id: string) => {
  const found = DA50RG_QUANTITIES.get(id);
  if (found === undefined) throw new Error(`no quantity ${id}`);
  return found;
};
const parameter = (id: string) => {
  const found = DA50RG_PHYSICS.parameter(id);
  if (found === undefined) throw new Error(`no parameter ${id}`);
  return found;
};

/** The blueprint with no failure, no outcome, the given profile, start quantities and onset. */
function flight(
  profile: Readonly<Record<string, number>>,
  options: {
    controls?: Readonly<Record<string, string>>;
    quantities?: Readonly<Record<string, number>>;
    onset?: Scenario['onset'];
    parameters?: Readonly<Record<string, number>>;
  } = {},
): Scenario {
  const { onset: _ignored, ...rest } = blueprint;
  void _ignored;
  return {
    ...rest,
    initial: { controls: { ...options.controls }, quantities: { ...options.quantities } },
    parameters: { ...options.parameters },
    profile,
    outcomes: [],
    variants: [],
    ...(options.onset === undefined ? {} : { onset: options.onset }),
  };
}

function run(
  scenario: Scenario,
  untilMs: number,
  events: readonly SimEvent[] = [],
  onsetAt?: number,
) {
  const setup = simSetup(DA50RG_ENV, scenario, onsetAt === undefined ? {} : { onsetAt });
  const start =
    onsetAt === undefined
      ? initialQuantities(scenario, DA50RG_ENV.quantities)
      : realisticQuantities(scenario, DA50RG_ENV.quantities);
  return simulate(setup, { events, start, untilMs }).state;
}

const q = (state: { quantities: Readonly<Record<string, number>> }, id: string): number => {
  const value = state.quantities[id];
  if (value === undefined) throw new Error(`no value for ${id}`);
  return value;
};

describe('the flight quantities and the profile parameters (V-02, V-03)', () => {
  it('altitude and vertical speed are hidden quantities with the static bases of the free panel', () => {
    expect([def(ALT).min, def(ALT).max, def(ALT).base]).toEqual([0, 20000, 1400]);
    expect([def(VS).min, def(VS).max, def(VS).base]).toEqual([-2000, 2000, 0]);
  });

  it('the flight parameters and the two situation parameters of plan 01 carry the profile flag', () => {
    for (const id of ['flight_vs_fpm', 'terrain_ft', 'oat_c', 'fuel_temp_delta_c']) {
      expect(parameter(id).profile, id).toBe(true);
    }
  });

  it('no failure parameter carries the profile flag', () => {
    for (const id of [
      'oil_cooling',
      'alt1_output',
      'alt1_short',
      'alt2_output',
      'alt2_short',
      'engine_fire',
      'smoke_source',
      'ice_accretion',
      'oil_leak',
      'ground_roll',
    ]) {
      expect(parameter(id).profile, id).not.toBe(true);
    }
  });
});

describe('anchored at the normal parameters (C-09)', () => {
  it('600 steps with the base values change no flight quantity', () => {
    const scenario = flight({});
    const state = run(scenario, 60 * SECOND_MS);
    expect(q(state, ALT)).toBe(def(ALT).base);
    expect(q(state, VS)).toBe(def(VS).base);
  });
});

describe('a climb', () => {
  const scenario = flight({ flight_vs_fpm: 500 }, { quantities: { [ALT]: 1450 } });

  it('gains 500 ft per simulated minute once the vertical speed has settled', () => {
    const early = run(scenario, 30 * SECOND_MS);
    const late = run(scenario, 30 * SECOND_MS + MINUTE_MS);
    // The vertical speed lag has settled long before; a minute then adds 500 ft within the rounding
    // of the steps (the quantity is rounded to 0.01 ft per step).
    expect(q(late, ALT) - q(early, ALT)).toBeCloseTo(500, 0);
    expect(Math.abs(q(late, VS) - 500)).toBeLessThan(1);
  });

  it('starts from the vertical speed of the base and rises with the 3 s time constant', () => {
    const first = run(scenario, STEP_MS);
    expect(q(first, VS)).toBeGreaterThan(0);
    expect(q(first, VS)).toBeLessThan(500 / 10);
    expect(Math.abs(q(run(scenario, 15 * SECOND_MS), VS) - 500)).toBeLessThan(500 * 0.05);
  });
});

describe('the terrain floor', () => {
  it('holds a descent at terrain_ft and stops the vertical speed there', () => {
    const scenario = flight(
      { flight_vs_fpm: -600, terrain_ft: 1400 },
      { quantities: { [ALT]: 1500 } },
    );
    const state = run(scenario, 5 * MINUTE_MS);
    expect(q(state, ALT)).toBe(1400);
    expect(Math.abs(q(state, VS))).toBeLessThan(1);
  });

  it('never sinks below the terrain at any step, also with a steep descent', () => {
    const scenario = flight(
      { flight_vs_fpm: -2000, terrain_ft: 2000 },
      { quantities: { [ALT]: 2100 } },
    );
    const setup = simSetup(DA50RG_ENV, scenario);
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    for (let ms = STEP_MS; ms <= 90 * SECOND_MS; ms += 5 * SECOND_MS) {
      const state = simulate(setup, { events: [], start, untilMs: ms }).state;
      expect(q(state, ALT), `at ${ms}`).toBeGreaterThanOrEqual(2000);
    }
  });
});

describe('the profile is in force from the first second (V-01)', () => {
  const onset = {
    window_s: [2, 6] as [number, number],
    quantities: {},
    parameters: {},
    controls: {},
    cues: [],
  };
  const scenario = flight(
    { flight_vs_fpm: 500 },
    {
      quantities: { [ALT]: 1450 },
      onset: onset as unknown as Scenario['onset'],
      parameters: { engine_fire: 1 },
    },
  );

  it('a Realistic setup climbs before the onset', () => {
    const setup = simSetup(DA50RG_ENV, scenario, { onsetAt: 60 * SECOND_MS });
    expect(setup.normalParameters['flight_vs_fpm']).toBe(500);
    expect(setup.faultedParameters['flight_vs_fpm']).toBe(500);
    expect(setup.normalParameters['engine_fire']).toBe(0);
    expect(setup.faultedParameters['engine_fire']).toBe(1);
    const state = run(scenario, 20 * SECOND_MS, [], 60 * SECOND_MS);
    expect(q(state, VS)).toBeGreaterThan(400);
  });

  it('the onset parameters and the scenario parameters lie over the profile', () => {
    const layered = {
      ...scenario,
      parameters: { flight_vs_fpm: 100 },
      onset: {
        ...(onset as object),
        parameters: { flight_vs_fpm: 200 },
      } as unknown as Scenario['onset'],
    };
    const setup = simSetup(DA50RG_ENV, layered, { onsetAt: 1000 });
    expect(setup.normalParameters['flight_vs_fpm']).toBe(500);
    expect(setup.faultedParameters['flight_vs_fpm']).toBe(200);
    const easy = simSetup(DA50RG_ENV, layered);
    expect(easy.faultedParameters['flight_vs_fpm']).toBe(100);
  });

  it('a scenario without a profile gives exactly the old parameter sets', () => {
    const plain = flight({}, { parameters: { oil_cooling: 0.5 } });
    const setup = simSetup(DA50RG_ENV, plain);
    expect(setup.normalParameters).toBe(DA50RG_PHYSICS.normalParameters());
    expect(setup.faultedParameters).toEqual({
      ...DA50RG_PHYSICS.normalParameters(),
      oil_cooling: 0.5,
    });
  });
});

describe('a live Run equals its replay', () => {
  it('at every step of a climb', () => {
    const scenario = flight({ flight_vs_fpm: 500 }, { quantities: { [ALT]: 1450 } });
    const setup = simSetup(DA50RG_ENV, scenario);
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const live = new Run({ setup, store, start });
    for (let n = 1; n <= 200; n += 1) {
      live.step();
      const replay = simulate(setup, {
        events: store.events(),
        start,
        untilMs: live.state.t,
      }).state;
      expect(live.state, `step ${n}`).toEqual(replay);
    }
    expect(q(live.state, ALT)).toBeGreaterThan(1450);
    live.dispose();
  });

  it('a replay over 30 simulated minutes stays finite and inside the ranges', () => {
    const scenario = flight(
      { flight_vs_fpm: 2000, terrain_ft: 1400 },
      { quantities: { [ALT]: 1450 } },
    );
    const state = run(scenario, 30 * MINUTE_MS);
    expect(Number.isFinite(q(state, ALT))).toBe(true);
    expect(q(state, ALT)).toBeLessThanOrEqual(def(ALT).max);
    expect(q(state, ALT)).toBe(def(ALT).max);
  });
});
