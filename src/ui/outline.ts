// The view model of the checklist outline (D-23, D-25, U-14, U-17; UI-SPEC "Checklist outline").
// buildOutline turns the scenario's procedure tree into the nested items the briefing and the
// debrief render. It never evaluates a condition: every branch gets its status from the engine
// (branchStatuses, keyed by the path scheme of the decoded file) and every step its verdict from
// the GradeResult. All text comes from the scenario data.
// Pure TypeScript, no DOM, no framework, no clock.

import type { BranchStatus, BranchVerdict, GradeResult, StepVerdict } from '../engine/grading';
import type { ProcedureNode, Scenario } from '../scenario/schema';

/** The briefing hides every graded step; the debrief shows them with their verdicts. */
export type OutlineMode = 'briefing' | 'debrief';

export type SeverityTag = 'CRITICAL' | 'STANDARD' | 'OPTIONAL';

export type VerdictWord = 'Done' | 'Missed' | 'Not done';

/** How a verdict word is coloured; the word itself always carries the meaning. */
export type VerdictTone = 'done' | 'critical' | 'standard' | 'neutral';

export interface OutlineVerdict {
  readonly word: VerdictWord;
  readonly tone: VerdictTone;
}

/** A non-graded checklist line. `muted` lines sit under a branch that does not apply. */
export interface OutlineLine {
  readonly kind: 'line';
  readonly text: string;
  readonly muted: boolean;
  /** True where the debrief prints "Not graded"; never on a muted line. */
  readonly notGraded: boolean;
}

/** A line whose answer chooses one of its branches, which are nested directly under it. */
export interface OutlineDecision {
  readonly kind: 'decision';
  readonly text: string;
  readonly muted: boolean;
  readonly notGraded: boolean;
  readonly branches: readonly OutlineBranch[];
}

export interface OutlineBranch {
  readonly kind: 'branch';
  readonly label: string;
  readonly status: BranchStatus;
  readonly children: readonly OutlineItem[];
}

/** A graded step (debrief only). Muted steps carry neither tag nor verdict. */
export interface OutlineStep {
  readonly kind: 'step';
  readonly id: string;
  readonly text: string;
  readonly muted: boolean;
  readonly tag: SeverityTag | null;
  readonly verdict: OutlineVerdict | null;
}

export type OutlineItem = OutlineLine | OutlineDecision | OutlineBranch | OutlineStep;

const TAGS: Readonly<Record<StepVerdict['severity'], SeverityTag>> = {
  critical: 'CRITICAL',
  standard: 'STANDARD',
  optional: 'OPTIONAL',
};

/** Done when credited; Missed (critical or standard) or Not done (optional) when not. */
export function verdictOf(step: StepVerdict): OutlineVerdict {
  if (step.credited) return { word: 'Done', tone: 'done' };
  if (step.severity === 'critical') return { word: 'Missed', tone: 'critical' };
  if (step.severity === 'standard') return { word: 'Missed', tone: 'standard' };
  return { word: 'Not done', tone: 'neutral' };
}

/**
 * The outline of a scenario in the briefing or the debrief form (Table O1).
 * `branches` are the statuses from branchStatuses (or GradeResult.branches); `result` is required
 * for the debrief form and ignored by the briefing.
 */
export function buildOutline(
  scenario: Scenario,
  branches: readonly BranchVerdict[],
  mode: OutlineMode,
  result?: GradeResult,
): OutlineItem[] {
  if (mode === 'debrief' && result === undefined) {
    throw new Error('the debrief outline needs the grade result');
  }
  const statusAt = new Map(branches.map((b) => [b.path, b.status]));
  const verdicts = new Map((result?.steps ?? []).map((s) => [s.id, s]));
  const debrief = mode === 'debrief';

  const statusOf = (path: string): BranchStatus => {
    const status = statusAt.get(path);
    if (status === undefined) throw new Error(`no branch status for ${path}`);
    return status;
  };

  const buildBranch = (
    label: string,
    path: string,
    nodes: readonly ProcedureNode[],
  ): OutlineBranch => {
    const status = statusOf(path);
    // A branch that does not apply shows its label and the word only in the briefing (the children
    // may hold panel steps); the debrief lists them muted.
    const children =
      status === 'not_applicable' && !debrief ? [] : build(nodes, `${path}.nodes`, status);
    return { kind: 'branch', label, status, children };
  };

  const build = (
    nodes: readonly ProcedureNode[],
    path: string,
    parent: BranchStatus,
  ): OutlineItem[] => {
    const muted = parent === 'not_applicable';
    const items: OutlineItem[] = [];
    nodes.forEach((node, i) => {
      const here = `${path}.${String(i)}`;
      switch (node.kind) {
        case 'line':
          items.push({ kind: 'line', text: node.text, muted, notGraded: debrief && !muted });
          return;
        case 'group':
          // The briefing omits the group with all its steps (exam rule); the debrief lists the
          // steps at the group's level.
          if (!debrief) return;
          for (const step of node.steps) {
            const verdict = muted ? undefined : verdicts.get(step.id);
            items.push({
              kind: 'step',
              id: step.id,
              text: step.text,
              muted: muted || verdict === undefined,
              tag: verdict === undefined ? null : TAGS[verdict.severity],
              verdict: verdict === undefined ? null : verdictOf(verdict),
            });
          }
          return;
        case 'branch':
          items.push(buildBranch(node.label, here, node.nodes));
          return;
        case 'decision':
          items.push({
            kind: 'decision',
            text: node.text,
            muted,
            notGraded: debrief && !muted,
            branches: node.branches.map((branch, j) =>
              buildBranch(branch.label, `${here}.branches.${String(j)}`, branch.nodes),
            ),
          });
          return;
      }
    });
    return items;
  };

  return build(scenario.procedure, 'procedure', 'applies');
}
