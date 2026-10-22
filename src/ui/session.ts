// The session machine (D-14, D-15, D-16, D-18, SES-01, SES-03, SES-04): which screen the app is on
// (free, briefing, running, debrief), how a run starts from a scenario and how it ends in a grade. No router;
// the screen is a signal. This module has no DOM access, so it is unit tested in node. The UI owns
// randomness (rng) and real time (the frame driver of plan 09 advances the run's VirtualClock);
// the engine never sees either.

import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import { VirtualClock } from '../engine/clock';
import type { AircraftEnv } from '../engine/env';
import { branchStatuses, grade } from '../engine/grading';
import type { BranchVerdict, GradeResult, Recording } from '../engine/grading';
import { openScenario } from '../scenario/packs';
import type { AccessPolicy, OpenResult, PackProvider, ScenarioRef } from '../scenario/packs';
import type { Scenario } from '../scenario/schema';
import type { PanelBridge } from './bridge';

export type Screen = 'free' | 'choosing' | 'briefing' | 'running' | 'debrief';

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
  /** True when a listing found no allowed scenario (the "No situations available" message). */
  readonly empty: ReadonlySignal<boolean>;
  /** The entries the choose view lists, in manifest order; filled by openChooser. */
  readonly choices: ReadonlySignal<readonly Choice[]>;
  /** The session-hit id of the button that started the current load; null otherwise. */
  readonly busyKey: ReadonlySignal<string | null>;
  /** The virtual clock of the current run; null outside a run. */
  readonly clock: ReadonlySignal<VirtualClock | null>;
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
  const clock = signal<VirtualClock | null>(null);

  /** Table N1 "start": baseline without an event, a fresh clock, then the screen. */
  const start = (opened: Scenario): void => {
    bridge.reset(opened.initial.controls, opened.initial.quantities);
    const runClock = new VirtualClock();
    bridge.setTimeSource(() => runClock.now());
    scenario.value = opened;
    briefing.value = null;
    result.value = null;
    clock.value = runClock;
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
    screen.value = 'briefing';
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
    clock,
    async newSituation() {
      if (screen.peek() !== 'free' || busy.peek()) return;
      await loading('session.new', async () => {
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
    },
    async openChooser() {
      if (screen.peek() !== 'free' || busy.peek()) return;
      await loading('session.choose', async () => {
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
    },
    closeChooser() {
      if (screen.peek() !== 'choosing' || busy.peek()) return;
      choices.value = [];
      screen.value = 'free';
    },
    async chooseScenario(ref, key = `session.row.${ref.pack}.${ref.scenario}`) {
      if (screen.peek() !== 'choosing' || busy.peek()) return;
      await loading(key, () => openBriefing(ref));
    },
    dismissEmpty() {
      empty.value = false;
    },
    startRun() {
      const briefed = briefing.peek();
      if (screen.peek() !== 'briefing' || briefed === null) return;
      try {
        start(briefed.scenario);
      } catch (error) {
        // An illegal baseline changes nothing (bridge.reset); lint should have caught it.
        briefing.value = null;
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
      clock.value = null;
      screen.value = 'free';
    },
  };
}
