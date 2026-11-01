import {
  PFD_AIRSPEED_QUANTITY,
  PFD_ALTITUDE_QUANTITY,
  PFD_BANK_QUANTITY,
  PFD_LEGENDS,
  PFD_PITCH_QUANTITY,
  PFD_VERTICAL_SPEED_QUANTITY,
  PITCH_LADDER_MAX_DEG,
  PITCH_LADDER_STEP_DEG,
  PITCH_LADDER_STEP_PX,
  airspeedReadout,
  altitudeReadout,
  altitudeTickOffsets,
  horizonRotationDeg,
  pitchShiftPx,
  speedTickOffsets,
  verticalSpeedText,
} from '../../../aircraft/da50rg/avionics';
import { DEFAULT_SCENE } from '../../../aircraft/da50rg/scenes';
import { ALTITUDE_BLOCK, ATTITUDE, PFD_ZONE } from '../../../aircraft/da50rg/pfd-layout';
import { CasChips } from './CasChips';
import { GlassHeader, LegendRow, SCREEN_FILL, glassSecondRowLive } from './MfdFrame';
import type { FrameProps } from './MfdFrame';
import { SyntheticVision } from './SyntheticVision';

const WHITE = '#ffffff';
const LABEL = '#aab3bd';

const ATT_Y = 34;
const ATT_H = 232;
const HORIZON_Y = ATTITUDE.cy;
const HORIZON_REACH = ATTITUDE.reach;
/** The pitch ladder: a line every 5 degrees, a long one every 10, to 30 degrees each side. */
const LADDER_DEGREES: readonly number[] = Array.from(
  { length: (2 * PITCH_LADDER_MAX_DEG) / PITCH_LADDER_STEP_DEG + 1 },
  (_, i) => -PITCH_LADDER_MAX_DEG + i * PITCH_LADDER_STEP_DEG,
).filter((deg) => deg !== 0);
const ATTITUDE_CLIP_ID = 'pfd-attitude-clip';

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

/** A number for a transform: two decimals, never a negative zero (a level horizon is the identity). */
function fixed(value: number): string {
  const text = value.toFixed(2);
  return text === '-0.00' ? '0.00' : text;
}

/** Point at `deg` from straight up (clockwise) on a circle, as a path coordinate pair. */
function polar(cx: number, cy: number, r: number, deg: number): string {
  const rad = (deg * Math.PI) / 180;
  return `${(cx + r * Math.sin(rad)).toFixed(2)} ${(cy - r * Math.cos(rad)).toFixed(2)}`;
}

/**
 * PFD frame (D-04, D-11): original vector artwork with static idle values, no handlers. The glass
 * has a header strip, a content band and a 12-slot legend row (Table D4); the airspeed, altitude
 * and vertical speed readouts and the tapes follow simulated quantities (Phase 6, plan 03), and
 * show the static base values on the free panel; heading stays static. CAS chips follow the
 * aircraft rules (PNL-03).
 */
export function PfdFrame({ region, bridge, session }: FrameProps) {
  const { w, h } = region.bounds;
  const cx = ATTITUDE.cx;
  // The scene of the situation (the ?scene= flag on the free panel); SyntheticVision falls back to
  // the default scene for an id the art does not know. Reading the signal subscribes this frame.
  const scene = session?.scene.value ?? DEFAULT_SCENE;
  const airspeed = bridge.quantities.value[PFD_AIRSPEED_QUANTITY];
  const altitude = bridge.quantities.value[PFD_ALTITUDE_QUANTITY];
  const verticalSpeed = bridge.quantities.value[PFD_VERTICAL_SPEED_QUANTITY];
  // The horizon group moves down by the pitch and turns by minus the bank about the attitude centre
  // (the numbers pass through toFixed, never as raw strings). The roll pointer turns with it.
  const shift = pitchShiftPx(bridge.quantities.value[PFD_PITCH_QUANTITY]);
  const roll = horizonRotationDeg(bridge.quantities.value[PFD_BANK_QUANTITY]);
  const rotation = `rotate(${fixed(roll)} ${fixed(cx)} ${fixed(HORIZON_Y)})`;
  const horizonTransform = `${rotation} translate(0 ${fixed(shift)})`;
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
      <GlassHeader secondRowLive={glassSecondRowLive(bridge)} />

      <g data-glass-zone="content">
        <g data-testid="pfd-attitude">
          <clipPath id={ATTITUDE_CLIP_ID}>
            <rect
              x={PFD_ZONE.x0}
              y={PFD_ZONE.y0}
              width={PFD_ZONE.x1 - PFD_ZONE.x0}
              height={PFD_ZONE.y1 - PFD_ZONE.y0}
            />
          </clipPath>
          <g clip-path={`url(#${ATTITUDE_CLIP_ID})`}>
            {/* One group: the synthetic vision, horizon line and pitch ladder move and turn together. */}
            <g data-horizon transform={horizonTransform}>
              <SyntheticVision scene={scene} cx={cx} cy={HORIZON_Y} reach={HORIZON_REACH} />
              <line
                x1={cx - HORIZON_REACH}
                y1={HORIZON_Y}
                x2={cx + HORIZON_REACH}
                y2={HORIZON_Y}
                stroke={WHITE}
                stroke-width={2}
              />
              {LADDER_DEGREES.map((deg) => {
                const y = HORIZON_Y - (deg / PITCH_LADDER_STEP_DEG) * PITCH_LADDER_STEP_PX;
                const half = deg % 10 === 0 ? 40 : 22;
                return (
                  <line
                    key={deg}
                    data-pitch-mark={deg}
                    x1={cx - half}
                    y1={y}
                    x2={cx + half}
                    y2={y}
                    stroke={WHITE}
                    stroke-width={1.5}
                  />
                );
              })}
            </g>
          </g>
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
          <g transform={`rotate(${fixed(roll)} ${fixed(cx)} ${fixed(BANK_CY)})`}>
            <path
              data-roll-pointer
              d={`M ${cx} ${BANK_CY - BANK_R + 2} L ${cx - 5} ${BANK_CY - BANK_R + 10} L ${cx + 5} ${BANK_CY - BANK_R + 10} Z`}
              fill="#f2c230"
            />
          </g>
          {/* Fixed aircraft symbol. */}
          <path
            d={`M ${cx - 60} ${HORIZON_Y + 6} l 40 0 l 20 -12 l 20 12 l 40 0`}
            fill="none"
            stroke="#f2c230"
            stroke-width={4}
            stroke-linejoin="round"
          />
        </g>

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
          <rect
            x={ALTITUDE_BLOCK.x}
            y={ATT_Y}
            width={80}
            height={ATT_H}
            fill="#12181e"
            stroke="#3a424b"
          />
          {/* The ticks wrap inside the band; the tape moves with the altitude, 100 ft per 30 px. */}
          {altitudeTickOffsets(altitude).map((offset, i) => (
            <line
              key={i}
              x1={ALTITUDE_BLOCK.x}
              y1={ATT_Y + 9 + offset}
              x2={ALTITUDE_BLOCK.x + 16}
              y2={ATT_Y + 9 + offset}
              stroke={LABEL}
              stroke-width={1.5}
            />
          ))}
          <rect
            x={ALTITUDE_BLOCK.x + 6}
            y={HORIZON_Y - 16}
            width={74}
            height={32}
            fill="#000000"
            stroke={WHITE}
          />
          <text
            class="glass-digits"
            data-altitude-readout
            x={ALTITUDE_BLOCK.x + 75}
            y={HORIZON_Y + 8}
            text-anchor="end"
            font-size={14}
            fill={WHITE}
          >
            {String(altitudeReadout(altitude))}
          </text>
          <text x={ALTITUDE_BLOCK.x + 40} y={276} text-anchor="middle" font-size={8} fill={LABEL}>
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
        <rect
          data-baro-box
          x={ALTITUDE_BLOCK.x}
          y={280}
          width={80}
          height={20}
          fill="#12181e"
          stroke="#3a424b"
        />
        <text x={ALTITUDE_BLOCK.x + 40} y={293.5} text-anchor="middle" font-size={6} fill={WHITE}>
          1013 HPA
        </text>

        {/* Vertical speed box under the barometer box: the label VS is static, the number follows
            the quantity (a text that changes by value, never by control state). */}
        <rect
          data-vs-box
          x={ALTITUDE_BLOCK.x}
          y={304}
          width={80}
          height={20}
          fill="#12181e"
          stroke="#3a424b"
        />
        <text x={ALTITUDE_BLOCK.x + 6} y={317.5} font-size={6} fill={LABEL}>
          VS
        </text>
        <text
          class="glass-digits"
          data-vs-readout
          x={ALTITUDE_BLOCK.x + 75}
          y={318}
          text-anchor="end"
          font-size={10}
          fill={WHITE}
        >
          {verticalSpeedText(verticalSpeed)}
        </text>

        {/* Annunciations: derived from the aircraft CAS rules, one column at the lower right, drawn
            last so nothing covers it. */}
        <CasChips active={bridge.cas.value} />
      </g>

      <LegendRow display="pfd" legends={PFD_LEGENDS} selectedSlot={-1} />
    </g>
  );
}
