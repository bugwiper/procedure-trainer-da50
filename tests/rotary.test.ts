import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KNOB_CONTROLS } from '../src/aircraft/da50rg/controls/knobs';
import { DA50RG, VIEW_PROFILES } from '../src/aircraft/da50rg/panel';
import { ROTARY_SKINS, RegistryError, defineRegistry, legalStates } from '../src/engine/registry';
import type { ControlSpec, RotaryDef } from '../src/engine/registry';
import {
  MIN_RADIUS,
  angleOf,
  nearestStop,
  arcDragStep,
  arcPointer,
  arcStop,
  stepStop,
  stopAngle,
  tapStop,
} from '../src/engine/rotary';
import { fitScale, targetSide, zoomRect } from '../src/ui/panel/viewport';
import type { DispatchResult } from '../src/engine/store';
import { createPanelBridge } from '../src/ui/bridge';
import { RotaryBody, makeSpotPress, selectorBarWidth } from '../src/ui/panel/widgets/Rotary';
import { countElements, expand, findElements, textOf } from './vnode-walk';

// Rotary kind (PNL-11, D-07, D-09, D-10): pure stop logic, the registry invariants, the tap-size
// rule and the node cap of the knob art.

function knob(id: string): RotaryDef {
  const def = DA50RG.get(id);
  if (def?.kind !== 'rotary') throw new Error(`${id} is not a rotary control`);
  return def;
}

const rotaries: RotaryDef[] = DA50RG.controls.flatMap((c) => (c.kind === 'rotary' ? [c] : []));

describe('angleOf', () => {
  it('measures degrees clockwise from 12 o clock in screen coordinates', () => {
    expect(angleOf(0, -1)).toBe(0);
    expect(angleOf(1, 0)).toBe(90);
    expect(angleOf(0, 1)).toBe(180);
    expect(angleOf(-1, 0)).toBe(270);
    expect(angleOf(1, -1)).toBeCloseTo(45);
    expect(angleOf(-1, -1)).toBeCloseTo(315);
  });

  it('always lies in 0 <= a < 360', () => {
    for (let a = 0; a < 360; a += 7) {
      const rad = (a * Math.PI) / 180;
      const result = angleOf(Math.sin(rad), -Math.cos(rad));
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(360);
      expect(result).toBeCloseTo(a);
    }
  });

  it('rejects non-finite input', () => {
    expect(() => angleOf(NaN, 0)).toThrow(RangeError);
    expect(() => angleOf(0, Infinity)).toThrow(RangeError);
  });
});

describe('stepStop', () => {
  const dimmer = knob('sw.instr_light');
  const fuel = knob('sw.fuel_trans');

  it('steps one stop clockwise or back', () => {
    expect(stepStop(dimmer, 's50', 1)).toBe('s75');
    expect(stepStop(dimmer, 's50', -1)).toBe('s25');
    expect(stepStop(dimmer, 'off', 1)).toBe('s25');
  });

  it('clamps at both ends and never wraps', () => {
    expect(stepStop(dimmer, 'max', 1)).toBe('max');
    expect(stepStop(dimmer, 'off', -1)).toBe('off');
  });

  it('a two-stop knob always gives the other stop', () => {
    expect(stepStop(fuel, 'off', 1)).toBe('on');
    expect(stepStop(fuel, 'off', -1)).toBe('on');
    expect(stepStop(fuel, 'on', 1)).toBe('off');
    expect(stepStop(fuel, 'on', -1)).toBe('off');
  });

  it('rejects a stop the knob does not have', () => {
    expect(() => stepStop(fuel, 'max', 1)).toThrow(RangeError);
  });
});

describe('nearestStop', () => {
  const fan = knob('sw.env_fan');
  const dimmer = knob('sw.flood_light');

  it('picks the stop with the smallest circular distance', () => {
    expect(nearestStop(fan, 300)).toBe('f1');
    expect(nearestStop(fan, 10)).toBe('f2');
    expect(nearestStop(fan, 175)).toBe('off');
    expect(nearestStop(fan, 205)).toBe('off');
    expect(nearestStop(fan, 245)).toBe('f1');
  });

  it('treats a stop above 360 as the same direction (f3 at 420 is 60 degrees)', () => {
    expect(nearestStop(fan, 60)).toBe('f3');
    expect(nearestStop(fan, 90)).toBe('f3');
    expect(nearestStop(fan, 115)).toBe('f3');
  });

  it('snaps across the 120 degree gap at the bottom to the nearer end', () => {
    // OFF (180) and f1 (300) are 120 apart; f3 (420 = 60) and OFF are 120 apart the other way.
    expect(nearestStop(fan, 235)).toBe('off');
    expect(nearestStop(fan, 245)).toBe('f1');
    expect(nearestStop(fan, 125)).toBe('off');
    expect(nearestStop(fan, 115)).toBe('f3');
  });

  it('works modulo 360 for angles outside 0..360', () => {
    expect(nearestStop(fan, 300 + 360)).toBe('f1');
    expect(nearestStop(fan, 300 - 720)).toBe('f1');
    expect(nearestStop(dimmer, -2)).toBe('s50');
    expect(nearestStop(dimmer, 358)).toBe('s50');
  });

  it('an exact tie goes to the lower index', () => {
    // 180 is 45 degrees from both OFF (-135, i.e. 225) and MAX (135).
    expect(nearestStop(dimmer, 180)).toBe('off');
  });

  it('every stop is the nearest stop of its own angle', () => {
    for (const def of rotaries) {
      for (const stop of def.stops) expect(nearestStop(def, stop.angle)).toBe(stop.id);
    }
  });

  it('rejects non-finite input', () => {
    expect(() => nearestStop(fan, NaN)).toThrow(RangeError);
    expect(() => nearestStop(fan, -Infinity)).toThrow(RangeError);
  });
});

describe('stopAngle', () => {
  it('returns the authored pointer angle', () => {
    expect(stopAngle(knob('sw.fuel_trans'), 'on')).toBe(60);
    expect(stopAngle(knob('sw.env_fan'), 'f3')).toBe(420);
    expect(() => stopAngle(knob('sw.env_fan'), 'f4')).toThrow(RangeError);
    expect(() => stopAngle(knob('sw.fuel_trans'), 'f3')).toThrow(RangeError);
  });
});

describe('DA50RG knobs (Table K1)', () => {
  it('has FUEL TRANS, INSTRUMENT LIGHT, FLOOD LIGHT, FAN and the FUEL selector; all rest OFF but the selector, which rests NORMAL', () => {
    expect(rotaries.map((r) => r.id).sort()).toEqual([
      'sw.env_fan',
      'sw.flood_light',
      'sw.fuel_trans',
      'sw.fuel_valve',
      'sw.instr_light',
    ]);
    for (const def of rotaries) {
      expect(def.default, def.id).toBe(def.id === 'sw.fuel_valve' ? 'normal' : 'off');
    }
    expect(KNOB_CONTROLS.map((c) => c.id)).toEqual([
      'sw.instr_light',
      'sw.flood_light',
      'sw.env_fan',
      'sw.fuel_valve',
    ]);
  });

  it('keeps the stop ids, labels and angles of the table', () => {
    const dimmerStops = [
      ['off', 'OFF', -135],
      ['s25', '25', -67],
      ['s50', '50', 0],
      ['s75', '75', 67],
      ['max', 'MAX', 135],
    ];
    const fanStops = [
      ['off', 'OFF', 180],
      ['f1', '1', 300],
      ['f2', '2', 360],
      ['f3', '3', 420],
    ];
    const read = (id: string) => knob(id).stops.map((s) => [s.id, s.label, s.angle]);
    expect(read('sw.fuel_trans')).toEqual([
      ['off', 'OFF', -60],
      ['on', 'ON', 60],
    ]);
    expect(read('sw.instr_light')).toEqual(dimmerStops);
    expect(read('sw.flood_light')).toEqual(dimmerStops);
    expect(read('sw.env_fan')).toEqual(fanStops);
    // The FUEL selector (owner decision 2026-10-22; OFF at 180 degrees, owner 2026-10-23).
    expect(read('sw.fuel_valve')).toEqual([
      ['normal', 'NORMAL', 0],
      ['emergency', 'EMERGENCY', 90],
      ['off', 'OFF', 180],
    ]);
  });

  it('legal states are the stop ids', () => {
    expect(legalStates(knob('sw.env_fan'))).toEqual(['off', 'f1', 'f2', 'f3']);
  });

  it('FAN sweeps 240 degrees from OFF at the bottom to about 2 o clock, default off, fan scale', () => {
    const fan = knob('sw.env_fan');
    const first = fan.stops[0];
    const last = fan.stops[fan.stops.length - 1];
    expect(last!.angle - first!.angle).toBe(240);
    expect(fan.default).toBe('off');
    expect(fan.scale).toBe('fan');
    expect(fan.nameless).toBe(true);
    expect(fan.hit).toEqual({ w: 112, h: 86 });
  });

  it('FAN has four click spots, one per stop, disjoint, inside the footprint (R2-4.1, Table F1)', () => {
    const fan = knob('sw.env_fan');
    const spots = fan.spots ?? [];
    expect(spots.map((s) => s.stop).sort()).toEqual(['f1', 'f2', 'f3', 'off']);
    for (const s of spots) {
      expect(Math.abs(s.x) + s.w / 2, s.stop).toBeLessThanOrEqual(fan.hit.w / 2);
      expect(Math.abs(s.y) + s.h / 2, s.stop).toBeLessThanOrEqual(fan.hit.h / 2);
      expect(Math.min(s.w, s.h), s.stop).toBeGreaterThanOrEqual(36.4);
    }
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const a = spots[i]!;
        const b = spots[j]!;
        const ox = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
        const oy = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
        expect(ox > 1e-9 && oy > 1e-9, `${a.stop} / ${b.stop}`).toBe(false);
      }
    }
  });

  it('every FAN spot contains the mark of its stop (the point at radius r + 8 and the stop angle)', () => {
    const fan = knob('sw.env_fan');
    for (const stop of fan.stops) {
      const spot = fan.spots?.find((s) => s.stop === stop.id);
      const a = (stop.angle * Math.PI) / 180;
      const mx = (fan.r + 8) * Math.sin(a);
      const my = -(fan.r + 8) * Math.cos(a);
      expect(Math.abs(mx - (spot?.x ?? NaN)), `${stop.id} x`).toBeLessThanOrEqual(
        (spot?.w ?? 0) / 2,
      );
      expect(Math.abs(my - (spot?.y ?? NaN)), `${stop.id} y`).toBeLessThanOrEqual(
        (spot?.h ?? 0) / 2,
      );
    }
  });

  it('no other knob has spots', () => {
    for (const def of rotaries) {
      if (def.id !== 'sw.env_fan') expect(def.spots, def.id).toBeUndefined();
    }
  });
});

describe('tapStop (R2-4.1)', () => {
  const fan = knob('sw.env_fan');

  it('a point inside each spot gives the stop of that spot', () => {
    for (const spot of fan.spots ?? []) {
      expect(tapStop(fan, spot.x, spot.y), spot.stop).toBe(spot.stop);
      expect(tapStop(fan, spot.x + spot.w / 2 - 1, spot.y - spot.h / 2 + 1), spot.stop).toBe(
        spot.stop,
      );
    }
  });

  it('a tap on the printed mark of a stop gives that stop', () => {
    for (const stop of fan.stops) {
      const a = (stop.angle * Math.PI) / 180;
      expect(tapStop(fan, (fan.r + 8) * Math.sin(a), -(fan.r + 8) * Math.cos(a)), stop.id).toBe(
        stop.id,
      );
    }
  });

  it('a body point outside the spots gives the stop nearest to its angle', () => {
    // Right and left of the centre at half height lie between the spots.
    expect(tapStop(fan, 28, 0)).toBe('f3');
    expect(tapStop(fan, -28, 0)).toBe('f1');
    expect(tapStop(fan, 30, 40)).toBe('off');
  });

  it('the exact centre gives null, and so does anything under the minimum radius', () => {
    expect(tapStop(fan, 0, 0)).toBeNull();
    expect(tapStop(fan, MIN_RADIUS * 0.9, 0)).toBeNull();
    expect(MIN_RADIUS).toBe(2);
  });

  it('a boundary shared by two touching spots gives a declared stop', () => {
    const declared = fan.stops.map((s) => s.id);
    expect(declared).toContain(tapStop(fan, 18.5, -22));
    expect(declared).toContain(tapStop(fan, -18.5, -22));
    expect(declared).toContain(tapStop(fan, 0, -3.5));
  });

  it('rejects non-finite input', () => {
    expect(() => tapStop(fan, NaN, 0)).toThrow(RangeError);
  });
});

describe('rotary registry invariants', () => {
  const region = { id: 'r', name: 'R', bounds: { x: 0, y: 0, w: 200, h: 200 } };
  const base = {
    id: 'sw.k',
    kind: 'rotary',
    label: 'K',
    region: 'r',
    x: 100,
    y: 100,
    hit: { w: 60, h: 60 },
    r: 20,
    default: 'a',
  } as const;
  const stops = (...angles: number[]) =>
    angles.map((angle, i) => ({ id: String.fromCharCode(97 + i), label: `S${i}`, angle }));

  function build(spec: Partial<RotaryDef> & Pick<RotaryDef, 'stops'>): ControlSpec {
    return { ...base, ...spec };
  }
  function define(spec: ControlSpec) {
    return defineRegistry({ viewBox: { w: 200, h: 200 }, regions: [region], controls: [spec] });
  }

  it('accepts 2 to 5 stops with increasing angles', () => {
    expect(() => define(build({ stops: stops(-60, 60) }))).not.toThrow();
    expect(() => define(build({ stops: stops(0, 10, 20, 30, 40) }))).not.toThrow();
  });

  it('rejects fewer than 2 and more than 5 stops', () => {
    expect(() => define(build({ stops: stops(0) }))).toThrow(RegistryError);
    expect(() => define(build({ stops: stops(0, 10, 20, 30, 40, 50) }))).toThrow(/2 to 5 stops/);
  });

  it('accepts the fan scale with four stops over a 240 degree sweep', () => {
    expect(() =>
      define(build({ stops: stops(180, 300, 360, 420), scale: 'fan', nameless: true })),
    ).not.toThrow();
  });

  it('accepts every rotary skin of the vocabulary and none, and rejects an unknown one (C-52)', () => {
    expect([...ROTARY_SKINS]).toEqual(['round', 'selector-bar']);
    expect(() => define(build({ stops: stops(0, 90) }))).not.toThrow();
    for (const skin of ROTARY_SKINS) {
      expect(() => define(build({ stops: stops(0, 90), skin })), skin).not.toThrow();
    }
    expect(() =>
      define(build({ stops: stops(0, 90), skin: 'bar' as unknown as RotaryDef['skin'] })),
    ).toThrow(/unknown skin "bar"/);
    expect(() =>
      define(build({ stops: stops(0, 90), skin: 'bar' as unknown as RotaryDef['skin'] })),
    ).toThrow(RegistryError);
  });

  it('accepts a valid arc and rejects a stop outside it, a bad span and click spots', () => {
    expect(() =>
      define(build({ stops: stops(0, 90, 180), arc: { min: 0, max: 180 } })),
    ).not.toThrow();
    expect(() =>
      define(build({ stops: stops(0, 90, 180), arc: { min: -10, max: 200 } })),
    ).not.toThrow();
    expect(() => define(build({ stops: stops(0, 90, 180), arc: { min: 0, max: 150 } }))).toThrow(
      /stop outside its arc/,
    );
    expect(() => define(build({ stops: stops(0, 90, 180), arc: { min: 10, max: 200 } }))).toThrow(
      /stop outside its arc/,
    );
    expect(() => define(build({ stops: stops(0, 90), arc: { min: 90, max: 0 } }))).toThrow(
      /span more than 0/,
    );
    expect(() => define(build({ stops: stops(0, 90), arc: { min: 0, max: 360 } }))).toThrow(
      /span more than 0/,
    );
    expect(() => define(build({ stops: stops(0, 90), arc: { min: 0, max: NaN } }))).toThrow(
      /finite/,
    );
    expect(() =>
      define(
        build({
          stops: stops(0, 90),
          arc: { min: 0, max: 90 },
          spots: [
            { stop: 'a', x: -15, y: 0, w: 10, h: 10 },
            { stop: 'b', x: 15, y: 0, w: 10, h: 10 },
          ],
        }),
      ),
    ).toThrow(/arc and cannot have click spots/);
  });

  it('a two-stop knob with an arc clamps instead of toggling', () => {
    const two = define(build({ stops: stops(0, 90), arc: { min: 0, max: 90 } })).get('sw.k');
    if (two?.kind !== 'rotary') throw new Error('not a rotary');
    expect(stepStop(two, 'a', -1)).toBe('a');
    expect(stepStop(two, 'a', 1)).toBe('b');
    expect(stepStop(two, 'b', 1)).toBe('b');
  });

  it('rejects angles that do not strictly increase', () => {
    expect(() => define(build({ stops: stops(0, 0) }))).toThrow(/strictly greater/);
    expect(() => define(build({ stops: stops(30, 10) }))).toThrow(/strictly greater/);
  });

  it('rejects a sweep of 360 degrees or more', () => {
    expect(() => define(build({ stops: stops(0, 359) }))).not.toThrow();
    expect(() => define(build({ stops: stops(0, 360) }))).toThrow(/below 360/);
  });

  it('rejects a knob that does not fit inside its hit rect', () => {
    expect(() => define(build({ stops: stops(0, 90), r: 31 }))).toThrow(/hit footprint/);
    expect(() => define(build({ stops: stops(0, 90), r: 30 }))).not.toThrow();
    expect(() => define(build({ stops: stops(0, 90), hit: { w: 80, h: 40 }, r: 21 }))).toThrow(
      /hit footprint/,
    );
  });

  describe('spots (R2-4.1)', () => {
    const three = stops(0, 90, 180);
    const wide = { hit: { w: 100, h: 60 } } as const;
    const spot = (stop: string, x: number, y = 0, w = 30, h = 30) => ({ stop, x, y, w, h });
    const valid = [spot('a', -33), spot('b', 0), spot('c', 33)];

    it('a valid list builds, touching spots included', () => {
      expect(() => define(build({ stops: three, ...wide, spots: valid }))).not.toThrow();
      expect(() =>
        define(
          build({ stops: three, ...wide, spots: [spot('a', -30), spot('b', 0), spot('c', 30)] }),
        ),
      ).not.toThrow();
    });

    it('rejects a stop without a spot, two spots for one stop and an unknown stop', () => {
      expect(() =>
        define(build({ stops: three, ...wide, spots: [spot('a', -33), spot('b', 0)] })),
      ).toThrow(/stop "c" has no spot/);
      expect(() =>
        define(
          build({ stops: three, ...wide, spots: [...valid, { ...spot('a', 0, 20), w: 5, h: 5 }] }),
        ),
      ).toThrow(/two spots/);
      expect(() =>
        define(
          build({ stops: three, ...wide, spots: [spot('a', -33), spot('b', 0), spot('z', 33)] }),
        ),
      ).toThrow(/unknown stop/);
    });

    it('rejects a side that is not positive and a spot outside the footprint', () => {
      expect(() =>
        define(
          build({
            stops: three,
            ...wide,
            spots: [spot('a', -33, 0, 0), spot('b', 0), spot('c', 33)],
          }),
        ),
      ).toThrow(/positive sides/);
      expect(() =>
        define(
          build({ stops: three, ...wide, spots: [spot('a', -36), spot('b', 0), spot('c', 33)] }),
        ),
      ).toThrow(/leaves the/);
      expect(() =>
        define(
          build({
            stops: three,
            ...wide,
            spots: [spot('a', -33), spot('b', 0, 16), spot('c', 33)],
          }),
        ),
      ).toThrow(/leaves the/);
    });

    it('rejects two spots that overlap with positive area', () => {
      expect(() =>
        define(
          build({ stops: three, ...wide, spots: [spot('a', -33), spot('b', -10), spot('c', 33)] }),
        ),
      ).toThrow(/overlap/);
    });
  });

  it('keeps the sw. prefix, distinct stop ids and a legal default', () => {
    expect(() => define(build({ stops: stops(0, 90), id: 'lv.k' }))).toThrow(/must start with/);
    expect(() =>
      define(
        build({
          stops: [
            { id: 'a', label: 'A', angle: 0 },
            { id: 'a', label: 'B', angle: 90 },
          ],
        }),
      ),
    ).toThrow(/duplicate state id/);
    expect(() => define(build({ stops: stops(0, 90), default: 'z' }))).toThrow(/legal state/);
  });
});

describe('tap-size rule for knobs', () => {
  it('two-stop knobs use the whole footprint, others half the width', () => {
    expect(targetSide(knob('sw.instr_light'))).toBe(30);
    // The FAN has click spots: the smallest spot side (R2-4.1).
    expect(targetSide(knob('sw.env_fan'))).toBe(37);
    expect(targetSide(knob('sw.fuel_trans'))).toBe(66);
  });

  it('every knob reaches 44 px per tap half when its region is zoomed on the phone', () => {
    for (const def of rotaries) {
      const region = DA50RG.regions.find((r) => r.id === def.region);
      if (region === undefined) throw new Error(`no region ${def.region}`);
      const view = zoomRect(region.bounds, DA50RG.viewBox);
      const px = targetSide(def) * fitScale(view, VIEW_PROFILES.phone);
      expect(px, `${def.id} on the phone`).toBeGreaterThanOrEqual(43.5);
    }
  });
});

describe('RotaryBody art', () => {
  it('stays within 40 elements and has no state text, in every state', () => {
    for (const def of rotaries) {
      for (const stop of def.stops) {
        for (const pressed of [false, true]) {
          const tree = expand(RotaryBody({ def, state: stop.id, pressed }));
          const label = `${def.id} ${stop.id} pressed=${pressed}`;
          expect(countElements(tree), label).toBeLessThanOrEqual(40);
          expect(
            findElements(tree, (el) => 'data-state-text' in el.props),
            label,
          ).toHaveLength(0);
        }
      }
    }
  });

  it('prints the same text strings at every stop of a knob (placard and scale marks only)', () => {
    for (const def of rotaries) {
      const strings = (state: string) =>
        findElements(expand(RotaryBody({ def, state, pressed: false })), (el) => el.tag === 'text')
          .map((el) => textOf(el))
          .sort();
      const first = strings(def.stops[0]?.id ?? '');
      expect(first.length, def.id).toBeGreaterThan(0);
      for (const stop of def.stops) expect(strings(stop.id), `${def.id}/${stop.id}`).toEqual(first);
      // The fan scale prints its first stop only (the others are symbols).
      const printed = def.scale === 'fan' ? def.stops.slice(0, 1) : def.stops;
      for (const stop of printed) expect(first, def.id).toContain(stop.label);
    }
  });

  it('is pure art: no handler, no data-hit', () => {
    for (const def of rotaries) {
      const tree = expand(RotaryBody({ def, state: def.default, pressed: false }));
      const offenders = findElements(tree, (el) =>
        Object.keys(el.props).some((key) => /^on[A-Z]/.test(key) || key === 'data-hit'),
      );
      expect(offenders, def.id).toEqual([]);
    }
  });

  it('turns the rim light blue only while pressed', () => {
    const def = knob('sw.fuel_trans');
    const rimOf = (pressed: boolean) =>
      findElements(
        expand(RotaryBody({ def, state: 'off', pressed })),
        (el) => el.tag === 'circle',
      )[0]?.props['stroke'];
    expect(rimOf(false)).toBe('#3a3f46');
    expect(rimOf(true)).toBe('#8fb8e6');
  });

  it('the pointer follows the drag angle and rests at the committed stop otherwise', () => {
    const def = knob('sw.instr_light');
    const pointerOf = (dragAngle?: number) =>
      findElements(
        expand(RotaryBody({ def, state: 'off', dragAngle, pressed: dragAngle !== undefined })),
        (el) => el.tag === 'line',
      )[0];
    const dragged = pointerOf(90);
    expect(Number(dragged?.props['x2'])).toBeCloseTo(0.8 * def.r, 1);
    expect(Number(dragged?.props['y2'])).toBeCloseTo(0, 1);
    // At rest the pointer sits at the angle of the committed stop OFF (-135 degrees).
    const rest = pointerOf();
    const rad = (stopAngle(def, 'off') * Math.PI) / 180;
    expect(Number(rest?.props['x2'])).toBeCloseTo(0.8 * def.r * Math.sin(rad), 1);
    expect(Number(rest?.props['y2'])).toBeCloseTo(-0.8 * def.r * Math.cos(rad), 1);
  });

  it('prints the labels of every stop of an arc-scale knob', () => {
    const def = knob('sw.flood_light');
    const text = textOf(expand(RotaryBody({ def, state: 'off', pressed: false })));
    for (const stop of def.stops) expect(text).toContain(stop.label);
  });

  describe('fan scale (plan 20, G-3)', () => {
    const def = knob('sw.env_fan');
    const render = (state: string) => expand(RotaryBody({ def, state, pressed: false }));

    it('prints only OFF, no other label, no number, no placard, in every state', () => {
      for (const stop of def.stops) {
        const strings = findElements(render(stop.id), (el) => el.tag === 'text').map((t) =>
          textOf(t),
        );
        expect(strings, stop.id).toEqual(['OFF']);
      }
    });

    it('draws no dots: no circle but the knob disc', () => {
      const circles = findElements(render('off'), (el) => el.tag === 'circle');
      expect(circles).toHaveLength(1);
      expect(Number(circles[0]?.props['r'])).toBe(def.r);
    });

    it('draws three four-blade glyphs, small to large, at the angles of the three upper stops', () => {
      const glyphs = findElements(render('off'), (el) => 'data-fan-symbol' in el.props);
      expect(glyphs.map((g) => g.props['data-fan-symbol'])).toEqual(['f1', 'f2', 'f3']);
      const sizes = glyphs.map((g) => Number(g.props['data-fan-size']));
      expect(sizes[0]).toBeLessThan(sizes[1] ?? 0);
      expect(sizes[1]).toBeLessThan(sizes[2] ?? 0);
      glyphs.forEach((g, i) => {
        const stop = def.stops[i + 1];
        const m = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(String(g.props['transform']));
        const angle = (Math.atan2(Number(m?.[1]), -Number(m?.[2])) * 180) / Math.PI;
        const want = (((((stop!.angle % 360) + 360) % 360) + 540) % 360) - 180;
        expect(angle).toBeCloseTo(want, 0);
        // One path element per glyph, four blades (four subpaths).
        expect(g.tag).toBe('path');
        expect(String(g.props['d']).split('M').length - 1).toBe(4);
      });
    });

    it('is at most 40 elements at every stop and the pointer follows the stop angle', () => {
      for (const stop of def.stops) {
        const tree = render(stop.id);
        expect(countElements(tree), stop.id).toBeLessThanOrEqual(40);
        const line = findElements(tree, (el) => el.tag === 'line')[0];
        const rad = (stop.angle * Math.PI) / 180;
        expect(Number(line?.props['x2'])).toBeCloseTo(0.8 * def.r * Math.sin(rad), 1);
        expect(Number(line?.props['y2'])).toBeCloseTo(-0.8 * def.r * Math.cos(rad), 1);
      }
    });

    it('stepStop itself still steps toward the maximum, toward OFF, both ends clamp (not used by the FAN taps)', () => {
      expect(stepStop(def, 'off', 1)).toBe('f1');
      expect(stepStop(def, 'f1', 1)).toBe('f2');
      expect(stepStop(def, 'f2', 1)).toBe('f3');
      expect(stepStop(def, 'f3', 1)).toBe('f3');
      expect(stepStop(def, 'f3', -1)).toBe('f2');
      expect(stepStop(def, 'off', -1)).toBe('off');
    });
  });
});

describe('Rotary.tsx type scale', () => {
  it('uses only the font sizes 6, 8, 10 and 14', () => {
    const file = fileURLToPath(new URL('../src/ui/panel/widgets/Rotary.tsx', import.meta.url));
    const source = readFileSync(file, 'utf8');
    const sizes = Array.from(source.matchAll(/font-size\s*=\s*\{\s*([0-9.]+)\s*\}/g), (m) =>
      Number(m[1]),
    );
    expect(sizes.length).toBeGreaterThanOrEqual(2);
    expect(sizes.filter((s) => ![6, 8, 10, 14].includes(s))).toEqual([]);
  });
});

describe('makeSpotPress (plan 38, R3-Z2): what a tap on a FAN spot does', () => {
  const fan = knob('sw.env_fan');
  const hit = {} as unknown as Element;
  const info = { down: { x: 100, y: 200 }, up: { x: 101, y: 201 }, hit };

  function rig(local: { x: number; y: number } | null, seq = 4) {
    const calls: [string, string][] = [];
    const asked: [number, number][] = [];
    const pending: boolean[] = [];
    const target = makeSpotPress({
      def: fan,
      toLocal: (x, y) => {
        asked.push([x, y]);
        return local;
      },
      actuate: (id, value): DispatchResult => {
        calls.push([id, value]);
        return { ok: true, event: { seq, t: 0, id, value, source: 'user' } };
      },
      setPending: (on) => pending.push(on),
    });
    return { target, calls, asked, pending };
  }

  it('is a latch target; a tap converts the pointer-down point and actuates the stop of its spot', () => {
    for (const spot of fan.spots ?? []) {
      const r = rig({ x: spot.x, y: spot.y });
      expect(r.target.cls).toBe('latch');
      expect(r.target.tap?.(info), spot.stop).toBe(4);
      expect(r.calls).toEqual([['sw.env_fan', spot.stop]]);
      // The knob-local conversion uses the pointer-down point, not the up point.
      expect(r.asked).toEqual([[100, 200]]);
    }
  });

  it('the dead zone at the exact centre (tapStop null) actuates nothing and returns null', () => {
    const r = rig({ x: 0, y: 0 });
    expect(r.target.tap?.(info)).toBeNull();
    expect(r.calls).toEqual([]);
  });

  it('a point that cannot be converted actuates nothing and returns null', () => {
    const r = rig(null);
    expect(r.target.tap?.(info)).toBeNull();
    expect(r.calls).toEqual([]);
  });

  it('returns the sequence number of the dispatch result, null for a rejection', () => {
    const spot = fan.spots?.[0];
    if (spot === undefined) throw new Error('no spots');
    const rejected = makeSpotPress({
      def: fan,
      toLocal: () => ({ x: spot.x, y: spot.y }),
      actuate: (): DispatchResult => ({ ok: false, reason: 'unchanged' }),
      setPending: () => undefined,
    });
    expect(rejected.tap?.(info)).toBeNull();
    expect(rig({ x: spot.x, y: spot.y }, 11).target.tap?.(info)).toBe(11);
  });

  it('passes a stop equal to the current one to actuate: the store rejects it, the factory does not compare', () => {
    const bridge = createPanelBridge(DA50RG);
    const off = fan.spots?.find((sp) => sp.stop === fan.default);
    if (off === undefined) throw new Error('no spot of the default stop');
    const seen: string[] = [];
    const target = makeSpotPress({
      def: fan,
      toLocal: () => ({ x: off.x, y: off.y }),
      actuate: (id, value) => {
        seen.push(value);
        return bridge.actuate(id, value);
      },
      setPending: () => undefined,
    });
    expect(target.tap?.(info)).toBeNull();
    expect(seen).toEqual([fan.default]);
  });

  it('drives a real bridge: a tap on the f2 spot records one event and sets f2', () => {
    const bridge = createPanelBridge(DA50RG);
    const f2 = fan.spots?.find((sp) => sp.stop === 'f2');
    if (f2 === undefined) throw new Error('no f2 spot');
    const target = makeSpotPress({
      def: fan,
      toLocal: () => ({ x: f2.x, y: f2.y }),
      actuate: (id, value) => bridge.actuate(id, value),
      setPending: () => undefined,
    });
    expect(target.tap?.(info)).toBe(0);
    expect(bridge.stateOf('sw.env_fan').value).toBe('f2');
  });

  it('setPending is the one the gesture layer drives; the factory never calls it', () => {
    const r = rig({ x: 0, y: -22 });
    r.target.tap?.(info);
    expect(r.pending).toEqual([]);
    r.target.setPending?.(true);
    r.target.setPending?.(false);
    expect(r.pending).toEqual([true, false]);
  });

  it('the spot rectangles carry no pointer handler of their own: only the body hit does', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/ui/panel/widgets/Rotary.tsx', import.meta.url)),
      'utf8',
    );
    // Lines naming it: the definition and the body hit rectangle (the spots no longer use it).
    expect(src.split('\n').filter((l) => l.includes('onPointerDown'))).toHaveLength(2);
    expect(src).toContain('registerPressTarget');
  });
});

describe('FUEL selector (plan 03-10, C-51, C-52)', () => {
  const fuel = knob('sw.fuel_valve');
  const R = fuel.r;

  it('is a nameless rotary of the selector-bar look with the stops NORMAL, EMERGENCY, OFF clockwise', () => {
    expect(fuel.kind).toBe('rotary');
    expect(fuel.skin).toBe('selector-bar');
    expect(fuel.nameless).toBe(true);
    expect(fuel.label).toBe('FUEL VALVE');
    expect(fuel.region).toBe('pedestal');
    expect(fuel.default).toBe('normal');
    expect(fuel.spots).toBeUndefined();
    const angles = fuel.stops.map((s) => s.angle);
    expect(angles).toEqual([...angles].sort((a, b) => a - b));
    expect(new Set(angles).size).toBe(angles.length);
    expect(fuel.stops.map((s) => s.id)).toEqual(['normal', 'emergency', 'off']);
  });

  it('every other knob keeps the round look: no skin, or round', () => {
    for (const def of rotaries) {
      if (def.id === 'sw.fuel_valve') continue;
      expect(def.skin === undefined || def.skin === 'round', def.id).toBe(true);
      const tree = expand(RotaryBody({ def, state: def.default, pressed: false }));
      expect(
        findElements(tree, (el) => 'data-selector-bar' in el.props),
        def.id,
      ).toHaveLength(0);
      expect(findElements(tree, (el) => el.tag === 'circle').length, def.id).toBeGreaterThan(0);
    }
  });

  it('turns both ways on one bounded arc from NORMAL (0) to OFF (180); no other knob has an arc', () => {
    expect(fuel.arc).toEqual({ min: 0, max: 180 });
    expect(fuel.stops.map((s) => s.angle)).toEqual([0, 90, 180]);
    for (const def of rotaries) {
      if (def.id !== 'sw.fuel_valve') expect(def.arc, def.id).toBeUndefined();
    }
  });

  it('taps step one stop towards the tapped side and do nothing past either end', () => {
    expect(stepStop(fuel, 'normal', 1)).toBe('emergency');
    expect(stepStop(fuel, 'emergency', 1)).toBe('off');
    expect(stepStop(fuel, 'off', 1)).toBe('off');
    expect(stepStop(fuel, 'off', -1)).toBe('emergency');
    expect(stepStop(fuel, 'emergency', -1)).toBe('normal');
    expect(stepStop(fuel, 'normal', -1)).toBe('normal');
  });

  describe('bounded drag', () => {
    /** Feeds pointer angles one after the other, as the widget does; returns position and stop. */
    function drag(angles: number[]) {
      let pos: number | null = null;
      let previous = angles[0] ?? 0;
      for (const angle of angles) {
        pos = arcDragStep(fuel, pos, previous, angle);
        previous = angle;
      }
      if (pos === null) throw new Error('no samples');
      return { pos, stop: arcStop(fuel, pos), pointer: arcPointer(fuel, pos) };
    }
    /** A sweep from `a` to `b` in 5 degree samples, the way round given by the sign of `step`. */
    function sweep(a: number, b: number, step: number): number[] {
      const out: number[] = [];
      for (let x = a; step > 0 ? x <= b : x >= b; x += step) out.push(x);
      return out;
    }

    it('a clockwise drag from NORMAL passes EMERGENCY and reaches OFF; past OFF it is held', () => {
      expect(drag(sweep(0, 90, 5)).stop).toBe('emergency');
      const toOff = drag(sweep(0, 180, 5));
      expect(toOff.stop).toBe('off');
      expect(toOff.pointer).toBe(180);
      expect(drag(sweep(0, 330, 5)).stop).toBe('off');
      expect(drag(sweep(0, 330, 5)).pointer).toBe(180);
    });

    it('a drag toward the blocked side from NORMAL stays at NORMAL, however far round the left', () => {
      for (const end of [-45, -90, -135, -180, -270, -340]) {
        const result = drag(sweep(0, end, -5));
        expect(result.stop, String(end)).toBe('normal');
        expect(result.pointer, String(end)).toBe(0);
      }
    });

    it('a drag toward the blocked side from OFF stays at OFF, however far round the left', () => {
      for (const end of [225, 270, 315, 360, 450]) {
        const result = drag(sweep(180, end, 5));
        expect(result.stop, String(end)).toBe('off');
        expect(result.pointer, String(end)).toBe(180);
      }
    });

    it('a drag from NORMAL to OFF passes EMERGENCY (the arc is followed, never the left sector)', () => {
      const path = sweep(0, 180, 5);
      const seen = new Set<string>();
      let pos: number | null = null;
      let previous = 0;
      for (const angle of path) {
        pos = arcDragStep(fuel, pos, previous, angle);
        previous = angle;
        seen.add(arcStop(fuel, pos));
      }
      expect([...seen]).toEqual(['normal', 'emergency', 'off']);
    });

    it('the pointer follows the finger again once it comes back into the arc', () => {
      const result = drag([...sweep(0, -60, -5), ...sweep(-55, 0, 5), ...sweep(5, 95, 5)]);
      expect(result.stop).toBe('emergency');
      expect(result.pointer).toBe(95);
      const rest = drag([...sweep(0, -60, -5), ...sweep(-55, 0, 5)]);
      expect(rest.stop).toBe('normal');
    });

    it('the first sample places the pointer on the arc from its absolute angle', () => {
      expect(drag([90]).stop).toBe('emergency');
      expect(drag([180]).stop).toBe('off');
      // In the blocked sector the half next to an end belongs to that end.
      expect(drag([300]).stop).toBe('normal');
      expect(drag([230]).stop).toBe('off');
    });

    it('is deterministic and rejects non-finite input', () => {
      expect(() => arcDragStep(fuel, 0, NaN, 3)).toThrow(RangeError);
      expect(() => arcPointer(fuel, Infinity)).toThrow(RangeError);
      expect(() => arcDragStep(knob('sw.env_fan'), null, 0, 0)).toThrow(/no arc/);
    });
  });

  it('a drag commits the nearest stop: past 135 degrees it is OFF, below 45 it is NORMAL', () => {
    const [normal, emergency, off] = fuel.stops;
    if (normal === undefined || emergency === undefined || off === undefined)
      throw new Error('stops');
    expect(nearestStop(fuel, off.angle - 25)).toBe('off');
    expect(nearestStop(fuel, emergency.angle - 10)).toBe('emergency');
    expect(nearestStop(fuel, (normal.angle + emergency.angle) / 2 - 1)).toBe('normal');
    expect(nearestStop(fuel, (normal.angle + emergency.angle) / 2 + 1)).toBe('emergency');
    for (const stop of fuel.stops) expect(nearestStop(fuel, stop.angle)).toBe(stop.id);
  });

  it('each tap half reaches 44 px at the pedestal zoom of the phone', () => {
    const region = DA50RG.regions.find((r) => r.id === fuel.region);
    if (region === undefined) throw new Error('no region');
    const view = zoomRect(region.bounds, DA50RG.viewBox);
    expect(targetSide(fuel) * fitScale(view, VIEW_PROFILES.phone)).toBeGreaterThanOrEqual(43.5);
  });

  describe('selector-bar art', () => {
    const render = (state: string, pressed = false, dragAngle?: number) =>
      expand(RotaryBody({ def: fuel, state, pressed, dragAngle }));
    const bar = (tree: ReturnType<typeof render>) =>
      findElements(tree, (el) => 'data-selector-bar' in el.props)[0];
    const knobGroup = (tree: ReturnType<typeof render>) =>
      findElements(tree, (el) => 'data-selector-knob' in el.props)[0];

    it('draws an elongated bar: its length is four times its width, both read from r', () => {
      for (const stop of fuel.stops) {
        const el = bar(render(stop.id));
        expect(Number(el?.props['height']), stop.id).toBe(2 * R);
        expect(Number(el?.props['width']), stop.id).toBe(selectorBarWidth(R));
        expect(Number(el?.props['height']) / Number(el?.props['width']), stop.id).toBe(4);
        // Centred on the knob: it spans -r to +r along its axis.
        expect(Number(el?.props['y'])).toBe(-R);
        expect(Number(el?.props['x'])).toBe(-selectorBarWidth(R) / 2);
      }
    });

    it('turns the bar to the stop angle of each state, and to the drag angle while dragging', () => {
      for (const stop of fuel.stops) {
        expect(String(knobGroup(render(stop.id))?.props['transform']), stop.id).toBe(
          `rotate(${stop.angle.toFixed(2)})`,
        );
      }
      expect(String(knobGroup(render('normal', true, 137))?.props['transform'])).toBe(
        'rotate(137.00)',
      );
    });

    it('puts a short white line at the pointing end, inside the bar', () => {
      for (const stop of fuel.stops) {
        const tree = render(stop.id);
        const line = findElements(tree, (el) => 'data-selector-line' in el.props)[0];
        expect(line?.props['stroke']).toBe('#ffffff');
        // Along the pointing axis (negative y of the turned frame), between the tip and the middle.
        const y1 = Number(line?.props['y1']);
        const y2 = Number(line?.props['y2']);
        expect(Number(line?.props['x1'])).toBe(0);
        expect(Number(line?.props['x2'])).toBe(0);
        expect(Math.min(y1, y2)).toBeGreaterThanOrEqual(-R);
        expect(Math.max(y1, y2)).toBeLessThan(0);
        expect(Math.abs(y2 - y1)).toBeLessThan(R);
        // The line is a child of the turned group, so it turns with the bar.
        expect(findElements(knobGroup(tree) as never, (el) => el === line)).toHaveLength(1);
      }
    });

    it('prints exactly NORMAL, EMERGENCY and OFF in every state, outside the sweep at their stop directions', () => {
      for (const stop of fuel.stops) {
        const tree = render(stop.id);
        const words = findElements(tree, (el) => 'data-selector-word' in el.props);
        expect(words.map((w) => textOf(w)).sort(), stop.id).toEqual(['EMERGENCY', 'NORMAL', 'OFF']);
        expect(findElements(tree, (el) => el.tag === 'text')).toHaveLength(3);
        for (const word of words) {
          const def = fuel.stops.find((s) => s.id === word.props['data-selector-word']);
          if (def === undefined) throw new Error('word of no stop');
          const x = Number(word.props['x']);
          const y = Number(word.props['y']);
          // The anchor point lies outside the sweep of the knob, in the direction of its stop (the
          // baseline shift of a word is at most 6 units, so the direction holds within 25 degrees).
          expect(
            Math.hypot(x, y),
            word.props['data-selector-word'] as string,
          ).toBeGreaterThanOrEqual(R);
          const off = Math.abs(angleOf(x, y) - def.angle) % 360;
          expect(Math.min(off, 360 - off), def.id).toBeLessThan(25);
          // Each word reads away from the knob.
          const side = Math.sin((def.angle * Math.PI) / 180);
          expect(word.props['text-anchor']).toBe(
            side > 0.3 ? 'start' : side < -0.3 ? 'end' : 'middle',
          );
        }
      }
    });

    it('marks a press with the blue ring on the bar and nothing else', () => {
      expect(bar(render('normal', false))?.props['stroke']).not.toBe('#8fb8e6');
      expect(bar(render('normal', true))?.props['stroke']).toBe('#8fb8e6');
    });

    it('draws no scale, no dots and no round disc, and stays within 40 elements', () => {
      for (const stop of fuel.stops) {
        const tree = render(stop.id);
        expect(findElements(tree, (el) => el.tag === 'circle')).toHaveLength(0);
        expect(findElements(tree, (el) => el.tag === 'path')).toHaveLength(0);
        expect(countElements(tree)).toBeLessThanOrEqual(40);
      }
    });
  });
});
