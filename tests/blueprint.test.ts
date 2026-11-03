import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
import { checkScenario } from '../src/scenario/lint';

// The blueprint principle (02-CONTEXT): scenario facts live in the scenario file and the aircraft
// data, never in application code. The forbidden literals are derived from the parsed blueprint
// and the CAS rule table, so the gate follows the data. src/aircraft and scenarios/ are the
// allowed homes; src/engine, src/scenario and src/ui must stay free of them (T-02-26).

const root = fileURLToPath(new URL('../', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Every shipped scenario file: all .toon files under scenarios/ except the pack manifests. */
const SCENARIO_FILES = walk(join(root, 'scenarios')).filter(
  (path) => path.endsWith('.toon') && basename(path) !== 'pack.toon',
);

const scenarios = SCENARIO_FILES.map((path) => {
  const checked = checkScenario(readFileSync(path, 'utf8'), DA50RG_ENV);
  if (!checked.ok) {
    throw new Error(`${relative(root, path)} does not pass the scenario check`);
  }
  return checked.scenario;
});

/** Every string stored under a key called `key`, anywhere in a decoded value. */
function valuesOfKey(value: unknown, key: string): unknown[] {
  if (Array.isArray(value)) return (value as unknown[]).flatMap((v) => valuesOfKey(v, key));
  if (typeof value !== 'object' || value === null) return [];
  const entries: [string, unknown][] = Object.entries(value);
  return entries.flatMap(([k, v]) =>
    k === key ? [v, ...valuesOfKey(v, key)] : valuesOfKey(v, key),
  );
}

const strings = (values: readonly unknown[]): string[] =>
  values.filter((v): v is string => typeof v === 'string');

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

/** The CAS ids every shipped scenario lists, at the start and later. */
const CAS_IDS = unique(scenarios.flatMap((s) => [...s.annunciations, ...s.late_annunciations]));

/**
 * The scenario ids that are scene ids of the aircraft too (Phase 9, plan 09-04: the ditching scenario
 * is on the ditching scene, owner decisions R-01 and R-03). A scene id is aircraft data and the UI
 * names it as it names every scene, so such an id is not a scenario fact; every other id stays
 * forbidden. A test below pins the list so the exemption cannot grow unnoticed.
 */
const SCENE_NAMED_SCENARIO_IDS = scenarios
  .map((s) => s.id)
  .filter((id) => DA50RG_ENV.scenes.has(id));

/** Scenario, step, group, forbidden and outcome ids; the control and parameter ids; CAS ids and texts. */
const SCENARIO_LITERALS: Readonly<Record<string, readonly string[]>> = {
  'scenario id': scenarios.map((s) => s.id).filter((id) => !SCENE_NAMED_SCENARIO_IDS.includes(id)),
  'step and group ids': unique(scenarios.flatMap((s) => strings(valuesOfKey(s.procedure, 'id')))),
  'forbidden ids': unique(scenarios.flatMap((s) => s.forbidden.map((f) => f.id))),
  'outcome ids': unique(scenarios.flatMap((s) => s.outcomes.map((o) => o.id))),
  'control ids of the steps, triggers and outcomes': unique(
    scenarios.flatMap((s) =>
      strings([
        ...valuesOfKey(s.procedure, 'control'),
        ...valuesOfKey(s.forbidden, 'control'),
        ...valuesOfKey(s.outcomes, 'control'),
      ]),
    ),
  ),
  'parameter id': unique(
    scenarios.flatMap((s) => [
      ...Object.keys(s.parameters),
      ...Object.keys(s.profile),
      ...Object.keys(s.onset?.parameters ?? {}),
    ]),
  ),
  // Phase 7: the further actions are aircraft data; the option ids and the note live in src/aircraft only.
  'further option id': DA50RG_ENV.further.options.map((option) => option.id),
  // Plan 07-05: the static labels of the six footwell buttons are aircraft data too.
  'further button label': DA50RG_ENV.further.options.flatMap((option) =>
    option.label === undefined ? [] : [option.label],
  ),
  'further debrief note': DA50RG_ENV.further.options.flatMap((option) =>
    option.debriefNote === undefined ? [] : [option.debriefNote],
  ),
  // Plan 09-02: the label and the title of the debrief's follow-on button are aircraft data too.
  'further follow-on label': DA50RG_ENV.further.options.flatMap((option) =>
    option.followOn === undefined ? [] : [option.followOn.label],
  ),
  'further follow-on title': DA50RG_ENV.further.options.flatMap((option) =>
    option.followOn === undefined ? [] : [option.followOn.title],
  ),
  // Plan 09-04 (R-08): the label and the title of each follow-on target are aircraft data too.
  'further follow-on target label': DA50RG_ENV.further.options.flatMap((option) =>
    (option.followOn?.targets ?? []).map((target) => target.label),
  ),
  'further follow-on target title': DA50RG_ENV.further.options.flatMap((option) =>
    (option.followOn?.targets ?? []).map((target) => target.title),
  ),
  // Plan 07-06: the checklist catalog (printed headings, tab labels and tags) is aircraft data too.
  'catalog heading': DA50RG_ENV.catalog.groups.map((group) => group.heading),
  'catalog tab label': DA50RG_ENV.catalog.groups.map((group) => group.tab),
  'catalog tag': unique(DA50RG_ENV.catalog.groups.flatMap((g) => g.entries.map((e) => e.tag))),
  'CAS id': CAS_IDS,
  'CAS message': CAS_IDS.flatMap((id) => {
    const text = DA50RG_CAS.get(id)?.text;
    return text === undefined ? [] : [text];
  }),
};

/**
 * The numbers of the CAS rules of the listed annunciations and of the outcome predicates. Hold
 * times and onset windows are not thresholds: they are small integers that also occur in
 * unrelated code.
 */
const THRESHOLDS = unique([
  ...CAS_IDS.flatMap((id) => {
    const rule = DA50RG_CAS.get(id);
    return rule === undefined ? [] : valuesOfKey(rule.when, 'value');
  }),
  ...scenarios.flatMap((s) => valuesOfKey(s.outcomes, 'value')),
]).filter((v): v is number => typeof v === 'number');

const files = (dir: string): string[] =>
  walk(join(root, dir)).filter((path) => /\.(ts|tsx|css)$/.test(path));

const APPLICATION = ['src/engine', 'src/scenario', 'src/ui'].flatMap(files);
const NO_THRESHOLDS = ['src/engine', 'src/scenario'].flatMap(files);

describe('the blueprint principle', () => {
  it('derives the literals from every shipped scenario file', () => {
    // The gate sees every file the walk finds, and there is more than one scenario to see.
    expect(scenarios.length).toBe(SCENARIO_FILES.length);
    expect(SCENARIO_FILES.length).toBeGreaterThan(1);
    expect((SCENARIO_LITERALS['scenario id']?.length ?? 0) + SCENE_NAMED_SCENARIO_IDS.length).toBe(
      SCENARIO_FILES.length,
    );
    // Only the ditching shares its id with a scene; any other id that does is a new decision.
    expect(SCENE_NAMED_SCENARIO_IDS).toEqual(['ditching']);
  });

  it('derives a non-empty literal list from the data', () => {
    for (const [name, list] of Object.entries(SCENARIO_LITERALS)) {
      expect(list.length, name).toBeGreaterThan(0);
    }
    expect(THRESHOLDS.length).toBeGreaterThan(0);
    expect(APPLICATION.length).toBeGreaterThan(20);
  });

  it('the follow-on target labels of the aircraft are among the forbidden literals (plan 09-04, R-08)', () => {
    const labels = SCENARIO_LITERALS['further follow-on target label'] ?? [];
    expect(labels).toEqual(expect.arrayContaining(['Emergency landing', 'Ditching']));
    const titles = SCENARIO_LITERALS['further follow-on target title'] ?? [];
    expect(titles.length).toBe(labels.length);
  });

  it('the parameter ids include the keys of every onset block of the shipped scenarios (plan 03-11)', () => {
    // No shipped scenario sets an onset parameter since the oil temperature rate curve (the loop is
    // empty then); a scenario that does must find its keys in the derived list.
    const onsetKeys = unique(scenarios.flatMap((s) => Object.keys(s.onset?.parameters ?? {})));
    for (const key of onsetKeys) expect(SCENARIO_LITERALS['parameter id']).toContain(key);
  });

  it('the parameter ids include the keys of every profile block of the shipped scenarios (plan 06-03)', () => {
    const profileKeys = unique(scenarios.flatMap((s) => Object.keys(s.profile)));
    expect(profileKeys.length).toBeGreaterThan(0);
    for (const key of profileKeys) expect(SCENARIO_LITERALS['parameter id']).toContain(key);
  });

  it.each(Object.entries(SCENARIO_LITERALS))(
    'no file of src/engine, src/scenario or src/ui contains a %s',
    (_name, literals) => {
      const hits: string[] = [];
      for (const path of APPLICATION) {
        const text = readFileSync(path, 'utf8');
        for (const literal of literals) {
          if (text.includes(literal)) hits.push(`${relative(root, path)}: ${literal}`);
        }
      }
      expect(hits).toEqual([]);
    },
  );

  it('no file of src/engine or src/scenario contains a threshold of the CAS rule as a number', () => {
    const hits: string[] = [];
    for (const path of NO_THRESHOLDS) {
      const text = readFileSync(path, 'utf8');
      for (const threshold of THRESHOLDS) {
        if (new RegExp(`(?<![\\w.])${String(threshold)}(?![\\w.]*\\w)`).test(text)) {
          hits.push(`${relative(root, path)}: ${String(threshold)}`);
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
