// The runway marks of the take-off roll as a self-similar series (Phase 5, A-05). Pure numbers, no
// framework: scenes.tsx draws them and tests/windscreen.test.ts checks the loop on the same data.
//
// A mark at depth z has the screen size of the template divided by z: x = X / z, y = depth / z
// (the vanishing point is the origin, y grows towards the viewer, `depth` is the distance from the
// horizon to the bottom edge of the picture). Mark n sits at z_n = FIRST * RATIO^n, so the
// template, scaled about the vanishing point by RATIO, lands exactly on the mark nearer by one
// slot: the animation scales the whole row from 1 to RATIO once per period, and the last frame is
// the first frame again. Two things hide the ends of the row without a pop: the nearest slot lies
// below the bottom edge, and a screen-space fade (rollOpacity, the mask of the scene) takes the
// far marks to nothing before the farthest slot. Arithmetic: + - * / only.

/** Equal steps of the keyframes: the scale grows in steps of one factor, close to constant speed. */
export const ROLL_STEPS = 8;
const STEP_RATIO = 1.03;

/** Scale factors at the keyframes, 1 at the start, ROLL_RATIO at the end (repeated products). */
export function rollScales(): number[] {
  const out = [1];
  for (let i = 0; i < ROLL_STEPS; i++) out.push((out[i] as number) * STEP_RATIO);
  return out;
}

/** Scale of one whole period: depth ratio between two neighbouring marks. */
export const ROLL_RATIO = rollScales()[ROLL_STEPS] as number;
/** Depth of the nearest mark (1 is the bottom edge of the picture). */
export const ROLL_FIRST_DEPTH = 1;
/** Index of the farthest mark: invisible at the start of the period, the new mark of its end. */
export const ROLL_LAST = 16;
/** Marks nearer than this index are fully opaque; the fade runs from here to ROLL_LAST. */
export const ROLL_FULL_FROM = 9;

export type RollKind = 'centre' | 'edge' | 'seam-light' | 'seam-dark' | 'rubber';
/** Draw order of the kinds inside one mark. */
export const ROLL_KINDS: readonly RollKind[] = [
  'centre',
  'edge',
  'seam-light',
  'seam-dark',
  'rubber',
];

export const ROLL_COLOURS: Record<RollKind, { fill: string; opacity: number }> = {
  centre: { fill: '#f1f1ea', opacity: 1 },
  edge: { fill: '#ffe9a3', opacity: 1 },
  'seam-light': { fill: '#b9bec3', opacity: 0.85 },
  'seam-dark': { fill: '#1b1e21', opacity: 0.8 },
  rubber: { fill: '#17191b', opacity: 0.7 },
};

/** Offset of the warm edge dashes from the centre line: just inside the white edge lines (610 to 634). */
const EDGE_OFFSET = 578;
/** The seam spans the runway between the edge dashes. */
const SEAM_HALF = 560;

/** One rectangle of the template: lateral centre and half width (world units), depth factors near and far. */
type Slab = readonly [centre: number, half: number, near: number, far: number];

/** The template of one mark: depth factors are relative to the depth of the mark (1 = its near edge). */
const TEMPLATE: Record<RollKind, readonly Slab[]> = {
  centre: [[0, 12, 1, 1.14]],
  edge: [
    [-EDGE_OFFSET, 16, 1, 1.12],
    [EDGE_OFFSET, 16, 1, 1.12],
  ],
  'seam-light': [[0, SEAM_HALF, 1.16, 1.19]],
  'seam-dark': [[0, SEAM_HALF, 1.19, 1.205]],
  // Two tyre tracks at fixed places beside the centre line.
  rubber: [
    [-170, 22, 1.02, 1.11],
    [215, 16, 1.06, 1.16],
  ],
};

/** The largest depth factor of the template: it must stay below ROLL_RATIO so marks never overlap. */
export const ROLL_TEMPLATE_FAR = 1.205;

export type Point = readonly [number, number];
export type RollPolygon = readonly [Point, Point, Point, Point];

/** Depth of mark n (n = -1 is the slot below the picture). */
export function rollDepth(n: number): number {
  let z = ROLL_FIRST_DEPTH;
  for (let i = 0; i < n; i++) z *= ROLL_RATIO;
  for (let i = 0; i > n; i--) z /= ROLL_RATIO;
  return z;
}

/** The polygons of one kind of mark n, relative to the vanishing point (y down). */
export function rollPolygons(depth: number, n: number, kind: RollKind): RollPolygon[] {
  const z = rollDepth(n);
  return TEMPLATE[kind].map(([centre, half, near, far]) => {
    const dn = z * near;
    const df = z * far;
    return [
      [(centre - half) / df, depth / df],
      [(centre + half) / df, depth / df],
      [(centre + half) / dn, depth / dn],
      [(centre - half) / dn, depth / dn],
    ] as const;
  });
}

/** y (relative to the horizon) from which the far marks are not drawn at all, and from which on they are opaque. */
export function rollFadeRange(depth: number): { zero: number; full: number } {
  return { zero: depth / rollDepth(ROLL_LAST), full: depth / rollDepth(ROLL_FULL_FROM) };
}

/** The fade of the scene as a function of the row (y relative to the horizon): 0 far away, 1 near. */
export function rollOpacity(depth: number, y: number): number {
  const { zero, full } = rollFadeRange(depth);
  if (y <= zero) return 0;
  if (y >= full) return 1;
  return (y - zero) / (full - zero);
}

/** Position, size and opacity of the first polygon of a kind of mark n when the row is scaled by `scale`. */
export function rollState(
  depth: number,
  n: number,
  kind: RollKind,
  scale: number,
): { x: number; y: number; w: number; h: number; opacity: number } {
  const poly = rollPolygons(depth, n, kind)[0] as RollPolygon;
  const xs = poly.map((p) => p[0] * scale);
  const ys = poly.map((p) => p[1] * scale);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    w: right - left,
    h: bottom - top,
    // The fade is a screen-space mask: the opacity of a mark is the mask at its near edge.
    opacity: rollOpacity(depth, bottom),
  };
}

/**
 * The playback rate of the scrolling marks for the roll_speed cue level (Phase 5.1, P-04): the
 * level itself, clamped to 0..1, a level that is not a number counted as 0. 1 is the full rate
 * (the period of --w-roll-period in stage.css), 0 stands the marks still.
 */
export function rollRate(level: number): number {
  if (!(level > 0)) return 0;
  return level < 1 ? level : 1;
}
