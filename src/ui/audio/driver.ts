// The aural driver (Phase 5, A-02): looks at the run on every frame and on every change that can
// pause it, and hands aural.ts's decisions to the sound player. Sound only while a run is live:
// none on the free panel, in the briefing or the debrief, while a modal is open or the tab is
// hidden. It only reads (the annunciations, the rpm, the run time); it never changes the run, and
// a sound is never feedback on right or wrong. Real frames and the page state are injected, so the
// rules are tested with fakes.

import type { ActiveCas } from '../../engine/cas';
import { AURAL_START, auralStep, engineSound } from './aural';
import type { AuralState } from './aural';
import type { SoundPlayer } from './web-audio';

export interface AuralDeps {
  readonly player: SoundPlayer;
  /** True while the pilot has the sound on (the remembered choice). */
  readonly wanted: () => boolean;
  /** True on the running screen (a run exists and has not ended). */
  readonly running: () => boolean;
  /** True while a modal is open. */
  readonly blocked: () => boolean;
  /** True while the tab is not visible. */
  readonly hidden: () => boolean;
  readonly cas: () => readonly ActiveCas[];
  readonly rpm: () => number;
  /** The run clock in ms, or null without a run. */
  readonly runMs: () => number | null;
  readonly raf: (run: () => void) => number;
  readonly cancelRaf: (handle: number) => void;
}

export interface Aural {
  /** One look at the run; called on every frame and when a modal, the screen or visibility changes. */
  update(): void;
  /** A press or key anywhere: the first one arms a remembered "on" and resumes a held-back context. */
  press(): void;
  detach(): void;
}

export function attachAural(deps: AuralDeps): Aural {
  const { player } = deps;
  let state: AuralState = AURAL_START;
  let wasLive = false;
  let handle = 0;
  let detached = false;

  const silence = (): void => {
    player.setEngine(0, 0);
    player.suspend();
  };

  const update = (): void => {
    if (!deps.running()) {
      state = AURAL_START;
      wasLive = false;
      silence();
      return;
    }
    const live = !deps.blocked() && !deps.hidden();
    if (!live) {
      wasLive = false;
      silence();
      return;
    }
    if (!wasLive) {
      wasLive = true;
      player.resume();
    }
    const step = auralStep(state, deps.cas(), deps.runMs() ?? 0);
    state = step.state;
    if (!deps.wanted() || !player.enabled()) return;
    for (const tone of step.tones) player.tone(tone);
    const engine = engineSound(deps.rpm());
    player.setEngine(engine.hz, engine.gain);
  };

  const frame = (): void => {
    if (!detached) handle = deps.raf(frame);
    update();
  };
  handle = deps.raf(frame);

  return {
    update,
    press() {
      if (deps.wanted() && !player.enabled()) player.enable();
      if (deps.wanted() && wasLive) player.resume();
    },
    detach() {
      detached = true;
      deps.cancelRaf(handle);
      silence();
    },
  };
}
