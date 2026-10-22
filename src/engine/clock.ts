// Virtual scenario clock (SCN-08): time moves only when the owner calls advance. The engine never
// reads a real clock; the UI converts real time into clamped steps (and pauses on a hidden tab or
// an open dialog), so a scenario replays identically and tests step through time instantly.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

export class VirtualClock {
  private time = 0;
  private isPaused = false;

  /** Milliseconds of scenario time elapsed. */
  now(): number {
    return this.time;
  }

  /**
   * Moves time forward by dtMs; ignored while paused. Throws RangeError unless dtMs is a finite
   * number of at least 0, also while paused (a bad step is a caller bug either way).
   */
  advance(dtMs: number): void {
    if (!Number.isFinite(dtMs) || dtMs < 0) {
      throw new RangeError(`clock step must be a finite number >= 0 (got ${String(dtMs)})`);
    }
    if (this.isPaused) return;
    this.time += dtMs;
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  get paused(): boolean {
    return this.isPaused;
  }
}
