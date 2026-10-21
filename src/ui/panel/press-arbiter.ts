// The press arbitration machine (R3-Z2): one pure state machine that decides what every pointer
// on the panel is. It takes pointer samples (id, kind, coordinates, time) and returns effects;
// it has no DOM, no timer, no clock and no bridge, so every rule is unit tested and a lost
// pointer can never leave the panel blocked. The gesture layer in zoom.ts only feeds it samples
// and applies its effects; widgets never decide gestures.

import { isBackgroundTap, slopPx } from './tap-intent';
import type { PointerKind } from './tap-intent';

/** What a pointerdown landed on (Table A1): the background or a control that owns the pointer. */
export type TargetClass = 'background' | 'own';

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
  /** The pointer is a view pointer that panned: client-pixel deltas since the previous pan. */
  | { readonly type: 'pan'; readonly id: number; readonly dx: number; readonly dy: number }
  /** Two view pointers moved: the previous and the next midpoint and distance. */
  | { readonly type: 'pinch'; readonly prev: Midpoint; readonly next: Midpoint }
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
  /** Something ended a remembered tap pair. */
  | { readonly type: 'pair-break' };

export type PointerState = 'view' | 'owned' | 'ignored';

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

  const inPinch = (r: Rec): boolean => pinch !== null && (pinch.a === r.id || pinch.b === r.id);

  /** Removes a record and says what its removal ends. */
  const drop = (r: Rec, out: PressEffect[]) => {
    recs.delete(r.id);
    if (r.phase === 'ignored') return;
    pairBreak(out);
    if (inPinch(r)) settleRemaining();
  };

  return {
    down(s, d) {
      const out: PressEffect[] = [];
      // Stale sweep: a primary pointer going down means every earlier pointer of its kind is gone
      // (a lost pointerup or cancel); a pointer id that comes back is stale as well.
      for (const r of Array.from(recs.values())) {
        if ((s.primary && r.kind === s.kind) || r.id === s.id) drop(r, out);
      }
      const rec: Rec = {
        id: s.id,
        kind: s.kind,
        phase: 'view',
        downX: s.x,
        downY: s.y,
        downAt: s.t,
        x: s.x,
        y: s.y,
        anchorX: s.x,
        anchorY: s.y,
        tapOk: true,
        panning: false,
        maxPointers: 1,
      };
      const live = Array.from(recs.values()).filter((r) => r.phase !== 'ignored');
      if (live.some((r) => r.phase === 'owned') || live.length >= 2) {
        rec.phase = 'ignored';
        recs.set(s.id, rec);
        return out;
      }
      const first = live[0];
      if (first !== undefined) {
        // A second pointer starts a pinch with the first, over controls as well as the background.
        pairBreak(out);
        first.tapOk = false;
        first.maxPointers = 2;
        rec.tapOk = false;
        rec.maxPointers = 2;
        recs.set(s.id, rec);
        pinch = { a: first.id, b: s.id, prev: midpointOf(first, rec) };
        return out;
      }
      if (d.cls === 'own') {
        pairBreak(out);
        rec.phase = 'owned';
      }
      recs.set(s.id, rec);
      return out;
    },

    move(s) {
      const r = recs.get(s.id);
      if (r === undefined) return [];
      r.x = s.x;
      r.y = s.y;
      if (r.phase !== 'view') return [];
      const out: PressEffect[] = [];
      if (pinch !== null && inPinch(r)) {
        const a = recs.get(pinch.a);
        const b = recs.get(pinch.b);
        if (a === undefined || b === undefined) return [];
        const prev = pinch.prev;
        const next = midpointOf(a, b);
        pinch.prev = next;
        return [{ type: 'pinch', prev, next }];
      }
      if (!r.panning) {
        if (Math.hypot(r.x - r.downX, r.y - r.downY) <= slopPx(r.kind)) return [];
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
      if (r.phase !== 'view') {
        recs.delete(s.id);
        return out;
      }
      const pinched = inPinch(r);
      const travelPx = Math.hypot(s.x - r.downX, s.y - r.downY);
      const durationMs = s.t - r.downAt;
      const wasTap =
        !pinched &&
        r.tapOk &&
        isBackgroundTap({
          kind: r.kind,
          travelPx,
          durationMs,
          maxPointers: r.maxPointers,
          startedOnTarget: false,
        });
      drop(r, out);
      if (wasTap) {
        // A tap is no pair-break: the double-tap tracker needs it as the remembered tap.
        return [
          {
            type: 'tap',
            id: r.id,
            key: null,
            down: { x: r.downX, y: r.downY },
            up: { x: s.x, y: s.y },
            durationMs,
            at: s.t,
            quick: true,
          },
        ];
      }
      return out;
    },

    cancel(pointerId) {
      const r = recs.get(pointerId);
      if (r === undefined) return [];
      const out: PressEffect[] = [];
      // An own pointer already broke the pair at its down; there is nothing more to say.
      if (r.phase === 'owned') {
        recs.delete(pointerId);
        return out;
      }
      drop(r, out);
      return out;
    },

    reset() {
      recs.clear();
      pinch = null;
      return [];
    },

    tick() {
      return [];
    },

    nextDeadline() {
      return null;
    },

    stateOf(pointerId) {
      return recs.get(pointerId)?.phase;
    },
  };
}
