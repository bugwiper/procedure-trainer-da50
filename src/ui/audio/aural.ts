// The aural rules (Phase 5, A-02 to A-04): which tone a change of the annunciations asks for, when
// a warning repeats, and the pitch and level of the engine sound for a given rpm. Pure TypeScript
// over plain numbers (only + - * /), no Web Audio and no DOM, so every rule is unit tested in node.
// The sounds themselves (what a "caution" or an "engine" sounds like) live in sounds.ts. A tone is
// the aircraft's own sound, never feedback on right or wrong.

import type { ActiveCas } from '../../engine/cas';

/** The one-shot tones. A caution appearing is one short "bing"; a warning appearing is a pulsed tone. */
export type ToneName = 'caution' | 'warning';

/** A warning that stays active repeats its tone this often (run time, so a pause adds nothing). */
export const WARNING_REPEAT_MS = 4000;
/** At most this many repeats follow the first tone of a warning. */
export const WARNING_REPEAT_MAX = 5;

/** What the rules remember between two looks at the run. */
export interface AuralState {
  /** Ids of the messages that were active at the last look. */
  readonly known: readonly string[];
  /** Run time in ms of the last warning tone; null while no warning is active. */
  readonly lastWarningAt: number | null;
  /** Repeats sounded since the first tone of the current warning. */
  readonly repeats: number;
}

export const AURAL_START: AuralState = { known: [], lastWarningAt: null, repeats: 0 };

export interface AuralStep {
  readonly state: AuralState;
  /** The tones to sound now, in order; usually none. */
  readonly tones: readonly ToneName[];
}

/**
 * One look at the run: the active messages and the run time in ms. A message that was not active at
 * the last look is new. A new warning sounds the warning tone (and starts its repeat count), a new
 * caution the caution tone; a warning that stays active repeats every WARNING_REPEAT_MS, at most
 * WARNING_REPEAT_MAX times.
 */
export function auralStep(state: AuralState, cas: readonly ActiveCas[], runMs: number): AuralStep {
  const fresh = cas.filter((message) => !state.known.includes(message.id));
  const warnings = cas.filter((message) => message.level === 'warning');
  const tones: ToneName[] = [];
  let lastWarningAt = state.lastWarningAt;
  let repeats = state.repeats;
  if (warnings.length === 0) {
    lastWarningAt = null;
    repeats = 0;
  } else if (fresh.some((message) => message.level === 'warning')) {
    tones.push('warning');
    lastWarningAt = runMs;
    repeats = 0;
  } else if (
    lastWarningAt !== null &&
    repeats < WARNING_REPEAT_MAX &&
    runMs - lastWarningAt >= WARNING_REPEAT_MS
  ) {
    tones.push('warning');
    lastWarningAt = runMs;
    repeats = repeats + 1;
  }
  if (fresh.some((message) => message.level === 'caution')) tones.push('caution');
  return {
    state: { known: cas.map((message) => message.id), lastWarningAt, repeats },
    tones,
  };
}

// The engine sound follows the rpm quantity. Instructor-review values, all in one place.
/** The rpm at which the sound reaches its full pitch and level (about the cruise rpm). */
export const ENGINE_RPM_REF = 2300;
/** Below this rpm the engine counts as stopped and is silent (a run-down tail never reaches 0 exactly). */
export const ENGINE_RPM_STOPPED = 100;
/** The fundamental in Hz at an rpm of 0. */
export const ENGINE_HZ_IDLE = 48;
/** How far the fundamental rises from rpm 0 to ENGINE_RPM_REF, in Hz. */
export const ENGINE_HZ_SPAN = 62;
/** The gain at ENGINE_RPM_REF: a low background level. */
export const ENGINE_GAIN_REF = 0.07;
/** Pitch and level stop rising at this share of ENGINE_RPM_REF. */
export const ENGINE_GAIN_CAP = 1.25;

export interface EngineSound {
  /** The fundamental in Hz. */
  readonly hz: number;
  /** The output gain; 0 means silent. */
  readonly gain: number;
}

/** Pitch and level for an rpm; silent below ENGINE_RPM_STOPPED, rising with the rpm, level capped. */
export function engineSound(rpm: number): EngineSound {
  if (!(rpm >= ENGINE_RPM_STOPPED)) return { hz: 0, gain: 0 };
  const share = rpm / ENGINE_RPM_REF;
  const capped = share > ENGINE_GAIN_CAP ? ENGINE_GAIN_CAP : share;
  return { hz: ENGINE_HZ_IDLE + capped * ENGINE_HZ_SPAN, gain: capped * ENGINE_GAIN_REF };
}
