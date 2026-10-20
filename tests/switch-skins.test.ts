import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { ROCKER_COLOURS, ROCKER_SIZES } from '../src/engine/registry';
import type { ControlDef, GuardedToggleDef, ToggleDef } from '../src/engine/registry';
import { BatBody, COMPACT_BAT_HEIGHT } from '../src/ui/panel/skins/Bat';
import { ROCKER_FACE, RockerBody, rockerExtent } from '../src/ui/panel/skins/Rocker';
import { GuardCover } from '../src/ui/panel/widgets/GuardedToggle';
import { SoftkeyBody } from '../src/ui/panel/widgets/Toggle';
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
  const states = [
    { id: 'off', label: 'OFF' },
    { id: 'on', label: 'ON' },
  ] as const;

  it('stays within 40 nodes with one state text equal to the label, in every size and colour', () => {
    for (const size of ROCKER_SIZES) {
      for (const colour of ROCKER_COLOURS) {
        for (const isSecond of [false, true]) {
          for (const pressed of [false, true]) {
            const label = isSecond ? 'ON' : 'OFF';
            const def = { label: 'TEST', hit: { w: 66, h: 70 }, states, size, colour };
            const tree = expand(RockerBody({ def, isSecond, pressed, stateLabel: label }));
            const id = `${size}/${colour}/${String(isSecond)}/${String(pressed)}`;
            expect(countElements(tree), id).toBeLessThanOrEqual(40);
            const texts = stateTexts(tree);
            expect(texts, id).toHaveLength(1);
            expect(textOf(texts[0] as El), id).toBe(label);
          }
        }
      }
    }
  });

  it('uses the pressed ring only while a pointer is down', () => {
    for (const size of ROCKER_SIZES) {
      const def = {
        label: 'TEST',
        hit: { w: 66, h: 70 },
        states,
        size,
        colour: 'white' as const,
      };
      const idle = expand(RockerBody({ def, isSecond: true, pressed: false, stateLabel: 'ON' }));
      const held = expand(RockerBody({ def, isSecond: true, pressed: true, stateLabel: 'ON' }));
      expect(allProps(idle), size).not.toContain(PRESSED_RING);
      expect(allProps(held), size).toContain(PRESSED_RING);
    }
  });

  it('swaps the half tones with the state: second state presses the upper half', () => {
    const def = { label: 'T', hit: { w: 66, h: 70 }, states, size: 'M', colour: 'white' } as const;
    const paths = (isSecond: boolean) =>
      findElements(
        expand(RockerBody({ def, isSecond, pressed: false, stateLabel: 'X' })),
        (el) => el.tag === 'path',
      ).map((p) => p.props['fill']);
    expect(paths(true)).toEqual(['#c7c6bd', '#f1f0e8']);
    expect(paths(false)).toEqual(['#f1f0e8', '#c7c6bd']);
  });

  it('names the end states on the face: second above, first below', () => {
    const def = { label: 'T', hit: { w: 50, h: 70 }, states, size: 'S', colour: 'red' } as const;
    const tree = expand(RockerBody({ def, isSecond: false, pressed: false, stateLabel: 'OFF' }));
    const micro = findElements(tree, (el) => el.tag === 'text' && el.props['font-size'] === 6);
    expect(micro.map((t) => textOf(t))).toEqual(['ON', 'OFF']);
    const ys = micro.map((t) => Number(t.props['y']));
    expect(ys[0]).toBeLessThan(ys[1] as number);
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

  it('the four light rockers use state text size 8 and keep ON as the second state', () => {
    for (const id of [
      'sw.light_landing',
      'sw.light_taxi',
      'sw.light_position',
      'sw.light_strobe',
    ]) {
      const def = toggle(id);
      expect(def.states[1].id, id).toBe('on');
      const tree = expand(
        RockerBody({ def, isSecond: true, pressed: false, stateLabel: def.states[1].label }),
      );
      const text = stateTexts(tree)[0];
      expect(text?.props['font-size'], id).toBe(8);
    }
  });
});

const BATS = TOGGLES.filter((t) => (t.skin ?? 'bat') === 'bat');

describe('BatBody', () => {
  it('covers the seven bats named by the plan plus ENGINE MASTER', () => {
    expect(BATS.map((b) => b.id).sort()).toEqual([
      'sw.alternator_1',
      'sw.alternator_2',
      'sw.deice_ice_light',
      'sw.deice_pump1',
      'sw.deice_pump2',
      'sw.deice_windshield',
      'sw.engine_master',
      'sw.fadec',
    ]);
  });

  it('stays within 40 nodes with one state text equal to the label, in both states', () => {
    for (const def of BATS) {
      for (const isSecond of [false, true]) {
        for (const pressed of [false, true]) {
          const label = (isSecond ? def.states[1] : def.states[0]).label;
          const tree = expand(BatBody({ def, isSecond, pressed, stateLabel: label }));
          const id = `${def.id}/${String(isSecond)}/${String(pressed)}`;
          expect(countElements(tree), id).toBeLessThanOrEqual(40);
          const texts = stateTexts(tree);
          expect(texts, id).toHaveLength(1);
          expect(textOf(texts[0] as El), id).toBe(label);
        }
      }
    }
  });

  it('paints the bat with the shared chrome gradient and adds a ball tip only where asked', () => {
    for (const def of BATS) {
      const tree = expand(BatBody({ def, isSecond: true, pressed: false, stateLabel: 'ON' }));
      expect(allProps(tree), def.id).toContain('url(#g-chrome)');
      const balls = findElements(tree, (el) => el.tag === 'circle' && el.props['r'] === 3.2);
      expect(balls.length, def.id).toBe(def.ball === true ? 1 : 0);
    }
  });

  it('uses the pressed ring only while a pointer is down', () => {
    for (const def of BATS) {
      const idle = expand(BatBody({ def, isSecond: false, pressed: false, stateLabel: 'X' }));
      const held = expand(BatBody({ def, isSecond: false, pressed: true, stateLabel: 'X' }));
      expect(allProps(idle), def.id).not.toContain(PRESSED_RING);
      expect(allProps(held), def.id).toContain(PRESSED_RING);
    }
  });

  it('the de-ice bats, under 39 tall, use the compact variant: 6 label above, 8 state text', () => {
    const compact = BATS.filter((b) => b.hit.h < COMPACT_BAT_HEIGHT);
    expect(compact.map((b) => b.id).sort()).toEqual([
      'sw.deice_ice_light',
      'sw.deice_pump1',
      'sw.deice_pump2',
      'sw.deice_windshield',
    ]);
    for (const def of compact) {
      const tree = expand(BatBody({ def, isSecond: true, pressed: false, stateLabel: 'ON' }));
      const label = findElements(tree, (el) => el.tag === 'text' && textOf(el) === def.label)[0];
      expect(label?.props['font-size'], def.id).toBe(6);
      expect(Number(label?.props['y']), def.id).toBeLessThan(-def.hit.h / 2);
      expect(stateTexts(tree)[0]?.props['font-size'], def.id).toBe(8);
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
      const rocker = expand(
        RockerBody({ def: alt, isSecond: false, pressed: false, stateLabel: 'OFF' }),
      );
      const cover = expand(
        GuardCover({ def: alt, guardOpen, guardLabel: guardOpen ? 'OPEN' : 'CLOSED' }),
      );
      const id = guardOpen ? 'open' : 'closed';
      expect(countElements(rocker) + countElements(cover), id).toBeLessThanOrEqual(40);
      expect(allProps(cover), id).toContain('url(#p-hatch)');
      expect(
        findElements(cover, (el) => el.tag === 'pattern' || el.tag === 'defs'),
        id,
      ).toEqual([]);
      expect(textOf(cover), id).toContain('GUARD');
      const stateText = stateTexts(cover);
      expect(stateText, id).toHaveLength(1);
      expect(textOf(stateText[0] as El), id).toBe(guardOpen ? 'OPEN' : 'CLOSED');
    }
  });
});

describe('softkey selected state', () => {
  it('uses a 2.5-unit #e6e9ed stroke and never the blue ring', () => {
    const def = toggle('sw.mfd_page');
    const selected = expand(
      SoftkeyBody({
        def,
        labelWidth: 20,
        isSecond: true,
        pressed: false,
        stateLabel: def.states[1].label,
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
        stateLabel: def.states[0].label,
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
      const sizes = [...src.matchAll(/font-size=\{(\d+)\}/g)].map((m) => Number(m[1]));
      expect(sizes.length, file).toBeGreaterThan(0);
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
