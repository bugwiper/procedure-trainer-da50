import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { ROCKER_COLOURS, ROCKER_SIZES } from '../src/engine/registry';
import type { ControlDef, GuardedToggleDef, ToggleDef } from '../src/engine/registry';
import { ROCKER_FACE, RockerBody, rockerExtent } from '../src/ui/panel/skins/Rocker';
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
