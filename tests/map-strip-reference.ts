// The independent reference of the engine strip on the MFD map page (Phase 6 walkthrough, after the
// owner's photo of the real display): the order of its rows, which row reads which quantity at which
// resolution, the smallest cell each needs and every static text it may draw. Written by hand, not
// derived from src/aircraft/da50rg/map-strip.ts; tests/map-strip.test.ts compares the layout data and
// the drawn strip with it. A row added or moved is an edit of both.

/** The strip lies inside the left part of the glass content zone of the MFD (region space). */
export const STRIP_ZONE = { x0: 4, x1: 158, y0: 30, y1: 343 } as const;
export const STRIP_MARGIN = 2;

/** Row ids from top to bottom (the two arcs stand side by side, Load at the left). */
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

/** Smallest cell height of each shape: an arc of radius 20 with caption and number, a bar, the rest. */
export const STRIP_MIN_H = { arc: 60, bar: 26, flow: 12, dual: 52, trim: 28 } as const;

/** Every static text the strip may draw (glass-digits numbers excluded). */
/** Small numerals inside the Load ring (the photo shows 25, 50 and 75). */
export const STRIP_LOAD_SCALE: readonly number[] = [25, 50, 75];

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
];
