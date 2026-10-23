// Reference check of a validated scenario against the aircraft (D-22): every control, state,
// quantity and band the file names must resolve in the registry and the quantity data. One issue
// per reference that does not resolve, with the path of the offending field. Controls and
// quantities are looked up through Map-backed getters and the scenario-keyed records are only
// iterated over their own keys, so a key such as "constructor" or "__proto__" never resolves
// (T-02-02). Rules L4 to L8 (RESEARCH Pitfall 7 among them), L10 and L11 (a run that does nothing
// must fail) follow, L12 checks the physics parameters a scenario sets (known, inside range), and
// L13 checks the named outcomes (D-06): every outcome predicate resolves, the outcome id shares the
// L4 namespace, and no outcome already holds in the initial state, which would end the run at once.
// L14 guards the level Realistic (D-05) for a scenario with an onset: simulated without any action
// from the Realistic start quantities (the base values laid over by onset.quantities, C-61), the
// run starts clean (no message active, no outcome holding) and every listed annunciation shows
// before the run ends. L15 (plan 03-11) makes the level quick: with the onset at the lower and at
// the upper end of its window every listed annunciation shows no later than
// REALISTIC_SHOW_WITHIN_MS after the onset, and the Realistic setup is sound (onset.parameters and
// onset.quantities name known ids inside their ranges, and no branch decided at the start reads a
// quantity the onset block sets, because grade decides such a branch on the initial state, WR-04).
// L16 and L17 (plan 03-13) keep a printed checklist consistent: L16 wants the row numbers present
// to run 1, 2, 3 in document order (rows without a number are free); L17 keeps the two forms apart
// (table: numbers, actions and comments, no decision, branch or marker; outline: markers, no
// number, action, comment or boxed).
// Variants (phase 3.1, SCN-09): L18 checks the references of a variant (unique ids, known controls,
// states and parameters, `applies` naming real steps and forbidden items, once each) and that no
// branch decided at the start reads a control a variant sets (grade decides it on the base start).
// L19 runs the start checks (L5, L6, L10, L11, L13, L14, L15) per variant on the scenario it makes,
// in the Easy form and, with an onset, the Realistic form. L20 grades a do-nothing recording (it must
// fail) and the solution of the variant (it must pass) per variant, in the Easy form and, with an
// onset, in the Realistic form at both ends of the window. L21 keeps the variants apart: no step
// that applies in one variant makes a forbidden item of another variant true at its start.
// checkScenario is the one check of the app and of `npm run validate`: it locates every issue in
// the text.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import { MAX_CAS_CHIPS } from '../engine/cas';
import type { AircraftEnv } from '../engine/env';
import { grade } from '../engine/grading';
import type { Recording } from '../engine/grading';
import {
  baselineOf,
  evaluatePredicate,
  initialQuantities,
  predicateProblems,
  realisticQuantities,
} from '../engine/predicates';
import type { PredicateContext } from '../engine/predicates';
import { legalStates } from '../engine/registry';
import { actionFor, resolveVariant } from '../engine/variants';
import type { PanelAction } from '../engine/variants';
import { STEP_MS, initSim, simSetup, stepSim } from '../engine/sim';
import type { SimState } from '../engine/sim';
import { joinPath, parseScenario } from './parse';
import type { ScenarioIssue } from './parse';
import type { ProcedureNode, Predicate, Scenario, Step } from './schema';
import { indexToon, locate } from './toon-index';
import type { PathSegment } from './toon-index';

/** How long past the onset the L14 simulation looks for the listed annunciations (T-03-16). */
const REALISTIC_LOOKAHEAD_MS = 600_000;

/**
 * L15: the latest a listed annunciation may show after the onset in a do-nothing Realistic run, in
 * ms, unless the scenario declares its own (`onset.message_within_s`). The owner asked for the
 * message "within about 10 seconds" (UAT test 1 of phase 3, 2026-10-23); the bound adds a margin of
 * 2 s. A slower failure declares its own bound in its file (the oil temperature scenario: about 20 s
 * asked for on 2026-10-23, so 22 s), and the other scenarios keep this one.
 */
export const REALISTIC_SHOW_WITHIN_MS = 12_000;

/** Most branch levels on one path through the procedure (UI-SPEC outline cap). */
export const MAX_BRANCH_LEVELS = 3;

/** A lint finding before it is located: the display path plus the path as separate segments. */
export interface LintIssue {
  readonly path: string;
  readonly segments: readonly PathSegment[];
  readonly message: string;
}

type Segments = readonly PathSegment[];

export function lintScenario(scenario: Scenario, env: AircraftEnv): LintIssue[] {
  const issues: LintIssue[] = [];
  const add = (segments: Segments, message: string): void => {
    issues.push({ path: joinPath(segments), segments, message });
  };

  const checkPredicate = (path: Segments, predicate: Predicate): void => {
    for (const problem of predicateProblems(predicate, env)) {
      add([...path, ...problem.at], problem.message);
    }
  };

  const checkNodes = (path: Segments, nodes: readonly ProcedureNode[]): void => {
    nodes.forEach((node, i) => {
      const here = [...path, i];
      switch (node.kind) {
        case 'line':
        case 'comment':
          return;
        case 'group':
          node.steps.forEach((step, j) => {
            checkPredicate([...here, 'steps', j, 'done'], step.done);
          });
          return;
        case 'branch':
          checkPredicate([...here, 'when'], node.when);
          checkNodes([...here, 'nodes'], node.nodes);
          return;
        case 'decision':
          node.branches.forEach((branch, j) => {
            const branchPath = [...here, 'branches', j];
            checkPredicate([...branchPath, 'when'], branch.when);
            checkNodes([...branchPath, 'nodes'], branch.nodes);
          });
          return;
      }
    });
  };

  for (const [id, state] of Object.entries(scenario.initial.controls)) {
    const def = env.registry.get(id);
    const path = ['initial', 'controls', id];
    if (def === undefined) add(path, `unknown control "${id}"`);
    else if (!legalStates(def).includes(state)) {
      add(path, `"${state}" is not a state of control "${id}"`);
    }
  }

  for (const [id, value] of Object.entries(scenario.initial.quantities)) {
    const def = env.quantities.get(id);
    const path = ['initial', 'quantities', id];
    if (def === undefined) add(path, `unknown quantity "${id}"`);
    else if (value < def.min || value > def.max) {
      add(
        path,
        `${String(value)} is outside ${String(def.min)}..${String(def.max)} of quantity "${id}"`,
      );
    }
  }

  // L12: every physics parameter names a parameter of the aircraft and lies inside its range.
  // The lookup is Map-backed, so a prototype key such as "constructor" never resolves.
  for (const [id, value] of Object.entries(scenario.parameters)) {
    const def = env.physics.parameter(id);
    const path = ['parameters', id];
    if (def === undefined) add(path, `unknown parameter "${id}"`);
    else if (value < def.min || value > def.max) {
      add(
        path,
        `${String(value)} is outside ${String(def.min)}..${String(def.max)} of parameter "${id}"`,
      );
    }
  }

  // L12 for the Realistic setup (C-64): onset.parameters name known parameters inside their ranges
  // and onset.quantities known quantities inside theirs.
  for (const [id, value] of Object.entries(scenario.onset?.parameters ?? {})) {
    const def = env.physics.parameter(id);
    const path = ['onset', 'parameters', id];
    if (def === undefined) add(path, `unknown parameter "${id}"`);
    else if (value < def.min || value > def.max) {
      add(
        path,
        `${String(value)} is outside ${String(def.min)}..${String(def.max)} of parameter "${id}"`,
      );
    }
  }
  for (const [id, state] of Object.entries(scenario.onset?.controls ?? {})) {
    const def = env.registry.get(id);
    const path = ['onset', 'controls', id];
    if (def === undefined) add(path, `unknown control "${id}"`);
    else if (!legalStates(def).includes(state)) {
      add(path, `"${state}" is not a state of control "${id}"`);
    }
  }
  for (const [id, value] of Object.entries(scenario.onset?.quantities ?? {})) {
    const def = env.quantities.get(id);
    const path = ['onset', 'quantities', id];
    if (def === undefined) add(path, `unknown quantity "${id}"`);
    else if (value < def.min || value > def.max) {
      add(
        path,
        `${String(value)} is outside ${String(def.min)}..${String(def.max)} of quantity "${id}"`,
      );
    }
  }

  // L10 (reference part): every listed annunciation names a rule of the aircraft table.
  scenario.annunciations.forEach((id, i) => {
    if (env.cas.get(id) === undefined) add(['annunciations', i], `unknown CAS id "${id}"`);
  });

  checkNodes(['procedure'], scenario.procedure);
  scenario.forbidden.forEach((item, i) => {
    checkPredicate(['forbidden', i, 'trigger'], item.trigger);
    if (item.when !== undefined) checkPredicate(['forbidden', i, 'when'], item.when);
  });
  // L13: every outcome predicate resolves against the aircraft.
  scenario.outcomes.forEach((item, i) => {
    checkPredicate(['outcomes', i, 'when'], item.when);
  });

  // L4: group, step and forbidden ids share one namespace within a scenario.
  const seen = new Set<string>();
  const claim = (path: Segments, id: string): void => {
    if (seen.has(id))
      add(path, `duplicate id "${id}"; group, step, forbidden and outcome ids are unique`);
    else seen.add(id);
  };

  // L7 and L8: branch depth and groups below a branch decided during the run.
  const walk = (path: Segments, nodes: readonly ProcedureNode[], levels: number, run: boolean) => {
    nodes.forEach((node, i) => {
      const here = [...path, i];
      switch (node.kind) {
        case 'line':
        case 'comment':
          return;
        case 'group':
          claim([...here, 'id'], node.id);
          node.steps.forEach((step, j) => {
            claim([...here, 'steps', j, 'id'], step.id);
          });
          if (run) {
            add(
              here,
              `group "${node.id}" sits under a branch decided during the run; format 1 grades no such group`,
            );
          }
          return;
        case 'branch':
          enter([...here], node, levels, run);
          return;
        case 'decision':
          node.branches.forEach((branch, j) => {
            enter([...here, 'branches', j], branch, levels, run);
          });
          return;
      }
    });
  };
  const enter = (
    path: Segments,
    branch: { readonly decided_at: 'start' | 'run'; readonly nodes: readonly ProcedureNode[] },
    levels: number,
    run: boolean,
  ): void => {
    const depth = levels + 1;
    if (depth === MAX_BRANCH_LEVELS + 1) {
      add(path, `branches nest ${String(depth)} levels deep; at most ${String(MAX_BRANCH_LEVELS)}`);
    }
    walk([...path, 'nodes'], branch.nodes, depth, run || branch.decided_at === 'run');
  };
  walk(['procedure'], scenario.procedure, 0, false);
  scenario.forbidden.forEach((item, i) => {
    claim(['forbidden', i, 'id'], item.id);
  });
  scenario.outcomes.forEach((item, i) => {
    claim(['outcomes', i, 'id'], item.id);
  });

  checkChecklist(scenario, add);
  checkVariantReferences(scenario, env, add);

  // L5 and L6 evaluate predicates, which needs every reference to resolve first. L19: a scenario
  // with variants has no single start; the start checks run per variant on the scenario it makes.
  if (issues.length === 0 && scenario.variants.length === 0) {
    checkInitialState(scenario, env, add);
    checkRealisticStart(scenario, env, add);
  }
  if (issues.length === 0) {
    scenario.variants.forEach((variant, n) => {
      const here = (_segments: Segments, message: string): void => {
        add(['variants', n], `variant "${variant.id}": ${message}`);
      };
      checkInitialState(resolveVariant(scenario, variant.id, false), env, here);
      checkRealisticStart(resolveVariant(scenario, variant.id, true), env, here);
    });
  }
  if (issues.length === 0 && scenario.variants.length > 0) checkVariantRuns(scenario, env, add);
  return issues;
}

/** The ids of every step in the procedure, in document order, with the path of each. */
function stepPaths(
  nodes: readonly ProcedureNode[],
  path: Segments = ['procedure'],
): Map<string, Segments> {
  const found = new Map<string, Segments>();
  nodes.forEach((node, i) => {
    const here = [...path, i];
    switch (node.kind) {
      case 'line':
      case 'comment':
        return;
      case 'group':
        node.steps.forEach((step, j) => found.set(step.id, [...here, 'steps', j]));
        return;
      case 'branch':
        for (const [id, at] of stepPaths(node.nodes, [...here, 'nodes'])) found.set(id, at);
        return;
      case 'decision':
        node.branches.forEach((branch, j) => {
          for (const [id, at] of stepPaths(branch.nodes, [...here, 'branches', j, 'nodes'])) {
            found.set(id, at);
          }
        });
        return;
    }
  });
  return found;
}

/**
 * L18: the references of the variants. Ids are unique; `controls` name known controls in legal
 * states; `parameters` name known parameters inside their range; `applies` names steps and
 * forbidden items, each once per variant. A branch decided at the start must not read a control a
 * variant sets: grade decides such a branch on the base start.
 */
function checkVariantReferences(
  scenario: Scenario,
  env: AircraftEnv,
  add: (segments: Segments, message: string) => void,
): void {
  if (scenario.variants.length === 0) return;
  const known = new Set([
    ...stepPaths(scenario.procedure).keys(),
    ...scenario.forbidden.map((f) => f.id),
  ]);
  const ids = new Set<string>();
  const setControls = new Set<string>();
  scenario.variants.forEach((variant, n) => {
    const base: Segments = ['variants', n];
    if (ids.has(variant.id)) {
      add([...base, 'id'], `duplicate variant id "${variant.id}"`);
    }
    ids.add(variant.id);
    for (const [id, state] of Object.entries(variant.controls)) {
      setControls.add(id);
      const def = env.registry.get(id);
      const path = [...base, 'controls', id];
      if (def === undefined) add(path, `unknown control "${id}"`);
      else if (!legalStates(def).includes(state)) {
        add(path, `"${state}" is not a state of control "${id}"`);
      }
    }
    for (const [id, value] of Object.entries(variant.parameters)) {
      const def = env.physics.parameter(id);
      const path = [...base, 'parameters', id];
      if (def === undefined) add(path, `unknown parameter "${id}"`);
      else if (value < def.min || value > def.max) {
        add(
          path,
          `${String(value)} is outside ${String(def.min)}..${String(def.max)} of parameter "${id}"`,
        );
      }
    }
    const named = new Set<string>();
    variant.applies.forEach((id, k) => {
      const path = [...base, 'applies', k];
      if (!known.has(id)) add(path, `"${id}" names no step or forbidden item`);
      else if (named.has(id)) add(path, `"${id}" is listed twice`);
      named.add(id);
    });
  });

  const guard = (nodes: readonly ProcedureNode[], path: Segments): void => {
    const check = (
      branch: { readonly decided_at: 'start' | 'run'; readonly when: Predicate },
      at: Segments,
    ): void => {
      const control = 'control' in branch.when ? branch.when.control : null;
      if (branch.decided_at === 'start' && control !== null && setControls.has(control)) {
        add(
          [...at, 'when'],
          `this branch is decided at the start and reads "${control}", which a variant sets; grade decides it on the base start, so decide it during the run`,
        );
      }
    };
    nodes.forEach((node, i) => {
      const here = [...path, i];
      if (node.kind === 'branch') {
        check(node, here);
        guard(node.nodes, [...here, 'nodes']);
      } else if (node.kind === 'decision') {
        node.branches.forEach((branch, j) => {
          const at = [...here, 'branches', j];
          check(branch, at);
          guard(branch.nodes, [...at, 'nodes']);
        });
      }
    });
  };
  guard(scenario.procedure, ['procedure']);
}

/** Time between two actions of a built solution, and the margin after the last one. */
const SOLUTION_GAP_MS = 1000;
const SOLUTION_TAIL_MS = 5000;

/**
 * L20 and L21: what a run of each variant does. L20: a recording that does nothing fails, and the
 * solution (the critical and standard steps that apply, their actions one second apart in declared
 * order) passes, in the Easy form and, with an onset, in the Realistic form: the onset at both ends
 * of the window and every action after the upper end. A step whose predicate has no panel action
 * is reported (the solution cannot be built). L21: a step that applies in one variant must not make
 * a forbidden item of another variant true at that variant's start.
 */
function checkVariantRuns(
  scenario: Scenario,
  env: AircraftEnv,
  add: (segments: Segments, message: string) => void,
): void {
  const onset = scenario.onset;
  const windowAt = (second: number): number => STEP_MS * Math.round((second * 1000) / STEP_MS);
  const lowerAt = onset === undefined ? 0 : windowAt(onset.window_s[0]);
  const upperAt = onset === undefined ? 0 : windowAt(onset.window_s[1]);

  scenario.variants.forEach((variant, n) => {
    const where: Segments = ['variants', n];
    const report = (message: string): void => {
      add(where, `variant "${variant.id}": ${message}`);
    };
    const easy = resolveVariant(scenario, variant.id, false);
    const forms: { readonly label: string; readonly onsetAt: number | null }[] = [
      { label: 'Easy', onsetAt: null },
      ...(onset === undefined
        ? []
        : [
            { label: 'Realistic with the onset at the lower end', onsetAt: lowerAt },
            { label: 'Realistic with the onset at the upper end', onsetAt: upperAt },
          ]),
    ];
    const baseline = baselineOf(easy, env.registry);
    const context: PredicateContext = {
      controls: baseline,
      baseline,
      quantities: initialQuantities(easy, env.quantities),
    };
    const recordingOf = (
      onsetAt: number | null,
      events: Recording['events'],
      completedAt: number,
    ): Recording => ({
      scenarioId: scenario.id,
      completedAt,
      variant: { id: variant.id, seed: 0 },
      ...(onsetAt === null ? {} : { onset: { at: onsetAt, seed: 0 } }),
      events,
    });

    // The solution: the critical and standard steps that are graded at the start of this variant.
    const nothing = grade(scenario, env, recordingOf(null, [], SOLUTION_TAIL_MS));
    const graded = new Set(
      nothing.steps.filter((step) => step.severity !== 'optional').map((step) => step.id),
    );
    const steps = [...resolveSteps(easy)].filter((step) => graded.has(step.id));
    const actions: PanelAction[] = [];
    const accumulated = { ...baseline };
    let buildable = true;
    for (const step of steps) {
      const action = actionFor(step.done, { ...context, controls: accumulated }, env);
      if (action === null) {
        report(
          `step "${step.id}" has no panel action that makes it true; the solution cannot be built`,
        );
        buildable = false;
        continue;
      }
      if (accumulated[action.control] !== action.state) {
        accumulated[action.control] = action.state;
        actions.push(action);
      }
    }

    for (const form of forms) {
      const doNothing = grade(
        scenario,
        env,
        recordingOf(form.onsetAt, [], (form.onsetAt === null ? 0 : upperAt) + SOLUTION_TAIL_MS),
      );
      if (doNothing.result === 'pass') {
        report(`a run that does nothing passes (${form.label})`);
      }
      if (!buildable) continue;
      const first = form.onsetAt === null ? 0 : upperAt;
      const events = actions.map((action, k) => ({
        t: first + SOLUTION_GAP_MS * (k + 1),
        id: action.control,
        value: action.state,
      }));
      const done = grade(
        scenario,
        env,
        recordingOf(
          form.onsetAt,
          events,
          first + SOLUTION_GAP_MS * (events.length + 1) + SOLUTION_TAIL_MS,
        ),
      );
      if (done.result !== 'pass') {
        report(
          `the solution does not pass (${form.label}): ${done.reasons.map((r) => r.kind).join(', ')}`,
        );
      }
    }
  });

  // L21: a step of variant V applied to the start of variant W must not trigger W's forbidden items.
  scenario.variants.forEach((own, n) => {
    const mine = resolveVariant(scenario, own.id, false);
    scenario.variants.forEach((other) => {
      if (other.id === own.id) return;
      const theirs = resolveVariant(scenario, other.id, false);
      const baseline = baselineOf(theirs, env.registry);
      const context: PredicateContext = {
        controls: baseline,
        baseline,
        quantities: initialQuantities(theirs, env.quantities),
      };
      for (const step of resolveSteps(mine)) {
        const action = actionFor(step.done, context, env);
        if (action === null) continue;
        const after: PredicateContext = {
          ...context,
          controls: { ...baseline, [action.control]: action.state },
        };
        for (const item of theirs.forbidden) {
          const watched = item.when === undefined || evaluatePredicate(item.when, context, env);
          if (
            watched &&
            !evaluatePredicate(item.trigger, context, env) &&
            evaluatePredicate(item.trigger, after, env)
          ) {
            add(
              ['variants', n],
              `variant "${own.id}": step "${step.id}" makes the forbidden item "${item.id}" true in variant "${other.id}"`,
            );
          }
        }
      }
    });
  });
}

/** Every step of a scenario's groups in document order, including those under branches. */
function resolveSteps(scenario: Scenario): Step[] {
  const steps: Step[] = [];
  const visit = (nodes: readonly ProcedureNode[]): void => {
    for (const node of nodes) {
      if (node.kind === 'group') steps.push(...node.steps);
      else if (node.kind === 'branch') visit(node.nodes);
      else if (node.kind === 'decision') for (const branch of node.branches) visit(branch.nodes);
    }
  };
  visit(scenario.procedure);
  return steps;
}

/**
 * L16 and L17: a checklist as printed. L16: in document order (a group's steps in order, nested
 * nodes where they stand) the numbers present are 1, 2, 3 and so on; a gap, a repeat or a start
 * other than 1 is reported at the number, with the expected and the found number; counting resumes
 * after a higher number and keeps the expected one after a repeat, so one slip is one issue. L17: the table form has no decision, branch or
 * marker (a marker is reported at its own key as well); the outline form (the default) has no number, action, comment node or boxed.
 */
function checkChecklist(
  scenario: Scenario,
  add: (segments: Segments, message: string) => void,
): void {
  const table = scenario.checklist?.form === 'table';
  let expected = 1;
  const numbered = (path: Segments, number: number | undefined): void => {
    if (number === undefined) return;
    if (number === expected) {
      expected++;
      return;
    }
    add(
      [...path, 'number'],
      `row number ${String(number)} breaks the numbering; expected ${String(expected)}`,
    );
    // A gap or a late start resumes after the found number; a repeat keeps the expected one.
    if (number > expected) expected = number + 1;
  };
  const noMarker = (path: Segments, marker: string | undefined): void => {
    if (table && marker !== undefined) {
      add([...path, 'marker'], 'a marker is for the outline form; this checklist is a table');
    }
  };
  const outlineOnly = (path: Segments, keys: Record<string, unknown>, what: string): void => {
    for (const [key, value] of Object.entries(keys)) {
      if (value !== undefined) {
        add([...path, key], `${key} is for the table form; this checklist is an ${what}`);
      }
    }
  };
  const visit = (path: Segments, nodes: readonly ProcedureNode[]): void => {
    nodes.forEach((node, i) => {
      const here = [...path, i];
      switch (node.kind) {
        case 'line':
          numbered(here, node.number);
          noMarker(here, node.marker);
          if (!table) outlineOnly(here, { number: node.number, action: node.action }, 'outline');
          return;
        case 'comment':
          if (!table)
            add(here, 'a comment row is for the table form; this checklist is an outline');
          return;
        case 'group':
          node.steps.forEach((step, j) => {
            const at = [...here, 'steps', j];
            numbered(at, step.number);
            noMarker(at, step.marker);
            if (!table) outlineOnly(at, { number: step.number, action: step.action }, 'outline');
          });
          return;
        case 'branch':
          if (table) add(here, 'a branch is for the outline form; this checklist is a table');
          noMarker(here, node.marker);
          visit([...here, 'nodes'], node.nodes);
          return;
        case 'decision':
          if (table) add(here, 'a decision is for the outline form; this checklist is a table');
          noMarker(here, node.marker);
          node.branches.forEach((branch, j) => {
            noMarker([...here, 'branches', j], branch.marker);
            visit([...here, 'branches', j, 'nodes'], branch.nodes);
          });
          return;
      }
    });
  };
  visit(['procedure'], scenario.procedure);
}

/**
 * L5, L6, L10, L11 and L13: what already holds before the first event (RESEARCH Pitfall 7, R3), and
 * that at least one critical step is graded at the start, so a run that does nothing fails (WR-01).
 */
function checkInitialState(
  scenario: Scenario,
  env: AircraftEnv,
  add: (segments: Segments, message: string) => void,
): void {
  const baseline = baselineOf(scenario, env.registry);
  const ctx: PredicateContext = {
    controls: baseline,
    baseline,
    quantities: initialQuantities(scenario, env.quantities),
  };

  let criticalAtStart = 0;
  const visit = (path: Segments, nodes: readonly ProcedureNode[], applies: boolean): void => {
    nodes.forEach((node, i) => {
      const here = [...path, i];
      switch (node.kind) {
        case 'line':
        case 'comment':
          return;
        case 'group':
          if (!applies) return;
          node.steps.forEach((step, j) => {
            if (step.severity === 'critical') criticalAtStart++;
            if (evaluatePredicate(step.done, ctx, env)) {
              add(
                [...here, 'steps', j, 'done'],
                `step "${step.id}" is already satisfied in the initial state; a run that does nothing would be credited`,
              );
            }
          });
          return;
        case 'branch':
          visit(
            [...here, 'nodes'],
            node.nodes,
            applies && node.decided_at === 'start' && evaluatePredicate(node.when, ctx, env),
          );
          return;
        case 'decision':
          node.branches.forEach((branch, j) => {
            visit(
              [...here, 'branches', j, 'nodes'],
              branch.nodes,
              applies && branch.decided_at === 'start' && evaluatePredicate(branch.when, ctx, env),
            );
          });
          return;
      }
    });
  };
  visit(['procedure'], scenario.procedure, true);
  if (criticalAtStart === 0) {
    add(
      ['procedure'],
      'no critical step is graded at the start; a run that does nothing would pass',
    );
  }

  // L10: the annunciations list equals, as a set, the rules that fire in the initial state, and
  // the PFD shows at most MAX_CAS_CHIPS of them (SCN-03, T-02-14: a scenario cannot claim a message
  // its quantities do not fire).
  const fired = env.cas.active(ctx, env).map((m) => m.id);
  const listed = new Set<string>();
  scenario.annunciations.forEach((id, i) => {
    if (listed.has(id)) add(['annunciations', i], `"${id}" is listed twice`);
    else if (!fired.includes(id)) {
      add(
        ['annunciations', i],
        `"${id}" is listed but its rule does not fire in the initial state`,
      );
    }
    listed.add(id);
  });
  for (const id of fired) {
    if (!listed.has(id)) {
      add(['annunciations'], `"${id}" is not listed; its rule fires in the initial state`);
    }
  }
  if (fired.length > MAX_CAS_CHIPS) {
    add(
      ['annunciations'],
      `${String(fired.length)} messages are active at the start; the PFD shows at most ${String(MAX_CAS_CHIPS)}`,
    );
  }

  scenario.forbidden.forEach((item, i) => {
    const watched = item.when === undefined || evaluatePredicate(item.when, ctx, env);
    if (watched && evaluatePredicate(item.trigger, ctx, env)) {
      add(
        ['forbidden', i, 'trigger'],
        `trigger of "${item.id}" already holds in the initial state; it would count at once`,
      );
    }
  });

  // L13: an outcome that holds at the start would end the run as soon as its hold time passed.
  scenario.outcomes.forEach((item, i) => {
    if (evaluatePredicate(item.when, ctx, env)) {
      add(
        ['outcomes', i, 'when'],
        `outcome "${item.id}" already holds in the initial state; the run would end at once`,
      );
    }
  });
}

/** The quantities a predicate reads, if it reads any (a quantity or band check). */
function quantityRead(predicate: Predicate): string | null {
  return predicate.check === 'quantity' || predicate.check === 'band' ? predicate.quantity : null;
}

/**
 * L14 and L15: the level Realistic of a scenario with an onset (D-05). The run starts at once from
 * the Realistic start quantities (the base values laid over by onset.quantities, C-61) and does
 * nothing. No message may be active at the start and no outcome may hold there. Two runs follow,
 * with the onset at the lower and at the upper end of the window: every listed annunciation must
 * become active before the run ends or the lookahead (the window cap plus 600 s, below MAX_RUN_MS)
 * is over (L14), and no later than the scenario's own onset.message_within_s, else
 * REALISTIC_SHOW_WITHIN_MS, after the onset (L15, the owner's "about 10 s" with a margin). The guard clause of L15: a branch decided at the start must not read
 * a quantity the onset block sets, because grade decides such a branch on the scenario's initial
 * state (WR-04 stays open). The scenario's own initial.quantities do not apply: the level starts
 * from the base values (C-31).
 */
function checkRealisticStart(
  scenario: Scenario,
  env: AircraftEnv,
  add: (segments: Segments, message: string) => void,
): void {
  const onset = scenario.onset;
  if (onset === undefined) return;

  // L15 guard: branches decided at the start that read a quantity the onset block sets.
  const set = new Set(Object.keys(onset.quantities));
  const reported = new Set<string>();
  const guard = (nodes: readonly ProcedureNode[]): void => {
    const check = (
      branch: { readonly decided_at: 'start' | 'run'; readonly when: Predicate },
      label: string,
    ): void => {
      const read = branch.decided_at === 'start' ? quantityRead(branch.when) : null;
      if (read !== null && set.has(read) && !reported.has(read)) {
        reported.add(read);
        add(
          ['onset', 'quantities', read],
          `the branch "${label}" is decided at the start and reads "${read}", which the onset block sets; grade decides it on the initial state, so decide it during the run or leave the quantity out`,
        );
      }
    };
    for (const node of nodes) {
      if (node.kind === 'branch') {
        check(node, node.label);
        guard(node.nodes);
      } else if (node.kind === 'decision') {
        for (const branch of node.branches) {
          check(branch, branch.label);
          guard(branch.nodes);
        }
      }
    }
  };
  guard(scenario.procedure);

  const start = realisticQuantities(scenario, env.quantities);
  const lowerAt = STEP_MS * Math.round((onset.window_s[0] * 1000) / STEP_MS);
  const upperAt = STEP_MS * Math.round((onset.window_s[1] * 1000) / STEP_MS);
  const firstSetup = simSetup(env, scenario, { onsetAt: upperAt });
  const contextOf = (setup: typeof firstSetup, state: SimState): PredicateContext => ({
    controls: state.controls,
    baseline: setup.baseline,
    quantities: state.quantities,
  });

  // L14: the clean start, the same for both ends of the window.
  const state0 = initSim(firstSetup, start);
  const startPath: Segments =
    Object.keys(onset.quantities).length > 0 ? ['onset', 'quantities'] : ['initial', 'controls'];
  for (const message of env.cas.active(contextOf(firstSetup, state0), env)) {
    add(
      startPath,
      `"${message.id}" is already active at the realistic start; the level Realistic must begin without a message`,
    );
  }
  scenario.outcomes.forEach((item, i) => {
    if (evaluatePredicate(item.when, contextOf(firstSetup, state0), env)) {
      add(
        ['outcomes', i, 'when'],
        `outcome "${item.id}" already holds at the realistic start; the run would end at once`,
      );
    }
  });

  /** The time of the first step in which each message is active, in a do-nothing run with this onset. */
  const firstShown = (onsetAt: number): Map<string, number> => {
    const setup = simSetup(env, scenario, { onsetAt });
    const shown = new Map<string, number>();
    const note = (state: SimState): void => {
      for (const message of env.cas.active(contextOf(setup, state), env)) {
        if (!shown.has(message.id)) shown.set(message.id, state.t);
      }
    };
    let state = initSim(setup, start);
    note(state);
    const limit = onsetAt + REALISTIC_LOOKAHEAD_MS;
    while (state.t < limit && state.outcome === null) {
      state = stepSim(setup, state, []).state;
      note(state);
    }
    return shown;
  };
  const lower = firstShown(lowerAt);
  const upper = firstShown(upperAt);

  const showWithinMs =
    onset.message_within_s === undefined ? REALISTIC_SHOW_WITHIN_MS : onset.message_within_s * 1000;
  scenario.annunciations.forEach((id, i) => {
    const early = lower.get(id);
    const late = upper.get(id);
    if (early === undefined || late === undefined) {
      add(
        ['annunciations', i],
        `"${id}" is listed but never becomes active in a realistic run that does nothing; the level Realistic would not show it`,
      );
      return;
    }
    const afterOnsetMs = Math.max(early - lowerAt, late - upperAt);
    if (afterOnsetMs > showWithinMs) {
      add(
        ['annunciations', i],
        `"${id}" shows ${(afterOnsetMs / 1000).toFixed(1)} s after the onset in a realistic run that does nothing; the level Realistic must show it within ${String(showWithinMs / 1000)} s`,
      );
    }
  });
}

export type CheckResult =
  | { readonly ok: true; readonly scenario: Scenario }
  | { readonly ok: false; readonly issues: readonly ScenarioIssue[] };

/**
 * The one scenario check: decode, validate against the schema, lint against the aircraft, with
 * every issue located by line and column. The app (openScenario) and `npm run validate` both
 * call it, so a file passes in one exactly when it passes in the other.
 */
export function checkScenario(text: string, env: AircraftEnv): CheckResult {
  const parsed = parseScenario(text);
  if (!parsed.ok) return parsed;
  const found = lintScenario(parsed.value, env);
  if (found.length === 0) return { ok: true, scenario: parsed.value };
  const index = indexToon(text);
  return {
    ok: false,
    issues: found.map((issue) => ({
      path: issue.path,
      message: issue.message,
      ...locate(index, issue.segments),
    })),
  };
}
