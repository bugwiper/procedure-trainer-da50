// The session machine (D-14, D-15, D-16, D-18, SES-01, SES-03, SES-04): which screen the app is on
// (free, running, debrief), how a run starts from a scenario and how it ends in a grade. No router;
// the screen is a signal. This module has no DOM access, so it is unit tested in node. The UI owns
// randomness (rng) and real time (the frame driver of plan 09 advances the run's VirtualClock);
// the engine never sees either.

import { signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import { VirtualClock } from '../engine/clock';
import type { AircraftEnv } from '../engine/env';
import { grade } from '../engine/grading';
import type { GradeResult, Recording } from '../engine/grading';
import { openScenario } from '../scenario/packs';
import type { AccessPolicy, OpenResult, PackProvider, ScenarioRef } from '../scenario/packs';
import type { Scenario } from '../scenario/schema';
import type { PanelBridge } from './bridge';

export type Screen = 'free' | 'running' | 'debrief';

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
  /** The scenario of the current or last run. */
  readonly scenario: ReadonlySignal<Scenario | null>;
  /** The grade of the last run; null until graded, cleared at the next start. */
  readonly result: ReadonlySignal<GradeResult | null>;
  /** True while a pack loads; presses on the session area are ignored meanwhile. */
  readonly busy: ReadonlySignal<boolean>;
  readonly loadFailure: ReadonlySignal<LoadFailure | null>;
  /** The virtual clock of the current run; null outside a run. */
  readonly clock: ReadonlySignal<VirtualClock | null>;
  /** Free and not busy only: opens one random allowed scenario and starts the run. */
  newSituation(): Promise<void>;
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
  const result = signal<GradeResult | null>(null);
  const busy = signal(false);
  const loadFailure = signal<LoadFailure | null>(null);
  const clock = signal<VirtualClock | null>(null);

  /** Table N1 "start": baseline without an event, a fresh clock, then the screen. */
  const start = (opened: Scenario): void => {
    bridge.reset(opened.initial.controls, opened.initial.quantities);
    const runClock = new VirtualClock();
    bridge.setTimeSource(() => runClock.now());
    scenario.value = opened;
    result.value = null;
    clock.value = runClock;
    onRunStart();
    screen.value = 'running';
  };

  /** The scenario entries of every pack the policy allows, in manifest order. */
  const allowedRefs = async (): Promise<
    { readonly ok: true; readonly refs: ScenarioRef[] } | LoadFailure
  > => {
    const metas = await packs.provider.listPacks();
    const refs: ScenarioRef[] = [];
    let denied = false;
    for (const meta of metas) {
      if (!(await allowed(packs.policy, meta.id))) {
        denied = true;
        continue;
      }
      for (const entry of meta.scenarios) refs.push({ pack: meta.id, scenario: entry.id });
    }
    if (refs.length > 0) return { ok: true, refs };
    return denied
      ? failure('denied', 'no pack is open')
      : failure('missing', 'no situations available');
  };

  return {
    screen,
    scenario,
    result,
    busy,
    loadFailure,
    clock,
    async newSituation() {
      if (screen.peek() !== 'free' || busy.peek()) return;
      busy.value = true;
      loadFailure.value = null;
      try {
        let listed: Awaited<ReturnType<typeof allowedRefs>>;
        try {
          listed = await allowedRefs();
        } catch (error) {
          listed = failure('load-failed', error instanceof Error ? error.message : 'unknown error');
        }
        if (!listed.ok) {
          loadFailure.value = listed;
          return;
        }
        const opened = await openScenario(packs, env, pickRandom(listed.refs, rng));
        if (!opened.ok) {
          loadFailure.value = opened;
          return;
        }
        try {
          start(opened.scenario);
        } catch (error) {
          // An illegal baseline changes nothing (bridge.reset); lint should have caught it.
          loadFailure.value = failure(
            'invalid',
            error instanceof Error ? error.message : 'the baseline could not be applied',
          );
        }
      } finally {
        busy.value = false;
      }
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
