import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { TERRAIN_HEIGHT_FT, WATER_LEVEL_FT } from '../src/aircraft/da50rg/quantities';
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

  // The terrain each landing scene keeps, typed by hand and independent of the aircraft constants:
  // the field of the approach scene stands at the aircraft's normal terrain (1400 ft), the sea of the
  // ditching scene at sea level (0 ft). A scenario on a scene sets its terrain in the profile only.
  const TERRAIN_OF_SCENE: Readonly<Record<string, number>> = { outlanding: 1400, ditching: 0 };

  it('the table names every landing scene of the aircraft and no other', () => {
    expect(Object.keys(TERRAIN_OF_SCENE).sort()).toEqual(
      [...DA50RG_ENV.further.landingScenes].sort(),
    );
    expect(TERRAIN_OF_SCENE['outlanding']).toBe(TERRAIN_HEIGHT_FT);
    expect(TERRAIN_OF_SCENE['ditching']).toBe(WATER_LEVEL_FT);
  });

  it.each(LANDINGS)('$id keeps the terrain of its scene', ({ scenario }) => {
    const expected = TERRAIN_OF_SCENE[scenario.scene ?? ''];
    expect(expected, `a terrain is typed for "${scenario.scene ?? ''}"`).toBeDefined();
    // The terrain is set in the profile only (a parameter or a start quantity of it is never used).
    expect(Object.keys(scenario.parameters)).not.toContain('terrain_ft');
    expect(Object.keys(scenario.initial.quantities)).not.toContain('terrain_ft');
    expect(scenario.profile['terrain_ft'] ?? TERRAIN_HEIGHT_FT).toBe(expected);
    // The finish is the height of that terrain.
    const finish = scenario.finish?.when;
    expect(finish?.check === 'quantity' ? finish.value : Number.NaN).toBe(expected);
  });

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

  const DEAD_ENGINE = [
    'rpm',
    'load_pct',
    'oil_pressure_bar',
    'fuel_flow_gph',
    'fuel_pressure_bar',
  ] as const;

  it.each(LANDINGS)(
    '$id: engine_stopped 1 starts with the dead-engine values, and a file without the parameter does not set them',
    ({ scenario }) => {
      const stopped = (scenario.profile['engine_stopped'] ?? 0) > 0;
      const start = initialQuantities(scenario, DA50RG_ENV.quantities);
      const base = DA50RG_ENV.quantities.baseValues();
      for (const id of DEAD_ENGINE) {
        if (stopped) expect(start[id], `${scenario.id}: ${id}`).toBe(0);
        else expect(scenario.initial.quantities[id], `${scenario.id}: ${id}`).toBeUndefined();
      }
      // The free panel base is a running engine, so a dead one is always the file's own doing.
      expect(DEAD_ENGINE.some((id) => (base[id] ?? 0) > 0)).toBe(true);
    },
  );

  it('the ditching starts engine-out over the sea at the printed Vref: values, the waves on the way and the time to the water', () => {
    const ditching = ALL.find(({ id }) => id === 'ditching');
    if (ditching === undefined) throw new Error('the ditching is not shipped');
    const { scenario } = ditching;
    expect(scenario.scene).toBe('ditching');
    expect(scenario.profile['engine_stopped']).toBe(1);
    // Typed by hand from the printed page and the instructor-review values of PANEL-REVIEW.
    expect(scenario.profile['glide_speed_kt']).toBe(77);
    expect(scenario.profile['glide_vs_fpm']).toBe(-300);
    expect(scenario.initial.quantities['altitude_ft']).toBe(450);
    expect(scenario.initial.controls['lv.gear']).toBe('down');
    // The waves already show at the start.
    const level = DA50RG_ENV.cues.levels(initialQuantities(scenario, DA50RG_ENV.quantities))[
      'water_near'
    ];
    expect(level ?? 0).toBeGreaterThan(0.2);
    // A do-nothing run reaches the water in about a minute and a half, never later than 150 s.
    const at = finishAt(scenario);
    expect(at ?? 0).toBeGreaterThanOrEqual(85 * SECOND_MS);
    expect(at ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(150 * SECOND_MS);
  });

  it('the ditching grades the gear (critical) and the flaps (standard) and nothing else on the panel', () => {
    const ditching = ALL.find(({ id }) => id === 'ditching');
    if (ditching === undefined) throw new Error('the ditching is not shipped');
    const steps = stepsOf(ditching.scenario.procedure);
    expect(steps.map((step) => [step.id, step.severity])).toEqual([
      ['gear_up', 'critical'],
      ['flaps_ldg', 'standard'],
    ]);
    expect(steps.map((step) => eventFor(step.done))).toEqual([
      { id: 'lv.gear', value: 'up' },
      { id: 'lv.flaps', value: 'ldg' },
    ]);
  });

  it('every follow-on target of every shipped scenario has a label and a title in the aircraft table, and each list has a positive weight total (R-08)', () => {
    const lists = ALL.flatMap(({ id, scenario }) =>
      Object.entries(scenario.further?.follow_on ?? {}).map(([conduct, list]) => ({
        id,
        conduct,
        list,
      })),
    );
    expect(lists.length).toBeGreaterThan(0);
    for (const { id, conduct, list } of lists) {
      expect(
        list.reduce((total, target) => total + target.weight, 0),
        `${id}: the weights of ${conduct}`,
      ).toBeGreaterThan(0);
      for (const target of list) {
        const text = DA50RG_ENV.further.followOnTarget(conduct, target);
        expect(
          text,
          `${id}: ${target.pack}/${target.scenario} has an aircraft entry`,
        ).toBeDefined();
        expect(text?.label.trim(), `${target.scenario} label`).not.toBe('');
        expect(text?.title.trim(), `${target.scenario} title`).not.toBe('');
      }
    }
  });

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
