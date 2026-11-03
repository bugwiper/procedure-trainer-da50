// Registers the offline worker (PLT-02, D-02, L-03): production builds only, under the base path,
// after the first render. The app never depends on it: a refusal is swallowed, and a resolved
// `undefined` (Playwright's blocked mode) counts as no worker.
export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  try {
    const registration: ServiceWorkerRegistration | undefined =
      await navigator.serviceWorker.register(`${base}sw.js`, {
        scope: base,
        updateViaCache: 'none',
      });
    if (registration === undefined) return;
  } catch {
    // No worker (private mode, insecure origin, a refused script): the app runs online as before.
  }
}
