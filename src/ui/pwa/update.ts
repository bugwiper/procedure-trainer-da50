import type { Screen } from '../session';

// The rules of the update flow (PLT-02, D-05, L-01 to L-03) that need no browser. The effectful
// glue around the worker registration is register.ts; the notice is UpdateNotice.tsx. The fixed
// strings live here so that the device checklist and its test quote the code.

/**
 * How a new version waits: `waiting` is a worker that installed and waits for this tab's tap;
 * `stale` is a tab whose controller changed without this tab's request (another tab applied the
 * update), so the page in front of the user is older than the code that serves it.
 */
export type UpdateKind = 'waiting' | 'stale';

/** The calm sentence of the notice (a static label, no state in it). */
export const UPDATE_NOTICE_TEXT = 'A new version is ready.';

/** The label of the single button of the notice. */
export const UPDATE_BUTTON_LABEL = 'Reload';

/** The About line while a worker with a complete cache controls the page: prefix, then the id. */
export const OFFLINE_READY_PREFIX = 'Offline: ready, version ';

/** The About line when no worker controls the page. */
export const OFFLINE_UNAVAILABLE = 'Offline: not available';

/** The About line for a version read from the worker; null means no worker answered. */
export function offlineLine(version: string | null): string {
  return version === null ? OFFLINE_UNAVAILABLE : `${OFFLINE_READY_PREFIX}${version}`;
}

/**
 * Whether the notice shows (D-05): only on the free panel and only when an update is available.
 * A run, the chooser, the briefing and the debrief are never interrupted, not even by a notice.
 */
export function updateNoticeShown(kind: UpdateKind | null, screen: Screen): boolean {
  return kind !== null && screen === 'free';
}

/** The gap between two update checks triggered by the tab turning visible (30 minutes). */
export const UPDATE_CHECK_GAP_MS = 30 * 60 * 1000;

/**
 * Whether the tab turning visible asks the browser for a new worker (an installed app resumes
 * without a navigation, so the browser's own check at navigation would never run). `lastCheckMs`
 * is null when no check has happened yet.
 */
export function shouldCheckForUpdate(lastCheckMs: number | null, nowMs: number): boolean {
  if (lastCheckMs === null) return true;
  return nowMs - lastCheckMs >= UPDATE_CHECK_GAP_MS;
}

/** The reload gate: a reload is allowed once, and only after the user asked for it. */
export interface ReloadGate {
  /** The user tapped the button. */
  ask(): void;
  /** True exactly once after an `ask`, false otherwise (and false for ever after). */
  take(): boolean;
}

export function createReloadGate(): ReloadGate {
  let asked = false;
  let used = false;
  return {
    ask() {
      asked = true;
    },
    take() {
      if (!asked || used) return false;
      used = true;
      return true;
    },
  };
}
