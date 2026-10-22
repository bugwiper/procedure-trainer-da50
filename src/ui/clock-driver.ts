// The clock driver (SCN-08, D-02, T-02-31, T-03-01): turns real frames into whole simulation steps.
// The engine never reads a clock; this is the one module that is handed requestAnimationFrame and
// a real time source (App injects them), so the run stays deterministic and testable with fakes.
// Elapsed real time (at most MAX_FRAME_STEP_MS per frame, so at most 10 steps) collects in a carry;
// the driver calls run.step() once per whole STEP_MS of it and keeps the remainder, so the run
// clock only ever moves in whole steps. Time moves only while the run is live, the tab is visible
// and no modal is open; a pause adds nothing later because the last frame time is updated on every
// frame, and a new run starts with an empty carry.

import type { ReadonlySignal } from '@preact/signals';
import { STEP_MS } from '../engine/sim';
import type { Screen } from './session';

/** The largest real time one frame may add (a long frame or a returning tab). */
export const MAX_FRAME_STEP_MS = 1000;

/** What the driver steps: the session's Run satisfies it. */
export interface Steppable {
  step(): void;
}

/** The part of the session the driver reads. */
export interface ClockDriverSession {
  readonly screen: ReadonlySignal<Screen>;
  /** The simulation of the current run; null outside a run. */
  readonly run: ReadonlySignal<Steppable | null>;
}

export interface ClockDriverDeps {
  readonly session: ClockDriverSession;
  /** Schedules one callback for the next frame; returns a handle for cancelRaf. */
  readonly raf: (run: () => void) => number;
  readonly cancelRaf: (handle: number) => void;
  /** Real time in ms, e.g. performance.now. */
  readonly now: () => number;
  /** True while the tab is not visible. */
  readonly hidden: () => boolean;
  /** True while a modal is open. */
  readonly blocked: () => boolean;
}

/** Starts the frame loop; the returned function stops it. */
export function attachClockDriver(deps: ClockDriverDeps): () => void {
  const { session, raf, cancelRaf, now, hidden, blocked } = deps;
  let last = now();
  let handle = 0;
  let detached = false;
  let carry = 0;
  let stepped: Steppable | null = null;

  const frame = (): void => {
    const at = now();
    const elapsed = at - last;
    last = at;
    const run = session.run.peek();
    if (run !== stepped) {
      stepped = run;
      carry = 0;
    }
    if (run !== null && session.screen.peek() === 'running' && !hidden() && !blocked()) {
      carry += Math.min(Math.max(elapsed, 0), MAX_FRAME_STEP_MS);
      while (carry >= STEP_MS) {
        run.step();
        carry -= STEP_MS;
      }
    }
    if (!detached) handle = raf(frame);
  };

  handle = raf(frame);
  return () => {
    detached = true;
    cancelRaf(handle);
  };
}
