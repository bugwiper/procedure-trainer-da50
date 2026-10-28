// The independent reference of the MFD engine page (Phase 6, plan 02): which boxes stand in which
// column and in which order, which gauge rows read which quantity at which resolution, and every
// static text that may be drawn on the page. It is written by hand and not derived from
// src/aircraft/da50rg/engine-page.ts; the gates in tests/engine-page.test.ts and the e2e spec
// compare the layout data and the drawn page with it. A box added or moved is an edit of both.

/** The glass content zone of the MFD in region space, and the margin a box keeps to its edge. */
export const PAGE_ZONE = { x0: 4, x1: 491, y0: 30, y1: 343 } as const;
export const ZONE_MARGIN = 2;

/** Box ids per column, from top to bottom. */
export const COLUMN_ORDER = {
  left: ['load', 'oil_pres', 'oil_temp', 'coolant_temp', 'gearbox_temp', 'rudder_trim'],
  middle: ['rpm', 'fuel'],
  right: ['electrical', 'oxygen', 'deice', 'service'],
} as const;

/** The rows inside a box, from top to bottom. */
export const INNER_ROWS: Readonly<Record<string, readonly string[]>> = {
  fuel: ['fuel_qty'],
  electrical: ['amps', 'volts'],
};

export type Shape = 'arc' | 'bar' | 'dual';

export interface GaugeRow {
  readonly id: string;
  /** The data-gauge attribute the frame sets (the label as written, not in capitals). */
  readonly label: string;
  readonly quantity: string;
  /** The quantity of the second pointer of a dual bar. */
  readonly second?: string;
  readonly decimals: number;
  readonly shape: Shape;
  /** Whether the bar's number carries the unit (false: the label names the unit). */
  readonly unit: boolean;
}

/** Every gauge of the page. */
export const GAUGE_ROWS: readonly GaugeRow[] = [
  { id: 'load', label: 'Load', quantity: 'load_pct', decimals: 0, shape: 'arc', unit: true },
  { id: 'rpm', label: 'RPM', quantity: 'rpm', decimals: 0, shape: 'arc', unit: true },
  {
    id: 'oil_pres',
    label: 'Oil pres',
    quantity: 'oil_pressure_bar',
    decimals: 1,
    shape: 'bar',
    unit: true,
  },
  {
    id: 'oil_temp',
    label: 'Oil temp',
    quantity: 'oil_temp_c',
    decimals: 0,
    shape: 'bar',
    unit: true,
  },
  {
    id: 'coolant_temp',
    label: 'Coolant temp',
    quantity: 'coolant_temp_c',
    decimals: 0,
    shape: 'bar',
    unit: true,
  },
  {
    id: 'gearbox_temp',
    label: 'Gearbox temp',
    quantity: 'gearbox_temp_c',
    decimals: 0,
    shape: 'bar',
    unit: true,
  },
  {
    id: 'fuel_qty',
    label: 'Fuel qty',
    quantity: 'fuel_qty_lh_gal',
    second: 'fuel_qty_rh_gal',
    decimals: 1,
    shape: 'dual',
    unit: false,
  },
  {
    id: 'amps',
    label: 'Amps',
    quantity: 'alt1_amps',
    second: 'alt2_amps',
    decimals: 0,
    shape: 'dual',
    unit: false,
  },
  { id: 'volts', label: 'Volts', quantity: 'bus_volts', decimals: 1, shape: 'bar', unit: true },
];

/** The scale numerals of the Fuel Qty bar. */
export const FUEL_QTY_SCALE = [0, 5, 10, 15, 20, 25] as const;

/** The smallest cell a gauge of each shape needs: 88 for an arc of radius 34, 28 for a bar. */
export const MIN_CELL_H = { arc: 88, bar: 28 } as const;

/**
 * Every static text the page may draw (glass-digits numbers excluded): box titles, gauge labels,
 * arc units, the marks beside the pointers and the scale numerals. The ENGINE heading is gone.
 */
export const LABELS: readonly string[] = [
  // box titles
  'FUEL',
  'ELECTRICAL',
  'RUDDER TRIM',
  'OXYGEN',
  'DE-ICE',
  'TOTAL SERVICE',
  // gauge labels
  'LOAD',
  'RPM',
  'OIL PRES',
  'OIL TEMP',
  'COOLANT TEMP',
  'GEARBOX TEMP',
  'FUEL QTY',
  'AMPS',
  'VOLTS',
  // arc units
  '%',
  // pointer marks of the dual bars
  '1',
  '2',
  'L',
  'R',
  // scale numerals
  ...FUEL_QTY_SCALE.map(String),
];
