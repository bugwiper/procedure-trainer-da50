// The copy rules of the debrief (UI-SPEC "Debrief" and Copywriting Contract, D-10 to D-12, D-16):
// reason lines, the order line of an ordered group, the harmful-action row and, for a realistic
// run only, the one time line (the first action measured from the onset, D-05). Pure functions of
// the GradeResult and the scenario data; no score and no timeline anywhere.
// Pure TypeScript, no DOM, no framework, no clock.

import type { GradeResult, HarmfulEntry, Reason } from '../engine/grading';
import type { Group } from '../scenario/schema';

function reasonLine(reason: Reason, result: GradeResult): string {
  switch (reason.kind) {
    case 'outcome':
      return `The failure escalated: ${result.outcome?.text ?? reason.id}.`;
    case 'critical_missed':
      return reason.count === 1
        ? '1 critical step was missed.'
        : `${String(reason.count)} critical steps were missed.`;
    case 'order':
      return 'Steps were done in the wrong order.';
    case 'forbidden':
      return 'A harmful action counts as a fail in this scenario.';
  }
}

/** PASS: one line. FAIL: one line per cause in reason order, each cause once. */
export function reasonLines(result: GradeResult): string[] {
  if (result.result === 'pass') return ['All critical steps done.'];
  const lines: string[] = [];
  for (const reason of result.reasons) {
    const line = reasonLine(reason, result);
    if (!lines.includes(line)) lines.push(line);
  }
  return lines;
}

/**
 * The order lines under a group: none for an unordered group, "Order kept" for an ordered group
 * without violation, else one "Order wrong: ..." line per violation, in result order.
 */
export function orderLine(group: Group, result: GradeResult): string[] {
  if (!group.ordered) return [];
  const textOf = (id: string): string => group.steps.find((s) => s.id === id)?.text ?? id;
  const violations = result.orderViolations.filter((v) => v.group === group.id);
  if (violations.length === 0) return ['Order kept'];
  return violations.map(
    (v) => `Order wrong: ${textOf(v.expected)} was expected before ${textOf(v.before)}`,
  );
}

/**
 * One row of the harmful section: the text of the item only. The GradeResult keeps the virtual
 * time of the action (replay identity); a time display returns with the time limits of Phase 3.
 */
export function harmfulLine(entry: HarmfulEntry): string {
  return entry.text;
}

/**
 * The reaction-time line of a realistic debrief (D-05, C-34): the first action measured from the
 * onset, with one decimal, or that there was none. Display only; no limit exists.
 */
export function timingLine(result: GradeResult): string {
  const { firstActionMs } = result.timing;
  if (firstActionMs === null) return 'No action after the onset.';
  return `First action ${(firstActionMs / 1000).toFixed(1)} s after the onset.`;
}
