import { createHash } from 'node:crypto';

// The pure parts of the offline build (PLT-02, D-03, D-04): which files the worker precaches, the
// build id that names the cache, and the worker text with both stamped in. Node only, no Vite
// import, so tests/pwa-precache.test.ts exercises it directly.

/** One file as the build sees it: a path (any separator, relative to the output root) and bytes. */
export interface SourceFile {
  readonly path: string;
  readonly content: string | Uint8Array;
}

/** One precached file: the path relative to the scope and the SHA-256 of its content. */
export interface PrecacheEntry {
  readonly path: string;
  readonly hash: string;
}

/** The worker's own file name; it is never precached (its bytes are the update trigger). */
export const WORKER_FILE = 'sw.js';

const sha256 = (data: string | Uint8Array): string =>
  createHash('sha256').update(data).digest('hex');

/** Relative form with forward slashes, no leading `./` or `/`. */
function normalise(path: string): string {
  return path
    .split('\\')
    .join('/')
    .replace(/^(\.?\/)+/, '');
}

function precached(path: string): boolean {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return path !== WORKER_FILE && !path.endsWith('.map') && !base.startsWith('.');
}

/**
 * The precache list: every file of the bundle plus every file of public/, minus source maps, the
 * worker and dotfiles; one entry per path (the bundle wins), sorted by path.
 */
export function precacheEntries(
  bundle: readonly SourceFile[],
  publicFiles: readonly SourceFile[],
): PrecacheEntry[] {
  const byPath = new Map<string, PrecacheEntry>();
  for (const file of [...bundle, ...publicFiles]) {
    const path = normalise(file.path);
    if (!precached(path) || byPath.has(path)) continue;
    byPath.set(path, { path, hash: sha256(file.content) });
  }
  return [...byPath.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/** First 12 hex digits of the SHA-256 over the sorted (path, content hash) pairs. */
export function buildId(entries: readonly PrecacheEntry[]): string {
  const sorted = [...entries].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return sha256(sorted.map((entry) => `${entry.path}\0${entry.hash}\n`).join('')).slice(0, 12);
}

/** Replaces the one line that carries `marker` by `replacement`; throws unless it is exactly one. */
function stamp(text: string, marker: string, replacement: string): string {
  const lines = text.split('\n');
  const hits = lines.flatMap((line, index) => (line.includes(`// ${marker}`) ? [index] : []));
  if (hits.length !== 1) {
    throw new Error(
      `the worker template needs exactly one "// ${marker}" line (found ${hits.length})`,
    );
  }
  lines[hits[0] ?? 0] = replacement;
  return lines.join('\n');
}

/** The worker text with the build id and the precache paths in place of the two marker lines. */
export function renderWorker(template: string, id: string, paths: readonly string[]): string {
  const withId = stamp(template, '@build-id', `const BUILD_ID = ${JSON.stringify(id)};`);
  return stamp(withId, '@precache', `const PRECACHE = ${JSON.stringify(paths)};`);
}
