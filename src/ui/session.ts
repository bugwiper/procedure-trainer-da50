// The session machine (D-14, D-15, D-16, D-18, SES-01, SES-03, SES-04): which screen the app is on
// (free, briefing, running, debrief), how a run starts from a scenario and how it ends in a grade. No router;
// the screen is a signal. This module has no DOM access, so it is unit tested in node. The UI owns
// randomness (rng) and real time (the frame driver steps the run's simulation, which advances its
// VirtualClock in whole steps); the engine never sees either. A run is a Run (D-01, D-02): the
// simulation of the quantities over the store log, whose steps feed the bridge; it exists from
// Start run until the debrief closes or the run is left. It also holds the difficulty level (Easy,
// Medium or Realistic): display state chosen on the level card; grade never receives it. A run whose
// simulation reaches a named outcome (D-06) completes itself: the step listener calls the same
// completion as the debrief button. Realistic (D-05) is available for a scenario that declares an
// onset or whose scene is one of the aircraft's landing scenes (Phase 9, R-05, offersRealistic):
// choosing it starts the run at once, with no briefing, from the Realistic start quantities
// (the base quantities laid over by the scenario's onset quantities, C-61); the session
// draws a seed with its injected rng, the engine turns it into the onset time (onsetFromSeed) and the
// onset is recorded run data (the signal `onset`, then Recording.onset), so the run replays.
// A scenario with variants (phase 3.1) draws one cause on every level with a second seed, taken
// after the onset seed; the engine resolves it into the scenario the run uses (resolveVariant), the
// draw is recorded (the signal `variant`, then Recording.variant) and only the debrief names it.
// A landing situation has no onset: on Realistic it starts at once from the initial block, nothing
// waits and no onset is drawn. A follow-on that names several targets (Phase 9, R-04 to R-06) shows
// one button per target on Easy and Medium; on Realistic the one button draws the target by weight
// with a seed of the injected rng, recorded with the run (the signal `followOn`, then
// Recording.followOn) and kept by Retry.
// Phase 7 adds the checklist sheet (toggleChecklist), a non-modal sheet that exists in every run:
// it shows the scenario's own checklist and marks the steps already done from the grade of the
// partial recording (checklistMarks, the same credit the debrief shows; grade never receives the
// sheet or the level).
// The further actions (Phase 7, plans 02 and 05): during a run the pilot switches the decisions that
// are not panel actions (inform ATC, brief passengers, the flight conduct) with nine toggle buttons in
// the footwell; each press is logged by toggleDecision() as { t, id, on } with the run clock's time
// and goes into the recording beside the store log. The state the presses leave
// (effectiveSelection) is what the buttons show and what grade counts; no modal, the clock runs on.

import { computed, signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type { CatalogSet } from '../engine/catalog';
import type { VirtualClock } from '../engine/clock';
import type { AircraftEnv } from '../engine/env';
import { branchStatuses, grade } from '../engine/grading';
import type {
  BranchVerdict,
  GradeResult,
  RecordedFollowOn,
  RecordedOnset,
  RecordedVariant,
  Recording,
} from '../engine/grading';
import { followOnFromSeed } from '../engine/follow-on';
import { effectiveSelection, offersConduct, offersRealistic } from '../engine/further';
import type { FurtherSelection, RecordedDecision } from '../engine/further';
import { initialQuantities, realisticQuantities } from '../engine/predicates';
import { Run } from '../engine/run';
import { MAX_RUN_MS, onsetFromSeed, simEnded, simSetup } from '../engine/sim';
import { resolveVariant, variantFromSeed } from '../engine/variants';
import { openScenario } from '../scenario/packs';
import type { AccessPolicy, OpenResult, PackProvider, ScenarioRef } from '../scenario/packs';
import type { Scenario } from '../scenario/schema';
import type { PanelBridge } from './bridge';
import { followOnOffer, followOnTargets } from './debrief-text';
import { checklistHead } from './outline';
import { pageCount } from './panel/session-area';

export type Screen = 'free' | 'choosing' | 'briefing' | 'running' | 'debrief';

/**
 * The difficulty level of a run: Easy briefs with the checklist, Medium without it, Realistic has no
 * briefing at all and lets the failure begin by itself (D-05).
 */
export type Level = 'easy' | 'medium' | 'realistic';

/** The levels in display order. */
export const LEVELS: readonly Level[] = ['easy', 'medium', 'realistic'];

/** The display name of each level, as the level buttons and the debrief print it. */
export const LEVEL_NAMES: Readonly<Record<Level, string>> = {
  easy: 'Easy',
  medium: 'Medium',
  realistic: 'Realistic',
};

/** The one line under each level button on the level card: what the level changes. */
export const LEVEL_HINTS: Readonly<Record<Level, string>> = {
  easy: 'Checklist and panel steps shown in the briefing.',
  medium: 'Briefing without the checklist.',
  realistic: 'No briefing. The failure starts by itself.',
};

/** A refresh of the sheet marks slower than this (ms) makes the following ones trailing. */
const SLOW_MARKS_MS = 30;

/** The wait (ms) of a trailing refresh: events in between are coalesced into one. */
const TRAILING_MARKS_MS = 150;

/** One checklist of the Realistic list (R-03): its scenario entry, the heading shown and the parsed file. */
export interface ChecklistEntry {
  readonly ref: ScenarioRef;
  readonly heading: string;
  readonly scenario: Scenario;
}

/** The lazily loaded list of the checklists of all allowed scenarios. */
export interface ChecklistList {
  readonly status: 'idle' | 'loading' | 'ready' | 'failed';
  readonly entries: readonly ChecklistEntry[];
}

/** The checklist chosen last on Realistic: display state of the run, never an input of grade. */
export interface ChecklistChoice {
  readonly ref: ScenarioRef;
  readonly heading: string;
}

const sameRef = (a: ScenarioRef | null, b: ScenarioRef | null): boolean =>
  a !== null && b !== null && a.pack === b.pack && a.scenario === b.scenario;

/** The seeds the session draws are unsigned 32-bit integers. */
const SEED_RANGE = 4_294_967_296;

/** What a session button asked for while a run was live; the confirm holds it (U-03). */
export type PendingAction = 'new' | 'choose' | 'reset';

/** One row of the choose view: a scenario of an allowed pack, titled from the pack manifest. */
export interface Choice extends ScenarioRef {
  readonly title: string;
}

/** The scenario held by the briefing, with the branch statuses the engine computed for it. */
export interface Briefed {
  readonly scenario: Scenario;
  readonly branches: readonly BranchVerdict[];
}

/** A failed OpenResult, kept for the screens that render it (plan 12). */
export type LoadFailure = Extract<OpenResult, { readonly ok: false }>;

/** Read-only view for e2e specs; exists only in the e2e build (VITE_TEST_HOOKS=1). */
export interface SessionTestHook {
  screen(): Screen;
  scenarioId(): string | null;
  result(): GradeResult | null;
  now(): number | null;
  /** The onset of the current or last realistic run; null for any other run. */
  onset(): RecordedOnset | null;
  /** The variant drawn for the current or last run; null for a scenario without variants. */
  variant(): RecordedVariant | null;
  /** The follow-on draw of the current or last run (Phase 9, R-06); null when the run was not started by a Realistic follow-on button. */
  followOn(): RecordedFollowOn | null;
  /** The recording the last completed run was graded from; null until a run completes. */
  recording(): Recording | null;
}

declare global {
  interface Window {
    __panelSession?: SessionTestHook;
  }
}

export interface SessionDeps {
  readonly bridge: PanelBridge;
  readonly packs: { readonly provider: PackProvider; readonly policy: AccessPolicy };
  readonly env: AircraftEnv;
  /** Returns a number in [0, 1), like Math.random. */
  readonly rng: () => number;
  /** Called when a run starts, after the panel took the scenario's initial state. */
  readonly onRunStart: () => void;
  /**
   * The scene of the free panel (W-09: the ?scene flag, a known id); absent means the aircraft's
   * default scene. A briefing or a run overrides it.
   */
  readonly freeScene?: string;
}

export interface Session {
  readonly screen: ReadonlySignal<Screen>;
  /** The scenario of the current or last run (not the one a briefing holds until Start run). */
  readonly scenario: ReadonlySignal<Scenario | null>;
  /** The scenario the briefing shows; null outside the briefing. */
  readonly briefing: ReadonlySignal<Briefed | null>;
  /**
   * The view out of the windscreen (Phase 5, W-07, W-08): the scene of the briefing's scenario,
   * else of the run's (current or last) scenario, else the free-panel scene. The same on every
   * level, from the briefing until RESET.
   */
  readonly scene: ReadonlySignal<string>;
  /** The grade of the last run; null until graded, cleared at the next start. */
  readonly result: ReadonlySignal<GradeResult | null>;
  /** True while a pack loads; presses on the session area are ignored meanwhile. */
  readonly busy: ReadonlySignal<boolean>;
  readonly loadFailure: ReadonlySignal<LoadFailure | null>;
  /** The action waiting for the leave-run confirm; null when no confirm is open. */
  readonly confirm: ReadonlySignal<PendingAction | null>;
  /** True when a listing found no allowed scenario (the "No situations available" message). */
  readonly empty: ReadonlySignal<boolean>;
  /** The checklist catalog of the aircraft: the groups of the choose view and of the checklist list. */
  readonly catalog: CatalogSet;
  /** The entries the choose view lists, in catalog order (R-16, R-18); filled by openChooser. */
  readonly choices: ReadonlySignal<readonly Choice[]>;
  /** The id of the catalog group (tab) the choose view shows; the first group that has a situation when the chooser opens. */
  readonly chooseGroup: ReadonlySignal<string>;
  /** The choices of the selected group, in catalog order; a scenario the catalog does not know is in the last group. */
  readonly groupChoices: ReadonlySignal<readonly Choice[]>;
  /** The page (0-based) of the selected group in the choose view; 0 whenever the chooser opens, closes or the tab changes. */
  readonly choosePage: ReadonlySignal<number>;
  /** The session-hit id of the button that started the current load; null otherwise. */
  readonly busyKey: ReadonlySignal<string | null>;
  /** The virtual clock of the current run; null outside a run. */
  readonly clock: ReadonlySignal<VirtualClock | null>;
  /** The simulation of the current run (its clock is `clock`); null outside a run. */
  readonly run: ReadonlySignal<Run | null>;
  /**
   * The level of the briefing and of the current or last run; easy at creation and kept for the
   * page lifetime. grade never receives it.
   */
  readonly level: ReadonlySignal<Level>;
  /**
   * True while the debrief shows a run that ended by itself at the scenario's finish (Phase 9,
   * D-09), false after a press of Procedure complete, an outcome or the cap. Display state like the
   * level: never recorded, never an input of grade. Cleared where a run starts, is retried, left or
   * closed.
   */
  readonly endedByFinish: ReadonlySignal<boolean>;
  /** True once the level of the opened scenario was chosen; the level question comes before the briefing. */
  readonly levelPicked: ReadonlySignal<boolean>;
  /**
   * True while the checklist sheet is shown (R-02). A non-modal sheet: the run clock keeps running
   * and the panel stays operable. Cleared whenever the run ends.
   */
  readonly checklistShown: ReadonlySignal<boolean>;
  /**
   * The grade of the partial recording while the sheet shows the scenario's own checklist (R-02):
   * the sheet marks the steps with `steps[].credited`. Refreshed on each logged panel event or
   * retract while the sheet is shown; null when the sheet is hidden, before the onset of a Realistic
   * run, and outside a run. Display state: nothing here is ever recorded or graded.
   */
  readonly checklistMarks: ReadonlySignal<GradeResult | null>;
  /**
   * What the shown sheet holds: the list of checklists or one checklist (R-03). Easy and Medium are
   * always 'sheet'; on Realistic the sheet opens at the list until a checklist was chosen.
   */
  readonly checklistView: ReadonlySignal<'list' | 'sheet'>;
  /**
   * Realistic only: the checklist chosen last (display state of the run, named in the debrief; the
   * Recording and grade never see it). Kept until the debrief closes; null when none was chosen.
   */
  readonly checklistChoice: ReadonlySignal<ChecklistChoice | null>;
  /** Realistic only: the checklists of every allowed scenario, loaded on the first press (R-03). */
  readonly checklistList: ReadonlySignal<ChecklistList>;
  /**
   * Which steps of the shown checklist the program checks, and so which rows the user can tick
   * (plan 07-06, R-23, R-24): `all` (the own checklist with marks), `panel` (a foreign checklist
   * with marks: only the steps panel state decides) or `none` (no marks: before the Realistic onset,
   * or when a foreign checklist could not be graded). Follows `checklistMarks`.
   */
  readonly checklistAuto: ReadonlySignal<'all' | 'panel' | 'none'>;
  /**
   * The catalog group (tab) of the Realistic list of checklists (R-17): the first group at every run
   * start, kept until the run ends.
   */
  readonly checklistTab: ReadonlySignal<string>;
  /** The ref of the scenario the opened scenario came from; null outside a briefing and a run. */
  readonly openedRef: ReadonlySignal<ScenarioRef | null>;
  /**
   * The row keys ticked on the shown checklist (R-23): `line:<path>` and `step:<id>`. UI state of the
   * run: never recorded, never graded; cleared where a run starts or ends.
   */
  readonly checklistTicks: ReadonlySignal<ReadonlySet<string>>;
  /** True while the Realistic hint box is shown (R-04); cleared whenever the run ends. */
  readonly hintShown: ReadonlySignal<boolean>;
  /**
   * The branch statuses of the current run's scenario as the briefing showed them (decided at the
   * start), for the checklist sheet; empty outside a run.
   */
  readonly runBranches: ReadonlySignal<readonly BranchVerdict[]>;
  /**
   * Every press of a footwell button in the current run, in the order made, with the run time and the
   * on flag of each (R-08); empty outside a run. They go into the recording, never into the store log.
   */
  readonly decisions: ReadonlySignal<readonly RecordedDecision[]>;
  /** The state the presses leave (effectiveSelection): what the buttons show and what grade counts. */
  readonly furtherSelection: ReadonlySignal<FurtherSelection>;
  /**
   * The onset of the current or last realistic run (time in run ms and the seed it was drawn
   * from); null for Easy and Medium and outside a run. Run data, kept until the next start.
   */
  readonly onset: ReadonlySignal<RecordedOnset | null>;
  /**
   * The variant (cause) drawn for the current or last run, with its seed; null for a scenario
   * without variants and outside a run. Run data the screens never show before the debrief.
   */
  readonly variant: ReadonlySignal<RecordedVariant | null>;
  /** The recording the last run was graded from; null until a run completes, cleared at the next start. */
  readonly recording: ReadonlySignal<Recording | null>;
  /** Free and not busy only: opens one random allowed scenario and shows its briefing. */
  newSituation(): Promise<void>;
  /**
   * Free and not busy only: lists the scenarios of every allowed pack from the manifests (no
   * scenario text is loaded) and shows the choose view; no entry opens the empty message.
   */
  openChooser(): Promise<void>;
  /**
   * RESET: the panel back to its original state, no run, no scenario, no briefing or debrief.
   * During a run it asks first (the leave-run confirm, then leaveRun resets); on every other
   * screen it resets at once. Ignored while a load runs.
   */
  resetPanel(): void;
  /** Choosing only: back to the free panel. */
  closeChooser(): void;
  /** Choosing only: shows the group (tab) with this catalog id, from its first page; an unknown id does nothing. */
  chooseTab(id: string): void;
  /** Choosing only: the next page of the selected group; after the last page it wraps to the first. */
  nextPage(): void;
  /** Choosing and not busy only: opens the briefing of that entry (`key` names the pressed row). */
  chooseScenario(ref: ScenarioRef, key?: string): Promise<void>;
  /** Dismisses the "No situations available" message. */
  dismissEmpty(): void;
  /** Closes the leave-run confirm; the run continues unchanged. */
  keepGoing(): void;
  /**
   * Running with a confirm only: ends the run without grading, resets the panel to the registry
   * defaults and the quantities to their base values, then performs the action that was asked for.
   */
  leaveRun(): Promise<void>;
  /**
   * A step of the run threw (WR-03): ends the run without a grade, resets the panel as leaving a
   * run does and shows the error through the load-failure message. Does nothing without a run.
   */
  failRun(error: unknown): void;
  /** Repeats the failed request (a random pick again, or the same chosen entry). */
  retryLoad(): Promise<void>;
  /** Closes the load-error message; the area returns to the free panel. */
  dismissFailure(): void;
  /**
   * Briefing only: sets the level. On any other screen it does nothing, so the level of a run
   * cannot change between Start run and its debrief. Realistic starts the run at once, with no
   * briefing; for a scenario that offers no Realistic start (offersRealistic: no onset and not a
   * landing scene) it does nothing.
   */
  setLevel(level: Level): void;
  /**
   * Running only: shows or hides the checklist sheet (on Realistic it opens at the list of
   * checklists, or at the chosen one). It records nothing and changes no grade.
   */
  toggleChecklist(): void;
  /** Realistic run with the list shown: selects the catalog group of the list; an unknown id does nothing. */
  setChecklistTab(id: string): void;
  /**
   * Running with the sheet shown, a checklist on it: ticks the row with this key of the shown
   * checklist, or clears it when it was ticked (R-23). Display state only.
   */
  toggleManualMark(rowKey: string): void;
  /** Realistic run with the sheet shown: back to the list of checklists. */
  showChecklistList(): void;
  /** Realistic run with the sheet shown: shows the chosen checklist; the last choice is kept. */
  chooseChecklist(ref: ScenarioRef): void;
  /** Repeats a failed load of the list of checklists; the run goes on meanwhile. */
  retryChecklistList(): void;
  /**
   * Realistic run only, from the onset on: shows or hides the hint box with the situation name and
   * the situation text of the Medium briefing (R-04). Nothing before the onset and on other levels.
   */
  toggleHint(): void;
  /**
   * Running only: a press of a footwell button, logged at the run clock's time (R-08). An action
   * appends { t, id, on: !selected }; a conduct option appends on for another option than the
   * selected one (a radio group that always has one selection: the preselected default at the start,
   * and a press of the selected one is no change and logs nothing). Ignored before the onset of a
   * Realistic run, for an id the aircraft does not have and for a conduct or an Avoid action when the scenario offers
   * none (R-09).
   * A press never completes the run; the selections are graded at Procedure complete (R-10).
   */
  toggleDecision(id: string): void;
  /** Briefing only: the panel takes the scenario's initial state and the run begins. */
  startRun(): void;
  /** Briefing only: back to the free panel, nothing changed. */
  backToPanel(): void;
  /** Running only: grades the recorded log and shows the debrief. */
  complete(): void;
  /** Debrief only: back to free; the control state and quantities stay as the run left them. */
  closeDebrief(): void;
  /**
   * Debrief only, not while a load runs: starts the same scenario again from a clean initial state
   * at the same level, with the same cause and, on Realistic, the same onset (D-14,
   * `retrySeeds`). Nothing carries over from the graded run.
   */
  retry(): void;
  /**
   * Debrief only, not while a load runs: opens the scenario after the current one in listing order
   * (all allowed packs, manifest order, wrapping) at the same level, as its briefing on
   * Easy and Medium and as a started run on Realistic; the level card when the next scenario has no
   * onset (D-14).
   */
  nextSituation(): Promise<void>;
  /**
   * Debrief only, not while a load runs, and only where the debrief offers follow-on buttons
   * (Phase 9, D-02, D-03, R-04): opens the situation the graded scenario names for the conduct
   * selected at the end, through the pack seam, as Next situation does (same level, nothing carried
   * over from the graded run, which stays untouched until the open succeeds). The offer is
   * recomputed here from the session's own level and result and no argument is trusted: on Easy and
   * Medium `ref` must be one of the offered targets (absent is taken only where one target is
   * offered); on Realistic `ref` is ignored and the target is drawn by weight with a seed of the
   * injected rng, recorded with the run (R-06). A target that cannot be opened shows the
   * load-failure state; its retry repeats this start.
   */
  continueToFollowOn(ref?: ScenarioRef): Promise<void>;
  /** The follow-on draw of the current or last run (Realistic button); null for any other run. */
  readonly followOn: ReadonlySignal<RecordedFollowOn | null>;
}

/**
 * The three records a retry reuses: the onset of a Realistic run, the cause of a variant run and the
 * follow-on draw of a Realistic landing that a button started.
 */
export interface RetrySeeds {
  readonly onset: RecordedOnset | null;
  readonly variant: RecordedVariant | null;
  readonly followOn: RecordedFollowOn | null;
}

/**
 * The one place that decides which seeds a retry keeps (D-14, L-01): both as recorded, so a better
 * result comes from the pilot and not from the draw. The alternative rule (a new seed unless the
 * run was Realistic) is a change of this function and of its test only.
 */
export function retrySeeds(
  onset: RecordedOnset | null,
  variant: RecordedVariant | null,
  followOn: RecordedFollowOn | null = null,
): RetrySeeds {
  return { onset, variant, followOn };
}

/** The item at min(n - 1, floor(rng() * n)); throws RangeError for an empty list. */
export function pickRandom<T>(items: readonly T[], rng: () => number): T {
  const n = items.length;
  if (n === 0) throw new RangeError('cannot pick from an empty list');
  const item = items[Math.min(n - 1, Math.floor(rng() * n))];
  if (item === undefined) throw new RangeError('rng returned a value outside [0, 1)');
  return item;
}

/** The issue path that marks a load failure as an error during a run (WR-03). */
export const RUN_ERROR_PATH = '(run)';

const failure = (reason: LoadFailure['reason'], message: string): LoadFailure => ({
  ok: false,
  reason,
  issues: [{ path: '(pack)', message, line: 1, col: 1 }],
});

/** A policy that throws or rejects denies (fail closed), as in openScenario. */
async function allowed(policy: AccessPolicy, packId: string): Promise<boolean> {
  try {
    return await policy.canAccess(packId);
  } catch {
    return false;
  }
}

export function createSession(deps: SessionDeps): Session {
  const { bridge, packs, env, rng, onRunStart } = deps;
  const screen = signal<Screen>('free');
  const scenario = signal<Scenario | null>(null);
  const briefing = signal<Briefed | null>(null);
  const freeScene =
    deps.freeScene !== undefined && env.scenes.has(deps.freeScene)
      ? deps.freeScene
      : env.scenes.default;
  const scene = computed<string>(() => {
    const shown = briefing.value?.scenario ?? scenario.value;
    return shown === null ? freeScene : (shown.scene ?? env.scenes.default);
  });
  const result = signal<GradeResult | null>(null);
  const busy = signal(false);
  const loadFailure = signal<LoadFailure | null>(null);
  const empty = signal(false);
  const choices = signal<readonly Choice[]>([]);
  const firstGroup = env.catalog.groups[0]?.id ?? '';
  const chooseGroup = signal(firstGroup);
  const groupChoices = computed(() =>
    choices.value.filter((choice) => env.catalog.groupOrLast(choice).id === chooseGroup.value),
  );
  const choosePage = signal(0);
  const busyKey = signal<string | null>(null);
  const confirm = signal<PendingAction | null>(null);
  /** The request that produced the current loadFailure, so retryLoad repeats exactly that. */
  let lastRequest:
    | { readonly kind: 'random' }
    | { readonly kind: 'list' }
    | { readonly kind: 'next' }
    | { readonly kind: 'chosen'; readonly ref: ScenarioRef; readonly key: string }
    | null = null;
  const clock = signal<VirtualClock | null>(null);
  const run = signal<Run | null>(null);
  /** Drops the simulation of the run in hand; the bridge keeps the quantities as they are. */
  const endedByFinish = signal(false);
  const endRun = (): void => {
    run.peek()?.dispose();
    run.value = null;
    endedByFinish.value = false;
  };
  /**
   * The free panel as at page load: registry defaults, base quantities, no flags, no log, no run,
   * scenario, result or open view. Level and levelPicked are display state of the next briefing.
   */
  const toFreePanel = (): void => {
    bridge.reset({});
    bridge.setTimeSource(null);
    endRun();
    scenario.value = null;
    briefing.value = null;
    result.value = null;
    recording.value = null;
    onset.value = null;
    variant.value = null;
    followOn.value = null;
    clock.value = null;
    clearRunHelp();
    decisions.value = [];
    confirm.value = null;
    choices.value = [];
    chooseGroup.value = firstGroup;
    choosePage.value = 0;
    empty.value = false;
    loadFailure.value = null;
    lastRequest = null;
    screen.value = 'free';
  };
  const level = signal<Level>('easy');
  const levelPicked = signal(false);
  const checklistShown = signal(false);
  const checklistMarks = signal<GradeResult | null>(null);
  const checklistView = signal<'list' | 'sheet'>('sheet');
  const checklistChoice = signal<ChecklistChoice | null>(null);
  const checklistList = signal<ChecklistList>({ status: 'idle', entries: [] });
  const checklistAuto = signal<'all' | 'panel' | 'none'>('none');
  const checklistTab = signal(firstGroup);
  const manualMarks = signal<ReadonlySet<string>>(new Set());
  const hintShown = signal(false);
  const runBranches = signal<readonly BranchVerdict[]>([]);
  const decisions = signal<readonly RecordedDecision[]>([]);
  // The conduct starts at the preselected default where the scenario offers one (R-08, no log entry).
  const furtherSelection = computed(() =>
    effectiveSelection(decisions.value, env.further, offersConduct(scenario.value?.further)),
  );
  const onset = signal<RecordedOnset | null>(null);
  const variant = signal<RecordedVariant | null>(null);
  const followOn = signal<RecordedFollowOn | null>(null);
  /** The draw of a Realistic follow-on press, handed to the start it opens; consumed by `start`. */
  let pendingFollowOn: RecordedFollowOn | null = null;
  const recording = signal<Recording | null>(null);
  /** The entry the opened scenario came from: Next situation moves on from it. */
  const openedRef = signal<ScenarioRef | null>(null);
  /** The ref of the checklist the sheet shows: the opened scenario's own, or the one chosen on Realistic. */
  const shownRef = computed<ScenarioRef | null>(() => {
    const opened = openedRef.value;
    if (scenario.value === null || opened === null) return null;
    if (level.value !== 'realistic') return opened;
    const choice = checklistChoice.value;
    return checklistView.value === 'sheet' && choice !== null ? choice.ref : null;
  });
  const refKey = (ref: ScenarioRef): string => `${ref.pack}/${ref.scenario}`;
  const checklistTicks = computed<ReadonlySet<string>>(() => {
    const ref = shownRef.value;
    if (ref === null) return new Set<string>();
    const prefix = `${refKey(ref)}|`;
    return new Set(
      [...manualMarks.value]
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length)),
    );
  });
  /** The last grade of the marks: one entry, keyed by the shown checklist and the state of the user log. */
  let marksCache: {
    readonly ref: ScenarioRef;
    readonly length: number;
    readonly last: unknown;
    readonly marks: GradeResult | null;
    readonly auto: 'all' | 'panel';
  } | null = null;
  /** True when the last refresh of the sheet marks took longer than SLOW_MARKS_MS. */
  let slowMarks = false;
  let trailingMarks: ReturnType<typeof setTimeout> | null = null;
  /** Counts the runs: a list load that outlives its run drops its result. */
  let listGeneration = 0;

  /**
   * The recording of the run so far, stamped with the run clock's time now: the pilot's events only
   * (the changes of the simulation are regenerated by the replay), the onset and the variant. The
   * debrief grades it and the checklist sheet marks from it; null outside a run.
   */
  const currentRecording = (): Recording | null => {
    const current = scenario.peek();
    const runClock = clock.peek();
    if (screen.peek() !== 'running' || current === null || runClock === null) return null;
    return {
      scenarioId: current.id,
      completedAt: runClock.now(),
      events: bridge.store
        .events()
        .filter((e) => e.source === 'user')
        .map((e) => ({ t: e.t, id: e.id, value: e.value })),
      ...(onset.peek() === null ? {} : { onset: onset.peek() }),
      ...(variant.peek() === null ? {} : { variant: variant.peek() }),
      ...(followOn.peek() === null ? {} : { followOn: followOn.peek() }),
      ...(decisions.peek().length === 0 ? {} : { decisions: decisions.peek() }),
    };
  };

  /** True before the failure of a Realistic run has begun: nothing may be decided about it yet. */
  const beforeOnset = (): boolean => {
    const began = onset.peek();
    const runClock = clock.peek();
    return began !== null && runClock !== null && runClock.now() < began.at;
  };

  /**
   * The checklist the sheet shows, with its scenario: the opened scenario's own (always on Easy and
   * Medium, on Realistic when the chosen checklist has its ref) or the loaded file of the chosen
   * one; null while the list is shown or no checklist is chosen.
   */
  const shownChecklist = (): {
    readonly ref: ScenarioRef;
    readonly scenario: Scenario;
    readonly own: boolean;
  } | null => {
    const ref = shownRef.peek();
    const current = scenario.peek();
    const opened = openedRef.peek();
    if (ref === null || current === null) return null;
    if (sameRef(ref, opened)) return { ref, scenario: current, own: true };
    const entry = checklistList.peek().entries.find((e) => sameRef(e.ref, ref));
    return entry === undefined ? null : { ref, scenario: entry.scenario, own: false };
  };

  /**
   * The pilot's panel events graded against another file (R-24): the real events, the id of the
   * chosen file, no cause and no decisions; the onset only when the chosen file declares one.
   */
  const foreignRecording = (real: Recording, chosen: Scenario): Recording => ({
    scenarioId: chosen.id,
    completedAt: real.completedAt,
    events: real.events,
    ...(chosen.onset !== undefined && real.onset != null ? { onset: real.onset } : {}),
  });

  const setMarks = (marks: GradeResult | null, auto: 'all' | 'panel'): void => {
    checklistMarks.value = marks;
    checklistAuto.value = marks === null ? 'none' : auto;
  };

  /**
   * Refreshes the marks of the sheet (R-02, R-24): the grade of the partial recording against the
   * shown checklist (the real file, or the chosen foreign file, green only and never a verdict),
   * only while the sheet shows a checklist and, on Realistic, once the onset has passed; otherwise
   * nothing is marked. Called by each logged panel event or retract and when the sheet is opened or
   * switched; never per tick. A log that did not change since the last call for the same checklist
   * is not graded again; a foreign file that throws marks nothing.
   */
  const computeMarks = (): void => {
    const shown = shownChecklist();
    const graded = currentRecording();
    if (!checklistShown.peek() || shown === null || graded === null || beforeOnset()) {
      setMarks(null, 'all');
      return;
    }
    const userEvents = bridge.store.events().filter((e) => e.source === 'user');
    const last = userEvents[userEvents.length - 1];
    const cached = marksCache;
    if (
      cached !== null &&
      sameRef(cached.ref, shown.ref) &&
      cached.length === userEvents.length &&
      cached.last === last
    ) {
      setMarks(cached.marks, cached.auto);
      return;
    }
    const began = performance.now();
    let marks: GradeResult | null;
    if (shown.own) {
      marks = grade(shown.scenario, env, graded);
    } else {
      try {
        marks = grade(shown.scenario, env, foreignRecording(graded, shown.scenario));
      } catch {
        marks = null;
      }
    }
    // The cost of a grade grows with the run time (a replay of the whole log, about 9 ms a minute
    // on the slowest shipped scenario): a slow call makes the next refreshes trailing (S-02).
    slowMarks = performance.now() - began > SLOW_MARKS_MS;
    const auto = shown.own ? 'all' : 'panel';
    marksCache = { ref: shown.ref, length: userEvents.length, last, marks, auto };
    setMarks(marks, auto);
  };

  /** A panel event or a retract refreshes the marks at once, or trailing when the last call was slow. */
  const refreshMarks = (): void => {
    if (!slowMarks) {
      computeMarks();
      return;
    }
    if (trailingMarks !== null) return;
    trailingMarks = setTimeout(() => {
      trailingMarks = null;
      computeMarks();
    }, TRAILING_MARKS_MS);
  };

  /** The sheet and everything the run help holds: cleared wherever a run starts or ends. */
  const clearRunHelp = (): void => {
    checklistShown.value = false;
    checklistMarks.value = null;
    checklistView.value = 'sheet';
    checklistChoice.value = null;
    checklistList.value = { status: 'idle', entries: [] };
    checklistAuto.value = 'none';
    checklistTab.value = firstGroup;
    manualMarks.value = new Set();
    marksCache = null;
    hintShown.value = false;
    listGeneration += 1;
    runBranches.value = [];
    slowMarks = false;
    if (trailingMarks !== null) clearTimeout(trailingMarks);
    trailingMarks = null;
  };

  // One subscription to the log: a panel event or a retract of the user refreshes the marks, but
  // only while the sheet is shown. The changes the simulation makes (source sim) credit nothing.
  bridge.store.subscribe((event) => {
    if (event.source === 'user' && checklistShown.peek()) refreshMarks();
  });
  bridge.store.onRetract((event) => {
    if (event.source === 'user' && checklistShown.peek()) refreshMarks();
  });

  /**
   * Loads the checklist list once per run (S-03): every scenario of every allowed pack through the
   * pack seam, in listing order. It does not use `loading`, `busy` or `loadFailure`, so presses and
   * the run are untouched; a failure shows in the sheet and can be retried.
   */
  const loadChecklistList = async (): Promise<void> => {
    const status = checklistList.peek().status;
    if (status === 'loading' || status === 'ready') return;
    const generation = listGeneration;
    checklistList.value = { status: 'loading', entries: [] };
    const listed = await listChoices();
    const opened = listed.ok
      ? await Promise.all(
          listed.choices.map(async (choice) => ({
            choice,
            opened: await openScenario(packs, env, {
              pack: choice.pack,
              scenario: choice.scenario,
            }),
          })),
        )
      : [];
    // The run ended (or restarted) while the files loaded: nothing to show any more.
    if (generation !== listGeneration) return;
    const entries: ChecklistEntry[] = [];
    for (const { choice, opened: result } of opened) {
      if (!result.ok) {
        checklistList.value = { status: 'failed', entries: [] };
        return;
      }
      entries.push({
        ref: { pack: choice.pack, scenario: choice.scenario },
        heading: checklistHead(result.scenario).heading ?? result.scenario.title,
        scenario: result.scenario,
      });
    }
    checklistList.value = listed.ok
      ? { status: 'ready', entries }
      : { status: 'failed', entries: [] };
  };

  /** Debrief only, not busy: the next scenario of the list opens its briefing (D-14). */
  const runNext = async (): Promise<void> => {
    if (screen.peek() !== 'debrief' || busy.peek()) return;
    const here = openedRef.peek();
    await loading('session.next', async () => {
      const listed = await listChoices();
      if (!listed.ok) {
        loadFailure.value = listed;
        // The error card's retry repeats this entry (IN-04).
        lastRequest = { kind: 'next' };
        return;
      }
      const entries = listed.choices;
      const at = entries.findIndex(
        (entry) => here !== null && entry.pack === here.pack && entry.scenario === here.scenario,
      );
      const target = entries[(at + 1) % entries.length];
      if (target === undefined) {
        empty.value = true;
        return;
      }
      const ref = { pack: target.pack, scenario: target.scenario };
      await openBriefing(ref, true);
      // A failure to load leaves the free panel with the message; Retry repeats this entry.
      if (loadFailure.peek() !== null) lastRequest = { kind: 'chosen', ref, key: 'session.next' };
    });
  };

  /**
   * Debrief only, not busy: a follow-on the debrief offers opens its briefing (Phase 9, D-02, R-04
   * to R-06). The offer is recomputed from this session's own level and graded result; the argument
   * only picks among the offered targets on Easy and Medium and is ignored on Realistic, where the
   * target is drawn by weight with a seed of the injected rng that goes with the run.
   */
  const runFollowOn = async (pick?: ScenarioRef): Promise<void> => {
    const graded = result.peek();
    const source = scenario.peek();
    if (screen.peek() !== 'debrief' || busy.peek() || graded === null || source === null) return;
    const realistic = level.peek() === 'realistic';
    const buttons = followOnOffer(graded, source.further, env.further, realistic);
    if (buttons.length === 0) return;
    let ref: ScenarioRef;
    let drawn: RecordedFollowOn | null = null;
    if (realistic) {
      const seed = Math.floor(rng() * SEED_RANGE);
      try {
        const target = followOnFromSeed(seed, followOnTargets(graded, source.further, env.further));
        ref = { pack: target.pack, scenario: target.scenario };
        drawn = { seed, from: source.id };
      } catch (error) {
        // Lint L33 prevents it in a shipped file: no silent default, the load failure of reason invalid.
        toFreePanel();
        loadFailure.value = failure(
          'invalid',
          error instanceof Error ? error.message : 'the follow-on could not be drawn',
        );
        return;
      }
    } else {
      const offered = buttons.find(
        (button) =>
          button.ref !== null &&
          (pick === undefined
            ? buttons.length === 1
            : button.ref.pack === pick.pack && button.ref.scenario === pick.scenario),
      );
      if (offered?.ref == null) return;
      ref = { pack: offered.ref.pack, scenario: offered.ref.scenario };
    }
    const target = ref;
    pendingFollowOn = drawn;
    await loading('session.follow_on', async () => {
      try {
        await openBriefing(target, true);
      } finally {
        // A run that began took the draw; a card or a failure drops it.
        pendingFollowOn = null;
      }
      // A failure to load leaves the free panel with the message; Retry repeats this start.
      if (loadFailure.peek() !== null) {
        lastRequest = { kind: 'chosen', ref: target, key: 'session.follow_on' };
      }
    });
  };

  /** Running only: grades the recorded log at the run clock's time and shows the debrief. */
  const completeRun = (): void => {
    const current = scenario.peek();
    const runClock = clock.peek();
    const graded = currentRecording();
    if (graded === null || current === null || runClock === null) return;
    recording.value = graded;
    result.value = grade(current, env, graded);
    // The debrief names the last checklist choice, so it outlives the sheet until the debrief closes.
    const used = checklistChoice.peek();
    clearRunHelp();
    checklistChoice.value = used;
    runClock.pause();
    bridge.setTimeSource(null);
    screen.value = 'debrief';
  };

  /**
   * Table N1 "start": baseline without an event, a fresh clock, then the screen. A realistic start
   * (C-31, C-32, C-61) draws the seed, takes the start quantities of the Realistic setup (the base
   * quantities laid over by the scenario's onset quantities) and lets the scenario's parameters,
   * with those of its onset block, act from the onset; otherwise the quantities are the scenario's and the failure is there from t 0.
   */
  const start = (opened: Scenario, realistic: boolean, seeds?: RetrySeeds): void => {
    const window = realistic ? opened.onset?.window_s : undefined;
    let drawn: RecordedOnset | null = null;
    let cause: RecordedVariant | null = null;
    // The follow-on draw of the press that opened this run (a retry keeps the one it was given).
    const fromDraw = seeds !== undefined ? seeds.followOn : pendingFollowOn;
    pendingFollowOn = null;
    if (seeds !== undefined) {
      // A retry (D-14) takes the records it was given and draws nothing.
      drawn = window === undefined ? null : seeds.onset;
      cause = opened.variants.length === 0 ? null : seeds.variant;
    } else {
      if (window !== undefined) {
        const seed = Math.floor(rng() * SEED_RANGE);
        drawn = { at: onsetFromSeed(seed, window), seed };
      }
      if (opened.variants.length > 0) {
        const seed = Math.floor(rng() * SEED_RANGE);
        cause = { id: variantFromSeed(seed, opened.variants), seed };
      }
    }
    // The run uses the scenario its cause makes; the signal and the grade keep the file's own.
    const used = resolveVariant(opened, cause?.id ?? null, drawn !== null);
    const setup = simSetup(env, used, drawn === null ? {} : { onsetAt: drawn.at });
    const startQuantities =
      drawn === null
        ? initialQuantities(used, env.quantities)
        : realisticQuantities(used, env.quantities);
    bridge.reset(
      used.initial.controls,
      drawn === null ? used.initial.quantities : (used.onset?.quantities ?? {}),
    );
    endRun();
    const current = new Run({ setup, store: bridge.store, start: startQuantities });
    current.onStep((state) => {
      bridge.setQuantities(state.quantities);
      bridge.setFlags(state.flags);
      // D-06: a run whose state carries a named outcome ends by itself, graded as FAIL. The run
      // clock stands at the outcome time, which is what complete() records as completedAt. The
      // 30-minute cap ends a run the same way, without an outcome (WR-05, V-14). The finish of a
      // landing situation (D-09) completes the run as a press of Procedure complete would at that
      // time; the debrief says it ended that way.
      if ((simEnded(state) || state.t >= MAX_RUN_MS) && screen.peek() === 'running') {
        endedByFinish.value = state.finish !== null;
        completeRun();
      }
    });
    bridge.setTimeSource(() => current.clock.now());
    scenario.value = opened;
    briefing.value = null;
    result.value = null;
    recording.value = null;
    clearRunHelp();
    runBranches.value = branchStatuses(opened, env);
    decisions.value = [];
    chooseGroup.value = firstGroup;
    choosePage.value = 0;
    onset.value = drawn;
    variant.value = cause;
    followOn.value = realistic ? fromDraw : null;
    run.value = current;
    clock.value = current.clock;
    onRunStart();
    screen.value = 'running';
  };

  /**
   * The scenario entries of every pack the policy allows, in the catalog order (R-16, R-18: group by
   * group, entries in the printed order, a scenario the catalog does not know after them in manifest
   * order), titles from the manifests.
   */
  const listChoices = async (): Promise<
    { readonly ok: true; readonly choices: Choice[] } | LoadFailure
  > => {
    try {
      const metas = await packs.provider.listPacks();
      const listed: Choice[] = [];
      for (const meta of metas) {
        if (!(await allowed(packs.policy, meta.id))) continue;
        for (const entry of meta.scenarios) {
          listed.push({ pack: meta.id, scenario: entry.id, title: entry.title });
        }
      }
      return { ok: true, choices: env.catalog.order(listed) };
    } catch (error) {
      return failure('load-failed', error instanceof Error ? error.message : 'unknown error');
    }
  };

  /** Marks one load in flight for the button `key`; presses are ignored until it is done. */
  const loading = async (key: string, work: () => Promise<void>): Promise<void> => {
    busy.value = true;
    busyKey.value = key;
    loadFailure.value = null;
    empty.value = false;
    try {
      await work();
    } finally {
      busy.value = false;
      busyKey.value = null;
    }
  };

  /**
   * Opens a scenario through the seam and shows its briefing; a failure is kept for the screens.
   * `keepPicks` (Next situation, D-14) leaves the debrief like RESET does and keeps the level, so
   * its card is skipped: a Realistic level starts the run at once where the scenario offers it
   * (offersRealistic: an onset, or a landing scene, which starts from the initial block) and shows
   * the level card where it does not.
   */
  const openBriefing = async (ref: ScenarioRef, keepPicks = false): Promise<void> => {
    const opened = await openScenario(packs, env, ref);
    if (keepPicks) toFreePanel();
    if (!opened.ok) {
      loadFailure.value = opened;
      return;
    }
    openedRef.value = { pack: ref.pack, scenario: ref.scenario };
    // The briefing leaves the panel, the log and the last run untouched (D-14).
    const briefed: Briefed = {
      scenario: opened.scenario,
      branches: branchStatuses(opened.scenario, env),
    };
    briefing.value = briefed;
    choices.value = [];
    chooseGroup.value = firstGroup;
    choosePage.value = 0;
    screen.value = 'briefing';
    if (!keepPicks) {
      levelPicked.value = false;
      return;
    }
    const realistic = level.peek() === 'realistic';
    if (realistic && !offersRealistic(opened.scenario, env.further, env.scenes.default)) {
      levelPicked.value = false;
      return;
    }
    levelPicked.value = true;
    if (realistic) begin(briefed, true);
  };

  /** A random allowed scenario opens its briefing (NEW SITUATION). */
  const runRandom = (): Promise<void> => {
    lastRequest = { kind: 'random' };
    return loading('session.new', async () => {
      const listed = await listChoices();
      if (!listed.ok) {
        loadFailure.value = listed;
        return;
      }
      if (listed.choices.length === 0) {
        empty.value = true;
        return;
      }
      const { pack, scenario: id } = pickRandom(listed.choices, rng);
      await openBriefing({ pack, scenario: id });
    });
  };

  /** The choose view lists the allowed scenarios (CHOOSE SITUATION). */
  const runList = (): Promise<void> => {
    lastRequest = { kind: 'list' };
    return loading('session.choose', async () => {
      const listed = await listChoices();
      if (!listed.ok) {
        loadFailure.value = listed;
        return;
      }
      if (listed.choices.length === 0) {
        empty.value = true;
        return;
      }
      choices.value = listed.choices;
      // The first group that has a situation is the tab shown first (R-18).
      chooseGroup.value =
        env.catalog.groups.find((group) =>
          listed.choices.some((choice) => env.catalog.groupOrLast(choice).id === group.id),
        )?.id ?? firstGroup;
      choosePage.value = 0;
      screen.value = 'choosing';
    });
  };

  /** One chosen entry opens its briefing (a row of the choose view). */
  const runChosen = (ref: ScenarioRef, key: string): Promise<void> => {
    lastRequest = { kind: 'chosen', ref: { pack: ref.pack, scenario: ref.scenario }, key };
    return loading(key, () => openBriefing(ref));
  };

  /** Starts the run of the briefed scenario; an illegal baseline is kept as a load failure. */
  const begin = (briefed: Briefed, realistic: boolean): void => {
    try {
      start(briefed.scenario, realistic);
    } catch (error) {
      // An illegal baseline changes nothing (bridge.reset); lint should have caught it.
      briefing.value = null;
      lastRequest = null;
      loadFailure.value = failure(
        'invalid',
        error instanceof Error ? error.message : 'the baseline could not be applied',
      );
      screen.value = 'free';
    }
  };

  const dismissFailure = (): void => {
    loadFailure.value = null;
    lastRequest = null;
    choices.value = [];
    chooseGroup.value = firstGroup;
    choosePage.value = 0;
    if (screen.peek() === 'choosing') screen.value = 'free';
  };

  return {
    screen,
    scenario,
    briefing,
    scene,
    result,
    busy,
    loadFailure,
    empty,
    catalog: env.catalog,
    choices,
    chooseGroup,
    groupChoices,
    choosePage,
    busyKey,
    confirm,
    clock,
    run,
    level,
    levelPicked,
    endedByFinish,
    checklistShown,
    checklistMarks,
    checklistView,
    checklistChoice,
    checklistList,
    checklistAuto,
    checklistTab,
    openedRef,
    checklistTicks,
    hintShown,
    runBranches,
    decisions,
    furtherSelection,
    onset,
    variant,
    recording,
    async newSituation() {
      if (busy.peek()) return;
      // A live run asks first; the request waits in the confirm (U-03).
      if (screen.peek() === 'running') {
        confirm.value = 'new';
        return;
      }
      if (screen.peek() !== 'free') return;
      await runRandom();
    },
    async openChooser() {
      if (busy.peek()) return;
      if (screen.peek() === 'running') {
        confirm.value = 'choose';
        return;
      }
      if (screen.peek() !== 'free') return;
      await runList();
    },
    resetPanel() {
      if (busy.peek()) return;
      if (screen.peek() === 'running') {
        confirm.value = 'reset';
        return;
      }
      toFreePanel();
    },
    closeChooser() {
      if (screen.peek() !== 'choosing' || busy.peek()) return;
      choices.value = [];
      chooseGroup.value = firstGroup;
      choosePage.value = 0;
      screen.value = 'free';
    },
    chooseTab(id) {
      if (screen.peek() !== 'choosing' || busy.peek()) return;
      if (!env.catalog.groups.some((group) => group.id === id)) return;
      chooseGroup.value = id;
      choosePage.value = 0;
    },
    nextPage() {
      if (screen.peek() !== 'choosing' || busy.peek()) return;
      choosePage.value = (choosePage.peek() + 1) % pageCount(groupChoices.peek().length);
    },
    async chooseScenario(ref, key = `session.row.${ref.pack}.${ref.scenario}`) {
      if (screen.peek() !== 'choosing' || busy.peek()) return;
      await runChosen(ref, key);
    },
    dismissEmpty() {
      empty.value = false;
    },
    keepGoing() {
      confirm.value = null;
    },
    async leaveRun() {
      const pending = confirm.peek();
      if (pending === null || screen.peek() !== 'running') return;
      // The run is dropped, never graded: no result, no clock, the panel at its defaults (U-03).
      toFreePanel();
      if (pending === 'new') await runRandom();
      else if (pending === 'choose') await runList();
    },
    failRun(error) {
      if (run.peek() === null || screen.peek() !== 'running') {
        console.error(error);
        return;
      }
      const text = error instanceof Error ? error.message : String(error);
      bridge.reset({});
      bridge.setTimeSource(null);
      bridge.setFlags({});
      endRun();
      scenario.value = null;
      briefing.value = null;
      result.value = null;
      recording.value = null;
      onset.value = null;
      variant.value = null;
      clock.value = null;
      clearRunHelp();
      decisions.value = [];
      confirm.value = null;
      lastRequest = null;
      screen.value = 'free';
      loadFailure.value = {
        ok: false,
        reason: 'invalid',
        issues: [
          {
            path: RUN_ERROR_PATH,
            message: `The run stopped because of an error: ${text}`,
            line: 1,
            col: 1,
          },
        ],
      };
    },
    async retryLoad() {
      const request = lastRequest;
      if (busy.peek()) return;
      if (loadFailure.peek() === null || request === null) {
        dismissFailure();
        return;
      }
      if (request.kind === 'random') await runRandom();
      else if (request.kind === 'list') await runList();
      else if (request.kind === 'next') await runNext();
      else await runChosen(request.ref, request.key);
    },
    dismissFailure,
    setLevel(next) {
      const briefed = briefing.peek();
      if (screen.peek() !== 'briefing' || briefed === null) return;
      // D-05, R-05: Realistic shows no briefing; a scenario with neither an onset nor a landing scene does not offer the level.
      if (
        next === 'realistic' &&
        !offersRealistic(briefed.scenario, env.further, env.scenes.default)
      ) {
        return;
      }
      level.value = next;
      levelPicked.value = true;
      if (next === 'realistic') begin(briefed, true);
    },
    toggleChecklist() {
      if (screen.peek() !== 'running') return;
      const opening = !checklistShown.peek();
      if (opening && level.peek() === 'realistic') {
        // Every checklist is listed alike, so the sheet may open before the onset (R-03).
        const choice = checklistChoice.peek();
        checklistView.value = choice === null ? 'list' : 'sheet';
        void loadChecklistList();
      }
      checklistShown.value = opening;
      computeMarks();
    },
    setChecklistTab(id) {
      if (screen.peek() !== 'running' || level.peek() !== 'realistic') return;
      if (!env.catalog.groups.some((group) => group.id === id)) return;
      checklistTab.value = id;
    },
    toggleManualMark(rowKey) {
      const ref = shownRef.peek();
      if (screen.peek() !== 'running' || !checklistShown.peek() || ref === null) return;
      const key = `${refKey(ref)}|${rowKey}`;
      const next = new Set(manualMarks.peek());
      if (!next.delete(key)) next.add(key);
      manualMarks.value = next;
    },
    showChecklistList() {
      if (screen.peek() !== 'running' || level.peek() !== 'realistic') return;
      checklistView.value = 'list';
      void loadChecklistList();
      computeMarks();
    },
    chooseChecklist(ref) {
      if (screen.peek() !== 'running' || level.peek() !== 'realistic') return;
      const list = checklistList.peek();
      const entry = list.entries.find((e) => sameRef(e.ref, ref));
      if (list.status !== 'ready' || entry === undefined) return;
      checklistChoice.value = { ref: entry.ref, heading: entry.heading };
      checklistView.value = 'sheet';
      computeMarks();
    },
    retryChecklistList() {
      if (screen.peek() !== 'running' || checklistList.peek().status !== 'failed') return;
      checklistList.value = { status: 'idle', entries: [] };
      void loadChecklistList();
    },
    toggleHint() {
      if (screen.peek() !== 'running' || level.peek() !== 'realistic' || beforeOnset()) return;
      hintShown.value = !hintShown.peek();
    },
    toggleDecision(id) {
      const current = scenario.peek();
      const runClock = clock.peek();
      if (screen.peek() !== 'running' || current === null || runClock === null) return;
      if (beforeOnset()) return;
      const option = env.further.option(id);
      if (option === undefined) return;
      // The conduct and the Avoid actions that qualify it exist only where a conduct is offered (R-09, R-21).
      if ((option.kind === 'conduct' || option.avoid === true) && !offersConduct(current.further))
        return;
      const now = effectiveSelection(decisions.peek(), env.further, offersConduct(current.further));
      // A greyed-out action (the Avoid picks under the emergency landing) logs nothing.
      if (env.further.isBlocked(id, now.conduct)) return;
      // A conduct cannot be cleared: the press of the selected one is no change.
      if (option.kind === 'conduct' && now.conduct === id) return;
      const on = option.kind === 'conduct' ? true : !now.actions.has(id);
      decisions.value = [...decisions.peek(), { t: runClock.now(), id, on }];
    },
    startRun() {
      const briefed = briefing.peek();
      if (screen.peek() !== 'briefing' || briefed === null) return;
      begin(briefed, false);
    },
    backToPanel() {
      if (screen.peek() !== 'briefing') return;
      briefing.value = null;
      screen.value = 'free';
    },
    complete: completeRun,
    closeDebrief() {
      // A next-situation load in flight would open a briefing the pilot had left (IN-04).
      if (screen.peek() !== 'debrief' || busy.peek()) return;
      endRun();
      clearRunHelp();
      decisions.value = [];
      // A run timer cannot outlive its run (C-23): the lamps go dark, the quantities stay as left.
      bridge.setFlags({});
      clock.value = null;
      screen.value = 'free';
    },
    retry() {
      const current = scenario.peek();
      if (screen.peek() !== 'debrief' || busy.peek() || current === null) return;
      // The graded run is over: its records are read before the cleanup clears them.
      const seeds = retrySeeds(
        onset.peek() ?? recording.peek()?.onset ?? null,
        variant.peek() ?? recording.peek()?.variant ?? null,
        followOn.peek() ?? recording.peek()?.followOn ?? null,
      );
      endRun();
      clearRunHelp();
      decisions.value = [];
      bridge.setFlags({});
      clock.value = null;
      result.value = null;
      recording.value = null;
      try {
        start(current, level.peek() === 'realistic', seeds);
      } catch (error) {
        // An illegal baseline changes nothing (bridge.reset); lint should have caught it.
        toFreePanel();
        loadFailure.value = failure(
          'invalid',
          error instanceof Error ? error.message : 'the baseline could not be applied',
        );
      }
    },
    nextSituation: runNext,
    continueToFollowOn: runFollowOn,
    followOn,
  };
}
