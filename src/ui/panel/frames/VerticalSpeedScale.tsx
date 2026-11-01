import {
  ATTITUDE,
  TAPE_OPACITY,
  VS_BOX,
  VS_HALF_HEIGHT,
  VS_NUMERAL_FPM,
  VS_SCALE_MAX_FPM,
  VS_STRIP,
  VS_TICK_STEP_FPM,
  verticalSpeedPointerPx,
  verticalSpeedReadout,
} from '../../../aircraft/da50rg/pfd-layout';

// The vertical speed scale of the PFD (Phase 6.1, PNL-27, D-11): a narrow dark glass strip right of
// the altitude tape with a linear scale of plus and minus 3000 fpm, a tick every 500 fpm, the static
// numerals 1, 2 and 3 (thousand fpm) and a black box with a white frame that moves along the strip
// with the vertical speed and carries the bare number. A pure function component, no hooks.

const WHITE = '#ffffff';
const TAPE_FILL = '#12181e';
const LABEL = '#aab3bd';

/** The ticks, one per step of the scale from the bottom end to the top end: -3000 ... +3000. */
const TICK_COUNT = (2 * VS_SCALE_MAX_FPM) / VS_TICK_STEP_FPM + 1;
const TICK_FPM: readonly number[] = Array.from(
  { length: TICK_COUNT },
  (_, i) => i * VS_TICK_STEP_FPM - VS_SCALE_MAX_FPM,
);
/** The numerals at plus and minus each thousand, top to bottom. */
const NUMERALS: readonly { fpm: number; text: string }[] = [
  ...[...VS_NUMERAL_FPM].reverse().map((fpm) => ({ fpm, text: String(fpm / 1000) })),
  ...VS_NUMERAL_FPM.map((fpm) => ({ fpm: 0 - fpm, text: String(fpm / 1000) })),
];

/** The height of a value on the scale in region units (a climb is up, so the y is smaller). */
function yOf(fpm: number): number {
  return ATTITUDE.cy - (fpm / VS_SCALE_MAX_FPM) * VS_HALF_HEIGHT;
}

/** A number for a transform: two decimals, never a negative zero. */
function fixed(value: number): string {
  const text = value.toFixed(2);
  return text === '-0.00' ? '0.00' : text;
}

export function VerticalSpeedScale({ verticalSpeed }: { verticalSpeed: number | undefined }) {
  const offset = verticalSpeedPointerPx(verticalSpeed);
  const cy = ATTITUDE.cy;
  const left = VS_BOX.x;
  const right = VS_BOX.x + VS_BOX.width;
  const top = cy - VS_BOX.height / 2;
  const bottom = cy + VS_BOX.height / 2;
  // Body with the arrow tip toward the tape on its left.
  const outline =
    `M ${String(left)} ${String(top)} H ${String(right)} V ${String(bottom)} H ${String(left)} ` +
    `V ${String(cy + VS_BOX.tipHalfHeight)} L ${String(left - VS_BOX.tipLength)} ${String(cy)} ` +
    `L ${String(left)} ${String(cy - VS_BOX.tipHalfHeight)} Z`;
  return (
    <g data-testid="pfd-vs">
      <rect
        data-vs-strip
        x={VS_STRIP.x}
        y={VS_STRIP.y}
        width={VS_STRIP.width}
        height={VS_STRIP.height}
        fill={TAPE_FILL}
        fill-opacity={TAPE_OPACITY}
        stroke="#3a424b"
      />
      {TICK_FPM.map((fpm) => (
        <line
          key={fpm}
          data-vs-tick
          x1={VS_STRIP.x}
          y1={yOf(fpm)}
          x2={VS_STRIP.x + (fpm % 1000 === 0 ? VS_STRIP.tickLong : VS_STRIP.tickShort)}
          y2={yOf(fpm)}
          stroke={LABEL}
          stroke-width={1}
        />
      ))}
      {NUMERALS.map((numeral) => (
        <text
          key={numeral.fpm}
          data-vs-numeral
          x={VS_STRIP.numeralX}
          y={yOf(numeral.fpm) + VS_STRIP.numeralSize / 3}
          font-size={VS_STRIP.numeralSize}
          fill={LABEL}
        >
          {numeral.text}
        </text>
      ))}
      <g data-vs-pointer transform={`translate(0 ${fixed(offset)})`}>
        <path d={outline} fill="#000000" stroke={WHITE} stroke-width={1} />
        <text
          class="glass-digits"
          data-vs-readout
          x={VS_BOX.textRight}
          y={cy + VS_BOX.textBaseline}
          text-anchor="end"
          font-size={VS_BOX.textSize}
          fill={WHITE}
        >
          {verticalSpeedReadout(verticalSpeed)}
        </text>
      </g>
    </g>
  );
}
