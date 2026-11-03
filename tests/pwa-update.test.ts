import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  OFFLINE_READY_PREFIX,
  OFFLINE_UNAVAILABLE,
  UPDATE_BUTTON_LABEL,
  UPDATE_CHECK_GAP_MS,
  UPDATE_NOTICE_TEXT,
  createReloadGate,
  offlineLine,
  shouldCheckForUpdate,
  updateNoticeShown,
} from '../src/ui/pwa/update';
import type { UpdateKind } from '../src/ui/pwa/update';
import type { Screen } from '../src/ui/session';

// PLT-02, D-05: the rules of the update flow that need no browser. The effectful glue
// (register.ts) is proven by e2e/pwa-update.spec.ts against a private server that ships a new
// version.

// A new screen is a compile error here until it is decided whether the notice may show on it.
const SHOWN_ON: Record<Screen, boolean> = {
  free: true,
  choosing: false,
  briefing: false,
  running: false,
  debrief: false,
};

describe('updateNoticeShown', () => {
  for (const [screen, shown] of Object.entries(SHOWN_ON) as [Screen, boolean][]) {
    for (const kind of ['waiting', 'stale'] as const satisfies readonly UpdateKind[]) {
      it(`${kind} on the screen ${screen}: ${shown ? 'shown' : 'hidden'}`, () => {
        expect(updateNoticeShown(kind, screen)).toBe(shown);
      });
    }
    it(`nothing available on the screen ${screen}: hidden`, () => {
      expect(updateNoticeShown(null, screen)).toBe(false);
    });
  }

  it('shows on exactly one screen', () => {
    expect(Object.values(SHOWN_ON).filter(Boolean)).toHaveLength(1);
  });
});

describe('shouldCheckForUpdate', () => {
  it('uses a gap of thirty minutes', () => {
    expect(UPDATE_CHECK_GAP_MS).toBe(30 * 60 * 1000);
  });

  it('checks when no check has happened yet', () => {
    expect(shouldCheckForUpdate(null, 0)).toBe(true);
  });

  it('does not check before the gap has passed', () => {
    expect(shouldCheckForUpdate(1000, 1000)).toBe(false);
    expect(shouldCheckForUpdate(1000, 1000 + UPDATE_CHECK_GAP_MS - 1)).toBe(false);
  });

  it('checks at the boundary and after it', () => {
    expect(shouldCheckForUpdate(1000, 1000 + UPDATE_CHECK_GAP_MS)).toBe(true);
    expect(shouldCheckForUpdate(1000, 1000 + UPDATE_CHECK_GAP_MS + 1)).toBe(true);
  });
});

describe('createReloadGate', () => {
  it('allows no reload without a request, however often it is asked', () => {
    const gate = createReloadGate();
    expect(gate.take()).toBe(false);
    expect(gate.take()).toBe(false);
  });

  it('allows one reload after one request, then none', () => {
    const gate = createReloadGate();
    gate.ask();
    expect(gate.take()).toBe(true);
    expect(gate.take()).toBe(false);
  });

  it('allows still only one reload after several requests', () => {
    const gate = createReloadGate();
    gate.ask();
    gate.ask();
    expect(gate.take()).toBe(true);
    gate.ask();
    expect(gate.take()).toBe(false);
  });

  it('keeps the gates of two instances apart', () => {
    const first = createReloadGate();
    const second = createReloadGate();
    first.ask();
    expect(second.take()).toBe(false);
    expect(first.take()).toBe(true);
  });
});

describe('the fixed strings', () => {
  it('are static label text without a number or a state', () => {
    for (const text of [UPDATE_NOTICE_TEXT, UPDATE_BUTTON_LABEL, OFFLINE_UNAVAILABLE]) {
      expect(text).not.toMatch(/\d/);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it('give the two About line forms', () => {
    expect(offlineLine(null)).toBe(OFFLINE_UNAVAILABLE);
    expect(offlineLine('abc123def456')).toBe(`${OFFLINE_READY_PREFIX}abc123def456`);
    expect(OFFLINE_READY_PREFIX).toBe('Offline: ready, version ');
    expect(OFFLINE_UNAVAILABLE).toBe('Offline: not available');
  });
});

describe('the glue holds the gate', () => {
  const source = readFileSync(new URL('../src/ui/pwa/register.ts', import.meta.url), 'utf8');

  it('reloads from a single call site, and only through the gate', () => {
    expect(source.match(/location\.reload\(/g) ?? []).toHaveLength(1);
    expect(source).toMatch(/gate\.take\(\)[\s\S]{0,80}location\.reload\(/);
  });

  it('never skips waiting by itself, it only posts the message after a tap', () => {
    expect(source).not.toMatch(/skipWaiting\(/);
    expect(source.match(/SKIP_WAITING/g) ?? []).toHaveLength(1);
  });
});
