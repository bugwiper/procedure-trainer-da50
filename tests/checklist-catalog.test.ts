import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_CATALOG } from '../src/aircraft/da50rg/checklist-catalog';
import { CatalogError, defineCatalog, entryKey } from '../src/engine/catalog';
import { checkCatalog } from '../src/scenario/catalog-check';
import type { ShippedScenario } from '../src/scenario/catalog-check';
import { parseManifest, parseScenario } from '../src/scenario/parse';
import { validateAll } from '../src/scenario/validate-all';
import type { PackInput } from '../src/scenario/validate-all';
import {
  CATALOG_LISTING_ORDER,
  CATALOG_REFERENCE,
  referenceGroupOf,
} from './checklist-catalog-reference';

// The checklist catalog (Phase 7, plan 07-06, R-16): the aircraft data against its independent
// hand-typed table, the checks of defineCatalog, the order, and the cross-check against the shipped
// scenarios (lint L29 and L30). Every count comes from the reference rows.
const root = fileURLToPath(new URL('../', import.meta.url));

interface Shipped {
  readonly pack: string;
  readonly id: string;
  readonly file: string;
  readonly title: string;
  readonly heading: string;
}

/** Every shipped scenario, found through the pack manifests; the heading is read from the file. */
const SHIPPED: readonly Shipped[] = readdirSync(join(root, 'scenarios'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((folder) => {
    const manifest = parseManifest(
      readFileSync(join(root, 'scenarios', folder.name, 'pack.toon'), 'utf8'),
    );
    if (!manifest.ok) throw new Error(`the manifest of "${folder.name}" does not parse`);
    return manifest.value.scenarios.map((entry) => {
      const parsed = parseScenario(
        readFileSync(join(root, 'scenarios', folder.name, `${entry.file}.toon`), 'utf8'),
      );
      if (!parsed.ok) throw new Error(`${entry.file} does not parse`);
      return {
        pack: folder.name,
        id: entry.id,
        file: entry.file,
        title: entry.title,
        heading: parsed.value.checklist?.heading ?? parsed.value.title,
      };
    });
  });

const link = (s: { pack: string; id: string }): string => `${s.pack}/${s.id}`;

describe('the aircraft catalog against its independent reference', () => {
  it('has the groups, headings, tab labels and entries of the reference, in order', () => {
    expect(
      DA50RG_CATALOG.groups.map((g) => ({
        id: g.id,
        heading: g.heading,
        tab: g.tab,
        rows: g.entries.map(
          (e) =>
            [
              e.tag,
              e.detail ?? null,
              e.ref === undefined ? null : `${e.ref.pack}/${e.ref.scenario}`,
            ] as const,
        ),
      })),
    ).toEqual(CATALOG_REFERENCE);
  });

  it('is the catalog of the aircraft environment', () => {
    expect(DA50RG_ENV.catalog).toBe(DA50RG_CATALOG);
  });

  it('lists the shipped scenarios in the reference order', () => {
    const items = SHIPPED.map((s) => ({ pack: s.pack, scenario: s.id }));
    const ordered = DA50RG_CATALOG.order([...items].reverse());
    expect(ordered.map((i) => [i.pack, i.scenario])).toEqual(CATALOG_LISTING_ORDER);
  });

  it('agrees with the reference on the group and the entry of every linked scenario', () => {
    for (const s of SHIPPED) {
      const ref = { pack: s.pack, scenario: s.id };
      expect(DA50RG_CATALOG.groupOf(ref)?.id, link(s)).toBe(referenceGroupOf(link(s)));
      const place = DA50RG_CATALOG.entryOf(ref);
      expect(place?.entry.tag, link(s)).toBe(s.heading);
    }
  });

  it('puts every shipped scenario in exactly one entry and checks the tag against the heading', () => {
    const linked = CATALOG_REFERENCE.flatMap((g) => g.rows.map((r) => r[2])).filter(
      (x): x is string => x !== null,
    );
    expect([...linked].sort()).toEqual(SHIPPED.map(link).sort());
    expect(new Set(linked).size).toBe(linked.length);
  });

  it('marks exactly the entries without a link as greyed', () => {
    const greyed = DA50RG_CATALOG.places().filter((p) => p.entry.ref === undefined);
    const referenceGreyed = CATALOG_REFERENCE.flatMap((g) => g.rows.filter((r) => r[2] === null));
    expect(greyed.map((p) => [p.entry.tag, p.entry.detail ?? null])).toEqual(
      referenceGreyed.map((r) => [r[0], r[1]]),
    );
    const total = CATALOG_REFERENCE.reduce((n, g) => n + g.rows.length, 0);
    expect(DA50RG_CATALOG.places().length).toBe(total);
  });

  it('gives every entry a unique key built from the group, the tag and the detail', () => {
    const keys = DA50RG_CATALOG.places().map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('cautions:oxy-press-lo-below-500-psi');
    expect(keys).toContain('cautions:oxy-press-lo-below-850-psi');
    expect(keys).toContain('warnings:eng-intake');
    expect(keys).toContain('cautions:eng-intake');
  });
});

describe('defineCatalog', () => {
  const group = (
    id: string,
    entries: readonly { tag: string; detail?: string; ref?: { pack: string; scenario: string } }[],
  ) => ({
    id,
    heading: `HEADING ${id}`,
    tab: id.toUpperCase(),
    entries,
  });
  const make = (groups: ReturnType<typeof group>[]) => defineCatalog({ groups, source: 'test.ts' });

  it('throws for an empty catalog, a repeated group id, an empty tag, an empty heading or tab', () => {
    expect(() => make([])).toThrow(CatalogError);
    expect(() => make([group('a', []), group('a', [])])).toThrow(/defined twice/);
    expect(() => make([group('a', [{ tag: '' }])])).toThrow(/empty tag/);
    expect(() => make([{ ...group('a', []), heading: '' }])).toThrow(/empty heading/);
    expect(() => make([{ ...group('a', []), tab: '' }])).toThrow(/empty tab/);
  });

  it('throws for a repeated entry key and for a ref used twice', () => {
    expect(() => make([group('a', [{ tag: 'X' }, { tag: 'x' }])])).toThrow(/defined twice/);
    // The same tag in another group, or with another detail, is a different entry.
    expect(() =>
      make([group('a', [{ tag: 'X' }]), group('b', [{ tag: 'X' }, { tag: 'X', detail: 'low' }])]),
    ).not.toThrow();
    const ref = { pack: 'p', scenario: 's' };
    expect(() =>
      make([
        group('a', [
          { tag: 'X', ref },
          { tag: 'Y', ref },
        ]),
      ]),
    ).toThrow(/link of two entries/);
  });

  it('puts the items the catalog does not know after the known ones, in their given order', () => {
    const catalog = make([
      group('a', [{ tag: 'A1', ref: { pack: 'p', scenario: 'one' } }, { tag: 'A2' }]),
      group('b', [{ tag: 'B1', ref: { pack: 'p', scenario: 'two' } }]),
    ]);
    const items = [
      { pack: 'q', scenario: 'late' },
      { pack: 'p', scenario: 'two' },
      { pack: 'q', scenario: 'other' },
      { pack: 'p', scenario: 'one' },
    ];
    expect(catalog.order(items).map((i) => i.scenario)).toEqual(['one', 'two', 'late', 'other']);
    expect(catalog.groupOf({ pack: 'q', scenario: 'late' })).toBeUndefined();
    expect(catalog.groupOrLast({ pack: 'q', scenario: 'late' }).id).toBe('b');
    expect(catalog.groupOf({ pack: 'p', scenario: 'one' })?.id).toBe('a');
    expect(catalog.entryOf({ pack: 'p', scenario: 'two' })?.key).toBe('b:b1');
  });

  it('builds the key from the group, the tag and the detail', () => {
    expect(entryKey('g', { tag: 'OXY PRESS LO', detail: 'below 500 psi' })).toBe(
      'g:oxy-press-lo-below-500-psi',
    );
  });
});

describe('checkCatalog (lint L29 and L30)', () => {
  const shippedFor = (list: readonly Shipped[]): ShippedScenario[] =>
    list.map((s) => ({
      pack: s.pack,
      id: s.id,
      heading: s.heading,
      file: `scenarios/${s.pack}/${s.file}.toon`,
      line: 7,
      col: 3,
    }));
  const packsOf = (list: readonly Shipped[]): Set<string> => new Set(list.map((s) => s.pack));

  it('finds nothing wrong with the shipped packs', () => {
    expect(checkCatalog(DA50RG_ENV, shippedFor(SHIPPED), packsOf(SHIPPED))).toEqual([]);
  });

  it('reports a scenario that is not the link of any entry, on the scenario file', () => {
    const extra: Shipped = {
      pack: 'engine',
      id: 'not-in-the-catalog',
      file: 'not-in-the-catalog',
      title: 'X',
      heading: 'X',
    };
    const all = [...SHIPPED, extra];
    const issues = checkCatalog(DA50RG_ENV, shippedFor(all), packsOf(all));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      file: 'scenarios/engine/not-in-the-catalog.toon',
      line: 7,
      col: 3,
    });
    expect(issues[0]?.message).toMatch(/^L29: scenario "engine\/not-in-the-catalog"/);
  });

  it('reports a ref that names no scenario of a checked pack, on the catalog file', () => {
    const rest = SHIPPED.filter((s) => s.id !== 'eng-fire-in-flight');
    const issues = checkCatalog(DA50RG_ENV, shippedFor(rest), packsOf(SHIPPED));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ file: DA50RG_CATALOG.source, line: 1, col: 1 });
    expect(issues[0]?.message).toMatch(
      /L29: the entry "ENGINE FIRE IN FLIGHT" links to "engine\/eng-fire-in-flight"/,
    );
  });

  it('does not judge a ref into a pack that was not checked', () => {
    const onlyFire = SHIPPED.filter((s) => s.pack === 'fire');
    const issues = checkCatalog(DA50RG_ENV, shippedFor(onlyFire), packsOf(onlyFire));
    expect(issues).toEqual([]);
  });

  it('reports a tag that differs from the checklist heading, on the scenario file', () => {
    const changed = SHIPPED.map((s) =>
      s.id === 'eng-oil-temp-green' ? { ...s, heading: 'ENG OIL TEMPERATURE' } : s,
    );
    const issues = checkCatalog(DA50RG_ENV, shippedFor(changed), packsOf(changed));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ file: 'scenarios/engine/eng-oil-temp-green.toon' });
    expect(issues[0]?.message).toMatch(
      /^L30: the checklist heading "ENG OIL TEMPERATURE" differs from the tag "ENG OIL TEMP"/,
    );
  });

  it('skips the tag check for a file that failed its own checks (heading null)', () => {
    const list = shippedFor(SHIPPED).map((s) =>
      s.id === 'eng-oil-temp-green' ? { ...s, heading: null } : s,
    );
    expect(checkCatalog(DA50RG_ENV, list, packsOf(SHIPPED))).toEqual([]);
  });
});

describe('validateAll runs the catalog check once over the packs', () => {
  const read = (pack: string): PackInput => {
    const dir = join(root, 'scenarios', pack);
    const names = readdirSync(dir).filter((n) => n.endsWith('.toon'));
    return {
      dir: `scenarios/${pack}`,
      id: pack,
      manifestText: readFileSync(join(dir, 'pack.toon'), 'utf8'),
      files: names
        .filter((n) => n !== 'pack.toon')
        .map((n) => ({ name: n.slice(0, -5), text: readFileSync(join(dir, n), 'utf8') })),
    };
  };
  const packs = [...new Set(SHIPPED.map((s) => s.pack))].map(read);

  it('passes on the shipped packs', () => {
    expect(validateAll(packs)).toEqual([]);
  });

  it('reports a shipped scenario that is no entry, with file, line and column', () => {
    const first = packs[0];
    if (first === undefined) throw new Error('no pack');
    const manifest = first.manifestText ?? '';
    const scenarioText = first.files[0]?.text ?? '';
    const renamed = scenarioText.replace(/^id: .*$/m, 'id: stray-scenario');
    const stray: PackInput = {
      ...first,
      manifestText:
        manifest.replace(
          /scenarios\[(\d+)\]:/,
          (_m, n: string) => `scenarios[${String(Number(n) + 1)}]:`,
        ) +
        `  - id: stray-scenario\n    title: ${scenarioText.match(/^title: (.*)$/m)?.[1] ?? 'X'}\n    file: stray\n`,
      files: [...first.files, { name: 'stray', text: renamed }],
    };
    const issues = validateAll([stray, ...packs.slice(1)]);
    const mine = issues.filter((i) => i.message.startsWith('L29'));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ file: `${first.dir}/stray.toon` });
    expect(mine[0]?.line).toBeGreaterThan(0);
    expect(mine[0]?.col).toBeGreaterThan(0);
  });
});
