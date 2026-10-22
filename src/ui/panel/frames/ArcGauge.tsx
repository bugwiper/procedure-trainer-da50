/** A coloured band of a gauge scale, in the gauge's own units. */
export interface Band {
  readonly from: number;
  readonly to: number;
  readonly color: string;
}

export interface ArcGaugeProps {
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly bands: readonly Band[];
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  /** Digits after the point in the readout; absent keeps formatReading. */
  readonly decimals?: number;
}

/** Sweep of the scale, centred on straight up. */
const SWEEP_DEG = 240;
const TICK_COUNT = 4;

/** Angle in degrees from straight up, clockwise, of a value on the scale. */
function angleOf(v: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, v));
  return -SWEEP_DEG / 2 + ((clamped - min) / (max - min)) * SWEEP_DEG;
}

function point(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const s = point(cx, cy, r, a0);
  const e = point(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

/** Digital readout text: whole numbers stay whole, fractions show one decimal. */
export function formatReading(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** The readout at the gauge's resolution when it has one (toFixed), else formatReading. */
export function readoutText(value: number, decimals?: number): string {
  return decimals === undefined ? formatReading(value) : value.toFixed(decimals);
}

/**
 * Presentational arc gauge. The value is a plain prop (the MFD feeds it the simulated quantity);
 * the needle turns with the SVG rotate(angle cx cy) form, never a CSS origin.
 */
export function ArcGauge({
  label,
  unit,
  value,
  min,
  max,
  bands,
  cx,
  cy,
  r,
  decimals,
}: ArcGaugeProps) {
  const needleAngle = angleOf(value, min, max);
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
    angleOf(min + ((max - min) * i) / TICK_COUNT, min, max),
  );
  return (
    <g data-gauge={label} pointer-events="none">
      {bands.map((b) => (
        <path
          key={`${b.from}-${b.to}`}
          d={arcPath(cx, cy, r, angleOf(b.from, min, max), angleOf(b.to, min, max))}
          fill="none"
          stroke={b.color}
          stroke-width={7}
          pointer-events="none"
        />
      ))}
      {ticks.map((a) => {
        const inner = point(cx, cy, r - 7, a);
        const outer = point(cx, cy, r + 5, a);
        return (
          <line
            key={a}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="#aab3bd"
            stroke-width={1.5}
            pointer-events="none"
          />
        );
      })}
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - r + 4}
        stroke="#ffffff"
        stroke-width={2.5}
        stroke-linecap="round"
        transform={`rotate(${needleAngle.toFixed(2)} ${cx} ${cy})`}
        pointer-events="none"
      />
      <circle cx={cx} cy={cy} r={4} fill="#3a424b" stroke="#aab3bd" pointer-events="none" />
      <text
        x={cx}
        y={cy - r - 9}
        text-anchor="middle"
        font-size={10}
        fill="#aab3bd"
        pointer-events="none"
      >
        {label.toUpperCase()}
      </text>
      <text
        class="glass-digits"
        x={cx}
        y={cy + 22}
        text-anchor="middle"
        font-size={14}
        fill="#ffffff"
        pointer-events="none"
      >
        {readoutText(value, decimals)}
      </text>
      <text
        x={cx}
        y={cy + 38}
        text-anchor="middle"
        font-size={10}
        fill="#8d97a2"
        pointer-events="none"
      >
        {unit.toUpperCase()}
      </text>
    </g>
  );
}
