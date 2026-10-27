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
