// The sounds of the app, one small module with one entry per name: caution, warning, engine
// (Phase 5, owner answer of 2026-10-27). Today every sound is synthesised with Web Audio. To use a
// real recording later, replace the entry in SYNTH_BANK (or hand web-audio.ts another SoundBank):
// a one-shot decodes its file once and plays an AudioBufferSourceNode, the engine loops its file and
// follows the rpm through the playbackRate and the gain. Nothing outside this file knows how a
// sound is made; aural.ts decides when and web-audio.ts owns the context.

import { mulberry32 } from '../../engine/sim';

/** The name of every sound the app can make. */
export type SoundName = 'caution' | 'warning' | 'engine';

/** A sound that plays once, from the given context time. */
export interface OneShot {
  play(ctx: AudioContext, out: AudioNode, at: number): void;
}

/** The running engine sound: set follows the rpm, stop ends it. */
export interface EngineHandle {
  set(hz: number, gain: number): void;
  stop(): void;
}

export interface EngineSoundSource {
  start(ctx: AudioContext, out: AudioNode): EngineHandle;
}

export interface SoundBank {
  readonly caution: OneShot;
  readonly warning: OneShot;
  readonly engine: EngineSoundSource;
}

// Instructor-review values.
/** Caution: one short sine "bing". */
const CAUTION_HZ = 880;
const CAUTION_SECONDS = 0.28;
const CAUTION_GAIN = 0.2;
/** Warning: three triangle pulses, each on for PULSE_ON and then off for PULSE_OFF. */
const WARNING_HZ = 1175;
const WARNING_PULSES = 3;
const WARNING_PULSE_ON = 0.12;
const WARNING_PULSE_OFF = 0.09;
const WARNING_GAIN = 0.16;
/** Envelope edges so a tone starts and ends without a click. */
const ATTACK = 0.008;
/** Engine: a second saw a little off pitch, and a share of filtered noise. */
const ENGINE_DETUNE = 1.013;
const ENGINE_FILTER_HZ = 420;
const ENGINE_NOISE_SHARE = 0.6;
const ENGINE_NOISE_SECONDS = 2;
const ENGINE_NOISE_SEED = 5071;
/** How fast the engine follows a new pitch or level (time constant in seconds). */
const ENGINE_SMOOTH = 0.18;

function beep(
  ctx: AudioContext,
  out: AudioNode,
  type: OscillatorType,
  hz: number,
  at: number,
  seconds: number,
  peak: number,
): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(peak, at + ATTACK);
  env.gain.linearRampToValueAtTime(0, at + seconds);
  osc.connect(env);
  env.connect(out);
  osc.start(at);
  osc.stop(at + seconds + ATTACK);
}

const cautionSound: OneShot = {
  play(ctx, out, at) {
    beep(ctx, out, 'sine', CAUTION_HZ, at, CAUTION_SECONDS, CAUTION_GAIN);
  },
};

const warningSound: OneShot = {
  play(ctx, out, at) {
    for (let pulse = 0; pulse < WARNING_PULSES; pulse = pulse + 1) {
      const start = at + pulse * (WARNING_PULSE_ON + WARNING_PULSE_OFF);
      beep(ctx, out, 'triangle', WARNING_HZ, start, WARNING_PULSE_ON, WARNING_GAIN);
    }
  },
};

const engineSource: EngineSoundSource = {
  start(ctx, out) {
    const master = ctx.createGain();
    master.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = ENGINE_FILTER_HZ;
    filter.connect(master);
    master.connect(out);
    const low = ctx.createOscillator();
    const high = ctx.createOscillator();
    low.type = 'sawtooth';
    high.type = 'sawtooth';
    low.frequency.value = 0;
    high.frequency.value = 0;
    low.connect(filter);
    high.connect(filter);
    // Noise from a seeded generator (no Math.random), looped.
    const frames = Math.floor(ctx.sampleRate * ENGINE_NOISE_SECONDS);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const next = mulberry32(ENGINE_NOISE_SEED);
    for (let i = 0; i < frames; i = i + 1) data[i] = (next() - 0.5) * 2 * ENGINE_NOISE_SHARE;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    noise.connect(filter);
    const now = ctx.currentTime;
    low.start(now);
    high.start(now);
    noise.start(now);
    return {
      set(hz, gain) {
        const at = ctx.currentTime;
        low.frequency.setTargetAtTime(hz, at, ENGINE_SMOOTH);
        high.frequency.setTargetAtTime(hz * ENGINE_DETUNE, at, ENGINE_SMOOTH);
        master.gain.setTargetAtTime(gain, at, ENGINE_SMOOTH);
      },
      stop() {
        const at = ctx.currentTime;
        master.gain.setTargetAtTime(0, at, ENGINE_SMOOTH);
        low.stop(at + 1);
        high.stop(at + 1);
        noise.stop(at + 1);
      },
    };
  },
};

/** The synthesised sounds; the one place to swap in recordings. */
export const SYNTH_BANK: SoundBank = {
  caution: cautionSound,
  warning: warningSound,
  engine: engineSource,
};
