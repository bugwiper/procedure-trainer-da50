// Grading as a pure replay (D-09 to D-13, SCN-04, SCN-05): grade(scenario, env, recording) turns
// the recorded action log into a PASS or FAIL verdict with step, branch, order and harmful-action
// detail. The rules R1 to R9 are written down in docs/GRADING.md; rule R10 (D-06, C-26) adds the
// escalation to a named outcome: grade replays the same simulation as the live run up to the end
// of the recording, and when an outcome of the scenario fires the log is graded only up to the
// outcome time and the outcome is the first FAIL reason. Nothing here reads a clock, a
// random source or an unordered key set: events are applied in log order, every list follows the
// declared scenario order (depth-first), and the result is plain JSON data, so the same inputs
// always give a JSON-identical result (T-02-30).
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { Forbidden, Group, Scenario } from '../scenario/schema';
import type { AircraftEnv } from './env';
import {
  baselineOf,
  evaluatePredicate,
  initialQuantities,
  realisticQuantities,
} from './predicates';
import type { PredicateContext } from './predicates';
import { simSetup, simulate } from './sim';
import type { ReplayedChange } from './sim';
import { canInject, resolveVariant } from './variants';

export interface RecordedEvent {
  readonly t: number;
  readonly id: string;
  readonly value: string;
}

/** The onset of a realistic run (D-05): when the failure began, in run ms, and the seed that drew it. */
export interface RecordedOnset {
  readonly at: number;
  readonly seed: number;
}

/** The variant a run drew (V-05): its id and the seed that drew it. */
export interface RecordedVariant {
  readonly id: string;
  readonly seed: number;
}

export interface Recording {
  readonly scenarioId: string;
  readonly completedAt: number;
  /**
   * Run data of the level Realistic (C-33): the failure begins at `at` and the run starts from the
   * Realistic setup of the scenario (the base values laid over by its onset quantities). Absent or null means the failure is there from the start (Easy and Medium). The
   * level itself is never an input of grade.
   */
  readonly onset?: RecordedOnset | null;
  /**
   * The cause the run drew (phase 3.1): grade replays it, so only the steps and forbidden items
   * that apply in it are graded. Absent or null means the first variant of the file (V-04), which
   * keeps every recording written before variants exist grading as before.
   */
  readonly variant?: RecordedVariant | null;
  /** In log order; never sorted by t. */
  readonly events: readonly RecordedEvent[];
}

export type BranchStatus = 'applies' | 'not_applicable' | 'open';

export interface BranchVerdict {
  /** Dot path in the decoded file, for example procedure.0.branches.1.nodes.3. */
  readonly path: string;
  readonly status: BranchStatus;
}

export interface StepVerdict {
  readonly id: string;
  readonly group: string;
  readonly severity: 'critical' | 'standard' | 'optional';
  readonly credited: boolean;
  /** Log index after which the step became and stayed done; -1 from the start; null when not credited. */
  readonly enteredAt: number | null;
  /**
   * R12: present (true) only on a recording with an onset, when the step already held at the onset
   * and the pilot did not make it false and true again afterwards; absent everywhere else.
   */
  readonly preempted?: true;
}

export interface OrderViolation {
  readonly group: string;
  /** Declared first, but last entered after `before`. */
  readonly expected: string;
  readonly before: string;
  readonly critical: boolean;
}

export interface HarmfulEntry {
  readonly id: string;
  readonly text: string;
  readonly t: number;
  /** Log index of the event that made the forbidden condition true. */
  readonly seq: number;
  readonly failsRun: boolean;
}

/** The named outcome that ended a run: id and text from the scenario, t the run time it fired at. */
export interface OutcomeVerdict {
  readonly id: string;
  readonly text: string;
  readonly t: number;
}

export type Reason =
  | { readonly kind: 'outcome'; readonly id: string }
  | { readonly kind: 'critical_missed'; readonly count: number }
  | { readonly kind: 'order'; readonly group: string }
  | { readonly kind: 'forbidden'; readonly id: string };

/**
 * The reaction time (D-05, C-34), for display only: no step has a time limit and no verdict reads
 * it (SES-V2-02 stays v2). `onsetAt` is the onset of a realistic run in ms (0 without one);
 * `firstActionMs` is the time of the first graded event at or after the onset, minus the onset, or
 * null when there is none.
 */
export interface Timing {
  readonly onsetAt: number;
  readonly firstActionMs: number | null;
}

export interface GradeResult {
  readonly scenarioId: string;
  readonly result: 'pass' | 'fail';
  readonly reasons: readonly Reason[];
  readonly steps: readonly StepVerdict[];
  readonly branches: readonly BranchVerdict[];
  readonly orderViolations: readonly OrderViolation[];
  readonly harmful: readonly HarmfulEntry[];
  /** The named outcome that ended the run (R10), or null when none fired. */
  readonly outcome: OutcomeVerdict | null;
  /** The reaction time from the onset; display only. */
  readonly timing: Timing;
  /** The id of the variant the recording names; present only when it names one. */
  readonly variant?: string;
}

/** R1: the state of the run before the first event. */
function startContext(scenario: Scenario, env: AircraftEnv): PredicateContext {
  const baseline = baselineOf(scenario, env.registry);
  return {
    controls: baseline,
    baseline,
    quantities: initialQuantities(scenario, env.quantities),
  };
}

interface Walk {
  readonly branches: BranchVerdict[];
  readonly groups: { readonly group: Group; readonly graded: boolean }[];
}

/** R2 and R3: depth-first walk giving every branch its status and every group its graded flag. */
function walkProcedure(scenario: Scenario, ctx0: PredicateContext, env: AircraftEnv): Walk {
  const walk: Walk = { branches: [], groups: [] };

  const statusOf = (
    parent: BranchStatus,
    branch: { readonly decided_at: 'start' | 'run'; readonly when: Forbidden['trigger'] },
  ): BranchStatus => {
    if (parent !== 'applies') return parent;
    if (branch.decided_at === 'run') return 'open';
    return evaluatePredicate(branch.when, ctx0, env) ? 'applies' : 'not_applicable';
  };

  const visit = (nodes: Scenario['procedure'], path: string, parent: BranchStatus): void => {
    nodes.forEach((node, i) => {
      const here = `${path}.${String(i)}`;
      switch (node.kind) {
        case 'line':
        case 'comment':
          return;
        case 'group':
          walk.groups.push({ group: node, graded: parent === 'applies' });
          return;
        case 'branch': {
          const status = statusOf(parent, node);
          walk.branches.push({ path: here, status });
          visit(node.nodes, `${here}.nodes`, status);
          return;
        }
        case 'decision':
          node.branches.forEach((branch, j) => {
            const branchPath = `${here}.branches.${String(j)}`;
            const status = statusOf(parent, branch);
            walk.branches.push({ path: branchPath, status });
            visit(branch.nodes, `${branchPath}.nodes`, status);
          });
          return;
      }
    });
  };

  visit(scenario.procedure, 'procedure', 'applies');
  return walk;
}

/** The status of every branch at the start of the run, in declared order (D-23, D-25). */
export function branchStatuses(scenario: Scenario, env: AircraftEnv): BranchVerdict[] {
  return walkProcedure(scenario, startContext(scenario, env), env).branches;
}

/**
 * R10 and the simulated changes (V-06): what the simulation of the recording gives. The simulation is the one of the live
 * run, started from the scenario's start quantities (the base values with a recorded onset) and
 * replayed to the end of the recording. It yields the outcome the recording runs into (R10) and the
 * control changes the simulation made by itself, each with the number of recorded events applied
 * before it. A scenario with neither outcomes nor such changes needs no simulation.
 */
function replaySim(
  scenario: Scenario,
  env: AircraftEnv,
  recording: Recording,
): { readonly outcome: OutcomeVerdict | null; readonly injected: readonly ReplayedChange[] } {
  if (scenario.outcomes.length === 0 && !canInject(scenario, env))
    return { outcome: null, injected: [] };
  // C-33: with an onset the run starts from the Realistic setup of the scenario (the base values
  // laid over by its onset quantities, C-61) and the parameters, with those of its onset block,
  // switch at `at`; without one it starts from the scenario's initial quantities with the
  // parameters from t 0.
  const onset = recording.onset ?? null;
  const { state, injected } = simulate(
    simSetup(env, scenario, onset === null ? {} : { onsetAt: onset.at }),
    {
      events: recording.events,
      start:
        onset === null
          ? initialQuantities(scenario, env.quantities)
          : realisticQuantities(scenario, env.quantities),
      untilMs: recording.completedAt,
    },
  );
  if (state.outcome === null) return { outcome: null, injected };
  const { id, t } = state.outcome;
  const declared = scenario.outcomes.find((item) => item.id === id);
  if (declared === undefined) throw new Error(`the simulation fired unknown outcome "${id}"`);
  return { outcome: { id, text: declared.text, t }, injected };
}

/** R10: the events up to the first one after the outcome time; all of them without an outcome. */
function gradedEvents(
  events: readonly RecordedEvent[],
  outcome: OutcomeVerdict | null,
): readonly RecordedEvent[] {
  if (outcome === null) return events;
  const end = events.findIndex((event) => event.t > outcome.t);
  return end === -1 ? events : events.slice(0, end);
}

export function grade(original: Scenario, env: AircraftEnv, recording: Recording): GradeResult {
  if (recording.scenarioId !== original.id) {
    throw new Error(`recording is for scenario "${recording.scenarioId}", not "${original.id}"`);
  }
  // Phase 3.1: the rules below run on the scenario the recorded variant makes (V-03, V-04).
  const named = recording.variant ?? null;
  const scenario = resolveVariant(original, named?.id ?? null, recording.onset != null);
  const { outcome, injected } = replaySim(scenario, env, recording);
  const events = gradedEvents(recording.events, outcome);
  const ctx0 = startContext(scenario, env);
  const { branches, groups } = walkProcedure(scenario, ctx0, env);

  // R3: only steps of groups whose enclosing branches all apply are graded.
  const tracked = groups
    .filter((entry) => entry.graded)
    .flatMap(({ group }) =>
      group.steps.map((step) => ({
        group,
        step,
        entered: evaluatePredicate(step.done, ctx0, env) ? -1 : (null as number | null),
      })),
    );

  // R3: a forbidden item is watched only when its `when` is absent or holds at the start.
  const watched = scenario.forbidden
    .filter((item) => item.when === undefined || evaluatePredicate(item.when, ctx0, env))
    .map((item) => ({ item, active: evaluatePredicate(item.trigger, ctx0, env) }));

  // R4 and R5: replay in log order, evaluating after every event.
  const state: Record<string, string> = { ...ctx0.baseline };
  const harmful: HarmfulEntry[] = [];
  // R12: with an onset, a step that holds at the onset was reached before the failure and earns no
  // credit until the pilot has made it false and true again at or after the onset.
  const onsetAt = recording.onset?.at ?? 0;
  const preempted = new Set<string>();
  let crossed = recording.onset === undefined || recording.onset === null;
  const cross = (): void => {
    if (crossed) return;
    crossed = true;
    for (const entry of tracked) {
      if (entry.entered !== null) {
        preempted.add(entry.step.id);
        entry.entered = null;
      }
    }
  };
  // V-06: a change the simulation made by itself (a faulted control at the onset) is applied at the
  // place it happened, before the recorded event with index `before`. It is not an action of the
  // pilot: it creates no harmful entry, a step it makes true is entered at the last event before
  // it, and like an event at or after the onset it crosses the onset (R12).
  const evaluateAll = (enteredAt: number): void => {
    const ctx: PredicateContext = { ...ctx0, controls: state };
    for (const entry of tracked) {
      if (!evaluatePredicate(entry.step.done, ctx, env)) {
        entry.entered = null;
        preempted.delete(entry.step.id);
      } else if (!preempted.has(entry.step.id)) entry.entered ??= enteredAt;
    }
  };
  let nextChange = 0;
  const applyChanges = (upTo: number): void => {
    for (;;) {
      const change = injected[nextChange];
      if (change === undefined || change.before > upTo) return;
      nextChange += 1;
      cross();
      state[change.id] = change.value;
      evaluateAll(change.before - 1);
      const ctx: PredicateContext = { ...ctx0, controls: state };
      for (const entry of watched) entry.active = evaluatePredicate(entry.item.trigger, ctx, env);
    }
  };
  events.forEach((event, index) => {
    applyChanges(index);
    if (event.t >= onsetAt) cross();
    if (!Object.hasOwn(state, event.id)) {
      throw new Error(`recorded event ${String(index)} names unknown control "${event.id}"`);
    }
    state[event.id] = event.value;
    evaluateAll(index);
    const ctx: PredicateContext = { ...ctx0, controls: state };
    // A forbidden action counts when it is entered, even if it is reverted later (A5).
    for (const entry of watched) {
      const now = evaluatePredicate(entry.item.trigger, ctx, env);
      if (now && !entry.active) {
        harmful.push({
          id: entry.item.id,
          text: entry.item.text,
          t: event.t,
          seq: index,
          failsRun: entry.item.fails_run,
        });
      }
      entry.active = now;
    }
  });
  applyChanges(events.length);

  cross(); // a log that ends before the onset (R12)

  // R6: credited means the step holds after the last event.
  const steps: StepVerdict[] = tracked.map(({ group, step, entered }) => ({
    id: step.id,
    group: group.id,
    severity: step.severity,
    credited: entered !== null,
    enteredAt: entered,
    ...(preempted.has(step.id) ? { preempted: true as const } : {}),
  }));

  // R7: in an ordered group, every pair of credited steps entered against the declared order is
  // one violation.
  const orderViolations: OrderViolation[] = [];
  for (const { group } of groups) {
    if (!group.ordered) continue;
    const credited = tracked.filter((entry) => entry.group === group && entry.entered !== null);
    credited.forEach((first, i) => {
      for (const second of credited.slice(i + 1)) {
        if ((first.entered ?? 0) > (second.entered ?? 0)) {
          orderViolations.push({
            group: group.id,
            expected: first.step.id,
            before: second.step.id,
            critical: group.order_critical,
          });
        }
      }
    });
  }

  // R8 and R10: reasons in the order outcome, critical_missed, order, forbidden.
  const reasons: Reason[] = [];
  if (outcome !== null) reasons.push({ kind: 'outcome', id: outcome.id });
  const missed = steps.filter((s) => s.severity === 'critical' && !s.credited).length;
  if (missed > 0) reasons.push({ kind: 'critical_missed', count: missed });
  for (const { group } of groups) {
    if (orderViolations.some((v) => v.group === group.id && v.critical)) {
      reasons.push({ kind: 'order', group: group.id });
    }
  }
  for (const item of scenario.forbidden) {
    if (harmful.some((h) => h.id === item.id && h.failsRun)) {
      reasons.push({ kind: 'forbidden', id: item.id });
    }
  }

  // C-34: the reaction time is measured over the graded events, from the onset (0 without one).
  const first = events.find((event) => event.t >= onsetAt);
  const timing: Timing = {
    onsetAt,
    firstActionMs: first === undefined ? null : first.t - onsetAt,
  };

  return {
    scenarioId: scenario.id,
    result: reasons.length === 0 ? 'pass' : 'fail',
    reasons,
    steps,
    branches,
    orderViolations,
    harmful,
    outcome,
    timing,
    ...(named === null ? {} : { variant: named.id }),
  };
}
