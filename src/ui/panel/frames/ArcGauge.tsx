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
  /**
   * The slim look of the map strip: a narrow ring, fine ticks and numerals at `numerals`, a thin
   * needle, the caption and the number to the right of the ring. Absent is the engine page look.
   */
  readonly fine?: boolean;
  /** The values that carry a fine tick and a small numeral (fine only); absent ticks the two ends. */
  readonly numerals?: readonly number[];
}

/** Sweep of the scale, centred on straight up. */
const SWEEP_DEG = 240;
const TICK_COUNT = 4;
const LABEL_FONT = 10;
/** The slim look: ring width, numeral size and place, caption size and the gap right of the ring. */
const FINE_BAND_W = 2.5;
const FINE_NUMERAL_IN = 7.5;
const FINE_NUMERAL_OUT = 3;
const FINE_NUMERAL_FONT = 6;
const FINE_CAPTION_FONT = 8;
const FINE_CAPTION_GAP = 6;
const FINE_READOUT_BELOW = 10;
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
  numerals,
}: ArcGaugeProps) {
  const style = gaugeAlertStyle(tone);
  const labelText = label.toUpperCase();
  const unitText = unit.toUpperCase();
  // The caption under the arc names the quantity and, when the unit is another word, the unit
  // (LOAD %, RPM); the number under it is the bare value.
  const caption =
    unitText === '' || unitText === labelText ? labelText : `${labelText} ${unitText}`;
  const readout = readoutText(value, decimals);
  const labelFont = fine ? FINE_CAPTION_FONT : LABEL_FONT;
  const readoutFont = fine ? FINE_CAPTION_FONT : READOUT_FONT;
  // Slim: the texts stand to the right of the ring, level with the hub; else centred under it.
  const textX = fine ? cx + r + FINE_CAPTION_GAP : cx;
  const anchor = fine ? 'start' : 'middle';
  const labelBaseline = fine ? cy + 1 : cy + r / 2 + CAPTION_BELOW_ENDS;
  const readoutBaseline = labelBaseline + (fine ? FINE_READOUT_BELOW : READOUT_BELOW_CAPTION);
  const labelW = textBoxWidth(caption, labelFont) + 2 * BOX_PAD;
  const readoutW = textBoxWidth(readout, readoutFont, true) + 2 * BOX_PAD;
  const boxX = (w: number): number => (fine ? textX - BOX_PAD : textX - w / 2);
  const needleAngle = angleOf(value, min, max);
  const tickValues = fine
    ? (numerals ?? [min, max])
    : Array.from({ length: TICK_COUNT + 1 }, (_, i) => min + ((max - min) * i) / TICK_COUNT);
  const ticks = tickValues.map((v) => angleOf(v, min, max));
  const bandW = fine ? FINE_BAND_W : 7;
  const innerTick = fine ? bandW / 2 : 7;
  const outerTick = fine ? bandW / 2 + 1.5 : 5;
  // The lowest value stands outside the ring end at the left, every other one inside the ring.
  const numeralNodes = fine
    ? (numerals ?? []).map((v) => {
        const outside = v <= min;
        const at = point(
          cx,
          cy,
          outside ? r + FINE_NUMERAL_OUT : r - FINE_NUMERAL_IN,
          angleOf(v, min, max),
        );
        return { v, x: at.x, y: at.y + FINE_NUMERAL_FONT / 3, anchor: outside ? 'end' : 'middle' };
      })
    : [];
  return (
    <g data-gauge={label} data-alert={style.boxes ? tone : undefined} pointer-events="none">
      {style.boxes ? (
        <rect
          data-alert-box="label"
          x={boxX(labelW)}
          y={labelBaseline - CAP_EM * labelFont - BOX_ABOVE_CAP}
          width={labelW}
          height={labelFont + BOX_EXTRA_H}
          rx={BOX_RADIUS}
          fill={style.boxFill}
          pointer-events="none"
        />
      ) : null}
      {style.boxes ? (
        <rect
          data-alert-box="value"
          x={boxX(readoutW)}
          y={readoutBaseline - CAP_EM * readoutFont - BOX_ABOVE_CAP}
          width={readoutW}
          height={readoutFont + BOX_EXTRA_H}
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
            stroke-width={fine ? 0.6 : 1.5}
            pointer-events="none"
          />
        );
      })}
      {numeralNodes.map((n) => (
        <text
          key={n.v}
          x={n.x}
          y={n.y}
          text-anchor={n.anchor}
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
        y2={cy - r + (fine ? 3 : 4)}
        stroke={style.pointerFill}
        stroke-width={fine ? 1.2 : 2.5}
        stroke-linecap="round"
        transform={`rotate(${needleAngle.toFixed(2)} ${cx} ${cy})`}
        pointer-events="none"
      />
      <circle
        cx={cx}
        cy={cy}
        r={fine ? 2 : 4}
        fill="#3a424b"
        stroke="#aab3bd"
        pointer-events="none"
      />
      <text
        x={textX}
        y={labelBaseline}
        text-anchor={anchor}
        font-size={labelFont}
        fill={style.labelFill}
        pointer-events="none"
      >
        {caption}
      </text>
      <text
        class="glass-digits"
        x={textX}
        y={readoutBaseline}
        text-anchor={anchor}
        font-size={readoutFont}
        fill={style.valueFill}
        pointer-events="none"
      >
        {readout}
      </text>
    </g>
  );
}
