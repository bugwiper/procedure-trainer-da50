import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { PLACARDS } from '../src/aircraft/da50rg/placards';
import type { ControlDef, DetentLeverDef } from '../src/engine/registry';
import { FLAP, FlapBody, flapWall } from '../src/ui/panel/skins/Flap';
import { ENV_ICONS, LEVER_ART } from '../src/ui/panel/skins/LeverHandles';
import {
  LeverBody,
  makeTapToggleHandlers,
  tapToggleTarget,
} from '../src/ui/panel/widgets/DetentLever';
import { countElements, expand, findElements, textOf } from './vnode-walk';
import type { El, Tree } from './vnode-walk';

// Lever skins (PNL-11, D-09, UI-SPEC 8.5). Pure vnode and data checks, no DOM.

function isLever(c: ControlDef): c is DetentLeverDef {
  return c.kind === 'detent-lever';
}

const LEVERS = DA50RG.controls.filter(isLever);

function lever(id: string): DetentLeverDef {
  const found = LEVERS.find((l) => l.id === id);
  if (found === undefined) throw new Error(`unknown lever ${id}`);
  return found;
}

function regionWidth(def: DetentLeverDef): number {
  const region = DA50RG.regions.find((r) => r.id === def.region);
  if (region === undefined) throw new Error(`unknown region ${def.region}`);
  return region.bounds.w;
}

function body(def: DetentLeverDef, state: string, dragging = false, pos?: number): El {
  const detent = def.detents.find((d) => d.id === state);
  if (detent === undefined) throw new Error(`unknown detent ${state}`);
  return expand(
    LeverBody({
      def,
      state,
      handlePos: pos ?? detent.pos,
      dragging,
      regionWidth: regionWidth(def),
    }),
  );
}

function stateTexts(tree: Tree): El[] {
  return findElements(tree, (el) => 'data-state-text' in el.props);
}

function texts(tree: Tree): string[] {
  return findElements(tree, (el) => el.tag === 'text').map((el) => textOf(el));
}

function sourceOf(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('LeverBody', () => {
  it('stays within 40 nodes with no state text, in every state (G-0.1)', () => {
    expect(LEVERS.length).toBeGreaterThanOrEqual(11);
    for (const def of LEVERS) {
      for (const detent of def.detents) {
        for (const dragging of [false, true]) {
          const tree = body(def, detent.id, dragging);
          const id = `${def.id}/${detent.id}/${String(dragging)}`;
          expect(countElements(tree), id).toBeLessThanOrEqual(40);
          expect(stateTexts(tree), id).toHaveLength(0);
        }
      }
    }
  });

  it('draws POWER with its 21 detents inside the node cap and all ticks as one path', () => {
    const power = lever('lv.power');
    expect(power.detents).toHaveLength(21);
    const tree = body(power, 'p70');
    expect(countElements(tree)).toBeLessThanOrEqual(40);
    const ticks = findElements(
      tree,
      (el) => el.tag === 'path' && String(el.props['d']).startsWith('M'),
    );
    expect(ticks.filter((t) => String(t.props['d']).split('M').length - 1 === 21)).toHaveLength(1);
  });

  it('names the lever on the group: data-skin, role img and aria-label LABEL: STATE', () => {
    for (const def of LEVERS) {
      const first = def.detents[0];
      if (first === undefined) throw new Error('no detent');
      const tree = body(def, first.id);
      expect(tree.props['role'], def.id).toBe('img');
      expect(tree.props['aria-label'], def.id).toBe(`${def.label}: ${first.label}`);
      expect(tree.props['data-skin'], def.id).toBe(def.skin);
    }
  });

  it('is pure: it renders without a render context (no hooks)', () => {
    const def = lever('lv.gear');
    expect(() => body(def, 'up')).not.toThrow();
  });

  it('gives the handle hit the full footprint width and one handle square along the track', () => {
    for (const def of LEVERS) {
      const first = def.detents[0];
      if (first === undefined) throw new Error('no detent');
      const hit = findElements(body(def, first.id), (el) => el.props['data-hit'] === def.id)[0];
      expect(hit, def.id).toBeDefined();
      const vertical = def.track.axis === 'v';
      const wide = vertical ? hit?.props['width'] : hit?.props['height'];
      expect(wide, def.id).toBe(vertical ? def.hit.w : def.hit.h);
    }
  });

  it('gives a dragOnly lever no marker targets, the wider handle hit notwithstanding', () => {
    const emerg = lever('lv.emerg_gear');
    expect(emerg.dragOnly).toBe(true);
    const tree = body(emerg, 'normal');
    expect(findElements(tree, (el) => 'data-detent' in el.props)).toHaveLength(0);
  });
});

describe('gear knob', () => {
  it('lv.gear is the gear-knob skin: a silver knob with UP and DOWN legends', () => {
    const gear = lever('lv.gear');
    expect(gear.skin).toBe('gear-knob');
    const tree = body(gear, 'up');
    const all = JSON.stringify(findElements(tree, () => true).map((el) => el.props));
    expect(all).toContain('url(#g-silver)');
    expect(texts(tree)).toEqual(expect.arrayContaining(['UP', 'DOWN']));
  });

  it('draws the knob as a disc of r 22 with twelve flute lines', () => {
    const tree = body(lever('lv.gear'), 'down');
    const disc = findElements(tree, (el) => el.tag === 'circle' && el.props['r'] === 22);
    expect(disc).toHaveLength(1);
    const flutes = findElements(
      tree,
      (el) => el.tag === 'path' && el.props['stroke'] === '#7d838b',
    );
    expect(flutes).toHaveLength(1);
    expect(String(flutes[0]?.props['d']).split('M').length - 1).toBe(12);
  });

  it('marks a grab with the blue ring only while dragging', () => {
    const calm = JSON.stringify(
      findElements(body(lever('lv.gear'), 'up'), () => true).map((e) => e.props),
    );
    const grab = JSON.stringify(
      findElements(body(lever('lv.gear'), 'up', true), () => true).map((e) => e.props),
    );
    expect(calm).not.toContain('#8fb8e6');
    expect(grab).toContain('#8fb8e6');
  });

  it('follows the drag position, not the committed detent, while dragging', () => {
    const gear = lever('lv.gear');
    const at = (pos: number) =>
      findElements(
        expand(
          LeverBody({ def: gear, state: 'up', handlePos: pos, dragging: true, regionWidth: 239 }),
        ),
        (el) =>
          el.tag === 'g' &&
          typeof el.props['transform'] === 'string' &&
          String(el.props['transform']).startsWith('translate(0 ') &&
          !('data-control-id' in el.props),
      )[0]?.props['transform'];
    expect(at(1)).not.toEqual(at(0));
  });
});

describe('FLAPS and the pull handles', () => {
  const EXPECTED: Record<string, string> = {
    'lv.flaps': 'flaps-block',
    'lv.alt_static': 'pull-t',
    'lv.emerg_gear': 'pull-tab',
    'lv.alt_air': 'pull-boot',
  };

  it('assigns the skins of UI-SPEC 8.5', () => {
    for (const [id, skin] of Object.entries(EXPECTED)) expect(lever(id).skin, id).toBe(skin);
  });

  it('keeps EMERGENCY GEAR EXTENSION dragOnly with no markers', () => {
    const emerg = lever('lv.emerg_gear');
    expect(emerg.dragOnly).toBe(true);
    expect(emerg.markers).toBeUndefined();
  });

  it('uses the safety red #c4161f only in the pull-t and pull-tab bodies among the levers', () => {
    for (const def of LEVERS) {
      const first = def.detents[0];
      if (first === undefined) throw new Error('no detent');
      const props = JSON.stringify(
        findElements(body(def, first.id), () => true).map((e) => e.props),
      );
      const red = props.toLowerCase().includes('#c4161f');
      expect(red, def.id).toBe(def.skin === 'pull-t' || def.skin === 'pull-tab');
    }
  });

  it('draws FLAPS as a 46 x 26 block in a 54 wide slot with three notches', () => {
    const flaps = lever('lv.flaps');
    const tree = body(flaps, 'up');
    const block = findElements(
      tree,
      (el) => el.tag === 'rect' && el.props['width'] === 46 && el.props['height'] === 26,
    );
    expect(block).toHaveLength(1);
    const slot = findElements(
      tree,
      (el) =>
        el.tag === 'rect' &&
        el.props['width'] === 54 &&
        el.props['height'] === flaps.track.length + 36,
    );
    expect(slot).toHaveLength(1);
    const ticks = findElements(
      tree,
      (el) => el.tag === 'path' && String(el.props['d']).startsWith('M-27'),
    );
    expect(String(ticks[0]?.props['d']).split('M').length - 1).toBe(3);
  });

  it('puts PULL on the red knob and the red tab, and ALTERNATE AIR vertically on the boot', () => {
    expect(texts(body(lever('lv.alt_static'), 'closed'))).toContain('PULL');
    expect(texts(body(lever('lv.emerg_gear'), 'normal'))).toContain('PULL');
    const boot = body(lever('lv.alt_air'), 'closed');
    const vertical = findElements(
      boot,
      (el) => el.tag === 'text' && el.props['transform'] === 'rotate(90)',
    );
    expect(vertical.map((t) => textOf(t))).toEqual(['ALTERNATE AIR']);
  });

  it('keeps the stem of a pulled handle between the entry plate and the handle', () => {
    const open = body(lever('lv.alt_static'), 'open');
    const closed = body(lever('lv.alt_static'), 'closed');
    const stem = (t: El) =>
      findElements(
        t,
        (el) => el.tag === 'rect' && el.props['width'] === 4 && el.props['fill'] === '#8b9199',
      )[0];
    expect(Number(stem(open)?.props['height'])).toBeGreaterThan(
      Number(stem(closed)?.props['height']),
    );
  });
});

describe('nameless levers and chosen legends (plan 19, G-3)', () => {
  it('a nameless lever draws no name text, a named one draws its name', () => {
    const power = lever('lv.power');
    const named = texts(body({ ...power, nameless: false }, 'p70'));
    expect(named).toContain(power.label);
    const bare = texts(body({ ...power, nameless: true }, 'p70'));
    expect(bare).not.toContain(power.label);
    // The legends and the MAX placard are untouched by dropping the name.
    expect(bare).toEqual(named.filter((t) => t !== power.label));
  });

  it('a lever with legends prints exactly those detent labels and nothing else changes', () => {
    const temp = lever('lv.env_temp');
    const unlisted = Object.fromEntries(
      Object.entries({ ...temp, nameless: true }).filter(([key]) => key !== 'legends'),
    ) as unknown as DetentLeverDef;
    const all = texts(body(unlisted, 't50'));
    expect(all).toEqual(expect.arrayContaining(['COLD', '25', '50', '75', 'WARM']));
    // As shipped, TEMPERATURE prints only COLD and WARM in every step (plan 20, G-3).
    expect(temp.legends).toEqual(['cold', 'warm']);
    for (const d of temp.detents)
      expect(texts(body(temp, d.id)).sort(), d.id).toEqual(['COLD', 'WARM']);
    const some = texts(body({ ...temp, nameless: true, legends: ['cold', 'warm'] }, 't50'));
    expect(some.sort()).toEqual(['COLD', 'WARM']);
    const none = texts(body({ ...temp, nameless: true, legends: [] }, 't50'));
    expect(none).toEqual([]);
    // Markers, hit and handle are the same with and without a legends list.
    const hits = (tree: Tree) => findElements(tree, (el) => 'data-hit' in el.props).length;
    const dets = (tree: Tree) => findElements(tree, (el) => 'data-detent' in el.props).length;
    const a = body(temp, 't50');
    const b = body({ ...temp, legends: [] }, 't50');
    expect(hits(b)).toBe(hits(a));
    expect(dets(b)).toBe(dets(a));
  });

  it('a horizontal skinned lever and an unskinned one honour legends too', () => {
    const circ = lever('lv.env_circ');
    expect(texts(body({ ...circ, nameless: true, legends: ['fresh'] }, 'fresh'))).toEqual([
      'FRESH',
    ]);
    const plain = { ...lever('lv.gear'), skin: undefined, legends: ['down'] } as DetentLeverDef;
    const names = texts(body({ ...plain, nameless: true }, 'down'));
    expect(names).toEqual(['DOWN']);
  });

  it('lv.cowl_flap is nameless with no legends: no text at all in any position', () => {
    const cowl = lever('lv.cowl_flap');
    expect(cowl.nameless).toBe(true);
    expect(cowl.legends).toEqual([]);
    for (const d of cowl.detents) expect(texts(body(cowl, d.id)), d.id).toEqual([]);
  });
});

describe('pedestal levers (plan 19, G-3)', () => {
  it('PARKING BRAKE keeps its id, states, default and name (R2-4.2): a tap-toggle flap with no drag', () => {
    const brake = lever('lv.parking_brake');
    expect(brake.detents.map((d) => [d.id, d.pos])).toEqual([
      ['off', 0],
      ['set', 1],
    ]);
    expect(brake.default).toBe('off');
    expect(brake.label).toBe('PARKING BRAKE');
    expect(brake.nameless).toBe(true);
    expect(brake.skin).toBe('parking-flap');
    expect(brake.tapToggle).toBe(true);
    expect(brake.hit).toEqual({ w: 44, h: 88 });
    expect(brake.markers).toBeUndefined();
    expect(brake.dragOnly).not.toBe(true);
  });

  it('PARKING BRAKE draws one hit over the whole footprint, no detent markers, no track', () => {
    const brake = lever('lv.parking_brake');
    for (const d of brake.detents) {
      const tree = body(brake, d.id);
      expect(
        findElements(tree, (el) => 'data-detent' in el.props),
        d.id,
      ).toHaveLength(0);
      const hits = findElements(tree, (el) => 'data-hit' in el.props);
      expect(hits, d.id).toHaveLength(1);
      expect(hits[0]?.props['data-hit']).toBe('lv.parking_brake');
      expect(hits[0]?.props['x']).toBe(-brake.hit.w / 2);
      expect(hits[0]?.props['y']).toBe(-brake.hit.h / 2);
      expect(hits[0]?.props['width']).toBe(brake.hit.w);
      expect(hits[0]?.props['height']).toBe(brake.hit.h);
      // No track slot, no detent tick path (the flap does not use the track).
      expect(
        findElements(tree, (el) => el.tag === 'path'),
        d.id,
      ).toEqual([]);
    }
  });

  it('PARKING BRAKE prints nothing: no name, no legends, no state text, in either position', () => {
    const brake = lever('lv.parking_brake');
    expect(brake.legends).toEqual([]);
    for (const d of brake.detents) {
      expect(texts(body(brake, d.id)), d.id).toEqual([]);
      expect(stateTexts(body(brake, d.id)), d.id).toHaveLength(0);
    }
  });

  it('a tap toggles the other detent once; a long gesture, a cancel and a lost capture do nothing', () => {
    const brake = lever('lv.parking_brake');
    expect(tapToggleTarget(brake, 'off')).toBe('set');
    expect(tapToggleTarget(brake, 'set')).toBe('off');
    let state = 'off';
    const calls: string[] = [];
    let pressed = false;
    const handlers = makeTapToggleHandlers(
      brake,
      () => state,
      (detent) => {
        calls.push(detent);
        state = detent;
      },
      (p) => {
        pressed = p;
      },
    );
    const ev = (x: number, y: number, over: Partial<PointerEvent> = {}): PointerEvent =>
      ({
        isPrimary: true,
        pointerId: 1,
        clientX: x,
        clientY: y,
        currentTarget: { setPointerCapture: () => undefined },
        ...over,
      }) as unknown as PointerEvent;
    handlers.onDown(ev(100, 100));
    expect(pressed).toBe(true);
    handlers.onUp(ev(102, 101));
    expect(pressed).toBe(false);
    expect(calls).toEqual(['set']);
    handlers.onDown(ev(100, 100));
    handlers.onUp(ev(100, 100));
    expect(calls).toEqual(['set', 'off']);
    // An up without a down is nothing; a drag beyond the slop is nothing.
    handlers.onUp(ev(100, 100));
    handlers.onDown(ev(100, 100));
    handlers.onUp(ev(100, 140));
    expect(calls).toEqual(['set', 'off']);
    // Cancel and lost capture clear without actuating.
    handlers.onDown(ev(100, 100));
    handlers.clear();
    expect(pressed).toBe(false);
    handlers.onUp(ev(100, 100));
    expect(calls).toEqual(['set', 'off']);
    // A second pointer (not primary) is ignored.
    handlers.onDown(ev(100, 100, { isPrimary: false }));
    handlers.onUp(ev(100, 100, { isPrimary: false }));
    expect(calls).toEqual(['set', 'off']);
  });

  it('the throttle is the POWER lever under its plate name THROTTLE (Q-04): id, steps, default and MAX kept', () => {
    const power = lever('lv.power');
    expect(power.label).toBe('THROTTLE');
    expect(power.nameless).toBe(true);
    expect(power.detents).toHaveLength(21);
    expect(power.markers).toEqual(['p0', 'p50', 'p100']);
    expect(power.default).toBe('p70');
    const all = texts(body(power, 'p70'));
    expect(all).not.toContain('THROTTLE');
    expect(all).not.toContain('POWER');
    expect(all.filter((t) => t === 'MAX')).toHaveLength(1);
    expect(all).toEqual(expect.arrayContaining(['0 %', '50 %', '100 %']));
  });
});

describe('PARKING BRAKE flap geometry (R2-4.2, Table P1)', () => {
  const brake = lever('lv.parking_brake');
  const flap = (state: string, pressed = false): El =>
    expand(FlapBody({ def: brake, state, pressed }));

  type P = readonly [number, number];
  function polygonPoints(el: El): P[] {
    return String(el.props['points'])
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [x, y] = pair.split(',').map(Number);
        return [x ?? NaN, y ?? NaN] as P;
      });
  }

  /** All points of the art of a tree (rect corners, polygon points, line ends). */
  function artPoints(tree: El): P[] {
    const out: P[] = [];
    for (const el of findElements(tree, () => true)) {
      const n = (k: string): number => Number(el.props[k]);
      if (el.tag === 'rect') {
        out.push([n('x'), n('y')], [n('x') + n('width'), n('y') + n('height')]);
      } else if (el.tag === 'polygon') {
        out.push(...polygonPoints(el));
      } else if (el.tag === 'line') {
        out.push([n('x1'), n('y1')], [n('x2'), n('y2')]);
      }
    }
    return out;
  }

  it('released: a flat face, the recess, no wall; pulled: exactly one wall polygon of three points', () => {
    const off = flap('off');
    expect(findElements(off, (el) => 'data-flap-wall' in el.props)).toHaveLength(0);
    expect(findElements(off, (el) => 'data-flap-face' in el.props)).toHaveLength(1);
    // The released face is axis-aligned: a rect, not a polygon.
    expect(findElements(off, (el) => el.tag === 'polygon')).toHaveLength(0);
    // The recess is the first element in both states.
    const set = flap('set');
    for (const tree of [off, set]) {
      expect(findElements(tree, (el) => el.tag === 'rect')[0]?.props['fill']).toBe('#050506');
    }
    const walls = findElements(set, (el) => 'data-flap-wall' in el.props);
    expect(walls).toHaveLength(1);
    expect(polygonPoints(walls[0]!)).toHaveLength(3);
  });

  it('the wall is a true rotation about the hinge by 45 to 75 degrees, recomputable from the constants', () => {
    const wall = polygonPoints(findElements(flap('set'), (el) => 'data-flap-wall' in el.props)[0]!);
    const [h, r, t] = wall as [P, P, P];
    const edge = (a: P, b: P): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
    // The hinge corner is the one whose two edges have the flap length.
    expect(edge(h, r)).toBeCloseTo(FLAP.length, 2);
    expect(edge(h, t)).toBeCloseTo(FLAP.length, 2);
    const angle =
      (Math.acos(
        ((r[0] - h[0]) * (t[0] - h[0]) + (r[1] - h[1]) * (t[1] - h[1])) / (edge(h, r) * edge(h, t)),
      ) *
        180) /
      Math.PI;
    expect(angle).toBeGreaterThanOrEqual(45);
    expect(angle).toBeLessThanOrEqual(75);
    expect(angle).toBeCloseTo(FLAP.angleDeg, 1);
    // The pure helper gives the same numbers, and the hinge sits on the lower edge of the flat flap.
    const [ph, pr, pt] = flapWall();
    expect(h[0]).toBeCloseTo(ph.x, 2);
    expect(r[1]).toBeCloseTo(pr.y, 2);
    expect(t[0]).toBeCloseTo(pt.x, 2);
    expect(ph.y).toBe(FLAP.hingeY);
    expect(pr.y).toBe(FLAP.hingeY - FLAP.length);
    // Any allowed angle keeps both edges at the flap length.
    for (const deg of [45, 60, 75]) {
      const [a, b, c] = flapWall(deg);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(FLAP.length, 6);
      expect(Math.hypot(c.x - a.x, c.y - a.y)).toBeCloseTo(FLAP.length, 6);
    }
  });

  it('draws a lifted face lighter than the wall and a highlight on the free edge when pulled', () => {
    const set = flap('set');
    const wall = findElements(set, (el) => 'data-flap-wall' in el.props)[0]!;
    const face = findElements(set, (el) => 'data-flap-face' in el.props);
    expect(face).toHaveLength(1);
    expect(face[0]?.tag).toBe('polygon');
    expect(polygonPoints(face[0]!)).toHaveLength(4);
    expect(face[0]?.props['fill']).not.toBe(wall.props['fill']);
    const lum = (hex: unknown): number => parseInt(String(hex).slice(1, 3), 16);
    expect(lum(face[0]?.props['fill'])).toBeGreaterThan(lum(wall.props['fill']));
    expect(findElements(set, (el) => 'data-flap-free' in el.props)).toHaveLength(1);
  });

  it('the pressed ring is transient: it differs only while a pointer is down', () => {
    for (const state of ['off', 'set']) {
      const recess = (pressed: boolean) =>
        findElements(flap(state, pressed), (el) => el.tag === 'rect')[0]?.props['stroke'];
      expect(recess(true), state).toBe('#8fb8e6');
      expect(recess(false), state).not.toBe('#8fb8e6');
    }
  });

  it('keeps all art inside the footprint, at most 14 elements, no text, in both states', () => {
    for (const state of ['off', 'set']) {
      for (const pressed of [false, true]) {
        const tree = flap(state, pressed);
        const id = `${state}/${String(pressed)}`;
        expect(countElements(tree), id).toBeLessThanOrEqual(14);
        expect(
          findElements(tree, (el) => el.tag === 'text'),
          id,
        ).toEqual([]);
        for (const [x, y] of artPoints(tree)) {
          expect(Math.abs(x), id).toBeLessThanOrEqual(brake.hit.w / 2);
          expect(Math.abs(y), id).toBeLessThanOrEqual(brake.hit.h / 2);
        }
      }
    }
  });

  it('the placard stays the only name: PARKING / BRAKE on the plate, nothing on the flap', () => {
    const placard = PLACARDS.find((p) => p.id === 'parking_brake.name');
    expect(placard?.lines).toEqual(['PARKING', 'BRAKE']);
    expect(placard?.near).toBe('lv.parking_brake');
    for (const d of brake.detents) expect(texts(body(brake, d.id)), d.id).toEqual([]);
  });
});

describe('POWER grip, COWL FLAP, PARKING BRAKE and the environmental sliders', () => {
  const EXPECTED: Record<string, string> = {
    'lv.power': 'power-grip',
    'lv.cowl_flap': 'cowl-slider',
    'lv.parking_brake': 'parking-flap',
    'lv.env_direction': 'env-slider',
    'lv.env_temp': 'env-slider',
    'lv.env_circ': 'env-slider',
  };

  it('assigns the skins of UI-SPEC 8.5', () => {
    for (const [id, skin] of Object.entries(EXPECTED)) expect(lever(id).skin, id).toBe(skin);
    expect(LEVERS.filter((l) => l.skin === undefined)).toEqual([]);
  });

  it('draws the POWER grip in p-carbon with no emblem and only the MAX placard as track text', () => {
    const power = lever('lv.power');
    const tree = body(power, 'p70');
    const props = JSON.stringify(findElements(tree, () => true).map((e) => e.props));
    expect(props).toContain('url(#p-carbon)');
    const handle = findElements(
      tree,
      (el) =>
        el.tag === 'g' &&
        typeof el.props['transform'] === 'string' &&
        el.props['pointer-events'] === 'none' &&
        !('data-control-id' in el.props) &&
        findElements(el, (c) => c.props['fill'] === 'url(#p-carbon)').length > 0,
    )[0];
    expect(handle).toBeDefined();
    expect(findElements(handle as El, (el) => el.tag === 'text')).toHaveLength(0);
    expect(texts(tree).filter((t) => t === 'MAX')).toHaveLength(1);
    expect(texts(tree).join(' ')).not.toMatch(/DIAMOND|RUBIN|DA50|\bDA\b/i);
  });

  it('prints the POWER legend only at the marker detents and never a ground-idle gate', () => {
    const tree = body(lever('lv.power'), 'p70');
    const all = texts(tree).join('|');
    expect(all).not.toMatch(/IDLE|GATE/i);
    expect(all).toContain('50 %');
  });

  it('draws the environmental icons as original path glyphs beside the slot', () => {
    const direction = body(lever('lv.env_direction'), 'face');
    const icons = findElements(direction, (el) => 'data-icon' in el.props);
    expect(icons.map((e) => e.props['data-icon']).sort()).toEqual(['defrost', 'face', 'feet']);
    const circ = body(lever('lv.env_circ'), 'fresh');
    const circIcons = findElements(circ, (el) => 'data-icon' in el.props);
    expect(circIcons.map((e) => e.props['data-icon']).sort()).toEqual(['fresh', 'recirc']);
    // One path element per glyph, no text inside it.
    for (const icon of [...icons, ...circIcons]) expect(icon.tag).toBe('path');
  });

  it('DIRECTION prints its three pictograms right of the slot, never under the handle, no words', () => {
    const def = lever('lv.env_direction');
    const art = LEVER_ART['env-slider'];
    for (const d of def.detents) {
      const tree = body(def, d.id);
      expect(texts(tree), d.id).toEqual([]);
      for (const icon of findElements(tree, (el) => 'data-icon' in el.props)) {
        const m = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(String(icon.props['transform']));
        // The pictogram's left edge (glyphs reach 6 units left of their origin) clears the handle.
        expect(Number(m?.[1]) - 6, String(icon.props['data-icon'])).toBeGreaterThan(art.across);
      }
    }
  });

  it('the fresh-air glyph is a rectangle with an inward arrow, recirculation a rectangle with a circling arrow', () => {
    // Fresh: three subpaths (open rectangle, arrow shaft, arrow head); recirc: rectangle, arc, head.
    expect(ENV_ICONS['fresh']?.split('M').length).toBe(4);
    expect(ENV_ICONS['recirc']?.split('M').length).toBe(4);
    expect(ENV_ICONS['recirc']).toContain('A');
    expect(ENV_ICONS['recirc']).toContain('Z');
    expect(ENV_ICONS['fresh']).not.toContain('A');
  });

  it('no environmental control prints a number or a state word in any state', () => {
    for (const id of ['lv.env_direction', 'lv.env_temp', 'lv.env_circ']) {
      const def = lever(id);
      for (const d of def.detents) {
        for (const t of texts(body(def, d.id))) {
          expect(t, `${id}/${d.id}`).not.toMatch(/\d/);
          expect(['COLD', 'WARM'], `${id}/${d.id}`).toContain(t);
        }
      }
    }
  });

  it('lays CIRCULATING AIR out horizontally inside its region: pictograms only, no text', () => {
    const def = lever('lv.env_circ');
    expect(def.region).toBe('env_circ');
    expect(def.nameless).toBe(true);
    const region = DA50RG.regions.find((r) => r.id === def.region);
    if (region === undefined) throw new Error('no region');
    for (const d of def.detents) {
      const tree = body(def, d.id);
      expect(texts(tree), d.id).toEqual([]);
      expect(stateTexts(tree), d.id).toHaveLength(0);
    }
    // Both pictograms sit at the slot ends, inside the region and clear of the handle.
    const tree = body(def, 'recirc');
    const icons = findElements(tree, (el) => 'data-icon' in el.props);
    expect(icons.map((i) => i.props['data-icon']).sort()).toEqual(['fresh', 'recirc']);
    for (const icon of icons) {
      const m = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(String(icon.props['transform']));
      const x = Number(m?.[1]);
      const y = Number(m?.[2]);
      expect(Math.abs(x), String(icon.props['data-icon'])).toBeGreaterThan(def.track.length / 2);
      expect(def.x + x - 6, String(icon.props['data-icon'])).toBeGreaterThanOrEqual(0);
      expect(def.x + x + 6, String(icon.props['data-icon'])).toBeLessThanOrEqual(region.bounds.w);
      expect(def.y + y - 6, String(icon.props['data-icon'])).toBeGreaterThanOrEqual(0);
      expect(def.y + y + 6, String(icon.props['data-icon'])).toBeLessThanOrEqual(region.bounds.h);
    }
  });

  it('keeps every console lever body at most 40 elements with no state text', () => {
    for (const id of Object.keys(EXPECTED)) {
      const def = lever(id);
      for (const d of def.detents) {
        const tree = body(def, d.id);
        expect(countElements(tree), `${id}/${d.id}`).toBeLessThanOrEqual(40);
        expect(stateTexts(tree), `${id}/${d.id}`).toHaveLength(0);
      }
    }
  });
});

describe('lever sources', () => {
  it('use only the font sizes 6, 8, 10 and 14', () => {
    for (const path of [
      '../src/ui/panel/widgets/DetentLever.tsx',
      '../src/ui/panel/skins/LeverHandles.tsx',
    ]) {
      const src = sourceOf(path);
      const sizes = [...src.matchAll(/font-size=\{([^}]+)\}/g)].flatMap((m) =>
        m[1] === undefined ? [] : [m[1]],
      );
      expect(sizes.length, path).toBeGreaterThan(0);
      for (const size of sizes) {
        expect(['6', '8', '10', '14'], `${path} ${size}`).toContain(size);
      }
    }
  });
});
