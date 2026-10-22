import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { createPackProvider, OPEN_ACCESS, openScenario } from '../src/scenario/packs';
import type { AccessPolicy } from '../src/scenario/packs';

// Seam gate (PLT-03, D-20, T-02-11): scenario text reaches the app only through the pack
// provider and its access policy. One module owns the scenario glob, nothing in the UI imports a
// .toon file, listing never loads scenario text, and a pack load touches only its own folder.
const srcRoot = fileURLToPath(new URL('../src', import.meta.url));
const OWNER = 'scenario/packs-vite.ts';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const files = sourceFiles(srcRoot).map((path) => ({
  rel: relative(srcRoot, path).split('\\').join('/'),
  text: readFileSync(path, 'utf8'),
}));

describe('the scenario glob has one owner', () => {
  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.rel === OWNER)).toBe(true);
  });

  it('only src/scenario/packs-vite.ts contains import.meta.glob', () => {
    const owners = files.filter((f) => f.text.includes('import.meta.glob')).map((f) => f.rel);
    expect(owners).toEqual([OWNER]);
  });

  it('no file under src/ui imports a .toon file', () => {
    const importsToon = /(?:from|import)\s*\(?\s*['"][^'"]*\.toon(?:\?[^'"]*)?['"]/;
    const offenders = files
      .filter((f) => f.rel.startsWith('ui/') && importsToon.test(f.text))
      .map((f) => f.rel);
    expect(offenders).toEqual([]);
  });
});

const manifest = (id: string, file: string): string =>
  `format: 1\ntitle: ${id}\nfree: true\nscenarios[1]:\n  - id: ${file}\n    title: T\n    file: ${file}\n`;

function fake(): {
  provider: ReturnType<typeof createPackProvider>;
  calls: string[];
} {
  const calls: string[] = [];
  const loader =
    (key: string, text: string): (() => Promise<string>) =>
    () => {
      calls.push(key);
      return Promise.resolve(text);
    };
  const provider = createPackProvider({
    manifests: {
      '/scenarios/alpha/pack.toon': manifest('alpha', 'a-one'),
      '/scenarios/beta/pack.toon': manifest('beta', 'b-one'),
    },
    loaders: {
      '/scenarios/alpha/a-one.toon': loader('alpha/a-one', 'alpha text'),
      '/scenarios/alpha/a-two.toon': loader('alpha/a-two', 'alpha text 2'),
      '/scenarios/beta/b-one.toon': loader('beta/b-one', 'beta text'),
    },
  });
  return { provider, calls };
}

describe('the pack provider loads lazily', () => {
  it('lists every pack without calling a loader', async () => {
    const { provider, calls } = fake();
    const packs = await provider.listPacks();
    expect(packs.map((p) => p.id)).toEqual(['alpha', 'beta']);
    expect(calls).toEqual([]);
  });

  it('loadPack calls only the loaders of its own folder', async () => {
    const { provider, calls } = fake();
    const pack = await provider.loadPack('alpha');
    expect(pack.files.map((f) => f.name)).toEqual(['a-one', 'a-two']);
    expect([...calls].sort()).toEqual(['alpha/a-one', 'alpha/a-two']);
  });

  it('loadPack rejects an unknown pack without calling a loader', async () => {
    const { provider, calls } = fake();
    await expect(provider.loadPack('gamma')).rejects.toThrow('unknown pack');
    expect(calls).toEqual([]);
  });
});

describe('the access policy', () => {
  it('OPEN_ACCESS allows every pack', async () => {
    expect(await OPEN_ACCESS.canAccess('alpha')).toBe(true);
    expect(await OPEN_ACCESS.canAccess('anything-else')).toBe(true);
  });

  it('openScenario with a denying policy returns denied and loads nothing', async () => {
    const { provider, calls } = fake();
    const policy: AccessPolicy = { canAccess: () => false };
    const result = await openScenario({ provider, policy }, DA50RG_ENV, {
      pack: 'alpha',
      scenario: 'a-one',
    });
    expect(result).toMatchObject({ ok: false, reason: 'denied' });
    expect(calls).toEqual([]);
  });
});
