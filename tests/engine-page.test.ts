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
  CALCULATOR_READOUTS,
  ENDURANCE_READOUTS,
  FLOW_ROW,
  LABELS,
  MIN_CELL_H,
  MIN_ROW_H,
  SERVICE_ROW,
  TRIM_ROW,
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

  it('gives each text row and sub-box a cell tall enough for its lines', () => {
    for (const entry of all) {
      if (entry.kind === 'arc' || entry.kind === 'bar' || entry.kind === 'dual') continue;
      if (entry.kind === 'frame') continue;
      expect(entry.rect.h, entry.id).toBeGreaterThanOrEqual(MIN_ROW_H[entry.kind]);
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
    // Frames and the two sub-boxes (calculator, endurance) are drawn as boxes.
    const framed = all
      .filter((e) => e.kind === 'frame' || e.kind === 'calculator' || e.kind === 'endurance')
      .map((e) => e.id);
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

describe('the text rows, the sub-boxes and the rudder trim', () => {
  const draw = (values: Record<string, number>, raw = false) =>
    expand(
      MfdFrame({
        region: mfd,
        bridge: raw
          ? ({
              registry: DA50RG,
              stateOf: () => ({ value: 'engine' }),
              quantities: { value: values },
              cas: { value: [] },
            } as unknown as PanelBridge)
          : bridge(values),
      }),
    );
  const readout = (tree: ReturnType<typeof draw>, id: string): string => {
    const found = findElements(tree, (e) => e.props['data-readout'] === id)[0];
    if (found === undefined) throw new Error(`no readout ${id}`);
    return textOf(found);
  };
  const base = (id: string): number => DA50RG_QUANTITIES.get(id)?.base ?? Number.NaN;

  it('prints the fuel flow with one decimal from the quantity', () => {
    expect(readout(draw({ [FLOW_ROW.quantity]: 7.26 }), FLOW_ROW.id)).toBe('7.3');
    expect(readout(draw({ [FLOW_ROW.quantity]: 0 }), FLOW_ROW.id)).toBe('0.0');
  });

  it('prints remain, used, endurance and range of the calculator from the quantities', () => {
    const tree = draw({
      fuel_qty_lh_gal: 10,
      fuel_qty_rh_gal: 5.5,
      fuel_used_gal: 3.2,
      fuel_flow_gph: 10,
      airspeed_kt: 100,
    });
    expect(CALCULATOR_READOUTS.map((id) => readout(tree, id))).toEqual([
      '15.5',
      '3.2',
      '1:33',
      '155',
    ]);
  });

  it('with the engine stopped the flow reads 0.0, the endurance --:-- and the range has no figure', () => {
    const tree = draw({ fuel_flow_gph: 0 });
    expect(readout(tree, FLOW_ROW.id)).toBe('0.0');
    expect(readout(tree, 'calc_endurance')).toBe('--:--');
    expect(readout(tree, 'calc_range')).toBe('---');
  });

  it('prints the Norm and High endurance of the de-ice quantity, and 0:00 when it is empty', () => {
    // 6.8 gal at the owner flows of 3 and 6 gal/h: 136 and 68 minutes.
    expect(ENDURANCE_READOUTS.map((id) => readout(draw({ deice_qty_gal: 6.8 }), id))).toEqual([
      '2:16',
      '1:08',
    ]);
    expect(ENDURANCE_READOUTS.map((id) => readout(draw({ deice_qty_gal: 3.4 }), id))).toEqual([
      '1:08',
      '0:34',
    ]);
    expect(ENDURANCE_READOUTS.map((id) => readout(draw({ deice_qty_gal: 0 }), id))).toEqual([
      '0:00',
      '0:00',
    ]);
  });

  it('prints the total service with one decimal', () => {
    expect(readout(draw({ [SERVICE_ROW.quantity]: 1234.56 }), SERVICE_ROW.id)).toBe('1234.6');
  });

  it('puts the rudder trim pointer on the scale: left of centre, at centre, right of centre', () => {
    const def = DA50RG_QUANTITIES.get(TRIM_ROW.quantity);
    if (def === undefined) throw new Error('no trim quantity');
    const pointerX = (value: number): number => {
      const tree = draw({ [TRIM_ROW.quantity]: value });
      const p = findElements(tree, (e) => e.props['data-trim-pointer'] !== undefined)[0];
      return Number(/^M ([\d.-]+) /.exec(String(p?.props['d']))?.[1]);
    };
    const lo = pointerX(def.min);
    const mid = pointerX(0);
    const hi = pointerX(def.max);
    expect(lo).toBeLessThan(mid);
    expect(mid).toBeLessThan(hi);
    expect(mid - lo).toBeCloseTo(hi - mid, 6);
    expect(pointerX(def.max / 2)).toBeCloseTo((mid + hi) / 2, 6);
    // A value beyond the range stays on the scale.
    expect(pointerX(def.max * 3)).toBeCloseTo(hi, 6);
  });

  it('without a value every box prints the base of its quantity', () => {
    const tree = draw({}, true);
    expect(readout(tree, FLOW_ROW.id)).toBe(base(FLOW_ROW.quantity).toFixed(FLOW_ROW.decimals));
    expect(readout(tree, SERVICE_ROW.id)).toBe(
      base(SERVICE_ROW.quantity).toFixed(SERVICE_ROW.decimals),
    );
    expect(readout(tree, 'endurance_norm')).toBe('2:16');
    expect(readout(tree, 'calc_remain')).toBe(
      (base('fuel_qty_lh_gal') + base('fuel_qty_rh_gal')).toFixed(1),
    );
  });

  it('never prints NaN or Infinity, whatever a quantity holds (T-06-04)', () => {
    const bad = Object.fromEntries(
      DA50RG_QUANTITIES.all.map((d, i) => [
        d.id,
        i % 2 === 0 ? Number.NaN : Number.POSITIVE_INFINITY,
      ]),
    );
    const tree = draw(bad, true);
    const everything = findElements(tree, () => true)
      .flatMap((e) => e.children)
      .filter((c): c is string => typeof c === 'string');
    for (const text of everything) {
      expect(text, text).not.toMatch(/NaN|Infinity/);
    }
    const attrs = findElements(tree, () => true).flatMap((e) => Object.values(e.props));
    for (const value of attrs) expect(String(value)).not.toMatch(/NaN/);
  });
});
