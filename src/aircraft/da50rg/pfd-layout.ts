// PFD layout as data (Phase 6.1, D-14): the geometry that the gates read, in the local space of the
// 495 x 367 PFD region. The frame draws from these numbers and `tests/pfd-layout-reference.ts` holds
// an independent hand-written copy, so a moved part is an edit of both files. Plan 01 holds the
// content zone, the altitude block and the CAS column; later plans extend the module. Pure data and
// `+ - * /` with clamping only, no UI imports.

import { MAX_CAS_CHIPS } from '../../engine/cas';
import { GLASS, PFD_VERTICAL_SPEED_QUANTITY, readingOr } from './avionics';

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
 * The attitude centre and the reach of the synthetic vision (PNL-26): the horizon group turns about
 * (cx, cy); the view is drawn `reach` units to every side of it. The half diagonal of the content
 * zone about the centre (about 310) plus the largest pitch shift (30 degrees, 132 units) stays
 * under 440, so a reach of 480 leaves no bare edge at any attitude of the scale.
 */
export const ATTITUDE = {
  cx: 247.5,
  cy: 150,
  reach: 480,
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

/** Fill opacity of the dark glass of the speed and altitude tapes over the synthetic vision (D-09). */
export const TAPE_OPACITY = 0.55;

/** The speed tape: a dark glass rectangle with ticks at its right edge. */
export const SPEED_TAPE = {
  x: 10,
  y: 34,
  width: 80,
  height: 232,
  /** Ticks run from this x to the right edge of the tape. */
  tickX1: 74,
  tickX2: 90,
  /** Offset of the tick pattern below the top of the tape. */
  tickTop: 9,
} as const;

/** The altitude tape: the same size, ticks at its left edge. */
export const ALTITUDE_TAPE = {
  x: ALTITUDE_BLOCK.x,
  y: 34,
  width: 80,
  height: 232,
  /** Tick length from the left edge. */
  tickLength: 16,
  tickTop: 9,
} as const;

/** The white-framed black readout box of the speed tape, centred on the attitude centre height. */
export const SPEED_READOUT = {
  x: 10,
  y: ATTITUDE.cy - 16,
  width: 64,
  height: 32,
  /** Right edge of the number (text anchored at the end). */
  textRight: 66,
} as const;

/** The readout box of the altitude tape. */
export const ALTITUDE_READOUT = {
  x: ALTITUDE_BLOCK.x + 6,
  y: ATTITUDE.cy - 16,
  width: 74,
  height: 32,
  textRight: ALTITUDE_BLOCK.x + 75,
} as const;

/** Anchors (text centre, baseline) of the static unit labels under the tapes. */
export const KT_LABEL = { x: 50, y: 276 } as const;
export const FT_LABEL = { x: ALTITUDE_BLOCK.x + 40, y: 276 } as const;

/**
 * The barometer setting (D-12): the value in whole hPa, right-aligned, and the small static unit
 * HPA beside it, under the FT label of the altitude tape. Anchors are text positions (the value ends
 * at `valueRight`, the unit starts at `unitX`, both on `baseline`).
 */
export const QNH_READOUT = {
  valueRight: 398,
  unitX: 400,
  baseline: 290,
  valueSize: 8,
  unitSize: 6,
} as const;

/**
 * The compass: a half rose of radius 66 about (247.5, 338), plain, no map and no deviation bar
 * (D-02, D-10). The backing is a translucent dark half disc a little larger, so the ticks read on the
 * synthetic vision.
 */
export const COMPASS = {
  cx: 247.5,
  cy: 338,
  r: 66,
  backingR: 70,
  /** Fill opacity of the dark glass of the backing. */
  backingOpacity: 0.5,
} as const;

/** The transparent frame round the heading block and the compass ticks. */
export const HEADING_FRAME = { x: 170, y: 276, width: 155, height: 60 } as const;
/** The heading box (white frame, black fill). */
export const HEADING_BOX = { x: 218, y: 282, width: 60, height: 26 } as const;

/** The inset map: an empty frame, never any content. */
export const INSET_MAP = { x: 6, y: 280, width: 90, height: 60 } as const;

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

/**
 * The vertical speed scale (PNL-27, D-11): a narrow strip right of the altitude tape with a linear
 * scale of plus and minus 3000 fpm. The zero line stands at the height of the attitude centre; a
 * climb moves up. 84 region units for 3000 fpm make 28 per 1000 fpm. A tick stands every 500 fpm and
 * the thousands carry the static numerals 1, 2 and 3 (thousand feet per minute).
 */
export const VS_SCALE_MAX_FPM = 3000;
/** Region units from the zero line to either end of the scale. */
export const VS_HALF_HEIGHT = 84;
export const VS_TICK_STEP_FPM = 500;
/** The values (in fpm) that carry a numeral, at plus and minus each of them. */
export const VS_NUMERAL_FPM: readonly number[] = [1000, 2000, 3000];

/** The strip: a translucent dark glass rectangle, the zero line in the middle of its height. */
export const VS_STRIP = {
  x: 439,
  y: ATTITUDE.cy - VS_HALF_HEIGHT,
  width: 22,
  height: 2 * VS_HALF_HEIGHT,
  /** Tick length from the left edge of the strip: the 500 steps, the thousands, the zero mark. */
  tickShort: 4,
  tickLong: 7,
  /** Left edge of a numeral (text anchored at the start) and its size. */
  numeralX: 449,
  numeralSize: 6,
} as const;

/**
 * The moving readout box: a black body with a white frame and a small arrow tip toward the tape on
 * its left. It straddles the strip at the current rate and carries the bare number. All values are
 * for the box at the zero line; the box moves by `verticalSpeedPointerPx`.
 */
export const VS_BOX = {
  /** Left edge of the body (the tip reaches `tipLength` further left, toward the tape). */
  x: 443,
  width: 22,
  height: 11,
  /** The arrow tip: how far it reaches left of the body and its half height at the body. */
  tipLength: 4,
  tipHalfHeight: 3,
  /** The number: right-aligned text inside the body, size 7, baseline below the centre line. */
  textRight: 463.5,
  textSize: 7,
  textBaseline: 2.5,
} as const;

/**
 * The baseline of the numeral at a value: centred on its tick, but pulled inside the strip so the
 * end numerals (plus and minus 3000) do not stand half outside it. A glyph is about 0.72 of its
 * size high and sits above the baseline.
 */
export function vsNumeralBaseline(fpm: number): number {
  const centred =
    ATTITUDE.cy - (fpm / VS_SCALE_MAX_FPM) * VS_HALF_HEIGHT + VS_STRIP.numeralSize / 3;
  const lowest = VS_STRIP.y + VS_STRIP.height - 1;
  const highest = VS_STRIP.y + VS_STRIP.numeralSize * 0.72 + 1;
  if (centred > lowest) return lowest;
  return centred < highest ? highest : centred;
}

/** The reading in fpm clamped to the scale; a missing or non-finite reading is the quantity base. */
function clampedFpm(value: number | undefined): number {
  const reading = readingOr(value, PFD_VERTICAL_SPEED_QUANTITY);
  if (reading > VS_SCALE_MAX_FPM) return VS_SCALE_MAX_FPM;
  return reading < -VS_SCALE_MAX_FPM ? -VS_SCALE_MAX_FPM : reading;
}

/**
 * The offset of the readout box from the zero line in region units: a climb is negative (up), a
 * sink positive (down). The reading is clamped to the scale; a missing or non-finite reading is the
 * base of the quantity. A negative zero turns into 0, so the free panel has the identity transform.
 */
export function verticalSpeedPointerPx(value: number | undefined): number {
  return 0 - (clampedFpm(value) / VS_SCALE_MAX_FPM) * VS_HALF_HEIGHT + 0;
}

/**
 * The number in the box: the bare vertical speed in fpm, never a sign (sinking shows by the position
 * of the box only), rounded to the nearest 50 fpm and clamped to the scale. Never "-0".
 */
export function verticalSpeedReadout(value: number | undefined): string {
  const fpm = clampedFpm(value);
  const magnitude = fpm < 0 ? 0 - fpm : fpm;
  return String(Math.round(magnitude / 50) * 50);
}
