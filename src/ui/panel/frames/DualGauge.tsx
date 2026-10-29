import { readoutText } from './ArcGauge';
import type { Band } from './ArcGauge';
import {
  BOX_EXTRA_H,
  BOX_PAD,
  BOX_RADIUS,
  GLASS_DARK,
  gaugeAlertStyle,
  textBoxWidth,
  worseTone,
} from './gauge-alert';
import type { GaugeTone } from './gauge-alert';
import { POINTER_OUTLINE, POINTER_SINK, pointerPath, pointerRectCentreY } from './pointer';

/** One pointer's reading: the number and the tone of the band it is in. */
export interface DualReading {
  readonly value: number;
  readonly tone: GaugeTone;
}

export interface DualGaugeProps {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly bands: readonly Band[];
  /** Pointer 1 above the bar, readout at the left end of the title row. */
  readonly first: DualReading;
  /** Pointer 2 below the bar, readout at the right end of the title row. */
  readonly second: DualReading;
  /** The marks inside the two pointers: 1 and 2 for the Amps bar, L and R for the tanks. */
  readonly marks?: readonly [string, string];
  /** Numerals under the bar with a tick each (Fuel Qty); absent draws none and the cell is shorter. */
  readonly scale?: readonly number[];
  readonly x: number;
  readonly y: number;
  readonly w: number;
  /** Digits after the point in the readouts. */
  readonly decimals?: number;
}

/** Height of the whole gauge cell: title row, pointer 1, bar, pointer 2. */
export const DUAL_GAUGE_H = 42;
/** The extra height of the cell for the scale numerals and their ticks. */
export const DUAL_SCALE_H = 10;
/** The cell height a gauge needs, with or without a scale. */
export const dualGaugeHeight = (hasScale: boolean): number =>
  DUAL_GAUGE_H + (hasScale ? DUAL_SCALE_H : 0);

const BAR_H = 7;
const FONT = 10;
const BASELINE = 11;
const CAP_EM = 0.7;
const BOX_ABOVE_CAP = 1;
/** Top of the bar below the top of the cell; the pointers stand above and below it. */
const BAR_TOP = 26;
const DIGIT_COLOUR = '#aab3bd';
/** The mark inside a pointer: fine black type, its cap height in em, for the vertical centring. */
const MARK_FONT = 6;
const MARK_CAP_EM = 0.7;
const SCALE_FONT = 6;
const SCALE_TICK_H = 2;
/** Where the ticks of the scale start below the top of the cell, and the numeral baseline. */
const SCALE_TICK_TOP = 42;
const SCALE_BASELINE = 51;

/**
 * The two-pointer bar (the Amps bar of the Electrical box, Fuel Qty and Fuel Temp of the Fuel
 * box): one scale and one band table, a pointer for each reading (1 above the bar, 2 below it).
 * Each pointer and readout takes the look of its own band; the label takes the worse of the two
 * tones. The label, the marks and the scale numerals are static text; only the readout numbers
 * move (G-0). Presentational: the readings are plain props.
 */
export function DualGauge({
  label,
  min,
  max,
  bands,
  first,
  second,
  marks = ['1', '2'],
  scale,
  x,
  y,
  w,
  decimals,
}: DualGaugeProps) {
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
  // Pointer 1 stands above the bar, pointer 2 below it; each tip reaches POINTER_SINK into the bar.
  const firstTipY = barY + POINTER_SINK;
  const secondTipY = barY + BAR_H - POINTER_SINK;
  const markY = (tipY: number, from: 'above' | 'below'): number =>
    pointerRectCentreY(tipY, from) + (MARK_CAP_EM * MARK_FONT) / 2;
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
        data-dual-readout="1"
        x={x}
        y={y + BASELINE}
        font-size={FONT}
        fill={firstStyle.valueFill}
        pointer-events="none"
      >
        {firstText}
      </text>
      <text
        x={x + w / 2}
        y={y + BASELINE}
        text-anchor="middle"
        font-size={FONT}
        fill={labelStyle.labelFill}
        pointer-events="none"
      >
        {labelText}
      </text>
      <text
        class="glass-digits"
        data-dual-readout="2"
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
        data-dual-pointer="1"
        d={pointerPath(firstX, firstTipY, 'above')}
        fill={firstStyle.pointerFill}
        stroke={GLASS_DARK}
        stroke-width={POINTER_OUTLINE}
        pointer-events="none"
      />
      <path
        data-dual-pointer="2"
        d={pointerPath(secondX, secondTipY, 'below')}
        fill={secondStyle.pointerFill}
        stroke={GLASS_DARK}
        stroke-width={POINTER_OUTLINE}
        pointer-events="none"
      />
      <text
        data-dual-mark="1"
        x={firstX}
        y={markY(firstTipY, 'above')}
        text-anchor="middle"
        font-size={MARK_FONT}
        fill={GLASS_DARK}
        pointer-events="none"
      >
        {marks[0]}
      </text>
      <text
        data-dual-mark="2"
        x={secondX}
        y={markY(secondTipY, 'below')}
        text-anchor="middle"
        font-size={MARK_FONT}
        fill={GLASS_DARK}
        pointer-events="none"
      >
        {marks[1]}
      </text>
      {scale === undefined
        ? null
        : scale.map((v) => (
            <g key={v} data-dual-scale={v}>
              <line
                x1={x + frac(v) * w}
                y1={y + SCALE_TICK_TOP}
                x2={x + frac(v) * w}
                y2={y + SCALE_TICK_TOP + SCALE_TICK_H}
                stroke={DIGIT_COLOUR}
                stroke-width={1}
                pointer-events="none"
              />
              <text
                x={x + frac(v) * w}
                y={y + SCALE_BASELINE}
                text-anchor="middle"
                font-size={SCALE_FONT}
                fill={DIGIT_COLOUR}
                pointer-events="none"
              >
                {String(v)}
              </text>
            </g>
          ))}
    </g>
  );
}
