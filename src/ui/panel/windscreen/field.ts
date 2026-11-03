// The landing field of the approach scene (Phase 9, D-05, D-06, P-01): one fixed field that grows
// toward the pilot as the cue `field_near` rises. This file is the one growth law; the windscreen
// (scenes.tsx) and the synthetic vision of the PFD (frames/SyntheticVision.tsx) both read it and
// project it with their own perspective helpers, so they cannot disagree. Pure arithmetic: + - * /
// and clamping only, no Math call but min and max. Art values tuned from screenshots, instructor
// review values, not AFM figures.

/**
 * The geometry of the field at one level. Rows are fractions of the visible ground depth below the
 * horizon (0 the horizon, 1 the bottom of the picture, more than 1 below it). Lateral measures are
 * fractions of the half width of the picture at its bottom row, scaled by the row like every line
 * through the vanishing point: `nearCentre` and `nearHalf` belong to the near edge, `farCentre`
 * and `farHalf` to the far edge, and the centre is right of the vanishing point (the strut).
 */
export interface FieldGeometry {
  readonly nearRow: number;
  readonly farRow: number;
  readonly nearCentre: number;
  readonly farCentre: number;
  readonly nearHalf: number;
  readonly farHalf: number;
}

/**
 * Distances of the two edges from the eye, in units of the distance of the bottom row of the
 * picture, at level 0 and at level 1; the distance falls linearly with an eased level and a row is the
 * inverse of the distance (a rectangle on flat ground seen in perspective). At level 1 the near
 * edge (0.8) lies below the picture (row 1.25).
 */
const NEAR_DISTANCE = { at0: 15, at1: 0.8 } as const;
const FAR_DISTANCE = { at0: 24, at1: 5 } as const;
/** Half width of the field and lateral place of its centre, as fractions of the bottom half width, per unit of row. */
const HALF_WIDTH = 0.4;
const CENTRE = 0.45;

/** The level clamped to 0..1; not a number reads as 0. */
function clamp01(level: number): number {
  return level > 0 ? Math.min(level, 1) : 0;
}

/** The geometry of the field at `level` (0 a speck at the horizon, 1 the near edge below the picture). */
export function fieldGeometry(level: number): FieldGeometry {
  const l = clamp01(level);
  // Eased so that the field is already a field at half the descent (a straight law would keep it a
  // sliver until the last quarter): the same on both edges, still rising with the level.
  const u = l * (2 - l);
  const nearRow = 1 / (NEAR_DISTANCE.at0 + (NEAR_DISTANCE.at1 - NEAR_DISTANCE.at0) * u);
  const farRow = 1 / (FAR_DISTANCE.at0 + (FAR_DISTANCE.at1 - FAR_DISTANCE.at0) * u);
  return {
    nearRow,
    farRow,
    nearCentre: CENTRE * nearRow,
    farCentre: CENTRE * farRow,
    nearHalf: HALF_WIDTH * nearRow,
    farHalf: HALF_WIDTH * farRow,
  };
}

/** The paints of the field, read by both renderers. */
export const FIELD_PALETTE = {
  /** The stubble of the field. */
  stubble: '#c2b36a',
  /** The furrow stripes toward the vanishing point. */
  furrow: '#a08f4d',
  /** The hedge along the edges. */
  hedge: '#3d5a2c',
} as const;

/** Positions of the furrow stripes across the field: fractions from the left edge (0) to the right edge (1). */
export const FURROW_AT = [0.2, 0.5, 0.8] as const;
/** Half width of a furrow stripe as a fraction of the field width. */
export const FURROW_HALF = 0.035;
/** Thickness of the hedge strip as a fraction of the field width (sides) and of the field depth (far edge). */
export const HEDGE_SIDE = 0.05;

/** A corner of the field: a lateral measure (fraction of the bottom half width) and a row. */
export type FieldCorner = readonly [lateral: number, row: number];
/** A quadrilateral of the field: near left, near right, far right, far left. */
export type FieldQuad = readonly [FieldCorner, FieldCorner, FieldCorner, FieldCorner];

export interface FieldPolygons {
  /** The whole field, the hedge colour shows between it and `inner`. */
  readonly outer: FieldQuad;
  /** The stubble inside the hedge: inset at both sides and at the far edge. */
  readonly inner: FieldQuad;
  /** The darker furrow stripes, one quadrilateral each, from the near edge to the far edge of `inner`. */
  readonly furrows: readonly FieldQuad[];
}

/**
 * The quadrilateral between two rows of a band that lies between the lateral fractions `left` and
 * `right` (0 the left edge, 1 the right edge of the field, per unit of row): every side of the
 * band runs through the vanishing point, as a line on flat ground does.
 */
function bandQuad(
  g: FieldGeometry,
  left: number,
  right: number,
  nearRow: number,
  farRow: number,
): FieldQuad {
  const centre = g.nearCentre / g.nearRow;
  const half = g.nearHalf / g.nearRow;
  const at = (fraction: number, row: number): FieldCorner => [
    (centre - half + 2 * half * fraction) * row,
    row,
  ];
  return [at(left, nearRow), at(right, nearRow), at(right, farRow), at(left, farRow)];
}

/** Everything the renderers draw of the field at `level`, as corners in (lateral, row) space. */
export function fieldPolygons(level: number): FieldPolygons {
  const g = fieldGeometry(level);
  const outer = bandQuad(g, 0, 1, g.nearRow, g.farRow);
  const innerFar = g.farRow + (g.nearRow - g.farRow) * HEDGE_SIDE;
  const inner = bandQuad(g, HEDGE_SIDE, 1 - HEDGE_SIDE, g.nearRow, innerFar);
  const furrows = FURROW_AT.map((at) =>
    bandQuad(g, at - FURROW_HALF, at + FURROW_HALF, g.nearRow, innerFar),
  );
  return { outer, inner, furrows };
}
