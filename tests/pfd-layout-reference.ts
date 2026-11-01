// Independent reference of the PFD layout (Phase 6.1, D-14). Written by hand from the design, NOT
// derived from src/aircraft/da50rg/pfd-layout.ts: a moved part is an edit of both files, so a typo
// in one of them fails tests/pfd-layout.test.ts. All numbers are in the local space of the 495 x 367
// PFD region.

/** A rectangle by left edge, top edge, width and height. */
export interface RectRef {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The glass content zone every PFD part must lie in (header and legend row are outside). */
export const ZONE_REF = { x0: 4, x1: 491, y0: 30, y1: 343 } as const;

/** Clear space every part keeps to the edge of the zone. */
export const ZONE_MARGIN = 2;

/** The attitude centre the horizon group turns about, and the reach of the synthetic vision. */
export const ATTITUDE_REF = { cx: 247.5, cy: 150, reach: 480 } as const;

/**
 * The symmetric arrangement (owner review of the narrower tapes): both tapes are 56 wide, the margin
 * from the zone edge to the speed tape and the margin from the vertical speed strip to the zone edge
 * are 56 each, and the right margin holds the CAS column.
 */
export const TAPE_WIDTH_REF = 56;
export const SIDE_MARGIN_REF = 56;

/** The speed tape: zone edge 4 plus the margin 56. */
export const SPEED_TAPE_REF: RectRef = { x: 60, y: 34, w: 56, h: 232 };

/** The altitude block: its right edge 409 leaves 4 units to the vertical speed strip at x 413. */
export const ALTITUDE_TAPE_REF: RectRef = { x: 353, y: 34, w: 56, h: 232 };
export const ALTITUDE_READOUT_REF: RectRef = { x: 357, y: 138, w: 52, h: 24 };
/** Type size of both readout numbers (the glass scale has 6, 8, 10, 14). */
export const READOUT_FONT_REF = 10;
/**
 * The barometer setting under the altitude tape: the value ends at x 384, the unit HPA starts at x 386,
 * both on the baseline y 290. A box around the two texts (value size 8 about 22 wide, unit size 6
 * about 13 wide): x 360 to 402, y 283 to 293.
 */
export const QNH_REF = {
  valueRight: 384,
  unitX: 386,
  baseline: 290,
  valueSize: 8,
  unitSize: 6,
} as const;
export const QNH_BOX_REF: RectRef = { x: 360, y: 283, w: 42, h: 10 };

/**
 * The vertical speed scale (D-11): a strip right of the altitude tape, plus and minus 3000 fpm over
 * 168 units (84 each side of the zero line at the attitude centre height 150), a tick every 500 fpm,
 * the numerals 1, 2, 3 at plus and minus each thousand, and a moving readout box of 22 x 11 whose
 * arrow tip reaches 4 units left of its body.
 */
export const VS_REF = {
  maxFpm: 3000,
  halfHeight: 84,
  tickStepFpm: 500,
  numeralFpm: [1000, 2000, 3000],
  zeroY: 150,
  /** Typed by hand: 0 and 500 to 3000 each side make 13 ticks; 1, 2, 3 each side make 6 numerals. */
  tickCount: 13,
  numeralCount: 6,
  numeralTexts: ['1', '1', '2', '2', '3', '3'],
  box: { x: 417, w: 22, h: 11, tip: 4 },
} as const;
export const VS_STRIP_REF: RectRef = { x: 413, y: 66, w: 22, h: 168 };
/** Everything the moving box can reach: the tip at x 413 to the body edge x 439, y 60.5 to 239.5. */
export const VS_TRAVEL_REF: RectRef = { x: 413, y: 60.5, w: 26, h: 179 };

/** The compass arc: radius 66 about (247.5, 338), the upper half, so x 181.5 to 313.5, y 272 to 338. */
export const COMPASS_BOX_REF: RectRef = { x: 181.5, y: 272, w: 132, h: 66 };

/** The heading box (a transparent frame around the HDG block and the compass ticks). */
export const HEADING_BOX_REF: RectRef = { x: 170, y: 276, w: 155, h: 60 };

/** The readout box of the speed tape (centred on the attitude centre height 150). */
export const SPEED_READOUT_REF: RectRef = { x: 60, y: 138, w: 44, h: 24 };

/** The heading box with its white frame, inside the heading frame. */
export const HEADING_BLOCK_REF: RectRef = { x: 218, y: 282, w: 60, h: 26 };

/** Tick geometry of the tapes: ticks at the right edge of the speed tape, at the left edge of the altitude tape. */
export const TAPE_TICKS_REF = {
  speedX1: 104,
  speedX2: 116,
  altitudeLength: 12,
  /** Offset of the tick pattern below the top of both tapes. */
  top: 9,
} as const;

/** The static unit labels under the tapes: text centre and baseline. */
export const LABELS_REF = { KT: { x: 88, y: 276 }, FT: { x: 381, y: 276 } } as const;

/** The compass: centre, radius of the rose and radius of the translucent backing half disc. */
export const COMPASS_REF = { cx: 247.5, cy: 338, r: 66, backingR: 70, ticks: 12 } as const;

/** The backing half disc as a box: x 177.5 to 317.5, y 268 to 338. */
export const BACKING_BOX_REF: RectRef = { x: 177.5, y: 268, w: 140, h: 70 };

/** The fill opacity of the dark glass of both tapes: the exact design value and the allowed range. */
export const TAPE_OPACITY_REF = 0.55;
export const TAPE_OPACITY_RANGE = { min: 0.4, max: 0.7 } as const;
/** The compass backing: dark glass at about half. */
export const BACKING_OPACITY_REF = 0.5;

/** The empty inset map frame. */
export const INSET_MAP_REF: RectRef = { x: 6, y: 280, w: 90, h: 60 };

/** The CAS column: exact design values and the ranges that make it "about half as wide, much finer". */
export const CAS_REF = {
  x: 441,
  width: 48,
  rowHeight: 9,
  /** The column starts in the lower third of the zone (y 30 to 343: from about 239) and grows upward. */
  bottom: 250,
  maxRows: 6,
  /** The old chip, kept as documented history: 100 wide and 20 high. */
  OLD_CHIP_WIDTH: 100,
  OLD_CHIP_HEIGHT: 20,
  widthRange: { min: 45, max: 60 },
  rowHeightRange: { min: 8, max: 11 },
} as const;

/** The declared glass type scale; the column uses the smallest. */
export const GLASS_FONT_SCALE: readonly number[] = [6, 8, 10, 14];

/** True when two rectangles share area (touching edges do not count). */
export function overlaps(a: RectRef, b: RectRef): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** True when `inner` lies inside the zone with `margin` to every edge. */
export function insideZone(inner: RectRef, margin: number): boolean {
  return (
    inner.x >= ZONE_REF.x0 + margin &&
    inner.y >= ZONE_REF.y0 + margin &&
    inner.x + inner.w <= ZONE_REF.x1 - margin &&
    inner.y + inner.h <= ZONE_REF.y1 - margin
  );
}
