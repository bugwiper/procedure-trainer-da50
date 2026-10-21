import type { BreakerGroup, ControlSpec, RegionDef, Size } from '../../../engine/registry';

// Circuit breakers of the bus panel (PNL-12, D-01 to D-03). Pure data, no UI imports. Layout
// numbers are the widened-panel grid of the 01.2 UI-SPEC (owner decision U-01, Table W2): pitch 36,
// hits 28 x 28, one label tier. Layout facts only; nothing is traced from the private photos.
// Plan 02 holds the one breaker that proves the kind; plan 03 added the other three breaker regions
// (cb_main, cb_low, cb_strip, Table B1) and plan 04 fills the grid.

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
  {
    id: 'cb_main',
    name: 'CIRCUIT BREAKERS MAIN',
    bounds: { x: 1884, y: 368, w: 260, h: 166 },
  },
  {
    id: 'cb_low',
    name: 'CIRCUIT BREAKERS LOWER ROW',
    bounds: { x: 1884, y: 648, w: 260, h: 56 },
  },
  {
    id: 'cb_strip',
    name: 'CIRCUIT BREAKERS FLAP STRIP',
    bounds: { x: 1441, y: 648, w: 118, h: 56 },
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

const X = CB_COLUMN_X;
const Y = CB_ROW_Y;

/** Short constructor for a grid breaker; the label is the label lines joined (a trailing slash glues). */
function cb(
  name: string,
  label: string,
  labelLines: readonly string[],
  rating: string,
  group: BreakerGroup,
  region: string,
  x: number,
  y: number,
): BreakerRow {
  return { id: `cb.${name}`, label, labelLines, rating, group, region, x, y };
}

// Labels and ratings are the printed words and numerals (three photos agree for the essential
// rows; positions are scaled from oblique photos to the real pitch, tolerance 8, owner review).
// COM 1 and GPS/NAV 1 carry the digit by default (UI-SPEC Q2-03).
export const BREAKER_ROWS: readonly BreakerRow[] = [
  // Row A1 (essential bus).
  cb('sam', 'SAM', ['SAM'], '3', 'essential', 'cb_essential', X[0], Y.A1),
  cb('ahrs', 'AHRS', ['AHRS'], '5', 'essential', 'cb_essential', X[1], Y.A1),
  cb('com1', 'COM 1', ['COM 1'], '5', 'essential', 'cb_essential', X[2], Y.A1),
  cb('gps_nav1', 'GPS/NAV 1', ['GPS/', 'NAV 1'], '5', 'essential', 'cb_essential', X[3], Y.A1),
  cb('adc', 'ADC', ['ADC'], '5', 'essential', 'cb_essential', X[4], Y.A1),
  cb('eng_inst', 'ENG INST', ['ENG', 'INST'], '5', 'essential', 'cb_essential', X[5], Y.A1),
  // Row A2 (essential bus; the last one stands in its own pump box).
  cb('xpdr', 'XPDR', ['XPDR'], '5', 'essential', 'cb_essential', X[0], Y.A2),
  cb('flaps', 'FLAPS', ['FLAPS'], '4', 'essential', 'cb_essential', X[1], Y.A2),
  cb('pitot', 'PITOT', ['PITOT'], '20', 'essential', 'cb_essential', X[2], Y.A2),
  cb('landing', 'LANDING', ['LANDING'], '5', 'essential', 'cb_essential', X[3], Y.A2),
  cb('flood', 'FLOOD', ['FLOOD'], '5', 'essential', 'cb_essential', X[4], Y.A2),
  cb('gear_warn', 'GEAR WARN', ['GEAR', 'WARN'], '5', 'essential', 'cb_essential', X[5], Y.A2),
  cb('emerg_pump', 'EMERG PUMP', ['EMERG', 'PUMP'], '5', 'essential', 'cb_essential', X[6], Y.A2),
  // Row A3: the cell at c3 is a blank plug; the first two are essential by outline, the rest main.
  cb('pfd', 'PFD', ['PFD'], '5', 'essential', 'cb_essential', X[0], Y.A3),
  cb(
    'master_ctrl',
    'MASTER CTRL.',
    ['MASTER', 'CTRL.'],
    '2',
    'essential',
    'cb_essential',
    X[1],
    Y.A3,
  ),
  cb('cowl_flap', 'COWL FLAP', ['COWL', 'FLAP'], '3', 'main', 'cb_essential', X[3], Y.A3),
  cb('av_gdu_fan', 'AV/GDU FAN', ['AV/GDU', 'FAN'], '3', 'main', 'cb_essential', X[4], Y.A3),
  cb('gear', 'GEAR', ['GEAR'], '5', 'main', 'cb_essential', X[5], Y.A3),
  cb('main_pump', 'MAIN PUMP', ['MAIN', 'PUMP'], '5', 'main', 'cb_essential', X[6], Y.A3),
  // Row M4 (main bus; XFR PUMP stands in its own pump box).
  cb('mfd', 'MFD', ['MFD'], '5', 'main', 'cb_main', X[0], Y.M4),
  cb('strobe', 'STROBE', ['STROBE'], '5', 'main', 'cb_main', X[1], Y.M4),
  cb('position', 'POSITION', ['POSITION'], '5', 'main', 'cb_main', X[2], Y.M4),
  cb('taxi_map', 'TAXI/MAP', ['TAXI/MAP'], '5', 'main', 'cb_main', X[3], Y.M4),
  cb('inst_lt', 'INST. LT', ['INST.', 'LT'], '3', 'main', 'cb_main', X[4], Y.M4),
  cb('av_bus', 'AV BUS', ['AV BUS'], '25', 'main', 'cb_main', X[5], Y.M4),
  cb('xfr_pump', 'XFR PUMP', ['XFR', 'PUMP'], '5', 'main', 'cb_main', X[6], Y.M4),
  // Row M5 (main bus up to AIR CTRL., then the avionics bus; the cell at c6 is a blank plug).
  cb('gcu', 'GCU', ['GCU'], '2', 'main', 'cb_main', X[0], Y.M5),
  cb('stall_ht', 'STALL HT.', ['STALL', 'HT.'], '10', 'main', 'cb_main', X[1], Y.M5),
  cb('rudder_trim', 'RUDDER TRIM', ['RUDDER', 'TRIM'], '3', 'main', 'cb_main', X[2], Y.M5),
  cb('air_ctrl', 'AIR CTRL.', ['AIR', 'CTRL.'], '5', 'main', 'cb_main', X[3], Y.M5),
  cb('tas', 'TAS', ['TAS'], '3', 'avionics', 'cb_main', X[4], Y.M5),
  cb('iridium', 'IRIDIUM', ['IRIDIUM'], '1', 'avionics', 'cb_main', X[6], Y.M5),
  // Row V6 (avionics bus; the cell at c7 is a blank plug). AFCS/ESP prints 7½.
  cb('com2', 'COM2', ['COM2'], '5', 'avionics', 'cb_main', X[0], Y.V6),
  cb('gps_nav2', 'GPS/NAV 2', ['GPS/', 'NAV 2'], '5', 'avionics', 'cb_main', X[1], Y.V6),
  cb('audio', 'AUDIO', ['AUDIO'], '5', 'avionics', 'cb_main', X[2], Y.V6),
  cb('afcs_esp', 'AFCS/ESP', ['AFCS/ESP'], '7½', 'avionics', 'cb_main', X[3], Y.V6),
  cb('dme', 'DME', ['DME'], '3', 'avionics', 'cb_main', X[4], Y.V6),
  cb('twx', 'TWX', ['TWX'], '3', 'avionics', 'cb_main', X[5], Y.V6),
  // Lower row, pitch 26 (the bus of these ten is not printed on the panel; PEDALS rating assumed).
  cb('ecu_a', 'ECU A', ['ECU', 'A'], '10', 'lower', 'cb_low', cbLowerX(1), CB_LOWER_Y),
  cb('ecu_b', 'ECU B', ['ECU', 'B'], '10', 'lower', 'cb_low', cbLowerX(2), CB_LOWER_Y),
  cb('ess_tie', 'ESS TIE', ['ESS', 'TIE'], '50', 'lower', 'cb_low', cbLowerX(3), CB_LOWER_Y),
  cb('batt', 'BATT', ['BATT'], '60', 'lower', 'cb_low', cbLowerX(4), CB_LOWER_Y),
  cb('alt1', 'ALT 1', ['ALT', '1'], '60', 'lower', 'cb_low', cbLowerX(5), CB_LOWER_Y),
  cb('alt2', 'ALT 2', ['ALT', '2'], '60', 'lower', 'cb_low', cbLowerX(6), CB_LOWER_Y),
  cb('main_tie', 'MAIN TIE', ['MAIN', 'TIE'], '50', 'lower', 'cb_low', cbLowerX(7), CB_LOWER_Y),
  cb('ecs', 'ECS', ['ECS'], '10', 'lower', 'cb_low', cbLowerX(8), CB_LOWER_Y),
  cb('usb_ports', 'USB PORTS', ['USB', 'PORTS'], '5', 'lower', 'cb_low', cbLowerX(9), CB_LOWER_Y),
  cb('pedals', 'PEDALS', ['PEDALS'], '5', 'lower', 'cb_low', cbLowerX(10), CB_LOWER_Y),
  // Flap strip under the MFD, pitch 36 (x scaled from the flap lever, medium confidence).
  cb(
    'stall_aoa',
    'STALL/AOA',
    ['STALL/', 'AOA'],
    '2',
    'strip',
    'cb_strip',
    CB_STRIP_X[0],
    CB_STRIP_Y,
  ),
  cb(
    'prop_deice',
    'PROP DE-ICE',
    ['PROP', 'DE-ICE'],
    '15',
    'strip',
    'cb_strip',
    CB_STRIP_X[1],
    CB_STRIP_Y,
  ),
  cb('deice', 'DE-ICE', ['DE-ICE'], '7½', 'strip', 'cb_strip', CB_STRIP_X[2], CB_STRIP_Y),
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
