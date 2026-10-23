import { describe, expect, it } from 'vitest';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { defineRegistry, legalStates } from '../src/engine/registry';
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

// Seeded random walk over the real registry (T-01.1-64): after every step the live state equals the
// defaults folded with the log, seq values are dense, and a replay into a fresh store agrees.
describe('retract random walk over the real DA50RG registry', () => {
  /** Small linear congruential generator; the walk is deterministic, no Math.random. */
  function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  function walk(seed: number, withConsumed: boolean): void {
    const rand = lcg(seed);
    const pick = <T>(items: readonly T[]): T => {
      const item = items[Math.floor(rand() * items.length)];
      if (item === undefined) throw new Error('empty pick');
      return item;
    };
    const store = new PanelStore(DA50RG);
    let t = 0;
    let watermark = -1;

    for (let step = 0; step < 300; step++) {
      const log = store.events();
      const roll = rand();
      if (roll < 0.35 && log.length > 0) {
        const last = log.length - 1;
        // A retract of any other seq is refused and leaves the log alone.
        if (last > 0) {
          const other = Math.floor(rand() * last);
          const before = store.events();
          const refusal = store.retract(other);
          expect(refusal.ok).toBe(false);
          expect(store.events()).toEqual(before);
        }
        const result = store.retract(last);
        if (last <= watermark) {
          expect(result).toEqual({ ok: false, reason: 'consumed' });
          expect(store.events()).toHaveLength(log.length);
        } else {
          expect(result.ok).toBe(true);
          expect(store.events()).toHaveLength(log.length - 1);
        }
      } else {
        const def = pick(DA50RG.controls);
        t += 1 + Math.floor(rand() * 50);
        store.dispatch(def.id, pick(legalStates(def)), t);
      }
      if (withConsumed && rand() < 0.1 && store.events().length > 0) {
        const through = store.events().length - 1;
        store.markConsumed(through);
        watermark = through;
        expect(store.consumedThrough).toBe(through);
        // The consumed newest event can no longer be removed.
        expect(store.retract(through)).toEqual({ ok: false, reason: 'consumed' });
        expect(store.events()).toHaveLength(through + 1);
      }

      const events = store.events();
      expect(store.snapshot()).toEqual(deriveState(DA50RG, events));
      expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i));
      expect(store.consumedThrough).toBe(watermark);
    }

    // Replaying the surviving log into a fresh store gives the same snapshot.
    const replay = new PanelStore(DA50RG);
    for (const e of store.events()) expect(replay.dispatch(e.id, e.value, e.t).ok).toBe(true);
    expect(replay.snapshot()).toEqual(store.snapshot());
    expect(replay.events()).toEqual(store.events());
  }

  it.each([1, 2, 3, 20261021])('seed %s: state equals the replayed log at every step', (seed) => {
    walk(seed, false);
  });

  it.each([1, 2, 3, 20261021])(
    'seed %s with markConsumed: consumed events never leave the log',
    (seed) => {
      walk(seed, true);
    },
  );
});

// Scenario baseline (plan 02-04, SCN-03, D-13): the initial state of a run is applied without a
// single event, and a retract rebuilds from it, never from the registry defaults.
describe('baseline and reset', () => {
  it('deriveState overlays the baseline on the defaults before the events', () => {
    const store = plainStore();
    const log = [{ seq: 0, t: 1, id: 'sw.engine_master', value: 'off', source: 'user' as const }];
    expect(deriveState(store.registry, [], { 'lv.flaps': 'down' })).toEqual({
      'sw.engine_master': 'off',
      'lv.flaps': 'down',
    });
    expect(
      deriveState(store.registry, log, { 'sw.engine_master': 'on', 'lv.flaps': 'down' }),
    ).toEqual({ 'sw.engine_master': 'off', 'lv.flaps': 'down' });
  });

  it('reset applies the baseline, empties the log and the watermark and creates no event', () => {
    const store = plainStore();
    store.dispatch('sw.engine_master', 'on', 1);
    store.dispatch('lv.flaps', 'down', 2);
    store.markConsumed(1);
    const dispatched: unknown[] = [];
    store.subscribe((e) => dispatched.push(e));
    store.reset({ 'lv.flaps': 'down' });
    expect(store.events()).toEqual([]);
    expect(store.consumedThrough).toBe(-1);
    expect(store.snapshot()).toEqual({ 'sw.engine_master': 'off', 'lv.flaps': 'down' });
    expect(store.baseline()).toEqual({ 'lv.flaps': 'down' });
    expect(dispatched).toEqual([]);
  });

  it('reset with no argument returns to the registry defaults', () => {
    const store = plainStore();
    store.reset({ 'lv.flaps': 'down' });
    store.reset();
    expect(store.snapshot()).toEqual({ 'sw.engine_master': 'off', 'lv.flaps': 'up' });
    expect(store.baseline()).toEqual({});
  });

  it('reset with an unknown id or an illegal state throws RangeError naming the id and changes nothing', () => {
    const store = plainStore();
    store.reset({ 'lv.flaps': 'down' });
    store.dispatch('sw.engine_master', 'on', 1);
    expect(() => store.reset({ 'sw.nothing': 'on' })).toThrow(RangeError);
    expect(() => store.reset({ 'sw.nothing': 'on' })).toThrow(/sw\.nothing/);
    expect(() => store.reset({ 'lv.flaps': 'sideways' })).toThrow(/lv\.flaps/);
    expect(store.events()).toHaveLength(1);
    expect(store.baseline()).toEqual({ 'lv.flaps': 'down' });
    expect(store.snapshot()).toEqual({ 'sw.engine_master': 'on', 'lv.flaps': 'down' });
  });

  it('calls the reset listeners once per reset and not the dispatch listeners', () => {
    const store = plainStore();
    let resets = 0;
    let dispatches = 0;
    const off = store.onReset(() => {
      resets += 1;
    });
    store.subscribe(() => {
      dispatches += 1;
    });
    store.reset({ 'lv.flaps': 'down' });
    expect(resets).toBe(1);
    expect(dispatches).toBe(0);
    off();
    store.reset();
    expect(resets).toBe(1);
  });

  it('baseline() is a frozen copy', () => {
    const store = plainStore();
    const given = { 'lv.flaps': 'down' };
    store.reset(given);
    given['lv.flaps'] = 'up';
    const copy = store.baseline();
    expect(copy).toEqual({ 'lv.flaps': 'down' });
    expect(Object.isFrozen(copy)).toBe(true);
  });

  it('a retract rebuilds from the baseline, never from the registry default', () => {
    const store = plainStore();
    store.reset({ 'lv.flaps': 'down' });
    store.dispatch('sw.engine_master', 'on', 1);
    store.dispatch('lv.flaps', 'up', 2);
    expect(store.retract(1)).toMatchObject({ ok: true, restored: 'down' });
    expect(store.get('lv.flaps')).toBe('down');
    expect(store.retract(0)).toMatchObject({ ok: true, restored: 'off' });
    expect(store.snapshot()).toEqual({ 'sw.engine_master': 'off', 'lv.flaps': 'down' });
  });
});

describe('frozen events (WR-07)', () => {
  it('freezes every event at creation and hands out a new array each time', () => {
    const store = plainStore();
    const result = store.dispatch('sw.engine_master', 'on', 1);
    expect(result.ok && Object.isFrozen(result.event)).toBe(true);
    const first = store.events();
    expect(first.every((e) => Object.isFrozen(e))).toBe(true);
    expect(store.events()).not.toBe(first);
    expect(() => {
      (first[0] as { value: string }).value = 'off';
    }).toThrow(TypeError);
    expect(store.get('sw.engine_master')).toBe('on');
  });
});

describe('inject: a change made by the simulation (V-06)', () => {
  const GUARD_SW = 'sw.deice_alternate';

  it('appends an event of source sim, calls the dispatch listeners and changes the state', () => {
    const store = plainStore();
    const seen: unknown[] = [];
    store.subscribe((e) => seen.push(e));
    const event = store.inject('sw.engine_master', 'on', 5);
    expect(event).toEqual({ seq: 0, t: 5, id: 'sw.engine_master', value: 'on', source: 'sim' });
    expect(Object.isFrozen(event)).toBe(true);
    expect(seen).toEqual([event]);
    expect(store.get('sw.engine_master')).toBe('on');
    expect(store.events()).toEqual([event]);
  });

  it('appends nothing for a control already in that state', () => {
    const store = plainStore();
    expect(store.inject('sw.engine_master', 'off', 1)).toBeNull();
    expect(store.events()).toEqual([]);
  });

  it('throws RangeError for an unknown control or an illegal state', () => {
    const store = plainStore();
    expect(() => store.inject('sw.nothing', 'on', 1)).toThrow(RangeError);
    expect(() => store.inject('sw.engine_master', 'sideways', 1)).toThrow(RangeError);
    expect(() => store.inject('sw.engine_master', 'on', -1)).toThrow(RangeError);
    expect(store.events()).toEqual([]);
  });

  it('is not blocked by a closed guard', () => {
    const store = interlockStore();
    expect(store.isBlocked(GUARD_SW)).toBe(true);
    expect(store.inject(GUARD_SW, 'on', 1)?.source).toBe('sim');
    expect(store.get(GUARD_SW)).toBe('on');
  });

  it('refuses a retract of its own event and numbers the next event after it', () => {
    const store = plainStore();
    store.inject('sw.engine_master', 'on', 1);
    expect(store.retract(0)).toEqual({ ok: false, reason: 'system' });
    expect(store.get('sw.engine_master')).toBe('on');
    const next = store.dispatch('lv.flaps', 'down', 2);
    expect(next.ok && next.event.seq).toBe(1);
    // The pilot's newest event retracts; the change of the simulation stays in the log.
    expect(store.retract(1).ok).toBe(true);
    expect(store.events().map((e) => e.source)).toEqual(['sim']);
  });

  it('checks not-last before system', () => {
    const store = plainStore();
    store.inject('sw.engine_master', 'on', 1);
    store.dispatch('lv.flaps', 'down', 2);
    expect(store.retract(0)).toEqual({ ok: false, reason: 'not-last' });
  });
});
