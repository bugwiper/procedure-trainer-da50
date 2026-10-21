import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { defineRegistry } from '../src/engine/registry';
import { PanelStore } from '../src/engine/store';

// Store contract suite (PNL-06, D-06, D-07b, D-08). Inline fixture registries only: the real
// aircraft data is not under test here.

const VIEW_BOX = { w: 100, h: 100 };
const REGION = { id: 'deice', name: 'DE-ICE', bounds: { x: 0, y: 0, w: 100, h: 100 } };

/** Mirrors the D-07b de-ice ALTERNATE switch: a guarded toggle with a derived guard. */
function interlockStore(): PanelStore {
  return new PanelStore(
    defineRegistry({
      viewBox: VIEW_BOX,
      regions: [REGION],
      controls: [
        {
          kind: 'guarded-toggle',
          id: 'sw.deice_alternate',
          label: 'ALTERNATE',
          region: 'deice',
          x: 50,
          y: 50,
          hit: { w: 40, h: 40 },
          states: [
            { id: 'off', label: 'OFF' },
            { id: 'on', label: 'ON' },
          ],
          default: 'off',
          guardOpenHit: { x: -20, y: -30, w: 40, h: 14 },
        },
      ],
    }),
  );
}

describe('guard interlock', () => {
  const SW = 'sw.deice_alternate';
  const GUARD = 'sw.deice_alternate.guard';

  it('blocks the switch while the guard is closed and records nothing', () => {
    const store = interlockStore();
    const seen: unknown[] = [];
    store.subscribe((e) => seen.push(e));
    expect(store.isBlocked(SW)).toBe(true);
    expect(store.dispatch(SW, 'on', 1)).toEqual({ ok: false, reason: 'blocked' });
    expect(store.get(SW)).toBe('off');
    expect(store.events()).toHaveLength(0);
    expect(seen).toHaveLength(0);
  });

  it('lets the switch move once the guard is lifted', () => {
    const store = interlockStore();
    expect(store.dispatch(GUARD, 'open', 1).ok).toBe(true);
    expect(store.isBlocked(SW)).toBe(false);
    expect(store.dispatch(SW, 'on', 2).ok).toBe(true);
    expect(store.get(SW)).toBe('on');
  });

  it('keeps the guard open after the switch moves (no auto-close)', () => {
    const store = interlockStore();
    store.dispatch(GUARD, 'open', 1);
    store.dispatch(SW, 'on', 2);
    expect(store.get(GUARD)).toBe('open');
    expect(store.isBlocked(SW)).toBe(false);
  });

  it('closing the guard keeps the switch where it is', () => {
    const store = interlockStore();
    store.dispatch(GUARD, 'open', 1);
    store.dispatch(SW, 'on', 2);
    expect(store.dispatch(GUARD, 'closed', 3).ok).toBe(true);
    expect(store.get(GUARD)).toBe('closed');
    expect(store.get(SW)).toBe('on');
  });

  it('blocks the switch again after the guard is closed', () => {
    const store = interlockStore();
    store.dispatch(GUARD, 'open', 1);
    store.dispatch(SW, 'on', 2);
    store.dispatch(GUARD, 'closed', 3);
    expect(store.isBlocked(SW)).toBe(true);
    expect(store.dispatch(SW, 'off', 4)).toEqual({ ok: false, reason: 'blocked' });
    expect(store.get(SW)).toBe('on');
    expect(store.events().map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  it('isBlocked mirrors the guard state throughout', () => {
    const store = interlockStore();
    const trail: boolean[] = [store.isBlocked(SW)];
    store.dispatch(GUARD, 'open', 1);
    trail.push(store.isBlocked(SW));
    store.dispatch(SW, 'on', 2);
    trail.push(store.isBlocked(SW));
    store.dispatch(GUARD, 'closed', 3);
    trail.push(store.isBlocked(SW));
    expect(trail).toEqual([true, false, false, true]);
  });
});

function plainStore(): PanelStore {
  return new PanelStore(
    defineRegistry({
      viewBox: VIEW_BOX,
      regions: [REGION],
      controls: [
        {
          kind: 'toggle',
          id: 'sw.engine_master',
          label: 'ENGINE MASTER',
          region: 'deice',
          x: 20,
          y: 20,
          hit: { w: 30, h: 30 },
          states: [
            { id: 'off', label: 'OFF' },
            { id: 'on', label: 'ON' },
          ],
          default: 'off',
        },
        {
          kind: 'detent-lever',
          id: 'lv.flaps',
          label: 'FLAPS',
          region: 'deice',
          x: 70,
          y: 50,
          hit: { w: 30, h: 60 },
          detents: [
            { id: 'up', label: 'UP', pos: 0 },
            { id: 'down', label: 'DOWN', pos: 1 },
          ],
          default: 'up',
          track: { length: 50, axis: 'v' },
        },
      ],
    }),
  );
}

describe('store contract', () => {
  it('starts with every control at its default', () => {
    const store = plainStore();
    expect(store.snapshot()).toEqual({ 'sw.engine_master': 'off', 'lv.flaps': 'up' });
    expect(store.events()).toEqual([]);
  });

  it('numbers accepted changes from 0 in order and returns them from events()', () => {
    const store = plainStore();
    const a = store.dispatch('sw.engine_master', 'on', 0);
    const b = store.dispatch('lv.flaps', 'down', 5);
    const c = store.dispatch('sw.engine_master', 'off', 9);
    expect([a, b, c].map((r) => r.ok && r.event.seq)).toEqual([0, 1, 2]);
    expect(store.events().map((e) => [e.seq, e.t, e.id, e.value, e.source])).toEqual([
      [0, 0, 'sw.engine_master', 'on', 'user'],
      [1, 5, 'lv.flaps', 'down', 'user'],
      [2, 9, 'sw.engine_master', 'off', 'user'],
    ]);
  });

  it.each([
    ['unknown', 'sw.nope', 'on', 'unknown'],
    ['illegal-state', 'sw.engine_master', 'sideways', 'illegal-state'],
    ['unchanged', 'sw.engine_master', 'off', 'unchanged'],
  ] as const)(
    'rejects %s without an event, a notification or a state change',
    (_name, id, value, reason) => {
      const store = plainStore();
      const before = store.snapshot();
      const seen: unknown[] = [];
      store.subscribe((e) => seen.push(e));
      expect(store.dispatch(id, value, 1)).toEqual({ ok: false, reason });
      expect(store.events()).toHaveLength(0);
      expect(seen).toHaveLength(0);
      expect(store.snapshot()).toEqual(before);
    },
  );

  it('a rejected request does not consume a sequence number', () => {
    const store = plainStore();
    store.dispatch('sw.engine_master', 'off', 1);
    const ok = store.dispatch('sw.engine_master', 'on', 2);
    expect(ok.ok && ok.event.seq).toBe(0);
  });

  it('notifies once per accepted change and unsubscribe stops notifications', () => {
    const store = plainStore();
    const seen: number[] = [];
    const off = store.subscribe((e) => seen.push(e.seq));
    store.dispatch('sw.engine_master', 'on', 1);
    store.dispatch('sw.engine_master', 'on', 2);
    store.dispatch('lv.flaps', 'down', 3);
    expect(seen).toEqual([0, 1]);
    off();
    store.dispatch('sw.engine_master', 'off', 4);
    expect(seen).toEqual([0, 1]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('throws RangeError for t = %s', (t) => {
    const store = plainStore();
    expect(() => store.dispatch('sw.engine_master', 'on', t)).toThrow(RangeError);
    expect(store.events()).toHaveLength(0);
    expect(store.get('sw.engine_master')).toBe('off');
  });
});

// The real ALTERNATE switch after plan 22: a bat toggle (no rocker) under its guard, states in the
// order on, off, default off (the guarded position is up). The interlock is unchanged (T-01.1-44).
describe('guard interlock of the real ALTERNATE switch (plan 22)', () => {
  const SW = 'sw.deice_alternate';
  const GUARD = 'sw.deice_alternate.guard';

  it('starts off with the guard closed and blocks the switch', () => {
    const store = new PanelStore(DA50RG);
    expect(store.get(SW)).toBe('off');
    expect(store.get(GUARD)).toBe('closed');
    expect(store.isBlocked(SW)).toBe(true);
    expect(store.dispatch(SW, 'on', 1)).toEqual({ ok: false, reason: 'blocked' });
    expect(store.events()).toHaveLength(0);
  });

  it('lift, switch on, switch off, close records exactly those four events', () => {
    const store = new PanelStore(DA50RG);
    expect(store.dispatch(GUARD, 'open', 1).ok).toBe(true);
    expect(store.dispatch(SW, 'on', 2).ok).toBe(true);
    expect(store.dispatch(SW, 'off', 3).ok).toBe(true);
    expect(store.dispatch(GUARD, 'closed', 4).ok).toBe(true);
    expect(store.events().map((e) => [e.id, e.value])).toEqual([
      [GUARD, 'open'],
      [SW, 'on'],
      [SW, 'off'],
      [GUARD, 'closed'],
    ]);
    // Closed again: blocked again.
    expect(store.dispatch(SW, 'on', 5)).toEqual({ ok: false, reason: 'blocked' });
  });
});
