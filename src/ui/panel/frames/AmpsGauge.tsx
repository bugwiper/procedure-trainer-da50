import { readoutText } from './ArcGauge';
import type { Band } from './ArcGauge';
import {
  BOX_EXTRA_H,
  BOX_PAD,
  BOX_RADIUS,
  gaugeAlertStyle,
  textBoxWidth,
  worseTone,
} from './gauge-alert';
import type { GaugeTone } from './gauge-alert';

/** One alternator's reading: the number and the tone of the band it is in. */
export interface AmpsReading {
  readonly value: number;
  readonly tone: GaugeTone;
}

export interface AmpsGaugeProps {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly bands: readonly Band[];
  /** Alternator 1: pointer above the bar, readout at the left end of the title row. */
  readonly first: AmpsReading;
  /** Alternator 2: pointer below the bar, readout at the right end of the title row. */
  readonly second: AmpsReading;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  /** Digits after the point in the readouts. */
  readonly decimals?: number;
}

/** Height of the whole gauge cell: title row, pointer 1, bar, pointer 2. */
export const AMPS_GAUGE_H = 42;

const BAR_H = 7;
const FONT = 10;
const BASELINE = 11;
const CAP_EM = 0.7;
const BOX_ABOVE_CAP = 1;
/** Top of the bar below the top of the cell; the pointers are 6 tall on either side. */
const BAR_TOP = 26;
const POINTER_H = 6;
const POINTER_HALF_W = 4;
const DIGIT_COLOUR = '#aab3bd';
const MARK_FONT = 8;
/** Width of the pointer digit at the mark font size, with a little slack. */
const MARK_W = 6;

/**
 * The two-pointer Amps bar of the Electrical box: one scale and one band table, a pointer for each
 * alternator (1 above the bar, 2 below it). Each pointer and readout takes the look of its own
 * band; the label takes the worse of the two tones. The marks AMPS, 1 and 2 are static text; only
 * the readout numbers move (G-0). Presentational: the readings are plain props.
 */
export function AmpsGauge({
  label,
  min,
  max,
  bands,
  first,
  second,
  x,
  y,
  w,
  decimals,
}: AmpsGaugeProps) {
  const frac = (v: number) => (Math.min(max, Math.max(min, v)) - min) / (max - min);
  const barY = y + BAR_TOP;
  const labelText = label.toUpperCase();
  const firstText = readoutText(first.value, decimals);
  const secondText = readoutText(second.value, decimals);
  const labelW = textBoxWidth(labelText, FONT);
  const firstW = textBoxWidth(firstText, FONT, true);
  const secondW = textBoxWidth(secondText, FONT, true);
  // The side padding shrinks when the three boxes would not fit the width with the full one.
  const pad = Math.max(0, Math.min(BOX_PAD, (w - labelW - firstW - secondW - 2) / 6));
  const boxY = y + BASELINE - CAP_EM * FONT - BOX_ABOVE_CAP;
  const boxH = FONT + BOX_EXTRA_H;
  const worst = worseTone(first.tone, second.tone);
  const labelStyle = gaugeAlertStyle(worst);
  const firstStyle = gaugeAlertStyle(first.tone);
  const secondStyle = gaugeAlertStyle(second.tone);
  const labelX = x + w / 2 - labelW / 2;
  const firstX = x + frac(first.value) * w;
  const secondX = x + frac(second.value) * w;
  // The digit beside a pointer goes to its right, or to its left when that would leave the bar.
  const markSide = (px: number): { readonly x: number; readonly anchor: 'start' | 'end' } =>
    px + POINTER_HALF_W + 2 + MARK_W > x + w
      ? { x: px - POINTER_HALF_W - 2, anchor: 'end' }
      : { x: px + POINTER_HALF_W + 2, anchor: 'start' };
  const firstMark = markSide(firstX);
  const secondMark = markSide(secondX);
  return (
    <g data-gauge={label} data-alert={labelStyle.boxes ? worst : undefined} pointer-events="none">
      {labelStyle.boxes ? (
        <rect
          data-alert-box="label"
          x={labelX - pad}
          y={boxY}
          width={labelW + 2 * pad}
          height={boxH}
          rx={BOX_RADIUS}
          fill={labelStyle.boxFill}
          pointer-events="none"
        />
      ) : null}
      {firstStyle.boxes ? (
        <rect
          data-alert-box="first"
          x={x - pad}
          y={boxY}
          width={firstW + 2 * pad}
          height={boxH}
          rx={BOX_RADIUS}
          fill={firstStyle.boxFill}
          pointer-events="none"
        />
      ) : null}
      {secondStyle.boxes ? (
        <rect
          data-alert-box="second"
          x={x + w - secondW - pad}
          y={boxY}
          width={secondW + 2 * pad}
          height={boxH}
          rx={BOX_RADIUS}
          fill={secondStyle.boxFill}
          pointer-events="none"
        />
      ) : null}
      <text
        class="glass-digits"
        data-amps-readout="1"
        x={x}
        y={y + BASELINE}
        font-size={FONT}
        fill={firstStyle.valueFill}
        pointer-events="none"
      >
        {firstText}
      </text>
      <text
        x={labelX}
        y={y + BASELINE}
        font-size={FONT}
        fill={labelStyle.labelFill}
        pointer-events="none"
      >
        {labelText}
      </text>
      <text
        class="glass-digits"
        data-amps-readout="2"
        x={x + w}
        y={y + BASELINE}
        text-anchor="end"
        font-size={FONT}
        fill={secondStyle.valueFill}
        pointer-events="none"
      >
        {secondText}
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
        data-amps-pointer="1"
        d={`M ${firstX} ${barY - 1} l ${-POINTER_HALF_W} ${-POINTER_H} l ${2 * POINTER_HALF_W} 0 z`}
        fill={firstStyle.pointerFill}
        pointer-events="none"
      />
      <path
        data-amps-pointer="2"
        d={`M ${secondX} ${barY + BAR_H + 1} l ${-POINTER_HALF_W} ${POINTER_H} l ${2 * POINTER_HALF_W} 0 z`}
        fill={secondStyle.pointerFill}
        pointer-events="none"
      />
      <text
        data-amps-mark="1"
        x={firstMark.x}
        y={barY - 1}
        text-anchor={firstMark.anchor}
        font-size={MARK_FONT}
        fill={DIGIT_COLOUR}
        pointer-events="none"
      >
        1
      </text>
      <text
        data-amps-mark="2"
        x={secondMark.x}
        y={barY + BAR_H + 1 + POINTER_H}
        text-anchor={secondMark.anchor}
        font-size={MARK_FONT}
        fill={DIGIT_COLOUR}
        pointer-events="none"
      >
        2
      </text>
    </g>
  );
}
