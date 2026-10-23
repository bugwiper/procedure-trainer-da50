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
// onset: choosing it starts the run at once, with no briefing, from the Realistic start quantities
// (the base quantities laid over by the scenario's onset quantities, C-61); the session
// draws a seed with its injected rng, the engine turns it into the onset time (onsetFromSeed) and the
// onset is recorded run data (the signal `onset`, then Recording.onset), so the run replays.
// A scenario with variants (phase 3.1) draws one cause on every level with a second seed, taken
// after the onset seed; the engine resolves it into the scenario the run uses (resolveVariant), the
// draw is recorded (the signal `variant`, then Recording.variant) and only the debrief names it.

import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type { VirtualClock } from '../engine/clock';
import type { AircraftEnv } from '../engine/env';
import { branchStatuses, grade } from '../engine/grading';
import type {
  BranchVerdict,
  GradeResult,
  RecordedOnset,
  RecordedVariant,
  Recording,
} from '../engine/grading';
import { initialQuantities, realisticQuantities } from '../engine/predicates';
import { Run } from '../engine/run';
import { onsetFromSeed, simSetup } from '../engine/sim';
import { resolveVariant, variantFromSeed } from '../engine/variants';
import { openScenario } from '../scenario/packs';
import type { AccessPolicy, OpenResult, PackProvider, ScenarioRef } from '../scenario/packs';
import type { Scenario } from '../scenario/schema';
import type { PanelBridge } from './bridge';

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

/** The seeds the session draws are unsigned 32-bit integers. */
const SEED_RANGE = 4_294_967_296;

/** What a session button asked for while a run was live; the confirm holds it (U-03). */
export type PendingAction = 'new' | 'choose';

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
}

export interface Session {
  readonly screen: ReadonlySignal<Screen>;
  /** The scenario of the current or last run (not the one a briefing holds until Start run). */
  readonly scenario: ReadonlySignal<Scenario | null>;
  /** The scenario the briefing shows; null outside the briefing. */
  readonly briefing: ReadonlySignal<Briefed | null>;
  /** The grade of the last run; null until graded, cleared at the next start. */
  readonly result: ReadonlySignal<GradeResult | null>;
  /** True while a pack loads; presses on the session area are ignored meanwhile. */
  readonly busy: ReadonlySignal<boolean>;
  readonly loadFailure: ReadonlySignal<LoadFailure | null>;
  /** The action waiting for the leave-run confirm; null when no confirm is open. */
  readonly confirm: ReadonlySignal<PendingAction | null>;
  /** True when a listing found no allowed scenario (the "No situations available" message). */
  readonly empty: ReadonlySignal<boolean>;
  /** The entries the choose view lists, in manifest order; filled by openChooser. */
  readonly choices: ReadonlySignal<readonly Choice[]>;
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
  /** True once the level of the opened scenario was chosen; the level question comes before the briefing. */
  readonly levelPicked: ReadonlySignal<boolean>;
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
  /** Choosing only: back to the free panel. */
  closeChooser(): void;
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
   * briefing; for a scenario without an onset it does nothing.
   */
  setLevel(level: Level): void;
  /** Briefing only: the panel takes the scenario's initial state and the run begins. */
  startRun(): void;
  /** Briefing only: back to the free panel, nothing changed. */
  backToPanel(): void;
  /** Running only: grades the recorded log and shows the debrief. */
  complete(): void;
  /** Debrief only: back to free; the control state and quantities stay as the run left them. */
  closeDebrief(): void;
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
  const result = signal<GradeResult | null>(null);
  const busy = signal(false);
  const loadFailure = signal<LoadFailure | null>(null);
  const empty = signal(false);
  const choices = signal<readonly Choice[]>([]);
  const busyKey = signal<string | null>(null);
  const confirm = signal<PendingAction | null>(null);
  /** The request that produced the current loadFailure, so retryLoad repeats exactly that. */
  let lastRequest:
    | { readonly kind: 'random' }
    | { readonly kind: 'list' }
    | { readonly kind: 'chosen'; readonly ref: ScenarioRef; readonly key: string }
    | null = null;
  const clock = signal<VirtualClock | null>(null);
  const run = signal<Run | null>(null);
  /** Drops the simulation of the run in hand; the bridge keeps the quantities as they are. */
  const endRun = (): void => {
    run.peek()?.dispose();
    run.value = null;
  };
  const level = signal<Level>('easy');
  const levelPicked = signal(false);
  const onset = signal<RecordedOnset | null>(null);
  const variant = signal<RecordedVariant | null>(null);
  const recording = signal<Recording | null>(null);

  /** Running only: grades the recorded log at the run clock's time and shows the debrief. */
  const completeRun = (): void => {
    const current = scenario.peek();
    const runClock = clock.peek();
    if (screen.peek() !== 'running' || current === null || runClock === null) return;
    const graded: Recording = {
      scenarioId: current.id,
      completedAt: runClock.now(),
      // Only the pilot's actions are recorded; the changes of the simulation are regenerated by the replay.
      events: bridge.store
        .events()
        .filter((e) => e.source === 'user')
        .map((e) => ({ t: e.t, id: e.id, value: e.value })),
      ...(onset.peek() === null ? {} : { onset: onset.peek() }),
      ...(variant.peek() === null ? {} : { variant: variant.peek() }),
    };
    recording.value = graded;
    result.value = grade(current, env, graded);
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
  const start = (opened: Scenario, realistic: boolean): void => {
    const window = realistic ? opened.onset?.window_s : undefined;
    let drawn: RecordedOnset | null = null;
    if (window !== undefined) {
      const seed = Math.floor(rng() * SEED_RANGE);
      drawn = { at: onsetFromSeed(seed, window), seed };
    }
    let cause: RecordedVariant | null = null;
    if (opened.variants.length > 0) {
      const seed = Math.floor(rng() * SEED_RANGE);
      cause = { id: variantFromSeed(seed, opened.variants), seed };
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
      // clock stands at the outcome time, which is what complete() records as completedAt.
      if (state.outcome !== null && screen.peek() === 'running') completeRun();
    });
    bridge.setTimeSource(() => current.clock.now());
    scenario.value = opened;
    briefing.value = null;
    result.value = null;
    recording.value = null;
    onset.value = drawn;
    variant.value = cause;
    run.value = current;
    clock.value = current.clock;
    onRunStart();
    screen.value = 'running';
  };

  /** The scenario entries of every pack the policy allows, in manifest order (titles from the manifests). */
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
      return { ok: true, choices: listed };
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

  /** Opens a scenario through the seam and shows its briefing; a failure is kept for the screens. */
  const openBriefing = async (ref: ScenarioRef): Promise<void> => {
    const opened = await openScenario(packs, env, ref);
    if (!opened.ok) {
      loadFailure.value = opened;
      return;
    }
    // The briefing leaves the panel, the log and the last run untouched (D-14).
    briefing.value = {
      scenario: opened.scenario,
      branches: branchStatuses(opened.scenario, env),
    };
    choices.value = [];
    levelPicked.value = false;
    screen.value = 'briefing';
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
    if (screen.peek() === 'choosing') screen.value = 'free';
  };

  return {
    screen,
    scenario,
    briefing,
    result,
    busy,
    loadFailure,
    empty,
    choices,
    busyKey,
    confirm,
    clock,
    run,
    level,
    levelPicked,
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
    closeChooser() {
      if (screen.peek() !== 'choosing' || busy.peek()) return;
      choices.value = [];
      screen.value = 'free';
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
      confirm.value = null;
      // The run is dropped, never graded: no result, no clock, the panel at its defaults (U-03).
      bridge.reset({});
      bridge.setTimeSource(null);
      endRun();
      scenario.value = null;
      briefing.value = null;
      result.value = null;
      recording.value = null;
      onset.value = null;
      variant.value = null;
      clock.value = null;
      lastRequest = null;
      screen.value = 'free';
      if (pending === 'new') await runRandom();
      else await runList();
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
      else await runChosen(request.ref, request.key);
    },
    dismissFailure,
    setLevel(next) {
      const briefed = briefing.peek();
      if (screen.peek() !== 'briefing' || briefed === null) return;
      // D-05: Realistic shows no briefing; a scenario without an onset does not offer the level.
      if (next === 'realistic' && briefed.scenario.onset === undefined) return;
      level.value = next;
      levelPicked.value = true;
      if (next === 'realistic') begin(briefed, true);
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
      if (screen.peek() !== 'debrief') return;
      endRun();
      // A run timer cannot outlive its run (C-23): the lamps go dark, the quantities stay as left.
      bridge.setFlags({});
      clock.value = null;
      screen.value = 'free';
    },
  };
}
