import {
  EFIS_ALTITUDE_TAPE,
  EFIS_SPEED_TAPE,
  STANDBY_EFIS,
} from '../../../aircraft/da50rg/avionics';
import type { UnitRect } from '../../../aircraft/da50rg/avionics';
import { ColumnPart } from './BezelColumnFrame';
import type { FrameProps } from './MfdFrame';
import { HousingRect, UnitGroup } from './UnitHousing';

// Backup EFIS art (phase 01.2 plan 08, D-06): a bezelled unit with a small attitude display, a
// tape display and one plain round knob with no markings. Static artwork with idle values, hook-free, no
// handler, no hit rectangle, no control id. Content and sizes are proposals (U-18). Colours repeat
// the PFD frame's sky, ground and symbol literals; the PFD component itself is not imported.

const SKY = '#1f6fc4';
const GROUND = '#7a5230';
const WHITE = '#ffffff';
const SYMBOL = '#f2c230';
const LABEL = '#aab3bd';
const SCREEN = '#05080b';
const TAPE_FILL = '#12181e';
const EDGE = '#3a424b';
const SPEED_BAR = '#2fd36f';
const FONT = 'B612, system-ui, sans-serif';

/** Rounded to two decimals so path strings stay short and stable. */
const n = (value: number): string => String(Math.round(value * 100) / 100);

/** Point at `deg` from straight up (clockwise) on a circle, as a path coordinate pair. */
function polar(cx: number, cy: number, r: number, deg: number): string {
  const rad = (deg * Math.PI) / 180;
  return `${n(cx + r * Math.sin(rad))} ${n(cy - r * Math.cos(rad))}`;
}

// Attitude display, 92 x 116 in its own space: horizon at mid height, roll arc about (46, 64).
const ROLL_CX = 46;
const ROLL_CY = 64;
const ROLL_R = 40;
const ROLL_TICKS: readonly number[] = [10, 20, 30, 45];

function rollTicksPath(): string {
  const parts: string[] = [];
  for (const deg of ROLL_TICKS) {
    for (const a of [-deg, deg]) {
      const outer = ROLL_R + (deg % 30 === 0 || deg === 45 ? 5 : 3);
      parts.push(`M ${polar(ROLL_CX, ROLL_CY, ROLL_R, a)} L ${polar(ROLL_CX, ROLL_CY, outer, a)}`);
    }
  }
  return parts.join(' ');
}

function AttitudeDisplay({ r }: { r: UnitRect }) {
  const mid = r.h / 2;
  // Pitch ticks at plus and minus 5 and 10 degrees (8 units per 5 degrees), one path.
  const pitch = [-16, -8, 8, 16]
    .map((dy) => {
      const half = Math.abs(dy) === 16 ? 14 : 8;
      return `M ${n(r.w / 2 - half)} ${n(mid + dy)} H ${n(r.w / 2 + half)}`;
    })
    .join(' ');
  return (
    <g data-efis-display="attitude" transform={`translate(${r.x} ${r.y})`}>
      <rect x={0} y={0} width={r.w} height={mid} fill={SKY} />
      <rect x={0} y={mid} width={r.w} height={mid} fill={GROUND} />
      <path
        data-efis-horizon
        d={`M 0 ${mid} H ${r.w}`}
        fill="none"
        stroke={WHITE}
        stroke-width={1}
      />
      <path data-efis-pitch d={pitch} fill="none" stroke={WHITE} stroke-width={1} />
      <path
        data-efis-roll-arc
        d={`M ${polar(ROLL_CX, ROLL_CY, ROLL_R, -50)} A ${ROLL_R} ${ROLL_R} 0 0 1 ${polar(ROLL_CX, ROLL_CY, ROLL_R, 50)}`}
        fill="none"
        stroke={WHITE}
        stroke-width={1}
      />
      <path data-efis-roll-ticks d={rollTicksPath()} fill="none" stroke={WHITE} stroke-width={1} />
      <path d={`M ${ROLL_CX} ${ROLL_CY - ROLL_R + 2} l -3 6 h 6 z`} fill={SYMBOL} />
      <path
        data-efis-symbol
        d={`M 26 ${mid + 4} h 14 l 6 -6 l 6 6 h 14`}
        fill="none"
        stroke={SYMBOL}
        stroke-width={2}
        stroke-linejoin="round"
      />
      <rect x={0} y={0} width={r.w} height={r.h} fill="none" stroke={EDGE} stroke-width={1} />
    </g>
  );
}

// Tape display, 92 x 116: labels, readout boxes, two tapes of five numerals, the BARO box.
const TAPE_TOP = 30;
const TAPE_H = 62;
const ROW_FIRST = 41;
const ROW_PITCH = 12;

function TapeDisplay({ r }: { r: UnitRect }) {
  const rows = [0, 1, 2, 3, 4].map((i) => ROW_FIRST + ROW_PITCH * i);
  const speedTicks = rows.map((y) => `M 24 ${n(y - 2.1)} H 29`).join(' ');
  const altTicks = rows.map((y) => `M 59 ${n(y - 2.1)} H 64`).join(' ');
  return (
    <g data-efis-display="tape" transform={`translate(${r.x} ${r.y})`}>
      <rect x={0} y={0} width={r.w} height={r.h} fill={SCREEN} stroke={EDGE} stroke-width={1} />
      <text x={18} y={10} text-anchor="middle" font-family={FONT} font-size={6} fill={LABEL}>
        KTS
      </text>
      <text x={74} y={10} text-anchor="middle" font-family={FONT} font-size={6} fill={LABEL}>
        FEET
      </text>
      {/* Readout boxes with the idle values. */}
      <rect x={4} y={14} width={28} height={12} fill="#000000" stroke={WHITE} stroke-width={0.8} />
      <text class="glass-digits" x={29} y={24} text-anchor="end" font-size={8} fill={WHITE}>
        0
      </text>
      <rect x={58} y={14} width={30} height={12} fill="#000000" stroke={WHITE} stroke-width={0.8} />
      <text class="glass-digits" x={85} y={24} text-anchor="end" font-size={8} fill={WHITE}>
        1400
      </text>
      {/* Speed tape: numerals, ticks and the 3 wide green bar. */}
      <rect
        x={4}
        y={TAPE_TOP}
        width={29}
        height={TAPE_H}
        fill={TAPE_FILL}
        stroke={EDGE}
        stroke-width={0.8}
      />
      <rect
        data-efis-speed-bar
        x={30}
        y={TAPE_TOP + 2}
        width={3}
        height={TAPE_H - 4}
        fill={SPEED_BAR}
      />
      <path d={speedTicks} fill="none" stroke={LABEL} stroke-width={1} />
      {EFIS_SPEED_TAPE.map((value, i) => (
        <text
          key={value}
          class="glass-digits"
          x={22}
          y={rows[i]}
          text-anchor="end"
          font-size={6}
          fill={WHITE}
        >
          {value}
        </text>
      ))}
      {/* Altitude tape. */}
      <rect
        x={59}
        y={TAPE_TOP}
        width={29}
        height={TAPE_H}
        fill={TAPE_FILL}
        stroke={EDGE}
        stroke-width={0.8}
      />
      <path d={altTicks} fill="none" stroke={LABEL} stroke-width={1} />
      {EFIS_ALTITUDE_TAPE.map((value, i) => (
        <text
          key={value}
          class="glass-digits"
          x={66}
          y={rows[i]}
          text-anchor="start"
          font-size={6}
          fill={WHITE}
        >
          {value}
        </text>
      ))}
      {/* Barometer box. */}
      <rect
        x={16}
        y={98}
        width={60}
        height={12}
        fill={TAPE_FILL}
        stroke={EDGE}
        stroke-width={0.8}
      />
      <text x={20} y={106.5} text-anchor="start" font-family={FONT} font-size={6} fill={LABEL}>
        BARO
      </text>
      <text class="glass-digits" x={72} y={106.5} text-anchor="end" font-size={6} fill={WHITE}>
        1013
      </text>
    </g>
  );
}

export function StandbyEfisFrame({ region }: FrameProps) {
  const { housing, upper, lower, knob } = STANDBY_EFIS;
  return (
    <UnitGroup id={region.id}>
      <HousingRect x={housing.x} y={housing.y} w={housing.w} h={housing.h} />
      <AttitudeDisplay r={upper} />
      <TapeDisplay r={lower} />
      <ColumnPart e={knob} />
    </UnitGroup>
  );
}
