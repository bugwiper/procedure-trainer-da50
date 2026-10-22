// Session area layout (phase 02, UI-SPEC "Session Control Area"): region-local rectangles of the
// two views of the region scenario_area, as pure data. Origin (0, 0) is the top left of the region
// (global x 1300, y 780); the region is 820 x 480. The widgets that draw the buttons come in
// plan 06; nothing here touches the DOM or a registry control.

import type { Rect } from '../../engine/registry';

export interface LocalRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Horizontal extent of every session button (region-local), centred at local x 410. The 35 unit
 * margins keep the desktop Full panel button clear of the buttons whichever corner it takes: at
 * the desktop profile the zoomed area leaves 58 px of letterbox and the 112 px button reaches
 * 54 px into the content, which a 20 unit margin (28 px) cannot clear (U-07, plan 02-10).
 */
const BUTTON_X = 35;
const BUTTON_W = 750;

/** Row tops of the choose view; at most four situations are listed. */
const CHOOSE_ROW_TOPS = [110, 200, 290, 380] as const;

export const SESSION_LAYOUT = {
  /** Size of the region in panel units. */
  region: { w: 820, h: 480 },
  /** Main view: NEW SITUATION, CHOOSE SITUATION and a free slot reserved below them. */
  main: {
    new: { x: BUTTON_X, y: 20, w: BUTTON_W, h: 120 },
    choose: { x: BUTTON_X, y: 160, w: BUTTON_W, h: 120 },
    /** Reserved, y 300 to 440. */
    freeSlot: { x: BUTTON_X, y: 300, w: BUTTON_W, h: 140 },
  },
  /** Choose view: a close button on top and at most four situation rows below it. */
  choose: {
    close: { x: BUTTON_X, y: 20, w: BUTTON_W, h: 80 },
    rows: CHOOSE_ROW_TOPS.map((y): LocalRect => ({ x: BUTTON_X, y, w: BUTTON_W, h: 80 })),
    maxRows: CHOOSE_ROW_TOPS.length,
  },
  /** Button labels: size 14, weight 700, centred at local x 410, baseline top + h / 2 + 5. */
  label: { size: 14, weight: 700, anchorX: 410, baselineOffset: 5 },
} as const;

/** Baseline of a button label inside the rectangle r (label rule of SESSION_LAYOUT). */
export function labelBaseline(r: LocalRect): number {
  return r.y + r.h / 2 + SESSION_LAYOUT.label.baselineOffset;
}

/**
 * Global rectangles of every session button of both views (new, choose, close and the choose rows),
 * moved by the origin of the region scenario_area. A conservative superset like controlFootprints:
 * the Full panel corner chooser avoids all of them in either view. The reserved free slot is not a
 * button and is left out.
 */
export function sessionFootprints(regionBounds: {
  readonly x: number;
  readonly y: number;
}): Rect[] {
  const { main, choose } = SESSION_LAYOUT;
  const locals: readonly LocalRect[] = [main.new, main.choose, choose.close, ...choose.rows];
  return locals.map((r) => ({
    x: regionBounds.x + r.x,
    y: regionBounds.y + r.y,
    w: r.w,
    h: r.h,
  }));
}
