import { signal } from '@preact/signals';
import { createReloadGate, shouldCheckForUpdate, type UpdateKind } from './update';

// The effectful glue around the offline worker (PLT-02, D-02, D-05, D-13): production builds only,
// under the base path, after the first render. The app never depends on it: a refusal is swallowed,
// and a resolved `undefined` (Playwright's blocked mode) counts as no worker. The rules live in
// update.ts; this file is proven in the browser by e2e/pwa-update.spec.ts.

/** An update waits (or this tab is stale); null while nothing is pending. The notice reads it. */
export const updateAvailable = signal<UpdateKind | null>(null);

const gate = createReloadGate();
let registration: ServiceWorkerRegistration | undefined;
let lastCheckMs: number | null = null;
/** Whether a worker controlled this page before now (the first claim is not an update). */
let controlled = false;

/** Reloads the page, once, and only after the user asked for it (D-05); says whether it did. */
function reloadIfAsked(): boolean {
  if (!gate.take()) return false;
  location.reload();
  return true;
}

/** Asks the browser for a newer worker script; a failure (offline) is no news. */
export function checkForUpdate(): void {
  if (registration === undefined) return;
  lastCheckMs = Date.now();
  registration.update().catch(() => undefined);
}

/**
 * The user tapped the notice. A waiting worker is told to take over and the page reloads when the
 * controller has changed; a stale tab (the new worker already controls it) reloads at once.
 */
export function applyUpdate(): void {
  const kind = updateAvailable.peek();
  if (kind === null) return;
  gate.ask();
  const waiting = registration?.waiting;
  if (kind === 'waiting' && waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    return;
  }
  reloadIfAsked();
}

function watch(found: ServiceWorkerRegistration): void {
  const container = navigator.serviceWorker;
  controlled = container.controller !== null;
  // A worker that already waits at load (the page was opened after the deploy installed it).
  if (found.waiting) updateAvailable.value = 'waiting';
  // A worker that installs while this page has a controller is an update, not the first install.
  found.addEventListener('updatefound', () => {
    const installing = found.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && container.controller !== null) {
        updateAvailable.value = 'waiting';
      }
    });
  });
  container.addEventListener('controllerchange', () => {
    const wasControlled = controlled;
    controlled = true;
    const settle = (): void => {
      // Another tab applied the update: this page is older than its worker. Never reload by itself.
      if (!reloadIfAsked() && wasControlled) updateAvailable.value = 'stale';
    };
    // Reload only when the new worker has finished activating: WebKit can leave a worker in
    // "activating" for good when the page is torn down in the middle of its claim.
    const worker = container.controller;
    if (worker === null || worker.state === 'activated' || worker.state === 'redundant') {
      settle();
      return;
    }
    worker.addEventListener('statechange', function onState() {
      if (worker.state !== 'activated' && worker.state !== 'redundant') return;
      worker.removeEventListener('statechange', onState);
      settle();
    });
  });
  // An installed app resumes without a navigation: look again when the tab turns visible.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && shouldCheckForUpdate(lastCheckMs, Date.now())) checkForUpdate();
  });
}

export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  try {
    const found: ServiceWorkerRegistration | undefined = await navigator.serviceWorker.register(
      `${base}sw.js`,
      { scope: base, updateViaCache: 'none' },
    );
    if (found === undefined) return;
    registration = found;
    lastCheckMs = Date.now();
    watch(found);
  } catch {
    // No worker (private mode, insecure origin, a refused script): the app runs online as before.
  }
}
