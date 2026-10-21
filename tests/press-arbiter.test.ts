import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DRAG_START_PX,
  MOMENTARY_HOLD_MS,
  createPressArbiter,
} from '../src/ui/panel/press-arbiter';
import type { PressEffect, PointerSample, TargetDescriptor } from '../src/ui/panel/press-arbiter';
import { MOUSE_SLOP_PX, TAP_MAX_MS, TOUCH_SLOP_PX, slopPx } from '../src/ui/panel/tap-intent';
import type { PointerKind } from '../src/ui/panel/tap-intent';

// The press arbitration machine (R3-Z2): a pure function of pointer samples. Every number below
// comes from the exported constants and slopPx, never from a literal of a slop or a window.

const BACKGROUND: TargetDescriptor = { cls: 'background', key: null };
const OWN: TargetDescriptor = { cls: 'own', key: 'lever.gear', dragStartPx: 0 };
const LATCH: TargetDescriptor = { cls: 'latch', key: 'sw.fuel_trans' };
const MOMENTARY: TargetDescriptor = { cls: 'momentary', key: 'btn.start' };
const DRAG: TargetDescriptor = { cls: 'own', key: 'lever.throttle', dragStartPx: DRAG_START_PX };

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

describe('own pointer with a join key (R3-Z3: a lever handle resting on the marker just tapped)', () => {
  const JOIN: TargetDescriptor = {
    cls: 'own',
    key: 'lv.flaps',
    dragStartPx: DRAG_START_PX,
    joinKey: 'lv.flaps:to',
  };

  it('does not end a pair at down and is pending like any drag control', () => {
    const m = createPressArbiter();
    expect(m.down(sample(1, 10, 10, 0), JOIN)).toEqual([]);
    expect(m.stateOf(1)).toBe('pending');
  });

  it('a still quick lift is a join-only tap with the join key', () => {
    const m = createPressArbiter();
    m.down(sample(1, 10, 10, 0), JOIN);
    const taps = only(m.up(sample(1, 10, 10, TAP_MAX_MS)), 'tap');
    expect(taps).toHaveLength(1);
    expect(taps[0]?.key).toBe('lv.flaps:to');
    expect(taps[0]?.quick).toBe(true);
    expect(taps[0]?.joinOnly).toBe(true);
    expect(m.stateOf(1)).toBeUndefined();
  });

  it('a lift later than TAP_MAX_MS ends the pair and taps nothing', () => {
    const m = createPressArbiter();
    m.down(sample(1, 10, 10, 0), JOIN);
    expect(types(m.up(sample(1, 10, 10, TAP_MAX_MS + 1)))).toEqual(['pair-break']);
  });

  it('a drag past DRAG_START_PX ends the pair once and owns the pointer, the lift says nothing', () => {
    const m = createPressArbiter();
    m.down(sample(1, 10, 10, 0), JOIN);
    expect(types(m.move(sample(1, 10 + DRAG_START_PX, 10, 5)))).toEqual(['pair-break']);
    expect(m.stateOf(1)).toBe('owned');
    expect(m.move(sample(1, 10 + DRAG_START_PX * 4, 10, 10))).toEqual([]);
    expect(m.up(sample(1, 10 + DRAG_START_PX * 4, 10, 20))).toEqual([]);
  });

  it('a cancel ends the pair; a second finger discards the press and ends the pair', () => {
    const a = createPressArbiter();
    a.down(sample(1, 10, 10, 0), JOIN);
    expect(types(a.cancel(1))).toEqual(['pair-break']);
    const b = createPressArbiter();
    b.down(sample(1, 10, 10, 0), JOIN);
    expect(types(b.down(sample(2, 300, 300, 1, 'touch', false), BACKGROUND))).toEqual([
      'discard',
      'pair-break',
    ]);
  });

  it('an own descriptor without a join key still ends the pair at down and lifts without a tap', () => {
    const m = createPressArbiter();
    expect(types(m.down(sample(1, 10, 10, 0), DRAG))).toEqual(['pair-break']);
    expect(m.up(sample(1, 10, 10, 20))).toEqual([]);
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

describe('latch pointer', () => {
  it('down emits pending on and nothing else; the state is pending', () => {
    const m = createPressArbiter();
    expect(m.down(sample(1, 50, 60, 0), LATCH)).toEqual([
      { type: 'pending', id: 1, key: 'sw.fuel_trans', on: true },
    ]);
    expect(m.stateOf(1)).toBe('pending');
    expect(m.nextDeadline()).toBeNull();
  });

  for (const kind of ['touch', 'mouse'] as const) {
    it(`a ${kind} lift within the slop is a tap with the key, both points and the duration`, () => {
      const slop = slopPx(kind);
      const m = createPressArbiter();
      m.down(sample(1, 50, 60, 1000, kind), LATCH);
      expect(m.move(sample(1, 50 + slop, 60, 1010, kind))).toEqual([]);
      const up = m.up(sample(1, 50, 60 + slop, 1100, kind));
      expect(up).toEqual([
        { type: 'pending', id: 1, key: 'sw.fuel_trans', on: false },
        {
          type: 'tap',
          id: 1,
          key: 'sw.fuel_trans',
          down: { x: 50, y: 60 },
          up: { x: 50, y: 60 + slop },
          durationMs: 100,
          at: 1100,
          quick: true,
        },
      ]);
      expect(m.stateOf(1)).toBeUndefined();
    });
  }

  it('a press longer than TAP_MAX_MS within the slop is still a tap with quick false', () => {
    const m = createPressArbiter();
    m.down(sample(1, 50, 60, 0), LATCH);
    const tap = only(m.up(sample(1, 50, 60, TAP_MAX_MS + 1)), 'tap')[0];
    expect(tap?.quick).toBe(false);
    expect(tap?.durationMs).toBe(TAP_MAX_MS + 1);
  });

  for (const kind of ['touch', 'mouse'] as const) {
    it(`a ${kind} move beyond the slop discards the press once and the pointer pans from its down point`, () => {
      const slop = slopPx(kind);
      const m = createPressArbiter();
      m.down(sample(1, 50, 60, 0, kind), LATCH);
      const moved = m.move(sample(1, 50 + slop + 1, 60, 10, kind));
      expect(moved).toEqual([
        { type: 'pending', id: 1, key: 'sw.fuel_trans', on: false },
        { type: 'discard', id: 1, key: 'sw.fuel_trans' },
        { type: 'pair-break' },
        { type: 'pan', id: 1, dx: slop + 1, dy: 0 },
      ]);
      expect(m.stateOf(1)).toBe('view');
      const again = m.move(sample(1, 50 + slop + 4, 60, 20, kind));
      expect(again).toEqual([{ type: 'pan', id: 1, dx: 3, dy: 0 }]);
      // Its lift is no tap and nothing else of the control.
      expect(types(m.up(sample(1, 50 + slop + 4, 60, 30, kind)))).toEqual(['pair-break']);
    });
  }

  it('a lift beyond the slop without a move discards the press', () => {
    const m = createPressArbiter();
    m.down(sample(1, 50, 60, 0), LATCH);
    expect(types(m.up(sample(1, 50 + TOUCH_SLOP_PX + 1, 60, 10)))).toEqual([
      'pending',
      'discard',
      'pair-break',
    ]);
  });

  it('a second pointer discards the pending press and both pinch; neither taps on lift', () => {
    const m = createPressArbiter();
    m.down(sample(1, 50, 60, 0), LATCH);
    const second = m.down(sample(2, 250, 60, 5, 'touch', false), LATCH);
    expect(second).toEqual([
      { type: 'pending', id: 1, key: 'sw.fuel_trans', on: false },
      { type: 'discard', id: 1, key: 'sw.fuel_trans' },
      { type: 'pair-break' },
    ]);
    expect(m.stateOf(1)).toBe('view');
    expect(m.stateOf(2)).toBe('view');
    expect(types(m.move(sample(2, 270, 60, 10, 'touch', false)))).toEqual(['pinch']);
    expect(only(m.up(sample(2, 270, 60, 15, 'touch', false)), 'tap')).toEqual([]);
    expect(only(m.up(sample(1, 50, 60, 20)), 'tap')).toEqual([]);
  });

  it('cancel discards the press and emits no tap; a latch never emits press or release', () => {
    const m = createPressArbiter();
    m.down(sample(1, 50, 60, 0), LATCH);
    const cancelled = m.cancel(1);
    expect(types(cancelled)).toEqual(['pending', 'discard', 'pair-break']);
    expect(m.up(sample(1, 50, 60, 10))).toEqual([]);

    const m2 = createPressArbiter();
    const all = [
      ...m2.down(sample(1, 50, 60, 0), LATCH),
      ...m2.move(sample(1, 60, 60, 5)),
      ...m2.tick(10_000),
      ...m2.up(sample(1, 60, 60, 10)),
    ];
    expect(types(all)).not.toContain('press');
    expect(types(all)).not.toContain('release');
  });

  it('a latch pointer is blocked by a held momentary and by an owned pointer', () => {
    const m = createPressArbiter();
    m.down(sample(1, 10, 10, 0), OWN);
    expect(m.down(sample(2, 50, 60, 1, 'touch', false), LATCH)).toEqual([]);
    expect(m.stateOf(2)).toBe('ignored');
  });
});

describe('momentary pointer', () => {
  it('down emits pair-break only and the deadline is the down time plus MOMENTARY_HOLD_MS', () => {
    const m = createPressArbiter();
    expect(types(m.down(sample(1, 50, 60, 1000), MOMENTARY))).toEqual(['pair-break']);
    expect(m.stateOf(1)).toBe('pending');
    expect(m.nextDeadline()).toBe(1000 + MOMENTARY_HOLD_MS);
  });

  it('tick before the deadline emits nothing; at the deadline it commits the press once', () => {
    const m = createPressArbiter();
    m.down(sample(1, 50, 60, 1000), MOMENTARY);
    expect(m.tick(1000 + MOMENTARY_HOLD_MS - 1)).toEqual([]);
    expect(m.stateOf(1)).toBe('pending');
    const press = m.tick(1000 + MOMENTARY_HOLD_MS);
    expect(press).toEqual([{ type: 'press', id: 1, key: 'btn.start', at: { x: 50, y: 60 } }]);
    expect(m.stateOf(1)).toBe('held');
    expect(m.tick(1000 + MOMENTARY_HOLD_MS + 500)).toEqual([]);
    expect(m.nextDeadline()).toBeNull();
  });

  it('a lift before the deadline without movement is a quick tap: press then release', () => {
    const m = createPressArbiter();
    m.down(sample(1, 50, 60, 1000), MOMENTARY);
    const up = m.up(sample(1, 50, 60, 1000 + MOMENTARY_HOLD_MS - 1));
    expect(up).toEqual([
      { type: 'press', id: 1, key: 'btn.start', at: { x: 50, y: 60 } },
      { type: 'release', id: 1, key: 'btn.start' },
    ]);
    expect(m.nextDeadline()).toBeNull();
    expect(m.tick(5000)).toEqual([]);
  });

  for (const kind of ['touch', 'mouse'] as const) {
    it(`a ${kind} move beyond the slop before the commit discards and pans, never presses`, () => {
      const slop = slopPx(kind);
      const m = createPressArbiter();
      m.down(sample(1, 50, 60, 1000, kind), MOMENTARY);
      expect(m.move(sample(1, 50 + slop, 60, 1010, kind))).toEqual([]);
      const moved = m.move(sample(1, 50 + slop + 1, 60, 1020, kind));
      expect(moved).toEqual([
        { type: 'discard', id: 1, key: 'btn.start' },
        { type: 'pair-break' },
        { type: 'pan', id: 1, dx: slop + 1, dy: 0 },
      ]);
      expect(m.stateOf(1)).toBe('view');
      expect(m.nextDeadline()).toBeNull();
      expect(m.tick(1000 + MOMENTARY_HOLD_MS)).toEqual([]);
      expect(types(m.up(sample(1, 50 + slop + 1, 60, 1200, kind)))).toEqual(['pair-break']);
    });
  }

  it('a second pointer before the commit discards and starts a pinch, no press', () => {
    const m = createPressArbiter();
    m.down(sample(1, 50, 60, 1000), MOMENTARY);
    const second = m.down(sample(2, 250, 60, 1050, 'touch', false), LATCH);
    expect(second).toEqual([{ type: 'discard', id: 1, key: 'btn.start' }, { type: 'pair-break' }]);
    expect(m.nextDeadline()).toBeNull();
    expect(m.tick(2000)).toEqual([]);
    expect(types(m.move(sample(2, 270, 60, 1060, 'touch', false)))).toEqual(['pinch']);
  });

  it('once held every move emits nothing, a second pointer is ignored, the lift releases once', () => {
    const m = createPressArbiter();
    m.down(sample(1, 50, 60, 1000), MOMENTARY);
    m.tick(1000 + MOMENTARY_HOLD_MS);
    expect(m.move(sample(1, 50 + TOUCH_SLOP_PX * 20, 60, 1500))).toEqual([]);
    expect(m.down(sample(2, 250, 60, 1600, 'touch', false), BACKGROUND)).toEqual([]);
    expect(m.stateOf(2)).toBe('ignored');
    expect(m.move(sample(2, 300, 60, 1650, 'touch', false))).toEqual([]);
    expect(m.up(sample(2, 300, 60, 1700, 'touch', false))).toEqual([]);
    expect(m.up(sample(1, 50, 60, 1800))).toEqual([{ type: 'release', id: 1, key: 'btn.start' }]);
    expect(m.tick(5000)).toEqual([]);
    expect(m.up(sample(1, 50, 60, 1900))).toEqual([]);
  });

  it('a cancel of a held press releases exactly once, so the control is never stuck', () => {
    const m = createPressArbiter();
    m.down(sample(1, 50, 60, 1000), MOMENTARY);
    m.tick(1000 + MOMENTARY_HOLD_MS);
    const cancelled = m.cancel(1);
    expect(only(cancelled, 'release')).toEqual([{ type: 'release', id: 1, key: 'btn.start' }]);
    expect(types(cancelled)).toEqual(['release', 'pair-break']);
    expect(m.cancel(1)).toEqual([]);
    expect(m.up(sample(1, 50, 60, 1500))).toEqual([]);
  });

  it('a cancel before the commit discards and never presses', () => {
    const m = createPressArbiter();
    m.down(sample(1, 50, 60, 1000), MOMENTARY);
    expect(types(m.cancel(1))).toEqual(['discard', 'pair-break']);
    expect(m.nextDeadline()).toBeNull();
    expect(m.tick(5000)).toEqual([]);
  });

  it('nextDeadline is null when nothing is pending and again once the press was taken away', () => {
    const m = createPressArbiter();
    expect(m.nextDeadline()).toBeNull();
    m.down(sample(1, 50, 60, 1000, 'mouse'), MOMENTARY);
    expect(m.nextDeadline()).toBe(1000 + MOMENTARY_HOLD_MS);
    // A second pointer (any kind) takes the pending press away: it becomes a pinch.
    m.down(sample(2, 90, 60, 1040, 'touch'), MOMENTARY);
    expect(m.nextDeadline()).toBeNull();
  });
});

describe('own pointer with a drag threshold', () => {
  it('is pending and silent until its travel reaches dragStartPx (inclusive), then owned', () => {
    const m = createPressArbiter();
    expect(types(m.down(sample(1, 10, 10, 0), DRAG))).toEqual(['pair-break']);
    expect(m.stateOf(1)).toBe('pending');
    expect(m.move(sample(1, 10 + DRAG_START_PX - 1, 10, 5))).toEqual([]);
    expect(m.stateOf(1)).toBe('pending');
    expect(m.move(sample(1, 10 + DRAG_START_PX, 10, 10))).toEqual([]);
    expect(m.stateOf(1)).toBe('owned');
    expect(m.down(sample(2, 300, 300, 15, 'touch', false), BACKGROUND)).toEqual([]);
    expect(m.stateOf(2)).toBe('ignored');
  });

  it('a second pointer before the threshold takes it away: discard, pair-break, pinch', () => {
    const m = createPressArbiter();
    m.down(sample(1, 10, 10, 0), DRAG);
    const second = m.down(sample(2, 300, 300, 5, 'touch', false), BACKGROUND);
    expect(second).toEqual([
      { type: 'discard', id: 1, key: 'lever.throttle' },
      { type: 'pair-break' },
    ]);
    expect(m.stateOf(1)).toBe('view');
    expect(types(m.move(sample(2, 320, 300, 10, 'touch', false)))).toEqual(['pinch']);
  });

  it('never emits tap, press, release, pan or pinch for its own pointer', () => {
    const m = createPressArbiter();
    const all = [
      ...m.down(sample(1, 10, 10, 0), DRAG),
      ...m.move(sample(1, 10 + DRAG_START_PX * 10, 10, 5)),
      ...m.move(sample(1, 10 + DRAG_START_PX * 20, 10, 10)),
      ...m.up(sample(1, 10 + DRAG_START_PX * 20, 10, 15)),
    ];
    expect(types(all)).toEqual(['pair-break']);
  });

  it('up and cancel of a pending-own pointer drop it without effects', () => {
    const up = createPressArbiter();
    up.down(sample(1, 10, 10, 0), DRAG);
    expect(up.up(sample(1, 10, 10, 5))).toEqual([]);
    expect(up.stateOf(1)).toBeUndefined();
    const cancel = createPressArbiter();
    cancel.down(sample(1, 10, 10, 0), DRAG);
    expect(cancel.cancel(1)).toEqual([]);
    expect(cancel.stateOf(1)).toBeUndefined();
  });

  it('a stale pending-own record is swept with a discard by the next primary pointer', () => {
    const m = createPressArbiter();
    m.down(sample(1, 10, 10, 0), DRAG);
    expect(m.down(sample(2, 300, 300, 100), BACKGROUND)).toEqual([
      { type: 'discard', id: 1, key: 'lever.throttle' },
      { type: 'pair-break' },
    ]);
    expect(m.stateOf(2)).toBe('view');
  });
});

describe('stale sweep and reset with every class', () => {
  it('a stale held momentary is released by the sweep, a stale pending latch is discarded', () => {
    const held = createPressArbiter();
    held.down(sample(1, 50, 60, 0), MOMENTARY);
    held.tick(MOMENTARY_HOLD_MS);
    expect(held.down(sample(2, 300, 300, 1000), BACKGROUND)).toEqual([
      { type: 'release', id: 1, key: 'btn.start' },
      { type: 'pair-break' },
    ]);
    expect(held.stateOf(2)).toBe('view');

    const latch = createPressArbiter();
    latch.down(sample(1, 50, 60, 0), LATCH);
    expect(latch.down(sample(2, 300, 300, 1000), BACKGROUND)).toEqual([
      { type: 'pending', id: 1, key: 'sw.fuel_trans', on: false },
      { type: 'discard', id: 1, key: 'sw.fuel_trans' },
      { type: 'pair-break' },
    ]);
  });

  it('reset discards every pending press, releases every held one and clears the machine', () => {
    const m = createPressArbiter();
    m.down(sample(1, 50, 60, 0, 'mouse'), MOMENTARY);
    m.tick(MOMENTARY_HOLD_MS);
    // A held press blocks every other pointer: this one is only tracked as ignored.
    m.down(sample(2, 90, 60, 10, 'touch'), LATCH);
    const effects = m.reset();
    expect(effects).toEqual([{ type: 'release', id: 1, key: 'btn.start' }]);
    expect(m.stateOf(1)).toBeUndefined();
    expect(m.stateOf(2)).toBeUndefined();
    expect(m.nextDeadline()).toBeNull();

    const pending = createPressArbiter();
    pending.down(sample(1, 50, 60, 0), LATCH);
    expect(pending.reset()).toEqual([
      { type: 'pending', id: 1, key: 'sw.fuel_trans', on: false },
      { type: 'discard', id: 1, key: 'sw.fuel_trans' },
    ]);
    const momentary = createPressArbiter();
    momentary.down(sample(1, 50, 60, 0), MOMENTARY);
    expect(momentary.reset()).toEqual([{ type: 'discard', id: 1, key: 'btn.start' }]);
    expect(momentary.nextDeadline()).toBeNull();
  });

  it('mixing kinds keeps their slops separate: a mouse press and a touch press', () => {
    const between = MOUSE_SLOP_PX + 1;
    const mouse = createPressArbiter();
    mouse.down(sample(1, 0, 0, 0, 'mouse'), LATCH);
    expect(types(mouse.move(sample(1, between, 0, 5, 'mouse')))).toContain('discard');
    const touch = createPressArbiter();
    touch.down(sample(1, 0, 0, 0, 'touch'), LATCH);
    expect(touch.move(sample(1, between, 0, 5, 'touch'))).toEqual([]);
    expect(types(touch.up(sample(1, between, 0, 10, 'touch')))).toContain('tap');
  });

  it('stateOf reports pending, held, view, owned, ignored and undefined through the sequences', () => {
    const m = createPressArbiter();
    expect(m.stateOf(1)).toBeUndefined();
    m.down(sample(1, 50, 60, 0, 'mouse'), MOMENTARY);
    expect(m.stateOf(1)).toBe('pending');
    m.tick(MOMENTARY_HOLD_MS);
    expect(m.stateOf(1)).toBe('held');
    m.down(sample(2, 90, 60, 10, 'touch'), BACKGROUND);
    expect(m.stateOf(2)).toBe('ignored');
    m.up(sample(1, 50, 60, 40, 'mouse'));
    expect(m.stateOf(1)).toBeUndefined();
    expect(m.stateOf(2)).toBe('ignored');
    const view = createPressArbiter();
    view.down(sample(1, 90, 60, 10), BACKGROUND);
    expect(view.stateOf(1)).toBe('view');
    const own = createPressArbiter();
    own.down(sample(1, 10, 10, 0), OWN);
    expect(own.stateOf(1)).toBe('owned');
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
