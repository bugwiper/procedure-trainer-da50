import { describe, expect, it } from 'vitest';
import type { AckStorage } from '../src/ui/ack';
import { SOUND_STORAGE_KEY, createSoundPref } from '../src/ui/audio/sound-pref';

function memory(): AckStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const throwing: AckStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('the Sound choice', () => {
  it('is off by default', () => {
    expect(createSoundPref(memory()).get()).toBe(false);
    expect(createSoundPref(null).get()).toBe(false);
  });

  it('is remembered in storage across stores', () => {
    const storage = memory();
    createSoundPref(storage).set(true);
    expect(storage.data.get(SOUND_STORAGE_KEY)).toBe('1');
    expect(createSoundPref(storage).get()).toBe(true);
    createSoundPref(storage).set(false);
    expect(createSoundPref(storage).get()).toBe(false);
  });

  it('works from memory without storage', () => {
    const pref = createSoundPref(null);
    pref.set(true);
    expect(pref.get()).toBe(true);
  });

  it('survives blocked storage: off at first, the session choice after a set', () => {
    const pref = createSoundPref(throwing);
    expect(pref.get()).toBe(false);
    expect(() => {
      pref.set(true);
    }).not.toThrow();
    expect(pref.get()).toBe(true);
  });

  it('ignores a foreign value', () => {
    const storage = memory();
    storage.data.set(SOUND_STORAGE_KEY, 'yes');
    expect(createSoundPref(storage).get()).toBe(false);
  });
});
