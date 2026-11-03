import { expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

// Shared helpers of the offline specs (PLT-02). Test support, not a spec: the name does not end in
// .spec.ts, so Playwright never collects it. Everything the page reports is read through the real
// worker, cache and registration APIs; the precache list is read from the worker script as the
// network serves it, so a spec sees what the build wrote.

/** Waits until a worker is active and controls the page (the first load is claimed late). */
export async function waitForControl(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const worker = registration.active;
    if (worker === null || worker.state === 'activated') return;
    await new Promise<void>((resolve) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') resolve();
      });
    });
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

/** The names of all caches of the page's origin. */
export function cacheNames(page: Page): Promise<string[]> {
  return page.evaluate(() => caches.keys());
}

/** The URLs held by the newest `da50-precache-*` cache, or an empty list when there is none. */
export function cachedUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith('da50-precache-'));
    const name = names[0];
    if (name === undefined) return [];
    const cache = await caches.open(name);
    return (await cache.keys()).map((request) => request.url);
  });
}

/** The scope and the script URL of the page's registration, or null when it has none. */
export function registrationOf(page: Page): Promise<{ scope: string; script: string } | null> {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration === undefined) return null;
    return { scope: registration.scope, script: registration.active?.scriptURL ?? '' };
  });
}

/** What sw.js, as the network serves it, says about itself: build id and precache paths. */
export interface WorkerStamp {
  readonly id: string;
  readonly paths: readonly string[];
}

/** Fetches sw.js from the base URL over the network (not through a worker) and reads its stamp. */
export async function workerStamp(page: Page, baseURL: string): Promise<WorkerStamp> {
  const response = await page.request.get(new URL('sw.js', baseURL).href);
  expect(response.status()).toBe(200);
  const text = await response.text();
  const id = /^const BUILD_ID = ("[^"\n]*");$/m.exec(text)?.[1];
  const list = /^const PRECACHE = (\[.*\]);$/m.exec(text)?.[1];
  if (id === undefined || list === undefined) throw new Error('sw.js carries no stamp');
  return { id: JSON.parse(id) as string, paths: JSON.parse(list) as string[] };
}

/** The precache paths of the deployed worker. */
export async function precacheUrls(page: Page, baseURL: string): Promise<string[]> {
  return [...(await workerStamp(page, baseURL)).paths];
}

/** Everything a page and its worker request during a test, and what went wrong. */
export interface RequestLog {
  readonly urls: string[];
  readonly failed: string[];
  readonly consoleErrors: string[];
  /** Requests that leave the origin or the base path of `baseURL`. */
  outside(baseURL: string): string[];
}

/**
 * Starts collecting every request of the context (page and worker), every failed request and every
 * console error of the page. Call it before the first navigation.
 */
export function collectRequests(page: Page, context: BrowserContext = page.context()): RequestLog {
  const urls: string[] = [];
  const failed: string[] = [];
  const consoleErrors: string[] = [];
  context.on('request', (request) => urls.push(request.url()));
  context.on('requestfailed', (request) =>
    failed.push(`${request.url()} ${request.failure()?.errorText ?? ''}`),
  );
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return {
    urls,
    failed,
    consoleErrors,
    outside(baseURL) {
      const base = new URL(baseURL);
      return urls.filter((raw) => {
        const url = new URL(raw);
        // data: and blob: URLs are not network requests.
        if (url.protocol === 'data:' || url.protocol === 'blob:') return false;
        return url.origin !== base.origin || !url.pathname.startsWith(base.pathname);
      });
    },
  };
}
