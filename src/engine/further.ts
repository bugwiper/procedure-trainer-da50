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
  /**
   * True for an Avoid action (plan 07-06, R-21): it qualifies
   * the decision to continue, so it is drawn only where a flight conduct is offered, never required
   * and never failing (it must be `unrated`), and the debrief lists it only when it was picked.
   */
  readonly avoid?: true;
  /** A line the debrief adds when this option is the last conduct pick. */
  readonly debriefNote?: string;
  /**
   * The conduct options that grey this action out (owner decision 2026-11-03: with the emergency
   * landing selected the pilot cannot avoid icing or night VFR any more). While the selected conduct
   * is one of them the button is shown disabled and a press is ignored; the recorded picks stay in
   * the log and the selection, the debrief ignores them, and they count again once the conduct is
   * switched back. Actions only; every id must name a conduct option.
   */
  readonly blockedByConduct?: readonly string[];
}

export interface FurtherDefinition {
  readonly options: readonly FurtherOption[];
  /** The title of the conduct row of the debrief ("Choose further flight conduct"). */
  readonly conductTitle: string;
  /** The profile parameter that puts the aircraft on the ground: a scenario with it above 0 has no conduct. */
  readonly groundParameter: string;
  /**
   * The conduct option that is selected when a run starts, without any press (owner decision
   * 2026-11-02: "Continue to destination" is preselected, the pilot deviates by pressing another one). It
   * counts like a pick. Must name an option of kind `conduct`.
   */
  readonly defaultConduct: string;
  /**
   * The conduct option the conduct note of a scenario speaks of (plan 07-06, R-22): "Continue to
   * destination". Must name an option of kind `conduct`. Lint L31 rejects a `conduct_note` in a
   * scenario whose `accept` list lacks it.
   */
  readonly noteConduct: string;
}

export interface FurtherSet extends FurtherDefinition {
  has(id: string): boolean;
  option(id: string): FurtherOption | undefined;
  /** The ids of the options of one kind, in list order. */
  ids(kind: FurtherKind): readonly string[];
  /** The ids of the Avoid actions, in list order. */
  avoidIds(): readonly string[];
  /** True when the selected conduct (null: none) greys the option out (`blockedByConduct`). */
  isBlocked(id: string, conduct: string | null): boolean;
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
    if (option.avoid === true && (option.kind !== 'action' || option.unrated !== true)) {
      throw new FurtherError(
        `option "${option.id}" is an avoid action and must be an unrated action`,
      );
    }
    if (option.debriefNote !== undefined && option.kind !== 'conduct') {
      throw new FurtherError(`option "${option.id}" is an action and cannot carry a debrief note`);
    }
    if (option.blockedByConduct !== undefined && option.kind !== 'action') {
      throw new FurtherError(`option "${option.id}" is a conduct and cannot be blocked by one`);
    }
    byId.set(option.id, option);
  }
  for (const option of definition.options) {
    for (const conductId of option.blockedByConduct ?? []) {
      if (byId.get(conductId)?.kind !== 'conduct') {
        throw new FurtherError(
          `option "${option.id}" is blocked by "${conductId}", which is not a conduct option`,
        );
      }
    }
  }
  if (!FURTHER_ID_PATTERN.test(definition.groundParameter)) {
    throw new FurtherError(`the ground parameter "${definition.groundParameter}" is not an id`);
  }
  if (byId.get(definition.defaultConduct)?.kind !== 'conduct') {
    throw new FurtherError(
      `the default conduct "${definition.defaultConduct}" is not a conduct option`,
    );
  }
  if (byId.get(definition.noteConduct)?.kind !== 'conduct') {
    throw new FurtherError(`the note conduct "${definition.noteConduct}" is not a conduct option`);
  }
  return Object.freeze({
    options: Object.freeze([...definition.options]),
    conductTitle: definition.conductTitle,
    groundParameter: definition.groundParameter,
    defaultConduct: definition.defaultConduct,
    noteConduct: definition.noteConduct,
    has: (id: string) => byId.has(id),
    option: (id: string) => byId.get(id),
    ids: (kind: FurtherKind) =>
      definition.options.filter((option) => option.kind === kind).map((option) => option.id),
    avoidIds: () => definition.options.filter((option) => option.avoid === true).map((o) => o.id),
    isBlocked: (id: string, conduct: string | null) =>
      conduct !== null && (byId.get(id)?.blockedByConduct?.includes(conduct) ?? false),
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
  /**
   * The selected conduct id: the aircraft's default while no press changed it, null when the
   * scenario offers no conduct and nothing was picked.
   */
  readonly conduct: string | null;
  /**
   * Every conduct selection in the order made, starting with the preselected default when a conduct
   * is offered (R-08); an entry that names the selected option again is no change and adds nothing.
   */
  readonly picks: readonly string[];
}

/**
 * The state the presses leave (R-08), one helper for the grade, the session and the buttons so the
 * highlight and the verdict can never disagree. An action is selected when its last entry is on. The
 * conduct is a radio group that always has one selection where a conduct is offered: it starts at
 * the default of the aircraft (no log entry), an on entry selects that option (another one
 * switches, the selected one again is no change), and an off entry (recordings made while a conduct
 * could still be cleared) falls back to the default. Where no conduct is offered nothing is
 * preselected. An unknown id is skipped here (the grader throws for it before it gets this far).
 */
export function effectiveSelection(
  decisions: readonly RecordedDecision[],
  set: FurtherSet,
  conductOffered: boolean,
): FurtherSelection {
  const actions = new Set<string>();
  const start = conductOffered ? set.defaultConduct : null;
  let conduct: string | null = start;
  const picks: string[] = start === null ? [] : [start];
  for (const decision of decisions) {
    const option = set.option(decision.id);
    if (option === undefined) continue;
    const on = decision.on !== false;
    if (option.kind === 'action') {
      if (on) actions.add(decision.id);
      else actions.delete(decision.id);
    } else if (on) {
      if (conduct !== decision.id) picks.push(decision.id);
      conduct = decision.id;
    } else if (conduct === decision.id && start !== conduct) {
      conduct = start;
      if (start !== null) picks.push(start);
    }
  }
  return { actions, conduct, picks };
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

/**
 * `missing` no longer exists: where a conduct is offered it always has a selection (the default
 * counts like a pick), so a run is either right or wrong.
 */
export type ConductStatus = 'not_declared' | 'ok' | 'wrong';

export interface FurtherConductVerdict {
  /** What the scenario declares: `none`, `accept`, or null when it has no section. */
  readonly declared: 'none' | 'accept' | null;
  /**
   * Every conduct selection in the order made (the history the debrief shows); where a conduct is
   * offered it starts with the preselected default.
   */
  readonly picks: readonly string[];
  /** The selection at the end, which is the one that counts; null only where no conduct is offered and none was picked. */
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
  | { readonly kind: 'conduct'; readonly status: 'wrong' }
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
 * is on; the conduct is graded by the selection at the end, and the preselected default counts like a
 * pick (a scenario that does not accept it fails with the reason `wrong` when the pilot never switches).
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

  const accept = conductAccept(section);
  const selection = effectiveSelection(counted, set, accept !== null);
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

  const last = selection.conduct;
  let status: ConductStatus = 'not_declared';
  if (accept !== null) {
    status = last !== null && accept.includes(last) ? 'ok' : 'wrong';
  }
  const conduct: FurtherConductVerdict = {
    declared: section === undefined ? null : accept === null ? 'none' : 'accept',
    picks: selection.picks,
    last,
    status,
  };

  const early: FurtherReason[] = [];
  const missed = actions.filter((a) => a.role === 'required' && !a.done).length;
  if (missed > 0) early.push({ kind: 'further_missed', count: missed });
  if (status === 'wrong') early.push({ kind: 'conduct', status });
  const late: FurtherReason[] = actions
    .filter((a) => a.done && a.failsRun)
    .map((a) => ({ kind: 'further_harmful', id: a.id }));

  return { result: { actions, conduct }, early, late };
}
