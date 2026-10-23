import { describe, expect, it } from 'vitest';
import { CurveError, defineCurve, interpolate } from '../src/engine/curve';

// Piecewise-linear curve helper (live-test fix, propeller set curve): validation and the reading
// between, below and above the points. Pure, deterministic.

const curve = defineCurve('test', [
  { x: 0, y: 100 },
  { x: 10, y: 0 },
  { x: 30, y: 40 },
]);

describe('defineCurve', () => {
  it('accepts two or more points with strictly increasing x', () => {
    expect(() =>
      defineCurve('two', [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ]),
    ).not.toThrow();
  });

  it('rejects fewer than two points, equal or falling x and non-finite values', () => {
    expect(() => defineCurve('one', [{ x: 0, y: 0 }])).toThrow(CurveError);
    expect(() =>
      defineCurve('equal', [
        { x: 1, y: 0 },
        { x: 1, y: 2 },
      ]),
    ).toThrow(/strictly greater/);
    expect(() =>
      defineCurve('falling', [
        { x: 2, y: 0 },
        { x: 1, y: 2 },
      ]),
    ).toThrow(/strictly greater/);
    expect(() =>
      defineCurve('nan', [
        { x: 0, y: NaN },
        { x: 1, y: 2 },
      ]),
    ).toThrow(/not finite/);
  });
});

describe('interpolate', () => {
  it('returns the value at every point', () => {
    for (const point of curve) expect(interpolate(curve, point.x)).toBe(point.y);
  });

  it('is linear between two points, falling or rising', () => {
    expect(interpolate(curve, 5)).toBe(50);
    expect(interpolate(curve, 2.5)).toBe(75);
    expect(interpolate(curve, 20)).toBe(20);
  });

  it('holds the first and the last value outside the table', () => {
    expect(interpolate(curve, -50)).toBe(100);
    expect(interpolate(curve, 1000)).toBe(40);
  });

  it('rejects a non-finite input and gives the same answer every time', () => {
    expect(() => interpolate(curve, NaN)).toThrow(RangeError);
    expect(() => interpolate(curve, Infinity)).toThrow(RangeError);
    expect(interpolate(curve, 12.3)).toBe(interpolate(curve, 12.3));
  });
});
