import { describe, expect, it } from 'vitest';
import type { ActiveCas } from '../src/engine/cas';
import {
  AURAL_START,
  ENGINE_GAIN_CAP,
  ENGINE_RPM_REF,
  ENGINE_RPM_STOPPED,
  WARNING_REPEAT_MAX,
  WARNING_REPEAT_MS,
  auralStep,
  engineSound,
} from '../src/ui/audio/aural';
import type { AuralState } from '../src/ui/audio/aural';

// The aural rules (Phase 5, A-02 to A-04): pure, over plain lists and numbers.

const caution: ActiveCas = { id: 'c1', text: 'C ONE', level: 'caution' };
const caution2: ActiveCas = { id: 'c2', text: 'C TWO', level: 'caution' };
const warning: ActiveCas = { id: 'w1', text: 'W ONE', level: 'warning' };

function run(frames: readonly (readonly [number, readonly ActiveCas[]])[]): {
  tones: string[];
  state: AuralState;
} {
  let state = AURAL_START;
  const tones: string[] = [];
  for (const [ms, cas] of frames) {
    const step = auralStep(state, cas, ms);
    state = step.state;
    tones.push(...step.tones);
  }
  return { tones, state };
}

describe('auralStep: the tone a change of the annunciations asks for', () => {
  it('is silent without messages and stays silent', () => {
    expect(
      run([
        [0, []],
        [100, []],
      ]).tones,
    ).toEqual([]);
  });

  it('gives one caution tone when a caution appears, none while it stays', () => {
    expect(
      run([
        [0, []],
        [100, [caution]],
        [200, [caution]],
        [5000, [caution]],
      ]).tones,
    ).toEqual(['caution']);
  });

  it('gives a caution tone for each further caution that appears', () => {
    expect(
      run([
        [0, [caution]],
        [100, [caution, caution2]],
      ]).tones,
    ).toEqual(['caution', 'caution']);
  });

  it('gives a warning tone when a warning appears', () => {
    expect(
      run([
        [0, []],
        [100, [warning]],
      ]).tones,
    ).toEqual(['warning']);
  });

  it('sounds a message that is active at the first look, as it appears', () => {
    expect(run([[0, [warning]]]).tones).toEqual(['warning']);
  });

  it('sounds again when a message goes away and comes back', () => {
    expect(
      run([
        [0, [caution]],
        [100, []],
        [200, [caution]],
      ]).tones,
    ).toEqual(['caution', 'caution']);
  });

  it('gives one warning tone and the caution tone when both appear together', () => {
    expect(run([[0, [warning, caution]]]).tones).toEqual(['warning', 'caution']);
  });
});

describe('auralStep: the warning repeat', () => {
  it('repeats every WARNING_REPEAT_MS while the warning stays, at most WARNING_REPEAT_MAX times', () => {
    const frames: [number, readonly ActiveCas[]][] = [];
    for (let ms = 0; ms <= WARNING_REPEAT_MS * (WARNING_REPEAT_MAX + 4); ms += 100) {
      frames.push([ms, [warning]]);
    }
    const { tones } = run(frames);
    expect(tones).toHaveLength(1 + WARNING_REPEAT_MAX);
    expect(new Set(tones)).toEqual(new Set(['warning']));
  });

  it('does not repeat before the interval has passed', () => {
    expect(
      run([
        [0, [warning]],
        [WARNING_REPEAT_MS - 100, [warning]],
      ]).tones,
    ).toEqual(['warning']);
    expect(
      run([
        [0, [warning]],
        [WARNING_REPEAT_MS, [warning]],
      ]).tones,
    ).toEqual(['warning', 'warning']);
  });

  it('stops when the warning goes and starts afresh with a full count when it returns', () => {
    const { tones, state } = run([
      [0, [warning]],
      [WARNING_REPEAT_MS, [warning]],
      [WARNING_REPEAT_MS + 100, []],
      [WARNING_REPEAT_MS + 200, [warning]],
    ]);
    expect(tones).toEqual(['warning', 'warning', 'warning']);
    expect(state.repeats).toBe(0);
  });

  it('does not repeat a caution', () => {
    expect(
      run([
        [0, [caution]],
        [WARNING_REPEAT_MS * 3, [caution]],
      ]).tones,
    ).toEqual(['caution']);
  });
});

describe('engineSound', () => {
  it('is silent at rpm 0, below and in the run-down tail under ENGINE_RPM_STOPPED', () => {
    expect(engineSound(0)).toEqual({ hz: 0, gain: 0 });
    expect(engineSound(-5)).toEqual({ hz: 0, gain: 0 });
    expect(engineSound(ENGINE_RPM_STOPPED - 1)).toEqual({ hz: 0, gain: 0 });
    expect(engineSound(ENGINE_RPM_STOPPED).gain).toBeGreaterThan(0);
  });

  it('sounds at a running rpm and rises with the rpm (pitch and level)', () => {
    let last = engineSound(ENGINE_RPM_STOPPED);
    expect(last.gain).toBeGreaterThan(0);
    for (let rpm = ENGINE_RPM_STOPPED + 100; rpm <= ENGINE_RPM_REF * 1.2; rpm += 100) {
      const now = engineSound(rpm);
      expect(now.hz).toBeGreaterThan(last.hz);
      expect(now.gain).toBeGreaterThan(last.gain);
      last = now;
    }
  });

  it('stops rising at the cap', () => {
    const cap = engineSound(ENGINE_RPM_REF * ENGINE_GAIN_CAP);
    expect(engineSound(ENGINE_RPM_REF * 3)).toEqual(cap);
  });

  it('is deterministic', () => {
    expect(engineSound(2200)).toEqual(engineSound(2200));
  });
});
