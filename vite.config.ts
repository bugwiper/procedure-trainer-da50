import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

// Host-agnostic base path (PLT-01): BASE_PATH is the only source, default '/'.
function resolveBase(): string {
  const raw = process.env['BASE_PATH'];
  if (raw === undefined || raw === '') return '/';
  if (!raw.startsWith('/') || !raw.endsWith('/')) {
    throw new Error(`BASE_PATH must start and end with / (got "${raw}")`);
  }
  return raw;
}

export default defineConfig({
  base: resolveBase(),
  plugins: [preact()],
  build: {
    rolldownOptions: {
      output: {
        // One lazy chunk per pack (D-20, PLT-03): scenario text of /scenarios/<pack>/<name>.toon
        // lands in pack-<pack>; manifests (pack.toon) and everything else stay where they are.
        codeSplitting: {
          groups: [
            {
              name: (id: string): string | null => {
                const m = /\/scenarios\/([^/]+)\/(?!pack\.toon)[^/]+\.toon/.exec(id);
                return m ? `pack-${m[1]}` : null;
              },
              debugName: 'packs',
            },
          ],
        },
      },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
