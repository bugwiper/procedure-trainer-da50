import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INDICATOR_POSITIONS, REFERENCE_POSITIONS } from './layout-reference';

// D-03, D-06, T-01.1-21: the owner review list exists, is linked from the README and carries
// no private photo content.
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const review = read('docs/PANEL-REVIEW.md');

const UI_SPEC_PATH =
  '.planning/phases/01.1-panel-shape-controls-and-indicator-lights/01.1-UI-SPEC.md';
const uiSpecExists = existsSync(join(root, UI_SPEC_PATH));

/**
 * Ids of UI-SPEC section 13.1 rows whose confidence cell contains "unconfirmed" or reads
 * "same". Rows look like "| 7 | `sw.deice_mode` | ... | confidence |".
 */
function uiSpecUnconfirmedIds(): string[] {
  const ids: string[] = [];
  for (const line of read(UI_SPEC_PATH).split('\n')) {
    const match = /^\|\s*\d+\s*\|\s*`([a-z_.0-9]+)`/.exec(line);
    if (!match?.[1]) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    const confidence = cells[cells.length - 2] ?? '';
    if (/unconfirmed/i.test(confidence) || confidence.toLowerCase() === 'same') ids.push(match[1]);
  }
  return ids;
}

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

describe('panel review completeness (D-03, D-10)', () => {
  const flagged = [...REFERENCE_POSITIONS, ...INDICATOR_POSITIONS]
    .filter((row) => row.review)
    .map((row) => row.id);

  it.each(flagged)('names the review-flagged row %s', (id) => {
    expect(review).toContain(`\`${id}\``);
  });

  it.skipIf(!uiSpecExists)('names every UI-SPEC unconfirmed inventory id', () => {
    const ids = uiSpecUnconfirmedIds();
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => !review.includes(`\`${id}\``))).toEqual([]);
  });

  it('records both registry ids that differ from the UI-SPEC (PD-03, PD-04)', () => {
    for (const id of [
      'sw.deice_mode',
      'lv.deice_mode',
      'sw.stall_gear_test',
      'btn.stall_gear_test',
    ]) {
      expect(review).toContain(id);
    }
  });

  it.each(Array.from({ length: 15 }, (_, i) => `U-${String(i + 1).padStart(2, '0')}`))(
    'has the unconfirmed item %s',
    (label) => {
      expect(review).toContain(`**${label}**`);
    },
  );

  it.each(Array.from({ length: 8 }, (_, i) => `PD-0${i + 1}`))(
    'has the planner decision %s',
    (label) => {
      expect(review).toContain(`**${label}**`);
    },
  );

  it.each([
    ['rudder trim', /rudder trim/i],
    ['rudder pedals adjustment', /rudder pedals adjustment/i],
    ['cowl-flap and ELT status lamps', /cowl-flap position lamps and elt status lamp/i],
    ['left far panel strip', /left far panel strip/i],
  ])('has the open item %s', (_name, pattern) => {
    expect(review).toMatch(pattern);
  });

  it('keeps U-01 as a RESOLVED entry naming white', () => {
    const entry = review.split('\n').find((line) => line.includes('**U-01**')) ?? '';
    expect(entry).toContain('RESOLVED');
    expect(entry.toLowerCase()).toContain('white');
  });
});
