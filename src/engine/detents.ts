// Pure detent geometry for lever controls (PNL-02, D-05). No DOM, no framework: the widget
// converts screen points to lever-local coordinates, this module does the rest.

import type { DetentDef, DetentLeverDef, StateId } from './registry';

/**
 * Id of the detent nearest to pos. An exact tie keeps the earlier detent (lower pos), and
 * positions beyond the track end are nearest the end detents, so the result is always a
 * declared detent.
 */
export function snapToDetent(pos: number, detents: readonly DetentDef[]): StateId {
  let best: DetentDef | undefined;
  let bestDistance = Infinity;
  for (const d of detents) {
    const distance = Math.abs(d.pos - pos);
    if (best === undefined || distance < bestDistance) {
      best = d;
      bestDistance = distance;
    }
  }
  if (best === undefined) throw new RangeError('a lever needs at least one detent');
  return best.id;
}

/**
 * Track fraction 0..1 of a point given relative to the track centre. Axis 'v': SVG y grows
 * downward, so pos 0 is the bottom end; axis 'h': pos 0 is the left end. Clamped.
 */
export function projectToTrack(
  local: { readonly x: number; readonly y: number },
  track: DetentLeverDef['track'],
): number {
  const raw = track.axis === 'v' ? 0.5 - local.y / track.length : 0.5 + local.x / track.length;
  return Math.min(1, Math.max(0, raw));
}

/** Offset from the track centre of track fraction pos; inverse of projectToTrack. */
export function detentOffset(
  pos: number,
  track: DetentLeverDef['track'],
): { dx: number; dy: number } {
  return track.axis === 'v'
    ? { dx: 0, dy: (0.5 - pos) * track.length }
    : { dx: (pos - 0.5) * track.length, dy: 0 };
}
