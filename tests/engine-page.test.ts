import { describe, expect, it } from 'vitest';
import { ENGINE_PAGE } from '../src/aircraft/da50rg/engine-page';
import type { PageEntry, PageRect } from '../src/aircraft/da50rg/engine-page';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import type { PanelBridge } from '../src/ui/bridge';
import { dualGaugeHeight } from '../src/ui/panel/frames/DualGauge';
import { MfdFrame } from '../src/ui/panel/frames/MfdFrame';
import {
  COLUMN_ORDER,
  FUEL_QTY_SCALE,
  GAUGE_ROWS,
  INNER_ROWS,
  LABELS,
  MIN_CELL_H,
  PAGE_ZONE,
  ZONE_MARGIN,
} from './engine-page-reference';
import { expand, findElements, textOf } from './vnode-walk';

// The layout data of the engine page against the independent reference (tests/engine-page-reference.ts):
// every rectangle inside the glass zone, no overlaps, the column order, the cell heights and the
// drawn boxes, gauges and static texts of the frame.

const mfd = DA50RG.regions.find((r) => r.id === 'mfd');
if (mfd === undefined) throw new Error('no mfd region');

const bridge = (values: Record<string, number> = {}): PanelBridge =>
  ({
    registry: DA50RG,
    stateOf: () => ({ value: 'engine' }),
    quantities: { value: { ...DA50RG_QUANTITIES.baseValues(), ...values } },
    cas: { value: [] },
  }) as unknown as PanelBridge;

const page = expand(MfdFrame({ region: mfd, bridge: bridge() }));
const content = findElements(page, (e) => e.props['data-testid'] === 'mfd-engine-page')[0];
if (content === undefined) throw new Error('no engine page');

const columns = Object.fromEntries(ENGINE_PAGE.map((c) => [c.id, c.entries]));
const all: PageEntry[] = [];
const walk = (entries: readonly PageEntry[]): void => {
  for (const entry of entries) {
    all.push(entry);
    if (entry.kind === 'frame') walk(entry.rows);
  }
};
for (const column of ENGINE_PAGE) walk(column.entries);

const right = (r: PageRect) => r.x + r.w;
const bottom = (r: PageRect) => r.y + r.h;
const overlap = (a: PageRect, b: PageRect) =>
  a.x < right(b) && b.x < right(a) && a.y < bottom(b) && b.y < bottom(a);
const inside = (inner: PageRect, outer: PageRect, margin: number) =>
  inner.x >= outer.x + margin &&
  inner.y >= outer.y + margin &&
  right(inner) <= right(outer) - margin &&
  bottom(inner) <= bottom(outer) - margin;
const zone: PageRect = {
  x: PAGE_ZONE.x0,
  y: PAGE_ZONE.y0,
  w: PAGE_ZONE.x1 - PAGE_ZONE.x0,
  h: PAGE_ZONE.y1 - PAGE_ZONE.y0,
};

describe('the layout data against the reference', () => {
  it('has the three columns of the reference with their boxes in top to bottom order', () => {
    expect(ENGINE_PAGE.map((c) => c.id)).toEqual(Object.keys(COLUMN_ORDER));
    for (const [id, order] of Object.entries(COLUMN_ORDER)) {
      const entries = columns[id] ?? [];
      expect(
        entries.map((e) => e.id),
        id,
      ).toEqual([...order]);
      for (let i = 1; i < entries.length; i++) {
        const above = entries[i - 1];
        const below = entries[i];
        expect(bottom(above?.rect ?? zone), `${id} ${String(i)}`).toBeLessThanOrEqual(
          below?.rect.y ?? Number.NaN,
        );
      }
    }
  });

  it('keeps the columns left of one another', () => {
    const edge = (id: string, f: (r: PageRect) => number, pick: (a: number[]) => number) =>
      pick((columns[id] ?? []).map((e) => f(e.rect)));
    expect(edge('left', right, (a) => Math.max(...a))).toBeLessThanOrEqual(
      edge(
        'middle',
        (r) => r.x,
        (a) => Math.min(...a),
      ),
    );
    expect(edge('middle', right, (a) => Math.max(...a))).toBeLessThanOrEqual(
      edge(
        'right',
        (r) => r.x,
        (a) => Math.min(...a),
      ),
    );
  });

  it('lists the inner rows of each box in the order of the reference', () => {
    for (const [boxId, rows] of Object.entries(INNER_ROWS)) {
      const box = all.find((e) => e.id === boxId);
      expect(box?.kind, boxId).toBe('frame');
      const drawn = box?.kind === 'frame' ? box.rows.map((r) => r.id) : [];
      expect(drawn, boxId).toEqual([...rows]);
    }
    for (const entry of all) {
      if (entry.kind === 'frame' && entry.rows.length > 0) {
        expect(INNER_ROWS[entry.id], `${entry.id} is in the reference`).toBeDefined();
      }
    }
  });

  it('keeps every top-level rectangle inside the glass zone with a margin to its edge', () => {
    for (const column of ENGINE_PAGE) {
      for (const e of column.entries) {
        expect(inside(e.rect, zone, ZONE_MARGIN), e.id).toBe(true);
      }
    }
  });

  it('keeps every inner row inside its box, and no two boxes of one level overlap', () => {
    const levels = (list: readonly PageEntry[], where: string): void => {
      list.forEach((a, i) => {
        list.slice(i + 1).forEach((b) => {
          expect(overlap(a.rect, b.rect), `${where}: ${a.id} and ${b.id}`).toBe(false);
        });
        if (a.kind === 'frame') {
          for (const row of a.rows) {
            expect(inside(row.rect, a.rect, 1), `${a.id} holds ${row.id}`).toBe(true);
          }
          levels(a.rows, a.id);
        }
      });
    };
    levels(
      ENGINE_PAGE.flatMap((c) => c.entries),
      'page',
    );
  });

  it('gives each gauge a cell at least as tall as its component needs', () => {
    for (const row of GAUGE_ROWS) {
      const entry = all.find((e) => e.id === row.id);
      if (entry === undefined) throw new Error(`no entry ${row.id}`);
      const need =
        row.shape === 'dual'
          ? dualGaugeHeight(row.id === 'fuel_qty')
          : row.shape === 'arc'
            ? MIN_CELL_H.arc
            : MIN_CELL_H.bar;
      expect(entry.rect.h, row.id).toBeGreaterThanOrEqual(need);
    }
  });

  it('puts each arc centre and radius inside its cell, with the sweep clear of the neighbours', () => {
    for (const entry of all) {
      if (entry.kind !== 'arc') continue;
      expect(entry.centre.x - entry.radius, entry.id).toBeGreaterThanOrEqual(entry.rect.x);
      expect(entry.centre.x + entry.radius, entry.id).toBeLessThanOrEqual(right(entry.rect));
      expect(entry.centre.y - entry.radius, entry.id).toBeGreaterThanOrEqual(entry.rect.y);
      expect(entry.centre.y, entry.id).toBeLessThan(bottom(entry.rect));
    }
    expect(all.filter((e) => e.kind === 'arc').map((e) => e.id)).toEqual(['load', 'rpm']);
  });

  it('reads the quantity and resolution of each gauge row of the reference', () => {
    for (const row of GAUGE_ROWS) {
      const entry = all.find((e) => e.id === row.id);
      expect(entry?.kind, row.id).toBe(row.shape);
      if (
        entry === undefined ||
        (entry.kind !== 'arc' && entry.kind !== 'bar' && entry.kind !== 'dual')
      ) {
        throw new Error(`${row.id} is not a gauge`);
      }
      expect(entry.label, row.id).toBe(row.label);
      expect(entry.quantity, row.id).toBe(row.quantity);
      expect(entry.decimals, row.id).toBe(row.decimals);
      if (entry.kind === 'dual') expect(entry.second, row.id).toBe(row.second);
      if (entry.kind === 'bar') expect(entry.unit, row.id).toBe(row.unit);
    }
    const dual = all.find((e) => e.id === 'fuel_qty');
    expect(dual?.kind === 'dual' ? dual.scale : undefined).toEqual([...FUEL_QTY_SCALE]);
  });

  it('names only registered quantities', () => {
    for (const entry of all) {
      if (entry.kind === 'frame' || entry.kind === 'calculator') continue;
      expect(DA50RG_QUANTITIES.get(entry.quantity), entry.id).toBeDefined();
      if (entry.kind === 'dual')
        expect(DA50RG_QUANTITIES.get(entry.second), entry.id).toBeDefined();
    }
  });
});

describe('the drawn engine page against the reference', () => {
  const boxIds = (tree = content): string[] =>
    findElements(tree, (e) => e.props['data-box'] !== undefined).map((e) =>
      String(e.props['data-box']),
    );
  const topLevelIds = Object.values(COLUMN_ORDER).flat();
  const nested = Object.values(INNER_ROWS).flat();

  it('draws a box for every framed entry and a gauge for every gauge row, nothing else', () => {
    const framed = all.filter((e) => e.kind === 'frame').map((e) => e.id);
    expect(boxIds().sort()).toEqual([...framed].sort());
    const gauges = findElements(content, (e) => e.props['data-gauge'] !== undefined).map((e) =>
      String(e.props['data-gauge']),
    );
    expect(gauges.sort()).toEqual(GAUGE_ROWS.map((g) => g.label).sort());
    // Every box of the reference is either a frame or a gauge cell.
    for (const id of [...topLevelIds, ...nested]) {
      expect(
        all.some((e) => e.id === id),
        id,
      ).toBe(true);
    }
  });

  it('draws only texts that are in the reference label table, and every text of the table', () => {
    const texts = findElements(
      content,
      (e) => e.tag === 'text' && e.props['class'] !== 'glass-digits',
    ).map((e) => textOf(e).trim());
    expect(new Set(texts)).toEqual(new Set(LABELS));
  });

  it('draws the same static texts whatever the quantities read', () => {
    const staticTexts = (values: Record<string, number>): string[] => {
      const tree = expand(MfdFrame({ region: mfd, bridge: bridge(values) }));
      return findElements(tree, (e) => e.tag === 'text' && e.props['class'] !== 'glass-digits').map(
        (e) => textOf(e).trim(),
      );
    };
    const low = Object.fromEntries(DA50RG_QUANTITIES.all.map((d) => [d.id, d.min]));
    const high = Object.fromEntries(DA50RG_QUANTITIES.all.map((d) => [d.id, d.max]));
    const base = staticTexts({});
    expect(staticTexts(low)).toEqual(base);
    expect(staticTexts(high)).toEqual(base);
  });

  it('no longer draws the old ENGINE heading', () => {
    const heading = findElements(content, (e) => e.tag === 'text' && textOf(e) === 'ENGINE');
    expect(heading).toEqual([]);
  });

  it('draws the Fuel Qty bar from the two tank quantities with the numerals of the reference', () => {
    const tree = expand(
      MfdFrame({
        region: mfd,
        bridge: bridge({ fuel_qty_lh_gal: 17.3, fuel_qty_rh_gal: 4.2 }),
      }),
    );
    const gauge = findElements(tree, (e) => e.props['data-gauge'] === 'Fuel qty')[0];
    if (gauge === undefined) throw new Error('no Fuel qty gauge');
    const readouts = findElements(gauge, (e) => e.props['data-dual-readout'] !== undefined).map(
      (e) => textOf(e),
    );
    expect(readouts).toEqual(['17.3', '4.2']);
    const numerals = findElements(gauge, (e) => e.props['data-dual-scale'] !== undefined).map((e) =>
      textOf(e),
    );
    expect(numerals).toEqual(FUEL_QTY_SCALE.map(String));
  });
});
