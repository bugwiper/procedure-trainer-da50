// Session area layout (phase 02, UI-SPEC "Session Control Area"): region-local rectangles of the
// two views of the region scenario_area, as pure data. Origin (0, 0) is the top left of the region
// (global x 1300, y 780); the region is 440 x 480 (it was 820 wide until Phase 5.1 moved the
// transponder beside it). The widgets that draw the buttons come in
// plan 06; nothing here touches the DOM or a registry control.

import type { Rect } from '../../engine/registry';

export interface LocalRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Horizontal extent of every full-width session button (region-local), centred at local x 220. The
 * 35 unit margins keep the desktop Full panel button clear of the buttons whichever corner it
 * takes: at the desktop profile the zoomed area leaves 58 px of letterbox and the 112 px button
 * reaches 54 px into the content, which a 20 unit margin (28 px) cannot clear (U-07, plan 02-10).
 */
const BUTTON_X = 35;
const BUTTON_W = 370;
/** The two half-width buttons of the top row of the choose view, with this gap between them. */
const HALF_GAP = 16;
const HALF_W = (BUTTON_W - HALF_GAP) / 2;

/** Row tops of the choose view; at most four situations are listed on a page. */
const CHOOSE_ROW_TOPS = [110, 200, 290, 380] as const;

export const SESSION_LAYOUT = {
  /** Size of the region in panel units. */
  region: { w: 440, h: 480 },
  /** Main view: NEW SITUATION, CHOOSE SITUATION and RESET (the former free slot, y 300 to 440). */
  main: {
    new: { x: BUTTON_X, y: 20, w: BUTTON_W, h: 120 },
    choose: { x: BUTTON_X, y: 160, w: BUTTON_W, h: 120 },
    reset: { x: BUTTON_X, y: 300, w: BUTTON_W, h: 120 },
  },
  /**
   * Choose view: CLOSE LIST and NEXT PAGE side by side on top (NEXT PAGE only when there are more
   * situations than rows) and one page of at most four situation rows below them (Phase 5.1).
   */
  choose: {
    close: { x: BUTTON_X, y: 20, w: HALF_W, h: 80 },
    next: { x: BUTTON_X + HALF_W + HALF_GAP, y: 20, w: HALF_W, h: 80 },
    rows: CHOOSE_ROW_TOPS.map((y): LocalRect => ({ x: BUTTON_X, y, w: BUTTON_W, h: 80 })),
    maxRows: CHOOSE_ROW_TOPS.length,
  },
  /** Button labels: size 14, weight 700, centred on their button, baseline top + h / 2 + 5. */
  label: { size: 14, weight: 700, baselineOffset: 5 },
} as const;

/** Centre x of a button (region-local): where its label is anchored. */
export function labelAnchorX(r: LocalRect): number {
  return r.x + r.w / 2;
}

/** The number of pages of the choose view for `count` situations: at least 1. */
export function pageCount(count: number): number {
  const rows = SESSION_LAYOUT.choose.maxRows;
  const pages = Math.ceil(count / rows);
  return pages > 1 ? pages : 1;
}

/** The entries of one page (0-based) of the choose view; a page outside the range is empty. */
export function pageSlice<T>(items: readonly T[], page: number): readonly T[] {
  const rows = SESSION_LAYOUT.choose.maxRows;
  return items.slice(page * rows, page * rows + rows);
}

/** Baseline of a button label inside the rectangle r (label rule of SESSION_LAYOUT). */
export function labelBaseline(r: LocalRect): number {
  return r.y + r.h / 2 + SESSION_LAYOUT.label.baselineOffset;
}

/**
 * Global rectangles of every session button of both views (new, choose, reset, close, next and the choose rows),
 * moved by the origin of the region scenario_area. A conservative superset like controlFootprints:
 * the Full panel corner chooser avoids all of them in either view.
 */
export function sessionFootprints(regionBounds: {
  readonly x: number;
  readonly y: number;
}): Rect[] {
  const { main, choose } = SESSION_LAYOUT;
  const locals: readonly LocalRect[] = [
    main.new,
    main.choose,
    main.reset,
    choose.close,
    choose.next,
    ...choose.rows,
  ];
  return locals.map((r) => ({
    x: regionBounds.x + r.x,
    y: regionBounds.y + r.y,
    w: r.w,
    h: r.h,
  }));
}
