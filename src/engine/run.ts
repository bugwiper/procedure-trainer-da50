// A live run (D-02): the virtual clock plus the incremental simulation over the panel store's log.
// The UI calls step() once per STEP_MS of elapsed real time; each step hands the simulation the
// events of the log that are due and moves the clock by STEP_MS. The run reads the log and never
// writes it, with one exception: when a reaction fires it raises the store's consumed watermark
// (D-03), so the event the reaction used can no longer be retracted. A retract of an event the
// simulation already applied rebuilds the state by replaying the remaining log (C-22). Because stepping and sim.ts simulate share one stepper and one event timing rule, a
// recording stepped live equals its replay at every step.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import { VirtualClock } from './clock';
import { STEP_MS, initSim, simulate, stepSim } from './sim';
import type { SimSetup, SimState } from './sim';
import type { PanelStore } from './store';

export interface RunConfig {
  readonly setup: SimSetup;
  readonly store: PanelStore;
  /** The quantities at t 0 (initialQuantities of the scenario). */
  readonly start: Readonly<Record<string, number>>;
}

export class Run {
  readonly clock = new VirtualClock();
  private readonly setup: SimSetup;
  private readonly store: PanelStore;
  private readonly start: Readonly<Record<string, number>>;
  private sim: SimState;
  /** Index into the store log of the next event not yet handed to the simulation. */
  private cursor = 0;
  private readonly listeners = new Set<(state: SimState) => void>();
  private readonly stopRetract: () => void;

  constructor(config: RunConfig) {
    this.setup = config.setup;
    this.store = config.store;
    this.start = config.start;
    this.sim = initSim(config.setup, config.start);
    // D-03, C-22: a retracted event the simulation already applied must leave no trace, so the
    // state is rebuilt by replaying the remaining log up to the current time. An event the
    // simulation has not applied yet (seq at or above the cursor) armed nothing and needs no rebuild.
    this.stopRetract = config.store.onRetract((event) => {
      if (event.seq >= this.cursor) return;
      this.cursor = config.store.events().length;
      this.sim = simulate(this.setup, {
        events: config.store.events(),
        start: this.start,
        untilMs: this.sim.t,
      }).state;
      for (const listener of [...this.listeners]) listener(this.sim);
    });
  }

  /** The simulated state at the start of the next step. */
  get state(): SimState {
    return this.sim;
  }

  /**
   * One STEP_MS step; does nothing while the clock is paused. Applies the log events whose time is
   * at most the current simulated time, in order, advances the simulation and the clock, then calls
   * the step listeners with the new state.
   */
  step(): void {
    if (this.clock.paused) return;
    const events = this.store.events();
    let end = this.cursor;
    for (;;) {
      const event = events[end];
      if (event === undefined || event.t > this.sim.t) break;
      end += 1;
    }
    const due = events.slice(this.cursor, end);
    const result = stepSim(this.setup, this.sim, due);
    this.sim = result.state;
    this.cursor = end;
    // C-21: a fired reaction consumes the newest event that started one (and so every older one).
    const newest = result.fired.at(-1);
    const fired = newest === undefined ? undefined : due[newest];
    if (fired !== undefined && fired.seq > this.store.consumedThrough) {
      this.store.markConsumed(fired.seq);
    }
    this.clock.advance(STEP_MS);
    for (const listener of [...this.listeners]) listener(this.sim);
  }

  onStep(listener: (state: SimState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Drops the step listeners and the retract subscription. */
  dispose(): void {
    this.listeners.clear();
    this.stopRetract();
  }
}
