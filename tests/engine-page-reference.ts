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
  fuel: ['fuel_qty', 'fuel_temp', 'fuel_press', 'fuel_flow', 'fuel_calc'],
  electrical: ['amps', 'volts'],
  oxygen: ['oxygen_psi'],
  deice: ['deice_qty', 'deice_endurance'],
  rudder_trim: ['trim'],
  service: ['service_hours'],
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
  /** Whether the bar's number carries the unit (false on every bar of the real page: numbers alone). */
  readonly unit: boolean;
}

/** Every gauge of the page. */
export const GAUGE_ROWS: readonly GaugeRow[] = [
  { id: 'load', label: 'Load', quantity: 'load_pct', decimals: 0, shape: 'arc', unit: false },
  { id: 'rpm', label: 'RPM', quantity: 'rpm', decimals: 0, shape: 'arc', unit: false },
  {
    id: 'oil_pres',
    label: 'Oil pres',
    quantity: 'oil_pressure_bar',
    decimals: 1,
    shape: 'bar',
    unit: false,
  },
  {
    id: 'oil_temp',
    label: 'Oil temp',
    quantity: 'oil_temp_c',
    decimals: 0,
    shape: 'bar',
    unit: false,
  },
  {
    id: 'coolant_temp',
    label: 'Coolant temp',
    quantity: 'coolant_temp_c',
    decimals: 0,
    shape: 'bar',
    unit: false,
  },
  {
    id: 'gearbox_temp',
    label: 'Gearbox temp',
    quantity: 'gearbox_temp_c',
    decimals: 0,
    shape: 'bar',
    unit: false,
  },
  {
    id: 'fuel_qty',
    label: 'Fuel qty',
    quantity: 'fuel_qty_lh_gal',
    second: 'fuel_qty_rh_gal',
    decimals: 0,
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
  {
    id: 'fuel_temp',
    label: 'Fuel temp',
    quantity: 'fuel_temp_lh_c',
    second: 'fuel_temp_rh_c',
    decimals: 0,
    shape: 'dual',
    unit: false,
  },
  {
    id: 'fuel_press',
    label: 'Fuel press',
    quantity: 'fuel_pressure_bar',
    decimals: 1,
    shape: 'bar',
    unit: false,
  },
  {
    id: 'oxygen_psi',
    label: 'Psi',
    quantity: 'oxygen_psi',
    decimals: 0,
    shape: 'bar',
    unit: false,
  },
  {
    id: 'deice_qty',
    label: 'Us gal',
    quantity: 'deice_qty_gal',
    decimals: 1,
    shape: 'bar',
    unit: false,
  },
  { id: 'volts', label: 'Volts', quantity: 'bus_volts', decimals: 1, shape: 'bar', unit: false },
];

/** The text rows of the page, which are not gauges: each prints a number from one quantity. */
export const FLOW_ROW = { id: 'fuel_flow', quantity: 'fuel_flow_gph', decimals: 1 } as const;
export const SERVICE_ROW = { id: 'service_hours', quantity: 'service_hours', decimals: 1 } as const;
export const TRIM_ROW = { id: 'trim', quantity: 'rudder_trim_pct' } as const;
/** The drawn row ids (data-readout) of the calculator and the endurance box, in order. */
export const CALCULATOR_READOUTS = [
  'calc_remain',
  'calc_used',
  'calc_endurance',
  'calc_range',
] as const;
export const ENDURANCE_READOUTS = ['endurance_norm', 'endurance_high'] as const;

/** The scale numerals of the Fuel Qty bar. */
export const FUEL_QTY_SCALE = [0, 5, 10, 15, 20, 25] as const;

/**
 * The smallest cell a gauge of each shape needs: 82 for an arc of radius 34 (the scale mark 39 above
 * the centre, the caption and the number 43 below it, one unit to spare), 28 for a bar.
 */
export const MIN_CELL_H = { arc: 82, bar: 28 } as const;
/** The smallest height of the other rows and sub-boxes: one text line, or a title and rows of 8. */
export const MIN_ROW_H = {
  flow: 12,
  calculator: 50,
  endurance: 40,
  trim: 34,
  service: 14,
} as const;

/**
 * Every static text the page may draw (glass-digits numbers excluded): box titles, gauge labels, the
 * arc captions (the label, with the unit where it is another word), the marks inside the pointers and
 * the scale numerals. The ENGINE heading is gone.
 */
export const LABELS: readonly string[] = [
  // box titles
  'FUEL',
  'FUEL CALCULATOR',
  'ENDURANCE',
  'ELECTRICAL',
  'RUDDER TRIM',
  'OXYGEN',
  'DE-ICE',
  'TOTAL SERVICE',
  // gauge labels and arc captions (the number under an arc carries no unit)
  'LOAD %',
  'RPM',
  'OIL PRES',
  'OIL TEMP',
  'COOLANT TEMP',
  'GEARBOX TEMP',
  'FUEL QTY',
  'AMPS',
  'VOLTS',
  'FUEL TEMP',
  'FUEL PRESS',
  'PSI',
  'US GAL',
  // rows and sub-box rows
  'FFLOW GPH',
  'GALLONS REMAIN',
  'GALLONS USED',
  'RANGE NM',
  'NORM:',
  'HIGH:',
  'HRS',
  // marks inside the pointers of the dual bars
  '1',
  '2',
  'L',
  'R',
  // scale numerals
  ...FUEL_QTY_SCALE.map(String),
];
