import { readoutText } from './ArcGauge';
import type { Band } from './ArcGauge';
import { BOX_EXTRA_H, BOX_PAD, BOX_RADIUS, gaugeAlertStyle, textBoxWidth } from './gauge-alert';
import type { GaugeTone } from './gauge-alert';

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
  /** Digits after the point in the readout; absent keeps formatReading. */
  readonly decimals?: number;
  /** The band colour of the live value; yellow and red box the texts. Absent is green (C-68). */
  readonly tone?: GaugeTone;
}

const BAR_H = 7;
const FONT = 10;
/** Baseline of the label and the value below the top of the gauge cell. */
const BASELINE = 11;
/** Cap line of the text above its baseline, in em, and the gap the box leaves above it. */
const CAP_EM = 0.7;
const BOX_ABOVE_CAP = 1;

/** Presentational horizontal bar gauge; the value is a plain prop (the simulated quantity). */
export function BarGauge({
  label,
  unit,
  value,
  min,
  max,
  bands,
  x,
  y,
  w,
  h,
  decimals,
  tone = 'green',
}: BarGaugeProps) {
  const frac = (v: number) => (Math.min(max, Math.max(min, v)) - min) / (max - min);
  const barY = y + h - BAR_H - 3;
  const pointerX = x + frac(value) * w;
  const style = gaugeAlertStyle(tone);
  const labelText = label.toUpperCase();
  const valueText = `${readoutText(value, decimals)} ${unit.toUpperCase()}`;
  const labelW = textBoxWidth(labelText, FONT);
  const valueW = textBoxWidth(valueText, FONT, true);
  // The side padding shrinks (to 2 on the 130 wide map strip, to 0 at most) when the pair would
  // not fit the gauge width with the full one, so the two boxes never touch while the texts fit.
  const pad = Math.max(0, Math.min(BOX_PAD, (w - labelW - valueW - 1) / 2));
  const boxY = y + BASELINE - CAP_EM * FONT - BOX_ABOVE_CAP;
  const boxH = FONT + BOX_EXTRA_H;
  return (
    <g data-gauge={label} data-alert={style.boxes ? tone : undefined} pointer-events="none">
      {style.boxes ? (
        <rect
          data-alert-box="label"
          x={x - pad}
          y={boxY}
          width={labelW + 2 * pad}
          height={boxH}
          rx={BOX_RADIUS}
          fill={style.boxFill}
          pointer-events="none"
        />
      ) : null}
      {style.boxes ? (
        <rect
          data-alert-box="value"
          x={x + w + pad - (valueW + 2 * pad)}
          y={boxY}
          width={valueW + 2 * pad}
          height={boxH}
          rx={BOX_RADIUS}
          fill={style.boxFill}
          pointer-events="none"
        />
      ) : null}
      <text x={x} y={y + BASELINE} font-size={FONT} fill={style.labelFill} pointer-events="none">
        {labelText}
      </text>
      <text
        class="glass-digits"
        x={x + w}
        y={y + BASELINE}
        text-anchor="end"
        font-size={FONT}
        fill={style.valueFill}
        pointer-events="none"
      >
        {valueText}
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
      <path
        d={`M ${pointerX} ${barY - 1} l -4 -6 l 8 0 z`}
        fill={style.pointerFill}
        pointer-events="none"
      />
    </g>
  );
}
