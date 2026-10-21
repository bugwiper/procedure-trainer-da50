import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALL_REGION_IDS,
  CB_REFERENCE,
  INDICATOR_POSITIONS,
  REFERENCE_POSITIONS,
} from './layout-reference';

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

  it('links the label table from the README and states the final counts', () => {
    const readme = read('README.md');
    expect(readme).toContain('](docs/PANEL-LABELS.md)');
    // The sentence is built from the independent reference tables, not from literals.
    const controls = REFERENCE_POSITIONS.length + CB_REFERENCE.length;
    expect(readme).toContain(
      `${controls} controls and ${INDICATOR_POSITIONS.length} indicator lamps in ${ALL_REGION_IDS.length} regions`,
    );
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
  const flagged = [...REFERENCE_POSITIONS, ...CB_REFERENCE, ...INDICATOR_POSITIONS]
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
    ['left far panel strip', /left far panel strip/i],
  ])('has the open item %s', (_name, pattern) => {
    expect(review).toMatch(pattern);
  });

  it('records the cowl-flap lamps and the ELT lamp as drawn', () => {
    for (const id of ['lt.cowl_open', 'lt.cowl_closed', 'lt.elt']) {
      expect(review, id).toContain(`\`${id}\``);
    }
    const entry = review.split('\n').find((line) => line.includes('**U-13**')) ?? '';
    expect(entry).toMatch(/drawn/i);
    expect(entry).toContain('RESOLVED');
  });

  it('has the Round 2 morning-review section and the superseded-ids section', () => {
    expect(review).toMatch(/^## .*Round 2/m);
    expect(review).toContain('## Superseded by the owner findings');
    for (const id of [
      'lv.deice_mode',
      'sw.deice_windshield',
      'sw.deice_pump1',
      'sw.deice_pump2',
      'btn.deice_annun_test',
    ]) {
      const at = review.indexOf('## Superseded by the owner findings');
      expect(review.slice(at), id).toContain(`\`${id}\``);
    }
  });

  it('marks the owner-resolved items U-06, U-08, U-09 and U-10 as RESOLVED', () => {
    for (const label of ['U-06', 'U-08', 'U-09', 'U-10']) {
      const entry = review.split('\n').find((line) => line.includes(`**${label}**`)) ?? '';
      expect(entry, label).toContain('RESOLVED');
    }
  });

  it('keeps U-01 as a RESOLVED entry naming white', () => {
    const entry = review.split('\n').find((line) => line.includes('**U-01**')) ?? '';
    expect(entry).toContain('RESOLVED');
    expect(entry.toLowerCase()).toContain('white');
  });
});

// Phase 01.2 owner decision U-01: the panel space was widened to 2180 x 1300. The UI-SPEC section
// is the contract the later plans build on; the review document records the decision.
const UI_SPEC_012_PATH =
  '.planning/phases/01.2-circuit-breakers-g1000-nxi-shapes-and-avionics-panels/01.2-UI-SPEC.md';
const uiSpec012Exists = existsSync(join(root, UI_SPEC_012_PATH));

describe('phase 01.2 owner decision U-01 (widened to 2180)', () => {
  it.skipIf(!uiSpec012Exists)(
    'the UI-SPEC holds the owner decision section and its numbers',
    () => {
      const spec = read(UI_SPEC_012_PATH);
      expect(spec).toContain('Owner decision U-01: widened to 2180');
      for (const needle of ['2180', '1874', 'cb_essential', 'cb_strip']) {
        expect(spec, needle).toContain(needle);
      }
      expect(
        (spec.match(/Superseded by Owner decision U-01/g) ?? []).length,
      ).toBeGreaterThanOrEqual(3);
    },
  );

  it('the review document names the new space, the heading and the decisions P2-01 to P2-05', () => {
    expect(review).toContain('Phase 01.2');
    expect(review).toContain('P2-01');
    expect(review).toContain('P2-02');
    expect(review).toContain('P2-03');
    expect(review).toContain('P2-04');
    expect(review).toContain('P2-05');
    expect(review).toContain('1874');
    expect(review).toContain('2180');
    expect(review).not.toContain('2000 x 1300');
  });
});

// Phase 01.2 plan 09: the morning-review entry point. Every research question, every UI-SPEC item
// and every decision of the phase is listed with its default, then the Round 3 list.
describe('phase 01.2 review list (Q2, U2, P2, Round 3)', () => {
  const lineOf = (label: string): string =>
    review.split('\n').find((line) => line.includes(`**${label}**`)) ?? '';
  const pad = (n: number): string => String(n).padStart(2, '0');

  it.each(Array.from({ length: 10 }, (_, i) => `Q2-${pad(i + 1)}`))(
    'has the research question %s with its default',
    (label) => {
      expect(lineOf(label), `${label} missing`).not.toBe('');
      expect(lineOf(label)).toContain('Default taken:');
    },
  );

  it.each(Array.from({ length: 37 }, (_, i) => `U2-${pad(i + 1)}`))(
    'has the UI-SPEC item %s with its default and a status',
    (label) => {
      const line = lineOf(label);
      expect(line, `${label} missing`).not.toBe('');
      expect(line).toContain('Default taken:');
      expect(line).toMatch(/BUILT AS SPECIFIED|BUILT WITH CHANGE|NOT DRAWN/);
    },
  );

  it.each(Array.from({ length: 6 }, (_, i) => `P2-${pad(i + 1)}`))(
    'has the decision %s',
    (label) => {
      expect(lineOf(label), `${label} missing`).not.toBe('');
    },
  );

  it('records the width decision Q2-01 as resolved by the owner', () => {
    expect(lineOf('Q2-01')).toContain('RESOLVED');
    expect(lineOf('Q2-01')).toContain('2180');
  });

  it('has the Round 3 section as the last section, starting with the width decision', () => {
    const headings = [...review.matchAll(/^## .*$/gm)].map((m) => m[0]);
    expect(headings[headings.length - 1]).toMatch(/Round 3: morning review/);
    const at = review.search(/^## .*Round 3/m);
    const items = review
      .slice(at)
      .split('\n')
      .filter((line) => /^\d+\. /.test(line));
    expect(items.length).toBeGreaterThanOrEqual(10);
    expect(items[0]).toContain('Q2-01');
    expect(items[0]).toMatch(/tablet/);
    expect(items[0]).toMatch(/portrait phone/);
  });

  it('gives the owner the live check command in the Round 3 section', () => {
    const at = review.search(/^## .*Round 3/m);
    const round3 = review.slice(at);
    expect(round3).toContain('e2e/breaker.spec.ts e2e/glass.spec.ts e2e/avionics.spec.ts');
    expect(round3).toContain('PW_BASE_URL=');
    expect(round3).toMatch(/nothing was pushed/i);
  });

  it.each(ALL_REGION_IDS)('names the region %s in backticks', (id) => {
    expect(review).toContain(`\`${id}\``);
  });

  it.each([
    'cb_essential',
    'cb_main',
    'cb_low',
    'cb_strip',
    'pfd_softkeys',
    'pfd_bezel_left',
    'pfd_bezel_right',
    'mfd_bezel_right',
    'audio_panel',
    'standby_efis',
    'autopilot_panel',
  ])('names the new region %s that phase 01.2 added', (id) => {
    expect(review).toContain(`\`${id}\``);
    expect(ALL_REGION_IDS).toContain(id);
  });

  it('names every one of the 51 breakers', () => {
    expect(CB_REFERENCE).toHaveLength(51);
    expect(
      CB_REFERENCE.filter((row) => !review.includes(`\`${row.id}\``)).map((r) => r.id),
    ).toEqual([]);
  });

  it('states the final counts in the README and describes the new areas', () => {
    const readme = read('README.md');
    expect(readme).toContain('92 controls and 13 indicator lamps in 30 regions');
    for (const needle of [
      'CIRCUIT BREAKERS',
      'ESSENTIAL',
      'MAIN',
      'AVIONICS',
      'lower row',
      'flap strip',
      'softkeys',
      'AUDIO PANEL',
      'BACKUP EFIS',
      'AUTOPILOT PANEL',
      'DISPLAY BACKUP',
    ]) {
      expect(readme, needle).toContain(needle);
    }
    expect(readme).toMatch(/raised cap and a white ring/);
  });

  it('keeps the deferred behaviour in a todo with its reason', () => {
    const path = '.planning/todos/pending/2026-10-21-breaker-effects-and-avionics-functions.md';
    expect(existsSync(join(root, path))).toBe(true);
    const todo = read(path);
    for (const needle of [
      'breaker effects',
      'DISPLAY BACKUP',
      'audio panel',
      'autopilot',
      'arming gate',
      'Q2-01',
      'Q2-05',
    ]) {
      expect(todo, needle).toContain(needle);
    }
  });
});
