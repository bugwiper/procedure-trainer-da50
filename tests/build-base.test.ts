import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { build } from 'vite';

const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url));
const TIMEOUT = 120000;

const saved = {
  BASE_PATH: process.env['BASE_PATH'],
  VITE_TEST_HOOKS: process.env['VITE_TEST_HOOKS'],
};

function setEnv(name: 'BASE_PATH' | 'VITE_TEST_HOOKS', value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  setEnv('BASE_PATH', saved.BASE_PATH);
  setEnv('VITE_TEST_HOOKS', saved.VITE_TEST_HOOKS);
});

async function buildTo(
  basePath: string | undefined,
  hooks: string | undefined,
): Promise<{ outDir: string }> {
  setEnv('BASE_PATH', basePath);
  setEnv('VITE_TEST_HOOKS', hooks);
  const outDir = await mkdtemp(join(tmpdir(), 'pt-build-'));
  await build({
    configFile,
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true },
  });
  return { outDir };
}

async function jsFiles(outDir: string): Promise<string[]> {
  const entries = await readdir(join(outDir, 'assets'));
  return entries.filter((f) => f.endsWith('.js')).map((f) => join(outDir, 'assets', f));
}

describe('host-agnostic base path and test-hook absence', () => {
  it(
    'BASE_PATH=/procedure-trainer-da-50/ puts assets under the subpath',
    async () => {
      const { outDir } = await buildTo('/procedure-trainer-da-50/', undefined);
      const html = await readFile(join(outDir, 'index.html'), 'utf8');
      expect(html).toMatch(/<script[^>]+src="\/procedure-trainer-da-50\/assets\//);
      expect(html).toMatch(/<link[^>]+href="\/procedure-trainer-da-50\/assets\/[^"]+\.css"/);
    },
    TIMEOUT,
  );

  it(
    'BASE_PATH unset puts assets under /assets/',
    async () => {
      const { outDir } = await buildTo(undefined, undefined);
      const html = await readFile(join(outDir, 'index.html'), 'utf8');
      expect(html).toMatch(/<script[^>]+src="\/assets\//);
      expect(html).toMatch(/<link[^>]+href="\/assets\/[^"]+\.css"/);
    },
    TIMEOUT,
  );

  it(
    'rejects a BASE_PATH without leading and trailing slash',
    async () => {
      await expect(buildTo('procedure-trainer-da-50', undefined)).rejects.toThrow(
        'BASE_PATH must start and end with /',
      );
    },
    TIMEOUT,
  );

  it(
    'a build without VITE_TEST_HOOKS contains no test hook',
    async () => {
      const { outDir } = await buildTo('/procedure-trainer-da-50/', undefined);
      const files = await jsFiles(outDir);
      expect(files.length).toBeGreaterThan(0);
      for (const f of files) {
        expect(await readFile(f, 'utf8')).not.toContain('__panel');
      }
    },
    TIMEOUT,
  );

  it(
    'a build with VITE_TEST_HOOKS=1 contains the test hook (positive control)',
    async () => {
      const { outDir } = await buildTo('/procedure-trainer-da-50/', '1');
      const files = await jsFiles(outDir);
      const contents = await Promise.all(files.map((f) => readFile(f, 'utf8')));
      expect(contents.some((c) => c.includes('__panel'))).toBe(true);
    },
    TIMEOUT,
  );
});
