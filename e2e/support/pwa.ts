import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import { ACK_STORAGE_KEY, ACK_VERSION } from '../../src/ui/ack';
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

/** The e2e build output, where the specs that read the disk (`@local`) look. */
export const BUILD_DIR = new URL('../../dist-e2e/', import.meta.url);

/**
 * The files of a build output directory by independent code (not the plugin's): every file below
 * it, POSIX paths relative to it, without source maps, dotfiles and the worker itself.
 */
export function walkOutput(dir: URL = BUILD_DIR): string[] {
  const root = fileURLToPath(dir);
  const found = readdirSync(root, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join('/'));
  return found
    .filter((path) => path !== 'sw.js' && !path.endsWith('.map') && !basename(path).startsWith('.'))
    .sort();
}

/** The pack folders of scenarios/ that hold at least one scenario file besides pack.toon. */
export function shippedPackFolders(): string[] {
  const root = fileURLToPath(new URL('../../scenarios/', import.meta.url));
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((pack) =>
      readdirSync(join(root, pack)).some((name) => name.endsWith('.toon') && name !== 'pack.toon'),
    )
    .sort();
}

/** The SHA-256 (hex) of a file of the build output, read from disk. */
export function diskHash(path: string, dir: URL = BUILD_DIR): string {
  return createHash('sha256')
    .update(readFileSync(join(fileURLToPath(dir), path)))
    .digest('hex');
}

/**
 * Fetches every path from inside the page (resolved against the scope), with the network off in
 * the caller, and returns status and SHA-256 per path.
 */
export function fetchFromPage(
  page: Page,
  scope: string,
  paths: readonly string[],
): Promise<{ path: string; status: number; hash: string }[]> {
  return page.evaluate(
    async ({ scope: base, list }) => {
      const out: { path: string; status: number; hash: string }[] = [];
      for (const path of list) {
        const response = await fetch(new URL(path, base).href);
        const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
        const hash = Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join('');
        out.push({ path, status: response.status, hash });
      }
      return out;
    },
    { scope, list: [...paths] },
  );
}

/** The ACK-accepted storage state for another origin (the config's covers its own origin only). */
export function acceptedStateFor(origin: string): {
  cookies: [];
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
} {
  return {
    cookies: [],
    origins: [{ origin, localStorage: [{ name: ACK_STORAGE_KEY, value: String(ACK_VERSION) }] }],
  };
}
