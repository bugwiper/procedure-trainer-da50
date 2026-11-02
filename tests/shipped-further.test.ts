import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { grade } from '../src/engine/grading';
import { checkScenario } from '../src/scenario/lint';
import { parseManifest } from '../src/scenario/parse';
import { solutionDecisions } from './further-support';

// The declarations of every shipped scenario (Phase 7, plan 07-02, D-13). The table below is typed
// by hand and independent of the scenario files: a role or an accepted conduct that is changed in a
// file needs a change here too. The list of shipped scenarios comes from the pack manifests, so a new
// scenario without a declaration (or without a row) fails this test.
const root = fileURLToPath(new URL('../', import.meta.url));

type Role = 'required' | 'recommended' | 'optional' | 'harmful';
interface Declared {
  /** The roles of atc_mayday, atc_pan_pan and brief_passengers, in that order. */
  readonly roles: readonly [Role, Role, Role];
  /** The accepted conduct ids, or 'none'. */
  readonly conduct: readonly string[] | 'none';
  /** True when the scenario carries a `conduct_note` (plan 07-06, R-22). */
  readonly note: boolean;
}

// The review of plan 07-06 (R-20), row by row against the printed comment rows and branches: ENG OIL TEMP
// and ICING CONDITIONS print a landing at the nearest suitable airfield (precautionary only); the two
// ALTN cautions print "Terminate NVFR/IFR-flight and land at nearest suitable airfield", so VFR flight
// to the destination is right as well, and each carries the note that says when it is not.
const ADVISORY: Declared = {
  roles: ['optional', 'optional', 'optional'],
  conduct: ['conduct_precautionary'],
  note: false,
};
const ALTERNATOR_CAUTION: Declared = {
  roles: ['optional', 'optional', 'optional'],
  conduct: ['conduct_destination', 'conduct_precautionary'],
  note: true,
};
const FIRE_IN_FLIGHT: Declared = {
  roles: ['required', 'optional', 'recommended'],
  conduct: ['conduct_emergency'],
  note: false,
};
const ON_THE_GROUND: Declared = {
  roles: ['recommended', 'optional', 'optional'],
  conduct: 'none',
  note: false,
};

const TABLE: Readonly<Record<string, Declared>> = {
  'eng-oil-temp-green': ADVISORY,
  'elec-altn1-fail': ALTERNATOR_CAUTION,
  'elec-altn2-fail': ALTERNATOR_CAUTION,
  'icing-unintentional': ADVISORY,
  'eng-fire-in-flight': FIRE_IN_FLIGHT,
  'elec-fire-flight': FIRE_IN_FLIGHT,
  'takeoff-fire-no-abort': FIRE_IN_FLIGHT,
  'eng-fire-ground': ON_THE_GROUND,
  'elec-fire-ground': ON_THE_GROUND,
  'takeoff-fire-abort': ON_THE_GROUND,
};

const ACTION_IDS = ['atc_mayday', 'atc_pan_pan', 'brief_passengers'] as const;

/** Every shipped scenario file, found through the pack manifests: pack folder and file name. */
const SHIPPED = readdirSync(join(root, 'scenarios'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((folder) => {
    const manifest = parseManifest(
      readFileSync(join(root, 'scenarios', folder.name, 'pack.toon'), 'utf8'),
    );
    if (!manifest.ok) throw new Error(`the manifest of "${folder.name}" does not parse`);
    return manifest.value.scenarios.map((entry) => ({
      id: entry.id,
      path: join(root, 'scenarios', folder.name, `${entry.file}.toon`),
    }));
  });

describe('the further declarations of the shipped scenarios (D-10, D-13)', () => {
  it('the table has a row for every shipped scenario and no other', () => {
    expect(SHIPPED.map((s) => s.id).sort()).toEqual(Object.keys(TABLE).sort());
  });

  it.each(SHIPPED)(
    '$id declares the section of the table and passes the scenario check',
    ({ id, path }) => {
      const checked = checkScenario(readFileSync(path, 'utf8'), DA50RG_ENV);
      if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
      const expected = TABLE[id];
      if (expected === undefined) throw new Error(`no row for "${id}"`);
      const section = checked.scenario.further;
      expect(section, 'the file declares a further section').toBeDefined();
      expect(section?.actions.map((a) => [a.id, a.role, a.fails_run])).toEqual(
        ACTION_IDS.map((action, i) => [action, expected.roles[i], false]),
      );
      expect(section?.conduct === 'none' ? 'none' : section?.conduct.accept).toEqual(
        expected.conduct,
      );
      expect(section?.conduct_note !== undefined, 'conduct_note').toBe(expected.note);
      // L31: a note only where the conduct it speaks of is accepted.
      if (expected.note) expect(expected.conduct).toContain(DA50RG_ENV.further.noteConduct);
    },
  );

  it.each(SHIPPED)(
    '$id: the ground scenarios are exactly the ones that declare none',
    ({ id, path }) => {
      const checked = checkScenario(readFileSync(path, 'utf8'), DA50RG_ENV);
      if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
      const onGround = (checked.scenario.profile[DA50RG_ENV.further.groundParameter] ?? 0) > 0;
      expect(TABLE[id]?.conduct === 'none', id).toBe(onGround);
    },
  );

  it.each(SHIPPED)(
    '$id: a run that only makes the decisions of its solution still fails on the panel',
    ({ path }) => {
      const checked = checkScenario(readFileSync(path, 'utf8'), DA50RG_ENV);
      if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
      const scenario = checked.scenario;
      const result = grade(scenario, DA50RG_ENV, {
        scenarioId: scenario.id,
        completedAt: 20_000,
        events: [],
        decisions: solutionDecisions(scenario),
      });
      expect(result.result).toBe('fail');
      // The decisions are right, so only panel steps are missing.
      expect(result.reasons.map((r) => r.kind)).not.toContain('conduct');
      expect(result.reasons.map((r) => r.kind)).not.toContain('further_missed');
    },
  );
});
