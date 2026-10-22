// A live run (D-02): the virtual clock plus the incremental simulation over the panel store's log.
// The UI calls step() once per STEP_MS of elapsed real time; each step hands the simulation the
// events of the log that are due and moves the clock by STEP_MS. The run reads the log and never
// writes it. Because stepping and sim.ts simulate share one stepper and one event timing rule, a
// recording stepped live equals its replay at every step.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import { VirtualClock } from './clock';
import { STEP_MS, initSim, stepSim } from './sim';
import type { SimSetup, SimState } from './sim';
import { deriveState } from './store';
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
  private sim: SimState;
  /** Index into the store log of the next event not yet handed to the simulation. */
  private cursor = 0;
  private readonly listeners = new Set<(state: SimState) => void>();
  private readonly stopRetract: () => void;

  constructor(config: RunConfig) {
    this.setup = config.setup;
    this.store = config.store;
    this.sim = initSim(config.setup, config.start);
    // A retracted event the simulation already applied must leave its controls too: rebuild them
    // from the remaining log and take the cursor back, else the next event would be skipped.
    this.stopRetract = config.store.onRetract((event) => {
      if (event.seq >= this.cursor) return;
      this.cursor = event.seq;
      this.sim = {
        ...this.sim,
        controls: deriveState(
          config.store.registry,
          config.store.events(),
          config.store.baseline(),
        ),
      };
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
    this.sim = stepSim(this.setup, this.sim, events.slice(this.cursor, end)).state;
    this.cursor = end;
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
