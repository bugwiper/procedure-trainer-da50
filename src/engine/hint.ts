// The training hint (Phase 7, SES-02, D-04, H-01): which checklist step is the next one the pilot has
// not done yet. It is the grade of the partial recording, read for its first open step, so it can
// never disagree with the debrief and adds nothing of its own: the stored row mark, text and action
// of the scenario file are returned untouched (checklist text is reproduced as printed and never
// reworded). Optional steps are never named, a branch that does not apply has no graded steps, and a
// step that already held when the failure began and was not redone is still open (rule R12), because
// that is what grade says. Pure TypeScript, no DOM, no framework, no clock, no state: the same
// scenario and recording always give the same answer, and calling it changes nothing.

import type { ProcedureNode, RowMark, Scenario, Step } from '../scenario/schema';
import type { AircraftEnv } from './env';
import { grade } from './grading';
import type { Recording } from './grading';

/** The next open step as printed: its row mark and desired action only when the file declares them. */
export interface OpenStep {
  readonly id: string;
  readonly number?: RowMark;
  readonly text: string;
  readonly action?: string;
}

/** What the verdict still waits for besides the checklist steps (IN-02); derived from the grade. */
export interface OpenFurther {
  /** Required further actions not picked yet. */
  readonly actions: number;
  /** The flight conduct is declared and not (rightly) chosen. */
  readonly conduct: boolean;
}

/**
 * The required further actions and the flight conduct that still fail the run in `recording`. A
 * scenario without a `further` section has none. Reads only the grade, so it never disagrees with
 * the debrief, and names no option id.
 */
export function openFurtherItems(
  scenario: Scenario,
  env: AircraftEnv,
  recording: Recording,
): OpenFurther {
  const further = grade(scenario, env, recording).further;
  if (further === undefined) return { actions: 0, conduct: false };
  return {
    actions: further.actions.filter((entry) => entry.role === 'required' && !entry.done).length,
    conduct: further.conduct.status === 'missing' || further.conduct.status === 'wrong',
  };
}

/** The step with this id: a depth-first walk over groups, branches and decisions. */
function findStep(nodes: readonly ProcedureNode[], id: string): Step | undefined {
  for (const node of nodes) {
    let found: Step | undefined;
    switch (node.kind) {
      case 'line':
      case 'comment':
        break;
      case 'group':
        found = node.steps.find((step) => step.id === id);
        break;
      case 'branch':
        found = findStep(node.nodes, id);
        break;
      case 'decision':
        for (const branch of node.branches) {
          found ??= findStep(branch.nodes, id);
        }
        break;
    }
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * The first graded step, in declared order, of severity critical or standard that is not credited
 * in `recording`, or null when none is open. Throws what `grade` throws (a recording for another
 * scenario, an unknown control).
 */
export function nextOpenStep(
  scenario: Scenario,
  env: AircraftEnv,
  recording: Recording,
): OpenStep | null {
  const result = grade(scenario, env, recording);
  const open = result.steps.find((entry) => entry.severity !== 'optional' && !entry.credited);
  if (open === undefined) return null;
  const step = findStep(scenario.procedure, open.id);
  if (step === undefined) throw new Error(`the graded step "${open.id}" is not in the scenario`);
  return {
    id: step.id,
    ...(step.number === undefined ? {} : { number: step.number }),
    text: step.text,
    ...(step.action === undefined ? {} : { action: step.action }),
  };
}
