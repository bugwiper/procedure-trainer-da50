import type { BreakerGroup, ControlSpec, RegionDef, Size } from '../../../engine/registry';

// Circuit breakers of the bus panel (PNL-12, D-01 to D-03). Pure data, no UI imports. Layout
// numbers are the widened-panel grid of the 01.2 UI-SPEC (owner decision U-01, Table W2): pitch 36,
// hits 28 x 28, one label tier. Layout facts only; nothing is traced from the private photos.
// Plan 02 holds the one breaker that proves the kind; plan 03 adds the other breaker regions and
// plan 04 fills the grid.

/** Column centres c1..c7 (global x): 1906 + 36 (c - 1). */
export const CB_COLUMN_X = [1906, 1942, 1978, 2014, 2050, 2086, 2122] as const;

/** Row centres (global y): three in cb_essential, three in cb_main. */
export const CB_ROW_Y = { A1: 261, A2: 305, A3: 349, M4: 412, M5: 456, V6: 514 } as const;

/** Lower row (10 breakers) and flap strip (3 breakers) share the global y 690. */
export const CB_LOWER_Y = 690;
export const CB_STRIP_Y = 690;
/** Lower row centre x for position j = 1..10: 1897 + 26 (j - 1). */
export const cbLowerX = (j: number): number => 1897 + 26 * (j - 1);
export const CB_STRIP_X = [1458, 1494, 1530] as const;

/** Hit sizes: grid and strip 28 x 28, the lower row 24 x 28. */
export const CB_HIT: Size = { w: 28, h: 28 };
export const CB_HIT_LOWER: Size = { w: 24, h: 28 };

export const CB_REGIONS: readonly RegionDef[] = [
  {
    id: 'cb_essential',
    name: 'CIRCUIT BREAKERS ESSENTIAL',
    bounds: { x: 1884, y: 215, w: 260, h: 152 },
  },
];

/** One printed breaker: global centre, printed label lines and rating, bus group. */
export interface BreakerRow {
  readonly id: string;
  /** Printed label without line breaks; the label lines joined must match it. */
  readonly label: string;
  readonly labelLines: readonly string[];
  readonly rating: string;
  readonly group: BreakerGroup;
  readonly region: string;
  /** Global centre. */
  readonly x: number;
  readonly y: number;
  readonly labelDx?: number;
}

export const BREAKER_ROWS: readonly BreakerRow[] = [
  {
    id: 'cb.pitot',
    label: 'PITOT',
    labelLines: ['PITOT'],
    rating: '20',
    group: 'essential',
    region: 'cb_essential',
    x: CB_COLUMN_X[2],
    y: CB_ROW_Y.A2,
  },
];

/** Turns a row into a ControlSpec: region-local centre, hit by group. */
export function breakerSpec(row: BreakerRow, regions: readonly RegionDef[]): ControlSpec {
  const region = regions.find((r) => r.id === row.region);
  if (region === undefined) throw new Error(`breaker ${row.id} names unknown region ${row.region}`);
  const lower = row.group === 'lower';
  return {
    kind: 'circuit-breaker',
    id: row.id,
    label: row.label,
    region: row.region,
    x: row.x - region.bounds.x,
    y: row.y - region.bounds.y,
    hit: lower ? CB_HIT_LOWER : CB_HIT,
    states: [
      { id: 'in', label: 'IN' },
      { id: 'out', label: 'OUT' },
    ],
    default: 'in',
    rating: row.rating,
    labelLines: row.labelLines,
    group: row.group,
    ...(lower ? { compact: true } : {}),
    ...(row.labelDx === undefined ? {} : { labelDx: row.labelDx }),
  };
}

export const BREAKER_CONTROLS: readonly ControlSpec[] = BREAKER_ROWS.map((row) =>
  breakerSpec(row, CB_REGIONS),
);
