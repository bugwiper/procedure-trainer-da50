import type { CircuitBreakerDef, Rect, StateId } from '../../../engine/registry';

const FONT = 'B612, system-ui, sans-serif';

/** The pressed ring: drawn only while a pointer is down, never a persistent state. */
const PRESSED_RING = '#8fb8e6';

/**
 * Art constants of the circuit breaker (UI-SPEC 01.2 Table A2), local origin at the breaker
 * centre. The normal set belongs to the 28 x 28 hit, the compact set to the 24 x 28 hit of the
 * lower row. The unit test checks that the visible part stays inside the hit, so a radius may only
 * shrink here, never grow.
 */
export interface BreakerGeometry {
  readonly socketR: number;
  readonly capR: Readonly<Record<'in' | 'out', number>>;
  /** Offset of the cap group in the pulled state (pulled up and to the left). */
  readonly capOffset: number;
  readonly shadowR: number;
  readonly shadowOffset: number;
  readonly ringR: number;
  readonly ringStroke: number;
  readonly pressedR: number;
}

export const BREAKER_NORMAL: BreakerGeometry = {
  socketR: 13,
  capR: { in: 11, out: 11.4 },
  capOffset: -2,
  shadowR: 11,
  shadowOffset: 2.5,
  ringR: 12.5,
  ringStroke: 2.5,
  pressedR: 13.2,
};

export const BREAKER_COMPACT: BreakerGeometry = {
  socketR: 11,
  capR: { in: 9.4, out: 9.6 },
  capOffset: -1.5,
  shadowR: 9.4,
  shadowOffset: 2,
  ringR: 10.6,
  ringStroke: 2,
  pressedR: 11,
};

/** Stroke widths of the socket, the cap and the pressed ring (all 1). */
const OUTLINE = 1;
const PRESSED_STROKE = 1;

/** The last printed line sits this far above the breaker centre; earlier lines 7 higher each. */
export const LABEL_LAST_BASELINE = -16;
export const LABEL_PITCH = 7;

export function geometryOf(def: Pick<CircuitBreakerDef, 'compact'>): BreakerGeometry {
  return def.compact === true ? BREAKER_COMPACT : BREAKER_NORMAL;
}

/** Baseline (relative to the breaker centre) of label line `index` of `count` lines. */
export function labelBaseline(index: number, count: number): number {
  return LABEL_LAST_BASELINE - LABEL_PITCH * (count - 1 - index);
}

/**
 * The rectangle, relative to the breaker centre, that covers every visible part of the breaker
 * (socket, shadow, cap, ring, pressed ring) with half of each stroke. The printed label above the
 * breaker is not part of it. The skin draws from the same numbers, so art and test cannot drift.
 */
export function breakerExtent(
  def: Pick<CircuitBreakerDef, 'compact'>,
  state: StateId,
  pressed: boolean,
): Rect {
  const g = geometryOf(def);
  const out = state === 'out';
  let x1 = -(g.socketR + OUTLINE / 2);
  let y1 = x1;
  let x2 = g.socketR + OUTLINE / 2;
  let y2 = x2;
  const grow = (cx: number, cy: number, reach: number) => {
    x1 = Math.min(x1, cx - reach);
    y1 = Math.min(y1, cy - reach);
    x2 = Math.max(x2, cx + reach);
    y2 = Math.max(y2, cy + reach);
  };
  const capR = out ? g.capR.out : g.capR.in;
  const capShift = out ? g.capOffset : 0;
  grow(capShift, capShift, capR + OUTLINE / 2);
  if (out) {
    grow(g.shadowOffset, g.shadowOffset, g.shadowR);
    grow(0, 0, g.ringR + g.ringStroke / 2);
  }
  if (pressed) grow(0, 0, g.pressedR + PRESSED_STROKE / 2);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export interface BreakerBodyProps {
  readonly def: Pick<CircuitBreakerDef, 'labelLines' | 'rating' | 'compact' | 'labelDx'>;
  readonly state: StateId;
  /** True only while a pointer is down on the control. */
  readonly pressed: boolean;
}

/**
 * Pure circuit-breaker art (UI-SPEC 01.2 Table A2): a dark socket, a cap with its amp rating, the
 * label lines above. Pushed in (`in`) the cap is flush and there is no ring; pulled (`out`) the cap
 * group is raised up and to the left, a shadow lies under it and a white ring stands around the
 * socket. The body prints the label lines and the rating only, identical in both states: no IN or
 * OUT word and no state-text marker (owner rule G-0.1). All of it is pointer-events none; only the
 * hit rectangle of the widget is a control. No hooks, no state.
 */
export function BreakerBody({ def, state, pressed }: BreakerBodyProps) {
  const g = geometryOf(def);
  const out = state === 'out';
  const capR = out ? g.capR.out : g.capR.in;
  const capShift = out ? g.capOffset : 0;
  const highlightR = capR - 2.5;
  const count = def.labelLines.length;
  const labelX = def.labelDx ?? 0;

  return (
    <g pointer-events="none">
      <circle
        data-breaker-socket=""
        cx={0}
        cy={0}
        r={g.socketR}
        fill="#0c0d0f"
        stroke="#2d3138"
        stroke-width={OUTLINE}
      />
      {out ? (
        <circle cx={g.shadowOffset} cy={g.shadowOffset} r={g.shadowR} fill="rgba(0,0,0,0.55)" />
      ) : null}
      <g data-breaker-cap="" transform={`translate(${capShift} ${capShift})`}>
        <circle cx={0} cy={0} r={capR} fill="#15171a" stroke="#3a3f46" stroke-width={OUTLINE} />
        <path
          d={`M ${-highlightR * 0.8} ${-highlightR * 0.45} A ${highlightR} ${highlightR} 0 0 1 ${-highlightR * 0.45} ${-highlightR * 0.8}`}
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          stroke-width={OUTLINE}
        />
        <text
          x={0}
          y={2.8}
          text-anchor="middle"
          font-family={FONT}
          font-size={8}
          font-weight={700}
          fill="#e6e9ed"
          style="letter-spacing:0"
        >
          {def.rating}
        </text>
      </g>
      {out ? (
        <circle
          data-breaker-ring=""
          cx={0}
          cy={0}
          r={g.ringR}
          fill="none"
          stroke="#f6f8fa"
          stroke-width={g.ringStroke}
        />
      ) : null}
      {def.labelLines.map((line, index) => (
        <text
          key={index}
          data-breaker-label=""
          x={labelX}
          y={labelBaseline(index, count)}
          text-anchor="middle"
          font-family={FONT}
          font-size={6}
          fill="#aab3bd"
        >
          {line}
        </text>
      ))}
      {pressed ? (
        <circle
          cx={0}
          cy={0}
          r={g.pressedR}
          fill="none"
          stroke={PRESSED_RING}
          stroke-width={PRESSED_STROKE}
        />
      ) : null}
    </g>
  );
}
