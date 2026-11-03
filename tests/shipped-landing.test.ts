import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { initialQuantities, travelPercent } from '../src/engine/predicates';
import { simSetup, simulate } from '../src/engine/sim';
import type { Registry } from '../src/engine/registry';
import { checkScenario } from '../src/scenario/lint';
import { parseManifest } from '../src/scenario/parse';
import type { Predicate, ProcedureNode, Scenario, Step } from '../src/scenario/schema';
import { solutionDecisions } from './further-support';

// The shipped landing situations (Phase 9, plan 09-03). Every shipped scenario on a landing scene
// is found from the pack manifests (no name is listed here) and checked as a group: the lint is
// clean, the aircraft's own terrain is kept, the situation ends at the field, no flight conduct is
// offered, a pilot who performs the file's own panel steps passes, a pilot who omits a critical one
// or does nothing fails, every panel row names a control of the registry, and every follow-on
// target of any shipped scenario exists and is a landing situation. The printed wording is checked
// in tests/checklist-text.test.ts.
const root = fileURLToPath(new URL('../', import.meta.url));
const SECOND_MS = 1000;

interface Shipped {
  readonly pack: string;
  readonly id: string;
  readonly path: string;
}

const SHIPPED: readonly Shipped[] = readdirSync(join(root, 'scenarios'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((folder) => {
    const manifest = parseManifest(
      readFileSync(join(root, 'scenarios', folder.name, 'pack.toon'), 'utf8'),
    );
    if (!manifest.ok) throw new Error(`the manifest of "${folder.name}" does not parse`);
    return manifest.value.scenarios.map((entry) => ({
      pack: folder.name,
      id: entry.id,
      path: join(root, 'scenarios', folder.name, `${entry.file}.toon`),
    }));
  });

function load(path: string): Scenario {
  const checked = checkScenario(readFileSync(path, 'utf8'), DA50RG_ENV);
  if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
  return checked.scenario;
}

const ALL = SHIPPED.map((entry) => ({ ...entry, scenario: load(entry.path) }));
const LANDINGS = ALL.filter(
  ({ scenario }) =>
    scenario.scene !== undefined && DA50RG_ENV.further.landingScenes.includes(scenario.scene),
);

/** Every graded step of the procedure, in reading order. */
function stepsOf(nodes: readonly ProcedureNode[]): Step[] {
  return nodes.flatMap((node): Step[] => {
    switch (node.kind) {
      case 'group':
        return [...node.steps];
      case 'branch':
        return stepsOf(node.nodes);
      case 'decision':
        return node.branches.flatMap((branch) => stepsOf(branch.nodes));
      default:
        return [];
    }
  });
}

/** The panel events that make `predicate` true (one control, the first fitting state). */
function eventFor(predicate: Predicate): { id: string; value: string } {
  const registry: Registry = DA50RG_ENV.registry;
  switch (predicate.check) {
    case 'state':
      return { id: predicate.control, value: predicate.is };
    case 'state_in': {
      const value = predicate.in[0];
      if (value === undefined) throw new Error('empty state_in');
      return { id: predicate.control, value };
    }
    case 'travel': {
      const def = registry.get(predicate.control);
      if (def === undefined || def.kind !== 'detent-lever') {
        throw new Error(`"${predicate.control}" is not a lever`);
      }
      const fits = def.detents.find((d) => {
        const travel = travelPercent(def, d.id);
        return predicate.op === 'lte' || predicate.op === 'lt'
          ? travel <= predicate.value
          : travel >= predicate.value;
      });
      if (fits === undefined) throw new Error(`no detent of "${predicate.control}" fits`);
      return { id: predicate.control, value: fits.id };
    }
    default:
      throw new Error(
        `a step of a landing situation reads the panel only, not "${predicate.check}"`,
      );
  }
}

/** The time the do-nothing run reaches the finish at, or null when it does not within the cap. */
function finishAt(scenario: Scenario): number | null {
  const result = simulate(simSetup(DA50RG_ENV, scenario), {
    events: [],
    start: initialQuantities(scenario, DA50RG_ENV.quantities),
    untilMs: Number.MAX_SAFE_INTEGER,
  });
  return result.state.finish?.t ?? null;
}

function recordingOf(scenario: Scenario, steps: readonly Step[], completedAt: number): Recording {
  return {
    scenarioId: scenario.id,
    completedAt,
    events: steps.map((step, i) => ({ t: (i + 2) * SECOND_MS, ...eventFor(step.done) })),
    decisions: solutionDecisions(scenario),
  };
}

describe('the shipped landing situations (Phase 9)', () => {
  it('there is at least one, found from the pack manifests', () => {
    expect(LANDINGS.length).toBeGreaterThan(0);
  });

  it.each(LANDINGS)(
    '$id keeps the aircraft terrain and sets no parameter of it',
    ({ scenario }) => {
      expect(Object.keys(scenario.profile)).not.toContain('terrain_ft');
      expect(Object.keys(scenario.parameters)).not.toContain('terrain_ft');
      expect(Object.keys(scenario.initial.quantities)).not.toContain('terrain_ft');
    },
  );

  it.each(LANDINGS)('$id declares a finish and no flight conduct', ({ scenario }) => {
    expect(scenario.finish, 'finish').toBeDefined();
    expect(scenario.further?.conduct).toBe('none');
  });

  it.each(LANDINGS)(
    '$id reaches its finish in a do-nothing run within the bound',
    ({ scenario }) => {
      const at = finishAt(scenario);
      expect(at, 'the finish is reached').not.toBeNull();
      // Long enough for the pilot to prepare, short enough that nothing hangs (lint L32 allows 600 s).
      expect(at ?? 0).toBeGreaterThanOrEqual(60 * SECOND_MS);
      expect(at ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(600 * SECOND_MS);
    },
  );

  it.each(LANDINGS)('$id: every panel row names a control of the registry', ({ scenario }) => {
    const steps = stepsOf(scenario.procedure);
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      const { id } = eventFor(step.done);
      expect(DA50RG_ENV.registry.get(id), `${scenario.id}: ${step.id}`).toBeDefined();
    }
  });

  it.each(LANDINGS)(
    '$id: a pilot who performs its panel steps passes at the finish',
    ({ scenario }) => {
      const at = finishAt(scenario) ?? 0;
      const result = grade(
        scenario,
        DA50RG_ENV,
        recordingOf(scenario, stepsOf(scenario.procedure), at),
      );
      expect(result.reasons).toEqual([]);
      expect(result.result).toBe('pass');
      expect(result.outcome).toBeNull();
    },
  );

  it.each(LANDINGS)(
    '$id: omitting any critical step fails with that step missing',
    ({ scenario }) => {
      const at = finishAt(scenario) ?? 0;
      const all = stepsOf(scenario.procedure);
      const critical = all.filter((step) => step.severity === 'critical');
      expect(critical.length).toBeGreaterThan(0);
      for (const omitted of critical) {
        const result = grade(
          scenario,
          DA50RG_ENV,
          recordingOf(
            scenario,
            all.filter((step) => step.id !== omitted.id),
            at,
          ),
        );
        expect(result.result, omitted.id).toBe('fail');
        expect(result.reasons.map((r) => r.kind)).toContain('critical_missed');
      }
    },
  );

  it.each(LANDINGS)(
    '$id: a pilot who does nothing fails with the critical steps missed',
    ({ scenario }) => {
      const at = finishAt(scenario) ?? 0;
      const result = grade(scenario, DA50RG_ENV, recordingOf(scenario, [], at));
      expect(result.result).toBe('fail');
      const critical = stepsOf(scenario.procedure).filter((step) => step.severity === 'critical');
      expect(result.reasons).toContainEqual({ kind: 'critical_missed', count: critical.length });
    },
  );

  it('every follow-on target of every shipped scenario exists and is a landing situation', () => {
    const declared = ALL.flatMap(({ id, scenario }) =>
      Object.entries(scenario.further?.follow_on ?? {}).flatMap(([conduct, list]) =>
        list.map((target) => ({ id, conduct, target })),
      ),
    );
    expect(declared.length, 'at least one shipped scenario leads into a landing').toBeGreaterThan(
      0,
    );
    for (const { id, conduct, target } of declared) {
      const found = ALL.find((entry) => entry.pack === target.pack && entry.id === target.scenario);
      expect(found, `${id} (${conduct}) leads to ${target.pack}/${target.scenario}`).toBeDefined();
      expect(
        LANDINGS.map((l) => l.id),
        `${id} leads into a landing situation`,
      ).toContain(target.scenario);
    }
  });
});
