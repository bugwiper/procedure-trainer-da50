// The Web Audio glue (Phase 5, A-01 to A-04): owns the one AudioContext behind an injected factory
// and plays the sounds of a SoundBank. Nothing exists before enable(), which the app calls inside
// the pilot's tap on the footer control Sound (an autoplay rule), or at the first press anywhere
// when the choice was remembered. This module decides nothing about when a sound is due; the
// driver (driver.ts) does, from aural.ts. `stats` is what the e2e build exposes, so a spec can see
// that a sound was requested without hearing it.

import type { ToneName } from './aural';
import { SYNTH_BANK } from './sounds';
import type { EngineHandle, SoundBank } from './sounds';

/** Overall level of everything the app plays. */
export const MASTER_GAIN = 0.8;

export interface SoundStats {
  /** True once a context exists and the pilot has the sound on. */
  readonly enabled: boolean;
  /** Tones asked for since the page loaded. */
  readonly tones: number;
  readonly lastTone: ToneName | null;
  /** The engine sound's pitch and level as last asked for; 0 and 0 while silent. */
  readonly engineHz: number;
  readonly engineGain: number;
}

export interface SoundPlayer {
  /** Creates the context (once) and starts it; false where Web Audio is missing. */
  enable(): boolean;
  /** Silences everything; enable() brings the same context back. */
  disable(): void;
  enabled(): boolean;
  /** Plays a one-shot now; ignored unless enabled. */
  tone(name: ToneName): void;
  /** Sets the engine sound; hz and gain 0 mean silent. Ignored unless enabled. */
  setEngine(hz: number, gain: number): void;
  /** Pauses the context (a modal, a hidden tab, no run); the engine goes silent first. */
  suspend(): void;
  /** Resumes a context that is paused or was held back by the browser's autoplay rule. */
  resume(): void;
  readonly stats: SoundStats;
}

/** Read-only view for e2e specs; exists only in the e2e build (VITE_TEST_HOOKS=1). */
export interface SoundTestHook {
  enabled(): boolean;
  tones(): number;
  lastTone(): ToneName | null;
  engineHz(): number;
  engineGain(): number;
}

declare global {
  interface Window {
    __panelAudio?: SoundTestHook;
  }
}

export function createSoundPlayer(
  factory: () => AudioContext | null,
  bank: SoundBank = SYNTH_BANK,
): SoundPlayer {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let engine: EngineHandle | null = null;
  let on = false;
  let tones = 0;
  let lastTone: ToneName | null = null;
  let engineHz = 0;
  let engineGain = 0;

  const run = (promise: Promise<void> | undefined): void => {
    // A blocked or refused resume is not an error for the app; the next press tries again.
    promise?.catch(() => undefined);
  };

  const player: SoundPlayer = {
    enable() {
      if (ctx === null) {
        try {
          ctx = factory();
        } catch {
          ctx = null;
        }
        if (ctx === null) return false;
        master = ctx.createGain();
        master.gain.value = MASTER_GAIN;
        master.connect(ctx.destination);
      }
      on = true;
      player.resume();
      return true;
    },
    disable() {
      player.setEngine(0, 0);
      on = false;
      player.suspend();
    },
    enabled: () => on,
    tone(name) {
      if (!on || ctx === null || master === null) return;
      bank[name].play(ctx, master, ctx.currentTime);
      tones = tones + 1;
      lastTone = name;
    },
    setEngine(hz, gain) {
      if (!on || ctx === null || master === null) return;
      if (!(gain > 0) && !(engineGain > 0)) return;
      if (engine === null) {
        if (!(gain > 0)) return;
        engine = bank.engine.start(ctx, master);
      }
      engine.set(hz, gain);
      engineHz = hz;
      engineGain = gain;
    },
    suspend() {
      if (ctx === null) return;
      if (engine !== null && engineGain > 0) player.setEngine(0, 0);
      if (ctx.state === 'running') run(ctx.suspend());
    },
    resume() {
      if (ctx === null || !on) return;
      if (ctx.state !== 'running') run(ctx.resume());
    },
    get stats() {
      return { enabled: on, tones, lastTone, engineHz, engineGain };
    },
  };
  return player;
}

/** The browser's AudioContext (prefixed in old WebKit), or null where there is none. */
export function browserAudioContext(): AudioContext | null {
  const host = globalThis as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = host.AudioContext ?? host.webkitAudioContext;
  return Ctor === undefined ? null : new Ctor();
}
