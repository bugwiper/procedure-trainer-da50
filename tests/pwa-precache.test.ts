import { readFileSync } from 'node:fs';
import { Script, createContext, runInContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  WORKER_FILE,
  buildId,
  precacheEntries,
  renderWorker,
  type SourceFile,
} from '../scripts/pwa/precache';

// PLT-02, D-03, D-04: the pure parts of the offline build (precache list, build id, the stamped
// worker) and the routing rules of the worker itself, run in a fake worker scope.

const bundle: SourceFile[] = [
  { path: 'index.html', content: '<!doctype html><title>x</title>' },
  { path: 'assets/index-AAAA.js', content: 'console.log(1)' },
  { path: 'assets/pack-engine-BBBB.js', content: 'export const pack = "engine"' },
  { path: 'assets/index-CCCC.css', content: 'body{margin:0}' },
  { path: 'assets/b612-latin-400-DDDD.woff2', content: new Uint8Array([0, 1, 2, 3, 250]) },
  { path: 'assets/index-AAAA.js.map', content: '{"version":3}' },
  { path: 'sw.js', content: 'old worker' },
];
const publicFiles: SourceFile[] = [
  { path: 'manifest.webmanifest', content: '{"name":"x"}' },
  { path: 'icons/icon-192.png', content: new Uint8Array([137, 80, 78, 71]) },
  { path: 'sw.js', content: 'a worker in public/ is not precached either' },
  { path: 'icons/.DS_Store', content: 'junk' },
];

const template = readFileSync(new URL('../scripts/pwa/sw.js', import.meta.url), 'utf8');

describe('precache list', () => {
  it('holds the bundle and the public files, sorted, without maps, the worker and dotfiles', () => {
    const paths = precacheEntries(bundle, publicFiles).map((entry) => entry.path);
    expect(paths).toEqual([
      'assets/b612-latin-400-DDDD.woff2',
      'assets/index-AAAA.js',
      'assets/index-CCCC.css',
      'assets/pack-engine-BBBB.js',
      'icons/icon-192.png',
      'index.html',
      'manifest.webmanifest',
    ]);
    expect(paths).not.toContain(WORKER_FILE);
  });

  it('lists a path once, the bundle winning over public/, and normalises separators', () => {
    const entries = precacheEntries(
      [
        { path: 'a.txt', content: 'bundle' },
        { path: '.\\sub\\b.txt', content: 'b' },
      ],
      [
        { path: 'a.txt', content: 'public' },
        { path: '/sub/b.txt', content: 'b' },
      ],
    );
    expect(entries.map((entry) => entry.path)).toEqual(['a.txt', 'sub/b.txt']);
    const again = precacheEntries([{ path: 'a.txt', content: 'bundle' }], []);
    expect(entries[0]?.hash).toBe(again[0]?.hash);
  });

  it('does not depend on the order of the inputs', () => {
    const a = precacheEntries(bundle, publicFiles);
    const b = precacheEntries([...bundle].reverse(), [...publicFiles].reverse());
    expect(b).toEqual(a);
  });
});

describe('build id', () => {
  const entries = precacheEntries(bundle, publicFiles);

  it('is 12 hex digits and stable for equal input', () => {
    const id = buildId(entries);
    expect(id).toMatch(/^[0-9a-f]{12}$/);
    expect(buildId(precacheEntries([...bundle].reverse(), publicFiles))).toBe(id);
  });

  it('changes when one byte of one file changes', () => {
    const changed = bundle.map((file) =>
      file.path === 'assets/b612-latin-400-DDDD.woff2'
        ? { path: file.path, content: new Uint8Array([0, 1, 2, 3, 251]) }
        : file,
    );
    expect(buildId(precacheEntries(changed, publicFiles))).not.toBe(buildId(entries));
  });

  it('changes when one file is added, removed or renamed', () => {
    const base = buildId(entries);
    const added = [...bundle, { path: 'assets/extra.js', content: '' }];
    expect(buildId(precacheEntries(added, publicFiles))).not.toBe(base);
    expect(buildId(precacheEntries(bundle.slice(1), publicFiles))).not.toBe(base);
    const renamed = bundle.map((file) =>
      file.path === 'index.html' ? { ...file, path: 'start.html' } : file,
    );
    expect(buildId(precacheEntries(renamed, publicFiles))).not.toBe(base);
  });

  it('does not change when only a map, the worker or a dotfile changes', () => {
    const base = buildId(entries);
    const other = bundle.map((file) =>
      file.path.endsWith('.map') || file.path === 'sw.js' ? { ...file, content: 'other' } : file,
    );
    expect(buildId(precacheEntries(other, publicFiles))).toBe(base);
  });
});

describe('rendered worker', () => {
  const entries = precacheEntries(bundle, publicFiles);
  const id = buildId(entries);
  const paths = entries.map((entry) => entry.path);
  const rendered = renderWorker(template, id, paths);

  it('parses as JavaScript, holds the id and every entry, and leaves no marker', () => {
    expect(() => new Script(rendered)).not.toThrow();
    expect(rendered).toContain(JSON.stringify(id));
    for (const path of paths) expect(rendered).toContain(JSON.stringify(path));
    expect(rendered).not.toMatch(/@build-id|@precache/);
  });

  it('refuses a template with a missing or doubled marker', () => {
    expect(() => renderWorker('const x = 1;', id, paths)).toThrow(/build-id/);
    const doubled = `${template}\nconst BUILD_ID = 'x'; // @build-id\n`;
    expect(() => renderWorker(doubled, id, paths)).toThrow(/build-id/);
  });
});

/** Runs the rendered worker in a fake scope and returns the registered handlers. */
function loadWorker(scope: string, paths: readonly string[], cached: ReadonlySet<string>) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const origin = new URL(scope).origin;
  const self = {
    registration: { scope },
    location: { origin },
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      handlers[type] = fn;
    },
    skipWaiting: () => {
      skipped.count += 1;
    },
    clients: { claim: () => Promise.resolve() },
  };
  const skipped = { count: 0 };
  const caches = {
    match: (request: string | { url: string }) => {
      const url = typeof request === 'string' ? request : request.url;
      return Promise.resolve(cached.has(url) ? { cached: url } : undefined);
    },
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
    open: () => Promise.reject(new Error('the fetch handler never opens a cache for writing')),
  };
  const context = createContext({ self, caches, URL, Request, Response, fetch, Promise });
  runInContext(renderWorker(template, 'testid000000', paths), context);
  return { handlers, skipped };
}

interface FakeFetch {
  request: { method: string; url: string; mode: string };
  responded: unknown[];
  respondWith: (value: unknown) => void;
}
function fakeFetch(url: string, mode = 'cors', method = 'GET'): FakeFetch {
  const responded: unknown[] = [];
  return { request: { method, url, mode }, responded, respondWith: (v) => responded.push(v) };
}

describe('worker routing', () => {
  const scope = 'https://example.org/procedure-trainer-da-50/';
  const paths = ['assets/a.js', 'index.html'];
  const cached = new Set(paths.map((path) => scope + path));
  const worker = loadWorker(scope, paths, cached);
  const fetchHandler = worker.handlers['fetch'];
  if (fetchHandler === undefined) throw new Error('the worker registers no fetch handler');

  const answered = (event: FakeFetch): boolean => {
    fetchHandler(event);
    return event.responded.length > 0;
  };

  it('answers a precached same-origin GET', () => {
    expect(answered(fakeFetch(`${scope}assets/a.js`))).toBe(true);
  });

  it('leaves everything else to the network', () => {
    expect(answered(fakeFetch(`${scope}assets/other.js`))).toBe(false);
    expect(answered(fakeFetch(`${scope}assets/a.js?x=1`))).toBe(false);
    expect(answered(fakeFetch(`${scope}assets/a.js`, 'cors', 'POST'))).toBe(false);
    expect(answered(fakeFetch('https://other.example/assets/a.js'))).toBe(false);
  });

  it('gives the shell to a navigation to the scope root or index.html, whatever the query', () => {
    expect(answered(fakeFetch(scope, 'navigate'))).toBe(true);
    expect(answered(fakeFetch(`${scope}?scene=x&q=1`, 'navigate'))).toBe(true);
    expect(answered(fakeFetch(`${scope}index.html?flags=a#top`, 'navigate'))).toBe(true);
  });

  it('leaves any other navigation to the network', () => {
    expect(answered(fakeFetch(`${scope}elsewhere/`, 'navigate'))).toBe(false);
    expect(answered(fakeFetch(`${scope}assets/a.js`, 'navigate'))).toBe(false);
    expect(answered(fakeFetch('https://example.org/', 'navigate'))).toBe(false);
  });

  const message = (event: unknown): void => {
    const handler = worker.handlers['message'];
    if (handler === undefined) throw new Error('the worker registers no message handler');
    handler(event);
  };
  const windowClient = { type: 'window', url: `${scope}index.html?x=1` };

  it('skips waiting only on the message of a window of its scope, never by itself', () => {
    expect(worker.skipped.count).toBe(0);
    message({ data: { type: 'OTHER' }, source: windowClient });
    expect(worker.skipped.count).toBe(0);
    message({ data: { type: 'SKIP_WAITING' }, source: windowClient });
    expect(worker.skipped.count).toBe(1);
  });

  it('ignores a message with no source, from a worker, or from a window outside the scope', () => {
    const before = worker.skipped.count;
    message({ data: { type: 'SKIP_WAITING' } });
    message({ data: { type: 'SKIP_WAITING' }, source: { type: 'worker', url: scope } });
    message({
      data: { type: 'SKIP_WAITING' },
      source: { type: 'window', url: 'https://example.org/elsewhere/' },
    });
    message({ data: null, source: windowClient });
    message({ data: 'SKIP_WAITING', source: windowClient });
    expect(worker.skipped.count).toBe(before);
  });

  it('answers VERSION on the message port with its build id, and only to the same sources', () => {
    const sent: unknown[] = [];
    const port = { postMessage: (value: unknown) => sent.push(value) };
    message({ data: { type: 'VERSION' }, source: windowClient, ports: [port] });
    expect(sent).toEqual([{ type: 'VERSION', id: 'testid000000' }]);
    message({ data: { type: 'VERSION' }, source: { type: 'worker', url: scope }, ports: [port] });
    message({ data: { type: 'VERSION' }, source: windowClient, ports: [] });
    message({ data: { type: 'VERSION' }, source: windowClient });
    expect(sent).toHaveLength(1);
  });
});

describe('worker source', () => {
  it('never writes to a cache outside the install and has no runtime caching', () => {
    const puts = template.match(/\.put\(/g) ?? [];
    expect(puts.length).toBe(1);
    expect(template).not.toMatch(/\beval\b|new Function|importScripts/);
  });
});
