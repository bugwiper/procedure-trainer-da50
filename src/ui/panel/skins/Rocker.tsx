import type {
  GuardedToggleDef,
  RockerColour,
  RockerSize,
  ToggleDef,
  TogglePosition,
} from '../../../engine/registry';

const FONT = 'B612, system-ui, sans-serif';

/** The pressed ring: drawn only while a pointer is down, never a persistent state (Color 5). */
const PRESSED_RING = '#8fb8e6';

/** Face sizes of UI-SPEC 8.1 in viewBox units; proposals within +/- 10 percent (unconfirmed item 2). */
export const ROCKER_FACE: Record<
  RockerSize,
  {
    readonly w: number;
    readonly h: number;
    readonly ears?: { readonly w: number; readonly h: number };
  }
> = {
  S: { w: 22, h: 38 },
  M: { w: 28, h: 46 },
  L: { w: 32, h: 52, ears: { w: 8, h: 40 } },
  W: { w: 48, h: 46 },
  LIGHT: { w: 26, h: 54 },
};

/** Black bezel padding around the face and its corner radius. */
const BEZEL_PAD = 4;

/**
 * How far a fully raised half stands toward the viewer, in viewBox units (Table R1): the outer
 * end is displaced this far to the left (the viewer looks slightly from the right) and away from
 * the groove. The middle position lifts each half by half of it.
 */
export const ROCKER_LIFT = 3;

/** Corner radius of the outer face corners. */
const CORNER = 3;

/** Height of the end lip of a wall (the outer end of the raised half seen from the side). */
const LIP = 2;

interface Tones {
  readonly raised: string;
  readonly pressed: string;
  readonly groove: string;
  readonly highlight: string;
  readonly shadow: string;
  /** Side wall of a raised half; darker than the face. */
  readonly wall: string;
}

const TONES: Record<RockerColour, Tones> = {
  white: {
    raised: '#f1f0e8',
    pressed: '#c7c6bd',
    groove: '#a3a299',
    highlight: '#ffffff',
    shadow: '#8a897f',
    wall: '#8a897f',
  },
  red: {
    raised: '#e5323c',
    pressed: '#8d121a',
    groove: '#6a0d13',
    highlight: '#f0535b',
    shadow: '#5a0a0f',
    wall: '#5a0a0f',
  },
};

export interface RockerBodyProps {
  readonly def: Pick<ToggleDef | GuardedToggleDef, 'label' | 'hit' | 'size' | 'colour'>;
  /** high presses the upper half, low the lower half, mid leaves both level (Table T1). */
  readonly position: TogglePosition;
  /** True only while a pointer is down on the control. */
  readonly pressed: boolean;
}

/**
 * Half extents of the visible art (bezel, ears and the lift of a raised half) around the centre.
 * The lift is measured from the face, so a raised half reaches face + ROCKER_LIFT; the 4-unit
 * bezel pad absorbs it, which keeps every rocker inside the footprint it had before.
 */
export function rockerExtent(size: RockerSize): { readonly halfW: number; readonly halfH: number } {
  const face = ROCKER_FACE[size];
  const bezelHalfW = face.w / 2 + BEZEL_PAD;
  const earsHalfW = face.ears === undefined ? 0 : bezelHalfW + face.ears.w;
  const liftHalfW = face.w / 2 + ROCKER_LIFT;
  const liftHalfH = face.h / 2 + ROCKER_LIFT;
  return {
    halfW: Math.max(bezelHalfW, earsHalfW, liftHalfW),
    halfH: Math.max(face.h / 2 + BEZEL_PAD, liftHalfH),
  };
}

/** Width estimate of B612 text; also used as textLength so tests match renders. */
function textWidth(text: string, size: number): number {
  return text.length * size * 0.62;
}

const f = (n: number): string => n.toFixed(2).replace(/\.?0+$/, '');

/**
 * One flat half of the face as a path: the outer end corners are rounded (radius r), the corners
 * at the groove are square.
 */
function halfPath(x0: number, x1: number, y0: number, y1: number, r: number, top: boolean): string {
  if (top) {
    return `M${f(x0)} ${f(y1)}V${f(y0 + r)}Q${f(x0)} ${f(y0)} ${f(x0 + r)} ${f(y0)}H${f(x1 - r)}Q${f(x1)} ${f(y0)} ${f(x1)} ${f(y0 + r)}V${f(y1)}Z`;
  }
  return `M${f(x0)} ${f(y0)}V${f(y1 - r)}Q${f(x0)} ${f(y1)} ${f(x0 + r)} ${f(y1)}H${f(x1 - r)}Q${f(x1)} ${f(y1)} ${f(x1)} ${f(y1 - r)}V${f(y0)}Z`;
}

/**
 * One raised half, tilted up from the groove toward the viewer. The groove edge stays in place,
 * the outer end is displaced `lift` to the left and `lift` away from the groove. `sign` is -1 for
 * the upper half and +1 for the lower half. Returns the face path and the side wall polygon (the
 * right edge plus a short lip at the outer end).
 */
function raisedHalf(
  hw: number,
  hh: number,
  lift: number,
  sign: -1 | 1,
): { readonly face: string; readonly wall: string } {
  const outer = sign * (hh + lift);
  const rim = sign * (hh + lift - LIP);
  // The right edge runs from the groove corner (hw, 0) to the displaced outer corner.
  const rightAtRim = hw - lift + (lift * LIP) / (hh + lift);
  const left = -hw - lift;
  const face =
    `M${f(-hw)} 0H${f(hw)}L${f(hw - lift)} ${f(outer)}H${f(left + CORNER)}` +
    `Q${f(left)} ${f(outer)} ${f(left)} ${f(outer - sign * CORNER)}Z`;
  const wall = [
    [hw, 0],
    [hw, sign * hh],
    [hw - lift, outer],
    [left + CORNER, outer],
    [left + CORNER, rim],
    [rightAtRim, rim],
  ]
    .map(([x, y]) => `${f(x as number)},${f(y as number)}`)
    .join(' ');
  return { face, wall };
}

/**
 * Pure rocker art (UI-SPEC 8.1, Table R1): bezel, optional ears, two face halves in different
 * tones, groove and the name placard, drawn slightly from the right. The pressed half lies flat;
 * the raised half stands up with a darker side wall. Position is shown by shape and tone only,
 * the body draws no state text. No hooks, no state, no per-widget defs, so node tests can expand
 * and count it.
 */
export function RockerBody({ def, position, pressed }: RockerBodyProps) {
  const size = def.size ?? 'M';
  const tones = TONES[def.colour ?? 'white'];
  const face = ROCKER_FACE[size];
  const { halfH } = rockerExtent(size);
  const hw = face.w / 2;
  const hh = face.h / 2;
  const bezelW = face.w + 2 * BEZEL_PAD;
  const bezelH = face.h + 2 * BEZEL_PAD;
  const light = size === 'LIGHT';

  const upperPressed = position === 'high';
  const lowerPressed = position === 'low';
  const level = position === 'mid';
  const halfLift = ROCKER_LIFT / 2;

  const upperFlat = halfPath(-hw, hw, -hh + 1, 0, CORNER, true);
  const lowerFlat = halfPath(-hw, hw, 0, hh - 1, CORNER, false);

  const upperRaised = level
    ? raisedHalf(hw, hh, halfLift, -1)
    : lowerPressed
      ? raisedHalf(hw, hh, ROCKER_LIFT, -1)
      : null;
  const lowerRaised = level
    ? raisedHalf(hw, hh, halfLift, 1)
    : upperPressed
      ? raisedHalf(hw, hh, ROCKER_LIFT, 1)
      : null;

  const upperFace = upperRaised?.face ?? upperFlat;
  const lowerFace = lowerRaised?.face ?? lowerFlat;
  const upperFill = upperPressed ? tones.pressed : tones.raised;
  const lowerFill = lowerPressed ? tones.pressed : tones.raised;

  // Highlight: 1 unit on the top edge of the raised half (the displaced outer end of the upper
  // half, the groove edge of the lower half). A level rocker highlights its upper half only.
  const upperLift = level ? halfLift : ROCKER_LIFT;
  const highlight = upperPressed
    ? { x: -hw + 1, y: 0, w: face.w - 2 }
    : { x: -hw - upperLift + CORNER, y: -hh - upperLift, w: face.w - CORNER - 1 };
  // A 2-unit shadow band across the groove side of the pressed half.
  const band = upperPressed ? { y: -2 } : lowerPressed ? { y: 0 } : null;

  // The name sits above the bezel; on the LIGHT rockers it sits below, clear of the neighbours.
  const labelY = light ? halfH + 1.5 + 0.72 * 8 : -(halfH + 2.5);
  const labelWidth = Math.min(textWidth(def.label, 8), def.hit.w - 2);

  return (
    <g pointer-events="none">
      <text
        x={0}
        y={labelY}
        text-anchor="middle"
        font-family={FONT}
        font-size={8}
        fill="#aab3bd"
        textLength={labelWidth}
        lengthAdjust="spacingAndGlyphs"
      >
        {def.label}
      </text>
      {face.ears === undefined ? null : (
        <>
          <rect
            x={-(bezelW / 2 + face.ears.w)}
            y={-face.ears.h / 2}
            width={face.ears.w}
            height={face.ears.h}
            rx={3}
            fill="#0c0d0f"
            stroke="#2d3138"
          />
          <rect
            x={bezelW / 2}
            y={-face.ears.h / 2}
            width={face.ears.w}
            height={face.ears.h}
            rx={3}
            fill="#0c0d0f"
            stroke="#2d3138"
          />
        </>
      )}
      <rect
        x={-bezelW / 2}
        y={-bezelH / 2}
        width={bezelW}
        height={bezelH}
        rx={5}
        fill="#0c0d0f"
        stroke={pressed ? PRESSED_RING : '#2d3138'}
        stroke-width={pressed ? 2 : 1}
      />
      <path d={upperFace} fill={upperFill} />
      <path d={lowerFace} fill={lowerFill} />
      <rect x={highlight.x} y={highlight.y} width={highlight.w} height={1} fill={tones.highlight} />
      {band === null ? null : (
        <rect
          x={-hw}
          y={band.y}
          width={face.w}
          height={2}
          fill={tones.shadow}
          fill-opacity={0.45}
        />
      )}
      <line x1={-hw} y1={0} x2={hw} y2={0} stroke={tones.groove} stroke-width={1} />
      {upperRaised === null ? null : (
        <polygon data-rocker-wall="upper" points={upperRaised.wall} fill={tones.wall} />
      )}
      {lowerRaised === null ? null : (
        <polygon data-rocker-wall="lower" points={lowerRaised.wall} fill={tones.wall} />
      )}
    </g>
  );
}
