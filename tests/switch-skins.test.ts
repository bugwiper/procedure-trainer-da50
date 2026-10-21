import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { ROCKER_COLOURS, ROCKER_SIZES } from '../src/engine/registry';
import type { ControlDef, GuardedToggleDef, ToggleDef } from '../src/engine/registry';
import { BAT_THROW, BatBody } from '../src/ui/panel/skins/Bat';
import { ROCKER_FACE, ROCKER_LIFT, RockerBody, rockerExtent } from '../src/ui/panel/skins/Rocker';
import { GuardCover } from '../src/ui/panel/widgets/GuardedToggle';
import {
  SoftkeyBody,
  makeTogglePress,
  pressedHalfOf,
  stateAtFraction,
  tapTarget,
  togglePosition,
} from '../src/ui/panel/widgets/Toggle';
import type { DispatchResult } from '../src/engine/store';
import type { PressInfo } from '../src/ui/panel/press-targets';
import { countElements, expand, findElements, textOf } from './vnode-walk';
import type { El, Tree } from './vnode-walk';

// Switch skins (PNL-11, D-08, D-09, UI-SPEC 8.1, 8.2, 8.6). Pure vnode and data checks, no DOM.

const PRESSED_RING = '#8fb8e6';

type Rockerish = ToggleDef | GuardedToggleDef;

function isToggle(c: ControlDef): c is ToggleDef {
  return c.kind === 'toggle';
}

function isRockerish(c: ControlDef): c is Rockerish {
  return (
    (c.kind === 'toggle' && c.skin === 'rocker') ||
    (c.kind === 'guarded-toggle' && c.size !== undefined)
  );
}

const TOGGLES = DA50RG.controls.filter(isToggle);
const ROCKERS = DA50RG.controls.filter(isRockerish);

function toggle(id: string): ToggleDef {
  const found = TOGGLES.find((t) => t.id === id);
  if (found === undefined) throw new Error(`unknown toggle ${id}`);
  return found;
}

function allProps(tree: Tree): unknown[] {
  return findElements(tree, () => true).flatMap((el) => Object.values(el.props));
}

function stateTexts(tree: Tree): El[] {
  return findElements(tree, (el) => 'data-state-text' in el.props);
}

describe('RockerBody', () => {
  const POSITIONS = ['low', 'mid', 'high'] as const;

  it('stays within 40 nodes with only the name as text, in every size, colour and position', () => {
    for (const size of ROCKER_SIZES) {
      for (const colour of ROCKER_COLOURS) {
        for (const position of POSITIONS) {
          for (const pressed of [false, true]) {
            const def = { label: 'TEST', hit: { w: 66, h: 70 }, size, colour };
            const tree = expand(RockerBody({ def, position, pressed }));
            const id = `${size}/${colour}/${position}/${String(pressed)}`;
            expect(countElements(tree), id).toBeLessThanOrEqual(40);
            expect(stateTexts(tree), id).toHaveLength(0);
            const texts = findElements(tree, (el) => el.tag === 'text');
            expect(
              texts.map((t) => textOf(t)),
              id,
            ).toEqual(['TEST']);
            expect(
              texts.filter((t) => t.props['font-size'] === 6),
              id,
            ).toHaveLength(0);
          }
        }
      }
    }
  });

  it('puts the name below the bezel on the LIGHT size and above it on the others', () => {
    for (const size of ROCKER_SIZES) {
      const def = { label: 'TEST', hit: { w: 66, h: 70 }, size, colour: 'white' } as const;
      const tree = expand(RockerBody({ def, position: 'low', pressed: false }));
      const y = Number(findElements(tree, (el) => el.tag === 'text')[0]?.props['y']);
      if (size === 'LIGHT') expect(y, size).toBeGreaterThan(0);
      else expect(y, size).toBeLessThan(0);
    }
  });

  it('uses the pressed ring only while a pointer is down', () => {
    for (const size of ROCKER_SIZES) {
      const def = {
        label: 'TEST',
        hit: { w: 66, h: 70 },
        size,
        colour: 'white' as const,
      };
      const idle = expand(RockerBody({ def, position: 'high', pressed: false }));
      const held = expand(RockerBody({ def, position: 'high', pressed: true }));
      expect(allProps(idle), size).not.toContain(PRESSED_RING);
      expect(allProps(held), size).toContain(PRESSED_RING);
    }
  });

  it('swaps the half tones with the position: high presses the upper half', () => {
    const def = { label: 'T', hit: { w: 66, h: 70 }, size: 'M', colour: 'white' } as const;
    const paths = (position: 'low' | 'mid' | 'high') =>
      findElements(
        expand(RockerBody({ def, position, pressed: false })),
        (el) => el.tag === 'path',
      ).map((p) => p.props['fill']);
    expect(paths('high')).toEqual(['#c7c6bd', '#f1f0e8']);
    expect(paths('low')).toEqual(['#f1f0e8', '#c7c6bd']);
    expect(paths('mid')).toEqual(['#f1f0e8', '#f1f0e8']);
  });

  it('tags a wall on the raised half: low raises the upper, high the lower, mid both', () => {
    const walls = (colour: 'white' | 'red', position: 'low' | 'mid' | 'high') =>
      findElements(
        expand(
          RockerBody({
            def: { label: 'T', hit: { w: 66, h: 70 }, size: 'M', colour },
            position,
            pressed: false,
          }),
        ),
        (el) => 'data-rocker-wall' in el.props,
      );
    for (const colour of ROCKER_COLOURS) {
      const tone = colour === 'white' ? '#8a897f' : '#5a0a0f';
      expect(walls(colour, 'low').map((w) => w.props['data-rocker-wall'])).toEqual(['upper']);
      expect(walls(colour, 'high').map((w) => w.props['data-rocker-wall'])).toEqual(['lower']);
      expect(walls(colour, 'mid').map((w) => w.props['data-rocker-wall'])).toEqual([
        'upper',
        'lower',
      ]);
      for (const position of ['low', 'mid', 'high'] as const) {
        for (const wall of walls(colour, position)) {
          expect(wall.tag).toBe('polygon');
          expect(wall.props['fill']).toBe(tone);
        }
      }
    }
  });

  it('draws the walls after the two half face paths', () => {
    const def = { label: 'T', hit: { w: 66, h: 70 }, size: 'S', colour: 'red' } as const;
    const tree = expand(RockerBody({ def, position: 'mid', pressed: false }));
    const tags = findElements(tree, () => true).map((el) => el.tag);
    const firstPaths = tags.indexOf('path');
    expect(tags.slice(firstPaths, firstPaths + 2)).toEqual(['path', 'path']);
    expect(tags.indexOf('polygon')).toBeGreaterThan(firstPaths + 1);
  });

  it('rockerExtent includes the lift', () => {
    for (const size of ROCKER_SIZES) {
      const face = ROCKER_FACE[size];
      const { halfW, halfH } = rockerExtent(size);
      expect(halfH, size).toBeGreaterThanOrEqual(face.h / 2 + ROCKER_LIFT);
      expect(halfW, size).toBeGreaterThanOrEqual(face.w / 2 + ROCKER_LIFT);
    }
  });

  it('has ears only on size L', () => {
    for (const size of ROCKER_SIZES) {
      expect(ROCKER_FACE[size].ears !== undefined, size).toBe(size === 'L');
    }
  });
});

describe('DA50RG rockers', () => {
  it('every rocker face, ears and bezel fit inside its hit rect', () => {
    expect(ROCKERS.length).toBeGreaterThan(0);
    for (const def of ROCKERS) {
      const size = def.size;
      expect(size, def.id).toBeDefined();
      if (size === undefined) continue;
      const { halfW, halfH } = rockerExtent(size);
      expect(halfW * 2, `${def.id} width`).toBeLessThanOrEqual(def.hit.w);
      expect(halfH * 2, `${def.id} height`).toBeLessThanOrEqual(def.hit.h);
    }
  });

  it('ELECT. MASTER is the big red rocker with ears', () => {
    const def = toggle('sw.elect_master');
    expect([def.skin, def.size, def.colour]).toEqual(['rocker', 'L', 'red']);
    expect(ROCKER_FACE.L.ears).toBeDefined();
  });
});

describe('D-08 colour and size gate', () => {
  const EXPECTED: Record<string, readonly [string, string]> = {
    'sw.elect_master': ['L', 'red'],
    'sw.elt': ['S', 'red'],
    'sw.ess_bus': ['M', 'white'],
    'sw.prop_deice': ['M', 'white'],
    'sw.emerg_fuel_pump': ['M', 'white'],
    'sw.av_master': ['M', 'white'],
    'sw.pitot_stall_heat': ['W', 'white'],
    'sw.light_landing': ['LIGHT', 'white'],
    'sw.light_taxi': ['LIGHT', 'white'],
    'sw.light_position': ['LIGHT', 'white'],
    'sw.light_strobe': ['LIGHT', 'white'],
  };

  it('gives every rocker toggle its size and colour from Table S1', () => {
    for (const [id, [size, colour]] of Object.entries(EXPECTED)) {
      const def = toggle(id);
      expect(def.skin, id).toBe('rocker');
      expect(def.size, id).toBe(size);
      expect(def.colour, id).toBe(colour);
    }
  });

  it('has no other rocker toggle than the eleven of Table S1', () => {
    const ids = TOGGLES.filter((t) => t.skin === 'rocker').map((t) => t.id);
    expect(ids.sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it('red rocker parts are exactly ELECT. MASTER and ELT; the red of the de-ice unit is the guard cover only', () => {
    const red = ROCKERS.filter((t) => t.colour === 'red').map((t) => t.id);
    expect(red.sort()).toEqual(['sw.elect_master', 'sw.elt']);
    // The ALTERNATE switch has no rocker size and colour: it is the normal toggle under its guard.
    const alt = DA50RG.controls.find((c) => c.id === 'sw.deice_alternate');
    expect(alt?.kind).toBe('guarded-toggle');
    if (alt?.kind !== 'guarded-toggle') return;
    expect([alt.size, alt.colour]).toEqual([undefined, undefined]);
  });

  it('keeps the bats: alternators, FADEC and ENGINE MASTER (with ball)', () => {
    for (const id of ['sw.alternator_1', 'sw.alternator_2', 'sw.fadec', 'sw.engine_master']) {
      const def = toggle(id);
      expect(def.skin ?? 'bat', id).toBe('bat');
      expect(def.size, id).toBeUndefined();
      expect(def.colour, id).toBeUndefined();
    }
    expect(toggle('sw.engine_master').ball).toBe(true);
    expect(TOGGLES.filter((t) => t.ball === true).map((t) => t.id)).toEqual(['sw.engine_master']);
  });

  it('the four light rockers keep ON as the second state and draw no state text', () => {
    for (const id of [
      'sw.light_landing',
      'sw.light_taxi',
      'sw.light_position',
      'sw.light_strobe',
    ]) {
      const def = toggle(id);
      expect(def.states[1].id, id).toBe('on');
      const tree = expand(RockerBody({ def, position: 'high', pressed: false }));
      expect(stateTexts(tree), id).toHaveLength(0);
    }
  });
});

describe('three-position toggle contract (plan 18, Table T2)', () => {
  it('the ELT is the small red rocker with reset_test, armed, on from bottom to top', () => {
    const elt = toggle('sw.elt');
    expect(elt.states.map((st) => st.id)).toEqual(['reset_test', 'armed', 'on']);
    expect(elt.default).toBe('armed');
    expect([elt.skin, elt.size, elt.colour]).toEqual(['rocker', 'S', 'red']);
    expect(elt.hit).toEqual({ w: 34, h: 78 });
    expect([elt.x, elt.y]).toEqual([56, 43]);
  });

  it('only the ELT and the de-ice mode toggle have three states among the toggles', () => {
    expect(TOGGLES.filter((t) => t.states.length === 3).map((t) => t.id)).toEqual([
      'sw.deice_mode',
      'sw.deice_ice_light',
      'sw.elt',
    ]);
  });

  it('the position input follows the state index: low and high, or low, mid and high', () => {
    expect([togglePosition(0, 2), togglePosition(1, 2)]).toEqual(['low', 'high']);
    expect([0, 1, 2].map((i) => togglePosition(i, 3))).toEqual(['low', 'mid', 'high']);
  });

  it('data-pressed-half is upper for high, level for mid and lower for low', () => {
    expect(pressedHalfOf('high')).toBe('upper');
    expect(pressedHalfOf('mid')).toBe('level');
    expect(pressedHalfOf('low')).toBe('lower');
  });

  it('a tap in the top, middle or bottom third selects on, armed or reset_test', () => {
    const { states } = toggle('sw.elt');
    const pick = (f: number) => stateAtFraction(states, f).id;
    expect([0, 0.1, 0.33].map(pick)).toEqual(['on', 'on', 'on']);
    expect([0.34, 0.5, 0.66].map(pick)).toEqual(['armed', 'armed', 'armed']);
    expect([0.67, 0.9, 1].map(pick)).toEqual(['reset_test', 'reset_test', 'reset_test']);
  });

  it('a tap outside the rectangle still lands on one of the three declared states', () => {
    const { states } = toggle('sw.elt');
    const ids = states.map((st) => st.id);
    for (const f of [-5, -0.01, 1.01, 7, Number.NaN]) {
      expect(ids).toContain(stateAtFraction(states, f).id);
    }
  });

  it('a two-state toggle ignores the position and flips on any tap', () => {
    const { states } = toggle('sw.engine_master');
    expect([0.1, 0.9].map((f) => tapTarget(states, 'on', f))).toEqual(['off', 'off']);
    expect([0.1, 0.9].map((f) => tapTarget(states, 'off', f))).toEqual(['on', 'on']);
  });

  it('a three-state tap on the active position targets that same state (no event)', () => {
    const { states } = toggle('sw.elt');
    expect(tapTarget(states, 'armed', 0.5)).toBe('armed');
    expect(tapTarget(states, 'armed', 0.1)).toBe('on');
    expect(tapTarget(states, 'on', 0.5)).toBe('armed');
  });

  it('the ELT rocker draws level in the middle position and the same text everywhere', () => {
    const def = toggle('sw.elt');
    const mid = expand(RockerBody({ def, position: 'mid', pressed: false }));
    expect(findElements(mid, (el) => 'data-rocker-wall' in el.props)).toHaveLength(2);
    for (const position of ['low', 'mid', 'high'] as const) {
      const tree = expand(RockerBody({ def, position, pressed: false }));
      expect(findElements(tree, (el) => el.tag === 'text').map((el) => textOf(el))).toEqual([
        'ELT',
      ]);
    }
  });
});

const BATS = TOGGLES.filter((t) => (t.skin ?? 'bat') === 'bat');

describe('BatBody', () => {
  it('covers the seven bats named by the plan, ENGINE MASTER and the de-ice mode toggle', () => {
    expect(BATS.map((b) => b.id).sort()).toEqual([
      'sw.alternator_1',
      'sw.alternator_2',
      'sw.deice_ice_light',
      'sw.deice_mode',
      'sw.deice_pump',
      'sw.engine_master',
      'sw.fadec',
    ]);
  });

  it('stays within 40 nodes with only the name as text and no status dot, in every position', () => {
    for (const def of BATS) {
      for (const position of ['low', 'mid', 'high'] as const) {
        for (const pressed of [false, true]) {
          const tree = expand(BatBody({ def, position, pressed }));
          const id = `${def.id}/${position}/${String(pressed)}`;
          expect(countElements(tree), id).toBeLessThanOrEqual(40);
          expect(stateTexts(tree), id).toHaveLength(0);
          const texts = findElements(tree, (el) => el.tag === 'text');
          expect(
            texts.map((t) => textOf(t)),
            id,
          ).toEqual(def.nameless === true ? [] : [def.label]);
          expect(allProps(tree), id).not.toContain('#39d98a');
        }
      }
    }
  });

  it('points the handle down for low, up for high and shows a stub with a ball tip for mid', () => {
    const def = toggle('sw.alternator_1');
    const tipOf = (position: 'low' | 'mid' | 'high') => {
      const tree = expand(BatBody({ def, position, pressed: false }));
      const cap = findElements(tree, (el) => el.tag === 'circle' && 'cy' in el.props).pop();
      const pivot = findElements(tree, (el) => el.tag === 'circle' && 'cy' in el.props)[0];
      return { tip: Number(cap?.props['cy']), pivot: Number(pivot?.props['cy']), tree };
    };
    const low = tipOf('low');
    const high = tipOf('high');
    const mid = tipOf('mid');
    expect(low.tip).toBeGreaterThan(low.pivot);
    expect(high.tip).toBeLessThan(high.pivot);
    expect(mid.tip).toBe(mid.pivot);
    expect(findElements(mid.tree, (el) => el.tag === 'polygon')).toHaveLength(0);
    const cap = findElements(mid.tree, (el) => el.tag === 'circle').pop();
    expect(Number(cap?.props['r'])).toBeGreaterThanOrEqual(3);
  });

  it('paints the bat with the shared chrome gradient and adds a ball tip only where asked', () => {
    for (const def of BATS) {
      const tree = expand(BatBody({ def, position: 'high', pressed: false }));
      expect(allProps(tree), def.id).toContain('url(#g-chrome)');
      const balls = findElements(tree, (el) => el.tag === 'circle' && el.props['r'] === 3.2);
      expect(balls.length, def.id).toBe(def.ball === true ? 1 : 0);
    }
  });

  it('uses the pressed ring only while a pointer is down', () => {
    for (const def of BATS) {
      const idle = expand(BatBody({ def, position: 'low', pressed: false }));
      const held = expand(BatBody({ def, position: 'low', pressed: true }));
      expect(allProps(idle), def.id).not.toContain(PRESSED_RING);
      expect(allProps(held), def.id).toContain(PRESSED_RING);
    }
  });

  it('no compact bat remains: every bat is at least 39 tall and the variant is gone', () => {
    for (const def of BATS) expect(def.hit.h, def.id).toBeGreaterThanOrEqual(39);
    expect(readFileSync('src/ui/panel/skins/Bat.tsx', 'utf8')).not.toMatch(/compact/i);
    // A named bat prints its name in Micro 8 inside the footprint, never in 6 above it.
    const named = BATS.filter((b) => b.nameless !== true);
    expect(named.length).toBeGreaterThan(0);
    for (const def of named) {
      const tree = expand(BatBody({ def, position: 'high', pressed: false }));
      const label = findElements(tree, (el) => el.tag === 'text')[0];
      expect(label?.props['font-size'], def.id).toBe(8);
      expect(Number(label?.props['y']), def.id).toBeGreaterThan(-def.hit.h / 2);
    }
  });
});

describe('de-ice PUMP toggle (plan 22, G-1)', () => {
  const pump = toggle('sw.deice_pump');

  it('is a nameless two-position bat: down PUMP 1, up PUMP 2, default PUMP 1', () => {
    expect(pump.states.map((st) => st.id)).toEqual(['pump1', 'pump2']);
    expect(pump.default).toBe('pump1');
    expect(pump.skin ?? 'bat').toBe('bat');
    expect(pump.nameless).toBe(true);
    expect(pump.hit).toEqual({ w: 30, h: 69 });
    expect(pump.region).toBe('deice_switches');
    for (const id of ['sw.deice_pump1', 'sw.deice_pump2', 'sw.deice_windshield']) {
      expect(DA50RG.get(id), id).toBeUndefined();
    }
  });

  it('flips on any tap and draws no text in either position', () => {
    expect(tapTarget(pump.states, 'pump1', 0.1)).toBe('pump2');
    expect(tapTarget(pump.states, 'pump2', 0.9)).toBe('pump1');
    for (const position of ['low', 'high'] as const) {
      const tree = expand(BatBody({ def: pump, position, pressed: false }));
      expect(findElements(tree, (el) => el.tag === 'text')).toEqual([]);
    }
  });
});

describe('de-ice mode toggle (plan 21, G-1)', () => {
  const mode = toggle('sw.deice_mode');

  it('is a nameless three-position bat: bottom OFF, middle NORM, top HIGH, default OFF', () => {
    expect(mode.states.map((st) => st.id)).toEqual(['off', 'norm', 'high']);
    expect(mode.default).toBe('off');
    expect(mode.skin ?? 'bat').toBe('bat');
    expect(mode.nameless).toBe(true);
    expect(mode.hit).toEqual({ w: 40, h: 90 });
    expect(mode.region).toBe('deice');
  });

  it('the old four-stop lever is gone', () => {
    expect(DA50RG.get('lv.deice_mode')).toBeUndefined();
  });

  it('a tap in the top, middle and bottom third selects HIGH, NORM and OFF', () => {
    expect(tapTarget(mode.states, 'off', 0.1)).toBe('high');
    expect(tapTarget(mode.states, 'high', 0.5)).toBe('norm');
    expect(tapTarget(mode.states, 'norm', 0.9)).toBe('off');
  });

  it('draws no text at all, and a named copy draws its name', () => {
    for (const position of ['low', 'mid', 'high'] as const) {
      const bare = expand(BatBody({ def: mode, position, pressed: false }));
      expect(findElements(bare, (el) => el.tag === 'text')).toEqual([]);
      const named = expand(
        BatBody({ def: { ...mode, nameless: false }, position, pressed: false }),
      );
      expect(findElements(named, (el) => el.tag === 'text').map((el) => textOf(el))).toEqual([
        mode.label,
      ]);
    }
  });
});

describe('de-ice ICE LIGHT / ANNUN-TEST toggle (plan 22, G-1)', () => {
  const sw = toggle('sw.deice_ice_light');

  it('is a nameless three-position bat: bottom ANNUN-TEST, middle OFF, top ICE LIGHT, default OFF', () => {
    expect(sw.states.map((st) => st.id)).toEqual(['annun_test', 'off', 'ice_light']);
    expect(sw.default).toBe('off');
    expect(sw.skin ?? 'bat').toBe('bat');
    expect(sw.nameless).toBe(true);
    expect(sw.hit).toEqual({ w: 30, h: 69 });
    expect(sw.region).toBe('deice_switches');
    expect(DA50RG.get('btn.deice_annun_test')).toBeUndefined();
  });

  it('a tap in the top, middle and bottom third selects ICE LIGHT, OFF and ANNUN-TEST', () => {
    expect(tapTarget(sw.states, 'off', 0.1)).toBe('ice_light');
    expect(tapTarget(sw.states, 'ice_light', 0.5)).toBe('off');
    expect(tapTarget(sw.states, 'off', 0.9)).toBe('annun_test');
    // Each third of the 69-high hit is 23 units, enough for 44 px in a pinch-in view.
    expect(sw.hit.h / 3).toBe(23);
  });

  it('throws the handle as far as the taller mode toggle: the throw does not depend on the footprint', () => {
    const tipDistance = (def: ToggleDef) => {
      const circles = findElements(
        expand(BatBody({ def, position: 'high', pressed: false })),
        (el) => el.tag === 'circle' && 'cy' in el.props,
      );
      return Number(circles[0]?.props['cy']) - Number(circles[circles.length - 1]?.props['cy']);
    };
    expect(tipDistance(sw)).toBe(BAT_THROW);
    expect(tipDistance(toggle('sw.deice_mode'))).toBe(BAT_THROW);
    // The handle and its cap lie inside the 69-high footprint in both end positions.
    for (const position of ['low', 'high'] as const) {
      const tree = expand(BatBody({ def: sw, position, pressed: false }));
      const cap = findElements(tree, (el) => el.tag === 'circle').pop();
      const cy = Number(cap?.props['cy']);
      expect(Math.abs(cy) + Number(cap?.props['r'])).toBeLessThan(sw.hit.h / 2);
    }
  });

  it('draws three distinct handle positions and no text', () => {
    const tips = (['low', 'mid', 'high'] as const).map((position) => {
      const tree = expand(BatBody({ def: sw, position, pressed: false }));
      expect(findElements(tree, (el) => el.tag === 'text')).toEqual([]);
      return Number(findElements(tree, (el) => el.tag === 'circle').pop()?.props['cy']);
    });
    expect(new Set(tips).size).toBe(3);
    expect(tips[0] ?? 0).toBeGreaterThan(tips[1] ?? 0);
    expect(tips[1] ?? 0).toBeGreaterThan(tips[2] ?? 0);
  });
});

describe('guarded ALTERNATE (plan 22, G-1, D-08 amended)', () => {
  const alt = DA50RG.controls.find((c) => c.id === 'sw.deice_alternate');
  if (alt?.kind !== 'guarded-toggle') throw new Error('no ALTERNATE');

  it('is a nameless guarded toggle: states on then off, off (the up position) by default', () => {
    expect(alt.states.map((st) => st.id)).toEqual(['on', 'off']);
    expect(alt.default).toBe('off');
    expect(alt.nameless).toBe(true);
    expect(alt.hit).toEqual({ w: 52, h: 100 });
    expect(alt.guardOpenHit).toEqual({ x: -26, y: -82, w: 52, h: 32 });
    expect(alt.region).toBe('deice');
  });

  it('draws the bat toggle: the up handle for off, the down handle for on, no text', () => {
    // GuardedToggle passes position high for the second state (off) and low for the first (on).
    const tipOf = (position: 'low' | 'high') => {
      const circles = findElements(
        expand(BatBody({ def: alt, position, pressed: false })),
        (el) => el.tag === 'circle' && 'cy' in el.props,
      );
      return Number(circles[circles.length - 1]?.props['cy']) - Number(circles[0]?.props['cy']);
    };
    expect(tipOf('high')).toBe(-BAT_THROW);
    expect(tipOf('low')).toBe(BAT_THROW);
    for (const position of ['low', 'high'] as const) {
      const tree = expand(BatBody({ def: alt, position, pressed: false }));
      expect(findElements(tree, (el) => el.tag === 'text')).toEqual([]);
      expect(allProps(tree)).not.toContain('#c43030');
    }
  });

  it('the widget source picks the bat when size and colour are absent', () => {
    const src = readFileSync('src/ui/panel/widgets/GuardedToggle.tsx', 'utf8');
    expect(src).toContain('BatBody');
    expect(src).toMatch(/def\.size !== undefined/);
  });

  it('bat plus cover stay within 40 nodes, closed and open, and use the shared hatch', () => {
    for (const guardOpen of [false, true]) {
      const bat = expand(BatBody({ def: alt, position: 'low', pressed: false }));
      const cover = expand(GuardCover({ def: alt, guardOpen }));
      const id = guardOpen ? 'open' : 'closed';
      expect(countElements(bat) + countElements(cover), id).toBeLessThanOrEqual(40);
      expect(allProps(cover), id).toContain('url(#p-hatch)');
      expect(
        findElements(cover, (el) => el.tag === 'pattern' || el.tag === 'defs'),
        id,
      ).toEqual([]);
      expect(
        findElements(cover, (el) => el.tag === 'text'),
        id,
      ).toHaveLength(0);
      expect(textOf(cover), id).toBe('');
    }
  });

  it('the closed cover is a red translucent block over the footprint, the only red of the unit', () => {
    const cover = expand(GuardCover({ def: alt, guardOpen: false }));
    const block = findElements(
      cover,
      (el) => el.tag === 'rect' && el.props['fill'] === '#c43030',
    )[0];
    expect(block).toBeDefined();
    expect(block?.props['fill-opacity']).toBe(0.35);
    const x = Number(block?.props['x']);
    const y = Number(block?.props['y']);
    const w = Number(block?.props['width']);
    const h = Number(block?.props['height']);
    // Over the footprint (inset 2), not larger than it.
    expect([x, y, w, h]).toEqual([-24, -48, 48, 96]);
    expect(findElements(cover, (el) => el.props['fill'] === 'url(#p-hatch)')).toHaveLength(3);
  });

  it('the open cover is a flap above the footprint with its hinge at the footprint top', () => {
    const cover = expand(GuardCover({ def: alt, guardOpen: true }));
    const flap = findElements(
      cover,
      (el) => el.tag === 'rect' && el.props['fill'] === '#c43030',
    )[0];
    expect(Number(flap?.props['y']) + Number(flap?.props['height'])).toBeLessThanOrEqual(
      -alt.hit.h / 2,
    );
    const hinge = findElements(cover, (el) => el.tag === 'line')[0];
    expect(Number(hinge?.props['y1'])).toBe(-alt.hit.h / 2);
    // Global y 214 to 246: the flap of Table J1.
    const region = DA50RG.regions.find((r) => r.id === alt.region);
    const top = (region?.bounds.y ?? 0) + alt.y + alt.guardOpenHit.y;
    expect([top, top + alt.guardOpenHit.h]).toEqual([214, 246]);
  });
});

describe('softkey selected state', () => {
  it('keeps the legend ENGINE and the state labels on the definition only', () => {
    const def = toggle('sw.mfd_page');
    expect(def.label).toBe('ENGINE');
    expect(def.states.map((st) => [st.id, st.label])).toEqual([
      ['map', 'NOT SELECTED'],
      ['engine', 'SELECTED'],
    ]);
    expect(def.default).toBe('map');
    // The key prints no word in either state: the legend stands on the glass (D-04, G-0.2).
    for (const isSecond of [false, true]) {
      const tree = expand(SoftkeyBody({ isSecond, pressed: false }));
      expect(stateTexts(tree)).toHaveLength(0);
      expect(findElements(tree, (el) => el.tag === 'text')).toHaveLength(0);
    }
  });

  it('draws the 30 x 20 key (rx 3) with an up-triangle and the key body as its first rect', () => {
    const tree = expand(SoftkeyBody({ isSecond: false, pressed: false }));
    const rects = findElements(tree, (el) => el.tag === 'rect');
    expect(rects[0]?.props['width']).toBe(30);
    expect(rects[0]?.props['height']).toBe(20);
    expect(rects[0]?.props['rx']).toBe(3);
    expect(rects[0]?.props['x']).toBe(-15);
    expect(rects[0]?.props['y']).toBe(-10);
    const tri = findElements(tree, (el) => el.tag === 'path' && el.props['fill'] === '#e6e9ed');
    expect(tri).toHaveLength(1);
    expect(String(tri[0]?.props['d'])).toMatch(/^M/);
  });

  it('uses a 2.5-unit #e6e9ed stroke when selected and never the blue ring', () => {
    const selected = expand(SoftkeyBody({ isSecond: true, pressed: false }));
    const rect = findElements(selected, (el) => el.tag === 'rect')[0];
    expect(rect?.props['stroke']).toBe('#e6e9ed');
    expect(rect?.props['stroke-width']).toBe(2.5);
    expect(allProps(selected)).not.toContain('#5ab0ff');
    const idle = expand(SoftkeyBody({ isSecond: false, pressed: false }));
    expect(findElements(idle, (el) => el.tag === 'rect')[0]?.props['stroke-width']).toBe(1);
  });

  it('keeps the hit rectangle of the control at 36 x 36', () => {
    const def = toggle('sw.mfd_page');
    expect(def.hit).toEqual({ w: 36, h: 36 });
  });
});

describe('toggle-family sources', () => {
  const FILES = [
    'src/ui/panel/widgets/Toggle.tsx',
    'src/ui/panel/widgets/GuardedToggle.tsx',
    'src/ui/panel/skins/Rocker.tsx',
    'src/ui/panel/skins/Bat.tsx',
  ];

  it('use only the font sizes 6, 8, 10 and 14', () => {
    for (const file of FILES) {
      const src = readFileSync(file, 'utf8');
      const sizes = [...src.matchAll(/font-size=\{([^}]+)\}/g)].flatMap((m) =>
        [...(m[1] ?? '').matchAll(/\d+/g)].map((n) => Number(n[0])),
      );
      for (const size of sizes) expect([6, 8, 10, 14], `${file} ${size}`).toContain(size);
    }
  });

  it('define no gradient or pattern of their own and Toggle no longer exports SwitchBody', () => {
    for (const file of FILES) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/<(pattern|linearGradient|radialGradient)/);
    }
    expect(readFileSync(FILES[0] as string, 'utf8')).not.toContain('export function SwitchBody');
  });
});

describe('makeTogglePress (plan 37, R3-Z2): what a tap on a toggle does', () => {
  /** A hit element stand-in: only its box is read, thirds measured from the top. */
  const hitBox = { top: 100, height: 90 };
  const hit = { getBoundingClientRect: () => hitBox } as unknown as Element;
  const infoAt = (y: number): PressInfo => ({
    down: { x: 10, y },
    up: { x: 11, y: y + 1 },
    hit,
  });

  function rig(id: string, current: string, seq = 7) {
    const actuated: [string, string][] = [];
    let pendingCalls = 0;
    const target = makeTogglePress({
      def: toggle(id),
      stateOf: () => current,
      actuate: (cid, value): DispatchResult => {
        actuated.push([cid, value]);
        return { ok: true, event: { seq, t: 0, id: cid, value, source: 'user' } };
      },
      setPending: () => {
        pendingCalls += 1;
      },
    });
    return { target, actuated, pendingCalls: () => pendingCalls };
  }

  it('is a latch target', () => {
    expect(rig('sw.engine_master', 'on').target.cls).toBe('latch');
  });

  it('a two-state toggle flips on a tap, wherever the tap lands', () => {
    for (const y of [102, 145, 188]) {
      const r = rig('sw.engine_master', 'on');
      expect(r.target.tap?.(infoAt(y))).toBe(7);
      expect(r.actuated).toEqual([['sw.engine_master', 'off']]);
    }
    const back = rig('sw.engine_master', 'off');
    back.target.tap?.(infoAt(145));
    expect(back.actuated).toEqual([['sw.engine_master', 'on']]);
  });

  it('a three-state toggle goes to the top, middle or bottom third of the down point', () => {
    // The ELT is armed; its states run reset_test, armed, on from bottom to top.
    const cases: [number, string | null][] = [
      [110, 'on'],
      [128, 'on'],
      [145, null],
      [170, 'reset_test'],
      [188, 'reset_test'],
    ];
    for (const [y, expected] of cases) {
      const r = rig('sw.elt', 'armed');
      const seq = r.target.tap?.(infoAt(y));
      if (expected === null) {
        expect(seq, `y ${y}`).toBeNull();
        expect(r.actuated, `y ${y}`).toEqual([]);
      } else {
        expect(seq, `y ${y}`).toBe(7);
        expect(r.actuated, `y ${y}`).toEqual([['sw.elt', expected]]);
      }
    }
  });

  it('measures the thirds at the down point, not at the up point', () => {
    const r = rig('sw.elt', 'armed');
    r.target.tap?.({ down: { x: 10, y: 110 }, up: { x: 12, y: 186 }, hit });
    expect(r.actuated).toEqual([['sw.elt', 'on']]);
  });

  it('returns the sequence number of the dispatch, and null for a rejected one', () => {
    const r = rig('sw.engine_master', 'on', 41);
    expect(r.target.tap?.(infoAt(145))).toBe(41);
    const rejected = makeTogglePress({
      def: toggle('sw.engine_master'),
      stateOf: () => 'on',
      actuate: (): DispatchResult => ({ ok: false, reason: 'unchanged' }),
      setPending: () => undefined,
    });
    expect(rejected.tap?.(infoAt(145))).toBeNull();
  });

  it('never drives the pressed visual itself: the gesture layer calls setPending', () => {
    const r = rig('sw.engine_master', 'on');
    r.target.tap?.(infoAt(145));
    expect(r.pendingCalls()).toBe(0);
    r.target.setPending?.(true);
    expect(r.pendingCalls()).toBe(1);
  });

  it('a zero height box measures the middle', () => {
    const flat = { getBoundingClientRect: () => ({ top: 0, height: 0 }) } as unknown as Element;
    const r = rig('sw.elt', 'on');
    r.target.tap?.({ down: { x: 0, y: 0 }, up: { x: 0, y: 0 }, hit: flat });
    expect(r.actuated).toEqual([['sw.elt', 'armed']]);
  });

  it('the widget source holds no pointer handler, no capture and no slop of its own', () => {
    const src = readFileSync('src/ui/panel/widgets/Toggle.tsx', 'utf8');
    expect(src).not.toContain('onPointerDown');
    expect(src).not.toContain('setPointerCapture');
    expect(src).not.toContain('TAP_SLOP_PX');
    expect(src).toContain('registerPressTarget');
  });
});
