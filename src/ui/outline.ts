// The view model of the checklist outline (D-23, D-25, U-14, U-17; UI-SPEC "Checklist outline").
// buildOutline turns the scenario's procedure tree into the nested items the briefing and the
// debrief render. It never evaluates a condition: every branch gets its status from the engine
// (branchStatuses, keyed by the path scheme of the decoded file) and every step its verdict from
// the GradeResult. All text comes from the scenario data.
// The checklist is shown as printed (owner decision 2026-10-23, plan 03-14): a line or step may
// carry its printed `number`, its desired `action` and its `marker`, a decision or branch its
// `marker`, and a `comment` item is a full-width printed row (optionally boxed, with a right-hand
// reference). `checklistHead` names the printed form (table or outline), heading and message tag.
// Each of these keys is present only when the scenario has the field. Nothing here is graded.
// Pure TypeScript, no DOM, no framework, no clock.

import type { BranchStatus, BranchVerdict, GradeResult, StepVerdict } from '../engine/grading';
import type { CommentStyle, MARKERS, ProcedureNode, RowMark, Scenario } from '../scenario/schema';
import { orderLine } from './debrief-text';

/**
 * The briefing lists the steps of the groups that apply as plain checklist lines; the debrief adds
 * severity tags, verdict words, muted lines and order lines.
 */
export type OutlineMode = 'briefing' | 'debrief';

export type SeverityTag = 'CRITICAL' | 'STANDARD' | 'OPTIONAL';

export type VerdictWord = 'Done' | 'Missed' | 'Not done';

/** How a verdict word is coloured; the word itself always carries the meaning. */
export type VerdictTone = 'done' | 'critical' | 'standard' | 'neutral';

export interface OutlineVerdict {
  readonly word: VerdictWord;
  readonly tone: VerdictTone;
}

/** The printed marker of an outline item; a name only, the renderer draws the shape. */
export type OutlineMarker = (typeof MARKERS)[number];

/** The printed row mark (number or letter), desired action and marker of a line or step, each only when declared. */
interface Printed {
  readonly number?: RowMark;
  readonly action?: string;
  readonly marker?: OutlineMarker;
}

/** A non-graded checklist line. `muted` lines sit under a branch that does not apply. */
export interface OutlineLine extends Printed {
  readonly kind: 'line';
  readonly text: string;
  readonly muted: boolean;
  /** True where the debrief prints "Not graded"; never on a muted line. */
  readonly notGraded: boolean;
}

/**
 * A full-width printed row between checklist rows. `action` is its right-hand reference (such as
 * a page) and `boxed` draws the printed frame. It is never graded and carries no tag or verdict.
 */
export interface OutlineComment {
  readonly kind: 'comment';
  readonly text: string;
  readonly action?: string;
  readonly boxed?: boolean;
  /** An italic sub-heading, or a WARNING or CAUTION block (its printed word is drawn above the text). */
  readonly style?: CommentStyle;
  readonly muted: boolean;
}

/** A line whose answer chooses one of its branches, which are nested directly under it. */
export interface OutlineDecision {
  readonly kind: 'decision';
  readonly marker?: OutlineMarker;
  readonly text: string;
  readonly muted: boolean;
  readonly notGraded: boolean;
  readonly branches: readonly OutlineBranch[];
}

export interface OutlineBranch {
  readonly kind: 'branch';
  readonly marker?: OutlineMarker;
  readonly label: string;
  readonly status: BranchStatus;
  readonly children: readonly OutlineItem[];
}

/**
 * A panel step. In the briefing it is a plain line (no tag, no verdict, not muted); in the debrief
 * it carries its tag and verdict, and muted steps carry neither.
 */
export interface OutlineStep extends Printed {
  readonly kind: 'step';
  readonly id: string;
  readonly text: string;
  readonly muted: boolean;
  readonly tag: SeverityTag | null;
  readonly verdict: OutlineVerdict | null;
}

/**
 * The order line under the steps of an ordered group (debrief only): "Order kept" or one
 * "Order wrong: ..." line per violation. Unordered groups and muted groups carry none.
 */
export interface OutlineOrder {
  readonly kind: 'order';
  readonly text: string;
  readonly kept: boolean;
}

export type OutlineItem =
  OutlineLine | OutlineComment | OutlineDecision | OutlineBranch | OutlineStep | OutlineOrder;

/** The printed form of the checklist, its heading and its message tag (the data of `checklist`). */
export interface ChecklistHead {
  readonly form: 'table' | 'outline';
  readonly heading?: string;
  readonly message?: string;
}

/** The form (default outline), heading and message of the scenario's checklist; keys only if declared. */
export function checklistHead(scenario: Scenario): ChecklistHead {
  const block = scenario.checklist;
  if (block === undefined) return { form: 'outline' };
  return {
    form: block.form,
    ...(block.heading === undefined ? {} : { heading: block.heading }),
    ...(block.message === undefined ? {} : { message: block.message }),
  };
}

/** The number, action and marker a node declares, as an object with only the declared keys. */
function printedOf(node: {
  readonly number?: RowMark | undefined;
  readonly action?: string | undefined;
  readonly marker?: OutlineMarker | undefined;
}): Printed {
  return {
    ...(node.number === undefined ? {} : { number: node.number }),
    ...(node.action === undefined ? {} : { action: node.action }),
    ...(node.marker === undefined ? {} : { marker: node.marker }),
  };
}

const markerOf = (marker: OutlineMarker | undefined): { readonly marker?: OutlineMarker } =>
  marker === undefined ? {} : { marker };

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
    marker: OutlineMarker | undefined,
  ): OutlineBranch => {
    const status = statusOf(path);
    // A branch that does not apply shows its label and the word only in the briefing; the debrief
    // lists its children muted.
    const children =
      status === 'not_applicable' && !debrief ? [] : build(nodes, `${path}.nodes`, status);
    return { kind: 'branch', ...markerOf(marker), label, status, children };
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
          items.push({
            kind: 'line',
            ...printedOf(node),
            text: node.text,
            muted,
            notGraded: debrief && !muted,
          });
          return;
        case 'comment':
          items.push({
            kind: 'comment',
            text: node.text,
            ...(node.action === undefined ? {} : { action: node.action }),
            ...(node.boxed === undefined ? {} : { boxed: node.boxed }),
            ...(node.style === undefined ? {} : { style: node.style }),
            muted,
          });
          return;
        case 'group':
          // Both forms list the steps at the group's level. The briefing prints them as plain
          // lines; the debrief adds tag and verdict and the order line of the group.
          for (const step of node.steps) {
            if (!debrief) {
              items.push({
                kind: 'step',
                ...printedOf(step),
                id: step.id,
                text: step.text,
                muted: false,
                tag: null,
                verdict: null,
              });
              continue;
            }
            const verdict = muted ? undefined : verdicts.get(step.id);
            items.push({
              kind: 'step',
              ...printedOf(step),
              id: step.id,
              text: step.text,
              muted: muted || verdict === undefined,
              tag: verdict === undefined ? null : TAGS[verdict.severity],
              verdict: verdict === undefined ? null : verdictOf(verdict),
            });
          }
          if (!muted && result !== undefined) {
            for (const text of orderLine(node, result)) {
              items.push({ kind: 'order', text, kept: text === 'Order kept' });
            }
          }
          return;
        case 'branch':
          items.push(buildBranch(node.label, here, node.nodes, node.marker));
          return;
        case 'decision':
          items.push({
            kind: 'decision',
            ...markerOf(node.marker),
            text: node.text,
            muted,
            notGraded: debrief && !muted,
            branches: node.branches.map((branch, j) =>
              buildBranch(
                branch.label,
                `${here}.branches.${String(j)}`,
                branch.nodes,
                branch.marker,
              ),
            ),
          });
          return;
      }
    });
    return items;
  };

  return build(scenario.procedure, 'procedure', 'applies');
}
