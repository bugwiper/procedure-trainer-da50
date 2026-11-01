import type { JSX } from 'preact';
import { DEFAULT_SCENE } from '../../../aircraft/da50rg/scenes';
import type { SceneId } from '../../../aircraft/da50rg/scenes';
import { SCENE_GRADIENTS, isSceneId } from '../windscreen/scenes';
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
  /** The art on the ground: the take-off runway, or nothing yet. */
  readonly art: 'none' | 'runway';
}

/**
 * The look of each scene, typed by the scene ids of the aircraft data: a scene without a style
 * fails the typecheck. Synthetic vision is always clear (D-19): the cloud scene shows the same
 * terrain as cruise.
 */
export const SVT_STYLES: Readonly<Record<SceneId, SvtStyle>> = {
  parked: { sky: 'w-sky-parked', ground: 'w-apron', art: 'none' },
  takeoff_roll: { sky: 'w-sky-roll', ground: 'w-grass', art: 'runway' },
  cruise: { sky: 'w-sky-cruise', ground: 'w-ground-cruise', art: 'none' },
  cloud: { sky: 'w-sky-cruise', ground: 'w-ground-cruise', art: 'none' },
};

/** Height over which the sky colours run from the top colour to the horizon colour. */
const SKY_SPAN = 200;
/** Depth below the horizon over which the ground colours run. */
const GROUND_SPAN = 260;
/** The haze on the horizon: a thin light band that softens the line. */
const HAZE = { above: 5, height: 26, colour: '#dcebf6', opacity: 0.35 } as const;

const WHITE_PAINT = '#f1f1ea';

/** Half width of the runway at the bottom of the view (`reach` below the horizon). */
const RUNWAY_HALF = 420;
/** Half width of the white edge lines' outer and inner edge at the bottom of the view. */
const EDGE_OUTER = 414;
const EDGE_INNER = 396;

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
      <rect
        data-svt-haze
        x={cx - reach}
        y={cy - HAZE.above}
        width={2 * reach}
        height={HAZE.height}
        fill={HAZE.colour}
        fill-opacity={HAZE.opacity}
      />
    </g>
  );
}
