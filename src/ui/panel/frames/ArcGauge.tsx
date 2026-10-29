import { BOX_EXTRA_H, BOX_PAD, BOX_RADIUS, gaugeAlertStyle, textBoxWidth } from './gauge-alert';
import type { GaugeTone } from './gauge-alert';

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
  /** The band colour of the live value; yellow and red box the texts. Absent is green (C-68). */
  readonly tone?: GaugeTone;
  /** A narrow ring, short ticks and a thin needle (the map strip); absent is the engine page look. */
  readonly fine?: boolean;
  /** Small numerals at the inner ticks, inside the ring (Load: 25, 50, 75); needs `fine`. */
  readonly scaleLabels?: boolean;
}

/** Sweep of the scale, centred on straight up. */
const SWEEP_DEG = 240;
const TICK_COUNT = 4;
const LABEL_FONT = 10;
const FINE_BAND_W = 3.5;
const FINE_NUMERAL_IN = 6;
const FINE_NUMERAL_FONT = 5;
const READOUT_FONT = 10;
/**
 * The caption and the number stand below the arc. The two ends of the 240 degree sweep lie r / 2
 * below the centre; the caption baseline is CAPTION_BELOW_ENDS below them, the number baseline
 * READOUT_BELOW_CAPTION below the caption.
 */
const CAPTION_BELOW_ENDS = 11;
const READOUT_BELOW_CAPTION = 15;
/** Cap line of the text above its baseline, in em, and the gap a box leaves above it. */
const CAP_EM = 0.7;
const BOX_ABOVE_CAP = 1;

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
  tone = 'green',
  fine = false,
  scaleLabels = false,
}: ArcGaugeProps) {
  const style = gaugeAlertStyle(tone);
  const labelText = label.toUpperCase();
  const unitText = unit.toUpperCase();
  // The caption under the arc names the quantity and, when the unit is another word, the unit
  // (LOAD %, RPM); the number under it is the bare value.
  const caption =
    unitText === '' || unitText === labelText ? labelText : `${labelText} ${unitText}`;
  const readout = readoutText(value, decimals);
  const labelBaseline = cy + r / 2 + CAPTION_BELOW_ENDS;
  const readoutBaseline = labelBaseline + READOUT_BELOW_CAPTION;
  const labelW = textBoxWidth(caption, LABEL_FONT) + 2 * BOX_PAD;
  const readoutW = textBoxWidth(readout, READOUT_FONT, true) + 2 * BOX_PAD;
  const needleAngle = angleOf(value, min, max);
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
    angleOf(min + ((max - min) * i) / TICK_COUNT, min, max),
  );
  const bandW = fine ? FINE_BAND_W : 7;
  const innerTick = fine ? bandW / 2 : 7;
  const outerTick = fine ? bandW / 2 + 2 : 5;
  const numerals = scaleLabels
    ? Array.from({ length: TICK_COUNT - 1 }, (_, i) => {
        const v = min + ((max - min) * (i + 1)) / TICK_COUNT;
        const at = point(cx, cy, r - FINE_NUMERAL_IN, angleOf(v, min, max));
        return { v, x: at.x, y: at.y };
      })
    : [];
  return (
    <g data-gauge={label} data-alert={style.boxes ? tone : undefined} pointer-events="none">
      {style.boxes ? (
        <rect
          data-alert-box="label"
          x={cx - labelW / 2}
          y={labelBaseline - CAP_EM * LABEL_FONT - BOX_ABOVE_CAP}
          width={labelW}
          height={LABEL_FONT + BOX_EXTRA_H}
          rx={BOX_RADIUS}
          fill={style.boxFill}
          pointer-events="none"
        />
      ) : null}
      {style.boxes ? (
        <rect
          data-alert-box="value"
          x={cx - readoutW / 2}
          y={readoutBaseline - CAP_EM * READOUT_FONT - BOX_ABOVE_CAP}
          width={readoutW}
          height={READOUT_FONT + BOX_EXTRA_H}
          rx={BOX_RADIUS}
          fill={style.boxFill}
          pointer-events="none"
        />
      ) : null}
      {bands.map((b) => (
        <path
          key={`${b.from}-${b.to}`}
          d={arcPath(cx, cy, r, angleOf(b.from, min, max), angleOf(b.to, min, max))}
          fill="none"
          stroke={b.color}
          stroke-width={bandW}
          pointer-events="none"
        />
      ))}
      {ticks.map((a) => {
        const inner = point(cx, cy, r - innerTick, a);
        const outer = point(cx, cy, r + outerTick, a);
        return (
          <line
            key={a}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="#aab3bd"
            stroke-width={fine ? 0.8 : 1.5}
            pointer-events="none"
          />
        );
      })}
      {numerals.map((n) => (
        <text
          key={n.v}
          x={n.x}
          y={n.y + FINE_NUMERAL_FONT / 2}
          text-anchor="middle"
          font-size={FINE_NUMERAL_FONT}
          fill="#aab3bd"
          pointer-events="none"
        >
          {formatReading(n.v)}
        </text>
      ))}
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - r + 4}
        stroke={style.pointerFill}
        stroke-width={fine ? 1.5 : 2.5}
        stroke-linecap="round"
        transform={`rotate(${needleAngle.toFixed(2)} ${cx} ${cy})`}
        pointer-events="none"
      />
      <circle
        cx={cx}
        cy={cy}
        r={fine ? 2.5 : 4}
        fill="#3a424b"
        stroke="#aab3bd"
        pointer-events="none"
      />
      <text
        x={cx}
        y={labelBaseline}
        text-anchor="middle"
        font-size={LABEL_FONT}
        fill={style.labelFill}
        pointer-events="none"
      >
        {caption}
      </text>
      <text
        class="glass-digits"
        x={cx}
        y={readoutBaseline}
        text-anchor="middle"
        font-size={READOUT_FONT}
        fill={style.valueFill}
        pointer-events="none"
      >
        {readout}
      </text>
    </g>
  );
}
