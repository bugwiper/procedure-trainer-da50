import { describe, expect, it } from 'vitest';
import { ENGINE_PAGE } from '../src/aircraft/da50rg/engine-page';
import type { PageRect } from '../src/aircraft/da50rg/engine-page';
import { MAP_STRIP } from '../src/aircraft/da50rg/map-strip';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import type { PanelBridge } from '../src/ui/bridge';
import { MfdFrame } from '../src/ui/panel/frames/MfdFrame';
import {
  STRIP_FLOW,
  STRIP_FUEL_SCALE,
  STRIP_GAUGES,
  STRIP_LABELS,
  STRIP_MARGIN,
  STRIP_MIN_H,
  STRIP_ORDER,
  STRIP_TRIM,
  STRIP_ZONE,
} from './map-strip-reference';
import { expand, findElements, textOf } from './vnode-walk';

// The engine strip of the MFD map page against its independent reference
// (tests/map-strip-reference.ts): row order, geometry, quantities, drawn texts and readouts.

const mfd = DA50RG.regions.find((r) => r.id === 'mfd');
if (mfd === undefined) throw new Error('no mfd region');

const bridge = (values: Record<string, number> = {}): PanelBridge =>
  ({
    registry: DA50RG,
    stateOf: () => ({ value: 'map' }),
    quantities: { value: { ...DA50RG_QUANTITIES.baseValues(), ...values } },
    cas: { value: [] },
  }) as unknown as PanelBridge;

const draw = (values: Record<string, number> = {}) => {
  const tree = expand(MfdFrame({ region: mfd, bridge: bridge(values) }));
  const strip = findElements(tree, (e) => e.props['data-testid'] === 'mfd-engine-strip')[0];
  if (strip === undefined) throw new Error('no strip');
  return strip;
};

const right = (r: PageRect) => r.x + r.w;
const bottom = (r: PageRect) => r.y + r.h;
const overlap = (a: PageRect, b: PageRect) =>
  a.x < right(b) && b.x < right(a) && a.y < bottom(b) && b.y < bottom(a);

describe('the strip layout data against the reference', () => {
  it('lists the rows of the reference in top to bottom order', () => {
    expect(MAP_STRIP.map((e) => e.id)).toEqual([...STRIP_ORDER]);
  });

  it('keeps every row inside the strip zone with a margin and no two rows overlapping', () => {
    for (const entry of MAP_STRIP) {
      expect(entry.rect.x, entry.id).toBeGreaterThanOrEqual(STRIP_ZONE.x0 + STRIP_MARGIN);
      expect(entry.rect.y, entry.id).toBeGreaterThanOrEqual(STRIP_ZONE.y0 + STRIP_MARGIN);
      expect(right(entry.rect), entry.id).toBeLessThanOrEqual(STRIP_ZONE.x1 - STRIP_MARGIN);
      expect(bottom(entry.rect), entry.id).toBeLessThanOrEqual(STRIP_ZONE.y1 - STRIP_MARGIN);
    }
    MAP_STRIP.forEach((a, i) =>
      MAP_STRIP.slice(i + 1).forEach((b) =>
        expect(overlap(a.rect, b.rect), `${a.id} ${b.id}`).toBe(false),
      ),
    );
  });

  it('gives each row a cell at least as tall as its component needs', () => {
    const min = {
      arc: STRIP_MIN_H.arc,
      bar: STRIP_MIN_H.bar,
      flow: STRIP_MIN_H.flow,
      dual: STRIP_MIN_H.dual,
      trim: STRIP_MIN_H.trim,
    } as const;
    for (const entry of MAP_STRIP) {
      if (entry.kind in min) {
        expect(entry.rect.h, entry.id).toBeGreaterThanOrEqual(min[entry.kind as keyof typeof min]);
      }
    }
  });

  it('reads the quantity and resolution of each gauge row of the reference', () => {
    for (const ref of STRIP_GAUGES) {
      const entry = MAP_STRIP.find((e) => 'label' in e && e.label === ref.label);
      if (entry === undefined || !('quantity' in entry)) throw new Error(ref.label);
      expect(entry.quantity, ref.label).toBe(ref.quantity);
      if ('decimals' in entry) {
        expect(entry.decimals, ref.label).toBe(ref.decimals);
      }
      if (ref.second !== undefined) {
        expect(entry.kind === 'dual' ? entry.second : undefined).toBe(ref.second);
      }
    }
    const flow = MAP_STRIP.find((e) => e.id === STRIP_FLOW.id);
    expect(flow !== undefined && 'quantity' in flow ? flow.quantity : undefined).toBe(
      STRIP_FLOW.quantity,
    );
    const trim = MAP_STRIP.find((e) => e.id === STRIP_TRIM.id);
    expect(trim !== undefined && 'quantity' in trim ? trim.quantity : undefined).toBe(
      STRIP_TRIM.quantity,
    );
  });

  it('names only registered quantities', () => {
    for (const entry of MAP_STRIP) {
      if (!('quantity' in entry)) continue;
      expect(DA50RG_QUANTITIES.get(entry.quantity), entry.id).toBeDefined();
      if (entry.kind === 'dual')
        expect(DA50RG_QUANTITIES.get(entry.second), entry.id).toBeDefined();
    }
  });

  it('has the same gauges as the left column of the engine page for the shared quantities', () => {
    const engine = ENGINE_PAGE.flatMap((c) => c.entries).filter((e) => 'quantity' in e);
    for (const id of ['load', 'rpm', 'oil_pres', 'oil_temp', 'coolant_temp', 'gearbox_temp']) {
      const a = MAP_STRIP.find((e) => e.id === id);
      const b = engine.find((e) => e.id === id);
      expect(a !== undefined && 'quantity' in a ? a.quantity : undefined, id).toBe(
        b !== undefined && 'quantity' in b ? b.quantity : undefined,
      );
    }
  });
});

describe('the drawn strip against the reference', () => {
  it('draws the gauges of the reference in order, and the two arcs as arcs', () => {
    const strip = draw();
    const gauges = findElements(strip, (e) => e.props['data-gauge'] !== undefined);
    expect(gauges.map((g) => g.props['data-gauge'])).toEqual(STRIP_GAUGES.map((g) => g.label));
    expect(findElements(strip, (e) => e.tag === 'circle')).toHaveLength(2);
  });

  it('draws only texts of the reference label table, and every text of the table', () => {
    const texts = findElements(
      draw(),
      (e) => e.tag === 'text' && e.props['class'] !== 'glass-digits',
    ).map((e) => textOf(e).trim());
    expect(new Set(texts)).toEqual(new Set(STRIP_LABELS));
  });

  it('draws the same static texts whatever the quantities read', () => {
    const texts = (values: Record<string, number>) =>
      findElements(
        draw(values),
        (e) => e.tag === 'text' && e.props['class'] !== 'glass-digits',
      ).map((e) => textOf(e).trim());
    const low = Object.fromEntries(DA50RG_QUANTITIES.all.map((d) => [d.id, d.min]));
    const high = Object.fromEntries(DA50RG_QUANTITIES.all.map((d) => [d.id, d.max]));
    expect(texts(low)).toEqual(texts({}));
    expect(texts(high)).toEqual(texts({}));
  });

  it('shows both tanks on the Fuel Qty bar with whole numbers and the scale of the reference', () => {
    const strip = draw({ fuel_qty_lh_gal: 17.3, fuel_qty_rh_gal: 4.2 });
    const gauge = findElements(strip, (e) => e.props['data-gauge'] === 'Fuel qty gal')[0];
    if (gauge === undefined) throw new Error('no fuel gauge');
    expect(
      findElements(gauge, (e) => e.props['data-dual-readout'] !== undefined).map((e) => textOf(e)),
    ).toEqual(['17', '4']);
    expect(
      findElements(gauge, (e) => e.props['data-dual-scale'] !== undefined).map((e) => textOf(e)),
    ).toEqual(STRIP_FUEL_SCALE.map(String));
  });

  it('prints the fuel flow with one decimal on one line with its label', () => {
    const strip = draw({ [STRIP_FLOW.quantity]: 11.234 });
    const row = findElements(strip, (e) => e.props['data-row'] === STRIP_FLOW.id)[0];
    if (row === undefined) throw new Error('no flow row');
    expect(
      findElements(row, (e) => e.props['data-readout'] === STRIP_FLOW.id).map((e) => textOf(e)),
    ).toEqual(['11.2']);
  });

  it('prints every bar and arc number without a unit', () => {
    const strip = draw();
    for (const g of findElements(strip, (e) => e.props['data-gauge'] !== undefined)) {
      for (const d of findElements(g, (e) => e.props['class'] === 'glass-digits')) {
        expect(textOf(d), String(g.props['data-gauge'])).toMatch(/^-?\d+(\.\d+)?$/);
      }
    }
  });

  it('puts the rudder trim pointer on its scale, left of centre, at centre and right of centre', () => {
    const def = DA50RG_QUANTITIES.get(STRIP_TRIM.quantity);
    if (def === undefined) throw new Error('no trim quantity');
    const x = (value: number): number => {
      const p = findElements(
        draw({ [STRIP_TRIM.quantity]: value }),
        (e) => e.props['data-trim-pointer'] !== undefined,
      )[0];
      return Number(/^M ([\d.-]+) /.exec(String(p?.props['d']))?.[1]);
    };
    expect(x(def.min)).toBeLessThan(x(0));
    expect(x(0)).toBeLessThan(x(def.max));
    expect(x(0) - x(def.min)).toBeCloseTo(x(def.max) - x(0), 6);
  });
});

describe('the low red ends of the temperature bars (owner photo, walkthrough)', () => {
  it.each(['oil_temp_c', 'coolant_temp_c', 'gearbox_temp_c'])(
    '%s starts with a red band, then yellow, green, yellow, red',
    (id) => {
      const colours = DA50RG_QUANTITIES.get(id)?.bands.map((b) => b.colour);
      expect(colours).toEqual(['red', 'yellow', 'green', 'yellow', 'red']);
    },
  );
});
