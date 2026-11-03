// The sea of the ditching scene (Phase 9, R-03, plan 09-04): wave bands that come toward the pilot
// as the cue `water_near` rises. This file is the one growth law; the windscreen (scenes.tsx) and the
// synthetic vision of the PFD (frames/SyntheticVision.tsx) both read it and project it with their own
// perspective helpers, so they cannot disagree (the same arrangement as field.ts). Pure arithmetic:
// + - * / and clamping only, no Math call but min and max. Art values tuned from screenshots,
// instructor review values, not AFM figures.

/**
 * One wave band at one level, as rows (fractions of the visible depth below the horizon: 0 the
 * horizon, 1 the bottom of the picture, more than 1 below it): the far and the near edge of the dark
 * trough and the near edge of the thin light crest that rides on top of it.
 */
export interface WaterBand {
  readonly farRow: number;
  readonly nearRow: number;
  /** The row of the crest line: between the far edge and the near edge of the band. */
  readonly crestRow: number;
}

export interface WaterGeometry {
  /** The bands from the nearest to the farthest; a fixed number at every level. */
  readonly bands: readonly WaterBand[];
}

/**
 * The distance of the near edge of each band from the eye, in units of the distance of the bottom
 * row of the picture, at level 0 and at level 1 (the first band is the nearest). The distance falls
 * linearly with an eased level and a row is the inverse of the distance (flat water seen in
 * perspective, the law of `fieldGeometry`). At level 1 the near edge of the first band (0.8) lies
 * below the picture (row 1.25). Every band lies beyond the far edge of the one before it at both
 * ends, so (both distances being linear in the eased level) at every level the bands do not overlap.
 */
const NEAR_DISTANCE = [
  { at0: 10, at1: 0.8 },
  { at0: 14, at1: 1.7 },
  { at0: 19, at1: 2.8 },
  { at0: 27, at1: 4.2 },
  { at0: 37, at1: 6.2 },
  { at0: 50, at1: 9 },
] as const;

/** How much farther the far edge of a band lies than its near edge, as a fraction of the near distance. */
const BAND_DEPTH = 0.35;
/** How deep the crest line is, as a fraction of the band's depth measured from the near edge. */
const CREST_AT = 0.2;

/**
 * The lateral extent of a band, as a fraction of the half picture width: wider than the picture on
 * both sides, and the same at every row, because a wave band runs across the whole view like the
 * horizon does (it is not a line through the vanishing point).
 */
export const WATER_LATERAL = 1.7;

/** The level clamped to 0..1; not a number reads as 0. */
function clamp01(level: number): number {
  return level > 0 ? Math.min(level, 1) : 0;
}

/** The wave bands at `level` (0 a few thin lines at the horizon, 1 the nearest band below the picture). */
export function waterGeometry(level: number): WaterGeometry {
  const l = clamp01(level);
  // Eased like the field: the sea is already a sea at half the descent, still rising with the level.
  const u = l * (2 - l);
  return {
    bands: NEAR_DISTANCE.map(({ at0, at1 }) => {
      const near = at0 + (at1 - at0) * u;
      const far = near * (1 + BAND_DEPTH);
      const crest = near + (far - near) * CREST_AT;
      return { nearRow: 1 / near, farRow: 1 / far, crestRow: 1 / crest };
    }),
  };
}

/** The paints of the sea, read by both renderers. */
export const WATER_PALETTE = {
  /** The dark trough of a wave band, over the sea fill. */
  trough: '#17405e',
  /** The light crest line along the near edge of a band. */
  crest: '#a5c9dd',
} as const;

/** A corner of a band: a lateral measure (fraction of the half picture width) and a row. */
export type WaterCorner = readonly [lateral: number, row: number];
/** A quadrilateral of the sea: near left, near right, far right, far left. */
export type WaterQuad = readonly [WaterCorner, WaterCorner, WaterCorner, WaterCorner];

export interface WaterPolygons {
  /** The dark troughs, one per band, nearest first. */
  readonly troughs: readonly WaterQuad[];
  /** The light crest lines, one per band in the same order. */
  readonly crests: readonly WaterQuad[];
}

/** A strip across the whole picture between two rows. */
function strip(nearRow: number, farRow: number): WaterQuad {
  return [
    [-WATER_LATERAL, nearRow],
    [WATER_LATERAL, nearRow],
    [WATER_LATERAL, farRow],
    [-WATER_LATERAL, farRow],
  ];
}

/** Everything the renderers draw of the sea at `level`, as corners in (lateral, row) space. */
export function waterPolygons(level: number): WaterPolygons {
  const { bands } = waterGeometry(level);
  return {
    troughs: bands.map((band) => strip(band.nearRow, band.farRow)),
    crests: bands.map((band) => strip(band.nearRow, band.crestRow)),
  };
}
