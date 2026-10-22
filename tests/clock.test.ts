import { describe, expect, it } from 'vitest';
import { VirtualClock } from '../src/engine/clock';

describe('VirtualClock (SCN-08)', () => {
  it('starts at 0 and advances only by explicit calls', () => {
    const clock = new VirtualClock();
    expect(clock.now()).toBe(0);
    expect(clock.now()).toBe(0);
    clock.advance(250);
    clock.advance(250);
    expect(clock.now()).toBe(500);
    expect(clock.paused).toBe(false);
  });

  it('ignores advances while paused and continues after resume', () => {
    const clock = new VirtualClock();
    clock.advance(100);
    clock.pause();
    expect(clock.paused).toBe(true);
    clock.advance(5000);
    expect(clock.now()).toBe(100);
    clock.resume();
    expect(clock.paused).toBe(false);
    clock.advance(40);
    expect(clock.now()).toBe(140);
  });

  it('accepts a zero step', () => {
    const clock = new VirtualClock();
    clock.advance(0);
    expect(clock.now()).toBe(0);
  });

  it('rejects a negative or non-finite step with a RangeError and keeps the time', () => {
    const clock = new VirtualClock();
    clock.advance(10);
    expect(() => {
      clock.advance(-1);
    }).toThrow(RangeError);
    expect(() => {
      clock.advance(Number.NaN);
    }).toThrow(RangeError);
    expect(() => {
      clock.advance(Number.POSITIVE_INFINITY);
    }).toThrow(RangeError);
    expect(clock.now()).toBe(10);
  });

  it('rejects a bad step even while paused', () => {
    const clock = new VirtualClock();
    clock.pause();
    expect(() => {
      clock.advance(-1);
    }).toThrow(RangeError);
  });
});
