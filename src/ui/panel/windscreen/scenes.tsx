import type { JSX } from 'preact';
import { SCENE_IDS } from '../../../aircraft/da50rg/scenes';
import type { SceneId } from '../../../aircraft/da50rg/scenes';
import { OPENING, SCENE_CENTRE_X } from './geometry';
import {
  ROLL_COLOURS,
  ROLL_KINDS,
  ROLL_LAST,
  rollFadeRange,
  rollPolygons,
  rollRate,
  rollScales,
} from './roll-series';
import type { Point, RollPolygon } from './roll-series';

// The four views out of the windscreen (Phase 5, W-04, W-07): flat vector art in the opening, no
// text (G-0), the layer's own `w-` paints (SceneDefs). Every scene shares one horizon height and
// one vanishing point (the strut at SCENE_CENTRE_X), so the cowl and the cues sit the same way in
// each. The record is typed by the scene ids of the aircraft data: a scene without art fails the
// typecheck. Perspective arithmetic uses + - * / only.

/** The horizon in panel space: above the cowl, below the middle of the opening. */
export const HORIZON_Y = -140;
/** The lowest drawn row: the glare shield covers the opening below it. */
const BOTTOM_Y = OPENING.y + OPENING.h;
/** Depth of the ground in the picture: horizon to bottom edge. */
const DEPTH = BOTTOM_Y - HORIZON_Y;
const LEFT = OPENING.x;
const RIGHT = OPENING.x + OPENING.w;
const TOP = OPENING.y;

/** Gradients of the scenes, part of the layer's own defs. */
export function SceneDefs() {
  const vertical = (id: string, top: string, mid: string | null, bottom: string) => (
    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color={top} />
      {mid === null ? null : <stop offset="0.6" stop-color={mid} />}
      <stop offset="1" stop-color={bottom} />
    </linearGradient>
  );
  return (
    <>
      {vertical('w-sky-cruise', '#2c68ad', '#6aa2d4', '#c4def0')}
      {vertical('w-ground-cruise', '#9bb08e', null, '#5a7843')}
      {vertical('w-sky-parked', '#4a86c4', '#8fbbe0', '#d4e6f3')}
      {vertical('w-apron', '#a7abae', null, '#6d7276')}
      {vertical('w-sky-roll', '#3a76b8', '#7eb0dc', '#cfe3f2')}
      {vertical('w-grass', '#86a56a', null, '#4f7a3a')}
      {vertical('w-runway', '#6c7075', null, '#3f4347')}
      {vertical('w-cloud', '#b4bbc2', '#d3d8dc', '#e3e6e8')}
      <RollFade />
    </>
  );
}

/** Colours of the runway gradient (w-runway) at the horizon and at the bottom edge. */
const RUNWAY_TOP = [0x6c, 0x70, 0x75] as const;
const RUNWAY_BOTTOM = [0x3f, 0x43, 0x47] as const;

/** The runway surface colour at row y (relative to the horizon), as the w-runway gradient paints it. */
function runwayColourAt(y: number): string {
  const f = y / DEPTH;
  const channel = (i: 0 | 1 | 2) =>
    Math.round(RUNWAY_TOP[i] + (RUNWAY_BOTTOM[i] - RUNWAY_TOP[i]) * f)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}

/**
 * The fade of the take-off marks: the runway colour, opaque at the far end of the row, clear from
 * the middle of the row on, in panel space. It depends on the row only, so a mark that moves nearer
 * is shown exactly as the mark in front of it was (no mask, the layer keeps to flat paint).
 */
function RollFade() {
  const { zero, full } = rollFadeRange(DEPTH);
  return (
    <linearGradient
      id="w-roll-fade"
      gradientUnits="userSpaceOnUse"
      x1="0"
      y1={HORIZON_Y + zero}
      x2="0"
      y2={HORIZON_Y + full}
    >
      <stop offset="0" stop-color={runwayColourAt(zero)} />
      <stop offset="1" stop-color={runwayColourAt(full)} stop-opacity={0} />
    </linearGradient>
  );
}

/** x at row y of a line through the vanishing point that sits `bottom` units from it at the bottom edge. */
function xAt(bottom: number, y: number): number {
  return SCENE_CENTRE_X + (bottom * (y - HORIZON_Y)) / DEPTH;
}

/** y of depth d (1 at the bottom edge, growing towards the horizon). */
function yAtDepth(d: number): number {
  return HORIZON_Y + DEPTH / d;
}

const poly = (points: readonly (readonly [number, number])[]): string =>
  points.map(([x, y]) => `${x},${y}`).join(' ');

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g data-cloud transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={18} rx={150} ry={26} fill="#c9d8e8" fill-opacity={0.85} />
      <ellipse cx={-70} cy={0} rx={70} ry={34} fill="#ffffff" fill-opacity={0.92} />
      <ellipse cx={0} cy={-14} rx={90} ry={44} fill="#ffffff" fill-opacity={0.95} />
      <ellipse cx={80} cy={2} rx={64} ry={32} fill="#f4f8fc" fill-opacity={0.92} />
    </g>
  );
}

const FIELD_COLOURS = ['#6f8f4a', '#8aa65a', '#a89b5a', '#7a9a58', '#5f7f3f', '#b0a463'] as const;
/** Bottom-edge offsets from the vanishing point of the field lines, left to right. */
const FIELD_LINES = [-1700, -1180, -760, -430, -170, 80, 330, 640, 1000, 1480, 2100] as const;
/** Depths of the field rows. */
const FIELD_ROWS = [1, 1.5, 2.2, 3.4, 5.5, 10] as const;

function FieldPatches() {
  const out: JSX.Element[] = [];
  for (let r = 0; r + 1 < FIELD_ROWS.length; r++) {
    const near = yAtDepth(FIELD_ROWS[r] ?? 1);
    const far = yAtDepth(FIELD_ROWS[r + 1] ?? 1);
    for (let j = 0; j + 1 < FIELD_LINES.length; j++) {
      // Every third patch stays as the ground, so the fields do not read as a chessboard.
      if ((r * 5 + j * 3) % 3 === 0) continue;
      const a = FIELD_LINES[j] ?? 0;
      const b = FIELD_LINES[j + 1] ?? 0;
      out.push(
        <polygon
          key={`${String(r)}-${String(j)}`}
          points={poly([
            [xAt(a, near), near],
            [xAt(b, near), near],
            [xAt(b, far), far],
            [xAt(a, far), far],
          ])}
          fill={FIELD_COLOURS[(r * 7 + j * 3) % FIELD_COLOURS.length]}
          fill-opacity={0.9}
        />,
      );
    }
  }
  return <>{out}</>;
}

function CruiseScene() {
  return (
    <g data-scene="cruise">
      <rect x={LEFT} y={TOP} width={OPENING.w} height={HORIZON_Y - TOP} fill="url(#w-sky-cruise)" />
      <Cloud x={300} y={-300} s={1.2} />
      <Cloud x={720} y={-215} s={0.8} />
      <Cloud x={1480} y={-310} s={1} />
      <Cloud x={1930} y={-230} s={1.15} />
      <Cloud x={1050} y={-365} s={0.7} />
      <path
        d={`M${LEFT} ${HORIZON_Y} L${LEFT} -190 L140 -205 L260 -178 L420 -216 L560 -176 L720 -160 L860 ${HORIZON_Y} Z`}
        fill="#8aa1ba"
        fill-opacity={0.85}
      />
      <path
        d={`M1420 ${HORIZON_Y} L1560 -176 L1720 -208 L1860 -172 L2000 -212 L${RIGHT} -190 L${RIGHT} ${HORIZON_Y} Z`}
        fill="#8aa1ba"
        fill-opacity={0.85}
      />
      <rect
        x={LEFT}
        y={HORIZON_Y}
        width={OPENING.w}
        height={BOTTOM_Y - HORIZON_Y}
        fill="url(#w-ground-cruise)"
      />
      <FieldPatches />
      <polygon
        points={poly([
          [xAt(-90, yAtDepth(1)), yAtDepth(1)],
          [xAt(-40, yAtDepth(1)), yAtDepth(1)],
          [SCENE_CENTRE_X + 6, HORIZON_Y],
          [SCENE_CENTRE_X, HORIZON_Y],
        ])}
        fill="#b9b49a"
        fill-opacity={0.8}
      />
      <rect
        x={LEFT}
        y={HORIZON_Y - 6}
        width={OPENING.w}
        height={36}
        fill="#dcebf6"
        fill-opacity={0.45}
      />
    </g>
  );
}

function ParkedScene() {
  const roofY = -292;
  const wallY = -226;
  const baseY = -118;
  return (
    <g data-scene="parked">
      <rect x={LEFT} y={TOP} width={OPENING.w} height={HORIZON_Y - TOP} fill="url(#w-sky-parked)" />
      <Cloud x={1650} y={-320} s={0.9} />
      <Cloud x={420} y={-340} s={0.7} />
      {/* A far tree line on the horizon. */}
      <path
        d={`M${LEFT} ${HORIZON_Y} L${LEFT} -165 Q200 -190 380 -160 T700 -165 T1000 -158 T1400 -168 T1800 -160 T${RIGHT} -166 L${RIGHT} ${HORIZON_Y} Z`}
        fill="#4d6a46"
      />
      {/* The apron. */}
      <rect
        x={LEFT}
        y={HORIZON_Y}
        width={OPENING.w}
        height={BOTTOM_Y - HORIZON_Y}
        fill="url(#w-apron)"
      />
      {/* The hangar: roof, wall, big door with its seams and two windows. */}
      <g data-part="hangar">
        <polygon
          points={poly([
            [380, wallY],
            [470, roofY],
            [1020, roofY],
            [1110, wallY],
          ])}
          fill="#7b8590"
          stroke="#4a525b"
          stroke-width={4}
          stroke-linejoin="round"
        />
        <rect
          x={400}
          y={wallY}
          width={690}
          height={baseY - wallY}
          fill="#c9ced3"
          stroke="#4a525b"
          stroke-width={4}
        />
        <rect
          x={500}
          y={-206}
          width={490}
          height={88}
          fill="#4b535c"
          stroke="#2f353b"
          stroke-width={3}
        />
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={598 + i * 98}
            y1={-206}
            x2={598 + i * 98}
            y2={-118}
            stroke="#2f353b"
            stroke-width={3}
          />
        ))}
        <rect
          x={420}
          y={-216}
          width={56}
          height={30}
          fill="#7fa6c4"
          stroke="#4a525b"
          stroke-width={3}
        />
        <rect
          x={1014}
          y={-216}
          width={56}
          height={30}
          fill="#7fa6c4"
          stroke="#4a525b"
          stroke-width={3}
        />
      </g>
      {/* A small shed at the right. */}
      <g data-part="shed">
        <rect
          x={1500}
          y={-196}
          width={230}
          height={70}
          fill="#b5bcc3"
          stroke="#4a525b"
          stroke-width={3}
        />
        <polygon
          points={poly([
            [1488, -196],
            [1740, -196],
            [1716, -224],
            [1512, -224],
          ])}
          fill="#8a2f2a"
          stroke="#4a525b"
          stroke-width={3}
        />
        <rect x={1560} y={-176} width={60} height={50} fill="#4b535c" />
      </g>
      {/* Apron markings: the yellow taxi line bending towards the hangar and two tie-down plates. */}
      <polygon
        points={poly([
          [xAt(-150, BOTTOM_Y), BOTTOM_Y],
          [xAt(-110, BOTTOM_Y), BOTTOM_Y],
          [820, -122],
          [800, -122],
        ])}
        fill="#e6c229"
      />
      <ellipse cx={1500} cy={20} rx={44} ry={9} fill="#5d6368" />
      <ellipse cx={1780} cy={70} rx={64} ry={13} fill="#5d6368" />
      <rect
        x={LEFT}
        y={HORIZON_Y - 4}
        width={OPENING.w}
        height={22}
        fill="#dcebf6"
        fill-opacity={0.3}
      />
    </g>
  );
}

/** Points of a polygon as an SVG attribute, rounded to two places. */
const pts = (p: readonly Point[]): string =>
  p.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

/** Half width of the fade cover at the bottom edge: inside the edge lines (610 to 634). */
const ROLL_FADE_HALF = 604;

/** What a scene gets: the cue levels (only the roll scene reads one). */
export interface SceneProps {
  readonly cues: Readonly<Record<string, number>>;
}

/**
 * Sets the playback rate of the running CSS animation of the marks (Phase 5.1, P-04). Called as a
 * ref callback, so it needs no hook and the pure body stays testable. updatePlaybackRate keeps the
 * visual position, so a change of speed never makes the marks jump; with reduced motion there is
 * no animation and nothing happens.
 */
export function applyRollRate(el: SVGGElement | null, rate: number): void {
  if (el === null || typeof el.getAnimations !== 'function') return;
  const animations = el.getAnimations();
  if (animations.length === 0) {
    // The ref can run before the browser has started the CSS animation: apply the rate when it
    // starts. With reduced motion there is no animation and the event never comes.
    el.addEventListener('animationstart', () => applyRollRate(el, rate), { once: true });
    return;
  }
  for (const animation of animations) {
    if (animation.playbackRate !== rate) animation.updatePlaybackRate(rate);
  }
}

/**
 * The scrolling marks of the take-off roll (Phase 5, A-05). The marks form a self-similar series
 * (roll-series.ts): mark n is the template at depth z_n, z_n growing by one fixed factor per
 * mark. The CSS animation (stage.css, w-roll) scales the whole row about the vanishing point from
 * 1 to that factor once per period, which puts every mark exactly onto the place, size and shape
 * of the next mark nearer. The last frame of the period is therefore the first frame again. The
 * nearest slot lies below the picture; the far end fades in through a cover of the runway colour
 * that depends on the row only (RollFade), so the new mark enters as a speck at the horizon. Each mark brings the
 * centre dash, a warm dash just inside each white edge line (a colour that contrasts with the grey
 * surface and the white lines), a transverse seam (a light joint and a dark shadow line, the
 * expansion joint of the concrete) and two dark tyre tracks. Every offset shrinks with the depth
 * like the runway itself, so nothing runs through the grass. The playback rate follows
 * the roll_speed cue, which reads the ground speed (rollRate). No timer, no state.
 */
function RollMarks({ level }: { level: number }) {
  const marks: JSX.Element[] = [];
  for (let n = 0; n <= ROLL_LAST; n++) {
    for (const kind of ROLL_KINDS) {
      const polys = rollPolygons(DEPTH, n, kind);
      const { fill, opacity } = ROLL_COLOURS[kind];
      const common = { fill, 'fill-opacity': opacity < 1 ? opacity : undefined };
      const key = `${String(n)}-${kind}`;
      marks.push(
        polys.length === 1 ? (
          <polygon key={key} points={pts(polys[0] as RollPolygon)} {...common} />
        ) : (
          <path
            key={key}
            d={polys.map((p) => `M${pts(p).replaceAll(' ', 'L')}Z`).join('')}
            {...common}
          />
        ),
      );
    }
  }
  const scales = rollScales();
  const vars = scales
    .slice(1)
    .map((s, i) => `--roll-s${String(i + 1)}:${s.toFixed(5)}`)
    .join(';');
  const { full } = rollFadeRange(DEPTH);
  const rate = rollRate(level);
  return (
    <g transform={`translate(${SCENE_CENTRE_X} ${HORIZON_Y})`}>
      <g
        class="w-roll-mark"
        style={vars}
        data-cue="roll_speed"
        data-level={level}
        ref={(el: SVGGElement | null) => applyRollRate(el, rate)}
      >
        {marks}
      </g>
      <polygon
        data-part="roll-fade"
        points={pts([
          [0, 0],
          [(ROLL_FADE_HALF * full) / DEPTH, full],
          [(-ROLL_FADE_HALF * full) / DEPTH, full],
        ])}
        fill="url(#w-roll-fade)"
      />
    </g>
  );
}

function TakeoffRollScene({ cues }: SceneProps) {
  const bottomHalf = 640;
  const edge = (side: -1 | 1) => (
    <polygon
      key={side}
      points={poly([
        [xAt(side * (bottomHalf - 30), BOTTOM_Y), BOTTOM_Y],
        [xAt(side * (bottomHalf - 6), BOTTOM_Y), BOTTOM_Y],
        [SCENE_CENTRE_X + side * 1.2, HORIZON_Y],
        [SCENE_CENTRE_X + side * 0.4, HORIZON_Y],
      ])}
      fill="#f1f1ea"
    />
  );
  return (
    <g data-scene="takeoff_roll">
      <rect x={LEFT} y={TOP} width={OPENING.w} height={HORIZON_Y - TOP} fill="url(#w-sky-roll)" />
      <Cloud x={380} y={-310} s={0.9} />
      <Cloud x={1760} y={-290} s={1.1} />
      <path
        d={`M${LEFT} ${HORIZON_Y} L${LEFT} -170 Q300 -186 560 -164 T1000 -160 T1500 -166 T1900 -162 T${RIGHT} -168 L${RIGHT} ${HORIZON_Y} Z`}
        fill="#5a7a4d"
      />
      <rect
        x={LEFT}
        y={HORIZON_Y}
        width={OPENING.w}
        height={BOTTOM_Y - HORIZON_Y}
        fill="url(#w-grass)"
      />
      {/* Mown stripes in the grass, converging on the vanishing point. */}
      {[-1900, -1500, -1150, 1150, 1500, 1900].map((b, i) => (
        <polygon
          key={b}
          points={poly([
            [xAt(b, BOTTOM_Y), BOTTOM_Y],
            [xAt(b + (b < 0 ? 170 : 220), BOTTOM_Y), BOTTOM_Y],
            [SCENE_CENTRE_X + (i % 2 === 0 ? 1 : -1) * 2, HORIZON_Y],
          ])}
          fill="#3f6b31"
          fill-opacity={0.35}
        />
      ))}
      {/* The runway: surface, edge lines and the scrolling marks. */}
      <polygon
        points={poly([
          [xAt(-bottomHalf, BOTTOM_Y), BOTTOM_Y],
          [xAt(bottomHalf, BOTTOM_Y), BOTTOM_Y],
          [SCENE_CENTRE_X + 1.5, HORIZON_Y],
          [SCENE_CENTRE_X - 1.5, HORIZON_Y],
        ])}
        fill="url(#w-runway)"
      />
      {edge(-1)}
      {edge(1)}
      <RollMarks level={cues['roll_speed'] ?? 0} />
      <rect
        x={LEFT}
        y={HORIZON_Y - 4}
        width={OPENING.w}
        height={22}
        fill="#dcebf6"
        fill-opacity={0.35}
      />
    </g>
  );
}

/** Flight in cloud (IMC): one grey-white sheet with soft lighter and darker bands, no horizon. */
const CLOUD_BANDS = [
  [0.02, 0.05, '#8e979f', 0.1],
  [0.1, 0.1, '#ffffff', 0.18],
  [0.24, 0.07, '#8e979f', 0.14],
  [0.38, 0.14, '#ffffff', 0.16],
  [0.55, 0.08, '#8e979f', 0.12],
  [0.66, 0.16, '#ffffff', 0.2],
  [0.78, 0.06, '#ffffff', 0.14],
  [0.86, 0.1, '#8e979f', 0.12],
] as const;

function CloudScene() {
  return (
    <g data-scene="cloud">
      <rect x={LEFT} y={TOP} width={OPENING.w} height={OPENING.h} fill="url(#w-cloud)" />
      {CLOUD_BANDS.map(([at, share, fill, opacity]) => (
        <rect
          key={at}
          x={LEFT}
          y={TOP + OPENING.h * at}
          width={OPENING.w}
          height={OPENING.h * share}
          rx={40}
          fill={fill}
          fill-opacity={opacity}
        />
      ))}
    </g>
  );
}

/** The art of each scene, typed by the scene ids of the aircraft data. */
export const SCENES: Readonly<Record<SceneId, (props: SceneProps) => JSX.Element>> = {
  parked: ParkedScene,
  takeoff_roll: TakeoffRollScene,
  cruise: CruiseScene,
  cloud: CloudScene,
};

/** True when `id` is a scene of the aircraft data. */
export function isSceneId(id: string): id is SceneId {
  return (SCENE_IDS as readonly string[]).includes(id);
}
