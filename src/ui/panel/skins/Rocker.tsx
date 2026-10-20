import type {
  GuardedToggleDef,
  RockerColour,
  RockerSize,
  ToggleDef,
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

interface Tones {
  readonly raised: string;
  readonly pressed: string;
  readonly groove: string;
  readonly highlight: string;
  readonly shadow: string;
  /** Colour of the end placards printed on the face. */
  readonly ink: string;
}

const TONES: Record<RockerColour, Tones> = {
  white: {
    raised: '#f1f0e8',
    pressed: '#c7c6bd',
    groove: '#a3a299',
    highlight: '#ffffff',
    shadow: '#8a897f',
    ink: '#2a2d31',
  },
  red: {
    raised: '#e5323c',
    pressed: '#8d121a',
    groove: '#6a0d13',
    highlight: '#f0535b',
    shadow: '#5a0a0f',
    ink: '#ffffff',
  },
};

export interface RockerBodyProps {
  readonly def: Pick<ToggleDef | GuardedToggleDef, 'label' | 'hit' | 'states' | 'size' | 'colour'>;
  /** The second state in registry order is the upper end pressed. */
  readonly isSecond: boolean;
  /** True only while a pointer is down on the control. */
  readonly pressed: boolean;
  readonly stateLabel: string;
}

/** Half extents of the visible art (bezel and ears included) around the control centre. */
export function rockerExtent(size: RockerSize): { readonly halfW: number; readonly halfH: number } {
  const face = ROCKER_FACE[size];
  const bezelHalfW = face.w / 2 + BEZEL_PAD;
  const earsHalfW = face.ears === undefined ? 0 : bezelHalfW + face.ears.w;
  return { halfW: Math.max(bezelHalfW, earsHalfW), halfH: face.h / 2 + BEZEL_PAD };
}

/** State text size: 8 on the narrow footprints (LIGHT and S), else 10 (UI-SPEC Typography). */
export function rockerStateSize(size: RockerSize): 8 | 10 {
  return size === 'LIGHT' || size === 'S' ? 8 : 10;
}

/** Width estimate of B612 text; also used as textLength so tests match renders. */
function textWidth(text: string, size: number): number {
  return text.length * size * 0.62;
}

const f = (n: number): string => n.toFixed(2).replace(/\.?0+$/, '');

/**
 * One half of the face as a path: the outer end corners are rounded (radius r), the corners
 * at the groove are square.
 */
function halfPath(x0: number, x1: number, y0: number, y1: number, r: number, top: boolean): string {
  if (top) {
    return `M${f(x0)} ${f(y1)}V${f(y0 + r)}Q${f(x0)} ${f(y0)} ${f(x0 + r)} ${f(y0)}H${f(x1 - r)}Q${f(x1)} ${f(y0)} ${f(x1)} ${f(y0 + r)}V${f(y1)}Z`;
  }
  return `M${f(x0)} ${f(y0)}V${f(y1 - r)}Q${f(x0)} ${f(y1)} ${f(x0 + r)} ${f(y1)}H${f(x1 - r)}Q${f(x1)} ${f(y1)} ${f(x1)} ${f(y1 - r)}V${f(y0)}Z`;
}

/**
 * Pure rocker art (UI-SPEC 8.1): bezel, optional ears, two face halves in different tones,
 * groove, end placards, name placard and state text. ON (the second state) is the upper half
 * pressed. No hooks, no state, no per-widget defs, so node tests can expand and count it.
 */
export function RockerBody({ def, isSecond, pressed, stateLabel }: RockerBodyProps) {
  const size = def.size ?? 'M';
  const tones = TONES[def.colour ?? 'white'];
  const face = ROCKER_FACE[size];
  const { halfH } = rockerExtent(size);
  const hw = face.w / 2;
  const hh = face.h / 2;
  const bezelW = face.w + 2 * BEZEL_PAD;
  const bezelH = face.h + 2 * BEZEL_PAD;
  const stateSize = rockerStateSize(size);
  const light = size === 'LIGHT';

  const [first, second] = def.states;
  const upperPressed = isSecond;

  // Pressed half: darker, its outer end 1 unit nearer the groove, a 2-unit shadow band toward
  // the groove. Raised half: lighter with a 1-unit highlight on its top edge.
  const upperY0 = upperPressed ? -hh + 1 : -hh;
  const lowerY1 = upperPressed ? hh : hh - 1;
  const pressedBand = upperPressed ? { y: -2, tone: tones.shadow } : { y: 0, tone: tones.shadow };
  const highlightY = upperPressed ? 0 : -hh;

  const stateY = halfH + 1.5 + 0.72 * stateSize;
  const labelY = light ? stateY + 9 : -(halfH + 2.5);
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
      <path
        d={halfPath(-hw, hw, upperY0, 0, 3, true)}
        fill={upperPressed ? tones.pressed : tones.raised}
      />
      <path
        d={halfPath(-hw, hw, 0, lowerY1, 3, false)}
        fill={upperPressed ? tones.raised : tones.pressed}
      />
      <rect x={-hw + 1} y={highlightY} width={face.w - 2} height={1} fill={tones.highlight} />
      <rect
        x={-hw}
        y={pressedBand.y}
        width={face.w}
        height={2}
        fill={pressedBand.tone}
        fill-opacity={0.45}
      />
      <line x1={-hw} y1={0} x2={hw} y2={0} stroke={tones.groove} stroke-width={1} />
      <text
        x={0}
        y={-hh + 8}
        text-anchor="middle"
        font-family={FONT}
        font-size={6}
        fill={tones.ink}
      >
        {second.label}
      </text>
      <text
        x={0}
        y={hh - 3.5}
        text-anchor="middle"
        font-family={FONT}
        font-size={6}
        fill={tones.ink}
      >
        {first.label}
      </text>
      <text
        data-state-text
        x={0}
        y={stateY}
        text-anchor="middle"
        font-family={FONT}
        font-size={stateSize}
        font-weight={700}
        fill="#e6e9ed"
        textLength={Math.max(textWidth(stateLabel, stateSize), 1)}
        lengthAdjust="spacingAndGlyphs"
      >
        {stateLabel}
      </text>
    </g>
  );
}
