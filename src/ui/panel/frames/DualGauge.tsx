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
import {
  POINTER_DEFAULT,
  POINTER_FINE,
  POINTER_FINE_OUTLINE,
  POINTER_OUTLINE,
  pointerPath,
  pointerRectCentreY,
} from './pointer';

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
  /**
   * The slim look of the map strip: small centred label, no readouts, a 4 thick bar, small
   * pointers and a scale of fine ticks and small numerals. The cell is about 33 tall.
   */
  readonly fine?: boolean;
}

/** The cell height of the slim look (label, pointer 1, bar, pointer 2, scale). */
export const DUAL_FINE_H = 33;

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
/** The slim look: label, bar top and thickness, the scale ticks and numerals under the bar. */
const FINE_FONT = 7;
const FINE_BASELINE = 9;
const FINE_BAR_TOP = 15;
const FINE_BAR_H = 4;
const FINE_MARK_FONT = 4;
const FINE_TICK_H = 3;
const FINE_SCALE_FONT = 6;
const FINE_NUMERAL_DY = 10;

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
  fine = false,
}: DualGaugeProps) {
  const frac = (v: number) => (Math.min(max, Math.max(min, v)) - min) / (max - min);
  const barH = fine ? FINE_BAR_H : BAR_H;
  const font = fine ? FINE_FONT : FONT;
  const baseline = fine ? FINE_BASELINE : BASELINE;
  const markFont = fine ? FINE_MARK_FONT : MARK_FONT;
  const size = fine ? POINTER_FINE : POINTER_DEFAULT;
  const outline = fine ? POINTER_FINE_OUTLINE : POINTER_OUTLINE;
  const barY = y + (fine ? FINE_BAR_TOP : BAR_TOP);
  const labelText = label.toUpperCase();
  const firstText = readoutText(first.value, decimals);
  const secondText = readoutText(second.value, decimals);
  const labelW = textBoxWidth(labelText, font);
  const firstW = fine ? 0 : textBoxWidth(firstText, FONT, true);
  const secondW = fine ? 0 : textBoxWidth(secondText, FONT, true);
  // The side padding shrinks when the three boxes would not fit the width with the full one.
  const pad = fine
    ? BOX_PAD
    : Math.max(0, Math.min(BOX_PAD, (w - labelW - firstW - secondW - 2) / 6));
  const boxY = y + baseline - CAP_EM * font - BOX_ABOVE_CAP;
  const boxH = font + BOX_EXTRA_H;
  const worst = worseTone(first.tone, second.tone);
  const labelStyle = gaugeAlertStyle(worst);
  const firstStyle = gaugeAlertStyle(first.tone);
  const secondStyle = gaugeAlertStyle(second.tone);
  const labelX = x + w / 2 - labelW / 2;
  const firstX = x + frac(first.value) * w;
  const secondX = x + frac(second.value) * w;
  // Pointer 1 stands above the bar, pointer 2 below it; each tip reaches POINTER_SINK into the bar.
  const firstTipY = barY + size.sink;
  const secondTipY = barY + barH - size.sink;
  const markY = (tipY: number, from: 'above' | 'below'): number =>
    pointerRectCentreY(tipY, from, size) + (MARK_CAP_EM * markFont) / 2;
  const tickTop = fine ? barY + barH : y + SCALE_TICK_TOP;
  const tickBottom = tickTop + (fine ? FINE_TICK_H : SCALE_TICK_H);
  const numeralY = fine ? tickBottom + FINE_NUMERAL_DY - FINE_TICK_H : y + SCALE_BASELINE;
  const tickWidth = fine ? 0.5 : 1;
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
      {firstStyle.boxes && !fine ? (
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
      {secondStyle.boxes && !fine ? (
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
      {fine ? null : (
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
      )}
      <text
        x={x + w / 2}
        y={y + baseline}
        text-anchor="middle"
        font-size={font}
        fill={labelStyle.labelFill}
        pointer-events="none"
      >
        {labelText}
      </text>
      {fine ? null : (
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
      {scale === undefined
        ? null
        : scale.map((v) => (
            <g key={v} data-dual-scale={v}>
              <line
                x1={x + frac(v) * w}
                y1={tickTop}
                x2={x + frac(v) * w}
                y2={tickBottom}
                stroke={DIGIT_COLOUR}
                stroke-width={tickWidth}
                pointer-events="none"
              />
              <text
                x={x + frac(v) * w}
                y={numeralY}
                text-anchor="middle"
                font-size={fine ? FINE_SCALE_FONT : SCALE_FONT}
                fill={DIGIT_COLOUR}
                pointer-events="none"
              >
                {String(v)}
              </text>
            </g>
          ))}
      <path
        data-dual-pointer="1"
        d={pointerPath(firstX, firstTipY, 'above', size)}
        fill={firstStyle.pointerFill}
        stroke={GLASS_DARK}
        stroke-width={outline}
        pointer-events="none"
      />
      <path
        data-dual-pointer="2"
        d={pointerPath(secondX, secondTipY, 'below', size)}
        fill={secondStyle.pointerFill}
        stroke={GLASS_DARK}
        stroke-width={outline}
        pointer-events="none"
      />
      <text
        data-dual-mark="1"
        x={firstX}
        y={markY(firstTipY, 'above')}
        text-anchor="middle"
        font-size={markFont}
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
        font-size={markFont}
        fill={GLASS_DARK}
        pointer-events="none"
      >
        {marks[1]}
      </text>
    </g>
  );
}
