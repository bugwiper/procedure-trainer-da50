import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { WINDSHIELD_SPRAY_ACTIVE } from '../src/aircraft/da50rg/indicators';
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

  it('builds up at the plain rate: the ECS, the circulating air and the window do not speed it', () => {
    const events: SimEvent[] = [
      { t: 0, id: 'lv.env_circ', value: 'fresh' },
      { t: 0, id: 'lv.ecs_shutoff', value: 'pulled' },
      { t: 0, id: 'sw.emerg_window', value: 'open' },
    ];
    const plain = run(fixture({ smoke_source: 1 }), MINUTE_MS);
    const handled = run(fixture({ smoke_source: 1 }), MINUTE_MS, events);
    expect(quantity(handled.quantities, 'smoke_density')).toBe(
      quantity(plain.quantities, 'smoke_density'),
    );
  });

  describe('clearing (Phase 5.1)', () => {
    const FULL = { smoke_density: 100 } as const;
    const density = (events: readonly SimEvent[], untilMs: number): number =>
      quantity(
        run(fixture({ smoke_source: 1 }), untilMs, events, FULL).quantities,
        'smoke_density',
      );
    const MASTER_OFF: SimEvent = { t: 0, id: 'sw.elect_master', value: 'off' };
    const FRESH: SimEvent = { t: 0, id: 'lv.env_circ', value: 'fresh' };
    const WINDOW: SimEvent = { t: 0, id: 'sw.emerg_window', value: 'open' };

    it('stays full while ELECT. MASTER is on, whatever the ventilation', () => {
      expect(density([FRESH, WINDOW], MINUTE_MS)).toBeGreaterThan(99.9);
    });

    it('starts to clear once ELECT. MASTER is off, with the plain time constant of 15 s', () => {
      // One time constant: the density falls to about 37 % of its start.
      const after = density([MASTER_OFF], 15_000);
      expect(after).toBeGreaterThan(35);
      expect(after).toBeLessThan(39);
      expect(density([MASTER_OFF], 5 * MINUTE_MS)).toBeLessThan(0.1);
    });

    it('clears faster with fresh air, faster still with the window too, at most 3 times as fast', () => {
      const plain = density([MASTER_OFF], 10_000);
      const fresh = density([MASTER_OFF, FRESH], 10_000);
      const window = density([MASTER_OFF, WINDOW], 10_000);
      const both = density([MASTER_OFF, FRESH, WINDOW], 10_000);
      expect(fresh).toBeLessThan(plain);
      expect(window).toBeLessThan(plain);
      expect(both).toBeLessThan(fresh);
      expect(both).toBeLessThan(window);
      // Both together (rate 3) over 10 s equal the plain clearing over 30 s, within a step.
      expect(Math.abs(both - density([MASTER_OFF], 30_000))).toBeLessThan(0.5);
    });

    it('ventilation alone does not clear smoke that has a live source', () => {
      expect(density([FRESH, WINDOW], 10_000)).toBeGreaterThan(99.9);
    });
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

// Windscreen ice, warm air and the WIND SHIELD spray (C-04, owner answers of 2026-10-27).
describe('windscreen ice (C-04)', () => {
  const ICE = ['ice_pilot', 'ice_copilot'] as const;
  const WARM: SimEvent[] = [
    { t: 0, id: 'lv.env_direction', value: 'defrost' },
    { t: 0, id: 'lv.env_temp', value: 'warm' },
  ];
  const press = (t: number): SimEvent[] => [
    { t, id: 'btn.deice_windshield', value: 'pressed' },
    { t: t + 500, id: 'btn.deice_windshield', value: 'released' },
  ];

  it('builds on both sides at 40 per minute times the parameter', () => {
    for (const parameter of [1, 0.5]) {
      const q = run(fixture({ ice_accretion: parameter }), MINUTE_MS).quantities;
      for (const id of ICE) {
        expect(quantity(q, id), `${id} at ${String(parameter)}`).toBeCloseTo(40 * parameter, 1);
      }
    }
  });

  it('stays clear with the normal parameter', () => {
    const q = run(fixture({}), 10 * MINUTE_MS).quantities;
    for (const id of ICE) expect(quantity(q, id)).toBe(0);
  });

  it('warm air alone melts both sides, but only very slowly: 6 per minute', () => {
    const q = run(fixture({}), MINUTE_MS, WARM, { ice_pilot: 50, ice_copilot: 50 }).quantities;
    for (const id of ICE) expect(quantity(q, id), id).toBeCloseTo(44, 1);
  });

  it('warm air hardly slows heavy icing: it takes 6 per minute off the accretion', () => {
    const open = run(fixture({ ice_accretion: 1 }), MINUTE_MS).quantities;
    const warm = run(fixture({ ice_accretion: 1 }), MINUTE_MS, WARM).quantities;
    for (const id of ICE) {
      expect(quantity(open, id) - quantity(warm, id), id).toBeCloseTo(6, 1);
      expect(quantity(warm, id), id).toBeGreaterThan(30);
    }
  });

  it.each([
    ['DIRECTION on face', [{ t: 0, id: 'lv.env_temp', value: 'warm' }]],
    [
      'DIRECTION on feet',
      [
        { t: 0, id: 'lv.env_direction', value: 'feet' },
        { t: 0, id: 'lv.env_temp', value: 'warm' },
      ],
    ],
    [
      'TEMPERATURE cold',
      [
        { t: 0, id: 'lv.env_direction', value: 'defrost' },
        { t: 0, id: 'lv.env_temp', value: 'cold' },
      ],
    ],
    ['TEMPERATURE 50', [{ t: 0, id: 'lv.env_direction', value: 'defrost' }]],
  ] as const)('%s does nothing to the ice', (_name, events) => {
    const q = run(fixture({}), MINUTE_MS, events, { ice_pilot: 50, ice_copilot: 50 }).quantities;
    for (const id of ICE) expect(quantity(q, id), id).toBe(50);
  });

  it('TEMPERATURE 75 with DIRECTION on defrost melts too', () => {
    const events: SimEvent[] = [
      { t: 0, id: 'lv.env_direction', value: 'defrost' },
      { t: 0, id: 'lv.env_temp', value: 't75' },
    ];
    const q = run(fixture({}), MINUTE_MS, events, { ice_pilot: 50, ice_copilot: 50 }).quantities;
    expect(quantity(q, 'ice_pilot')).toBeCloseTo(44, 1);
  });

  describe('the WIND SHIELD spray', () => {
    const start = { ice_pilot: 80, ice_copilot: 80 };

    it('clears the pilot side directly, within about a second, and not the co-pilot side', () => {
      const scenario = fixture({ ice_accretion: 1 });
      const before = run(scenario, 5_000, press(5_000), start).quantities;
      const after = run(scenario, 6_500, press(5_000), start).quantities;
      expect(quantity(before, 'ice_pilot')).toBeGreaterThan(80);
      expect(quantity(after, 'ice_pilot')).toBe(0);
      expect(quantity(after, 'ice_copilot')).toBeGreaterThan(quantity(before, 'ice_copilot'));
    });

    it('keeps the pilot side clear while the spray runs and lets it ice up again afterwards', () => {
      const scenario = fixture({ ice_accretion: 1 });
      const during = run(scenario, 14_000, press(5_000), start).quantities;
      const later = run(scenario, 5_000 + 10_000 + 30_000, press(5_000), start).quantities;
      expect(quantity(during, 'ice_pilot')).toBe(0);
      // 30 s of accretion at 40 per minute after the 10 s spray.
      expect(quantity(later, 'ice_pilot')).toBeCloseTo(20, 0);
    });

    it('is harmless with clear glass: nothing changes', () => {
      const q = run(fixture({}), 20_000, press(1_000)).quantities;
      for (const id of ICE) expect(quantity(q, id)).toBe(0);
    });

    it('runs the flag for 10 s of run time and ignores a second press during it', () => {
      const flag =
        DA50RG_ENV.physics.reactions.find((r) => r.id === 'windshield_spray')?.flag ?? '';
      expect(flag).toBe(WINDSHIELD_SPRAY_ACTIVE);
      const events = [...press(2_000), ...press(8_000)];
      const scenario = fixture({});
      expect(run(scenario, 2_000, events).flags[flag]).toBeUndefined();
      expect(run(scenario, 2_100, events).flags[flag]).toBe(true);
      expect(run(scenario, 11_900, events).flags[flag]).toBe(true);
      // 2 s + 10 s: the second press at 8 s neither restarts nor extends it.
      expect(run(scenario, 12_000, events).flags[flag]).toBeUndefined();
      expect(run(scenario, 20_000, events).flags[flag]).toBeUndefined();
    });

    it('is armed by the press whatever the de-ice mode', () => {
      const flag = WINDSHIELD_SPRAY_ACTIVE;
      for (const mode of ['off', 'norm', 'high']) {
        const events: SimEvent[] = [{ t: 0, id: 'sw.deice_mode', value: mode }, ...press(500)];
        expect(run(fixture({}), 1_000, events).flags[flag], mode).toBe(true);
      }
    });

    it('a live run equals the replay at every step, to the last digit', () => {
      const scenario = fixture({ ice_accretion: 0.7 });
      const setup = simSetup(DA50RG_ENV, scenario);
      const begin = { ...initialQuantities(scenario, DA50RG_ENV.quantities), ...start };
      const store = new PanelStore(DA50RG);
      store.reset(scenario.initial.controls);
      const live = new Run({ setup, store, start: begin });
      for (let n = 1; n <= 700; n++) {
        if (n === 30) store.dispatch('lv.env_direction', 'defrost', live.clock.now());
        if (n === 31) store.dispatch('lv.env_temp', 'warm', live.clock.now());
        if (n === 100) store.dispatch('btn.deice_windshield', 'pressed', live.clock.now());
        if (n === 105) store.dispatch('btn.deice_windshield', 'released', live.clock.now());
        live.step();
        const replay = simulate(setup, {
          events: store.events(),
          start: begin,
          untilMs: n * STEP_MS,
        });
        expect(live.state.quantities, `step ${String(n)}`).toEqual(replay.state.quantities);
        expect(live.state.flags, `step ${String(n)}`).toEqual(replay.state.flags);
      }
      expect(quantity(live.state.quantities, 'ice_copilot')).toBeGreaterThan(80);
    });
  });
});

// The cheap extras (C-06): a stopped propeller from the engine speed, the oil film from a leak.
describe('the stopped propeller (C-06)', () => {
  const MASTER_OFF: SimEvent[] = [{ t: 0, id: 'sw.engine_master', value: 'off' }];
  const levelOf = (rpm: number): number => DA50RG_ENV.cues.levels({ rpm })['prop_stopped'] ?? -1;

  it('reads the base rpm as level 0: no stopped propeller on the free panel or in an untouched run', () => {
    const base = DA50RG_ENV.quantities.baseValues();
    expect(DA50RG_ENV.cues.levels(base)['prop_stopped']).toBe(0);
    const state = run(fixture({}), 5 * MINUTE_MS);
    expect(DA50RG_ENV.cues.levels(state.quantities)['prop_stopped']).toBe(0);
  });

  it('is a two-state cue split at the engine-stopped line: 100 rpm and above is level 0, below it level 1', () => {
    expect(levelOf(2300)).toBe(0);
    expect(levelOf(600)).toBe(0);
    expect(levelOf(100)).toBe(0);
    expect(levelOf(99)).toBe(1);
    expect(levelOf(0)).toBe(1);
  });

  it('ENGINE MASTER off brings the cue to 1 within seconds, not at once', () => {
    const early = run(fixture({}), 500, MASTER_OFF).quantities;
    expect(DA50RG_ENV.cues.levels(early)['prop_stopped']).toBe(0);
    const state = run(fixture({}), 12_000, MASTER_OFF).quantities;
    expect(DA50RG_ENV.cues.levels(state)['prop_stopped']).toBe(1);
  });

  it('the FUEL selector OFF stops it too', () => {
    const state = run(fixture({}), 8_000, [{ t: 0, id: 'sw.fuel_valve', value: 'off' }]).quantities;
    expect(DA50RG_ENV.cues.levels(state)['prop_stopped']).toBe(1);
  });
});

describe('the oil film (C-06)', () => {
  it('grows at 30 per minute times the leak parameter while the engine runs', () => {
    for (const leak of [1, 0.5]) {
      const q = run(fixture({ oil_leak: leak }), MINUTE_MS).quantities;
      expect(quantity(q, 'oil_film'), String(leak)).toBeCloseTo(30 * leak, 1);
    }
  });

  it('stays clear with the normal parameter', () => {
    expect(quantity(run(fixture({}), 10 * MINUTE_MS).quantities, 'oil_film')).toBe(0);
  });

  it('stops growing with the engine off and never decays', () => {
    const events: SimEvent[] = [{ t: 30_000, id: 'sw.engine_master', value: 'off' }];
    const at = (ms: number): number =>
      quantity(run(fixture({ oil_leak: 1 }), ms, events).quantities, 'oil_film');
    expect(at(30_000)).toBeCloseTo(15, 1);
    expect(at(MINUTE_MS)).toBe(at(31_000));
    expect(at(5 * MINUTE_MS)).toBe(at(31_000));
    expect(at(31_000)).toBeGreaterThan(14);
  });

  it('is capped at 100', () => {
    expect(quantity(run(fixture({ oil_leak: 1 }), 10 * MINUTE_MS).quantities, 'oil_film')).toBe(
      100,
    );
  });

  it('a live run equals the replay at every step, to the last digit', () => {
    const scenario = fixture({ oil_leak: 0.6 });
    const setup = simSetup(DA50RG_ENV, scenario);
    const begin = initialQuantities(scenario, DA50RG_ENV.quantities);
    const store = new PanelStore(DA50RG);
    store.reset(scenario.initial.controls);
    const live = new Run({ setup, store, start: begin });
    for (let n = 1; n <= 500; n++) {
      if (n === 200) store.dispatch('sw.engine_master', 'off', live.clock.now());
      live.step();
      const replay = simulate(setup, {
        events: store.events(),
        start: begin,
        untilMs: n * STEP_MS,
      });
      expect(live.state.quantities, `step ${String(n)}`).toEqual(replay.state.quantities);
    }
    expect(quantity(live.state.quantities, 'oil_film')).toBeGreaterThan(0);
  });
});
