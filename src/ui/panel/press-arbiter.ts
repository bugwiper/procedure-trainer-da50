// The press arbitration machine (R3-Z2): one pure state machine that decides what every pointer
// on the panel is. It takes pointer samples (id, kind, coordinates, time) and returns effects;
// it has no DOM, no timer, no clock and no bridge, so every rule is unit tested and a lost
// pointer can never leave the panel blocked. The gesture layer in zoom.ts only feeds it samples
// and applies its effects; widgets never decide gestures.
//
// Four classes of target (a pointerdown is classified by the element it lands on):
//  - background: a view pointer. A still, short, single press is a tap; beyond the slop it pans
//    (when zoomed); two view pointers pinch.
//  - latch: pending until the lift. A lift within the slop is a tap; movement beyond the slop
//    discards the press and the pointer becomes a view pointer; a second pointer discards it and
//    both pinch.
//  - momentary: pending; held still for MOMENTARY_HOLD_MS commits a press (a deadline the machine
//    reports and tick commits, so no timer lives here); a lift before that without movement is a
//    quick tap (press then release); movement beyond the slop or a second pointer before the
//    commit discards it; after the commit every move and every other pointer is ignored.
//  - own: the control keeps the pointer and the machine emits nothing for it; before the drag has
//    travelled dragStartPx a second pointer takes it away; from then on it is owned.

import { TAP_MAX_MS, isBackgroundTap, slopPx } from './tap-intent';
import type { PointerKind } from './tap-intent';

/** A momentary press commits after this many ms of being held still. */
export const MOMENTARY_HOLD_MS = 100;
/** The travel (client px) from which a drag control owns its pointer (the widgets' MIN_DRAG_PX). */
export const DRAG_START_PX = 4;

/** What a pointerdown landed on (Table A1). */
export type TargetClass = 'background' | 'latch' | 'momentary' | 'own';

export interface TargetDescriptor {
  readonly cls: TargetClass;
  /** The data-hit or data-detent value of the control; null for the background. */
  readonly key: string | null;
  /** Own class only: the travel (client px) from which the pointer is owned; 0 or absent: from the start. */
  readonly dragStartPx?: number;
}

export interface PointerSample {
  readonly id: number;
  readonly kind: PointerKind;
  readonly primary: boolean;
  /** Client coordinates in px. */
  readonly x: number;
  readonly y: number;
  /** Time in ms (event.timeStamp); the machine never reads a clock. */
  readonly t: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Midpoint extends Point {
  /** Distance between the two view pointers. */
  readonly dist: number;
}

export type PressEffect =
  /** A latch press began (on true) or ended without a tap (on false). */
  | {
      readonly type: 'pending';
      readonly id: number;
      readonly key: string | null;
      readonly on: boolean;
    }
  /** A tap; key is null for the background. */
  | {
      readonly type: 'tap';
      readonly id: number;
      readonly key: string | null;
      readonly down: Point;
      readonly up: Point;
      readonly durationMs: number;
      /** Time of the lift in ms (the sample time of the up). */
      readonly at: number;
      /** Lifted within TAP_MAX_MS. */
      readonly quick: boolean;
    }
  /** A momentary commit, with the down point. */
  | { readonly type: 'press'; readonly id: number; readonly key: string | null; readonly at: Point }
  | { readonly type: 'release'; readonly id: number; readonly key: string | null }
  /** A pending press was taken away: the control clears its visual and does not act. */
  | { readonly type: 'discard'; readonly id: number; readonly key: string | null }
  /** The pointer is a view pointer that panned: client-pixel deltas since the previous pan. */
  | { readonly type: 'pan'; readonly id: number; readonly dx: number; readonly dy: number }
  /** Two view pointers moved: the previous and the next midpoint and distance. */
  | { readonly type: 'pinch'; readonly prev: Midpoint; readonly next: Midpoint }
  /** Something ended a remembered tap pair. */
  | { readonly type: 'pair-break' };

export type PointerState = 'pending' | 'held' | 'view' | 'owned' | 'ignored';

export interface PressArbiter {
  down(sample: PointerSample, descriptor: TargetDescriptor): PressEffect[];
  move(sample: PointerSample): PressEffect[];
  up(sample: PointerSample): PressEffect[];
  cancel(pointerId: number): PressEffect[];
  reset(): PressEffect[];
  /** Commits every pending momentary press whose deadline is at or before t. */
  tick(t: number): PressEffect[];
  /** The earliest deadline of a pending momentary press, or null. */
  nextDeadline(): number | null;
  stateOf(pointerId: number): PointerState | undefined;
}

interface Rec {
  readonly id: number;
  readonly kind: PointerKind;
  /** What the pointer landed on; a pointer taken over by the view keeps it but has phase view. */
  readonly cls: TargetClass;
  readonly key: string | null;
  readonly dragStartPx: number;
  phase: PointerState;
  readonly downX: number;
  readonly downY: number;
  readonly downAt: number;
  x: number;
  y: number;
  /** Where a pan delta is measured from; only advanced while panning. */
  anchorX: number;
  anchorY: number;
  /** Still a candidate for a background tap: no travel, no second finger. */
  tapOk: boolean;
  panning: boolean;
  /** Largest number of view pointers down at once while this pointer was down. */
  maxPointers: number;
  /** Momentary only: the time at which a pending press commits. */
  readonly deadline: number | null;
}

interface Pinch {
  readonly a: number;
  readonly b: number;
  prev: Midpoint;
}

export function createPressArbiter(): PressArbiter {
  const recs = new Map<number, Rec>();
  let pinch: Pinch | null = null;

  const pairBreak = (out: PressEffect[]) => {
    if (!out.some((e) => e.type === 'pair-break')) out.push({ type: 'pair-break' });
  };

  const midpointOf = (a: Rec, b: Rec): Midpoint => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    dist: Math.hypot(a.x - b.x, a.y - b.y),
  });

  const inPinch = (r: Rec): boolean => pinch !== null && (pinch.a === r.id || pinch.b === r.id);

  const travelOf = (r: Rec, x: number, y: number): number => Math.hypot(x - r.downX, y - r.downY);

  /** One pinch pointer is gone: the remaining one neither taps nor jumps. */
  const settleRemaining = () => {
    if (pinch === null) return;
    const ended = pinch;
    pinch = null;
    for (const id of [ended.a, ended.b]) {
      const r = recs.get(id);
      if (r === undefined) continue;
      r.tapOk = false;
      r.panning = false;
      r.anchorX = r.x;
      r.anchorY = r.y;
    }
  };

  const forget = (r: Rec) => {
    recs.delete(r.id);
    if (inPinch(r)) settleRemaining();
  };

  /** The pending press of a control is taken away: it clears its visual and does not act. */
  const discardPending = (r: Rec, out: PressEffect[]) => {
    if (r.cls === 'latch') out.push({ type: 'pending', id: r.id, key: r.key, on: false });
    out.push({ type: 'discard', id: r.id, key: r.key });
  };

  /** A pending record becomes a view pointer (movement beyond the slop or a second pointer). */
  const toView = (r: Rec) => {
    r.phase = 'view';
    r.tapOk = false;
    r.anchorX = r.x;
    r.anchorY = r.y;
  };

  /** A press of a momentary control commits: pressed state and event, held from now on. */
  const commit = (r: Rec, out: PressEffect[]) => {
    r.phase = 'held';
    out.push({ type: 'press', id: r.id, key: r.key, at: { x: r.downX, y: r.downY } });
  };

  /** What the end of a pointer without a lift says (cancel, stale): nothing is ever left stuck. */
  const endWithoutLift = (r: Rec, out: PressEffect[]) => {
    if (r.phase === 'held') out.push({ type: 'release', id: r.id, key: r.key });
    else if (r.phase === 'pending' && r.cls !== 'own') discardPending(r, out);
  };

  return {
    down(s, d) {
      const out: PressEffect[] = [];
      // Stale sweep: a primary pointer going down means every earlier pointer of its kind is gone
      // (a lost pointerup or cancel); a pointer id that comes back is stale as well.
      for (const r of Array.from(recs.values())) {
        if (!((s.primary && r.kind === s.kind) || r.id === s.id)) continue;
        endWithoutLift(r, out);
        if (r.phase === 'pending' && r.cls === 'own') discardPending(r, out);
        if (r.phase !== 'ignored') pairBreak(out);
        forget(r);
      }
      const dragStartPx = d.cls === 'own' ? (d.dragStartPx ?? 0) : 0;
      const rec: Rec = {
        id: s.id,
        kind: s.kind,
        cls: d.cls,
        key: d.key,
        dragStartPx,
        phase: 'view',
        downX: s.x,
        downY: s.y,
        downAt: s.t,
        x: s.x,
        y: s.y,
        anchorX: s.x,
        anchorY: s.y,
        tapOk: d.cls === 'background',
        panning: false,
        maxPointers: 1,
        deadline: d.cls === 'momentary' ? s.t + MOMENTARY_HOLD_MS : null,
      };
      const live = Array.from(recs.values()).filter((r) => r.phase !== 'ignored');
      // An owned pointer and a held press block every other pointer.
      if (live.some((r) => r.phase === 'owned' || r.phase === 'held') || live.length >= 2) {
        rec.phase = 'ignored';
        recs.set(s.id, rec);
        return out;
      }
      const first = live[0];
      if (first !== undefined) {
        // A second pointer starts a pinch with the first, over controls as well as the
        // background; a pending press of the first one is taken away.
        if (first.phase === 'pending') {
          discardPending(first, out);
          toView(first);
        }
        pairBreak(out);
        first.tapOk = false;
        first.maxPointers = 2;
        const second: Rec = { ...rec, phase: 'view', tapOk: false, maxPointers: 2 };
        recs.set(s.id, second);
        pinch = { a: first.id, b: s.id, prev: midpointOf(first, second) };
        return out;
      }
      switch (d.cls) {
        case 'background':
          break;
        case 'latch':
          rec.phase = 'pending';
          out.push({ type: 'pending', id: s.id, key: d.key, on: true });
          break;
        case 'momentary':
          rec.phase = 'pending';
          pairBreak(out);
          break;
        case 'own':
          pairBreak(out);
          rec.phase = dragStartPx > 0 ? 'pending' : 'owned';
          break;
      }
      recs.set(s.id, rec);
      return out;
    },

    move(s) {
      const r = recs.get(s.id);
      if (r === undefined) return [];
      r.x = s.x;
      r.y = s.y;
      const out: PressEffect[] = [];
      if (r.phase === 'pending') {
        if (r.cls === 'own') {
          if (travelOf(r, r.x, r.y) >= r.dragStartPx) r.phase = 'owned';
          return out;
        }
        if (travelOf(r, r.x, r.y) <= slopPx(r.kind)) return out;
        // Beyond the slop: the control discards the press and the pointer becomes a pan.
        discardPending(r, out);
        pairBreak(out);
        toView(r);
        // The first pan delta is measured from the down point.
        r.anchorX = r.downX;
        r.anchorY = r.downY;
        r.panning = true;
      } else if (r.phase !== 'view') {
        return out;
      } else if (pinch !== null && inPinch(r)) {
        const a = recs.get(pinch.a);
        const b = recs.get(pinch.b);
        if (a === undefined || b === undefined) return out;
        const prev = pinch.prev;
        const next = midpointOf(a, b);
        pinch.prev = next;
        return [{ type: 'pinch', prev, next }];
      } else if (!r.panning) {
        if (travelOf(r, r.x, r.y) <= slopPx(r.kind)) return out;
        r.tapOk = false;
        r.panning = true;
        pairBreak(out);
      }
      out.push({ type: 'pan', id: r.id, dx: r.x - r.anchorX, dy: r.y - r.anchorY });
      r.anchorX = r.x;
      r.anchorY = r.y;
      return out;
    },

    up(s) {
      const r = recs.get(s.id);
      if (r === undefined) return [];
      const out: PressEffect[] = [];
      const travelPx = travelOf(r, s.x, s.y);
      const durationMs = s.t - r.downAt;
      const down = { x: r.downX, y: r.downY };
      switch (r.phase) {
        case 'ignored':
        case 'owned':
          forget(r);
          return out;
        case 'held':
          forget(r);
          out.push({ type: 'release', id: r.id, key: r.key });
          return out;
        case 'pending':
          forget(r);
          if (r.cls === 'own') return out;
          if (travelPx > slopPx(r.kind)) {
            discardPending(r, out);
            pairBreak(out);
          } else if (r.cls === 'latch') {
            out.push({ type: 'pending', id: r.id, key: r.key, on: false });
            out.push({
              type: 'tap',
              id: r.id,
              key: r.key,
              down,
              up: { x: s.x, y: s.y },
              durationMs,
              at: s.t,
              quick: durationMs <= TAP_MAX_MS,
            });
          } else {
            // A quick momentary tap: lifting is not a discard cause, so press and release come
            // together at the lift.
            out.push({ type: 'press', id: r.id, key: r.key, at: down });
            out.push({ type: 'release', id: r.id, key: r.key });
          }
          return out;
        case 'view': {
          const wasTap =
            r.cls === 'background' &&
            !inPinch(r) &&
            r.tapOk &&
            isBackgroundTap({
              kind: r.kind,
              travelPx,
              durationMs,
              maxPointers: r.maxPointers,
              startedOnTarget: false,
            });
          forget(r);
          if (!wasTap) {
            pairBreak(out);
            return out;
          }
          // A tap is no pair-break: the double-tap tracker needs it as the remembered tap.
          out.push({
            type: 'tap',
            id: r.id,
            key: null,
            down,
            up: { x: s.x, y: s.y },
            durationMs,
            at: s.t,
            quick: true,
          });
          return out;
        }
      }
    },

    cancel(pointerId) {
      const r = recs.get(pointerId);
      if (r === undefined) return [];
      const out: PressEffect[] = [];
      forget(r);
      // An own pointer already broke the pair at its down; there is nothing more to say.
      if (r.phase === 'owned' || r.phase === 'ignored' || r.cls === 'own') return out;
      endWithoutLift(r, out);
      pairBreak(out);
      return out;
    },

    reset() {
      const out: PressEffect[] = [];
      for (const r of recs.values()) {
        if (r.phase === 'held') out.push({ type: 'release', id: r.id, key: r.key });
        else if (r.phase === 'pending') discardPending(r, out);
      }
      recs.clear();
      pinch = null;
      return out;
    },

    tick(t) {
      const out: PressEffect[] = [];
      const due = Array.from(recs.values())
        .filter((r) => r.phase === 'pending' && r.deadline !== null && r.deadline <= t)
        .sort((a, b) => (a.deadline ?? 0) - (b.deadline ?? 0));
      for (const r of due) commit(r, out);
      return out;
    },

    nextDeadline() {
      let earliest: number | null = null;
      for (const r of recs.values()) {
        if (r.phase !== 'pending' || r.deadline === null) continue;
        if (earliest === null || r.deadline < earliest) earliest = r.deadline;
      }
      return earliest;
    },

    stateOf(pointerId) {
      return recs.get(pointerId)?.phase;
    },
  };
}
