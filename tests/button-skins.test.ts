import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import type { MomentaryButtonDef, Rect } from '../src/engine/registry';
import {
  BEZEL_RADIUS,
  PRESSED_RING,
  PushButtonBody,
  buttonTextLayout,
  textWidth,
} from '../src/ui/panel/skins/PushButton';
import type { PressedSide } from '../src/ui/panel/skins/PushButton';
import { countElements, expand, findElements, textOf } from './vnode-walk';
import type { El, Tree } from './vnode-walk';

// Push-button skins (PNL-11, D-09, UI-SPEC 8.3). Pure geometry and vnode checks, no DOM.

const BUTTONS = DA50RG.controls.filter(
  (c): c is MomentaryButtonDef => c.kind === 'momentary-button',
);

function regionOf(id: string): Rect {
  const region = DA50RG.regions.find((r) => r.id === id);
  if (region === undefined) throw new Error(`unknown region ${id}`);
  return region.bounds;
}

/** Every state of a button with the side the widget would pass for it. */
function renders(def: MomentaryButtonDef): { state: string; side: PressedSide; label: string }[] {
  return def.states.map((st, i) => ({
    state: st.id,
    label: st.label,
    side: def.states.length === 3 ? (i === 1 ? 'left' : i === 2 ? 'right' : null) : null,
  }));
}

function body(def: MomentaryButtonDef, state: string, side: PressedSide): El {
  return expand(PushButtonBody({ def, state, pressedSide: side }));
}

function allProps(tree: Tree): unknown[] {
  return findElements(tree, () => true).flatMap((el) => Object.values(el.props));
}

describe('momentary button inventory', () => {
  it('has five buttons, each with a skin', () => {
    expect(BUTTONS.map((b) => b.id).sort()).toEqual([
      'btn.deice_annun_test',
      'btn.engine_start',
      'btn.fadec_test',
      'btn.level',
      'btn.stall_gear_test',
    ]);
    for (const b of BUTTONS) expect(b.skin, b.id).toBeDefined();
  });

  it('exactly one button has three states and it is the spring bat', () => {
    const three = BUTTONS.filter((b) => b.states.length === 3);
    expect(three.map((b) => b.id)).toEqual(['btn.stall_gear_test']);
    expect(three[0]?.skin).toBe('spring-bat');
  });

  it('assigns the skins of Table B1', () => {
    const skins = Object.fromEntries(BUTTONS.map((b) => [b.id, b.skin]));
    expect(skins).toEqual({
      'btn.engine_start': 'chrome-round',
      'btn.fadec_test': 'small-black',
      'btn.deice_annun_test': 'small-black',
      'btn.level': 'blue-dome',
      'btn.stall_gear_test': 'spring-bat',
    });
  });
});

describe('push-button bodies', () => {
  it('stay within 40 nodes and show exactly one state text equal to the state label', () => {
    for (const def of BUTTONS) {
      for (const { state, side, label } of renders(def)) {
        const tree = body(def, state, side);
        const id = `${def.id}/${state}`;
        expect(countElements(tree), id).toBeLessThanOrEqual(40);
        const texts = findElements(tree, (el) => 'data-state-text' in el.props);
        expect(texts, id).toHaveLength(1);
        expect(texts[0] === undefined ? '' : textOf(texts[0]), id).toBe(label);
      }
    }
  });

  it('draw the pressed ring only while pressed', () => {
    for (const def of BUTTONS) {
      for (const [i, { state, side }] of renders(def).entries()) {
        const hasRing = allProps(body(def, state, side)).includes(PRESSED_RING);
        expect(hasRing, `${def.id}/${state}`).toBe(i > 0);
      }
    }
  });

  it('use only the font sizes 6, 8, 10 and 14', () => {
    const allowed = new Set([6, 8, 10, 14]);
    for (const def of BUTTONS) {
      for (const { state, side } of renders(def)) {
        for (const el of findElements(body(def, state, side), (e) => 'font-size' in e.props)) {
          expect(allowed.has(Number(el.props['font-size'])), `${def.id}/${state}`).toBe(true);
        }
      }
    }
    for (const file of ['PushButton.tsx', 'MomentaryButton.tsx']) {
      const dir = file === 'PushButton.tsx' ? 'skins' : 'widgets';
      const source = readFileSync(`src/ui/panel/${dir}/${file}`, 'utf8');
      for (const m of source.matchAll(/font-size=\{(\d+(?:\.\d+)?)\}/g)) {
        expect(allowed.has(Number(m[1])), `${file} font-size ${String(m[1])}`).toBe(true);
      }
    }
  });
});

describe('push-button fit', () => {
  it('the visible diameter is at most the smaller hit side', () => {
    for (const def of BUTTONS) {
      if (def.skin === 'spring-bat') continue;
      const skin = def.skin;
      if (skin === undefined || !(skin in BEZEL_RADIUS))
        throw new Error(`${def.id} has no round skin`);
      const diameter = 2 * BEZEL_RADIUS[skin];
      expect(diameter, def.id).toBeLessThanOrEqual(Math.min(def.hit.w, def.hit.h));
    }
    expect([26, 16, 9].map((r) => 2 * r)).toEqual([52, 32, 18]);
  });

  it('the spring bat with its throw fits inside its 56 x 30 footprint', () => {
    const def = BUTTONS.find((b) => b.id === 'btn.stall_gear_test');
    expect(def?.hit).toEqual({ w: 56, h: 30 });
    // Bat throw 10 plus half the 5-wide bat, and the pivot bezel r 7 above the state text.
    expect(10 + 2.5).toBeLessThanOrEqual(28);
    for (const side of ['left', 'right'] as const) {
      const tree = body(
        def as MomentaryButtonDef,
        side === 'left' ? 'stall_test' : 'gear_test',
        side,
      );
      const poly = findElements(tree, (e) => e.tag === 'polygon')[0];
      const points = String(poly?.props['points'])
        .split(' ')
        .map((p) => p.split(',').map(Number));
      for (const [x, y] of points) {
        expect(Math.abs(x ?? 99)).toBeLessThanOrEqual(28);
        expect(Math.abs(y ?? 99)).toBeLessThanOrEqual(15);
      }
    }
  });

  it('label and state text of every button stay clear of other controls and inside the region', () => {
    for (const def of BUTTONS) {
      if (def.skin === 'spring-bat') continue;
      const skin = def.skin as keyof typeof BEZEL_RADIUS;
      const layout = buttonTextLayout(def, BEZEL_RADIUS[skin]);
      const region = regionOf(def.region);
      const boxes: { name: string; r: Rect }[] = layout.labelLines.map((line, i) => {
        const w = textWidth(line, layout.labelSize);
        const y = layout.labelYs[i] ?? 0;
        return {
          name: `${def.id} label`,
          r: {
            x: def.x - w / 2,
            y: def.y + y - layout.labelSize * 0.75,
            w,
            h: layout.labelSize * 0.95,
          },
        };
      });
      boxes.push({
        name: `${def.id} state`,
        r: {
          x: def.x - layout.stateWidth / 2,
          y: def.y + layout.stateY - layout.stateSize * 0.75,
          w: layout.stateWidth,
          h: layout.stateSize * 0.95,
        },
      });
      for (const { name, r } of boxes) {
        expect(r.x, `${name} left`).toBeGreaterThanOrEqual(0);
        expect(r.y, `${name} top`).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w, `${name} right`).toBeLessThanOrEqual(region.w);
        expect(r.y + r.h, `${name} bottom`).toBeLessThanOrEqual(region.h);
        for (const other of DA50RG.controls) {
          if (other.id === def.id) continue;
          const ob = regionOf(other.region);
          const o: Rect = {
            x: ob.x + other.x - other.hit.w / 2,
            y: ob.y + other.y - other.hit.h / 2,
            w: other.hit.w,
            h: other.hit.h,
          };
          const g: Rect = { x: region.x + r.x, y: region.y + r.y, w: r.w, h: r.h };
          const overlap = g.x < o.x + o.w && o.x < g.x + g.w && g.y < o.y + o.h && o.y < g.y + g.h;
          expect(overlap, `${name} over ${other.id}`).toBe(false);
        }
      }
    }
  });
});
