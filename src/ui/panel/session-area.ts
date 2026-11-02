// Session area layout (phase 02, UI-SPEC "Session Control Area"): region-local rectangles of the
// three views (main, choose and, since Phase 7, run) of the region scenario_area, as pure data. Origin (0, 0) is the top left of the region
// (global x 1300, y 780); the region is 440 x 480 (it was 820 wide until Phase 5.1 moved the
// transponder beside it). The widgets that draw the buttons come in
// plan 06; nothing here touches the DOM or a registry control.

import { FURTHER_PAD } from '../../aircraft/da50rg/further-pad';
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

/**
 * The main view (free panel) is narrower than the choose view since Phase 7 (07-04, R-06): 280 wide,
 * centred at local x 220, so the three buttons leave room beside them and stay at least 44 px on screen.
 */
const MAIN_X = 80;
const MAIN_W = 280;

/**
 * The tab row of the choose view (plan 07-06, R-18): one tab per catalog group, 10 units apart, the
 * three together as wide as a full-width button; it stands below CLOSE LIST and NEXT PAGE.
 */
const TAB_COUNT = 3;
const TAB_GAP = 10;
const TAB_W = (BUTTON_W - (TAB_COUNT - 1) * TAB_GAP) / TAB_COUNT;
const TAB_TOP = 110;

/** Row tops of the choose view, below the tabs; at most three situations are listed on a page. */
const CHOOSE_ROW_TOPS = [200, 290, 380] as const;

export const SESSION_LAYOUT = {
  /** Size of the region in panel units. */
  region: { w: 440, h: 480 },
  /**
   * Main view (the free panel only, Phase 7 R-06): NEW SITUATION, CHOOSE SITUATION and RESET, 280
   * wide at x 80 (the former free slot, y 300 to 440).
   */
  main: {
    new: { x: MAIN_X, y: 20, w: MAIN_W, h: 120 },
    choose: { x: MAIN_X, y: 160, w: MAIN_W, h: 120 },
    reset: { x: MAIN_X, y: 300, w: MAIN_W, h: 120 },
  },
  /**
   * Choose view: CLOSE LIST and NEXT PAGE side by side on top (NEXT PAGE only when the selected group
   * has more situations than rows), the tab row of the catalog groups below them and one page of at
   * most three situation rows of the selected group under the tabs (Phase 5.1, plan 07-06).
   */
  choose: {
    close: { x: BUTTON_X, y: 20, w: HALF_W, h: 80 },
    next: { x: BUTTON_X + HALF_W + HALF_GAP, y: 20, w: HALF_W, h: 80 },
    tabs: Array.from({ length: TAB_COUNT }, (_, i): LocalRect => ({
      x: BUTTON_X + i * (TAB_W + TAB_GAP),
      y: TAB_TOP,
      w: TAB_W,
      h: 80,
    })),
    rows: CHOOSE_ROW_TOPS.map((y): LocalRect => ({ x: BUTTON_X, y, w: BUTTON_W, h: 80 })),
    maxRows: CHOOSE_ROW_TOPS.length,
  },
  /**
   * Run view (Phase 7, R-06), drawn while a run is live: SHOW CHECKLIST (the same label on every level) on
   * top, HINT below it (Realistic only) and a small LEAVE at the bottom right, the way out of the run through the leave-run confirm. NEW
   * SITUATION, CHOOSE SITUATION and RESET are not drawn during a run.
   */
  run: {
    checklist: { x: BUTTON_X, y: 20, w: BUTTON_W, h: 80 },
    hint: { x: BUTTON_X, y: 116, w: BUTTON_W, h: 80 },
    leave: { x: 228, y: 392, w: 177, h: 80 },
  },
  /** Button labels: size 14, weight 700, centred on their button, baseline top + h / 2 + 5. */
  label: { size: 14, weight: 700, baselineOffset: 5 },
} as const;

/** Centre x of a button (region-local): where its label is anchored. */
export function labelAnchorX(r: LocalRect): number {
  return r.x + r.w / 2;
}

/** The number of pages of the choose view for `count` situations of one group: at least 1. */
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
 * Global rectangles of every session button of the three views (new, choose, reset, close, next, the choose tabs and rows and the run view: checklist, hint, leave),
 * moved by the origin of the region scenario_area. A conservative superset like controlFootprints:
 * the Full panel corner chooser avoids all of them in every view.
 */
export function sessionFootprints(regionBounds: {
  readonly x: number;
  readonly y: number;
}): Rect[] {
  const { main, choose, run } = SESSION_LAYOUT;
  const locals: readonly LocalRect[] = [
    main.new,
    main.choose,
    main.reset,
    choose.close,
    choose.next,
    ...choose.tabs,
    ...choose.rows,
    ...Object.values(run),
  ];
  return locals.map((r) => ({
    x: regionBounds.x + r.x,
    y: regionBounds.y + r.y,
    w: r.w,
    h: r.h,
  }));
}

/**
 * Global rectangles of the nine footwell buttons (plans 07-05, 07-06): the slots of FURTHER_PAD moved by the
 * origin of the region further_area, all nine whether or not the scenario offers the conduct (a
 * conservative superset, like the session footprints) so the Full panel corner avoids them.
 */
export function furtherFootprints(regionBounds: {
  readonly x: number;
  readonly y: number;
}): Rect[] {
  return FURTHER_PAD.slots.map((slot) => ({
    x: regionBounds.x + slot.x,
    y: regionBounds.y + slot.y,
    w: slot.w,
    h: slot.h,
  }));
}
