// Pure tap rules for the zoom gesture layer (D-12, PNL-15). No DOM, no bridge: a tap on the
// panel background only ever changes the view, never a control.

/** A pointer may travel at most this far (client px) and still count as a tap. */
export const TAP_SLOP_PX = 10;
/** A tap must lift within this many ms. */
export const TAP_MAX_MS = 300;
/** After a tap-driven zoom change, a further tap within this many ms is ignored ... */
export const SUPPRESS_MS = 350;
/** ... when it lands within this many client px of the tap that caused the change. */
export const SUPPRESS_PX = 24;

export interface GestureRecord {
  /** Straight-line distance between the down and the up point, in client px. */
  readonly travelPx: number;
  readonly durationMs: number;
  /** Largest number of background pointers seen at once during the gesture. */
  readonly maxPointers: number;
  readonly startedOnTarget: boolean;
}

export interface TapContext {
  readonly zoomed: boolean;
  /** The last tap-driven zoom change, in client px and ms; null if there was none yet. */
  readonly lastChange: { readonly x: number; readonly y: number; readonly at: number } | null;
}

export interface TapPoint {
  readonly x: number;
  readonly y: number;
  readonly at: number;
}

export type TapIntent = 'zoom-in' | 'zoom-out' | 'none';

/** One finger or mouse, short and still, started on the background: a tap. */
export function isBackgroundTap(g: GestureRecord): boolean {
  return (
    !g.startedOnTarget &&
    g.maxPointers <= 1 &&
    g.travelPx <= TAP_SLOP_PX &&
    g.durationMs <= TAP_MAX_MS
  );
}

/**
 * What a background tap does. While zoomed (any level) it zooms fully out at once; from the
 * full view it zooms to the tapped region. The second tap of a double tap, close in time and
 * place to a tap-driven change, is ignored, so a double tap ends where its first tap led.
 */
export function tapIntent(ctx: TapContext, tap: TapPoint): TapIntent {
  const last = ctx.lastChange;
  if (
    last !== null &&
    tap.at - last.at <= SUPPRESS_MS &&
    Math.hypot(tap.x - last.x, tap.y - last.y) <= SUPPRESS_PX
  ) {
    return 'none';
  }
  return ctx.zoomed ? 'zoom-out' : 'zoom-in';
}
