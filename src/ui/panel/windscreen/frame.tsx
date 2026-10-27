import { OPENING, OPENING_PATH, SCENE_CENTRE_X, mirrorX } from './geometry';

// The parts of the windscreen that do not change with the scene (Phase 5, W-04), after the owner's
// cockpit photo and in own words: a dark canopy frame left, right and above around a wide arched
// opening, a central strut from the overhead roll bar at the top centre down into the glare
// shield, the silver engine cowl low in the centre with a clearly darker edge and shade (the
// owner notes a silver cowl blends into cloud), and an almost transparent propeller disc while the
// engine turns and a crisp blade at about 11 o'clock only when it stands still (prop_stopped). Flat vector, the layer's own `w-`
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
 * roll bar. Drawn after the scene and the cues, so it covers their edges.
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
        {/* The overhead roll bar: the arched padded bar across the top, nothing on it. */}
        <path
          d={`M${SCENE_CENTRE_X - 380} ${OPENING.y} H${SCENE_CENTRE_X + 380} V${OPENING.y + 52} Q${SCENE_CENTRE_X} ${OPENING.y + 96} ${SCENE_CENTRE_X - 380} ${OPENING.y + 52} Z`}
          fill="#1b1d20"
          stroke="#3a3f45"
          stroke-width={3}
          stroke-linejoin="round"
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

/** Opacity of the spinning propeller disc: faint, so sky, clouds and the cowl show through it. */
export const DISC_OPACITY = 0.1;

/** The fade between the disc and the blade when the propeller stops or starts, in seconds. */
export const PROP_FADE_S = 0.4;

/** The propeller stands still when its cue level is above 0 (the engine below ENGINE_RPM_STOPPED). */
export function propStopped(level: number): boolean {
  return level > 0;
}

const FADE = `opacity ${PROP_FADE_S}s linear, fill-opacity ${PROP_FADE_S}s linear`;

/**
 * The turning propeller: an almost transparent grey-blue disc around the hub, behind the cowl and
 * the frame, with no blade in it. It is shown while the engine turns and fades out as the
 * propeller stops; the cue level (prop_stopped) only switches between the two states.
 */
export function Disc({ level = 0 }: { level?: number }) {
  return (
    <circle
      data-part="disc"
      cx={1125}
      cy={-70}
      r={340}
      fill="#6d7f90"
      fill-opacity={propStopped(level) ? 0 : DISC_OPACITY}
      style={{ transition: FADE }}
    />
  );
}

/**
 * The crisp blade of a stopped propeller at about 11 o'clock: opaque, with a lit leading edge. It
 * is in the tree at all times and fades in as the propeller stops, so the change does not pop.
 */
export function StoppedBlade({ level }: { level: number }) {
  const stopped = propStopped(level);
  return (
    <g
      data-part="blade_stopped"
      data-cue="prop_stopped"
      data-level={level}
      opacity={stopped ? 1 : 0}
      style={{ transition: FADE }}
    >
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
