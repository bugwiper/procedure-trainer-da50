import { cueVisible } from '../../../engine/cues';
import { mulberry32 } from '../../../engine/sim';
import { OPENING, SCENE_CENTRE_X } from './geometry';

// Ice on the windscreen and the WIND SHIELD spray (Phase 5, C-04, C-05). Pure component of two cue
// levels (0 to 1; the pilot half is the left one, as in the photo of the owner) and the spray flag.
// Each half is clipped to its side of the strut: a milky veil that thickens with the level, frost
// at the edges and a growing number of crystals. The crystals are one stroked path per half, built
// from a fixed table (mulberry32 with a fixed seed at module load, no randomness at render, so a
// render is a function of the level). The spray draws pale streaks running upward over the pilot
// half (the airflow carries the fluid upward, there are no wipers) while the flag is set; the
// streaks move with a CSS animation of stage.css that stops under reduced motion. Flat vector with
// its own `w-` paints, no filter, no text (G-0).

/** The most opaque the milky veil gets: the scene stays faintly visible through full ice. */
export const VEIL_MAX_OPACITY = 0.7;

/** Crystals in the table of one half: the full level draws all of them. */
export const CRYSTAL_TABLE_SIZE = 70;

/** Streaks of the spray over the pilot half. */
export const SPRAY_STREAKS = 14;

const SIDE_TOP = OPENING.y;
const SIDE_BOTTOM = OPENING.y + OPENING.h;
/** The pilot half runs from the left edge to the strut; the co-pilot half from the strut to the right. */
const HALVES = {
  pilot: { x: 0, w: SCENE_CENTRE_X },
  copilot: { x: SCENE_CENTRE_X, w: OPENING.w - SCENE_CENTRE_X },
} as const;

type Side = keyof typeof HALVES;

interface Crystal {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** 0: three arms at 60 degrees, 1: four arms at 45 degrees. */
  readonly shape: 0 | 1;
}

/** The fixed crystal table of a half: spread over the half, sizes 6 to 20. */
function crystalTable(side: Side, seed: number): readonly Crystal[] {
  const next = mulberry32(seed);
  const half = HALVES[side];
  const table: Crystal[] = [];
  for (let i = 0; i < CRYSTAL_TABLE_SIZE; i++) {
    table.push({
      x: Math.round(half.x + 140 + next() * (half.w - 280)),
      y: Math.round(SIDE_TOP + 60 + next() * (SIDE_BOTTOM - SIDE_TOP - 100)),
      r: Math.round(6 + next() * 14),
      shape: next() < 0.5 ? 0 : 1,
    });
  }
  return table;
}

const TABLES: Readonly<Record<Side, readonly Crystal[]>> = {
  pilot: crystalTable('pilot', 50_211),
  copilot: crystalTable('copilot', 71_807),
};

/** Half the width of an arm at 60 and 45 degrees: the cosine and sine of the arm angles, as constants. */
const ARM = { c60: 0.5, s60: 0.866, c45: 0.707 } as const;

function crystalPath(c: Crystal): string {
  const { x, y, r } = c;
  const f = (v: number): number => Math.round(v);
  if (c.shape === 0) {
    const a = f(r * ARM.c60);
    const b = f(r * ARM.s60);
    return `M${String(x - r)} ${String(y)}L${String(x + r)} ${String(y)}M${String(x - a)} ${String(y - b)}L${String(x + a)} ${String(y + b)}M${String(x - a)} ${String(y + b)}L${String(x + a)} ${String(y - b)}`;
  }
  const d = f(r * ARM.c45);
  return `M${String(x - r)} ${String(y)}L${String(x + r)} ${String(y)}M${String(x)} ${String(y - r)}L${String(x)} ${String(y + r)}M${String(x - d)} ${String(y - d)}L${String(x + d)} ${String(y + d)}M${String(x - d)} ${String(y + d)}L${String(x + d)} ${String(y - d)}`;
}

/** The number of crystals drawn at a level: it grows with the level, at least one while visible. */
export function crystalCount(level: number): number {
  return Math.ceil(level * CRYSTAL_TABLE_SIZE);
}

/** The path of the first `count` crystals of a half. */
export function crystalsOf(side: Side, count: number): string {
  return TABLES[side].slice(0, count).map(crystalPath).join('');
}

/** Opacity of the veil from the level. */
export function veilOpacity(level: number): number {
  return VEIL_MAX_OPACITY * level;
}

interface Streak {
  readonly d: string;
}

/** The streaks over the pilot half: from the sill upward, bent a little outward, positions from a fixed table. */
function streakTable(): readonly Streak[] {
  const next = mulberry32(90_417);
  const streaks: Streak[] = [];
  for (let i = 0; i < SPRAY_STREAKS; i++) {
    const x0 = Math.round(230 + next() * 760);
    const rise = Math.round(260 + next() * 150);
    const bend = Math.round((x0 - 610) * 0.18 + (next() - 0.5) * 40);
    const yEnd = SIDE_BOTTOM - 20 - rise;
    streaks.push({
      d: `M${String(x0)} ${String(SIDE_BOTTOM - 20)}C${String(x0)} ${String(SIDE_BOTTOM - 20 - rise / 3)} ${String(x0 + bend / 2)} ${String(SIDE_BOTTOM - 20 - (rise * 2) / 3)} ${String(x0 + bend)} ${String(yEnd)}`,
    });
  }
  return streaks;
}

const STREAKS = streakTable();
const SPRAY_PATH = STREAKS.map((s) => s.d).join('');

function IceDefs() {
  return (
    <defs>
      <clipPath id="w-ice-pilot">
        <rect x={HALVES.pilot.x} y={SIDE_TOP} width={HALVES.pilot.w} height={OPENING.h} />
      </clipPath>
      <clipPath id="w-ice-copilot">
        <rect x={HALVES.copilot.x} y={SIDE_TOP} width={HALVES.copilot.w} height={OPENING.h} />
      </clipPath>
      <radialGradient id="w-ice-frost" cx="0.5" cy="0.5" r="0.75">
        <stop offset="0" stop-color="#eaf3f8" stop-opacity={0.25} />
        <stop offset="0.6" stop-color="#eaf3f8" stop-opacity={0.5} />
        <stop offset="1" stop-color="#f4fafd" stop-opacity={0.95} />
      </radialGradient>
    </defs>
  );
}

function IceSide({ side, level }: { side: Side; level: number }) {
  const half = HALVES[side];
  return (
    <g
      data-cue={`ice_${side}_side`}
      data-level={level}
      data-crystals={crystalCount(level)}
      clip-path={`url(#w-ice-${side})`}
    >
      <rect
        x={half.x}
        y={SIDE_TOP}
        width={half.w}
        height={OPENING.h}
        fill="#e4eef4"
        fill-opacity={veilOpacity(level)}
      />
      <rect
        x={half.x}
        y={SIDE_TOP}
        width={half.w}
        height={OPENING.h}
        fill="url(#w-ice-frost)"
        opacity={veilOpacity(level)}
      />
      <path
        d={crystalsOf(side, crystalCount(level))}
        fill="none"
        stroke="#f6fbfe"
        stroke-width={2.4}
        stroke-linecap="round"
        stroke-opacity={0.9}
      />
    </g>
  );
}

/** The spray over the pilot half: a wet film and pale streaks that run upward. */
function Spray() {
  return (
    <g data-spray="pilot" clip-path="url(#w-ice-pilot)">
      <rect
        x={HALVES.pilot.x}
        y={SIDE_TOP}
        width={HALVES.pilot.w}
        height={OPENING.h}
        fill="#bfe0f5"
        fill-opacity={0.16}
      />
      <path
        class="w-spray"
        d={SPRAY_PATH}
        fill="none"
        stroke="#8fc8ee"
        stroke-width={8}
        stroke-linecap="round"
        stroke-opacity={0.75}
      />
    </g>
  );
}

export function Ice({ pilot, copilot, spray }: { pilot: number; copilot: number; spray: boolean }) {
  return (
    <g data-layer="ice">
      <IceDefs />
      {cueVisible(pilot) ? <IceSide side="pilot" level={pilot} /> : null}
      {cueVisible(copilot) ? <IceSide side="copilot" level={copilot} /> : null}
      {spray ? <Spray /> : null}
    </g>
  );
}
