import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// D-03, D-06, T-01.1-21: the owner review list exists, is linked from the README and carries
// no private photo content.
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const review = read('docs/PANEL-REVIEW.md');

describe('panel review document basics', () => {
  it.each(['sw.light_landing', 'sw.light_taxi', 'sw.light_position', 'sw.light_strobe'])(
    'names the glareshield light switch %s',
    (id) => {
      expect(review).toContain(id);
    },
  );

  it('is linked from the README', () => {
    expect(read('README.md')).toContain('](docs/PANEL-REVIEW.md)');
  });
});

describe('panel review hygiene (D-06)', () => {
  it('embeds no image (markdown syntax or html tag)', () => {
    expect(review).not.toMatch(/!\[[^\]]*\]\(/);
    expect(review).not.toMatch(/<img\b/i);
  });

  it('links nowhere into the private input folder', () => {
    expect(review).not.toMatch(/\]\(\s*<?\.?\/?\.input/);
    expect(review).not.toMatch(/\bhref\s*=\s*["']?\.?\/?\.input/i);
  });

  it('does not name a real maker brand', () => {
    expect(review).not.toMatch(/garmin|diamond/i);
  });
});
