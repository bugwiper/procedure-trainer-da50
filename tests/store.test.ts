import { describe, expect, it } from 'vitest';
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
