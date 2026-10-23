import { signal } from '@preact/signals';
import { describe, expect, it, vi } from 'vitest';
import { STEP_MS } from '../src/engine/sim';
import { MAX_FRAME_STEP_MS, attachClockDriver } from '../src/ui/clock-driver';
import type { ClockDriverSession, Steppable } from '../src/ui/clock-driver';
import type { Screen } from '../src/ui/session';

// The clock driver (plan 02-09 Table CD, reworked by plan 03-01; SCN-08, D-02, T-02-31, T-03-01):
// a fake frame scheduler, a fake now and a fake run that counts steps, no timers. Real time between
// frames collects in a carry; the run is stepped once per whole STEP_MS, only while the run is live,
// the tab is visible and no modal is open, at most MAX_FRAME_STEP_MS of real time per frame.

function fakeRun() {
  const run = {
    steps: 0,
    step() {
      run.steps += 1;
    },
  };
  return run;
}

function rig(onError?: (error: unknown) => void) {
  const screen = signal<Screen>('running');
  const first = fakeRun();
  const run = signal<Steppable | null>(first);
  const session: ClockDriverSession = { screen, run };
  let time = 10_000;
  let nextId = 1;
  let pending: { id: number; run: () => void } | null = null;
  let hidden = false;
  let blocked = false;
  const detach = attachClockDriver({
    session,
    raf: (callback) => {
      pending = { id: nextId, run: callback };
      return nextId++;
    },
    cancelRaf: (id) => {
      if (pending?.id === id) pending = null;
    },
    now: () => time,
    hidden: () => hidden,
    blocked: () => blocked,
    ...(onError === undefined ? {} : { onError }),
  });
  return {
    screen,
    run,
    first,
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
  };
}

describe('attachClockDriver', () => {
  it('steps the run once per whole STEP_MS and carries the remainder into the next frame', () => {
    expect(STEP_MS).toBe(100);
    const r = rig();
    r.frame(250);
    expect(r.first.steps).toBe(2);
    r.frame(50);
    expect(r.first.steps).toBe(3);
    r.frame(99);
    expect(r.first.steps).toBe(3);
    r.frame(1);
    expect(r.first.steps).toBe(4);
  });

  it('takes no step from a frame shorter than one step', () => {
    const r = rig();
    for (let i = 0; i < 5; i++) r.frame(16);
    expect(r.first.steps).toBe(0);
    r.frame(20);
    expect(r.first.steps).toBe(1);
  });

  it('caps one frame at MAX_FRAME_STEP_MS, so a 5000 ms frame gives 10 steps', () => {
    expect(MAX_FRAME_STEP_MS).toBe(1000);
    const r = rig();
    r.frame(5000);
    expect(r.first.steps).toBe(10);
    r.frame(1000);
    expect(r.first.steps).toBe(20);
  });

  it('takes no step outside the running screen, and adds no paused time later', () => {
    const r = rig();
    r.frame(100);
    expect(r.first.steps).toBe(1);
    r.screen.value = 'debrief';
    r.frame(400);
    r.frame(400);
    expect(r.first.steps).toBe(1);
    r.screen.value = 'running';
    r.frame(16);
    expect(r.first.steps).toBe(1);
  });

  it('takes no step while hidden, and adds no hidden time later', () => {
    const r = rig();
    r.frame(100);
    r.setHidden(true);
    r.frame(300);
    r.frame(300);
    expect(r.first.steps).toBe(1);
    r.setHidden(false);
    r.frame(16);
    expect(r.first.steps).toBe(1);
  });

  it('takes no step while a modal blocks, and adds no blocked time later', () => {
    const r = rig();
    r.frame(100);
    r.setBlocked(true);
    r.frame(250);
    r.frame(250);
    expect(r.first.steps).toBe(1);
    r.setBlocked(false);
    r.frame(16);
    expect(r.first.steps).toBe(1);
  });

  it('does nothing without a run', () => {
    const r = rig();
    r.run.value = null;
    expect(() => {
      r.frame(100);
    }).not.toThrow();
    expect(r.first.steps).toBe(0);
  });

  it('starts a new run with an empty carry', () => {
    const r = rig();
    r.frame(150);
    expect(r.first.steps).toBe(1);
    const second = fakeRun();
    r.run.value = second;
    // The 50 ms left over from the first run must not count for the second.
    r.frame(60);
    expect(second.steps).toBe(0);
    r.frame(40);
    expect(second.steps).toBe(1);
    expect(r.first.steps).toBe(1);
  });

  it('keeps scheduling frames until detached, then stops', () => {
    const r = rig();
    expect(r.hasPendingFrame()).toBe(true);
    r.frame(16);
    expect(r.hasPendingFrame()).toBe(true);
    r.detach();
    expect(r.hasPendingFrame()).toBe(false);
    r.frame(200);
    expect(r.first.steps).toBe(0);
  });
  it('a step that throws goes to onError and the loop keeps stepping (WR-03)', () => {
    const errors: unknown[] = [];
    const r = rig((error) => errors.push(error));
    let calls = 0;
    r.run.value = {
      step() {
        calls += 1;
        if (calls === 1) throw new Error('listener failed');
      },
    };
    r.frame(100);
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('listener failed');
    expect(r.hasPendingFrame()).toBe(true);
    r.frame(100);
    expect(calls).toBe(2);
    expect(errors).toHaveLength(1);
  });

  it('without onError a throwing step is logged, not thrown, and the loop goes on', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = rig();
    r.run.value = {
      step() {
        throw new Error('boom');
      },
    };
    expect(() => {
      r.frame(100);
    }).not.toThrow();
    expect(logged).toHaveBeenCalledTimes(1);
    expect(r.hasPendingFrame()).toBe(true);
    logged.mockRestore();
  });
});
