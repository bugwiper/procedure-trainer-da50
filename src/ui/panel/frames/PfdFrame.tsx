import {
  PFD_AIRSPEED_QUANTITY,
  PFD_ALTITUDE_QUANTITY,
  PFD_BANK_QUANTITY,
  PFD_LEGENDS,
  PFD_PITCH_QUANTITY,
  PFD_QNH_QUANTITY,
  PFD_VERTICAL_SPEED_QUANTITY,
  PITCH_LADDER_MAX_DEG,
  PITCH_LADDER_STEP_DEG,
  PITCH_LADDER_STEP_PX,
  airspeedReadout,
  altitudeReadout,
  altitudeTickOffsets,
  horizonRotationDeg,
  pitchShiftPx,
  qnhReadout,
  speedTickOffsets,
} from '../../../aircraft/da50rg/avionics';
import { DEFAULT_SCENE } from '../../../aircraft/da50rg/scenes';
import {
  ALTITUDE_READOUT,
  ALTITUDE_TAPE,
  ATTITUDE,
  COMPASS,
  FT_LABEL,
  HEADING_BOX,
  HEADING_FRAME,
  INSET_MAP,
  KT_LABEL,
  PFD_ZONE,
  QNH_READOUT,
  SPEED_READOUT,
  SPEED_TAPE,
  TAPE_OPACITY,
} from '../../../aircraft/da50rg/pfd-layout';
import { CasChips } from './CasChips';
import {
  GLASS_TURQUOISE,
  GlassHeader,
  LegendRow,
  SCREEN_FILL,
  glassSecondRowLive,
} from './MfdFrame';
import type { FrameProps } from './MfdFrame';
import { SyntheticVision } from './SyntheticVision';
import { VerticalSpeedScale } from './VerticalSpeedScale';

const WHITE = '#ffffff';
/** The dark glass of the tapes (translucent by TAPE_OPACITY) and of the compass backing. */
const TAPE_FILL = '#12181e';
const BACKING_FILL = '#080b0e';
const LABEL = '#aab3bd';

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
const COMPASS_CX = COMPASS.cx;
const COMPASS_CY = COMPASS.cy;
const COMPASS_R = COMPASS.r;
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
  const qnh = bridge.quantities.value[PFD_QNH_QUANTITY];
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
          <rect
            x={SPEED_TAPE.x}
            y={SPEED_TAPE.y}
            width={SPEED_TAPE.width}
            height={SPEED_TAPE.height}
            fill={TAPE_FILL}
            fill-opacity={TAPE_OPACITY}
            stroke="#3a424b"
          />
          {/* The ticks wrap inside the band; the tape moves with the speed (ground speed on the roll). */}
          {speedTickOffsets(airspeed).map((offset, i) => (
            <line
              key={i}
              x1={SPEED_TAPE.tickX1}
              y1={SPEED_TAPE.y + SPEED_TAPE.tickTop + offset}
              x2={SPEED_TAPE.tickX2}
              y2={SPEED_TAPE.y + SPEED_TAPE.tickTop + offset}
              stroke={LABEL}
              stroke-width={1.5}
            />
          ))}
          <rect
            x={SPEED_READOUT.x}
            y={SPEED_READOUT.y}
            width={SPEED_READOUT.width}
            height={SPEED_READOUT.height}
            fill="#000000"
            stroke={WHITE}
          />
          <text
            class="glass-digits"
            data-airspeed-readout
            x={SPEED_READOUT.textRight}
            y={HORIZON_Y + SPEED_READOUT.textBaseline}
            text-anchor="end"
            font-size={SPEED_READOUT.textSize}
            fill={WHITE}
          >
            {String(airspeedReadout(airspeed))}
          </text>
          <text
            x={KT_LABEL.x}
            y={KT_LABEL.y}
            text-anchor="middle"
            font-size={8}
            fill={LABEL}
            stroke={TAPE_FILL}
            stroke-width={2}
            paint-order="stroke"
          >
            KT
          </text>
        </g>

        <g data-testid="pfd-altitude">
          <rect
            x={ALTITUDE_TAPE.x}
            y={ALTITUDE_TAPE.y}
            width={ALTITUDE_TAPE.width}
            height={ALTITUDE_TAPE.height}
            fill={TAPE_FILL}
            fill-opacity={TAPE_OPACITY}
            stroke="#3a424b"
          />
          {/* The ticks wrap inside the band; the tape moves with the altitude, 100 ft per 30 px. */}
          {altitudeTickOffsets(altitude).map((offset, i) => (
            <line
              key={i}
              x1={ALTITUDE_TAPE.x}
              y1={ALTITUDE_TAPE.y + ALTITUDE_TAPE.tickTop + offset}
              x2={ALTITUDE_TAPE.x + ALTITUDE_TAPE.tickLength}
              y2={ALTITUDE_TAPE.y + ALTITUDE_TAPE.tickTop + offset}
              stroke={LABEL}
              stroke-width={1.5}
            />
          ))}
          <rect
            x={ALTITUDE_READOUT.x}
            y={ALTITUDE_READOUT.y}
            width={ALTITUDE_READOUT.width}
            height={ALTITUDE_READOUT.height}
            fill="#000000"
            stroke={WHITE}
          />
          <text
            class="glass-digits"
            data-altitude-readout
            x={ALTITUDE_READOUT.textRight}
            y={HORIZON_Y + ALTITUDE_READOUT.textBaseline}
            text-anchor="end"
            font-size={ALTITUDE_READOUT.textSize}
            fill={WHITE}
          >
            {String(altitudeReadout(altitude))}
          </text>
          <text
            x={FT_LABEL.x}
            y={FT_LABEL.y}
            text-anchor="middle"
            font-size={8}
            fill={LABEL}
            stroke={TAPE_FILL}
            stroke-width={2}
            paint-order="stroke"
          >
            FT
          </text>
        </g>

        {/* The vertical speed scale right of the altitude tape (Phase 6.1, D-11). */}
        <VerticalSpeedScale verticalSpeed={verticalSpeed} />

        {/* Compass arc, drawn first so the heading block reads on top of it. A translucent dark half
            disc lies under it so that the ticks read on the synthetic vision (D-10). */}
        <g>
          <path
            data-compass-backing
            d={`M ${polar(COMPASS_CX, COMPASS_CY, COMPASS.backingR, -90)} A ${COMPASS.backingR} ${COMPASS.backingR} 0 0 1 ${polar(COMPASS_CX, COMPASS_CY, COMPASS.backingR, 90)} Z`}
            fill={BACKING_FILL}
            fill-opacity={COMPASS.backingOpacity}
            stroke="none"
          />
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
          <rect
            x={HEADING_FRAME.x}
            y={HEADING_FRAME.y}
            width={HEADING_FRAME.width}
            height={HEADING_FRAME.height}
            rx={6}
            fill="none"
            stroke="none"
          />
          <rect
            x={HEADING_BOX.x}
            y={HEADING_BOX.y}
            width={HEADING_BOX.width}
            height={HEADING_BOX.height}
            fill="#000000"
            stroke={WHITE}
          />
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
        <rect
          data-inset-map
          x={INSET_MAP.x}
          y={INSET_MAP.y}
          width={INSET_MAP.width}
          height={INSET_MAP.height}
          fill="#0e1a14"
          stroke="#3a424b"
        />

        {/* The barometer setting under the altitude tape (Phase 6.1, D-12): the value follows the
            static quantity qnh_hpa, the unit label is static (G-0). Display only. */}
        <text
          class="glass-digits"
          data-qnh-readout
          x={QNH_READOUT.valueRight}
          y={QNH_READOUT.baseline}
          text-anchor="end"
          font-size={QNH_READOUT.valueSize}
          fill={GLASS_TURQUOISE}
          stroke={BACKING_FILL}
          stroke-width={1.5}
          paint-order="stroke"
        >
          {String(qnhReadout(qnh))}
        </text>
        <text
          x={QNH_READOUT.unitX}
          y={QNH_READOUT.baseline}
          font-size={QNH_READOUT.unitSize}
          fill={GLASS_TURQUOISE}
          stroke={BACKING_FILL}
          stroke-width={1.5}
          paint-order="stroke"
        >
          HPA
        </text>

        {/* Annunciations: derived from the aircraft CAS rules, one column at the lower right, drawn
            last so nothing covers it. */}
        <CasChips active={bridge.cas.value} />
      </g>

      <LegendRow display="pfd" legends={PFD_LEGENDS} selectedSlot={-1} />
    </g>
  );
}
