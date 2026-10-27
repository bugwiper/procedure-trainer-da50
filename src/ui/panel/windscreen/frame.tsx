import { cueVisible } from '../../../engine/cues';
import { OPENING, OPENING_PATH, SCENE_CENTRE_X, mirrorX } from './geometry';

// The parts of the windscreen that do not change with the scene (Phase 5, W-04), after the owner's
// cockpit photo and in own words: a dark canopy frame left, right and above around a wide arched
// opening, a central strut from the overhead console strip at the top centre down into the glare
// shield, the silver engine cowl low in the centre with a clearly darker edge and shade (the
// owner notes a silver cowl blends into cloud), and a translucent propeller blade at about 11
// o'clock that turns crisp when the engine stops (prop_stopped). Flat vector, the layer's own `w-`
// paints, no text (G-0).

/** Paints of these parts, part of the layer's own defs. */
export function FrameDefs() {
  return (
    <>
      <linearGradient id="w-frame" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#17191c" />
        <stop offset="1" stop-color="#0d0e10" />
      </linearGradient>
      <linearGradient id="w-strut" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#202327" />
        <stop offset="0.5" stop-color="#2b2f34" />
        <stop offset="1" stop-color="#1a1c1f" />
      </linearGradient>
      <linearGradient id="w-cowl" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#eef1f4" />
        <stop offset="0.55" stop-color="#b3bac2" />
        <stop offset="1" stop-color="#7d858e" />
      </linearGradient>
      <clipPath id="w-opening">
        <path d={OPENING_PATH} />
      </clipPath>
    </>
  );
}

const OUTER_PATH = `M${OPENING.x} ${OPENING.y} H${OPENING.x + OPENING.w} V${OPENING.y + OPENING.h} H${OPENING.x} Z`;

/**
 * The canopy frame: the extent with the arched opening cut out, the strut and the overhead
 * console strip. Drawn after the scene and the cues, so it covers their edges.
 */
export function CanopyFrame() {
  return (
    <g data-part="frame">
      <path
        data-frame-body
        d={`${OUTER_PATH} ${OPENING_PATH}`}
        fill-rule="evenodd"
        fill="url(#w-frame)"
      />
      {/* A lighter trim line along the inner edge of the opening. */}
      <path
        d={OPENING_PATH}
        fill="none"
        stroke="#3a3f45"
        stroke-width={5}
        stroke-linejoin="round"
      />
      <g data-part="strut">
        <polygon
          points={`${SCENE_CENTRE_X - 26},-420 ${SCENE_CENTRE_X + 26},-420 ${SCENE_CENTRE_X + 44},110 ${SCENE_CENTRE_X - 44},110`}
          fill="url(#w-strut)"
          stroke="#0d0e10"
          stroke-width={3}
        />
        <line
          x1={SCENE_CENTRE_X - 14}
          y1={-410}
          x2={SCENE_CENTRE_X - 22}
          y2={100}
          stroke="#3d4349"
          stroke-width={3}
        />
      </g>
      <g data-part="overhead">
        <rect
          x={SCENE_CENTRE_X - 380}
          y={OPENING.y}
          width={760}
          height={74}
          rx={14}
          fill="#1b1d20"
          stroke="#3a3f45"
          stroke-width={3}
        />
        {[-300, -210, -120, 120, 210, 300].map((dx) => (
          <rect
            key={dx}
            x={SCENE_CENTRE_X + dx - 26}
            y={OPENING.y + 24}
            width={52}
            height={26}
            rx={5}
            fill="#2a2e33"
            stroke="#464c53"
            stroke-width={2}
          />
        ))}
        <rect
          x={SCENE_CENTRE_X - 70}
          y={OPENING.y + 20}
          width={140}
          height={34}
          rx={6}
          fill="#111315"
          stroke="#464c53"
          stroke-width={2}
        />
      </g>
      {/* Screw heads along the pillars: small round marks, no text. */}
      {[-60, 20, 100].map((y) => (
        <g key={y}>
          <circle cx={70} cy={y} r={7} fill="#25282c" stroke="#3a3f45" stroke-width={2} />
          <circle cx={mirrorX(70)} cy={y} r={7} fill="#25282c" stroke="#3a3f45" stroke-width={2} />
        </g>
      ))}
    </g>
  );
}

/** Opacity of the blur wedge of the turning propeller. */
export const BLUR_OPACITY = 0.4;

/**
 * The propeller at about 11 o'clock, from the hub behind the cowl up to the left: a translucent
 * blur wedge while the engine turns. It fades with `stopped`, the prop_stopped level (0 to 1), and
 * StoppedBlade takes over as the engine stops.
 */
export function Blade({ stopped = 0 }: { stopped?: number }) {
  return (
    <path
      data-part="blade"
      d="M1129 -88 L943 -349 L916 -332 L1071 -52 Z"
      fill="#14171a"
      fill-opacity={BLUR_OPACITY * (1 - stopped)}
      stroke="#0b0c0e"
      stroke-opacity={0.5 * (1 - stopped)}
      stroke-width={3}
      stroke-linejoin="round"
    />
  );
}

/** The crisp blade of a stopped propeller: opaque, narrower than the wedge, with a lit leading edge. */
export function StoppedBlade({ level }: { level: number }) {
  if (!cueVisible(level)) return null;
  return (
    <g data-part="blade_stopped" data-cue="prop_stopped" data-level={level} opacity={level}>
      <path
        d="M1120 -82 L938 -344 Q926 -341 926 -331 L1080 -58 Z"
        fill="#101215"
        stroke="#050607"
        stroke-width={3}
        stroke-linejoin="round"
      />
      <path
        d="M1112 -84 L934 -338"
        fill="none"
        stroke="#8b949d"
        stroke-width={3}
        stroke-linecap="round"
      />
    </g>
  );
}

/** The silver cowl low in the centre, with a clearly darker edge and shade so it never blends into cloud. */
export function Cowl() {
  return (
    <g data-part="cowl">
      <path
        data-cowl-body
        d="M760 112 C790 20 900 -58 1130 -66 C1360 -58 1470 20 1500 112 Z"
        fill="url(#w-cowl)"
        stroke="#3b434c"
        stroke-width={6}
        stroke-linejoin="round"
      />
      <path
        d="M830 112 C860 40 960 -20 1130 -26 C1300 -20 1400 40 1430 112 Z"
        fill="#59616a"
        fill-opacity={0.35}
      />
    </g>
  );
}
