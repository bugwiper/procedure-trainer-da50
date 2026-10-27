// The Sound choice (Phase 5, A-01): off until the pilot turns it on, then remembered in browser
// storage under one key. Same form as the acknowledgment store (ack.ts): a missing, blocked or
// throwing storage falls back to the session's memory, so a blocked storage never breaks the
// control. No Preact and no DOM types.

import type { AckStorage } from '../ack';

export const SOUND_STORAGE_KEY = 'da50.sound';

export interface SoundPref {
  /** True only if the pilot turned the sound on (this session or, in storage, before). */
  get(): boolean;
  /** Remembers the choice in memory first, then tries to write it; a write error is swallowed. */
  set(on: boolean): void;
}

export function createSoundPref(storage: AckStorage | null): SoundPref {
  let session: boolean | null = null;
  return {
    get() {
      if (session !== null) return session;
      if (storage === null) return false;
      try {
        return storage.getItem(SOUND_STORAGE_KEY) === '1';
      } catch {
        return false;
      }
    },
    set(on) {
      session = on;
      if (storage === null) return;
      try {
        storage.setItem(SOUND_STORAGE_KEY, on ? '1' : '0');
      } catch {
        // Blocked or full storage: the session choice above is all there is.
      }
    },
  };
}
