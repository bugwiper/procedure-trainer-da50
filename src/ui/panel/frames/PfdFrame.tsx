import {
  PFD_AIRSPEED_QUANTITY,
  PFD_LEGENDS,
  airspeedReadout,
  speedTickOffsets,
} from '../../../aircraft/da50rg/avionics';
import { CasChips } from './CasChips';
import { GlassHeader, LegendRow, SCREEN_FILL } from './MfdFrame';
import type { FrameProps } from './MfdFrame';

const SKY = '#1f6fc4';
const GROUND = '#7a5230';
const WHITE = '#ffffff';
const LABEL = '#aab3bd';

const ATT_X = 100;
const ATT_Y = 34;
const ATT_W = 295;
const ATT_H = 232;
const HORIZON_Y = ATT_Y + ATT_H / 2;
const PITCH_PX_PER_5_DEG = 22;

// Bank scale (Table D5): radius 110 about the attitude centre, ticks at these angles each side.
const BANK_R = 110;
const BANK_CY = 150;
const BANK_TICKS: readonly number[] = [10, 20, 30, 45, 60];
// Compass arc (Table D5): a semicircle of radius 66 about (247.5, 338) with 12 ticks, 15 degrees
// apart and symmetric about straight up.
const COMPASS_CX = 247.5;
const COMPASS_CY = 338;
const COMPASS_R = 66;
const COMPASS_TICKS: readonly number[] = Array.from({ length: 12 }, (_, i) => -82.5 + 15 * i);

/** Point at `deg` from straight up (clockwise) on a circle, as a path coordinate pair. */
function polar(cx: number, cy: number, r: number, deg: number): string {
  const rad = (deg * Math.PI) / 180;
  return `${(cx + r * Math.sin(rad)).toFixed(2)} ${(cy - r * Math.cos(rad)).toFixed(2)}`;
}

/**
 * PFD frame (D-04, D-11): original vector artwork with static idle values, no handlers. The glass
 * has a header strip, a content band and a 12-slot legend row (Table D4); live attitude,
 * altitude and heading arrive with PNL-04 in Phase 3; the airspeed readout and tape follow the
 * quantity airspeed_kt (the ground speed on the take-off roll, a static 140 knots elsewhere). CAS chips follow the aircraft rules (PNL-03).
 */
export function PfdFrame({ region, bridge }: FrameProps) {
  const { w, h } = region.bounds;
  const cx = ATT_X + ATT_W / 2;
  const pitchMarks = [-10, -5, 5, 10];
  const airspeed = bridge.quantities.value[PFD_AIRSPEED_QUANTITY];
  return (
    <g data-pfd pointer-events="none">
      <rect
        data-glass-zone="screen"
        x={4}
        y={4}
        width={w - 8}
        height={h - 8}
        rx={4}
        fill={SCREEN_FILL}
      />
      <GlassHeader />

      <g data-glass-zone="content">
        <g data-testid="pfd-attitude">
          <rect x={ATT_X} y={ATT_Y} width={ATT_W} height={ATT_H / 2} fill={SKY} />
          <rect x={ATT_X} y={HORIZON_Y} width={ATT_W} height={ATT_H / 2} fill={GROUND} />
          <line
            x1={ATT_X}
            y1={HORIZON_Y}
            x2={ATT_X + ATT_W}
            y2={HORIZON_Y}
            stroke={WHITE}
            stroke-width={2}
          />
          {pitchMarks.map((deg) => {
            const y = HORIZON_Y - (deg / 5) * PITCH_PX_PER_5_DEG;
            const half = Math.abs(deg) === 10 ? 40 : 22;
            return (
              <line
                key={deg}
                x1={cx - half}
                y1={y}
                x2={cx + half}
                y2={y}
                stroke={WHITE}
                stroke-width={1.5}
              />
            );
          })}
          {/* Bank scale: an arc from -60 to +60 degrees, ticks outside it and a roll pointer. */}
          <path
            d={`M ${polar(cx, BANK_CY, BANK_R, -60)} A ${BANK_R} ${BANK_R} 0 0 1 ${polar(cx, BANK_CY, BANK_R, 60)}`}
            fill="none"
            stroke={WHITE}
            stroke-width={1}
          />
          {BANK_TICKS.flatMap((deg) =>
            [-deg, deg].map((a) => (
              <path
                key={a}
                data-bank-tick={a}
                d={`M ${polar(cx, BANK_CY, BANK_R, a)} L ${polar(cx, BANK_CY, BANK_R + (deg % 30 === 0 || deg === 45 ? 9 : 6), a)}`}
                fill="none"
                stroke={WHITE}
                stroke-width={1}
              />
            )),
          )}
          <path
            data-roll-pointer
            d={`M ${cx} ${BANK_CY - BANK_R + 2} L ${cx - 5} ${BANK_CY - BANK_R + 10} L ${cx + 5} ${BANK_CY - BANK_R + 10} Z`}
            fill="#f2c230"
          />
          {/* Fixed aircraft symbol. */}
          <path
            d={`M ${cx - 60} ${HORIZON_Y + 6} l 40 0 l 20 -12 l 20 12 l 40 0`}
            fill="none"
            stroke="#f2c230"
            stroke-width={4}
            stroke-linejoin="round"
          />
          <rect
            x={ATT_X}
            y={ATT_Y}
            width={ATT_W}
            height={ATT_H}
            fill="none"
            stroke="#3a424b"
            stroke-width={1.5}
          />
        </g>

        {/* Annunciations: derived from the aircraft CAS rules, drawn over the attitude art. */}
        <CasChips active={bridge.cas.value} />

        <g data-testid="pfd-airspeed">
          <rect x={10} y={ATT_Y} width={80} height={ATT_H} fill="#12181e" stroke="#3a424b" />
          {/* The ticks wrap inside the band; the tape moves with the speed (ground speed on the roll). */}
          {speedTickOffsets(airspeed).map((offset, i) => (
            <line
              key={i}
              x1={74}
              y1={ATT_Y + 9 + offset}
              x2={90}
              y2={ATT_Y + 9 + offset}
              stroke={LABEL}
              stroke-width={1.5}
            />
          ))}
          <rect x={10} y={HORIZON_Y - 16} width={64} height={32} fill="#000000" stroke={WHITE} />
          <text
            class="glass-digits"
            data-airspeed-readout
            x={66}
            y={HORIZON_Y + 8}
            text-anchor="end"
            font-size={14}
            fill={WHITE}
          >
            {String(airspeedReadout(airspeed))}
          </text>
          <text x={50} y={276} text-anchor="middle" font-size={8} fill={LABEL}>
            KT
          </text>
        </g>

        <g data-testid="pfd-altitude">
          <rect x={405} y={ATT_Y} width={80} height={ATT_H} fill="#12181e" stroke="#3a424b" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <line
              key={i}
              x1={405}
              y1={ATT_Y + 24 + i * 30}
              x2={421}
              y2={ATT_Y + 24 + i * 30}
              stroke={LABEL}
              stroke-width={1.5}
            />
          ))}
          <rect x={411} y={HORIZON_Y - 16} width={74} height={32} fill="#000000" stroke={WHITE} />
          <text
            class="glass-digits"
            x={480}
            y={HORIZON_Y + 8}
            text-anchor="end"
            font-size={14}
            fill={WHITE}
          >
            1400
          </text>
          <text x={445} y={276} text-anchor="middle" font-size={8} fill={LABEL}>
            FT
          </text>
        </g>

        {/* Compass arc, drawn first so the heading block reads on top of it. */}
        <g>
          <path
            data-compass-arc
            d={`M ${polar(COMPASS_CX, COMPASS_CY, COMPASS_R, -90)} A ${COMPASS_R} ${COMPASS_R} 0 0 1 ${polar(COMPASS_CX, COMPASS_CY, COMPASS_R, 90)}`}
            fill="none"
            stroke={LABEL}
            stroke-width={1.5}
          />
          {COMPASS_TICKS.map((a) => (
            <path
              key={a}
              data-compass-tick={a}
              d={`M ${polar(COMPASS_CX, COMPASS_CY, COMPASS_R, a)} L ${polar(COMPASS_CX, COMPASS_CY, COMPASS_R - 6, a)}`}
              fill="none"
              stroke={LABEL}
              stroke-width={1.5}
            />
          ))}
        </g>

        <g data-testid="pfd-heading">
          {/* A transparent box: the compass ticks show through it. */}
          <rect x={170} y={276} width={155} height={60} rx={6} fill="none" stroke="none" />
          <rect x={218} y={282} width={60} height={26} fill="#000000" stroke={WHITE} />
          <text
            class="glass-digits"
            x={248}
            y={302}
            text-anchor="middle"
            font-size={14}
            fill={WHITE}
          >
            360
          </text>
          <text x={248} y={328} text-anchor="middle" font-size={10} fill={LABEL}>
            HDG
          </text>
        </g>

        {/* Inset map: an empty frame with no map content. */}
        <rect data-inset-map x={6} y={280} width={90} height={60} fill="#0e1a14" stroke="#3a424b" />

        {/* Barometer setting box. */}
        <rect x={405} y={280} width={80} height={20} fill="#12181e" stroke="#3a424b" />
        <text x={445} y={293.5} text-anchor="middle" font-size={6} fill={WHITE}>
          1013 HPA
        </text>
      </g>

      <LegendRow display="pfd" legends={PFD_LEGENDS} selectedSlot={-1} />
    </g>
  );
}
