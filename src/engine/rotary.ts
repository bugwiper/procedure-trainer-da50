// Pure stop logic for rotary knobs (D-07, D-09, D-10). No DOM, no framework: the widget
// converts screen points to knob-local coordinates, this module does the rest. Only stop ids
// ever leave this module, never an intermediate angle.

import type { RotaryDef, StateId } from './registry';

function assertFinite(value: number, what: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${what} must be finite (got ${value})`);
}

function modulo360(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * Angle in degrees of the point (dx, dy) seen from the knob centre, in screen coordinates
 * (y grows downward): 0 is up (12 o'clock), 90 is right, 180 is down, 270 is left.
 * The result satisfies 0 <= a < 360.
 */
export function angleOf(dx: number, dy: number): number {
  assertFinite(dx, 'dx');
  assertFinite(dy, 'dy');
  // atan2(dx, -dy) measures clockwise from up.
  return modulo360((Math.atan2(dx, -dy) * 180) / Math.PI);
}

function indexOfStop(def: RotaryDef, id: StateId): number {
  const index = def.stops.findIndex((s) => s.id === id);
  if (index < 0) throw new RangeError(`knob "${def.id}" has no stop "${id}"`);
  return index;
}

/** Pointer angle of a stop, as authored. */
export function stopAngle(def: RotaryDef, id: StateId): number {
  const stop = def.stops[indexOfStop(def, id)];
  if (stop === undefined) throw new RangeError(`knob "${def.id}" has no stop "${id}"`);
  return stop.angle;
}

/**
 * Next stop in `direction` (+1 clockwise, -1 back). A two-stop knob always gives the other
 * stop; with more stops the ends clamp (no wrap-around).
 */
export function stepStop(def: RotaryDef, current: StateId, direction: 1 | -1): StateId {
  const index = indexOfStop(def, current);
  const count = def.stops.length;
  const target = count === 2 ? 1 - index : Math.min(count - 1, Math.max(0, index + direction));
  const stop = def.stops[target];
  if (stop === undefined) throw new RangeError(`knob "${def.id}" has no stops`);
  return stop.id;
}

/**
 * Stop whose angle is closest to `angle` (smallest circular distance modulo 360). An exact
 * tie goes to the lower index, so the result is always a declared stop.
 */
export function nearestStop(def: RotaryDef, angle: number): StateId {
  assertFinite(angle, 'angle');
  let best: StateId | undefined;
  let bestDistance = Infinity;
  for (const stop of def.stops) {
    const diff = modulo360(angle - stop.angle);
    const distance = Math.min(diff, 360 - diff);
    if (best === undefined || distance < bestDistance) {
      best = stop.id;
      bestDistance = distance;
    }
  }
  if (best === undefined) throw new RangeError(`knob "${def.id}" has no stops`);
  return best;
}

/** A point closer than this to the knob centre gives no stable angle (units, knob-local). */
export const MIN_RADIUS = 2;

/**
 * Stop a tap at the knob-local point (x, y) selects (R2-4.1), for a knob with spots: the stop of the
 * spot that contains the point (a boundary shared by two touching spots goes to the earlier spot);
 * otherwise, for a point at least MIN_RADIUS from the centre, the stop nearest to the angle of the
 * point; otherwise null. A knob without spots is not asked: its taps keep stepStop.
 */
export function tapStop(def: RotaryDef, x: number, y: number): StateId | null {
  assertFinite(x, 'x');
  assertFinite(y, 'y');
  for (const spot of def.spots ?? []) {
    if (Math.abs(x - spot.x) <= spot.w / 2 && Math.abs(y - spot.y) <= spot.h / 2) return spot.stop;
  }
  if (Math.hypot(x, y) < MIN_RADIUS) return null;
  return nearestStop(def, angleOf(x, y));
}
