import { mulberry32 } from '../../../engine/sim';
import { SCENE_CENTRE_X } from './geometry';

// Oil streaks on the windscreen (Phase 5, C-06): dark translucent streaks that the airflow runs
// back over the glass from the nose, fanning out to both sides. Pure component of the oil_streaks
// level (0 to 1): count and opacity follow the level, positions come from a fixed table (mulberry32
// with a fixed seed at module load, no randomness at render). One stroked path, flat vector with no
// paint reference, no text (G-0).

/** Streaks in the table: the full level draws all of them. */
export const OIL_TABLE_SIZE = 16;

/** The most opaque the streaks get: the view stays readable through them. */
export const OIL_MAX_OPACITY = 0.75;

/** Where the streaks start: over the cowl, about the middle of the nose, in panel space. */
const ORIGIN = { x: SCENE_CENTRE_X, y: -20 } as const;

function streakTable(): readonly string[] {
  const next = mulberry32(31_337);
  const table: string[] = [];
  for (let i = 0; i < OIL_TABLE_SIZE; i++) {
    // The side alternates, so a low level already smears both halves; the spread grows with the draw.
    const side = i % 2 === 0 ? -1 : 1;
    const x0 = Math.round(ORIGIN.x + side * (30 + next() * 330));
    const reach = Math.round(150 + next() * 230);
    const drift = Math.round(side * (60 + next() * 240));
    const y1 = ORIGIN.y - reach;
    table.push(
      `M${String(x0)} ${String(ORIGIN.y)}C${String(x0)} ${String(ORIGIN.y - reach / 2)} ${String(x0 + drift / 2)} ${String(y1 + reach / 4)} ${String(x0 + drift)} ${String(y1)}`,
    );
  }
  return table;
}

const TABLE = streakTable();

/** The streaks drawn at a level: it grows with the level, at least one while visible. */
export function oilStreakCount(level: number): number {
  return Math.ceil(level * OIL_TABLE_SIZE);
}

/** Opacity of the streaks from the level. */
export function oilOpacity(level: number): number {
  return OIL_MAX_OPACITY * level;
}

/** The streaks over the glass; drawn only while the level is visible (the layer decides). */
export function OilStreaks({ level }: { level: number }) {
  return (
    <g data-cue="oil_streaks" data-level={level} data-streaks={oilStreakCount(level)}>
      <path
        d={TABLE.slice(0, oilStreakCount(level)).join('')}
        fill="none"
        stroke="#2b1d12"
        stroke-width={12}
        stroke-linecap="round"
        stroke-opacity={oilOpacity(level)}
      />
    </g>
  );
}
