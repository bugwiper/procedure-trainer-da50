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

/**
 * PFD frame (D-04, D-11): original vector artwork with static idle values, no handlers.
 * Live attitude, speed, altitude and heading arrive with PNL-04 in Phase 3.
 */
export function PfdFrame({ region }: FrameProps) {
  const { w, h } = region.bounds;
  const cx = ATT_X + ATT_W / 2;
  const pitchMarks = [-10, -5, 5, 10];
  return (
    <g data-pfd pointer-events="none">
      <rect x={4} y={4} width={w - 8} height={h - 8} rx={4} fill="#05080b" />

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

      <g data-testid="pfd-airspeed">
        <rect x={10} y={ATT_Y} width={80} height={ATT_H} fill="#12181e" stroke="#3a424b" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <line
            key={i}
            x1={74}
            y1={ATT_Y + 24 + i * 30}
            x2={90}
            y2={ATT_Y + 24 + i * 30}
            stroke={LABEL}
            stroke-width={1.5}
          />
        ))}
        <rect x={10} y={HORIZON_Y - 16} width={64} height={32} fill="#000000" stroke={WHITE} />
        <text
          class="glass-digits"
          x={66}
          y={HORIZON_Y + 8}
          text-anchor="end"
          font-size={22}
          fill={WHITE}
        >
          0
        </text>
        <text x={50} y={ATT_Y - 6} text-anchor="middle" font-size={10} fill={LABEL}>
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
          font-size={22}
          fill={WHITE}
        >
          1400
        </text>
        <text x={445} y={ATT_Y - 6} text-anchor="middle" font-size={10} fill={LABEL}>
          FT
        </text>
      </g>

      <g data-testid="pfd-heading">
        <rect x={170} y={290} width={155} height={60} rx={6} fill="#12181e" stroke="#3a424b" />
        <rect x={218} y={296} width={60} height={26} fill="#000000" stroke={WHITE} />
        <text class="glass-digits" x={248} y={316} text-anchor="middle" font-size={20} fill={WHITE}>
          360
        </text>
        <text x={248} y={342} text-anchor="middle" font-size={10} fill={LABEL}>
          HDG
        </text>
      </g>
    </g>
  );
}
