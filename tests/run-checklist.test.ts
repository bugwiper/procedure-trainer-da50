import { describe, expect, it, vi } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { parseScenario } from '../src/scenario/parse';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChecklistList } from '../src/ui/session';
import { ChecklistChoices } from '../src/ui/screens/RunChecklist';
import { CATALOG_LISTING_ORDER, CATALOG_REFERENCE } from './checklist-catalog-reference';
import { expand, findElements, textOf } from './vnode-walk';

// The Realistic list of checklists (plan 07-06, R-17): one tab per catalog group with its full
// printed heading, the entries of the selected tab below, a loaded entry a button, every other
// entry greyed and disabled. Every number comes from the independent catalog reference.
const root = fileURLToPath(new URL('../', import.meta.url));
const parsed = parseScenario(
  readFileSync(join(root, 'scenarios/engine/eng-oil-temp-green.toon'), 'utf8'),
);
if (!parsed.ok) throw new Error('the blueprint does not parse');

/** A ready list that holds every shipped scenario of the reference listing order (the file is a stand-in). */
const READY: ChecklistList = {
  status: 'ready',
  entries: CATALOG_LISTING_ORDER.map(([pack, scenario]) => {
    const tag =
      CATALOG_REFERENCE.flatMap((g) => g.rows).find(
        (row) => row[2] === `${pack}/${scenario}`,
      )?.[0] ?? scenario;
    return { ref: { pack, scenario }, heading: tag, scenario: parsed.value };
  }),
};

const render = (list: ChecklistList, tab: string, onChoose = vi.fn(), onTab = vi.fn()) =>
  expand(
    ChecklistChoices({
      list,
      catalog: DA50RG_ENV.catalog,
      tab,
      onTab,
      onChoose,
      onRetry: vi.fn(),
    }),
  );

describe('the list of checklists of the sheet (R-17)', () => {
  it('has one tab per catalog group with the full printed heading, the selected one marked', () => {
    for (const selected of CATALOG_REFERENCE) {
      const tree = render(READY, selected.id);
      const tabs = findElements(tree, (el) => el.props['role'] === 'tab');
      expect(tabs.map((t) => textOf(t))).toEqual(CATALOG_REFERENCE.map((g) => g.heading));
      expect(tabs.map((t) => t.props['aria-selected'])).toEqual(
        CATALOG_REFERENCE.map((g) => g.id === selected.id),
      );
      expect(tabs.map((t) => t.props['data-testid'])).toEqual(
        CATALOG_REFERENCE.map((g) => `run-checklist-tab-${g.id}`),
      );
    }
  });

  it('lists the entries of the selected tab in the printed order, linked ones as buttons, the rest greyed', () => {
    for (const group of CATALOG_REFERENCE) {
      const tree = render(READY, group.id);
      const rows = findElements(
        tree,
        (el) =>
          el.props['data-testid'] === 'run-checklist-entry' ||
          el.props['data-testid'] === 'run-checklist-entry-greyed',
      );
      expect(rows).toHaveLength(group.rows.length);
      rows.forEach((row, i) => {
        const [tag, detail, link] = group.rows[i] ?? ['', null, null];
        const text = textOf(row);
        expect(text.startsWith(tag), tag).toBe(true);
        if (detail !== null) expect(text).toContain(detail);
        if (link === null) {
          expect(row.props['data-testid']).toBe('run-checklist-entry-greyed');
          expect(row.props['disabled']).toBe(true);
          expect(row.props['aria-disabled']).toBe('true');
        } else {
          expect(row.props['data-testid']).toBe('run-checklist-entry');
          expect(row.props['disabled']).toBeUndefined();
        }
      });
    }
  });

  it('a press on a linked entry chooses its scenario; a tab press names its group', () => {
    const onChoose = vi.fn();
    const onTab = vi.fn();
    const group = CATALOG_REFERENCE[0];
    const link = group?.rows.find((r) => r[2] !== null)?.[2] ?? '';
    const tree = render(READY, group?.id ?? '', onChoose, onTab);
    const entry = findElements(tree, (el) => el.props['data-testid'] === 'run-checklist-entry')[0];
    (entry?.props['onClick'] as () => void)();
    const [pack = '', scenario = ''] = link.split('/');
    expect(onChoose).toHaveBeenCalledWith({ pack, scenario });
    const other = findElements(tree, (el) => el.props['role'] === 'tab')[1];
    (other?.props['onClick'] as () => void)();
    expect(onTab).toHaveBeenCalledWith(CATALOG_REFERENCE[1]?.id);
  });

  it('greys an entry whose scenario is not loaded (a pack the policy denies) ', () => {
    const fewer: ChecklistList = { status: 'ready', entries: READY.entries.slice(1) };
    const group = CATALOG_REFERENCE[0];
    const rows = findElements(render(fewer, group?.id ?? ''), (el) =>
      String(el.props['data-testid']).startsWith('run-checklist-entry'),
    );
    expect(rows.every((r) => r.props['data-testid'] === 'run-checklist-entry-greyed')).toBe(true);
  });

  it('shows the tabs with a loading message and with the failure message', () => {
    for (const status of ['loading', 'failed'] as const) {
      const tree = render({ status, entries: [] }, CATALOG_REFERENCE[0]?.id ?? '');
      expect(findElements(tree, (el) => el.props['role'] === 'tab')).toHaveLength(
        CATALOG_REFERENCE.length,
      );
      const id = status === 'loading' ? 'run-checklist-loading' : 'run-checklist-failed';
      expect(findElements(tree, (el) => el.props['data-testid'] === id)).toHaveLength(1);
    }
  });

  it('puts a loaded scenario the catalog does not know after the entries of the last group', () => {
    const stray = {
      ref: { pack: 'paid', scenario: 'extra' },
      heading: 'EXTRA CHECKLIST',
      scenario: parsed.value,
    };
    const list: ChecklistList = { status: 'ready', entries: [...READY.entries, stray] };
    const last = CATALOG_REFERENCE[CATALOG_REFERENCE.length - 1];
    const rows = findElements(render(list, last?.id ?? ''), (el) =>
      String(el.props['data-testid']).startsWith('run-checklist-entry'),
    );
    expect(rows).toHaveLength((last?.rows.length ?? 0) + 1);
    expect(textOf(rows[rows.length - 1] ?? rows[0] ?? ({} as never))).toBe('EXTRA CHECKLIST');
    // Not in another group.
    const first = CATALOG_REFERENCE[0];
    const other = findElements(render(list, first?.id ?? ''), (el) =>
      String(el.props['data-testid']).startsWith('run-checklist-entry'),
    );
    expect(other).toHaveLength(first?.rows.length ?? 0);
  });
});
