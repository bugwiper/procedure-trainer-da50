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
// from the base values, with the onset at the upper end of its window, the run starts clean (no
// message active, no outcome holding) and every listed annunciation shows before the run ends.
// checkScenario is the one check of the app and of `npm run validate`: it locates every issue in
// the text.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import { MAX_CAS_CHIPS } from '../engine/cas';
import type { AircraftEnv } from '../engine/env';
import {
  baselineOf,
  evaluatePredicate,
  initialQuantities,
  predicateProblems,
} from '../engine/predicates';
import type { PredicateContext } from '../engine/predicates';
import { legalStates } from '../engine/registry';
import { STEP_MS, initSim, simSetup, stepSim } from '../engine/sim';
import type { SimState } from '../engine/sim';
import { joinPath, parseScenario } from './parse';
import type { ScenarioIssue } from './parse';
import type { ProcedureNode, Predicate, Scenario } from './schema';
import { indexToon, locate } from './toon-index';
import type { PathSegment } from './toon-index';

/** How long past the onset the L14 simulation looks for the listed annunciations (T-03-16). */
const REALISTIC_LOOKAHEAD_MS = 600_000;

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

  // L5 and L6 evaluate predicates, which needs every reference to resolve first.
  if (issues.length === 0) checkInitialState(scenario, env, add);
  if (issues.length === 0) checkRealisticStart(scenario, env, add);
  return issues;
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

/**
 * L14: the level Realistic of a scenario with an onset (D-05). The run starts at once in the base
 * state and does nothing; the onset sits at the upper end of the window, the latest the failure can
 * begin. No message may be active at the start and no outcome may hold there; every listed
 * annunciation must become active before the run ends or the lookahead (the window cap plus 600 s,
 * below MAX_RUN_MS) is over. The scenario's own initial.quantities do not apply: the level starts
 * from the base values (C-31).
 */
function checkRealisticStart(
  scenario: Scenario,
  env: AircraftEnv,
  add: (segments: Segments, message: string) => void,
): void {
  if (scenario.onset === undefined) return;
  const onsetAt = STEP_MS * Math.round((scenario.onset.window_s[1] * 1000) / STEP_MS);
  const setup = simSetup(env, scenario, { onsetAt });
  const contextOf = (state: SimState): PredicateContext => ({
    controls: state.controls,
    baseline: setup.baseline,
    quantities: state.quantities,
  });

  let state = initSim(setup, {});
  const shown = new Set<string>();
  for (const message of env.cas.active(contextOf(state), env)) {
    shown.add(message.id);
    add(
      ['initial', 'controls'],
      `"${message.id}" is already active at the realistic start; the level Realistic must begin without a message`,
    );
  }
  scenario.outcomes.forEach((item, i) => {
    if (evaluatePredicate(item.when, contextOf(state), env)) {
      add(
        ['outcomes', i, 'when'],
        `outcome "${item.id}" already holds at the realistic start; the run would end at once`,
      );
    }
  });

  const limit = onsetAt + REALISTIC_LOOKAHEAD_MS;
  while (state.t < limit && state.outcome === null) {
    state = stepSim(setup, state, []).state;
    for (const message of env.cas.active(contextOf(state), env)) shown.add(message.id);
  }
  scenario.annunciations.forEach((id, i) => {
    if (!shown.has(id)) {
      add(
        ['annunciations', i],
        `"${id}" is listed but never becomes active in a realistic run that does nothing; the level Realistic would not show it`,
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
