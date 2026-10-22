// The first-run training-aid acknowledgment store (PLT-04, D-17). The accepted disclaimer version
// is kept in browser storage under one key; a missing, blocked or throwing storage counts as "not
// accepted", and an accepted answer is also kept in memory for the session, so a blocked storage
// never locks the app. This module has no Preact and no DOM types: playwright.config.ts imports the
// key and the version to seed every e2e project as accepted.

import { DISCLAIMERS } from '../scenario/disclaimers';

export const ACK_STORAGE_KEY = 'da50.ack';

/** The version of the current training-aid disclaimer; a bump asks every user again. */
export const ACK_VERSION = DISCLAIMERS['training-aid'].version;

/** The part of Storage the store needs; a plain object works as a fake. */
export interface AckStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AckStore {
  /** True unless storage holds exactly the current version or this session already accepted. */
  required(): boolean;
  /** Remembers the acceptance in memory first, then tries to write it; a write error is swallowed. */
  accept(): void;
}

export function createAckStore(storage: AckStorage | null): AckStore {
  let acceptedInSession = false;
  return {
    required() {
      if (acceptedInSession) return false;
      if (storage === null) return true;
      try {
        return storage.getItem(ACK_STORAGE_KEY) !== String(ACK_VERSION);
      } catch {
        return true;
      }
    },
    accept() {
      acceptedInSession = true;
      if (storage === null) return;
      try {
        storage.setItem(ACK_STORAGE_KEY, String(ACK_VERSION));
      } catch {
        // Blocked or full storage: the session acceptance above is all there is.
      }
    },
  };
}

/** The browser's localStorage, or null where reading the property itself throws or it is absent. */
export function browserStorage(): AckStorage | null {
  try {
    const found = (globalThis as { localStorage?: AckStorage }).localStorage;
    return found ?? null;
  } catch {
    return null;
  }
}
