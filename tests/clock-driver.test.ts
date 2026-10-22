import { signal } from '@preact/signals';
import { describe, expect, it } from 'vitest';
import { VirtualClock } from '../src/engine/clock';
import { MAX_FRAME_STEP_MS, attachClockDriver } from '../src/ui/clock-driver';
import type { ClockDriverSession } from '../src/ui/clock-driver';
import type { Screen } from '../src/ui/session';

// The clock driver (plan 02-09, Table CD; SCN-08, T-02-31): a fake frame scheduler and a fake now,
// no timers. The run's virtual clock moves by the real time between frames only while the run is
// live, the tab is visible and no modal is open, at most 1000 ms per frame.

function rig() {
  const screen = signal<Screen>('running');
  const clock = signal<VirtualClock | null>(new VirtualClock());
  const session: ClockDriverSession = { screen, clock };
  let time = 10_000;
  let nextId = 1;
  let pending: { id: number; run: () => void } | null = null;
  let hidden = false;
  let blocked = false;
  const detach = attachClockDriver({
    session,
    raf: (run) => {
      pending = { id: nextId, run };
      return nextId++;
    },
    cancelRaf: (id) => {
      if (pending?.id === id) pending = null;
    },
    now: () => time,
    hidden: () => hidden,
    blocked: () => blocked,
  });
  return {
    screen,
    clock,
    detach,
    /** Lets dt ms of real time pass and runs the pending frame, if any. */
    frame(dt: number) {
      time += dt;
      const frame = pending;
      pending = null;
      frame?.run();
    },
    setHidden(value: boolean) {
      hidden = value;
    },
    setBlocked(value: boolean) {
      blocked = value;
    },
    hasPendingFrame: () => pending !== null,
    now: () => clock.value?.now() ?? null,
  };
}

describe('attachClockDriver', () => {
  it('advances the clock by the time between frames while the run is live', () => {
    const r = rig();
    r.frame(16);
    r.frame(17);
    r.frame(500);
    expect(r.now()).toBe(533);
  });

  it('caps one frame at MAX_FRAME_STEP_MS', () => {
    expect(MAX_FRAME_STEP_MS).toBe(1000);
    const r = rig();
    r.frame(5000);
    expect(r.now()).toBe(1000);
    r.frame(1000);
    expect(r.now()).toBe(2000);
  });

  it('does not advance outside the running screen, and adds no paused time later', () => {
    const r = rig();
    r.frame(100);
    r.screen.value = 'debrief';
    r.frame(400);
    r.frame(400);
    expect(r.now()).toBe(100);
    r.screen.value = 'running';
    r.frame(16);
    expect(r.now()).toBe(116);
  });

  it('does not advance while hidden, and adds no hidden time later', () => {
    const r = rig();
    r.frame(100);
    r.setHidden(true);
    r.frame(300);
    r.frame(300);
    expect(r.now()).toBe(100);
    r.setHidden(false);
    r.frame(16);
    expect(r.now()).toBe(116);
  });

  it('does not advance while a modal blocks, and adds no blocked time later', () => {
    const r = rig();
    r.frame(100);
    r.setBlocked(true);
    r.frame(250);
    r.frame(250);
    expect(r.now()).toBe(100);
    r.setBlocked(false);
    r.frame(16);
    expect(r.now()).toBe(116);
  });

  it('does nothing without a clock', () => {
    const r = rig();
    r.clock.value = null;
    expect(() => {
      r.frame(100);
    }).not.toThrow();
    expect(r.now()).toBeNull();
  });

  it('follows a new clock of the next run', () => {
    const r = rig();
    r.frame(100);
    r.clock.value = new VirtualClock();
    r.frame(50);
    expect(r.now()).toBe(50);
  });

  it('keeps scheduling frames until detached, then stops', () => {
    const r = rig();
    expect(r.hasPendingFrame()).toBe(true);
    r.frame(16);
    expect(r.hasPendingFrame()).toBe(true);
    r.detach();
    expect(r.hasPendingFrame()).toBe(false);
    r.frame(16);
    expect(r.now()).toBe(16);
  });
});
