import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KNOB_CONTROLS } from '../src/aircraft/da50rg/controls/knobs';
import { DA50RG, VIEW_PROFILES } from '../src/aircraft/da50rg/panel';
import { RegistryError, defineRegistry, legalStates } from '../src/engine/registry';
import type { ControlSpec, RotaryDef } from '../src/engine/registry';
import {
  MIN_RADIUS,
  angleOf,
  nearestStop,
  stepStop,
  stopAngle,
  tapStop,
} from '../src/engine/rotary';
import { fitScale, targetSide, zoomRect } from '../src/ui/panel/viewport';
import { RotaryBody } from '../src/ui/panel/widgets/Rotary';
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
  it('has FUEL TRANS, INSTRUMENT LIGHT, FLOOD LIGHT and FAN, all resting OFF', () => {
    expect(rotaries.map((r) => r.id).sort()).toEqual([
      'sw.env_fan',
      'sw.flood_light',
      'sw.fuel_trans',
      'sw.instr_light',
    ]);
    for (const def of rotaries) expect(def.default).toBe('off');
    expect(KNOB_CONTROLS.map((c) => c.id)).toEqual([
      'sw.instr_light',
      'sw.flood_light',
      'sw.env_fan',
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
