import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import type { CircuitBreakerDef, Rect, StateId } from '../src/engine/registry';
import {
  BREAKER_COMPACT,
  BREAKER_NORMAL,
  BreakerBody,
  breakerExtent,
  labelBaseline,
} from '../src/ui/panel/skins/Breaker';
import { countElements, expand, findElements, textOf } from './vnode-walk';
import type { Tree } from './vnode-walk';

// Circuit-breaker skin contract (UI-SPEC 01.2 Tables A1 and A2, owner rule G-0.1): the printed text
// is the label lines plus the rating in both states, the ring exists only when pulled, and the
// visible art never leaves the hit rectangle. Pure vnode checks, no DOM.

function fixture(over: Partial<CircuitBreakerDef> = {}): CircuitBreakerDef {
  return {
    kind: 'circuit-breaker',
    id: 'cb.fixture',
    label: 'FUEL PUMP',
    region: 'cb_essential',
    x: 50,
    y: 50,
    hit: { w: 28, h: 28 },
    states: [
      { id: 'in', label: 'IN' },
      { id: 'out', label: 'OUT' },
    ],
    default: 'in',
    rating: '7½',
    labelLines: ['FUEL', 'PUMP'],
    group: 'main',
    ...over,
  };
}

const PITOT = DA50RG.get('cb.pitot') as CircuitBreakerDef;
const TWO_LINE = fixture();
const COMPACT = fixture({
  id: 'cb.compact',
  label: 'ADF',
  labelLines: ['ADF'],
  rating: '5',
  group: 'lower',
  compact: true,
  hit: { w: 24, h: 28 },
});
const FIXTURES: readonly CircuitBreakerDef[] = [PITOT, TWO_LINE, COMPACT];
const STATES: readonly StateId[] = ['in', 'out'];

function render(def: CircuitBreakerDef, state: StateId, pressed = false) {
  return expand(BreakerBody({ def, state, pressed }));
}

function textStrings(tree: Tree): string[] {
  return findElements(tree, (el) => el.tag === 'text')
    .map((el) => textOf(el))
    .sort();
}

function inside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

describe('breaker skin: printed text', () => {
  it('cb.pitot exists in the registry as the tracer breaker', () => {
    expect(PITOT.kind).toBe('circuit-breaker');
  });

  it.each(FIXTURES.map((def) => [def.id, def] as const))(
    '%s prints the label lines and the rating only, the same in and out',
    (_id, def) => {
      const expected = [...def.labelLines, def.rating].sort();
      for (const state of STATES) {
        for (const pressed of [false, true]) {
          expect(textStrings(render(def, state, pressed)), `${state} pressed ${pressed}`).toEqual(
            expected,
          );
        }
      }
    },
  );

  it.each(FIXTURES.map((def) => [def.id, def] as const))(
    '%s prints no IN or OUT word and carries no state-text marker',
    (_id, def) => {
      for (const state of STATES) {
        const tree = render(def, state);
        for (const text of textStrings(tree)) {
          expect(['IN', 'OUT']).not.toContain(text.trim().toUpperCase());
        }
        expect(findElements(tree, (el) => 'data-state-text' in el.props)).toHaveLength(0);
      }
    },
  );

  it('every label text is tagged, size 6, anchored middle, and the rating is size 8', () => {
    const tree = render(TWO_LINE, 'in');
    const labels = findElements(tree, (el) => 'data-breaker-label' in el.props);
    expect(labels).toHaveLength(2);
    for (const el of labels) {
      expect(el.props['font-size']).toBe(6);
      expect(el.props['text-anchor']).toBe('middle');
    }
    const rating = findElements(
      tree,
      (el) => el.tag === 'text' && !('data-breaker-label' in el.props),
    );
    expect(rating).toHaveLength(1);
    expect(rating[0]?.props['font-size']).toBe(8);
    expect(rating[0]?.props['style']).toBe('letter-spacing:0');
  });
});

describe('breaker skin: label baselines', () => {
  it('the last line sits 16 above the centre, earlier lines 7 higher each', () => {
    expect(labelBaseline(0, 1)).toBe(-16);
    expect(labelBaseline(0, 2)).toBe(-23);
    expect(labelBaseline(1, 2)).toBe(-16);
    expect(labelBaseline(0, 3)).toBe(-30);
  });

  it('the rendered label texts follow the rule, centred on x (default 0)', () => {
    const one = findElements(render(PITOT, 'in'), (el) => 'data-breaker-label' in el.props);
    expect(one.map((el) => el.props['y'])).toEqual([-16]);
    const two = findElements(render(TWO_LINE, 'out'), (el) => 'data-breaker-label' in el.props);
    expect(two.map((el) => el.props['y'])).toEqual([-23, -16]);
    expect(two.map((el) => el.props['x'])).toEqual([0, 0]);
  });

  it('labelDx shifts the label centre', () => {
    const shifted = fixture({ labelDx: 3 });
    const labels = findElements(render(shifted, 'in'), (el) => 'data-breaker-label' in el.props);
    expect(labels.map((el) => el.props['x'])).toEqual([3, 3]);
  });
});

describe('breaker skin: ring, cap and socket', () => {
  it.each(FIXTURES.map((def) => [def.id, def] as const))(
    '%s: the ring exists exactly once when out and never when in',
    (_id, def) => {
      const ring = (state: StateId) =>
        findElements(render(def, state), (el) => 'data-breaker-ring' in el.props);
      expect(ring('in')).toHaveLength(0);
      expect(ring('out')).toHaveLength(1);
    },
  );

  it.each(FIXTURES.map((def) => [def.id, def] as const))(
    '%s: one cap group and one socket in both states, the cap moves when pulled',
    (_id, def) => {
      const cap = (state: StateId) =>
        findElements(render(def, state), (el) => 'data-breaker-cap' in el.props);
      const socket = (state: StateId) =>
        findElements(render(def, state), (el) => 'data-breaker-socket' in el.props);
      for (const state of STATES) {
        expect(cap(state), state).toHaveLength(1);
        expect(socket(state), state).toHaveLength(1);
      }
      expect(cap('in')[0]?.props['transform']).not.toBe(cap('out')[0]?.props['transform']);
      expect(cap('in')[0]?.props['transform']).toBe('translate(0 0)');
    },
  );

  it('a pulled breaker has a shadow, a pushed-in one has none', () => {
    const circles = (state: StateId) =>
      findElements(render(PITOT, state), (el) => el.tag === 'circle').length;
    // socket + cap (+ shadow and ring when pulled)
    expect(circles('in')).toBe(2);
    expect(circles('out')).toBe(4);
  });

  it('uses no gradient: only solid fills and strokes', () => {
    for (const state of STATES) {
      const json = JSON.stringify(render(TWO_LINE, state).children);
      expect(json).not.toContain('url(');
    }
  });

  it('has at most 12 elements in any state, pressed included', () => {
    for (const def of FIXTURES) {
      for (const state of STATES) {
        for (const pressed of [false, true]) {
          expect(
            countElements(render(def, state, pressed)),
            `${def.id} ${state} ${pressed}`,
          ).toBeLessThanOrEqual(12);
        }
      }
    }
  });

  it('the pressed ring exists only while a pointer is down', () => {
    const ringCount = (pressed: boolean) =>
      findElements(
        render(PITOT, 'in', pressed),
        (el) => el.tag === 'circle' && el.props['stroke'] === '#8fb8e6',
      ).length;
    expect(ringCount(false)).toBe(0);
    expect(ringCount(true)).toBe(1);
  });
});

describe('breaker skin: visible extent stays inside the hit', () => {
  it.each(FIXTURES.map((def) => [def.id, def] as const))(
    '%s: socket, shadow, cap, ring and pressed ring lie inside the hit rectangle',
    (_id, def) => {
      const hit: Rect = { x: -def.hit.w / 2, y: -def.hit.h / 2, w: def.hit.w, h: def.hit.h };
      for (const state of STATES) {
        for (const pressed of [false, true]) {
          const extent = breakerExtent(def, state, pressed);
          expect(
            inside(extent, hit),
            `${state} pressed ${pressed}: ${JSON.stringify(extent)}`,
          ).toBe(true);
        }
      }
    },
  );

  it('a pulled breaker reaches further up and left than a pushed-in one', () => {
    const pushed = breakerExtent(PITOT, 'in', false);
    const pulled = breakerExtent(PITOT, 'out', false);
    expect(pulled.x).toBeLessThanOrEqual(pushed.x);
    expect(pulled.y).toBeLessThanOrEqual(pushed.y);
    expect(pulled.w).toBeGreaterThanOrEqual(pushed.w);
  });

  it('the extent is built from the art constants the skin draws', () => {
    // Pushed in the socket is the widest part; its half stroke is included.
    expect(breakerExtent(PITOT, 'in', false)).toEqual({
      x: -(BREAKER_NORMAL.socketR + 0.5),
      y: -(BREAKER_NORMAL.socketR + 0.5),
      w: 2 * (BREAKER_NORMAL.socketR + 0.5),
      h: 2 * (BREAKER_NORMAL.socketR + 0.5),
    });
    expect(breakerExtent(COMPACT, 'in', false).w).toBe(2 * (BREAKER_COMPACT.socketR + 0.5));
  });

  it('the compact set is smaller than the normal set in every radius', () => {
    expect(BREAKER_COMPACT.socketR).toBeLessThan(BREAKER_NORMAL.socketR);
    expect(BREAKER_COMPACT.capR.in).toBeLessThan(BREAKER_NORMAL.capR.in);
    expect(BREAKER_COMPACT.ringR).toBeLessThan(BREAKER_NORMAL.ringR);
  });
});
