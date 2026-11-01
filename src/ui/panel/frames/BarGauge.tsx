import { readoutText } from './ArcGauge';
import type { Band } from './ArcGauge';
import {
  BOX_EXTRA_H,
  BOX_PAD,
  BOX_RADIUS,
  GLASS_DARK,
  gaugeAlertStyle,
  textBoxWidth,
} from './gauge-alert';
import type { GaugeTone } from './gauge-alert';
import {
  POINTER_DEFAULT,
  POINTER_FINE,
  POINTER_FINE_OUTLINE,
  POINTER_OUTLINE,
  pointerPath,
} from './pointer';

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
  /** Where the label stands: at the left end (the Map strip) or centred over the bar (engine page). */
  readonly labelAlign?: 'start' | 'centre';
  /**
   * The slim look of the map strip: small centred label, no number, a 4 thick bar and a small
   * pointer. The cell is then about 21 tall; the engine page keeps the full look.
   */
  readonly fine?: boolean;
}

const BAR_H = 7;
const FONT = 10;
/** Baseline of the label and the value below the top of the gauge cell. */
const BASELINE = 11;
/** Cap line of the text above its baseline, in em, and the gap the box leaves above it. */
const CAP_EM = 0.7;
const BOX_ABOVE_CAP = 1;
/** The slim look: label size and baseline, bar thickness and the gap under the bar. */
const FINE_FONT = 7;
/** The slim label stands this far above the top of its pointer (the label belongs to the bar below it). */
const FINE_LABEL_ABOVE_POINTER = 1.5;
const FINE_BAR_H = 4;
const FINE_BAR_GAP = 1;

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
  labelAlign = 'start',
  fine = false,
}: BarGaugeProps) {
  const frac = (v: number) => (Math.min(max, Math.max(min, v)) - min) / (max - min);
  const barH = fine ? FINE_BAR_H : BAR_H;
  const font = fine ? FINE_FONT : FONT;
  const centre = fine || labelAlign === 'centre';
  const size = fine ? POINTER_FINE : POINTER_DEFAULT;
  const barY = y + h - barH - (fine ? FINE_BAR_GAP : 3);
  // Slim: the label sits right over the pointer of its own bar; else it stands at the top of the cell.
  const baseline = fine
    ? barY +
      POINTER_FINE.sink -
      POINTER_FINE.tipH -
      POINTER_FINE.rectH -
      FINE_LABEL_ABOVE_POINTER -
      y
    : BASELINE;
  const pointerX = x + frac(value) * w;
  const style = gaugeAlertStyle(tone);
  const labelText = label.toUpperCase();
  // An empty unit prints the number alone (the label already names the unit, as PSI and US GAL do).
  const valueText =
    unit === ''
      ? readoutText(value, decimals)
      : `${readoutText(value, decimals)} ${unit.toUpperCase()}`;
  const labelW = textBoxWidth(labelText, font);
  const valueW = fine ? 0 : textBoxWidth(valueText, FONT, true);
  // The side padding shrinks (to 2 on the 130 wide map strip, to 0 at most) when the pair would
  // not fit the gauge width with the full one, so the two boxes never touch while the texts fit.
  const pad = fine ? BOX_PAD : Math.max(0, Math.min(BOX_PAD, (w - labelW - valueW - 1) / 2));
  const labelX = centre ? x + w / 2 - labelW / 2 : x;
  const boxY = y + baseline - CAP_EM * font - BOX_ABOVE_CAP;
  const boxH = font + BOX_EXTRA_H;
  return (
    <g data-gauge={label} data-alert={style.boxes ? tone : undefined} pointer-events="none">
      {style.boxes ? (
        <rect
          data-alert-box="label"
          x={labelX - pad}
          y={boxY}
          width={labelW + 2 * pad}
          height={boxH}
          rx={BOX_RADIUS}
          fill={style.boxFill}
          pointer-events="none"
        />
      ) : null}
      {style.boxes && !fine ? (
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
      <text
        x={centre ? x + w / 2 : x}
        y={y + baseline}
        text-anchor={centre ? 'middle' : 'start'}
        font-size={font}
        fill={style.labelFill}
        pointer-events="none"
      >
        {labelText}
      </text>
      {fine ? null : (
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
      )}
      {bands.map((b) => (
        <rect
          key={`${b.from}-${b.to}`}
          x={x + frac(b.from) * w}
          y={barY}
          width={(frac(b.to) - frac(b.from)) * w}
          height={barH}
          fill={b.color}
          pointer-events="none"
        />
      ))}
      <path
        data-bar-pointer
        d={pointerPath(pointerX, barY + size.sink, 'above', size)}
        fill={style.pointerFill}
        stroke={GLASS_DARK}
        stroke-width={fine ? POINTER_FINE_OUTLINE : POINTER_OUTLINE}
        pointer-events="none"
      />
    </g>
  );
}
