import { describe, expect, it } from 'vitest';
import { BUS_OUTLINES, BUS_PUMP_BOXES } from '../src/aircraft/da50rg/bus-boxes';
import type { BusId, BusPoint } from '../src/aircraft/da50rg/bus-boxes';
import { BREAKER_ROWS } from '../src/aircraft/da50rg/controls/breakers';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import type { DispatchResult } from '../src/engine/store';
import { createPanelBridge } from '../src/ui/bridge';
import { makeBreakerPress } from '../src/ui/panel/widgets/CircuitBreaker';
import { readFileSync } from 'node:fs';
import { PLATES } from '../src/aircraft/da50rg/plates';
import type { CircuitBreakerDef, Rect } from '../src/engine/registry';
import { CB_COLUMNS, CB_LOWER_ROW, CB_REFERENCE, CB_ROWS, CB_STRIP_ROW } from './layout-reference';

// Data table and relation gate of the circuit breakers (PNL-12, D-01 to D-03, Tables C1 and C2 of
// the 01.2-04 plan). EXPECTED is typed in by hand from the printed layout; positions come from
// the independent CB_REFERENCE and from the registry in global coordinates, never from the
// generator's own constants.

interface Expected {
  readonly id: string;
  readonly lines: readonly string[];
  readonly rating: string;
  readonly group: 'essential' | 'main' | 'avionics' | 'lower' | 'strip';
  readonly region: string;
}

const E = (
  id: string,
  lines: readonly string[],
  rating: string,
  group: Expected['group'],
  region: string,
): Expected => ({ id, lines, rating, group, region });

const EXPECTED: readonly Expected[] = [
  E('cb.sam', ['SAM'], '3', 'essential', 'cb_essential'),
  E('cb.ahrs', ['AHRS'], '5', 'essential', 'cb_essential'),
  E('cb.com1', ['COM 1'], '5', 'essential', 'cb_essential'),
  E('cb.gps_nav1', ['GPS/', 'NAV 1'], '5', 'essential', 'cb_essential'),
  E('cb.adc', ['ADC'], '5', 'essential', 'cb_essential'),
  E('cb.eng_inst', ['ENG', 'INST'], '5', 'essential', 'cb_essential'),
  E('cb.xpdr', ['XPDR'], '5', 'essential', 'cb_essential'),
  E('cb.flaps', ['FLAPS'], '4', 'essential', 'cb_essential'),
  E('cb.pitot', ['PITOT'], '20', 'essential', 'cb_essential'),
  E('cb.landing', ['LANDING'], '5', 'essential', 'cb_essential'),
  E('cb.flood', ['FLOOD'], '5', 'essential', 'cb_essential'),
  E('cb.gear_warn', ['GEAR', 'WARN'], '5', 'essential', 'cb_essential'),
  E('cb.emerg_pump', ['EMERG', 'PUMP'], '5', 'essential', 'cb_essential'),
  E('cb.pfd', ['PFD'], '5', 'essential', 'cb_essential'),
  E('cb.master_ctrl', ['MASTER', 'CTRL.'], '2', 'essential', 'cb_essential'),
  E('cb.cowl_flap', ['COWL', 'FLAP'], '3', 'main', 'cb_essential'),
  E('cb.av_gdu_fan', ['AV/GDU', 'FAN'], '3', 'main', 'cb_essential'),
  E('cb.gear', ['GEAR'], '5', 'main', 'cb_essential'),
  E('cb.main_pump', ['MAIN', 'PUMP'], '5', 'main', 'cb_essential'),
  E('cb.mfd', ['MFD'], '5', 'main', 'cb_main'),
  E('cb.strobe', ['STROBE'], '5', 'main', 'cb_main'),
  E('cb.position', ['POSITION'], '5', 'main', 'cb_main'),
  E('cb.taxi_map', ['TAXI/MAP'], '5', 'main', 'cb_main'),
  E('cb.inst_lt', ['INST.', 'LT'], '3', 'main', 'cb_main'),
  E('cb.av_bus', ['AV BUS'], '25', 'main', 'cb_main'),
  E('cb.xfr_pump', ['XFR', 'PUMP'], '5', 'main', 'cb_main'),
  E('cb.gcu', ['GCU'], '2', 'main', 'cb_main'),
  E('cb.stall_ht', ['STALL', 'HT.'], '10', 'main', 'cb_main'),
  E('cb.rudder_trim', ['RUDDER', 'TRIM'], '3', 'main', 'cb_main'),
  E('cb.air_ctrl', ['AIR', 'CTRL.'], '5', 'main', 'cb_main'),
  E('cb.tas', ['TAS'], '3', 'avionics', 'cb_main'),
  E('cb.iridium', ['IRIDIUM'], '1', 'avionics', 'cb_main'),
  E('cb.com2', ['COM2'], '5', 'avionics', 'cb_main'),
  E('cb.gps_nav2', ['GPS/', 'NAV 2'], '5', 'avionics', 'cb_main'),
  E('cb.audio', ['AUDIO'], '5', 'avionics', 'cb_main'),
  E('cb.afcs_esp', ['AFCS/ESP'], '7½', 'avionics', 'cb_main'),
  E('cb.dme', ['DME'], '3', 'avionics', 'cb_main'),
  E('cb.twx', ['TWX'], '3', 'avionics', 'cb_main'),
  E('cb.ecu_a', ['ECU', 'A'], '10', 'lower', 'cb_low'),
  E('cb.ecu_b', ['ECU', 'B'], '10', 'lower', 'cb_low'),
  E('cb.ess_tie', ['ESS', 'TIE'], '50', 'lower', 'cb_low'),
  E('cb.batt', ['BATT'], '60', 'lower', 'cb_low'),
  E('cb.alt1', ['ALT', '1'], '60', 'lower', 'cb_low'),
  E('cb.alt2', ['ALT', '2'], '60', 'lower', 'cb_low'),
  E('cb.main_tie', ['MAIN', 'TIE'], '50', 'lower', 'cb_low'),
  E('cb.ecs', ['ECS'], '10', 'lower', 'cb_low'),
  E('cb.usb_ports', ['USB', 'PORTS'], '5', 'lower', 'cb_low'),
  E('cb.pedals', ['PEDALS'], '5', 'lower', 'cb_low'),
  E('cb.stall_aoa', ['STALL/', 'AOA'], '2', 'strip', 'cb_strip'),
  E('cb.prop_deice', ['PROP', 'DE-ICE'], '15', 'strip', 'cb_strip'),
  E('cb.deice', ['DE-ICE'], '7½', 'strip', 'cb_strip'),
];

/** Pump breakers sit in their own pump box instead of a bus outline. */
const PUMP_BOX: Readonly<Record<string, string>> = {
  'cb.emerg_pump': 'EMERG PUMP',
  'cb.main_pump': 'MAIN PUMP',
  'cb.xfr_pump': 'XFR PUMP',
};

/** The blank plug cells (global centres) that hold no breaker. */
const PLUG_CELLS: readonly { x: number; y: number }[] = [
  { x: 1978, y: 349 },
  { x: 2086, y: 456 },
  { x: 2122, y: 514 },
];

const breakers = (): CircuitBreakerDef[] =>
  DA50RG.controls.filter((c): c is CircuitBreakerDef => c.kind === 'circuit-breaker');

function def(id: string): CircuitBreakerDef {
  const found = breakers().find((b) => b.id === id);
  if (found === undefined) throw new Error(`no breaker ${id}`);
  return found;
}

function regionBounds(id: string): Rect {
  const region = DA50RG.regions.find((r) => r.id === id);
  if (region === undefined) throw new Error(`unknown region ${id}`);
  return region.bounds;
}

function centre(b: CircuitBreakerDef): { x: number; y: number } {
  const r = regionBounds(b.region);
  return { x: r.x + b.x, y: r.y + b.y };
}

function footprint(b: CircuitBreakerDef): Rect {
  const c = centre(b);
  return { x: c.x - b.hit.w / 2, y: c.y - b.hit.h / 2, w: b.hit.w, h: b.hit.h };
}

function inside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Point in an axis-parallel polygon, boundary included. */
function inPolygon(p: BusPoint, poly: readonly BusPoint[]): boolean {
  const n = poly.length;
  let crossings = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    if (a === undefined || b === undefined) continue;
    const onEdge =
      p.x >= Math.min(a.x, b.x) &&
      p.x <= Math.max(a.x, b.x) &&
      p.y >= Math.min(a.y, b.y) &&
      p.y <= Math.max(a.y, b.y) &&
      (a.x === b.x || a.y === b.y);
    if (onEdge) return true;
    if (a.y > p.y !== b.y > p.y) {
      const x = a.x + ((p.y - a.y) / (b.y - a.y)) * (b.x - a.x);
      if (x > p.x) crossings += 1;
    }
  }
  return crossings % 2 === 1;
}

/** Every point of a rectangle on a 1 unit grid, corners and edges included, lies in the polygon. */
function rectInPolygon(r: Rect, poly: readonly BusPoint[]): boolean {
  for (let dx = 0; dx <= r.w; dx += 1) {
    for (let dy = 0; dy <= r.h; dy += 1) {
      if (!inPolygon({ x: r.x + dx, y: r.y + dy }, poly)) return false;
    }
  }
  return true;
}

const present = new Set(EXPECTED.map((e) => e.id));
const rowIds = (ids: readonly string[]): string[] => ids.filter((id) => present.has(id));

describe('breaker data table', () => {
  it('the registry holds exactly the expected breakers, in the table order', () => {
    expect(breakers().map((b) => b.id)).toEqual(EXPECTED.map((e) => e.id));
  });

  it('the typed table, the reference table and the row lists name the same breakers', () => {
    expect([...CB_REFERENCE.map((r) => r.id)].sort()).toEqual(EXPECTED.map((e) => e.id).sort());
    const listed = [...Object.values(CB_ROWS).flat(), ...CB_LOWER_ROW, ...CB_STRIP_ROW];
    expect([...listed].sort()).toEqual(EXPECTED.map((e) => e.id).sort());
    expect(BREAKER_ROWS).toHaveLength(EXPECTED.length);
  });

  it.each(EXPECTED.map((e) => [e.id, e] as const))('%s carries its printed data', (_id, e) => {
    const b = def(e.id);
    expect(b.labelLines).toEqual(e.lines);
    expect(b.rating).toBe(e.rating);
    expect(b.group).toBe(e.group);
    expect(b.region).toBe(e.region);
    expect(b.label.replace(/\s+/g, '')).toBe(e.lines.join('').replace(/\s+/g, ''));
    expect(b.default).toBe('in');
    expect(b.states.map((s) => s.id)).toEqual(['in', 'out']);
    expect(b.hit).toEqual(e.group === 'lower' ? { w: 24, h: 28 } : { w: 28, h: 28 });
    expect(b.compact === true).toBe(e.group === 'lower');
  });

  it('ids are unique, flat, start with cb. and carry no bus segment or state word', () => {
    const ids = breakers().map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id, id).toMatch(/^cb\.[a-z0-9_]+$/);
      expect(id.split('.'), id).toHaveLength(2);
      expect(id, id).not.toMatch(/_(in|out)$/);
    }
  });

  it('every breaker starts in, and the ratings are printed numerals', () => {
    for (const b of breakers()) {
      expect(b.default).toBe('in');
      expect(b.rating, b.id).toMatch(/^\d+½?$/);
    }
  });
});

describe('breaker grid relations', () => {
  it.each(Object.entries(CB_ROWS))('the breakers of row %s share y exactly', (_row, ids) => {
    const ys = new Set(rowIds(ids).map((id) => centre(def(id)).y));
    expect(ys.size).toBe(1);
  });

  it.each(Object.entries(CB_COLUMNS))('the breakers of column %s share x exactly', (_col, ids) => {
    const xs = new Set(rowIds(ids).map((id) => centre(def(id)).x));
    expect(xs.size).toBe(1);
  });

  it('neighbouring columns of the grid are 36 apart', () => {
    for (const ids of Object.values(CB_ROWS)) {
      const row = rowIds(ids).map((id) => centre(def(id)).x);
      for (let i = 1; i < row.length; i++) {
        const gap = (row[i] ?? 0) - (row[i - 1] ?? 0);
        // 36 for neighbours, a multiple of 36 across a blank plug cell.
        expect(gap % 36, ids.join()).toBe(0);
        expect(gap).toBeGreaterThanOrEqual(36);
      }
    }
  });

  it('the grid rows keep their pitch: 44 inside the Essential and Main regions, 58 to the Avionics row', () => {
    const y = (id: string) => centre(def(id)).y;
    expect(y('cb.xpdr') - y('cb.sam')).toBe(44);
    expect(y('cb.pfd') - y('cb.xpdr')).toBe(44);
    expect(y('cb.gcu') - y('cb.mfd')).toBe(44);
    // The Avionics row stands one title strip lower (Table C1: M5 456, V6 514).
    expect(y('cb.com2') - y('cb.gcu')).toBe(58);
    // Between the regions: A3 349 to M4 412.
    expect(y('cb.mfd') - y('cb.pfd')).toBe(63);
  });

  it('the lower row has pitch 26 and the flap strip pitch 36, each on one y', () => {
    const lower = CB_LOWER_ROW.map((id) => centre(def(id)));
    expect(new Set(lower.map((c) => c.y)).size).toBe(1);
    for (let i = 1; i < lower.length; i++) {
      expect((lower[i]?.x ?? 0) - (lower[i - 1]?.x ?? 0)).toBe(26);
    }
    const strip = CB_STRIP_ROW.map((id) => centre(def(id)));
    expect(new Set(strip.map((c) => c.y)).size).toBe(1);
    for (let i = 1; i < strip.length; i++) {
      expect((strip[i]?.x ?? 0) - (strip[i - 1]?.x ?? 0)).toBe(36);
    }
  });

  it('the region counts and the group counts follow the table', () => {
    const count = (key: 'region' | 'group', value: string) =>
      breakers().filter((b) => b[key] === value).length;
    expect([
      count('region', 'cb_essential'),
      count('region', 'cb_main'),
      count('region', 'cb_low'),
      count('region', 'cb_strip'),
    ]).toEqual([19, 19, 10, 3]);
    expect(
      ['essential', 'main', 'avionics', 'lower', 'strip'].map((g) => count('group', g)),
    ).toEqual([15, 15, 8, 10, 3]);
    expect(breakers()).toHaveLength(51);
  });

  it('the blank plug cells hold no breaker', () => {
    for (const cell of PLUG_CELLS) {
      for (const b of breakers()) {
        const c = centre(b);
        expect(
          Math.hypot(c.x - cell.x, c.y - cell.y),
          `${b.id} near ${cell.x},${cell.y}`,
        ).toBeGreaterThan(14);
      }
    }
  });
});

describe('breaker footprints', () => {
  const plate = PLATES.find((p) => p.id === 'bus-panel');
  const plateRect: Rect | undefined =
    plate === undefined ? undefined : { x: plate.x, y: plate.y, w: plate.w, h: plate.h };

  it('every footprint lies inside its region', () => {
    for (const b of breakers()) {
      expect(inside(footprint(b), regionBounds(b.region)), b.id).toBe(true);
    }
  });

  it('every footprint of the bus panel regions lies inside the bus plate', () => {
    expect(plateRect).toBeDefined();
    if (plateRect === undefined) return;
    for (const b of breakers()) {
      if (b.region === 'cb_strip') continue;
      expect(inside(footprint(b), plateRect), b.id).toBe(true);
    }
  });

  it('no two footprints overlap (touching is allowed)', () => {
    const all = breakers();
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (a === undefined || b === undefined) continue;
        expect(overlaps(footprint(a), footprint(b)), `${a.id} / ${b.id}`).toBe(false);
      }
    }
  });
});

describe('breaker bus containment', () => {
  const OUTLINE_GROUPS: readonly BusId[] = ['essential', 'main', 'avionics'];

  it('every box breaker except the pump breakers lies inside the outline of its own group', () => {
    for (const b of breakers()) {
      if (!OUTLINE_GROUPS.includes(b.group as BusId)) continue;
      if (PUMP_BOX[b.id] !== undefined) continue;
      const outline = BUS_OUTLINES[b.group as BusId];
      expect(rectInPolygon(footprint(b), outline), `${b.id} in ${b.group}`).toBe(true);
    }
  });

  it('every pump breaker lies inside its own pump box', () => {
    for (const [id, name] of Object.entries(PUMP_BOX)) {
      if (!present.has(id)) continue;
      const box = BUS_PUMP_BOXES.find((p) => p.name === name);
      expect(box, name).toBeDefined();
      if (box === undefined) continue;
      expect(inside(footprint(def(id)), { x: box.x, y: box.y, w: box.w, h: box.h }), id).toBe(true);
    }
  });
});

describe('makeBreakerPress (plan 37, R3-Z2): what a tap on a breaker does', () => {
  const hit = { getBoundingClientRect: () => ({ top: 0, height: 20 }) } as unknown as Element;
  const info = { down: { x: 1, y: 3 }, up: { x: 2, y: 4 }, hit };

  function rig(current: string, seq = 5) {
    const calls: [string, string][] = [];
    const target = makeBreakerPress({
      def: def('cb.pitot'),
      stateOf: () => current,
      actuate: (id, value): DispatchResult => {
        calls.push([id, value]);
        return { ok: true, event: { seq, t: 0, id, value, source: 'user' } };
      },
      setPending: () => undefined,
    });
    return { target, calls };
  }

  it('is a latch target that pulls a breaker in to out and pushes it out to in', () => {
    const pull = rig('in');
    expect(pull.target.cls).toBe('latch');
    expect(pull.target.tap?.(info)).toBe(5);
    expect(pull.calls).toEqual([['cb.pitot', 'out']]);
    const push = rig('out');
    expect(push.target.tap?.(info)).toBe(5);
    expect(push.calls).toEqual([['cb.pitot', 'in']]);
  });

  it('returns null and never throws for a rejected request', () => {
    const target = makeBreakerPress({
      def: def('cb.pitot'),
      stateOf: () => 'in',
      actuate: (): DispatchResult => ({ ok: false, reason: 'unchanged' }),
      setPending: () => undefined,
    });
    expect(target.tap?.(info)).toBeNull();
  });

  it('drives a real bridge: the sequence number is that of the recorded event', () => {
    const bridge = createPanelBridge(DA50RG);
    const target = makeBreakerPress({
      def: def('cb.pitot'),
      stateOf: () => bridge.stateOf('cb.pitot').peek(),
      actuate: (id, value) => bridge.actuate(id, value),
      setPending: () => undefined,
    });
    expect(target.tap?.(info)).toBe(0);
    expect(bridge.stateOf('cb.pitot').value).toBe('out');
    expect(target.tap?.(info)).toBe(1);
    expect(bridge.stateOf('cb.pitot').value).toBe('in');
  });

  it('the widget source holds no pointer handler, no capture and no slop of its own', () => {
    const src = readFileSync('src/ui/panel/widgets/CircuitBreaker.tsx', 'utf8');
    expect(src).not.toContain('onPointerDown');
    expect(src).not.toContain('setPointerCapture');
    expect(src).not.toContain('TAP_SLOP_PX');
    expect(src).toContain('registerPressTarget');
  });
});
