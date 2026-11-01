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

/** The speed tape (unchanged position). */
export const SPEED_TAPE_REF: RectRef = { x: 10, y: 34, w: 80, h: 232 };

/** The altitude block after the move 50 units left, from x 355. */
export const ALTITUDE_TAPE_REF: RectRef = { x: 355, y: 34, w: 80, h: 232 };
export const ALTITUDE_READOUT_REF: RectRef = { x: 361, y: 134, w: 74, h: 32 };
export const BARO_BOX_REF: RectRef = { x: 355, y: 280, w: 80, h: 20 };
export const VS_BOX_REF: RectRef = { x: 355, y: 304, w: 80, h: 20 };

/** The compass arc: radius 66 about (247.5, 338), the upper half, so x 181.5 to 313.5, y 272 to 338. */
export const COMPASS_BOX_REF: RectRef = { x: 181.5, y: 272, w: 132, h: 66 };

/** The heading box (a transparent frame around the HDG block and the compass ticks). */
export const HEADING_BOX_REF: RectRef = { x: 170, y: 276, w: 155, h: 60 };

/** The empty inset map frame. */
export const INSET_MAP_REF: RectRef = { x: 6, y: 280, w: 90, h: 60 };

/** The CAS column: exact design values and the ranges that make it "about half as wide, much finer". */
export const CAS_REF = {
  x: 437,
  width: 52,
  rowHeight: 9,
  bottom: 341,
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
