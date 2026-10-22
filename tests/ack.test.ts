import { describe, expect, it, vi } from 'vitest';
import { DISCLAIMERS } from '../src/scenario/disclaimers';
import { ACK_STORAGE_KEY, ACK_VERSION, browserStorage, createAckStore } from '../src/ui/ack';
import type { AckStorage } from '../src/ui/ack';

// The first-run acknowledgment store (plan 02-09, Table M2; PLT-04, D-17, T-02-16): node
// environment, fake storages as plain objects.

function fakeStorage(initial?: string): AckStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(ACK_STORAGE_KEY, initial);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const throwing = (): never => {
  throw new Error('storage blocked');
};

describe('ack constants', () => {
  it('keeps the key and takes the version from the training-aid disclaimer', () => {
    expect(ACK_STORAGE_KEY).toBe('da50.ack');
    expect(ACK_VERSION).toBe(DISCLAIMERS['training-aid'].version);
  });
});

describe('createAckStore', () => {
  it('requires the acknowledgment without a storage', () => {
    expect(createAckStore(null).required()).toBe(true);
  });

  it('requires it for an empty storage and not for the stored current version', () => {
    expect(createAckStore(fakeStorage()).required()).toBe(true);
    expect(createAckStore(fakeStorage(String(ACK_VERSION))).required()).toBe(false);
  });

  it('requires it again for an older, newer or garbage stored value', () => {
    expect(createAckStore(fakeStorage(String(ACK_VERSION - 1))).required()).toBe(true);
    expect(createAckStore(fakeStorage(String(ACK_VERSION + 1))).required()).toBe(true);
    expect(createAckStore(fakeStorage('yes')).required()).toBe(true);
    expect(createAckStore(fakeStorage('')).required()).toBe(true);
  });

  it('writes the current version on accept', () => {
    const storage = fakeStorage();
    const store = createAckStore(storage);
    store.accept();
    expect(storage.data.get(ACK_STORAGE_KEY)).toBe(String(ACK_VERSION));
    expect(store.required()).toBe(false);
    // A fresh store over the same storage remembers it.
    expect(createAckStore(storage).required()).toBe(false);
  });

  it('counts a storage whose read throws as not accepted, and keeps the acceptance in memory', () => {
    const store = createAckStore({ getItem: throwing, setItem: throwing });
    expect(store.required()).toBe(true);
    expect(() => {
      store.accept();
    }).not.toThrow();
    expect(store.required()).toBe(false);
  });

  it('sets the in-memory acceptance before the write, and a write error is swallowed', () => {
    const setItem = vi.fn(throwing);
    const store = createAckStore({ getItem: () => null, setItem });
    expect(() => {
      store.accept();
    }).not.toThrow();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(store.required()).toBe(false);
  });

  it('accepts without a storage for the session', () => {
    const store = createAckStore(null);
    store.accept();
    expect(store.required()).toBe(false);
  });
});

describe('browserStorage', () => {
  it('is null where there is no localStorage (node)', () => {
    expect(browserStorage()).toBeNull();
  });
});
