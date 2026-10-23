// Piecewise-linear curves for aircraft data (a table of points, read between the points). Pure and
// deterministic: only + - * / and comparisons, no Math functions beyond what the caller passes in
// (RESEARCH Pitfall 1). No scenario fact and no aircraft fact lives here.

/** One point of a curve: the input `x` and the output `y`. */
export interface CurvePoint {
  readonly x: number;
  readonly y: number;
}

export class CurveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CurveError';
  }
}

/**
 * Validates a curve table: at least two points, every coordinate finite, `x` strictly increasing.
 * Returns the same points, typed as a curve; throws CurveError (at load time) otherwise.
 */
export function defineCurve(name: string, points: readonly CurvePoint[]): readonly CurvePoint[] {
  if (points.length < 2) throw new CurveError(`curve "${name}" needs at least 2 points`);
  let previous = -Infinity;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      throw new CurveError(`curve "${name}" has a point that is not finite`);
    }
    if (!(point.x > previous)) {
      throw new CurveError(
        `curve "${name}" x ${point.x} is not strictly greater than the previous`,
      );
    }
    previous = point.x;
  }
  return points;
}

/**
 * The curve at `x`: a straight line between the two neighbouring points, held at the first or last
 * value outside the table. Throws RangeError for a non-finite `x`.
 */
export function interpolate(curve: readonly CurvePoint[], x: number): number {
  if (!Number.isFinite(x)) throw new RangeError(`x must be finite (got ${x})`);
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (first === undefined || last === undefined) throw new CurveError('the curve has no points');
  if (x <= first.x) return first.y;
  if (x >= last.x) return last.y;
  for (let i = 1; i < curve.length; i++) {
    const high = curve[i];
    const low = curve[i - 1];
    if (high === undefined || low === undefined) break;
    if (x <= high.x) return low.y + ((high.y - low.y) * (x - low.x)) / (high.x - low.x);
  }
  return last.y;
}
