import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Living-document gate (D-19, D-26): the scenario format is TOON, and the earlier text
// format must not come back into any living project document. Dated phase records under
// .planning/phases/ are history and are not listed here.
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

// The earlier format word is assembled from its letters so this file never contains it.
const staleWord = new RegExp(['y', 'a', 'm', 'l'].join(''), 'i');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const docsFiles = walk(join(root, 'docs')).map((p) => p.slice(root.length));

export const LIVING_DOCUMENTS: readonly string[] = [
  'README.md',
  ...docsFiles,
  '.claude/CLAUDE.md',
  '.planning/research/STACK.md',
  '.planning/PROJECT.md',
  '.planning/ROADMAP.md',
  '.planning/REQUIREMENTS.md',
  '.planning/todos/pending/2026-10-21-review-warnings-hardening.md',
  '.planning/todos/pending/2026-10-21-breaker-effects-and-avionics-functions.md',
];

describe('living documents name TOON as the scenario format', () => {
  it.each(LIVING_DOCUMENTS)('%s carries no wording of the earlier format', (rel) => {
    const offending = read(rel)
      .split('\n')
      .map((text, i) => ({ line: i + 1, text }))
      .filter(({ text }) => staleWord.test(text));
    expect(offending).toEqual([]);
  });

  it.each(['.claude/CLAUDE.md', '.planning/research/STACK.md'])(
    '%s names TOON and the pinned parser version 4.4.0',
    (rel) => {
      const text = read(rel);
      expect(text).toMatch(/TOON/);
      expect(text).toContain('@toon-format/toon');
      expect(text).toContain('4.4.0');
    },
  );

  it('REQUIREMENTS.md SCN-01 says TOON files', () => {
    const line = read('.planning/REQUIREMENTS.md')
      .split('\n')
      .find((l) => l.includes('SCN-01'));
    expect(line).toBeDefined();
    expect(line).toContain('TOON files');
  });
});
