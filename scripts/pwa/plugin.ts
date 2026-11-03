import { readFileSync, readdirSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { WORKER_FILE, buildId, precacheEntries, renderWorker } from './precache.ts';
import type { SourceFile } from './precache.ts';

// Build-only Vite plugin (D-01): after the bundle is complete it stamps scripts/pwa/sw.js with the
// build id and the precache list and emits it as `sw.js` at the output root, which is the base
// path of the deployed site. No dependency beyond Vite itself.

/** Every file below `dir` (recursive), paths relative to it; an absent directory is empty. */
function walk(dir: string): SourceFile[] {
  let names: Dirent[];
  try {
    names = readdirSync(dir, { withFileTypes: true, recursive: true });
  } catch {
    return [];
  }
  return names
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const full = join(entry.parentPath, entry.name);
      return { path: relative(dir, full), content: readFileSync(full) };
    });
}

export function pwaPlugin(): Plugin {
  let root = '';
  let publicDir = '';
  return {
    name: 'da50-pwa',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
    },
    generateBundle: {
      // Post: the HTML, the CSS and the font assets are in the bundle by then.
      order: 'post',
      handler(_options, bundle) {
        const built: SourceFile[] = Object.values(bundle).map((item) => ({
          path: item.fileName,
          content: item.type === 'chunk' ? item.code : item.source,
        }));
        const entries = precacheEntries(built, publicDir === '' ? [] : walk(publicDir));
        const template = readFileSync(resolve(root, 'scripts/pwa/sw.js'), 'utf8');
        this.emitFile({
          type: 'asset',
          fileName: WORKER_FILE,
          source: renderWorker(
            template,
            buildId(entries),
            entries.map((entry) => entry.path),
          ),
        });
      },
    },
  };
}
