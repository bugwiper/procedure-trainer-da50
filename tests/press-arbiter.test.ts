import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createPressArbiter } from '../src/ui/panel/press-arbiter';
import type { PressEffect, PointerSample, TargetDescriptor } from '../src/ui/panel/press-arbiter';
import { MOUSE_SLOP_PX, TAP_MAX_MS, TOUCH_SLOP_PX, slopPx } from '../src/ui/panel/tap-intent';
import type { PointerKind } from '../src/ui/panel/tap-intent';

// The press arbitration machine (R3-Z2): a pure function of pointer samples. Every number below
// comes from the exported constants and slopPx, never from a literal of a slop or a window.

const BACKGROUND: TargetDescriptor = { cls: 'background', key: null };
const OWN: TargetDescriptor = { cls: 'own', key: 'lever.gear', dragStartPx: 0 };

function sample(
  id: number,
  x: number,
  y: number,
  t: number,
  kind: PointerKind = 'touch',
  primary = true,
): PointerSample {
  return { id, kind, primary, x, y, t };
}

function types(effects: readonly PressEffect[]): string[] {
  return effects.map((e) => e.type);
}

function only<T extends PressEffect['type']>(
  effects: readonly PressEffect[],
  type: T,
): Extract<PressEffect, { type: T }>[] {
  return effects.filter((e): e is Extract<PressEffect, { type: T }> => e.type === type);
}

describe('background pointer: tap', () => {
  for (const kind of ['touch', 'mouse', 'pen'] as const) {
    it(`a still short single ${kind} pointer is a tap with key null`, () => {
      const m = createPressArbiter();
      expect(m.down(sample(1, 200, 300, 1000, kind), BACKGROUND)).toEqual([]);
      expect(m.stateOf(1)).toBe('view');
      const up = m.up(sample(1, 200, 300, 1000 + TAP_MAX_MS, kind));
      expect(types(up)).toEqual(['tap']);
      const tap = only(up, 'tap')[0];
      expect(tap?.key).toBeNull();
      expect(tap?.quick).toBe(true);
      expect(tap?.down).toEqual({ x: 200, y: 300 });
      expect(tap?.up).toEqual({ x: 200, y: 300 });
      expect(tap?.durationMs).toBe(TAP_MAX_MS);
      expect(m.stateOf(1)).toBeUndefined();
    });
  }

  for (const kind of ['touch', 'mouse'] as const) {
    it(`the ${kind} slop is inclusive: exactly slopPx is a tap, one unit more is a pan`, () => {
      const slop = slopPx(kind);
      const exact = createPressArbiter();
      exact.down(sample(1, 100, 100, 0, kind), BACKGROUND);
      expect(exact.move(sample(1, 100 + slop, 100, 10, kind))).toEqual([]);
      expect(types(exact.up(sample(1, 100 + slop, 100, 20, kind)))).toEqual(['tap']);

      const beyond = createPressArbiter();
      beyond.down(sample(1, 100, 100, 0, kind), BACKGROUND);
      const moved = beyond.move(sample(1, 100 + slop + 1, 100, 10, kind));
      expect(types(moved)).toEqual(['pair-break', 'pan']);
      expect(types(beyond.up(sample(1, 100 + slop + 1, 100, 20, kind)))).toEqual(['pair-break']);
    });
  }

  it('the touch and the mouse slop differ: a 6 px move is a pan for the mouse and a tap for touch', () => {
    const between = MOUSE_SLOP_PX + 1;
    expect(between).toBeLessThanOrEqual(TOUCH_SLOP_PX);
    const touch = createPressArbiter();
    touch.down(sample(1, 0, 0, 0, 'touch'), BACKGROUND);
    expect(touch.move(sample(1, between, 0, 5, 'touch'))).toEqual([]);
    expect(types(touch.up(sample(1, between, 0, 10, 'touch')))).toEqual(['tap']);
    const mouse = createPressArbiter();
    mouse.down(sample(1, 0, 0, 0, 'mouse'), BACKGROUND);
    expect(types(mouse.move(sample(1, between, 0, 5, 'mouse')))).toEqual(['pair-break', 'pan']);
  });

  it('a press longer than TAP_MAX_MS is no tap', () => {
    const m = createPressArbiter();
    m.down(sample(1, 50, 50, 0), BACKGROUND);
    expect(types(m.up(sample(1, 50, 50, TAP_MAX_MS + 1)))).toEqual(['pair-break']);
  });

  it('a move back inside the slop after a pan does not turn the lift into a tap', () => {
    const m = createPressArbiter();
    m.down(sample(1, 0, 0, 0), BACKGROUND);
    m.move(sample(1, TOUCH_SLOP_PX + 5, 0, 10));
    m.move(sample(1, 0, 0, 20));
    expect(only(m.up(sample(1, 0, 0, 30)), 'tap')).toEqual([]);
  });
});

describe('background pointer: pan', () => {
  it('emits exact client-pixel deltas, the first one measured from the down point', () => {
    const m = createPressArbiter();
    m.down(sample(1, 100, 200, 0), BACKGROUND);
    const first = m.move(sample(1, 100 + TOUCH_SLOP_PX + 3, 200 + 2, 10));
    expect(only(first, 'pan')).toEqual([{ type: 'pan', id: 1, dx: TOUCH_SLOP_PX + 3, dy: 2 }]);
    const second = m.move(sample(1, 100 + TOUCH_SLOP_PX + 8, 200 - 4, 20));
    expect(only(second, 'pan')).toEqual([{ type: 'pan', id: 1, dx: 5, dy: -6 }]);
    expect(types(second)).toEqual(['pan']);
  });

  it('pair-break comes once, when the pan starts', () => {
    const m = createPressArbiter();
    m.down(sample(1, 0, 0, 0), BACKGROUND);
    const a = m.move(sample(1, TOUCH_SLOP_PX + 1, 0, 10));
    const b = m.move(sample(1, TOUCH_SLOP_PX + 20, 0, 20));
    expect(types(a)).toEqual(['pair-break', 'pan']);
    expect(types(b)).toEqual(['pan']);
  });
});

describe('background pointers: pinch', () => {
  it('a second pointer starts a pinch: pair-break once, then pinch effects with both midpoints and distances', () => {
    const m = createPressArbiter();
    m.down(sample(1, 100, 100, 0), BACKGROUND);
    const second = m.down(sample(2, 300, 100, 5, 'touch', false), BACKGROUND);
    expect(types(second)).toEqual(['pair-break']);
    expect(m.stateOf(1)).toBe('view');
    expect(m.stateOf(2)).toBe('view');
    const moved = m.move(sample(2, 500, 100, 10, 'touch', false));
    expect(moved).toEqual([
      {
        type: 'pinch',
        prev: { x: 200, y: 100, dist: 200 },
        next: { x: 300, y: 100, dist: 400 },
      },
    ]);
    const next = m.move(sample(1, 100, 300, 15));
    expect(only(next, 'pinch')[0]?.prev).toEqual({ x: 300, y: 100, dist: 400 });
    expect(only(next, 'pinch')[0]?.next).toEqual({ x: 300, y: 200, dist: Math.hypot(400, 200) });
  });

  it('two background pointers never tap', () => {
    const m = createPressArbiter();
    m.down(sample(1, 100, 100, 0), BACKGROUND);
    m.down(sample(2, 140, 100, 1, 'touch', false), BACKGROUND);
    expect(only(m.up(sample(2, 140, 100, 5, 'touch', false)), 'tap')).toEqual([]);
    expect(only(m.up(sample(1, 100, 100, 6)), 'tap')).toEqual([]);
  });

  it('lifting one finger of a pinch leaves a pointer that neither taps nor jumps, and can pan on', () => {
    const m = createPressArbiter();
    m.down(sample(1, 100, 100, 0), BACKGROUND);
    m.down(sample(2, 300, 100, 1, 'touch', false), BACKGROUND);
    m.move(sample(2, 320, 100, 5, 'touch', false));
    const lifted = m.up(sample(2, 320, 100, 10, 'touch', false));
    expect(only(lifted, 'tap')).toEqual([]);
    expect(only(lifted, 'pinch')).toEqual([]);
    expect(m.stateOf(1)).toBe('view');
    // Within the slop of its position the remaining pointer does nothing and does not jump.
    expect(m.move(sample(1, 101, 100, 20))).toEqual([]);
    // Beyond the slop it pans, measured from where it was when the pinch ended.
    const panned = m.move(sample(1, 100 + TOUCH_SLOP_PX + 5, 100, 30));
    expect(only(panned, 'pan')).toEqual([{ type: 'pan', id: 1, dx: TOUCH_SLOP_PX + 5, dy: 0 }]);
    expect(only(m.up(sample(1, 100 + TOUCH_SLOP_PX + 5, 100, 40)), 'tap')).toEqual([]);
  });

  it('a third pointer is ignored and does not disturb the pinch', () => {
    const m = createPressArbiter();
    m.down(sample(1, 100, 100, 0), BACKGROUND);
    m.down(sample(2, 300, 100, 1, 'touch', false), BACKGROUND);
    expect(m.down(sample(3, 200, 200, 2, 'touch', false), BACKGROUND)).toEqual([]);
    expect(m.stateOf(3)).toBe('ignored');
    expect(m.move(sample(3, 250, 250, 3, 'touch', false))).toEqual([]);
    expect(m.up(sample(3, 250, 250, 4, 'touch', false))).toEqual([]);
    expect(m.stateOf(3)).toBeUndefined();
    expect(types(m.move(sample(2, 320, 100, 5, 'touch', false)))).toEqual(['pinch']);
  });

  it('a second pointer that lands on a control pinches with the first one', () => {
    const m = createPressArbiter();
    m.down(sample(1, 100, 100, 0), BACKGROUND);
    expect(types(m.down(sample(2, 300, 100, 1, 'touch', false), OWN))).toEqual(['pair-break']);
    expect(m.stateOf(2)).toBe('view');
    expect(types(m.move(sample(2, 330, 100, 5, 'touch', false)))).toEqual(['pinch']);
  });
});

describe('own pointer', () => {
  it('emits pair-break at down and nothing else, and is owned from the start', () => {
    const m = createPressArbiter();
    expect(types(m.down(sample(1, 10, 10, 0), OWN))).toEqual(['pair-break']);
    expect(m.stateOf(1)).toBe('owned');
    expect(m.move(sample(1, 10 + TOUCH_SLOP_PX * 5, 10, 10))).toEqual([]);
    expect(m.up(sample(1, 10 + TOUCH_SLOP_PX * 5, 10, 20))).toEqual([]);
    expect(m.stateOf(1)).toBeUndefined();
  });

  it('blocks every other pointer, background or own, while it exists', () => {
    const m = createPressArbiter();
    m.down(sample(1, 10, 10, 0), OWN);
    expect(m.down(sample(2, 300, 300, 1, 'touch', false), BACKGROUND)).toEqual([]);
    expect(m.down(sample(3, 400, 400, 2, 'touch', false), OWN)).toEqual([]);
    expect(m.stateOf(2)).toBe('ignored');
    expect(m.stateOf(3)).toBe('ignored');
    expect(m.move(sample(2, 340, 300, 3, 'touch', false))).toEqual([]);
    expect(m.up(sample(2, 340, 300, 4, 'touch', false))).toEqual([]);
    m.up(sample(1, 10, 10, 5));
    // With the owner gone a new pointer is a view pointer again.
    m.down(sample(4, 300, 300, 6), BACKGROUND);
    expect(m.stateOf(4)).toBe('view');
  });

  it('a cancelled own pointer is dropped without effects', () => {
    const m = createPressArbiter();
    m.down(sample(1, 10, 10, 0), OWN);
    expect(m.cancel(1)).toEqual([]);
    expect(m.stateOf(1)).toBeUndefined();
  });
});

describe('stale records, cancel, reset, untracked pointers', () => {
  it('a primary touch going down drops an old touch record with pair-break', () => {
    const m = createPressArbiter();
    m.down(sample(1, 10, 10, 0), OWN);
    // The pointerup of pointer 1 was lost: a new primary touch must not be ignored.
    const effects = m.down(sample(2, 300, 300, 100), BACKGROUND);
    expect(types(effects)).toEqual(['pair-break']);
    expect(m.stateOf(1)).toBeUndefined();
    expect(m.stateOf(2)).toBe('view');
  });

  it('a mouse going down does not drop a touch record, and a touch down does not drop a mouse record', () => {
    const touchFirst = createPressArbiter();
    touchFirst.down(sample(1, 10, 10, 0, 'touch'), OWN);
    touchFirst.down(sample(2, 300, 300, 1, 'mouse'), BACKGROUND);
    expect(touchFirst.stateOf(1)).toBe('owned');
    expect(touchFirst.stateOf(2)).toBe('ignored');

    const mouseFirst = createPressArbiter();
    mouseFirst.down(sample(1, 10, 10, 0, 'mouse'), OWN);
    mouseFirst.down(sample(2, 300, 300, 1, 'touch'), BACKGROUND);
    expect(mouseFirst.stateOf(1)).toBe('owned');
    expect(mouseFirst.stateOf(2)).toBe('ignored');
  });

  it('a non-primary pointer never sweeps', () => {
    const m = createPressArbiter();
    m.down(sample(1, 100, 100, 0), BACKGROUND);
    m.down(sample(2, 300, 100, 1, 'touch', false), BACKGROUND);
    expect(m.stateOf(1)).toBe('view');
    expect(m.stateOf(2)).toBe('view');
  });

  it('cancel of a tracked background pointer emits pair-break and drops it, no tap follows', () => {
    const m = createPressArbiter();
    m.down(sample(1, 10, 10, 0), BACKGROUND);
    expect(types(m.cancel(1))).toEqual(['pair-break']);
    expect(m.stateOf(1)).toBeUndefined();
    expect(m.up(sample(1, 10, 10, 10))).toEqual([]);
  });

  it('cancel of one pointer of a pinch leaves the other one settled', () => {
    const m = createPressArbiter();
    m.down(sample(1, 100, 100, 0), BACKGROUND);
    m.down(sample(2, 300, 100, 1, 'touch', false), BACKGROUND);
    expect(types(m.cancel(2))).toEqual(['pair-break']);
    expect(only(m.up(sample(1, 100, 100, 5)), 'tap')).toEqual([]);
  });

  it('pointers that are not tracked are ignored on move, up and cancel', () => {
    const m = createPressArbiter();
    expect(m.move(sample(9, 1, 1, 0))).toEqual([]);
    expect(m.up(sample(9, 1, 1, 0))).toEqual([]);
    expect(m.cancel(9)).toEqual([]);
    expect(m.stateOf(9)).toBeUndefined();
  });

  it('reset clears every record', () => {
    const m = createPressArbiter();
    m.down(sample(1, 10, 10, 0), BACKGROUND);
    m.down(sample(2, 300, 300, 1, 'touch', false), BACKGROUND);
    m.reset();
    expect(m.stateOf(1)).toBeUndefined();
    expect(m.stateOf(2)).toBeUndefined();
    expect(m.nextDeadline()).toBeNull();
    m.down(sample(3, 10, 10, 2), BACKGROUND);
    expect(types(m.up(sample(3, 10, 10, 3)))).toEqual(['tap']);
  });
});

describe('purity', () => {
  it('press-arbiter.ts imports only tap-intent and uses no timer, clock or DOM', () => {
    const raw = readFileSync(new URL('../src/ui/panel/press-arbiter.ts', import.meta.url), 'utf8');
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const imports = [...new Set([...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]))];
    expect(imports).toEqual(['./tap-intent']);
    for (const word of [
      'setTimeout',
      'setInterval',
      'requestAnimationFrame',
      'performance',
      'Date',
      'document',
      'window',
      'navigator',
    ]) {
      expect(new RegExp(`\\b${word}\\b`).test(code), word).toBe(false);
    }
  });
});
