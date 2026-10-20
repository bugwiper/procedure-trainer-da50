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
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
