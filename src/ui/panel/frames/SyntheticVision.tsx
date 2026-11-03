import type { JSX } from 'preact';
import { DEFAULT_SCENE } from '../../../aircraft/da50rg/scenes';
import type { SceneId } from '../../../aircraft/da50rg/scenes';
import { FIELD_COLOURS, SCENE_GRADIENTS, isSceneId } from '../windscreen/scenes';
import type { GradientColours, SceneGradientId } from '../windscreen/scenes';

// Synthetic vision (Phase 6.1, PNL-26, D-07, D-08): the simplified outside view of the situation's
// scene under the whole PFD glass. A pure function component (no hooks) that draws in
// horizon-local coordinates, the horizon line at y = cy, so the horizon group of the PFD moves and
// turns it with pitch and bank. Flat vector art in the palette of the windscreen (one table, the
// scene gradients), no text (G-0), no animation, no filter and no mask (the phones redraw the PFD on
// every simulation step). Perspective arithmetic uses + - * / only.

/** Per-scene recipe: the palette entries of the sky and the ground and the art laid on the ground. */
export interface SvtStyle {
  readonly sky: SceneGradientId;
  readonly ground: SceneGradientId;
  /** The art on the ground: perspective field patches, the apron with its taxi line, or the runway. */
  readonly art: 'fields' | 'apron' | 'runway';
}

/**
 * The look of each scene, typed by the scene ids of the aircraft data: a scene without a style
 * fails the typecheck. Synthetic vision is always clear (D-19): the cloud scene shows the same
 * terrain as cruise.
 */
export const SVT_STYLES: Readonly<Record<SceneId, SvtStyle>> = {
  parked: { sky: 'w-sky-parked', ground: 'w-apron', art: 'apron' },
  takeoff_roll: { sky: 'w-sky-roll', ground: 'w-grass', art: 'runway' },
  cruise: { sky: 'w-sky-cruise', ground: 'w-ground-cruise', art: 'fields' },
  cloud: { sky: 'w-sky-cruise', ground: 'w-ground-cruise', art: 'fields' },
  // Task 1 of Phase 9 only: the field art of the approach follows in the next commit.
  outlanding: { sky: 'w-sky-cruise', ground: 'w-ground-cruise', art: 'fields' },
};

/** Height over which the sky colours run from the top colour to the horizon colour. */
const SKY_SPAN = 200;
/** Depth below the horizon over which the ground colours run. */
const GROUND_SPAN = 260;
/**
 * The haze on the horizon: a thin light band that softens the line. A vertical gradient of one
 * colour that is clear at both edges and strongest just under the horizon, so no edge shows.
 */
const HAZE = { above: 8, height: 40, colour: '#dcebf6', opacity: 0.5, peak: 0.2 } as const;

const WHITE_PAINT = '#f1f1ea';
const TAXI_YELLOW = '#e6c229';

/** Half width of the runway at the bottom of the view (`reach` below the horizon). */
const RUNWAY_HALF = 420;
/** Half width of the white edge lines' outer and inner edge at the bottom of the view. */
const EDGE_OUTER = 414;
const EDGE_INNER = 396;
/** Half width of a centre dash at the bottom of the view. */
const DASH_HALF = 12;
/** Depths of the dash row boundaries (1 at the bottom of the view, growing towards the horizon); a dash lies between boundary 2k and 2k + 1. */
const DASH_DEPTHS = [1, 1.25, 1.6, 2, 2.5, 3.2, 4, 5, 6.5, 8.5, 11] as const;

/** Bottom-of-view offsets from the vanishing point of the field lines, left to right. */
const FIELD_LINES = [-3000, -1500, -950, -560, -260, 0, 260, 560, 950, 1500, 3000] as const;
/** Depths of the field rows (1 at the bottom of the view). */
const FIELD_ROWS = [1, 1.5, 2.2, 3.4, 5.5, 10, 22] as const;
/** Opacity of the nearest field row (the windscreen value) and its loss per row towards the horizon. */
const FIELD_OPACITY = 0.9;
const FIELD_OPACITY_STEP = 0.08;
/** Depths of the seams across the apron, and their half thickness in units. */
const APRON_SEAMS = [1.7, 3.2] as const;
/** Bottom-of-view offsets of the yellow taxi line (a wedge to the vanishing point). */
const TAXI_LINE = { from: -130, to: -80 } as const;

const pt = (x: number, y: number): string => `${x.toFixed(2)},${y.toFixed(2)}`;

function Gradient({
  id,
  y1,
  y2,
  colours,
}: {
  id: string;
  y1: number;
  y2: number;
  colours: GradientColours;
}) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1={y1} x2="0" y2={y2}>
      <stop offset="0" stop-color={colours.top} />
      {colours.mid === null ? null : <stop offset="0.6" stop-color={colours.mid} />}
      <stop offset="1" stop-color={colours.bottom} />
    </linearGradient>
  );
}

/**
 * A strip of the perspective ground: the quadrilateral between rows `near` and `far` (offsets below
 * the horizon) of the band from `a` to `b` (offsets from the vanishing point at the bottom of the
 * view, `reach` below the horizon).
 */
function strip(
  cx: number,
  cy: number,
  reach: number,
  a: number,
  b: number,
  near: number,
  far: number,
): string {
  const x = (bottom: number, row: number): number => cx + (bottom * row) / reach;
  return [
    pt(x(a, near), cy + near),
    pt(x(b, near), cy + near),
    pt(x(b, far), cy + far),
    pt(x(a, far), cy + far),
  ].join(' ');
}

function Runway({ cx, cy, reach }: { cx: number; cy: number; reach: number }) {
  const bottom = cy + reach;
  // The static dashed centre line: dashes are trapezoids that shrink with the depth.
  const dashes: JSX.Element[] = [];
  for (let k = 0; k + 1 < DASH_DEPTHS.length; k += 2) {
    const near = rowOffset(reach, DASH_DEPTHS[k] ?? 1);
    const far = rowOffset(reach, DASH_DEPTHS[k + 1] ?? 1);
    dashes.push(
      <polygon
        key={k}
        data-svt-dash
        points={strip(cx, cy, reach, -DASH_HALF, DASH_HALF, near, far)}
        fill={WHITE_PAINT}
      />,
    );
  }
  const edge = (side: -1 | 1): JSX.Element => (
    <polygon
      key={side}
      data-svt-edge
      points={strip(cx, cy, reach, side * EDGE_INNER, side * EDGE_OUTER, reach, 0)}
      fill={WHITE_PAINT}
    />
  );
  return (
    <g data-svt-art="runway">
      <polygon
        points={[pt(cx - RUNWAY_HALF, bottom), pt(cx + RUNWAY_HALF, bottom), pt(cx, cy)].join(' ')}
        fill="url(#pfd-svt-runway)"
      />
      {edge(-1)}
      {edge(1)}
      {dashes}
    </g>
  );
}

/** Row offset below the horizon of depth `d` (1 at the bottom of the view). */
const rowOffset = (reach: number, d: number): number => reach / d;

/**
 * The fields of the cruise view: patches between rows and lines that converge on the vanishing
 * point, in the field colours of the windscreen. A diagonal third of the patches stays the ground.
 */
function Fields({ cx, cy, reach }: { cx: number; cy: number; reach: number }) {
  const out: JSX.Element[] = [];
  for (let r = 0; r + 1 < FIELD_ROWS.length; r += 1) {
    const near = rowOffset(reach, FIELD_ROWS[r] ?? 1);
    const far = rowOffset(reach, FIELD_ROWS[r + 1] ?? 1);
    for (let j = 0; j + 1 < FIELD_LINES.length; j += 1) {
      if ((r * 2 + j) % 3 === 0) continue;
      out.push(
        <polygon
          key={`${String(r)}-${String(j)}`}
          points={strip(cx, cy, reach, FIELD_LINES[j] ?? 0, FIELD_LINES[j + 1] ?? 0, near, far)}
          fill={FIELD_COLOURS[(r * 7 + j * 3) % FIELD_COLOURS.length]}
          fill-opacity={FIELD_OPACITY - r * FIELD_OPACITY_STEP}
        />,
      );
    }
  }
  return <g data-svt-art="fields">{out}</g>;
}

/** The apron: two seams across it and the yellow taxi line as a wedge to the vanishing point. */
function Apron({ cx, cy, reach }: { cx: number; cy: number; reach: number }) {
  const edge = FIELD_LINES[0] ?? 0;
  const far = FIELD_LINES[FIELD_LINES.length - 1] ?? 0;
  return (
    <g data-svt-art="apron">
      {APRON_SEAMS.map((d) => {
        const y = rowOffset(reach, d);
        return (
          <polygon
            key={d}
            points={strip(cx, cy, reach, edge, far, y + 2, y)}
            fill="#6d7276"
            fill-opacity={0.5}
          />
        );
      })}
      <polygon
        data-svt-taxi
        points={strip(cx, cy, reach, TAXI_LINE.from, TAXI_LINE.to, reach, 4)}
        fill={TAXI_YELLOW}
      />
    </g>
  );
}

export function SyntheticVision({
  scene,
  cx,
  cy,
  reach,
}: {
  /** A scene id; one the art does not know draws the default scene. */
  scene: string;
  cx: number;
  cy: number;
  reach: number;
}) {
  const id: SceneId = isSceneId(scene) ? scene : DEFAULT_SCENE;
  const style = SVT_STYLES[id];
  return (
    <g data-svt data-svt-scene={id}>
      <defs>
        <Gradient
          id="pfd-svt-sky"
          y1={cy - SKY_SPAN}
          y2={cy}
          colours={SCENE_GRADIENTS[style.sky]}
        />
        <Gradient
          id="pfd-svt-ground"
          y1={cy}
          y2={cy + GROUND_SPAN}
          colours={SCENE_GRADIENTS[style.ground]}
        />
        <linearGradient
          id="pfd-svt-haze"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={cy - HAZE.above}
          x2="0"
          y2={cy - HAZE.above + HAZE.height}
        >
          <stop offset="0" stop-color={HAZE.colour} stop-opacity={0} />
          <stop offset={HAZE.peak} stop-color={HAZE.colour} stop-opacity={HAZE.opacity} />
          <stop offset="1" stop-color={HAZE.colour} stop-opacity={0} />
        </linearGradient>
        {style.art === 'runway' ? (
          <Gradient
            id="pfd-svt-runway"
            y1={cy}
            y2={cy + reach}
            colours={SCENE_GRADIENTS['w-runway']}
          />
        ) : null}
      </defs>
      <rect
        x={cx - reach}
        y={cy - reach}
        width={2 * reach}
        height={reach}
        fill="url(#pfd-svt-sky)"
      />
      <rect x={cx - reach} y={cy} width={2 * reach} height={reach} fill="url(#pfd-svt-ground)" />
      {style.art === 'runway' ? <Runway cx={cx} cy={cy} reach={reach} /> : null}
      {style.art === 'fields' ? <Fields cx={cx} cy={cy} reach={reach} /> : null}
      {style.art === 'apron' ? <Apron cx={cx} cy={cy} reach={reach} /> : null}
      <rect
        data-svt-haze
        x={cx - reach}
        y={cy - HAZE.above}
        width={2 * reach}
        height={HAZE.height}
        fill="url(#pfd-svt-haze)"
      />
    </g>
  );
}
