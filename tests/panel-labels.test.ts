import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_INDICATORS } from '../src/aircraft/da50rg/indicators';
import { DA50RG } from '../src/aircraft/da50rg/panel';

// G-0.2, D-10, T-01.1-26: the owner label table (docs/PANEL-LABELS.md) names every control, every
// lamp and every planned id, quotes only static placard text and carries no private photo content.
const root = fileURLToPath(new URL('../', import.meta.url));
const doc = readFileSync(join(root, 'docs/PANEL-LABELS.md'), 'utf8');

/** Ids that Table P1 of plan 12 lets later plans create (plan number in the comment). */
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

const ID_PATTERN = /^(sw|btn|lv|lt)\.[a-z_0-9]+$/;

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

describe('panel label table: planned and removed ids', () => {
  it.each(Object.entries(PLANNED_BY_PLAN))(
    'marks %s as planned with the number of the plan that creates it',
    (id, plan) => {
      const row = doc
        .split('\n')
        .find((line) => line.startsWith('|') && line.includes(`\`${id}\``));
      expect(row, `${id} has no table row`).toBeDefined();
      expect(row).toContain(`planned, plan ${String(plan)}`);
    },
  );

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
