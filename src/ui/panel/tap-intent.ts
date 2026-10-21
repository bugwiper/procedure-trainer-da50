// Pure tap rules for the zoom gesture layer (R2-Z1, PNL-15). No DOM, no bridge, no timer: a
// double tap on the panel background only ever changes the view, never a control. A single tap
// never zooms (this supersedes D-12).

/** How the pointer reaches the panel; a pointer of unknown type is treated as touch by the glue. */
export type PointerKind = 'mouse' | 'touch' | 'pen';

/** A touch, a pen or a pointer of unknown type may travel at most this far (client px) and still tap. */
export const TOUCH_SLOP_PX = 10;
/** A mouse may travel at most this far (client px) and still count as a click (R3-Z2 item 4). */
export const MOUSE_SLOP_PX = 5;

/** The slop of one press, by pointer kind: one source for every press rule of the panel. */
export function slopPx(kind: PointerKind): number {
  return kind === 'mouse' ? MOUSE_SLOP_PX : TOUCH_SLOP_PX;
}
/** A tap must lift within this many ms. */
export const TAP_MAX_MS = 300;
/** Largest time (ms) between the lift of the first tap and the lift of the second, inclusive. */
export const DOUBLE_TAP_MS = 350;
/** Largest distance (client px) between the two taps, inclusive. */
export const DOUBLE_TAP_PX = 24;

/**
 * After a double tap zooms in, WebKit can deliver a synthesized click to the Full panel button
 * that has just appeared under the finger. A click inside this many ms of the view change is
 * ignored unless the button itself was pressed after the change.
 */
export const FULL_PANEL_GUARD_MS = 400;

export interface GestureRecord {
  readonly kind: PointerKind;
  /** Straight-line distance between the down and the up point, in client px. */
  readonly travelPx: number;
  readonly durationMs: number;
  /** Largest number of background pointers seen at once during the gesture. */
  readonly maxPointers: number;
  readonly startedOnTarget: boolean;
}

export interface TapPoint {
  readonly x: number;
  readonly y: number;
  /** Lift time of the tap, in ms. */
  readonly at: number;
}

export type DoubleTapIntent = 'zoom-in' | 'zoom-out' | 'none';

export interface DoubleTapTracker {
  /** Feeds one background tap; returns what the pair, if this tap completes one, asks for. */
  tap(point: TapPoint, zoomed: boolean): DoubleTapIntent;
  /** Forgets the remembered tap: anything but a background tap happened between the two. */
  reset(): void;
}

/** One finger or mouse, short and still (slop by pointer kind), started on the background: a tap. */
export function isBackgroundTap(g: GestureRecord): boolean {
  return (
    !g.startedOnTarget &&
    g.maxPointers <= 1 &&
    g.travelPx <= slopPx(g.kind) &&
    g.durationMs <= TAP_MAX_MS
  );
}

/**
 * Remembers the last background tap. A second tap within DOUBLE_TAP_MS and DOUBLE_TAP_PX of it
 * (lift to lift, both inclusive) is a double tap: it zooms out while zoomed (any level) and in
 * from the full view, and the pair is consumed, so a third quick tap starts a new pair. Any
 * other tap only becomes the remembered one. A pure function of timestamps and coordinates.
 */
export function createDoubleTapTracker(): DoubleTapTracker {
  let last: TapPoint | null = null;
  return {
    tap(point, zoomed) {
      const prev = last;
      if (
        prev !== null &&
        point.at - prev.at <= DOUBLE_TAP_MS &&
        Math.hypot(point.x - prev.x, point.y - prev.y) <= DOUBLE_TAP_PX
      ) {
        last = null;
        return zoomed ? 'zoom-out' : 'zoom-in';
      }
      last = point;
      return 'none';
    },
    reset() {
      last = null;
    },
  };
}

/**
 * True when a click on the Full panel button is the stray one left over from the tap that
 * zoomed in: it comes within FULL_PANEL_GUARD_MS of the view change (shownAt, null when no tap
 * changed the view) and no pointer was pressed on the button since the change (pressedAt).
 * A real tap presses the button first, so it is never ignored, however soon it follows. A pure
 * function of timestamps taken from event.timeStamp; no timer.
 */
export function isStrayFullPanelClick(c: {
  readonly shownAt: number | null;
  readonly pressedAt: number | null;
  readonly clickAt: number;
}): boolean {
  if (c.shownAt === null) return false;
  if (c.clickAt - c.shownAt >= FULL_PANEL_GUARD_MS) return false;
  return c.pressedAt === null || c.pressedAt < c.shownAt;
}
