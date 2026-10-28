import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_CUES } from '../src/aircraft/da50rg/cues';
import { grade } from '../src/engine/grading';
import type { GradeResult, RecordedEvent } from '../src/engine/grading';
import { cueVisible } from '../src/engine/cues';
import { initialQuantities, realisticQuantities } from '../src/engine/predicates';
import { simSetup, simulate } from '../src/engine/sim';
import { checkScenario } from '../src/scenario/lint';
import type { Scenario } from '../src/scenario/schema';

// The fire and smoke pack (Phase 5.1, plan 02): the shipped scenario files are graded by control
// state with the golden recordings below, a run that does nothing fails, and the Realistic replay
// shows the cue of the situation within the lint bound. The printed wording is checked in
// tests/checklist-text.test.ts against tests/checklist-reference.ts.
const root = fileURLToPath(new URL('../', import.meta.url));

function load(file: string): Scenario {
  const result = checkScenario(readFileSync(join(root, file), 'utf8'), DA50RG_ENV);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.scenario;
}

const SECOND_MS = 1000;

/** A recording of events one second apart, in the order given. */
function events(...pairs: readonly (readonly [string, string])[]): RecordedEvent[] {
  return pairs.map(([id, value], i) => ({ t: (i + 1) * SECOND_MS, id, value }));
}

function run(
  scenario: Scenario,
  log: readonly RecordedEvent[],
  completedAt = 60 * SECOND_MS,
): GradeResult {
  return grade(scenario, DA50RG_ENV, { scenarioId: scenario.id, completedAt, events: log });
}

/** The levels of the cues of a Realistic run at `afterMs` past the onset, doing nothing. */
function realisticLevels(
  scenario: Scenario,
  onsetAt: number,
  afterMs: number,
  log: readonly RecordedEvent[] = [],
): Readonly<Record<string, number>> {
  const state = simulate(simSetup(DA50RG_ENV, scenario, { onsetAt }), {
    events: log,
    start: realisticQuantities(scenario, DA50RG_ENV.quantities),
    untilMs: onsetAt + afterMs,
  }).state;
  return DA50RG_CUES.levels(state.quantities);
}

const failed = (result: GradeResult) => result.result === 'fail';
const credited = (result: GradeResult, id: string) =>
  result.steps.find((s) => s.id === id)?.credited === true;

describe('Engine Fire on Ground', () => {
  const scenario = load('scenarios/fire/eng-fire-ground.toon');
  const golden = events(
    ['sw.engine_master', 'off'],
    ['sw.fuel_valve', 'off'],
    ['sw.elect_master', 'off'],
    ['lv.door_release', 'open'],
  );

  it('is graded on the three shutdown controls and the door release lever', () => {
    const result = run(scenario, golden);
    expect(result.result).toBe('pass');
    expect(result.steps.map((s) => s.id).sort()).toEqual(
      ['door_open', 'elect_master_off', 'engine_master_off', 'fuel_valve_off'].sort(),
    );
  });

  it('fails a run that does nothing', () => {
    const result = run(scenario, []);
    expect(failed(result)).toBe(true);
    expect(result.steps.every((s) => !s.credited)).toBe(true);
  });

  it('fails a run that leaves the door shut', () => {
    expect(failed(run(scenario, golden.slice(0, 3)))).toBe(true);
  });

  it('does not credit the door for the open emergency window', () => {
    const result = run(scenario, [...golden.slice(0, 3), ...events(['sw.emerg_window', 'open'])]);
    expect(credited(result, 'door_open')).toBe(false);
    expect(failed(result)).toBe(true);
  });

  it('credits the door whenever it is opened, even before the engine is shut down', () => {
    const result = run(
      scenario,
      events(
        ['lv.door_release', 'open'],
        ...golden.slice(0, 3).map((e) => [e.id, e.value] as const),
      ),
    );
    expect(result.result).toBe('pass');
  });

  it('fails a run that switches the emergency fuel pump on', () => {
    const result = run(scenario, [
      ...events(['sw.emerg_fuel_pump', 'on']),
      ...golden.map((e) => ({ ...e, t: e.t + SECOND_MS })),
    ]);
    expect(failed(result)).toBe(true);
    expect(result.harmful.some((h) => h.id === 'emerg_fuel_pump_on')).toBe(true);
  });

  it('ends a long run that does nothing in the outcome fire_spreads', () => {
    const result = run(scenario, [], 300 * SECOND_MS);
    expect(result.outcome?.id).toBe('fire_spreads');
    expect(failed(result)).toBe(true);
  });

  it('shows the flames within the lint bound after a Realistic onset', () => {
    const levels = realisticLevels(scenario, 4 * SECOND_MS, 12 * SECOND_MS);
    expect(cueVisible(levels['flames'] ?? 0)).toBe(true);
  });

  it('starts without flames in the Realistic level', () => {
    const levels = realisticLevels(scenario, 4 * SECOND_MS, 0);
    expect(cueVisible(levels['flames'] ?? 0)).toBe(false);
  });

  it('starts with the fire and the idle power on the other levels', () => {
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    expect(start['fire_intensity']).toBeGreaterThan(0);
  });
});

describe('Electric Fire / Smoke on Ground', () => {
  const scenario = load('scenarios/fire/elec-fire-ground.toon');
  // The booklet list: ONE checklist of five rows, the engine runs at the start.
  const golden = events(
    ['sw.elect_master', 'off'],
    ['lv.power', 'p0'],
    ['sw.fuel_valve', 'off'],
    ['sw.engine_master', 'off'],
    ['lv.door_release', 'open'],
  );

  it('has one checklist and no variants: the engine runs at the start', () => {
    expect(scenario.variants).toEqual([]);
    expect(scenario.initial.controls['lv.power']).toBe('p25');
    expect(scenario.initial.controls['sw.engine_master']).toBeUndefined();
  });

  it('grades the five rows of the booklet, in any order', () => {
    const result = run(scenario, golden);
    expect(result.result).toBe('pass');
    expect(result.steps.map((s) => s.id)).toEqual([
      'elect_master_off',
      'power_idle',
      'fuel_valve_off',
      'engine_master_off',
      'door_open',
    ]);
    expect(result.steps.every((s) => s.severity === 'critical')).toBe(true);
    expect(
      run(
        scenario,
        [...golden].reverse().map((e, i) => ({ ...e, t: (i + 1) * SECOND_MS })),
      ).result,
    ).toBe('pass');
  });

  it('fails a run that stops after ELECT. MASTER and the door only', () => {
    expect(
      failed(run(scenario, events(['sw.elect_master', 'off'], ['lv.door_release', 'open']))),
    ).toBe(true);
  });

  it('fails a run that leaves out any one row', () => {
    for (let skip = 0; skip < golden.length; skip++) {
      expect(
        failed(
          run(
            scenario,
            golden.filter((_, i) => i !== skip),
          ),
        ),
        golden[skip]?.id,
      ).toBe(true);
    }
  });

  it('fails a do-nothing run', () => {
    expect(failed(run(scenario, []))).toBe(true);
  });

  it('credits POWER only at Ground Idle, the lever position p0', () => {
    const result = run(scenario, events(['lv.power', 'p5']));
    expect(credited(result, 'power_idle')).toBe(false);
    expect(credited(run(scenario, events(['lv.power', 'p0'])), 'power_idle')).toBe(true);
  });

  it('ends a long do-nothing run in the outcome cabin_smoke_full', () => {
    const result = run(scenario, [], 300 * SECOND_MS);
    expect(result.outcome?.id).toBe('cabin_smoke_full');
  });

  it('clears the smoke after ELECT. MASTER off and keeps it with the master on', () => {
    const quantities = (log: readonly RecordedEvent[]) =>
      simulate(simSetup(DA50RG_ENV, scenario), {
        events: log,
        start: initialQuantities(scenario, DA50RG_ENV.quantities),
        untilMs: 40 * SECOND_MS,
      }).state.quantities['smoke_density'] ?? Number.NaN;
    expect(quantities([])).toBeGreaterThan(80);
    const cleared = quantities(events(['sw.elect_master', 'off']));
    expect(cleared).toBeLessThan(20);
    // The circulating air starts at fresh (the aircraft default), so the open window is the extra.
    const withWindow = quantities(events(['sw.elect_master', 'off'], ['sw.emerg_window', 'open']));
    expect(withWindow).toBeLessThan(cleared);
    // Ventilation does not clear smoke whose source is still live.
    expect(quantities(events(['sw.emerg_window', 'open']))).toBeGreaterThan(80);
  });

  it('shows the cabin smoke within the lint bound after a Realistic onset', () => {
    const levels = realisticLevels(scenario, 4 * SECOND_MS, 12 * SECOND_MS);
    expect(cueVisible(levels['cabin_smoke'] ?? 0)).toBe(true);
    expect(cueVisible(realisticLevels(scenario, 4 * SECOND_MS, 0)['cabin_smoke'] ?? 0)).toBe(false);
  });

  it('clears the cue in a golden Realistic replay', () => {
    const log = golden.map((e) => ({ ...e, t: e.t + 10 * SECOND_MS }));
    const levels = realisticLevels(scenario, 4 * SECOND_MS, 60 * SECOND_MS, log);
    expect(cueVisible(levels['cabin_smoke'] ?? 1)).toBe(false);
  });
});

// Electric Fire with Smoke in Flight: the booklet page 18, graded on the two masters, the
// circulating air and the ECS shut-off; the two ** oxygen rows are display rows, the window and
// the door rows are optional (I-01).
describe('Electrical Fire in Flight', () => {
  const scenario = load('scenarios/fire/elec-fire-flight.toon');
  const golden = events(
    ['sw.av_master', 'off'],
    ['sw.elect_master', 'off'],
    ['lv.env_circ', 'fresh'],
    ['lv.ecs_shutoff', 'pulled'],
  );
  const smokeAt = (log: readonly RecordedEvent[], atS: number): number =>
    simulate(simSetup(DA50RG_ENV, scenario), {
      events: log,
      start: initialQuantities(scenario, DA50RG_ENV.quantities),
      untilMs: atS * SECOND_MS,
    }).state.quantities['smoke_density'] ?? Number.NaN;

  it('is graded on the four critical steps and lists the window and the door as optional', () => {
    const result = run(scenario, golden);
    expect(result.result).toBe('pass');
    const severities = Object.fromEntries(result.steps.map((s) => [s.id, s.severity]));
    expect(severities).toEqual({
      av_master_off: 'critical',
      elect_master_off: 'critical',
      circ_air_fresh: 'critical',
      ecs_pulled: 'critical',
      windows_open: 'optional',
      doors_open: 'optional',
    });
  });

  it('has no step for the two ** oxygen rows: they stay display lines', () => {
    const lines = scenario.procedure.flatMap((node) => (node.kind === 'line' ? [node] : []));
    expect(lines.map((l) => [l.number, l.text])).toEqual([
      [1, '** Oxygen System'],
      [2, '** Emergency Descent'],
    ]);
  });

  it('passes with the optional window and door steps open or not, in any order', () => {
    const optional = events(['sw.emerg_window', 'open'], ['lv.door_release', 'open']);
    const later = optional.map((e) => ({ ...e, t: e.t + 10 * SECOND_MS }));
    expect(run(scenario, [...golden, ...later]).result).toBe('pass');
    // The door credited before any critical step, as in flight the landing is not simulated.
    const early = run(scenario, [
      ...events(['lv.door_release', 'open']),
      ...golden.map((e) => ({ ...e, t: e.t + SECOND_MS })),
    ]);
    expect(early.result).toBe('pass');
    expect(credited(early, 'doors_open')).toBe(true);
    expect(
      run(
        scenario,
        [...golden].reverse().map((e, i) => ({ ...e, t: (i + 1) * SECOND_MS })),
      ).result,
    ).toBe('pass');
  });

  it('fails when any one critical step is missing', () => {
    for (let skip = 0; skip < golden.length; skip++) {
      const log = golden.filter((_, i) => i !== skip);
      expect(failed(run(scenario, log)), golden[skip]?.id).toBe(true);
    }
  });

  it('fails a run that does nothing and ends it in the outcome cabin_smoke_full', () => {
    expect(failed(run(scenario, []))).toBe(true);
    expect(run(scenario, [], 300 * SECOND_MS).outcome?.id).toBe('cabin_smoke_full');
  });

  it('keeps the smoke with the circulating air on recirc, then clears it under the golden actions', () => {
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    expect(start['smoke_density']).toBe(40);
    expect(smokeAt([], 40)).toBeGreaterThan(80);
    // The golden run is done by 4 s; the smoke is below the cue's visible level within 60 s.
    const cleared = smokeAt(golden, 60);
    expect(cleared).toBeLessThan(20);
    // Fresh air alone does not clear a live source, the electrical master does.
    expect(smokeAt(events(['lv.env_circ', 'fresh']), 40)).toBeGreaterThan(80);
  });

  it('clears faster with the window open', () => {
    const withWindow = smokeAt(
      [...golden, ...events(['sw.emerg_window', 'open']).map((e) => ({ ...e, t: 5 * SECOND_MS }))],
      30,
    );
    expect(withWindow).toBeLessThan(smokeAt(golden, 30));
  });

  it('clears the cue below the visible level in a golden Realistic replay', () => {
    const log = golden.map((e) => ({ ...e, t: e.t + 10 * SECOND_MS }));
    const levels = realisticLevels(scenario, 4 * SECOND_MS, 90 * SECOND_MS, log);
    expect(cueVisible(levels['cabin_smoke'] ?? 1)).toBe(false);
  });

  it('shows the cabin smoke within the lint bound after a Realistic onset', () => {
    const levels = realisticLevels(scenario, 4 * SECOND_MS, 12 * SECOND_MS);
    expect(cueVisible(levels['cabin_smoke'] ?? 0)).toBe(true);
    expect(cueVisible(realisticLevels(scenario, 4 * SECOND_MS, 0)['cabin_smoke'] ?? 0)).toBe(false);
  });

  it('keeps the static 140 knots on the PFD in flight', () => {
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    expect(start['airspeed_kt']).toBe(DA50RG_ENV.quantities.baseValues()['airspeed_kt']);
  });
});

// Unintentional Flight Into Icing (pack icing): the booklet page 23, graded by control state, the
// ice on the cloud scene, an end of the icing area and a spray that keeps the pilot side clear (the
// exposure and the protection are tested on a fixture in tests/windscreen-physics.test.ts).
describe('Unintentional Flight Into Icing', () => {
  const scenario = load('scenarios/icing/icing-unintentional.toon');
  const golden = events(
    ['sw.deice_mode', 'high'],
    ['sw.prop_deice', 'on'],
    ['sw.pitot_stall_heat', 'on'],
    ['lv.env_temp', 'warm'],
    ['lv.env_direction', 'defrost'],
    ['lv.power', 'p100'],
    ['lv.alt_air', 'open'],
  );
  const MINUTE_MS = 60_000;
  const iceAt = (log: readonly RecordedEvent[], atMs: number): Record<string, number> => {
    const q = simulate(simSetup(DA50RG_ENV, scenario), {
      events: log,
      start: initialQuantities(scenario, DA50RG_ENV.quantities),
      untilMs: atMs,
    }).state.quantities;
    return { pilot: q['ice_pilot'] ?? Number.NaN, copilot: q['ice_copilot'] ?? Number.NaN };
  };
  const press = (t: number): RecordedEvent[] => [
    { t, id: 'btn.deice_windshield', value: 'pressed' },
    { t: t + 500, id: 'btn.deice_windshield', value: 'released' },
  ];

  it('is on the cloud scene with both ice cues and no message', () => {
    expect(scenario.scene).toBe('cloud');
    expect(scenario.onset?.cues).toEqual(['ice_pilot_side', 'ice_copilot_side']);
    expect(scenario.annunciations).toEqual([]);
    expect(scenario.outcomes).toEqual([]);
  });

  it('is graded on the six critical rows, the power increase and the two optional rows', () => {
    const result = run(scenario, golden);
    expect(result.result).toBe('pass');
    expect(Object.fromEntries(result.steps.map((s) => [s.id, s.severity]))).toEqual({
      deice_high: 'critical',
      prop_deice_on: 'critical',
      pitot_heat_on: 'critical',
      ice_light_on: 'optional',
      cabin_heat_on: 'critical',
      cabin_air_defrost: 'critical',
      power_increase: 'standard',
      alt_air_open: 'critical',
      windows_open: 'optional',
    });
  });

  it('has no alternate static row and no step for the WIND SHIELD press (a momentary button)', () => {
    const ids = scenario.procedure.flatMap((node) =>
      node.kind === 'group' ? node.steps.map((step) => step.id) : [],
    );
    expect(ids).not.toContain('alt_static_open');
    const rows = scenario.procedure.flatMap((node) => (node.kind === 'line' ? [node] : []));
    expect(rows.find((row) => row.number === 9)?.text).toBe('* Windshield de-ice');
  });

  it('grades the ICE LIGHT row on the ice-light toggle position, optional', () => {
    const result = run(scenario, [...golden, ...events(['sw.deice_ice_light', 'ice_light'])]);
    expect(credited(result, 'ice_light_on')).toBe(true);
    expect(credited(run(scenario, golden), 'ice_light_on')).toBe(false);
    // The ANNUN TEST position is not ICE LIGHT.
    expect(
      credited(run(scenario, events(['sw.deice_ice_light', 'annun_test'])), 'ice_light_on'),
    ).toBe(false);
  });

  it('fails a run that does nothing and a run that misses any one critical step', () => {
    expect(failed(run(scenario, []))).toBe(true);
    for (const skip of [
      'sw.deice_mode',
      'sw.prop_deice',
      'sw.pitot_stall_heat',
      'lv.env_temp',
      'lv.env_direction',
      'lv.alt_air',
    ]) {
      expect(
        failed(
          run(
            scenario,
            golden.filter((e) => e.id !== skip),
          ),
        ),
        skip,
      ).toBe(true);
    }
  });

  it('takes the cabin heat as TEMPERATURE at 75 or WARM, not at 50', () => {
    const heat = (value: string) =>
      credited(run(scenario, events(['lv.env_temp', value])), 'cabin_heat_on');
    expect(heat('t75')).toBe(true);
    expect(heat('warm')).toBe(true);
    expect(heat('t50')).toBe(false);
  });

  it('passes without the window and with it, and without the power increase', () => {
    const withWindow = [
      ...golden,
      ...events(['sw.emerg_window', 'open'], ['sw.deice_ice_light', 'ice_light']).map((e) => ({
        ...e,
        t: 20 * SECOND_MS,
      })),
    ];
    expect(run(scenario, withWindow).result).toBe('pass');
    expect(
      run(
        scenario,
        golden.filter((e) => e.id !== 'lv.power'),
      ).result,
    ).toBe('pass');
  });

  it('shows ice on both halves within the lint bound at both ends of the onset window', () => {
    for (const onsetAt of [2 * SECOND_MS, 6 * SECOND_MS]) {
      const levels = realisticLevels(scenario, onsetAt, 24 * SECOND_MS);
      expect(cueVisible(levels['ice_pilot_side'] ?? 0), `pilot at ${String(onsetAt)}`).toBe(true);
      expect(cueVisible(levels['ice_copilot_side'] ?? 0), `co-pilot at ${String(onsetAt)}`).toBe(
        true,
      );
      const start = realisticLevels(scenario, onsetAt, 0);
      expect(cueVisible(start['ice_pilot_side'] ?? 0)).toBe(false);
      expect(cueVisible(start['ice_copilot_side'] ?? 0)).toBe(false);
    }
  });

  it('ends the icing area after 3 minutes: the ice stops growing on both sides', () => {
    const at3 = iceAt([], 3 * MINUTE_MS + 2 * SECOND_MS);
    const at10 = iceAt([], 10 * MINUTE_MS);
    // 15 at the start, 0.5 times 40 per minute for 3 minutes.
    expect(at3['pilot']).toBeCloseTo(75, 0);
    expect(at10).toEqual(at3);
  });

  it('melts the ice with the warm air of the golden run after the area has ended', () => {
    // About 57 on the glass when the area ends, 6 per minute of warm air: clear within 10 minutes.
    expect(iceAt(golden, 3 * MINUTE_MS + 2 * SECOND_MS)['pilot']).toBeGreaterThan(40);
    const q = iceAt(golden, 14 * MINUTE_MS);
    expect(q['pilot']).toBe(0);
    expect(q['copilot']).toBe(0);
  });

  it('keeps the pilot side clear after a WIND SHIELD press at 60 s, the co-pilot side keeps its ice', () => {
    const q = iceAt(press(60 * SECOND_MS), 15 * MINUTE_MS);
    expect(q['pilot']).toBe(0);
    expect(q['copilot']).toBeCloseTo(75, 0);
    // The press at 60 s clears the pilot glass directly within about a second.
    expect(iceAt(press(60 * SECOND_MS), 62 * SECOND_MS)['pilot']).toBe(0);
    // Without the press the pilot side stays iced to the end of the same run.
    expect(iceAt([], 15 * MINUTE_MS)['pilot']).toBeCloseTo(75, 0);
  });
});

// Fire / Smoke During Aborted and Continued TKOF: two scenarios (S-06).
describe('Fire / Smoke During Aborted TKOF', () => {
  const scenario = load('scenarios/fire/takeoff-fire-abort.toon');
  const golden = events(
    ['lv.power', 'p0'],
    ['lv.ecs_shutoff', 'pulled'],
    ['lv.toe_brakes', 'applied'],
    ['sw.fuel_valve', 'off'],
    ['sw.engine_master', 'off'],
    ['sw.elect_master', 'off'],
    ['lv.door_release', 'open'],
  );

  /** The first whole second at which a replay of `log` stands still, or null within `limitS` seconds. */
  const stopsAt = (log: readonly RecordedEvent[], limitS = 200): number | null => {
    const setup = simSetup(DA50RG_ENV, scenario);
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    for (let s = 1; s <= limitS; s++) {
      const state = simulate(setup, { events: log, start, untilMs: s * SECOND_MS }).state;
      if (state.quantities['ground_speed_kt'] === 0) return s;
    }
    return null;
  };

  it('rolls at 40 knots with full power, take-off flaps and the gear down', () => {
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    expect(start['ground_speed_kt']).toBeGreaterThan(0);
    expect(scenario.scene).toBe('takeoff_roll');
    expect(scenario.parameters['ground_roll']).toBe(1);
    expect(scenario.initial.controls['lv.power']).toBe('p100');
  });

  it('is graded on the six stopping rows (the fuel valve before the engine master) and the door release lever', () => {
    const result = run(scenario, golden);
    expect(result.result).toBe('pass');
    expect(result.steps.map((s) => s.id).sort()).toEqual(
      [
        'brakes_applied',
        'door_open',
        'ecs_pulled',
        'elect_master_off',
        'engine_master_off',
        'fuel_valve_off',
        'power_idle',
      ].sort(),
    );
  });

  it('fails the same run without the door', () => {
    expect(failed(run(scenario, golden.slice(0, -1)))).toBe(true);
  });

  it('fails a run that does nothing, and a long one ends in the outcome', () => {
    expect(failed(run(scenario, []))).toBe(true);
    expect(run(scenario, [], 300 * SECOND_MS).outcome?.id).toBe('fire_spreads');
  });

  it('stops the aircraft in the golden replay', () => {
    expect(stopsAt(golden)).not.toBeNull();
  });

  it('a run that only brakes at full power stops later than one that idles first, and both stop', () => {
    const brakesOnly = stopsAt(events(['lv.toe_brakes', 'applied']));
    const idleFirst = stopsAt(events(['lv.power', 'p0'], ['lv.toe_brakes', 'applied']));
    expect(brakesOnly).not.toBeNull();
    expect(idleFirst).not.toBeNull();
    expect(brakesOnly ?? 0).toBeGreaterThan(idleFirst ?? 0);
  });

  it('keeps rolling and accelerating at full power without the brakes', () => {
    expect(stopsAt([], 100)).toBeNull();
    expect(stopsAt(events(['lv.power', 'p0']), 60)).toBeNull();
  });

  it('shows the flames within the lint bound after a Realistic onset', () => {
    expect(
      cueVisible(realisticLevels(scenario, 4 * SECOND_MS, 12 * SECOND_MS)['flames'] ?? 0),
    ).toBe(true);
    expect(cueVisible(realisticLevels(scenario, 4 * SECOND_MS, 0)['flames'] ?? 0)).toBe(false);
  });
});

describe('Fire / Smoke During Continued TKOF', () => {
  const scenario = load('scenarios/fire/takeoff-fire-no-abort.toon');
  const core = [
    ['lv.ecs_shutoff', 'pulled'],
    ['sw.engine_master', 'off'],
    ['sw.fuel_valve', 'off'],
    ['sw.elect_master', 'off'],
  ] as const;

  it('holds the speed at 70 knots: no roll model, the runway keeps moving', () => {
    expect(scenario.parameters['ground_roll']).toBeUndefined();
    const setup = simSetup(DA50RG_ENV, scenario);
    const start = initialQuantities(scenario, DA50RG_ENV.quantities);
    const speeds = [10, 60, 200].map(
      (s) =>
        simulate(setup, { events: [], start, untilMs: s * SECOND_MS }).state.quantities[
          'ground_speed_kt'
        ],
    );
    expect(speeds[0]).toBe(start['ground_speed_kt']);
    expect(new Set(speeds).size).toBe(1);
    const speed = speeds[0] ?? 0;
    expect(speed).toBeGreaterThan(60);
    expect(DA50RG_CUES.levels({ ground_speed_kt: speed })['roll_speed']).toBe(1);
  });

  it('passes with the four critical rows, with or without the optional window and doors', () => {
    expect(run(scenario, events(...core)).result).toBe('pass');
    const extras = [...core, ['sw.emerg_window', 'open'], ['lv.door_release', 'open']] as const;
    const result = run(scenario, events(...extras));
    expect(result.result).toBe('pass');
    expect(credited(result, 'windows_open')).toBe(true);
    expect(credited(result, 'doors_open')).toBe(true);
  });

  it('grades the window and the doors as optional steps', () => {
    const optional = scenario.procedure.flatMap((node) =>
      node.kind === 'group' ? node.steps.filter((s) => s.severity === 'optional') : [],
    );
    expect(optional.map((s) => s.id)).toEqual(['windows_open', 'doors_open']);
  });

  it('fails a run that leaves out one critical row', () => {
    expect(failed(run(scenario, events(...core.slice(1))))).toBe(true);
    expect(failed(run(scenario, events(...core.slice(0, 3))))).toBe(true);
    expect(failed(run(scenario, []))).toBe(true);
  });

  it('ends a long do-nothing run in the outcome fire_spreads', () => {
    expect(run(scenario, [], 300 * SECOND_MS).outcome?.id).toBe('fire_spreads');
  });

  it('shows the flames within the lint bound after a Realistic onset', () => {
    expect(
      cueVisible(realisticLevels(scenario, 4 * SECOND_MS, 12 * SECOND_MS)['flames'] ?? 0),
    ).toBe(true);
    expect(cueVisible(realisticLevels(scenario, 4 * SECOND_MS, 0)['flames'] ?? 0)).toBe(false);
  });
});

// The PFD airspeed quantity (owner addition of 2026-10-27): it follows the ground speed while the
// aircraft moves on the ground, and holds the static 140 knots elsewhere. The readout and the tape
// that draw it are tested in tests/avionics.test.ts.
describe('the PFD airspeed quantity', () => {
  const speeds = (
    scenario: Scenario,
    log: readonly RecordedEvent[],
    atS: number,
  ): { airspeed: number; ground: number } => {
    const state = simulate(simSetup(DA50RG_ENV, scenario), {
      events: log,
      start: initialQuantities(scenario, DA50RG_ENV.quantities),
      untilMs: atS * SECOND_MS,
    }).state;
    return {
      airspeed: state.quantities['airspeed_kt'] ?? Number.NaN,
      ground: state.quantities['ground_speed_kt'] ?? Number.NaN,
    };
  };
  const abort = load('scenarios/fire/takeoff-fire-abort.toon');
  const noAbort = load('scenarios/fire/takeoff-fire-no-abort.toon');
  const base = DA50RG_ENV.quantities.baseValues()['airspeed_kt'];

  it('rises with the POWER on the roll and falls with the brakes on', () => {
    // Full power from 40 knots accelerates; the brakes at 20 s slow the aircraft down.
    const rolling = speeds(abort, [], 20);
    // The reading follows within one step (at most 4.3 knots per second of braking over 0.1 s).
    expect(Math.abs(rolling.airspeed - rolling.ground)).toBeLessThan(0.5);
    expect(rolling.airspeed).toBeGreaterThan(
      initialQuantities(abort, DA50RG_ENV.quantities)['airspeed_kt'] ?? 0,
    );
    const braked = speeds(
      abort,
      [{ t: 20 * SECOND_MS, id: 'lv.toe_brakes', value: 'applied' }],
      30,
    );
    expect(Math.abs(braked.airspeed - braked.ground)).toBeLessThan(0.5);
    expect(braked.airspeed).toBeLessThan(rolling.airspeed);
  });

  it('reads 0 when the roll has ended at a standstill, not the static value', () => {
    const log = events(['lv.power', 'p0'], ['lv.toe_brakes', 'applied']);
    const stopped = speeds(abort, log, 120);
    expect(stopped.ground).toBe(0);
    expect(stopped.airspeed).toBe(0);
  });

  it('follows the held speed of the airborne take-off', () => {
    const held = speeds(noAbort, [], 60);
    expect(held.ground).toBe(70);
    expect(held.airspeed).toBe(70);
  });

  it('holds the static 140 knots in flight', () => {
    expect(base).toBe(140);
    const scenario = load('scenarios/engine/eng-fire-in-flight.toon');
    expect(speeds(scenario, [], 30).airspeed).toBe(140);
  });

  it('reads 0 knots while the aircraft stands on the apron, at every level and at every power', () => {
    for (const file of [
      'scenarios/fire/eng-fire-ground.toon',
      'scenarios/fire/elec-fire-ground.toon',
    ]) {
      const scenario = load(file);
      const start = initialQuantities(scenario, DA50RG_ENV.quantities);
      expect(start['airspeed_kt'], file).toBe(0);
      expect(realisticQuantities(scenario, DA50RG_ENV.quantities)['airspeed_kt'], file).toBe(0);
      // Doing nothing, with the power at 25 percent (elec) or at idle (eng), the speed stays 0.
      for (const at of [0, 1, 30, 120]) {
        const s = speeds(scenario, [], at);
        expect(s.airspeed, `${file} airspeed at ${at}`).toBe(0);
        expect(s.ground, `${file} ground at ${at}`).toBe(0);
      }
    }
  });
});
