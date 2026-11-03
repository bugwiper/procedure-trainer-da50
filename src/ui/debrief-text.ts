// The copy rules of the debrief (UI-SPEC "Debrief" and Copywriting Contract, D-10 to D-12, D-16):
// reason lines, the order line of an ordered group, the harmful-action row and, for a realistic
// run only, the one time line (the first action measured from the onset, D-05). Pure functions of
// the GradeResult and the scenario data; no score and no timeline anywhere.
// Pure TypeScript, no DOM, no framework, no clock.

import type { FurtherSet } from '../engine/further';
import type { GradeResult, HarmfulEntry, Reason } from '../engine/grading';
import { MAX_RUN_MS } from '../engine/sim';
import type { FurtherSection, Group, Scenario } from '../scenario/schema';

function reasonLine(reason: Reason, result: GradeResult): string {
  switch (reason.kind) {
    case 'outcome':
      return `The failure escalated: ${result.outcome?.text ?? reason.id}.`;
    case 'critical_missed': {
      const base =
        reason.count === 1
          ? '1 critical step was missed.'
          : `${String(reason.count)} critical steps were missed.`;
      // R12: steps done before the onset do not count; say so instead of leaving the pilot guessing.
      return result.steps.some((step) => step.preempted === true)
        ? `${base} Steps done before the onset do not count.`
        : base;
    }
    case 'further_missed':
      return reason.count === 1
        ? '1 required further action was missed.'
        : `${String(reason.count)} required further actions were missed.`;
    case 'conduct':
      return 'The flight decision was not the right one.';
    case 'order':
      return 'Steps were done in the wrong order.';
    case 'forbidden':
    case 'further_harmful':
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

/**
 * The cause line of a debrief (V-08): "Cause: " and the own-wording line of the variant the run
 * drew, or null when the recording names none. Only the debrief shows it; the briefing and the
 * panel never name the cause.
 */
export function causeLine(scenario: Scenario, result: GradeResult): string | null {
  if (result.variant === undefined) return null;
  const variant = scenario.variants.find((item) => item.id === result.variant);
  return variant === undefined ? null : `Cause: ${variant.debrief}`;
}

/**
 * The line of a run the 30-minute cap ended (WR-05, V-14): "The run reached the 30 minute limit.",
 * or null when the run ended earlier. The minutes come from MAX_RUN_MS.
 */
export function limitLine(completedAt: number): string | null {
  if (completedAt < MAX_RUN_MS) return null;
  return `The run reached the ${String(MAX_RUN_MS / 60_000)} minute limit.`;
}

/** One row of the Further actions section of the debrief (Phase 7, R19): what, its role and how it went. */
export interface FurtherRow {
  /** The option id, or `conduct` for the flight decision. */
  readonly id: string;
  readonly label: string;
  /** Required, Recommended, Optional or Harmful; null on the flight decision of a scenario without a declaration. */
  readonly role: string | null;
  readonly verdict: string;
  /** The colour class of the verdict word, as the step verdicts of the outline use them. */
  readonly tone: 'done' | 'critical' | 'standard' | 'neutral';
  /** The conduct row only: what was picked, with the earlier picks in the order made; null without a pick. */
  readonly picks: string | null;
}

const ROLE_WORDS = {
  required: 'Required',
  recommended: 'Recommended',
  optional: 'Optional',
  harmful: 'Harmful',
} as const;

/**
 * The rows of the Further actions section, in the list order of the aircraft and the flight decision
 * last; empty when the result carries no `further` entry or nothing to show (a scenario that
 * declares conduct none and has no action row). The verdict words: Done, Missed (required, not
 * done), Recommended and not done, Not done (optional or harmful, not done), Harmful (a harmful
 * action that was done), Right and Wrong for the flight decision (the preselected "continue
 * normally" counts as the pick when the pilot never switched), Not graded for a pick the scenario
 * does not grade.
 */
export function furtherRows(result: GradeResult, set: FurtherSet): FurtherRow[] {
  const { further } = result;
  if (further === undefined) return [];
  const textOf = (id: string): string => set.option(id)?.text ?? id;
  // An action the final conduct greys out (the Avoid picks under the emergency landing) is ignored
  // here; the grade and the log keep it, and it counts again if the conduct is switched back.
  const shown = further.actions.filter((entry) => !set.isBlocked(entry.id, further.conduct.last));
  const rows: FurtherRow[] = shown.map((entry) => {
    let verdict: string;
    let tone: FurtherRow['tone'] = 'neutral';
    if (entry.role === 'harmful') {
      verdict = entry.done ? 'Harmful' : 'Not done';
      if (entry.done) tone = 'critical';
    } else if (entry.done) {
      verdict = 'Done';
      tone = 'done';
    } else if (entry.role === 'required') {
      verdict = 'Missed';
      tone = 'critical';
    } else if (entry.role === 'recommended') {
      verdict = 'Recommended and not done';
      tone = 'standard';
    } else verdict = 'Not done';
    return {
      id: entry.id,
      label: textOf(entry.id),
      role: ROLE_WORDS[entry.role],
      verdict,
      tone,
      picks: null,
    };
  });
  const { conduct } = further;
  if (conduct.declared === 'accept' || conduct.picks.length > 0) {
    const verdict =
      conduct.status === 'ok' ? 'Right' : conduct.status === 'wrong' ? 'Wrong' : 'Not graded';
    rows.push({
      id: 'conduct',
      label: set.conductTitle,
      role: conduct.declared === 'accept' ? ROLE_WORDS.required : null,
      verdict,
      tone:
        conduct.status === 'ok'
          ? 'done'
          : conduct.status === 'not_declared'
            ? 'neutral'
            : 'critical',
      picks:
        conduct.picks.length === 0
          ? null
          : conduct.picks.length === 1
            ? `Picked: ${textOf(conduct.picks.join(''))}`
            : `Picks in order: ${conduct.picks.map(textOf).join(', then ')}`,
    });
  }
  return rows;
}

/** The note the aircraft data attaches to the last conduct pick (the emergency landing), or null. */
export function furtherNote(result: GradeResult, set: FurtherSet): string | null {
  const last = result.further?.conduct.last ?? null;
  if (last === null) return null;
  return set.option(last)?.debriefNote ?? null;
}

/**
 * The neutral line a Realistic debrief adds under "Checklist used" when the checklist the pilot
 * chose is not the one of the situation (plan 07-06, R-24), or null (no choice, or the own checklist).
 * Display only: it never touches PASS or FAIL.
 */
export function checklistNote(
  choice: { readonly ref: { readonly pack: string; readonly scenario: string } } | null,
  ownRef: { readonly pack: string; readonly scenario: string } | null,
  title: string,
): string | null {
  if (choice === null || ownRef === null) return null;
  if (choice.ref.pack === ownRef.pack && choice.ref.scenario === ownRef.scenario) return null;
  return `The situation was ${title}. The checklist you used belongs to another situation; the harmful actions below still list what was wrong for the real one.`;
}

/**
 * The conduct note of the debrief (plan 07-06, R-22): a hint outside the verdict, never changing PASS
 * or FAIL. Present only when the scenario carries a `conduct_note` and the conduct selected at the end
 * is the one the aircraft names (`noteConduct`, continue to destination). Tone `standard` (yellow): the
 * note and, when not every Avoid action was selected at the end, one line "Not chosen: ..." with the
 * texts of the missing ones. Tone `done` (green): when all of them were selected, one positive line
 * instead. Null for any other final conduct, a scenario without a note, or a result without a
 * further part.
 */
export interface ConductNote {
  readonly tone: 'standard' | 'done';
  readonly lines: readonly string[];
}

/** "A", "A and B", "A, B and C". */
const joinWords = (items: readonly string[]): string =>
  items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;

export function conductNote(
  result: GradeResult,
  section: FurtherSection | undefined,
  set: FurtherSet,
): ConductNote | null {
  const note = section?.conduct_note;
  if (note === undefined || result.further === undefined) return null;
  if (result.further.conduct.last !== set.noteConduct) return null;
  const avoid = set.avoidIds();
  const done = new Set(result.further.actions.filter((a) => a.done).map((a) => a.id));
  const textOf = (id: string): string => set.option(id)?.text ?? id;
  const missing = avoid.filter((id) => !done.has(id));
  if (avoid.length > 0 && missing.length === 0) {
    return {
      tone: 'done',
      lines: [`You also chose ${joinWords(avoid.map(textOf))}, which fits continuing under VFR.`],
    };
  }
  return {
    tone: 'standard',
    lines: [
      note,
      ...(missing.length === 0 ? [] : [`Not chosen: ${missing.map(textOf).join(', ')}.`]),
    ],
  };
}
