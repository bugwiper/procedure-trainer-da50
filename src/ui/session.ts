// The session machine (D-14, D-15, D-16, D-18, SES-01, SES-03, SES-04): which screen the app is on
// (free, briefing, running, debrief), how a run starts from a scenario and how it ends in a grade. No router;
// the screen is a signal. This module has no DOM access, so it is unit tested in node. The UI owns
// randomness (rng) and real time (the frame driver steps the run's simulation, which advances its
// VirtualClock in whole steps); the engine never sees either. A run is a Run (D-01, D-02): the
// simulation of the quantities over the store log, whose steps feed the bridge; it exists from
// Start run until the debrief closes or the run is left. It also holds the difficulty level (Easy or Medium, phase 02.1): display
// state chosen in the briefing; grade never receives it.

import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import type { VirtualClock } from '../engine/clock';
import type { AircraftEnv } from '../engine/env';
import { branchStatuses, grade } from '../engine/grading';
import type { BranchVerdict, GradeResult, Recording } from '../engine/grading';
import { initialQuantities } from '../engine/predicates';
import { Run } from '../engine/run';
import { simSetup } from '../engine/sim';
import { openScenario } from '../scenario/packs';
import type { AccessPolicy, OpenResult, PackProvider, ScenarioRef } from '../scenario/packs';
import type { Scenario } from '../scenario/schema';
import type { PanelBridge } from './bridge';

export type Screen = 'free' | 'choosing' | 'briefing' | 'running' | 'debrief';

/** The difficulty level of a run (phase 02.1): Easy briefs with the checklist, Medium without it. */
export type Level = 'easy' | 'medium';

/** The levels in display order. */
export const LEVELS: readonly Level[] = ['easy', 'medium'];

/** The display name of each level, as the briefing buttons and the debrief print it. */
export const LEVEL_NAMES: Readonly<Record<Level, string>> = { easy: 'Easy', medium: 'Medium' };

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
   * defaults and the quantities to idle, then performs the action that was asked for.
   */
  leaveRun(): Promise<void>;
  /** Repeats the failed request (a random pick again, or the same chosen entry). */
  retryLoad(): Promise<void>;
  /** Closes the load-error message; the area returns to the free panel. */
  dismissFailure(): void;
  /**
   * Briefing only: sets the level. On any other screen it does nothing, so the level of a run
   * cannot change between Start run and its debrief.
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

  /** Table N1 "start": baseline without an event, a fresh clock, then the screen. */
  const start = (opened: Scenario): void => {
    const setup = simSetup(env, opened);
    const startQuantities = initialQuantities(opened, env.quantities);
    bridge.reset(opened.initial.controls, opened.initial.quantities);
    endRun();
    const current = new Run({ setup, store: bridge.store, start: startQuantities });
    current.onStep((state) => {
      bridge.setQuantities(state.quantities);
    });
    bridge.setTimeSource(() => current.clock.now());
    scenario.value = opened;
    briefing.value = null;
    result.value = null;
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
      clock.value = null;
      lastRequest = null;
      screen.value = 'free';
      if (pending === 'new') await runRandom();
      else await runList();
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
      if (screen.peek() !== 'briefing') return;
      level.value = next;
      levelPicked.value = true;
    },
    startRun() {
      const briefed = briefing.peek();
      if (screen.peek() !== 'briefing' || briefed === null) return;
      try {
        start(briefed.scenario);
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
    },
    backToPanel() {
      if (screen.peek() !== 'briefing') return;
      briefing.value = null;
      screen.value = 'free';
    },
    complete() {
      const current = scenario.peek();
      const runClock = clock.peek();
      if (screen.peek() !== 'running' || current === null || runClock === null) return;
      const recording: Recording = {
        scenarioId: current.id,
        completedAt: runClock.now(),
        events: bridge.store.events().map((e) => ({ t: e.t, id: e.id, value: e.value })),
      };
      result.value = grade(current, env, recording);
      runClock.pause();
      bridge.setTimeSource(null);
      screen.value = 'debrief';
    },
    closeDebrief() {
      if (screen.peek() !== 'debrief') return;
      endRun();
      clock.value = null;
      screen.value = 'free';
    },
  };
}
