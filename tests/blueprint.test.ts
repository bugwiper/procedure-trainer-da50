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

/** The CAS ids every shipped scenario lists. */
const CAS_IDS = unique(scenarios.flatMap((s) => s.annunciations));

/** Scenario, step, group, forbidden and outcome ids; the control and parameter ids; CAS ids and texts. */
const SCENARIO_LITERALS: Readonly<Record<string, readonly string[]>> = {
  'scenario id': scenarios.map((s) => s.id),
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
  'parameter id': unique(scenarios.flatMap((s) => Object.keys(s.parameters))),
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
    expect(SCENARIO_LITERALS['scenario id']?.length).toBe(SCENARIO_FILES.length);
  });

  it('derives a non-empty literal list from the data', () => {
    for (const [name, list] of Object.entries(SCENARIO_LITERALS)) {
      expect(list.length, name).toBeGreaterThan(0);
    }
    expect(THRESHOLDS.length).toBeGreaterThan(0);
    expect(APPLICATION.length).toBeGreaterThan(20);
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
