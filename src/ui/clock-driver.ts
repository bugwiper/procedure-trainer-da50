// The clock driver (SCN-08, T-02-31): turns real frames into virtual run time. The engine never
// reads a clock; this is the one module that is handed requestAnimationFrame and a real time
// source (App injects them), so the run clock stays deterministic and testable with fakes. Time
// moves only while the run is live, the tab is visible and no modal is open, and never by more
// than MAX_FRAME_STEP_MS per frame; a pause adds nothing later because the last frame time is
// updated on every frame.

import type { ReadonlySignal } from '@preact/signals';
import type { VirtualClock } from '../engine/clock';
import type { Screen } from './session';

/** The largest step one frame may add to the run clock (a long frame or a returning tab). */
export const MAX_FRAME_STEP_MS = 1000;

/** The part of the session the driver reads. */
export interface ClockDriverSession {
  readonly screen: ReadonlySignal<Screen>;
  readonly clock: ReadonlySignal<VirtualClock | null>;
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

  const frame = (): void => {
    const at = now();
    const elapsed = at - last;
    last = at;
    if (session.screen.peek() === 'running' && !hidden() && !blocked()) {
      const clock = session.clock.peek();
      if (clock !== null) clock.advance(Math.min(Math.max(elapsed, 0), MAX_FRAME_STEP_MS));
    }
    if (!detached) handle = raf(frame);
  };

  handle = raf(frame);
  return () => {
    detached = true;
    cancelRaf(handle);
  };
}
