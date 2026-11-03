import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import {
  DA50RG_PHYSICS,
  PITCH_FPM_PER_KT_DEG,
  PITCH_MIN_SPEED_KT,
  PITCH_PER_KT,
} from '../src/aircraft/da50rg/physics';
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
    expect([def(VS).min, def(VS).max, def(VS).base]).toEqual([-3000, 3000, 0]);
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

// Task 2: the regimes, the airspeed, pitch and bank.
const SPEED = 'airspeed_kt';
const PITCH = 'pitch_deg';
const BANK = 'bank_deg';
const GROUND = 'ground_speed_kt';
const CRUISE_KT = def(SPEED).base;

/** The pitch of the formula of V-04 for a settled flight, computed from the exported constants. */
const pitchOf = (speedKt: number, vsFpm: number): number =>
  vsFpm / (Math.max(speedKt, PITCH_MIN_SPEED_KT) * PITCH_FPM_PER_KT_DEG) +
  PITCH_PER_KT * (CRUISE_KT - speedKt);

const at = (seconds: number): number => seconds * SECOND_MS;
const ENGINE_OFF: SimEvent = { t: 0, id: 'sw.engine_master', value: 'off' };

describe('anchored: every flight quantity holds its base with the engine running', () => {
  it('600 steps change no flight quantity at the normal parameters', () => {
    const state = run(flight({}), at(60));
    for (const id of [SPEED, VS, ALT, PITCH, BANK]) expect(q(state, id), id).toBe(def(id).base);
  });

  it('the new quantities are hidden with the bases of the free panel', () => {
    expect([def(PITCH).min, def(PITCH).max, def(PITCH).base]).toEqual([-30, 30, 0]);
    expect([def(BANK).min, def(BANK).max, def(BANK).base]).toEqual([-60, 60, 0]);
    expect(def(SPEED).scale).toBe(def(PITCH).scale);
    expect(def(BANK).scale).toBe(def(PITCH).scale);
  });

  it('the flight parameters have the normal values of V-03', () => {
    expect(parameter('flight_speed_kt').normal).toBe(140);
    expect(parameter('flight_vs_fpm').normal).toBe(0);
    expect(parameter('flight_bank_deg').normal).toBe(0);
    expect(parameter('glide_speed_kt').normal).toBe(90);
    expect(parameter('glide_vs_fpm').normal).toBe(-700);
    expect(parameter('terrain_ft').normal).toBe(1400);
    for (const id of ['flight_speed_kt', 'flight_bank_deg', 'glide_speed_kt', 'glide_vs_fpm']) {
      expect(parameter(id).profile, id).toBe(true);
    }
  });
});

describe('the ground regime (ground_roll above 0)', () => {
  const scenario = flight(
    { flight_speed_kt: 120, flight_vs_fpm: 800, flight_bank_deg: 20 },
    {
      parameters: { ground_roll: 1 },
      quantities: { [GROUND]: 40, [SPEED]: 40 },
      controls: { 'lv.parking_brake': 'set' },
    },
  );

  it('the airspeed follows the ground speed within 0.5 kt, the script of flight is ignored', () => {
    const state = run(scenario, at(20));
    expect(Math.abs(q(state, SPEED) - q(state, GROUND))).toBeLessThan(0.5);
  });

  it('vertical speed, pitch and bank are 0 and the altitude holds', () => {
    const state = run(scenario, at(60));
    expect(q(state, VS)).toBe(0);
    expect(q(state, PITCH)).toBe(0);
    expect(q(state, BANK)).toBe(0);
    expect(q(state, ALT)).toBe(def(ALT).base);
  });

  it('reads 0 at a standstill, not the cruise speed', () => {
    // POWER at idle and the brakes on: the ground speed stays 0 and the reading drops to it at once.
    const stopped = run(
      flight(
        {},
        {
          parameters: { ground_roll: 1 },
          controls: { 'lv.power': 'p0', 'lv.parking_brake': 'set' },
        },
      ),
      at(30),
    );
    expect(q(stopped, SPEED)).toBe(0);
  });
});

describe('the flight regime', () => {
  const profile = {
    flight_speed_kt: 70,
    flight_vs_fpm: 500,
    flight_bank_deg: 20,
    glide_speed_kt: 100,
    glide_vs_fpm: -400,
  };
  const climbing = flight(profile, { quantities: { [ALT]: 3000 } });

  it('with the engine running the targets are the flight_* parameters', () => {
    const state = run(climbing, at(60));
    expect(q(state, SPEED)).toBeCloseTo(70, 1);
    expect(q(state, VS)).toBeCloseTo(500, 0);
    expect(q(state, BANK)).toBeCloseTo(20, 1);
  });

  it('the airspeed settles within 5 percent of the target after 15 s', () => {
    const state = run(climbing, at(15));
    expect(Math.abs(q(state, SPEED) - 70)).toBeLessThan(70 * 0.05);
    const slower = flight({ flight_speed_kt: 100 }, { quantities: { [ALT]: 3000 } });
    expect(Math.abs(q(run(slower, at(15)), SPEED) - 100)).toBeLessThan(100 * 0.05);
  });

  it('ENGINE MASTER off gives the glide_* values', () => {
    const state = run(climbing, at(60), [ENGINE_OFF]);
    expect(q(state, SPEED)).toBeCloseTo(100, 1);
    expect(q(state, VS)).toBeCloseTo(-400, 0);
    expect(q(state, BANK)).toBeCloseTo(20, 1);
  });

  it('the FUEL selector OFF gives the glide_* values', () => {
    const state = run(climbing, at(60), [{ t: 0, id: 'sw.fuel_valve', value: 'off' }]);
    expect(q(state, SPEED)).toBeCloseTo(100, 1);
    expect(q(state, VS)).toBeCloseTo(-400, 0);
  });

  it('an empty drawn tank gives the glide_* values', () => {
    const empty = flight(profile, { quantities: { [ALT]: 3000, fuel_qty_lh_gal: 0 } });
    const state = run(empty, at(60));
    expect(q(state, SPEED)).toBeCloseTo(100, 1);
    expect(q(state, VS)).toBeCloseTo(-400, 0);
  });

  it('the glide defaults apply when the profile does not override them', () => {
    const state = run(flight({}, { quantities: { [ALT]: 5500 } }), at(90), [ENGINE_OFF]);
    expect(q(state, SPEED)).toBeCloseTo(parameter('glide_speed_kt').normal, 1);
    expect(q(state, VS)).toBeCloseTo(parameter('glide_vs_fpm').normal, 0);
    expect(q(state, ALT)).toBeLessThan(5500);
  });

  it('POWER changes nothing: no aerodynamic effect on speed, vertical speed or attitude', () => {
    const base = run(climbing, at(60));
    const throttled = run(climbing, at(60), [
      { t: 0, id: 'lv.power', value: 'p100' },
      { t: at(30), id: 'lv.power', value: 'p25' },
    ]);
    for (const id of [SPEED, VS, ALT, PITCH, BANK]) {
      expect(q(throttled, id), id).toBe(q(base, id));
    }
  });
});

describe('pitch and bank', () => {
  it('a level cruise reads 0', () => {
    expect(q(run(flight({}, { quantities: { [ALT]: 4500 } }), at(60)), PITCH)).toBe(0);
  });

  it('a 70 kt climb of 500 fpm reads about +8 degrees', () => {
    const state = run(
      flight({ flight_speed_kt: 70, flight_vs_fpm: 500 }, { quantities: { [ALT]: 1450 } }),
      at(60),
    );
    expect(q(state, PITCH)).toBeCloseTo(pitchOf(70, 500), 1);
    expect(q(state, PITCH)).toBeGreaterThan(7.5);
    expect(q(state, PITCH)).toBeLessThan(9);
  });

  it('a 90 kt glide of -700 fpm reads about -1.4 degrees', () => {
    const state = run(flight({}, { quantities: { [ALT]: 5500 } }), at(90), [ENGINE_OFF]);
    expect(q(state, PITCH)).toBeCloseTo(pitchOf(90, -700), 1);
    expect(q(state, PITCH)).toBeGreaterThan(-1.6);
    expect(q(state, PITCH)).toBeLessThan(-1.2);
  });

  it('the speed in the flight-path division is floored, so a stopped aircraft stays finite', () => {
    const slow = flight(
      { flight_speed_kt: 0, flight_vs_fpm: 500 },
      { quantities: { [ALT]: 2000 } },
    );
    const state = run(slow, at(60));
    expect(Number.isFinite(q(state, PITCH))).toBe(true);
    expect(Math.abs(q(state, PITCH))).toBeLessThanOrEqual(def(PITCH).max);
  });

  it('a parked aircraft at the terrain stands level, also in the flight regime before an onset', () => {
    const parked = flight({ flight_speed_kt: 0, glide_speed_kt: 0, glide_vs_fpm: 0 });
    const state = run(parked, at(60));
    expect(q(state, PITCH)).toBe(0);
    // The reading comes down from the cruise speed and stops within a hundredth of a knot.
    expect(q(state, SPEED)).toBeCloseTo(0, 2);
  });

  it('the bank settles at flight_bank_deg and the sign is kept', () => {
    for (const bank of [20, -35]) {
      const state = run(flight({ flight_bank_deg: bank }, { quantities: { [ALT]: 3000 } }), at(60));
      expect(q(state, BANK)).toBeCloseTo(bank, 2);
    }
  });
});

describe('shipped scenarios script their flight', () => {
  const load = (file: string): Scenario => {
    const result = checkScenario(readFileSync(`${root}scenarios/${file}.toon`, 'utf8'), DA50RG_ENV);
    if (!result.ok) throw new Error(`${file} does not pass the scenario check`);
    return result.scenario;
  };
  const speedAt = (scenario: Scenario, seconds: number, onsetAt?: number): number =>
    q(run(scenario, at(seconds), [], onsetAt), SPEED);

  it.each(['fire/eng-fire-ground', 'fire/elec-fire-ground'])(
    '%s: the parked Realistic start reads 0 kt before the onset',
    (file) => {
      const scenario = load(file);
      const onsetAt = at(60);
      for (const seconds of [0, 1, 5, 20, 59]) {
        expect(speedAt(scenario, seconds, onsetAt), `${file} at ${seconds}`).toBe(0);
      }
      expect(q(run(scenario, at(59), [], onsetAt), PITCH)).toBe(0);
    },
  );

  it('T/O FIRE ABORT: the Realistic start is on the roll model from the first second, as Easy is (WR-02)', () => {
    const scenario = load('fire/takeoff-fire-abort');
    // Full power gains speed from 40 kt before the onset; the speed does not wait for the failure.
    expect(speedAt(scenario, 0, at(60))).toBe(40);
    expect(speedAt(scenario, 30, at(60))).toBe(speedAt(scenario, 30));
    expect(speedAt(scenario, 30, at(60))).toBeGreaterThan(40);
  });

  it('T/O FIRE NO ABORT: climbs out at 70 kt and 500 fpm from 1450 ft at every level, glides when the engine stops', () => {
    const scenario = load('fire/takeoff-fire-no-abort');
    for (const onsetAt of [undefined, at(60)]) {
      const state = run(scenario, at(30), [], onsetAt);
      expect(q(state, SPEED)).toBe(70);
      expect(q(state, VS)).toBeCloseTo(500, 0);
      expect(q(state, ALT)).toBeGreaterThan(1450);
    }
    // The glide starts at once: 50 ft above the runway it ends on the terrain within seconds (the
    // simulation has no landing model), where the vertical speed is held at 0.
    const gliding = run(scenario, at(5), [ENGINE_OFF]);
    expect(q(gliding, VS)).toBeLessThan(0);
    expect(q(gliding, ALT)).toBeLessThan(1450);
    const down = run(scenario, at(60), [ENGINE_OFF]);
    expect(q(down, ALT)).toBe(1400);
    expect(q(down, SPEED)).toBeCloseTo(70, 1);
  });

  it('T/O FIRE NO ABORT: from a higher altitude the engine stop glides at 300 fpm', () => {
    const scenario = {
      ...load('fire/takeoff-fire-no-abort'),
      initial: { controls: {}, quantities: { [ALT]: 2400 } },
    };
    const stopped = run(scenario, at(60), [ENGINE_OFF]);
    expect(q(stopped, VS)).toBeCloseTo(-300, 0);
    expect(q(stopped, SPEED)).toBeCloseTo(70, 1);
  });

  it('ENGINE FIRE in flight: level at 5500 ft and 140 kt, glides after the engine is stopped', () => {
    const scenario = load('engine/eng-fire-in-flight');
    const level = run(scenario, at(30));
    expect(q(level, ALT)).toBe(5500);
    expect(q(level, SPEED)).toBe(CRUISE_KT);
    const stopped = run(scenario, at(90), [ENGINE_OFF]);
    expect(q(stopped, VS)).toBeCloseTo(-700, 0);
    expect(q(stopped, ALT)).toBeLessThan(5500);
  });

  it.each([
    ['engine/eng-oil-temp-green', 4500],
    ['electrical/elec-altn1-fail', 3500],
    ['electrical/elec-altn2-fail', 3500],
    ['fire/elec-fire-flight', 4500],
    ['icing/icing-unintentional', 7500],
    ['engine/eng-fire-in-flight', 5500],
  ])('%s starts at %d ft in both forms and flies level', (file, feet) => {
    const scenario = load(file);
    expect(scenario.initial.quantities[ALT]).toBe(feet);
    expect(scenario.onset?.quantities[ALT]).toBe(feet);
    expect(q(run(scenario, at(30)), ALT)).toBe(feet);
    expect(q(run(scenario, at(30), [], at(60)), ALT)).toBe(feet);
  });
});

describe('a live Run equals its replay with an engine stop', () => {
  it('at every step over a climb, an engine stop and a bank', () => {
    const scenario = flight(
      { flight_speed_kt: 70, flight_vs_fpm: 500, flight_bank_deg: 15 },
      { quantities: { [ALT]: 3000 } },
    );
    const setup = simSetup(DA50RG_ENV, scenario);
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const live = new Run({ setup, store, start });
    for (let n = 1; n <= 400; n += 1) {
      if (n === 150) {
        const result = store.dispatch('sw.engine_master', 'off', live.clock.now());
        if (!result.ok) throw new Error(`engine master rejected: ${result.reason}`);
      }
      live.step();
      const replay = simulate(setup, {
        events: store.events(),
        start,
        untilMs: live.state.t,
      }).state;
      expect(live.state, `step ${n}`).toEqual(replay);
    }
    expect(q(live.state, VS)).toBeLessThan(0);
    live.dispose();
  });

  it('a replay over 30 simulated minutes with an engine stop stays finite', () => {
    const scenario = flight({}, { quantities: { [ALT]: 9000 } });
    const state = run(scenario, 30 * MINUTE_MS, [ENGINE_OFF]);
    for (const id of [SPEED, VS, ALT, PITCH, BANK]) {
      expect(Number.isFinite(q(state, id)), id).toBe(true);
    }
    // 700 fpm from 9000 ft reaches the terrain in about 11 minutes and stays there.
    expect(q(state, ALT)).toBe(1400);
    // The lag of the pitch stops within a thousandth of a degree of 0 (the scale of the quantity).
    expect(q(state, PITCH)).toBeCloseTo(0, 2);
  });
});

// WR-02 (Phase 6 review): the ground is a property of the situation. ground_roll is a profile
// parameter, so a ground situation is on the ground from the first second at the level Realistic,
// before the onset, with no hand-carried speed script in its profile.
describe('the ground situations are on the ground before the onset (WR-02)', () => {
  const files = [
    'scenarios/fire/eng-fire-ground.toon',
    'scenarios/fire/elec-fire-ground.toon',
    'scenarios/fire/takeoff-fire-abort.toon',
  ];
  const load = (file: string): Scenario => {
    const result = checkScenario(readFileSync(`${root}${file}`, 'utf8'), DA50RG_ENV);
    if (!result.ok) throw new Error(`${file} does not pass the scenario check`);
    return result.scenario;
  };

  it('ground_roll is a profile parameter, not a failure parameter', () => {
    expect(parameter('ground_roll').profile).toBe(true);
  });

  for (const file of files) {
    const scenario = load(file);

    it(`${file}: ground_roll sits in the profile, which holds nothing else but the ground`, () => {
      expect(scenario.profile).toEqual({ ground_roll: 1 });
      expect(scenario.parameters['ground_roll']).toBeUndefined();
      expect(scenario.onset?.parameters['ground_roll']).toBeUndefined();
    });

    it(`${file}: before a late onset the Realistic run reads the ground speed, level, at the start altitude`, () => {
      const onsetAt = 40 * SECOND_MS;
      const setup = simSetup(DA50RG_ENV, scenario, { onsetAt });
      const start = realisticQuantities(scenario, DA50RG_ENV.quantities);
      for (let s = 1; s <= 30; s++) {
        const state = simulate(setup, { events: [], start, untilMs: s * SECOND_MS }).state;
        expect(
          Math.abs(q(state, 'airspeed_kt') - q(state, 'ground_speed_kt')),
          `${file} ${String(s)} s`,
        ).toBeLessThan(0.5);
        expect(q(state, ALT)).toBe(def(ALT).base);
        expect(q(state, VS)).toBe(0);
        expect(q(state, 'pitch_deg')).toBe(0);
        // Never the cruise speed of the aircraft's normal profile, which would be 140 kt.
        expect(q(state, 'airspeed_kt')).toBeLessThan(def('airspeed_kt').base);
      }
    });
  }

  it('T/O FIRE ABORT rolls on with full power before the onset', () => {
    const scenario = load('scenarios/fire/takeoff-fire-abort.toon');
    const setup = simSetup(DA50RG_ENV, scenario, { onsetAt: 40 * SECOND_MS });
    const start = realisticQuantities(scenario, DA50RG_ENV.quantities);
    const state = simulate(setup, { events: [], start, untilMs: 10 * SECOND_MS }).state;
    expect(q(state, 'ground_speed_kt')).toBeGreaterThan(start['ground_speed_kt'] ?? Number.NaN);
  });

  it('the two parked situations stand still before the onset', () => {
    for (const file of files.slice(0, 2)) {
      const scenario = load(file);
      const setup = simSetup(DA50RG_ENV, scenario, { onsetAt: 40 * SECOND_MS });
      const start = realisticQuantities(scenario, DA50RG_ENV.quantities);
      const state = simulate(setup, { events: [], start, untilMs: 20 * SECOND_MS }).state;
      expect(q(state, 'ground_speed_kt'), file).toBe(0);
      expect(q(state, 'airspeed_kt'), file).toBe(0);
    }
  });
});

// Phase 9 (plan 09-02, D-08): the profile parameter engine_stopped stops the engine from the first
// second at every level; the existing glide regime and the stopped-propeller cue apply.
describe('the stopped engine of the profile (Phase 9, D-08)', () => {
  const profile = { engine_stopped: 1, glide_speed_kt: 80, glide_vs_fpm: -700 };
  const gliding = flight(profile, { quantities: { [ALT]: 3000 } });
  const powered = flight(
    { glide_speed_kt: 80, glide_vs_fpm: -700 },
    { quantities: { [ALT]: 3000 } },
  );

  it('is a profile parameter', () => {
    expect(parameter('engine_stopped').profile).toBe(true);
  });

  it('the glide values are reached with every switch as it is, from the first second', () => {
    const state = run(gliding, at(60));
    expect(q(state, SPEED)).toBeCloseTo(80, 1);
    expect(q(state, VS)).toBeCloseTo(-700, 0);
    expect(q(state, ALT)).toBeLessThan(3000);
    // The same file without the parameter flies the powered regime (140 kt, level).
    const flying = run(powered, at(60));
    expect(q(flying, SPEED)).toBeCloseTo(140, 1);
    expect(q(flying, VS)).toBeCloseTo(0, 0);
  });

  it('the same values as ENGINE MASTER off in the powered file', () => {
    const stoppedByParameter = run(gliding, at(60));
    const stoppedBySwitch = run(powered, at(60), [ENGINE_OFF]);
    for (const id of [SPEED, VS, PITCH, BANK]) {
      expect(q(stoppedByParameter, id), id).toBeCloseTo(q(stoppedBySwitch, id), 0);
    }
  });

  it('the pitch follows the glide: a nose-down attitude', () => {
    expect(q(run(gliding, at(60)), PITCH)).toBeLessThan(0);
  });

  it('the propeller cue shows stopped, and the engine reads zero', () => {
    const state = run(gliding, at(60));
    expect(q(state, 'rpm')).toBeLessThan(1);
    expect(DA50RG_ENV.cues.levels(state.quantities)['prop_stopped']).toBe(1);
    expect(q(state, 'fuel_flow_gph')).toBe(0);
    const spinning = run(powered, at(60));
    expect(DA50RG_ENV.cues.levels(spinning.quantities)['prop_stopped']).toBe(0);
  });

  it('a Realistic start is on the glide before the onset, as on every level', () => {
    // The Realistic start takes the base quantities laid over by the onset quantities: 3000 ft here.
    const onset = {
      window_s: [60, 120],
      quantities: { [ALT]: 3000 },
      parameters: {},
      controls: {},
      cues: [],
    };
    const withOnset = flight(profile, {
      quantities: { [ALT]: 3000 },
      onset: onset as unknown as Scenario['onset'],
    });
    const state = run(withOnset, at(30), [], at(100));
    expect(q(state, SPEED)).toBeCloseTo(80, 0);
    expect(q(state, VS)).toBeCloseTo(-700, 0);
    expect(q(state, 'rpm')).toBeLessThan(1);
  });

  it('a live Run equals its replay at every step', () => {
    const setup = simSetup(DA50RG_ENV, gliding);
    const start = initialQuantities(gliding, DA50RG_ENV.quantities);
    const store = new PanelStore(DA50RG);
    store.reset(gliding.initial.controls);
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
    live.dispose();
  });
});
