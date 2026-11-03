import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkFollowOns } from '../src/scenario/follow-on-check';
import type { FollowOnSource } from '../src/scenario/follow-on-check';
import { validateAll } from '../src/scenario/validate-all';

// L34 (Phase 9, plan 09-02): the pack-level check of the follow-on targets, run directly on
// in-memory manifests and once through validateAll with the synthetic fixtures.
const root = fileURLToPath(new URL('../', import.meta.url));

const shipped = [
  { pack: 'fire', id: 'eng-fire-in-flight' },
  { pack: 'landing', id: 'landing-engine-off' },
];
const packs = new Set(['fire', 'landing']);

const source = (target: { pack: string; scenario: string }): FollowOnSource => ({
  pack: 'fire',
  id: 'eng-fire-in-flight',
  file: 'scenarios/fire/eng-fire-in-flight.toon',
  targets: [{ conduct: 'conduct_emergency', ...target, line: 7, col: 5 }],
});

describe('checkFollowOns (L34)', () => {
  it('passes a target that names a manifest entry of a checked pack', () => {
    expect(
      checkFollowOns([source({ pack: 'landing', scenario: 'landing-engine-off' })], shipped, packs),
    ).toEqual([]);
  });

  it('reports a target whose entry is missing from a checked pack, at the key', () => {
    const issues = checkFollowOns(
      [source({ pack: 'landing', scenario: 'landing-nope' })],
      shipped,
      packs,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      file: 'scenarios/fire/eng-fire-in-flight.toon',
      line: 7,
      col: 5,
    });
    expect(issues[0]?.message).toContain('L34');
    expect(issues[0]?.message).toContain('"landing/landing-nope"');
  });

  it('reports a reference to the scenario itself, even when its pack was not checked', () => {
    for (const checked of [packs, new Set(['landing'])]) {
      const issues = checkFollowOns(
        [source({ pack: 'fire', scenario: 'eng-fire-in-flight' })],
        shipped,
        checked,
      );
      expect(issues).toHaveLength(1);
      expect(issues[0]?.message).toContain('names the scenario itself');
    }
  });

  it('does not judge a target in a pack that was not checked', () => {
    expect(
      checkFollowOns(
        [source({ pack: 'paid', scenario: 'anything' })],
        shipped.filter((s) => s.pack === 'fire'),
        new Set(['fire']),
      ),
    ).toEqual([]);
  });

  it('reports every bad target of one scenario', () => {
    const two: FollowOnSource = {
      ...source({ pack: 'landing', scenario: 'landing-engine-off' }),
      targets: [
        { conduct: 'a', pack: 'landing', scenario: 'gone-1', line: 3, col: 5 },
        { conduct: 'b', pack: 'landing', scenario: 'gone-2', line: 6, col: 5 },
      ],
    };
    expect(checkFollowOns([two], shipped, packs).map((i) => i.line)).toEqual([3, 6]);
  });
});

describe('validateAll runs L34 beside L29 and L30', () => {
  const read = (name: string): string =>
    readFileSync(`${root}tests/fixtures/scenarios/${name}.toon`, 'utf8');
  const manifest = (entries: readonly string[]): string =>
    `format: 1\ntitle: Landing\nfree: true\nscenarios[${String(entries.length)}]:\n${entries
      .map((id) => `  - id: ${id}\n    title: ${id.toUpperCase().slice(0, 18)}\n    file: ${id}`)
      .join('\n')}\n`;
  // The title of a manifest entry must equal the scenario title.
  const pack = (entries: readonly string[]) => ({
    dir: 'scenarios/engine',
    id: 'engine',
    manifestText: manifest(entries)
      .replace('LANDING-SOURCE', 'LANDING SOURCE')
      .replace('LANDING-FIXTURE', 'LANDING FIXTURE'),
    files: entries.map((id) => ({ name: id, text: read(id) })),
  });

  const l34 = (entries: readonly string[]) =>
    validateAll([pack(entries)]).filter((i) => i.message.startsWith('L34'));

  it('is silent when the target is a manifest entry of the checked pack', () => {
    expect(l34(['landing-source', 'landing-fixture'])).toEqual([]);
  });

  it('reports the source fixture when its target is not listed, with line and column', () => {
    const issues = l34(['landing-source']);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.file).toBe('scenarios/engine/landing-source.toon');
    expect(issues[0]?.line).toBeGreaterThan(1);
    expect(issues[0]?.message).toContain('"engine/landing-fixture"');
  });
});
