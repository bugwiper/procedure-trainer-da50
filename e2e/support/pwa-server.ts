import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_DIR } from './pwa';

// A private static server for the offline specs (D-09): it serves a temp COPY of the e2e build
// under the base path (404 outside it), like GitHub Pages with max-age=600, and can ship a "new
// version" (replace the text of a file, remove one), count requests and be closed, so the network
// is really gone and not only emulated. Test support, not a spec.

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

export interface PrivateServer {
  /** `http://localhost:<port>`. */
  readonly origin: string;
  /** The origin plus the base path, with the trailing slash. */
  readonly baseURL: string;
  /** Every request answered so far as `status path` (path relative to the base). */
  readonly log: readonly string[];
  /** How many requests for `path` (relative to the base) were answered with `status` (any when omitted). */
  hits(path: string, status?: number): number;
  /** Deletes a file of the served copy; later requests for it answer 404. */
  removeFile(path: string): void;
  /** Replaces the first occurrence of `from` in a text file of the served copy. */
  replaceText(path: string, from: string, to: string): void;
  /**
   * Ships a new version: puts another build id into the copy's sw.js (so the browser sees a
   * different worker script) and a marker comment into its index.html (which the new worker
   * precaches, so the page can tell which version it came from). No other file changes, so the
   * new worker's precache succeeds. Returns the new build id and the marker.
   */
  deployNewVersion(): { id: string; marker: string };
  /** Stops the server, drops open connections and deletes the copy. */
  close(): Promise<void>;
}

/** Starts a server for a temp copy of `source` (default: the e2e build) under `basePath`. */
export async function startPrivateServer(
  basePath: string,
  source: URL = BUILD_DIR,
): Promise<PrivateServer> {
  const dir = mkdtempSync(join(tmpdir(), 'da50-pwa-'));
  cpSync(fileURLToPath(source), dir, { recursive: true });
  const log: string[] = [];
  let deployments = 0;
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const answer = (status: number, body: Buffer | string, type?: string): void => {
      log.push(
        `${status} ${url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) : url.pathname}`,
      );
      res.writeHead(status, {
        'Content-Type': type ?? 'text/plain; charset=utf-8',
        'Cache-Control': 'max-age=600',
      });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (!url.pathname.startsWith(basePath)) return answer(404, 'not found');
    let relativePath = decodeURIComponent(url.pathname.slice(basePath.length));
    if (relativePath === '' || relativePath.endsWith('/')) relativePath += 'index.html';
    const full = normalize(join(dir, relativePath));
    if (!full.startsWith(dir + sep)) return answer(404, 'not found');
    try {
      answer(200, readFileSync(full), TYPES[extname(full)]);
    } catch {
      answer(404, 'not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no server address');
  const origin = `http://localhost:${address.port}`;
  return {
    origin,
    baseURL: origin + basePath,
    log,
    hits: (path, status) =>
      log.filter((line) => {
        const [code = '', ...rest] = line.split(' ');
        return rest.join(' ') === path && (status === undefined || Number(code) === status);
      }).length,
    removeFile: (path) => rmSync(join(dir, path)),
    replaceText: (path, from, to) => {
      const text = readFileSync(join(dir, path), 'utf8');
      if (!text.includes(from)) throw new Error(`"${from}" is not in ${path}`);
      writeFileSync(join(dir, path), text.replace(from, to));
    },
    deployNewVersion: () => {
      const text = readFileSync(join(dir, 'sw.js'), 'utf8');
      const old = /^const BUILD_ID = "([^"\n]*)";/m.exec(text)?.[1];
      if (old === undefined) throw new Error('sw.js carries no build id');
      deployments += 1;
      const id = `next${deployments}${old}`.slice(0, 12);
      const marker = `da50-deployed-${deployments}`;
      writeFileSync(
        join(dir, 'sw.js'),
        text.replace(`const BUILD_ID = "${old}";`, `const BUILD_ID = "${id}";`),
      );
      const html = readFileSync(join(dir, 'index.html'), 'utf8');
      if (!html.includes('</body>')) throw new Error('index.html has no closing body tag');
      writeFileSync(join(dir, 'index.html'), html.replace('</body>', `<!-- ${marker} --></body>`));
      return { id, marker };
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
