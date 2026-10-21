import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { defineRegistry } from '../src/engine/registry';
import { deriveState, PanelStore } from '../src/engine/store';

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

describe('circuit breaker events (PNL-12, D-03)', () => {
  const ID = 'cb.pitot';

  it('starts pushed in', () => {
    expect(new PanelStore(DA50RG).get(ID)).toBe('in');
  });

  it('records a pull as one user event and rejects the same value again as unchanged', () => {
    const store = new PanelStore(DA50RG);
    const first = store.dispatch(ID, 'out', 1500);
    expect(first.ok).toBe(true);
    expect(store.get(ID)).toBe('out');
    expect(store.events()).toEqual([{ seq: 0, t: 1500, id: ID, value: 'out', source: 'user' }]);
    expect(store.dispatch(ID, 'out', 1600)).toEqual({ ok: false, reason: 'unchanged' });
    expect(store.events()).toHaveLength(1);
  });

  it('records the push in as a second event', () => {
    const store = new PanelStore(DA50RG);
    store.dispatch(ID, 'out', 1);
    expect(store.dispatch(ID, 'in', 2).ok).toBe(true);
    expect(store.get(ID)).toBe('in');
    expect(store.events().map((e) => [e.seq, e.id, e.value, e.source])).toEqual([
      [0, ID, 'out', 'user'],
      [1, ID, 'in', 'user'],
    ]);
  });

  it('rejects an illegal state value and an unknown breaker id, recording nothing', () => {
    const store = new PanelStore(DA50RG);
    expect(store.dispatch(ID, 'stuck', 1)).toEqual({ ok: false, reason: 'illegal-state' });
    expect(store.dispatch('cb.no_such_breaker', 'out', 2)).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(store.events()).toHaveLength(0);
    expect(store.get(ID)).toBe('in');
  });
});

// Log-level retract (owner finding R3-Z3, Table S1 of plan 35): the last event leaves the log and
// the state is recomputed from the log; it is not countered by a new event.
describe('deriveState', () => {
  it('is the default of every control when the log is empty', () => {
    const store = plainStore();
    expect(deriveState(store.registry, [])).toEqual(store.snapshot());
  });

  it('equals the live state after a scripted sequence (the later value wins)', () => {
    const store = plainStore();
    store.dispatch('sw.engine_master', 'on', 1);
    store.dispatch('lv.flaps', 'down', 2);
    store.dispatch('sw.engine_master', 'off', 3);
    store.dispatch('sw.engine_master', 'on', 4);
    expect(deriveState(store.registry, store.events())).toEqual(store.snapshot());
    expect(deriveState(store.registry, store.events())).toEqual({
      'sw.engine_master': 'on',
      'lv.flaps': 'down',
    });
  });
});

describe('retract', () => {
  it('removes the last event of a two-state switch and restores the previous value', () => {
    const store = plainStore();
    store.dispatch('sw.engine_master', 'on', 1);
    const result = store.retract(0);
    expect(result).toEqual({
      ok: true,
      event: { seq: 0, t: 1, id: 'sw.engine_master', value: 'on', source: 'user' },
      restored: 'off',
    });
    expect(store.get('sw.engine_master')).toBe('off');
    expect(store.events()).toEqual([]);
  });

  it('restores the value before the removed event, not the default', () => {
    const store = plainStore();
    store.dispatch('sw.engine_master', 'on', 1);
    store.dispatch('sw.engine_master', 'off', 2);
    store.dispatch('sw.engine_master', 'on', 3);
    expect(store.retract(2)).toMatchObject({ ok: true, restored: 'off' });
    expect(store.get('sw.engine_master')).toBe('off');
    expect(store.events().map((e) => e.seq)).toEqual([0, 1]);
  });

  it('restores a three-state toggle', () => {
    const store = new PanelStore(DA50RG);
    const toggle = DA50RG.controls.find((c) => c.kind === 'toggle' && c.states.length === 3);
    expect(toggle).toBeDefined();
    if (toggle?.kind !== 'toggle') return;
    const ids = toggle.states.map((s) => s.id);
    const other = ids.find((s) => s !== toggle.default);
    expect(other).toBeDefined();
    if (other === undefined) return;
    store.dispatch(toggle.id, other, 1);
    expect(store.retract(0)).toMatchObject({ ok: true, restored: toggle.default });
    expect(store.get(toggle.id)).toBe(toggle.default);
  });

  it('restores a lever detent and a breaker', () => {
    const store = new PanelStore(DA50RG);
    store.dispatch('lv.flaps', 'to', 1);
    store.dispatch('cb.pitot', 'out', 2);
    expect(store.retract(1)).toMatchObject({ ok: true, restored: 'in' });
    expect(store.get('cb.pitot')).toBe('in');
    expect(store.retract(0)).toMatchObject({ ok: true, restored: 'up' });
    expect(store.get('lv.flaps')).toBe('up');
    expect(store.events()).toEqual([]);
  });

  it('closes the guard again and blocks the switch again when the guard open event is retracted', () => {
    const store = interlockStore();
    store.dispatch('sw.deice_alternate.guard', 'open', 1);
    expect(store.isBlocked('sw.deice_alternate')).toBe(false);
    expect(store.retract(0).ok).toBe(true);
    expect(store.get('sw.deice_alternate.guard')).toBe('closed');
    expect(store.isBlocked('sw.deice_alternate')).toBe(true);
    expect(store.dispatch('sw.deice_alternate', 'on', 2)).toEqual({
      ok: false,
      reason: 'blocked',
    });
  });

  it('leaves the guard open when only the switch event is retracted', () => {
    const store = interlockStore();
    store.dispatch('sw.deice_alternate.guard', 'open', 1);
    store.dispatch('sw.deice_alternate', 'on', 2);
    expect(store.retract(1).ok).toBe(true);
    expect(store.get('sw.deice_alternate')).toBe('off');
    expect(store.get('sw.deice_alternate.guard')).toBe('open');
    expect(store.isBlocked('sw.deice_alternate')).toBe(false);
  });

  it('gives the same seq to the next accepted event and keeps seq dense', () => {
    const store = plainStore();
    store.dispatch('sw.engine_master', 'on', 1);
    store.dispatch('lv.flaps', 'down', 2);
    store.retract(1);
    const next = store.dispatch('lv.flaps', 'down', 5);
    expect(next.ok && next.event.seq).toBe(1);
    expect(store.events().map((e) => e.seq)).toEqual([0, 1]);
  });

  it('refuses a middle event with not-last and changes nothing', () => {
    const store = plainStore();
    store.dispatch('sw.engine_master', 'on', 1);
    store.dispatch('lv.flaps', 'down', 2);
    const before = store.snapshot();
    const log = store.events();
    const seen: unknown[] = [];
    store.subscribe((e) => seen.push(e));
    store.onRetract((e) => seen.push(e));
    expect(store.retract(0)).toEqual({ ok: false, reason: 'not-last' });
    expect(store.snapshot()).toEqual(before);
    expect(store.events()).toEqual(log);
    expect(seen).toHaveLength(0);
  });

  it.each([-1, 2, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses seq %s with unknown-event and changes nothing',
    (seq) => {
      const store = plainStore();
      store.dispatch('sw.engine_master', 'on', 1);
      store.dispatch('lv.flaps', 'down', 2);
      const before = store.snapshot();
      const seen: unknown[] = [];
      store.onRetract((e) => seen.push(e));
      expect(store.retract(seq)).toEqual({ ok: false, reason: 'unknown-event' });
      expect(store.snapshot()).toEqual(before);
      expect(store.events()).toHaveLength(2);
      expect(seen).toHaveLength(0);
    },
  );

  it('refuses on an empty log with unknown-event', () => {
    expect(plainStore().retract(0)).toEqual({ ok: false, reason: 'unknown-event' });
  });

  it('calls the retract listeners once with the removed event and the restored value, and not the dispatch listeners', () => {
    const store = plainStore();
    store.dispatch('sw.engine_master', 'on', 1);
    const dispatched: unknown[] = [];
    const retracted: unknown[] = [];
    store.subscribe((e) => dispatched.push(e));
    const off = store.onRetract((e, restored) => retracted.push([e.seq, e.id, e.value, restored]));
    store.retract(0);
    expect(dispatched).toHaveLength(0);
    expect(retracted).toEqual([[0, 'sw.engine_master', 'on', 'off']]);
    off();
    store.dispatch('sw.engine_master', 'on', 2);
    store.retract(0);
    expect(retracted).toHaveLength(1);
  });
});

describe('consumed watermark (the Phase 3 seam)', () => {
  function threeEvents(): PanelStore {
    const store = plainStore();
    store.dispatch('sw.engine_master', 'on', 1);
    store.dispatch('lv.flaps', 'down', 2);
    store.dispatch('sw.engine_master', 'off', 3);
    return store;
  }

  it('starts at minus 1', () => {
    expect(plainStore().consumedThrough).toBe(-1);
  });

  it('refuses events at or below the watermark with consumed and allows a later one', () => {
    const store = threeEvents();
    store.markConsumed(1);
    expect(store.consumedThrough).toBe(1);
    expect(store.retract(1)).toEqual({ ok: false, reason: 'consumed' });
    expect(store.retract(0)).toEqual({ ok: false, reason: 'consumed' });
    expect(store.retract(2)).toMatchObject({ ok: true });
    // The consumed event is now the last one and still refused.
    expect(store.retract(1)).toEqual({ ok: false, reason: 'consumed' });
    expect(store.events()).toHaveLength(2);
  });

  it('checks unknown-event before consumed and consumed before not-last', () => {
    const store = threeEvents();
    store.markConsumed(0);
    expect(store.retract(7)).toEqual({ ok: false, reason: 'unknown-event' });
    expect(store.retract(0)).toEqual({ ok: false, reason: 'consumed' });
    expect(store.retract(1)).toEqual({ ok: false, reason: 'not-last' });
  });

  it('keeps the watermark when the same value is marked again', () => {
    const store = threeEvents();
    store.markConsumed(1);
    expect(() => store.markConsumed(1)).not.toThrow();
    expect(store.consumedThrough).toBe(1);
  });

  it.each([0, 3, 4, 1.5, Number.NaN])(
    'throws RangeError for markConsumed(%s) after markConsumed(1) on a log of 3',
    (n) => {
      const store = threeEvents();
      store.markConsumed(1);
      expect(() => store.markConsumed(n)).toThrow(RangeError);
      expect(store.consumedThrough).toBe(1);
    },
  );

  it('throws RangeError for a watermark at the log length on an empty log', () => {
    expect(() => plainStore().markConsumed(0)).toThrow(RangeError);
  });
});
