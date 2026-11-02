// Further actions (Phase 7, SES-05, D-06 to D-11): the decisions of a situation that are not panel
// actions (inform ATC, brief passengers, the further flight conduct). The aircraft owns the fixed
// list (src/aircraft/da50rg/further.ts, read through AircraftEnv.further); a scenario declares in
// its optional `further` section the role of each action and the conduct that is right; a run logs
// each pick as a decision { t, id } in the recording. `gradeFurther` is the pure part of the
// grading: grade calls it and adds the reasons in the order of D-11. Nothing here knows an option
// id or a text; the engine only reads the set.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { FurtherRole, FurtherSection } from '../scenario/schema';

export const FURTHER_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

/** An option is an action (graded by its role) or a flight conduct (graded by the accept list). */
export type FurtherKind = 'action' | 'conduct';

export interface FurtherOption {
  readonly id: string;
  /** The text of the row in the debrief. */
  readonly text: string;
  /** The static caps label of the button in the footwell cluster (Phase 7, R-07); the text stays for the debrief. */
  readonly label?: string;
  readonly kind: FurtherKind;
  /**
   * True for an action the verdict never depends on (brief passengers): lint L27 rejects the roles
   * `required` and `harmful` for it, so it can neither be missed nor fail a run. Actions only.
   */
  readonly unrated?: boolean;
  /** A line the debrief adds when this option is the last conduct pick. */
  readonly debriefNote?: string;
}

export interface FurtherDefinition {
  readonly options: readonly FurtherOption[];
  /** The title of the conduct row of the debrief ("Choose further flight conduct"). */
  readonly conductTitle: string;
  /** The profile parameter that puts the aircraft on the ground: a scenario with it above 0 has no conduct. */
  readonly groundParameter: string;
}

export interface FurtherSet extends FurtherDefinition {
  has(id: string): boolean;
  option(id: string): FurtherOption | undefined;
  /** The ids of the options of one kind, in list order. */
  ids(kind: FurtherKind): readonly string[];
}

export class FurtherError extends Error {}

export function defineFurther(definition: FurtherDefinition): FurtherSet {
  const byId = new Map<string, FurtherOption>();
  for (const option of definition.options) {
    if (!FURTHER_ID_PATTERN.test(option.id)) {
      throw new FurtherError(
        `option id "${option.id}" does not match ${FURTHER_ID_PATTERN.source}`,
      );
    }
    if (byId.has(option.id)) throw new FurtherError(`option "${option.id}" is defined twice`);
    if (option.unrated === true && option.kind !== 'action') {
      throw new FurtherError(`option "${option.id}" is a conduct and cannot be unrated`);
    }
    if (option.debriefNote !== undefined && option.kind !== 'conduct') {
      throw new FurtherError(`option "${option.id}" is an action and cannot carry a debrief note`);
    }
    byId.set(option.id, option);
  }
  if (!FURTHER_ID_PATTERN.test(definition.groundParameter)) {
    throw new FurtherError(`the ground parameter "${definition.groundParameter}" is not an id`);
  }
  return Object.freeze({
    options: Object.freeze([...definition.options]),
    conductTitle: definition.conductTitle,
    groundParameter: definition.groundParameter,
    has: (id: string) => byId.has(id),
    option: (id: string) => byId.get(id),
    ids: (kind: FurtherKind) =>
      definition.options.filter((option) => option.kind === kind).map((option) => option.id),
  });
}

/**
 * One press of a footwell button: the run time it was made at, the option id and whether it switched
 * the option on. `on` is absent in every recording made before the toggles (R-08) and then means on;
 * only the value false switches off (T-07-12).
 */
export interface RecordedDecision {
  readonly t: number;
  readonly id: string;
  readonly on?: boolean;
}

/** What the recorded presses add up to: the actions switched on and the conduct selected (R-08). */
export interface FurtherSelection {
  /** The action ids whose last entry is on. */
  readonly actions: ReadonlySet<string>;
  /** The selected conduct id, null when none or cleared. */
  readonly conduct: string | null;
}

/**
 * The state the presses leave (R-08), one helper for the grade, the session and the buttons so the
 * highlight and the verdict can never disagree. An action is selected when its last entry is on. The
 * conduct is replayed in order: an on entry selects that option (another one switches), an off entry
 * clears the selection only when it names the selected option. An unknown id is skipped here (the
 * grader throws for it before it gets this far).
 */
export function effectiveSelection(
  decisions: readonly RecordedDecision[],
  set: FurtherSet,
): FurtherSelection {
  const actions = new Set<string>();
  let conduct: string | null = null;
  for (const decision of decisions) {
    const option = set.option(decision.id);
    if (option === undefined) continue;
    const on = decision.on !== false;
    if (option.kind === 'action') {
      if (on) actions.add(decision.id);
      else actions.delete(decision.id);
    } else if (on) {
      conduct = decision.id;
    } else if (conduct === decision.id) {
      conduct = null;
    }
  }
  return { actions, conduct };
}

/** The accepted conduct ids of a section, or null when the section says none or does not exist. */
export function conductAccept(section: FurtherSection | undefined): readonly string[] | null {
  if (section === undefined || section.conduct === 'none') return null;
  return section.conduct.accept;
}

/** True when a scenario offers a flight conduct decision (it declares `accept`). */
export function offersConduct(section: FurtherSection | undefined): boolean {
  return conductAccept(section) !== null;
}

export interface FurtherActionVerdict {
  readonly id: string;
  readonly role: FurtherRole;
  readonly done: boolean;
  readonly failsRun: boolean;
}

export type ConductStatus = 'not_declared' | 'ok' | 'missing' | 'wrong';

export interface FurtherConductVerdict {
  /** What the scenario declares: `none`, `accept`, or null when it has no section. */
  readonly declared: 'none' | 'accept' | null;
  /** Every conduct option switched on, in the order made (the history the debrief shows). */
  readonly picks: readonly string[];
  /** The selection at the end, which is the one that counts; null without one or when cleared. */
  readonly last: string | null;
  readonly status: ConductStatus;
}

export interface FurtherResult {
  /** One entry per declared or picked action, in the list order of the aircraft. */
  readonly actions: readonly FurtherActionVerdict[];
  readonly conduct: FurtherConductVerdict;
}

/** The reasons further actions add to a verdict, split at the place D-11 puts them. */
export type FurtherReason =
  | { readonly kind: 'further_missed'; readonly count: number }
  | { readonly kind: 'conduct'; readonly status: 'missing' | 'wrong' }
  | { readonly kind: 'further_harmful'; readonly id: string };

export interface FurtherGrade {
  /** Absent (undefined) when the scenario has no section and the recording has no decision. */
  readonly result: FurtherResult | undefined;
  /** After critical_missed and before order: further_missed, then conduct. */
  readonly early: readonly FurtherReason[];
  /** After forbidden: further_harmful. */
  readonly late: readonly FurtherReason[];
}

/**
 * R16 to R18: the decisions of a recording against the section of the scenario. A decision after the
 * outcome time is not graded (like an event, R10); an id the aircraft does not have throws (like an
 * unknown control). The state the presses leave counts (R-08): an action is done when its last entry
 * is on; the conduct is graded by the selection at the end.
 */
export function gradeFurther(
  section: FurtherSection | undefined,
  set: FurtherSet,
  decisions: readonly RecordedDecision[] | undefined,
  outcomeAt: number | null,
): FurtherGrade {
  const all = decisions ?? [];
  all.forEach((decision, index) => {
    if (!set.has(decision.id)) {
      throw new Error(`recorded decision ${String(index)} names unknown option "${decision.id}"`);
    }
  });
  const counted = all.filter((decision) => outcomeAt === null || decision.t <= outcomeAt);
  if (section === undefined && counted.length === 0) {
    return { result: undefined, early: [], late: [] };
  }

  const selection = effectiveSelection(counted, set);
  const picked = selection.actions;
  const declared = new Map((section?.actions ?? []).map((entry) => [entry.id, entry]));
  const actions: FurtherActionVerdict[] = [];
  for (const id of set.ids('action')) {
    const entry = declared.get(id);
    if (entry === undefined && !picked.has(id)) continue;
    const role: FurtherRole = entry?.role ?? 'optional';
    actions.push({
      id,
      role,
      done: picked.has(id),
      failsRun: role === 'harmful' && entry?.fails_run === true,
    });
  }

  const picks = counted
    .filter((d) => set.option(d.id)?.kind === 'conduct' && d.on !== false)
    .map((d) => d.id);
  const last = selection.conduct;
  const accept = conductAccept(section);
  let status: ConductStatus = 'not_declared';
  if (accept !== null) {
    status = last === null ? 'missing' : accept.includes(last) ? 'ok' : 'wrong';
  }
  const conduct: FurtherConductVerdict = {
    declared: section === undefined ? null : accept === null ? 'none' : 'accept',
    picks,
    last,
    status,
  };

  const early: FurtherReason[] = [];
  const missed = actions.filter((a) => a.role === 'required' && !a.done).length;
  if (missed > 0) early.push({ kind: 'further_missed', count: missed });
  if (status === 'missing' || status === 'wrong') early.push({ kind: 'conduct', status });
  const late: FurtherReason[] = actions
    .filter((a) => a.done && a.failsRun)
    .map((a) => ({ kind: 'further_harmful', id: a.id }));

  return { result: { actions, conduct }, early, late };
}
