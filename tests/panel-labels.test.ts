import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AUDIO_PANEL,
  AUTOPILOT_PANEL,
  BEZEL_COLUMNS,
  MFD_ENGINE_LEGENDS,
  MFD_MAP_LEGENDS,
  PFD_LEGENDS,
  type UnitElement,
} from '../src/aircraft/da50rg/avionics';
import { DA50RG_INDICATORS } from '../src/aircraft/da50rg/indicators';
import { DA50RG } from '../src/aircraft/da50rg/panel';

// G-0.2, D-10, T-01.1-26: the owner label table (docs/PANEL-LABELS.md) names every control, every
// lamp and every planned id, quotes only static placard text and carries no private photo content.
const root = fileURLToPath(new URL('../', import.meta.url));
const doc = readFileSync(join(root, 'docs/PANEL-LABELS.md'), 'utf8');

/** Ids that Table P1 of plan 12 let later plans create (plan number in the comment); all exist now. */
const PLANNED_IDS: readonly string[] = [
  'lt.elt', // plan 18
  'lt.cowl_open', // plan 19
  'lt.cowl_closed', // plan 19
  'sw.deice_mode', // plan 21
  'btn.deice_max', // plan 21
  'lt.deice_max', // plan 21
  'lt.deice_high', // plan 21
  'lt.deice_norm', // plan 21
  'btn.deice_windshield', // plan 22
  'sw.deice_pump', // plan 22
];

/** Ids the owner findings remove; they may already be gone from the registry when plans land. */
const REMOVED_IDS: readonly string[] = [
  'lv.deice_mode', // plan 21
  'sw.deice_windshield', // plan 22
  'sw.deice_pump1', // plan 22
  'sw.deice_pump2', // plan 22
  'btn.deice_annun_test', // plan 22
];

/** Ids still to be documented; empty now that every area is written. */
const NOT_YET_DOCUMENTED: readonly string[] = [];

const ID_PATTERN = /^(sw|btn|lv|lt|cb)\.[a-z_0-9]+$/;

/** Ids named in backticks in the first column of every table row of the document. */
function documentedIds(): string[] {
  const ids: string[] = [];
  for (const line of doc.split('\n')) {
    if (!line.startsWith('|')) continue;
    const firstCell = line.split('|')[1] ?? '';
    for (const match of firstCell.matchAll(/`([^`]+)`/g)) {
      const token = match[1] ?? '';
      if (ID_PATTERN.test(token)) ids.push(token);
    }
  }
  return ids;
}

const controlIds = DA50RG.controls.filter((c) => c.kind !== 'guard').map((c) => c.id);
const lampIds = DA50RG_INDICATORS.indicators.map((l) => l.id);
const known = new Set<string>([...controlIds, ...lampIds, ...PLANNED_IDS, ...REMOVED_IDS]);
const named = new Set(documentedIds());

describe('panel label table: ids', () => {
  it('names at least one id (the table is parsed)', () => {
    expect(named.size).toBeGreaterThan(0);
  });

  it('names no id that is not a registry id, a lamp id, a planned id or a removed id', () => {
    expect([...named].filter((id) => !known.has(id))).toEqual([]);
  });

  it('names every registry control id and every lamp id outside the not-yet-documented list', () => {
    const missing = [...controlIds, ...lampIds].filter(
      (id) => !named.has(id) && !NOT_YET_DOCUMENTED.includes(id),
    );
    expect(missing).toEqual([]);
  });

  it('lists only ids that exist in NOT_YET_DOCUMENTED and are still missing', () => {
    const everything = new Set([...controlIds, ...lampIds]);
    for (const id of NOT_YET_DOCUMENTED) {
      expect(everything.has(id), `${id} is not a registry or lamp id`).toBe(true);
      expect(named.has(id), `${id} is documented, drop it from NOT_YET_DOCUMENTED`).toBe(false);
    }
  });
});

describe('panel label table: hygiene (D-06, T-01.1-26)', () => {
  it('embeds no image (markdown syntax or html tag)', () => {
    expect(doc).not.toMatch(/!\[[^\]]*\]\(/);
    expect(doc).not.toMatch(/<img\b/i);
  });

  it('links nowhere into the private input folder', () => {
    expect(doc).not.toMatch(/\]\(\s*<?\.?\/?\.input/);
    expect(doc).not.toMatch(/\bhref\s*=\s*["']?\.?\/?\.input/i);
  });

  it('does not name a real maker brand', () => {
    expect(doc).not.toMatch(/garmin|diamond/i);
  });
});

/** Plan that creates each planned id (Table P1 of plan 12). */
const PLANNED_BY_PLAN: Readonly<Record<string, number>> = {
  'lt.elt': 18,
  'lt.cowl_open': 19,
  'lt.cowl_closed': 19,
  'sw.deice_mode': 21,
  'btn.deice_max': 21,
  'lt.deice_max': 21,
  'lt.deice_high': 21,
  'lt.deice_norm': 21,
  'btn.deice_windshield': 22,
  'sw.deice_pump': 22,
};

const STATE_WORDS = [
  'RELEASED',
  'PRESSED',
  'NEUTRAL',
  'GUARD OPEN',
  'GUARD CLOSED',
  'GEAR DOWN LOCKED',
  'FLAPS UP',
];

describe('panel label table: created and removed ids', () => {
  it.each(Object.entries(PLANNED_BY_PLAN))(
    'has a table row for %s that names the plan that created it and no longer says planned',
    (id, plan) => {
      const row = doc
        .split('\n')
        .find((line) => line.startsWith('|') && line.includes(`\`${id}\``));
      expect(row, `${id} has no table row`).toBeDefined();
      expect(row).toContain(`plan ${String(plan)}`);
      expect(row).not.toMatch(/planned/i);
    },
  );

  it.each(PLANNED_IDS)('the created id %s exists in the registry or the indicator set', (id) => {
    expect(controlIds.includes(id) || lampIds.includes(id), id).toBe(true);
  });

  it.each(REMOVED_IDS)(
    'the removed id %s is gone from the registry and the indicator set',
    (id) => {
      expect(controlIds.includes(id) || lampIds.includes(id), id).toBe(false);
    },
  );

  it('does not say "planned" anywhere in the document', () => {
    expect(doc).not.toMatch(/planned/i);
  });

  it('lists the five removed ids in the section "Superseded by the owner findings"', () => {
    const start = doc.indexOf('## Superseded by the owner findings');
    expect(start).toBeGreaterThan(-1);
    const section = doc.slice(start);
    for (const id of REMOVED_IDS) expect(section, id).toContain(`\`${id}\``);
  });
});

describe('panel label table: questions for the owner', () => {
  it.each(Array.from({ length: 14 }, (_, i) => `Q-${String(i + 1).padStart(2, '0')}`))(
    'has the question %s with a default',
    (label) => {
      const line = doc.split('\n').find((l) => l.includes(`**${label}**`)) ?? '';
      expect(line, `${label} missing`).not.toBe('');
      expect(line).toMatch(/Default taken:/);
    },
  );

  it('says the questions block nothing', () => {
    expect(doc).toMatch(/do not block anything/);
  });
});

describe('panel label table: static text only (G-0.1)', () => {
  it('has no label or placard cell that is only a state word', () => {
    const offenders: string[] = [];
    let columns: number[] = [];
    for (const line of doc.split('\n')) {
      if (!line.startsWith('|')) {
        columns = [];
        continue;
      }
      const cells = line.split('|').map((cell) => cell.trim());
      const labelAt = cells.indexOf('Static label(s)');
      if (labelAt > -1) {
        columns = [labelAt, cells.indexOf('Position placards')];
        continue;
      }
      for (const at of columns) {
        const cell = (cells[at] ?? '').toUpperCase();
        if (STATE_WORDS.includes(cell)) offenders.push(`${line.slice(0, 40)}: ${cell}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/** The text of one `## ` section of the document (heading excluded), up to the next section. */
function section(heading: string): string {
  const start = doc.indexOf(`\n## ${heading}\n`);
  expect(start, `section "${heading}" missing`).toBeGreaterThan(-1);
  const body = doc.slice(start + heading.length + 5);
  const end = body.indexOf('\n## ');
  return end === -1 ? body : body.slice(0, end);
}

/** The table row whose first cell is exactly `unit` (plain text, no backticks). */
function unitRow(sectionText: string, unit: string): string {
  const row = sectionText
    .split('\n')
    .find((line) => line.startsWith('|') && (line.split('|')[1] ?? '').trim() === unit);
  expect(row, `no row for "${unit}"`).toBeDefined();
  return row ?? '';
}

/** Every printed string of a list of unit elements: static names, sub-legends and key legends. */
function printedStrings(elements: readonly UnitElement[]): string[] {
  const out: string[] = [];
  for (const e of elements) {
    if (e.kind === 'text') out.push(e.text);
    if (e.kind === 'key' && e.legend !== null) out.push(e.legend);
  }
  return out;
}

describe('panel label table: circuit breakers (phase 01.2)', () => {
  const breakers = DA50RG.controls.flatMap((c) => (c.kind === 'circuit-breaker' ? [c] : []));
  const text = () => section('Circuit breakers');

  it('has the sections Circuit breakers, Bus panel static text and Avionics static labels', () => {
    for (const heading of ['Circuit breakers', 'Bus panel static text', 'Avionics static labels']) {
      expect(doc, heading).toContain(`\n## ${heading}\n`);
    }
  });

  it('names all 51 breaker ids in the Circuit breakers section', () => {
    const ids = [...text().matchAll(/`(cb\.[a-z_0-9]+)`/g)].map((m) => m[1]);
    expect(breakers).toHaveLength(51);
    expect(new Set(ids).size).toBe(51);
    expect(breakers.filter((b) => !ids.includes(b.id)).map((b) => b.id)).toEqual([]);
  });

  it.each(breakers.map((b) => [b.id, b] as const))(
    'the row of %s gives its printed label lines and its rating as written',
    (id, b) => {
      const row =
        text()
          .split('\n')
          .find(
            (line) => line.startsWith('|') && (line.split('|')[1] ?? '').includes(`\`${id}\``),
          ) ?? '';
      expect(row, `${id} has no row`).not.toBe('');
      // "GPS/, NAV 1 (5)": the label lines joined by a comma, then the rating in brackets.
      expect(row, id).toContain(`${b.labelLines.join(', ')} (${b.rating})`);
    },
  );

  it('prints the half-amp rating as 7½ for the two breakers that carry it', () => {
    expect(breakers.filter((b) => b.rating === '7½').map((b) => b.id)).toEqual([
      'cb.afcs_esp',
      'cb.deice',
    ]);
    expect(text()).toContain('AFCS/ESP (7½)');
    expect(text()).toContain('DE-ICE (7½)');
  });

  it('lists the static text of the bus panel frame', () => {
    const frame = section('Bus panel static text');
    for (const word of ['ESSENTIAL BUS', 'MAIN BUS', 'AVIONICS BUS', 'ADF', 'DATA / LINK']) {
      expect(frame, word).toContain(word);
    }
  });
});

describe('panel label table: avionics static labels (phase 01.2)', () => {
  const avionics = () => section('Avionics static labels');

  const UNITS: readonly (readonly [string, readonly string[]])[] = [
    ['PFD softkey legends', PFD_LEGENDS],
    ['MFD softkey legends, map page', MFD_MAP_LEGENDS.filter((l) => l !== '')],
    ['MFD softkey legends, engine page', MFD_ENGINE_LEGENDS.filter((l) => l !== '')],
    ['PFD knob column, left', printedStrings(BEZEL_COLUMNS.pfd_bezel_left)],
    ['PFD knob column, right', printedStrings(BEZEL_COLUMNS.pfd_bezel_right)],
    ['MFD knob column, right', printedStrings(BEZEL_COLUMNS.mfd_bezel_right)],
    ['Audio panel', printedStrings(AUDIO_PANEL)],
    ['Autopilot panel', printedStrings(AUTOPILOT_PANEL)],
    // The backup EFIS labels are drawn by the frame, not carried in the data tables.
    ['Backup EFIS', ['KTS', 'FEET', 'BARO']],
  ];

  it('has a table with the columns Unit, Static labels, Basis and File to edit', () => {
    expect(avionics()).toContain('| Unit | Static labels | Basis | File to edit |');
  });

  it.each(UNITS)('the row "%s" holds every printed string of its data', (unit, strings) => {
    expect(strings.length).toBeGreaterThan(0);
    const row = unitRow(avionics(), unit);
    expect(strings.filter((s) => !row.includes(s))).toEqual([]);
  });

  it('holds the DISPLAY and BACKUP legends of the red audio-panel button', () => {
    const row = unitRow(avionics(), 'Audio panel');
    expect(row).toContain('DISPLAY');
    expect(row).toContain('BACKUP');
  });
});

// Plan 31: the rows of the round 2 build (R2-1.1, R2-4.1, R2-4.2, R2-5.2) carry the static words.
describe('panel label table: round 2 rows (plan 31)', () => {
  const rowOf = (id: string): string =>
    doc.split('\n').find((line) => line.startsWith('|') && line.includes(`\`${id}\``)) ?? '';

  it('the FADEC switch row names the heading, AUTO and FORCE B', () => {
    const row = rowOf('sw.fadec');
    for (const word of ['FADEC', 'AUTO', 'FORCE B']) expect(row, word).toContain(word);
  });

  it('the FADEC TEST row names the placard TEST', () => {
    expect(rowOf('btn.fadec_test')).toContain('TEST');
  });

  it.each(['sw.alternator_1', 'sw.alternator_2'])(
    'the row of %s names the ALTERNATOR heading, ON, OFF and its framed numeral',
    (id) => {
      const row = rowOf(id);
      for (const word of ['ALTERNATOR', 'ON', 'OFF', 'framed']) expect(row, word).toContain(word);
    },
  );

  it.each(['sw.light_landing', 'sw.light_strobe'])(
    'the row of %s names the ON and OFF plate text on its side',
    (id) => {
      const row = rowOf(id);
      expect(row).toContain('ON');
      expect(row).toContain('OFF');
    },
  );

  it('the FAN row names OFF, the fan glyphs and the four click spots', () => {
    const row = rowOf('sw.env_fan');
    expect(row).toContain('OFF');
    expect(row).toMatch(/click spots/);
  });

  it('the PARKING BRAKE row names the placard and the flap', () => {
    const row = rowOf('lv.parking_brake');
    expect(row).toContain('PARKING BRAKE');
    expect(row).toMatch(/flap/);
  });

  it('the engine strip placards are plate text, none is a state word', () => {
    expect(doc).toMatch(/plate text/);
  });

  it('question Q-09 is answered with the planner reading of the FADEC state order', () => {
    const line = doc.split('\n').find((l) => l.includes('**Q-09**')) ?? '';
    expect(line).toMatch(/Default taken:/);
    expect(line).toMatch(/AUTO/);
    expect(line).toMatch(/FORCE B/);
  });
});
