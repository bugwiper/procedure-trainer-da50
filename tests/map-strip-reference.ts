// The independent reference of the engine strip on the MFD map page (Phase 6 walkthrough, after the
// owner's photo of the real display): the order of its rows, which row reads which quantity at which
// resolution, the smallest cell each needs and every static text it may draw. Written by hand, not
// derived from src/aircraft/da50rg/map-strip.ts; tests/map-strip.test.ts compares the layout data and
// the drawn strip with it. A row added or moved is an edit of both.

/** The strip lies inside the left part of the glass content zone of the MFD (region space). */
export const STRIP_ZONE = { x0: 4, x1: 107, y0: 30, y1: 343 } as const;
/**
 * The strip was 142 wide before the owner's walkthrough of 2026-11-01 asked for about two thirds of
 * it; it may not be wider than this (a tolerance of a few units above 2/3 of 142).
 */
export const STRIP_MAX_W = 100;
/** The map rectangle starts at least this far right of the strip's right edge. */
export const STRIP_MAP_GAP = 6;
export const STRIP_MARGIN = 2;

/** Row ids from top to bottom (the two arcs stand one above the other, Load on top). */
export const STRIP_ORDER = [
  'load',
  'rpm',
  'fuel_flow',
  'oil_pres',
  'oil_temp',
  'coolant_temp',
  'gearbox_temp',
  'volts',
  'fuel_qty',
  'trim',
] as const;

export interface StripGauge {
  readonly label: string;
  readonly quantity: string;
  readonly second?: string;
  readonly decimals: number;
}

/** Every gauge of the strip in drawing order (the data-gauge attribute as written). */
export const STRIP_GAUGES: readonly StripGauge[] = [
  { label: 'Load', quantity: 'load_pct', decimals: 0 },
  { label: 'RPM', quantity: 'rpm', decimals: 0 },
  { label: 'Oil pres', quantity: 'oil_pressure_bar', decimals: 1 },
  { label: 'Oil temp', quantity: 'oil_temp_c', decimals: 0 },
  { label: 'Coolant temp', quantity: 'coolant_temp_c', decimals: 0 },
  { label: 'Gearbox temp', quantity: 'gearbox_temp_c', decimals: 0 },
  { label: 'Volts', quantity: 'bus_volts', decimals: 1 },
  {
    label: 'Fuel qty gal',
    quantity: 'fuel_qty_lh_gal',
    second: 'fuel_qty_rh_gal',
    decimals: 0,
  },
];

export const STRIP_FLOW = { id: 'fuel_flow', quantity: 'fuel_flow_gph', decimals: 1 } as const;
export const STRIP_TRIM = { id: 'trim', quantity: 'rudder_trim_pct' } as const;
export const STRIP_FUEL_SCALE = [0, 5, 10, 15, 20, 25] as const;

/** Smallest cell height of each shape: an arc of radius 23 with its ticks and ends, a slim bar, the rest. */
export const STRIP_MIN_H = { arc: 46, bar: 20, flow: 10, dual: 33, trim: 20 } as const;

/** The gauges that print a number (the arcs; the bars show a pointer only); the fuel flow is a row. */
export const STRIP_NUMBER_GAUGES = ['Load', 'RPM'] as const;

/** Every static text the strip may draw (glass-digits numbers excluded). */
/** Small numerals at the ticks of the two rings (the photo shows 0, 25, 50, 75, 100 and 0, 2600). */
export const STRIP_LOAD_SCALE: readonly number[] = [0, 25, 50, 75, 100];
export const STRIP_RPM_SCALE: readonly number[] = [0, 2500];

export const STRIP_LABELS: readonly string[] = [
  'LOAD %',
  'RPM',
  'FFLOW GPH',
  'OIL PRES',
  'OIL TEMP',
  'COOLANT TEMP',
  'GEARBOX TEMP',
  'VOLTS',
  'FUEL QTY GAL',
  'RUDDER TRIM',
  'L',
  'R',
  ...STRIP_FUEL_SCALE.map(String),
  ...STRIP_LOAD_SCALE.map(String),
  ...STRIP_RPM_SCALE.map(String),
];
