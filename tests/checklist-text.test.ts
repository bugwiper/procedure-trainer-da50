import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { checkScenario } from '../src/scenario/lint';
import type { ProcedureNode, Scenario } from '../src/scenario/schema';
import { PRINTED, PRINTED_FILES } from './checklist-reference';
import type { PrintedItem } from './checklist-reference';

// The shipped scenario files carry the printed checklists word for word (plan 03-13, T-03-33). An
// independent walker reads rows, steps and comment nodes in reading order from the parsed scenario
// and compares them with the reference table; the files are read from scenarios/ and checked with
// checkScenario, the check of the app and of `npm run validate`.
const root = fileURLToPath(new URL('../', import.meta.url));

function load(file: string): Scenario {
  const result = checkScenario(readFileSync(`${root}${file}`, 'utf8'), DA50RG_ENV);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.scenario;
}

/** The rows of a table in reading order: lines, the steps of a group in order, comment nodes. */
function tableRows(nodes: readonly ProcedureNode[]): PrintedItem[] {
  const rows: PrintedItem[] = [];
  for (const node of nodes) {
    switch (node.kind) {
      case 'line':
        rows.push({
          kind: 'row',
          ...(node.number === undefined ? {} : { number: node.number }),
          item: node.text,
          ...(node.action === undefined ? {} : { action: node.action }),
        });
        break;
      case 'group':
        for (const step of node.steps) {
          rows.push({
            kind: 'row',
            ...(step.number === undefined ? {} : { number: step.number }),
            item: step.text,
            ...(step.action === undefined ? {} : { action: step.action }),
          });
        }
        break;
      case 'comment':
        rows.push({
          kind: 'comment',
          text: node.text,
          ...(node.boxed === true ? { boxed: true as const } : {}),
          ...(node.action === undefined ? {} : { reference: node.action }),
        });
        break;
      case 'decision':
      case 'branch':
        throw new Error('a table checklist holds no decision or branch');
    }
  }
  return rows;
}

describe('the shipped checklists match the printed wording', () => {
  for (const [id, printed] of Object.entries(PRINTED)) {
    const file = PRINTED_FILES[id];
    it(`${id}: form, heading and message`, () => {
      expect(file, `a file for ${id}`).toBeDefined();
      const scenario = load(file ?? '');
      expect(scenario.id).toBe(id);
      expect(scenario.checklist?.form).toBe(printed.form);
      expect(scenario.checklist?.heading).toBe(printed.heading);
      expect(scenario.checklist?.message).toBe(printed.message);
    });

    if (printed.form === 'table') {
      it(`${id}: every row and comment in reading order`, () => {
        const scenario = load(file ?? '');
        // `own` marks a row that is not printed; the parsed rows carry no such flag.
        const expected = printed.rows.map((row) => {
          if (row.kind !== 'row') return row;
          const { own: _own, ...rest } = row;
          return rest;
        });
        expect(tableRows(scenario.procedure)).toEqual(expected);
      });

      it(`${id}: only an unnumbered last row may be an own addition`, () => {
        const own = printed.rows.filter((row) => row.kind === 'row' && row.own === true);
        expect(own.length).toBeLessThanOrEqual(1);
        for (const row of own) {
          expect(row.kind === 'row' && row.number).toBeUndefined();
          expect(printed.rows.at(-1)).toBe(row);
        }
      });
    }
  }
});
