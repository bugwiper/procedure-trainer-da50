import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { TERRAIN_HEIGHT_FT } from '../src/aircraft/da50rg/quantities';
import { initialQuantities } from '../src/engine/predicates';
import { STEP_MS, simSetup, simulate } from '../src/engine/sim';
import { checkScenario } from '../src/scenario/lint';
import type { Scenario } from '../src/scenario/schema';

// The approach to an off-airport field (Phase 9, plan 09-01): the fixture situation descends in the
// powered regime, the cue field_near rises with the fall of the altitude and holds at 1 at the
// terrain. Everything goes through simulate; there is no UI here. The fixture is a synthetic file
// under tests/fixtures (P-03), never a shipped scenario.

const root = fileURLToPath(new URL('../', import.meta.url));
const FIXTURE = `${root}tests/fixtures/scenarios/landing-fixture.toon`;
const checked = checkScenario(readFileSync(FIXTURE, 'utf8'), DA50RG_ENV);
if (!checked.ok) {
  throw new Error(`the landing fixture does not pass: ${JSON.stringify(checked.issues)}`);
}
/** The checked fixture, the one scenario these cases run on. */
const landing: Scenario = checked.scenario;

const SECOND_MS = 1000;

/** A do-nothing run of the fixture until `untilMs`. */
function runTo(untilMs: number) {
  const setup = simSetup(DA50RG_ENV, landing);
  return simulate(setup, {
    events: [],
    start: initialQuantities(landing, DA50RG_ENV.quantities),
    untilMs,
  }).state;
}

const altitudeOf = (state: ReturnType<typeof runTo>): number => {
  const value = state.quantities['altitude_ft'];
  if (value === undefined) throw new Error('no altitude');
  return value;
};

const fieldLevel = (state: ReturnType<typeof runTo>): number =>
  DA50RG_ENV.cues.levels(state.quantities)['field_near'] ?? Number.NaN;

describe('the landing fixture', () => {
  it('passes the lint and names the approach scene', () => {
    expect(landing.scene).toBe('outlanding');
    expect(DA50RG_ENV.scenes.ids).toContain('outlanding');
  });

  it('starts above the terrain with the field partly grown', () => {
    const start = initialQuantities(landing, DA50RG_ENV.quantities);
    expect(start['altitude_ft']).toBeGreaterThan(TERRAIN_HEIGHT_FT);
    const level = DA50RG_ENV.cues.levels(start)['field_near'] ?? Number.NaN;
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(1);
  });

  it('descends at about 700 feet per minute in a do-nothing run', () => {
    const start = altitudeOf(runTo(0));
    const after = altitudeOf(runTo(30 * SECOND_MS));
    // 30 s at 700 fpm: 350 ft; the vertical speed settles within a few seconds.
    expect(start - after).toBeGreaterThan(320);
    expect(start - after).toBeLessThan(360);
    const later = altitudeOf(runTo(60 * SECOND_MS));
    expect(after - later).toBeGreaterThan(335);
    expect(after - later).toBeLessThan(355);
  });

  it('raises the cue field_near step by step while it descends', () => {
    let previous = -1;
    let rises = 0;
    for (let seconds = 0; seconds <= 60; seconds += 5) {
      const level = fieldLevel(runTo(seconds * SECOND_MS));
      expect(level, `${String(seconds)} s`).toBeGreaterThanOrEqual(previous);
      if (level > previous) rises += 1;
      previous = level;
    }
    expect(rises).toBeGreaterThan(10);
  });

  it('agrees to the last digit between two runs', () => {
    const a = runTo(90 * SECOND_MS);
    const b = runTo(90 * SECOND_MS);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.t).toBe(90 * SECOND_MS);
    expect(STEP_MS).toBeGreaterThan(0);
  });

  it('holds the altitude at the terrain once the descent has reached it, with the level exactly 1', () => {
    // 800 ft to go at 700 fpm: about 69 s. Two minutes is well past it.
    for (const seconds of [90, 120, 300]) {
      const state = runTo(seconds * SECOND_MS);
      expect(altitudeOf(state), String(seconds)).toBe(TERRAIN_HEIGHT_FT);
      expect(fieldLevel(state), String(seconds)).toBe(1);
    }
  });
});
