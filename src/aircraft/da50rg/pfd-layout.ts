// PFD layout as data (Phase 6.1, D-14): the geometry that the gates read, in the local space of the
// 495 x 367 PFD region. The frame draws from these numbers and `tests/pfd-layout-reference.ts` holds
// an independent hand-written copy, so a moved part is an edit of both files. Plan 01 holds the
// content zone, the altitude block and the CAS column; later plans extend the module. Pure data and
// `+ - * /` with clamping only, no UI imports.

import { MAX_CAS_CHIPS } from '../../engine/cas';
import { GLASS } from './avionics';

/** The glass content zone: where every painted PFD element between header and legend must lie. */
export const PFD_ZONE = {
  /** Left and right edge of the inner glass (the screen rectangle is inset 4 from the region). */
  x0: 4,
  x1: 491,
  /** Top and bottom come from the glass bands (header above, legend row below). */
  y0: GLASS.content.y0,
  y1: GLASS.content.y1,
} as const;

/**
 * The altitude block: the tape and everything that hangs on it (readout box, FT label, baro box,
 * VS box) share one left edge. It moved 50 units left of its old place (x 405) to make room for the
 * CAS column in the lower right corner.
 */
export const ALTITUDE_BLOCK = {
  /** Left edge of the altitude tape. */
  x: 355,
} as const;

/**
 * The CAS column (PNL-25, D-03 to D-05): black rows joined without a gap at the lower right, right
 * of the altitude tape. The bottom edge is fixed, so each further message grows the column upward.
 */
export const CAS_COLUMN = {
  /** Left edge of every row. */
  x: 437,
  /** Row width: about half of the old 100 wide chip. */
  width: 52,
  /** Row height: much finer than the old 20 high chip. */
  rowHeight: 9,
  /** Bottom edge of the lowest row, just inside the bottom of the content zone. */
  bottom: 341,
  /** Text baseline below the row top: centres a size 6 capital line in the row. */
  textBaseline: 6.5,
  /** Type size, the smallest of the declared glass scale 6, 8, 10, 14. */
  fontSize: 6,
  /** Most rows drawn; a further message is not drawn (lint rejects a scenario that fires more). */
  maxRows: MAX_CAS_CHIPS,
} as const;

/** One drawn row of the column, in region-local units. */
export interface CasRow {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Rectangles of the first min(count, maxRows) messages, top row first. Row i of n stands at
 * y = bottom - (n - i) * rowHeight: rows touch, and the bottom edge is the same for every n.
 */
export function casColumnRows(count: number): CasRow[] {
  const n = Math.max(0, Math.min(count, CAS_COLUMN.maxRows));
  const rows: CasRow[] = [];
  for (let i = 0; i < n; i += 1) {
    rows.push({
      x: CAS_COLUMN.x,
      y: CAS_COLUMN.bottom - (n - i) * CAS_COLUMN.rowHeight,
      width: CAS_COLUMN.width,
      height: CAS_COLUMN.rowHeight,
    });
  }
  return rows;
}
