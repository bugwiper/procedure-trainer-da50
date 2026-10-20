import { formatReading } from './ArcGauge';
import type { Band } from './ArcGauge';

export interface BarGaugeProps {
  readonly label: string;
  readonly unit: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly bands: readonly Band[];
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const BAR_H = 7;

/** Presentational horizontal bar gauge; the value is a plain prop (live values: PNL-04). */
export function BarGauge({ label, unit, value, min, max, bands, x, y, w, h }: BarGaugeProps) {
  const frac = (v: number) => (Math.min(max, Math.max(min, v)) - min) / (max - min);
  const barY = y + h - BAR_H - 3;
  const pointerX = x + frac(value) * w;
  return (
    <g data-gauge={label} pointer-events="none">
      <text x={x} y={y + 11} font-size={10} fill="#aab3bd" pointer-events="none">
        {label.toUpperCase()}
      </text>
      <text
        class="glass-digits"
        x={x + w}
        y={y + 11}
        text-anchor="end"
        font-size={10}
        fill="#ffffff"
        pointer-events="none"
      >
        {`${formatReading(value)} ${unit.toUpperCase()}`}
      </text>
      {bands.map((b) => (
        <rect
          key={`${b.from}-${b.to}`}
          x={x + frac(b.from) * w}
          y={barY}
          width={(frac(b.to) - frac(b.from)) * w}
          height={BAR_H}
          fill={b.color}
          pointer-events="none"
        />
      ))}
      <path d={`M ${pointerX} ${barY - 1} l -4 -6 l 8 0 z`} fill="#ffffff" pointer-events="none" />
    </g>
  );
}
