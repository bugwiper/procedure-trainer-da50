// The copy rules of the debrief (UI-SPEC "Debrief" and Copywriting Contract, D-10 to D-12, D-16):
// reason lines, the m:ss clock, the order line of an ordered group and the harmful-action row.
// Pure functions of the GradeResult and the scenario data; no score and no timeline anywhere.
// Pure TypeScript, no DOM, no framework, no clock.

import type { GradeResult, HarmfulEntry, Reason } from '../engine/grading';
import type { Group } from '../scenario/schema';

function reasonLine(reason: Reason): string {
  switch (reason.kind) {
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
    const line = reasonLine(reason);
    if (!lines.includes(line)) lines.push(line);
  }
  return lines;
}

/** Whole seconds, rounded down, as m:ss (0 gives 0:00, 65999 gives 1:05). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
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

/** One row of the harmful section: the text and the virtual-clock time of the action. */
export function harmfulLine(entry: HarmfulEntry): string {
  return `${entry.text} at ${formatClock(entry.t)}`;
}
