import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { ROCKER_COLOURS, ROCKER_SIZES } from '../src/engine/registry';
import type { ControlDef, GuardedToggleDef, ToggleDef } from '../src/engine/registry';
import { BatBody, COMPACT_BAT_HEIGHT } from '../src/ui/panel/skins/Bat';
import { ROCKER_FACE, ROCKER_LIFT, RockerBody, rockerExtent } from '../src/ui/panel/skins/Rocker';
import { GuardCover } from '../src/ui/panel/widgets/GuardedToggle';
import {
  SoftkeyBody,
  pressedHalfOf,
  stateAtFraction,
  tapTarget,
  togglePosition,
} from '../src/ui/panel/widgets/Toggle';
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

  it('red switch parts are exactly ELECT. MASTER, ELT and the de-ice ALTERNATE', () => {
    const red = ROCKERS.filter((t) => t.colour === 'red').map((t) => t.id);
    expect(red.sort()).toEqual(['sw.deice_alternate', 'sw.elect_master', 'sw.elt']);
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
      'sw.deice_pump1',
      'sw.deice_pump2',
      'sw.deice_windshield',
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

  it('the de-ice bats, under 39 tall, use the compact variant: name in 6 above the footprint', () => {
    const compact = BATS.filter((b) => b.hit.h < COMPACT_BAT_HEIGHT);
    expect(compact.map((b) => b.id).sort()).toEqual([
      'sw.deice_ice_light',
      'sw.deice_pump1',
      'sw.deice_pump2',
      'sw.deice_windshield',
    ]);
    for (const def of compact) {
      const tree = expand(BatBody({ def, position: 'high', pressed: false }));
      const label = findElements(tree, (el) => el.tag === 'text' && textOf(el) === def.label)[0];
      expect(label?.props['font-size'], def.id).toBe(6);
      expect(Number(label?.props['y']), def.id).toBeLessThan(-def.hit.h / 2);
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

describe('guarded ALTERNATE', () => {
  const alt = DA50RG.controls.find((c) => c.id === 'sw.deice_alternate');

  it('is a red size M rocker under the cover', () => {
    expect(alt?.kind).toBe('guarded-toggle');
    if (alt?.kind !== 'guarded-toggle') return;
    expect([alt.size, alt.colour]).toEqual(['M', 'red']);
  });

  it('rocker plus cover stay within 40 nodes, closed and open, and use the shared hatch', () => {
    if (alt?.kind !== 'guarded-toggle') throw new Error('no ALTERNATE');
    for (const guardOpen of [false, true]) {
      const rocker = expand(RockerBody({ def: alt, position: 'low', pressed: false }));
      const cover = expand(GuardCover({ def: alt, guardOpen }));
      const id = guardOpen ? 'open' : 'closed';
      expect(countElements(rocker) + countElements(cover), id).toBeLessThanOrEqual(40);
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
});

describe('softkey selected state', () => {
  it('has the legend ENGINE and the state labels NOT SELECTED and SELECTED', () => {
    const def = toggle('sw.mfd_page');
    expect(def.label).toBe('ENGINE');
    expect(def.states.map((st) => [st.id, st.label])).toEqual([
      ['map', 'NOT SELECTED'],
      ['engine', 'SELECTED'],
    ]);
    expect(def.default).toBe('map');
    const tree = expand(SoftkeyBody({ def, labelWidth: 20, isSecond: true, pressed: false }));
    expect(stateTexts(tree)).toHaveLength(0);
    expect(findElements(tree, (el) => el.tag === 'text').map((t) => textOf(t))).toEqual(['ENGINE']);
  });

  it('uses a 2.5-unit #e6e9ed stroke and never the blue ring', () => {
    const def = toggle('sw.mfd_page');
    const selected = expand(
      SoftkeyBody({
        def,
        labelWidth: 20,
        isSecond: true,
        pressed: false,
      }),
    );
    const rect = findElements(selected, (el) => el.tag === 'rect')[0];
    expect(rect?.props['stroke']).toBe('#e6e9ed');
    expect(rect?.props['stroke-width']).toBe(2.5);
    expect(allProps(selected)).not.toContain('#5ab0ff');
    const idle = expand(
      SoftkeyBody({
        def,
        labelWidth: 20,
        isSecond: false,
        pressed: false,
      }),
    );
    expect(findElements(idle, (el) => el.tag === 'rect')[0]?.props['stroke-width']).toBe(1);
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
