// The layout of the engine strip at the left of the MFD map page as data (Phase 6 walkthrough): the
// left column of the engine page in a smaller size, in the order of the real display: the Load and
// RPM arcs side by side, the fuel flow line, five bars, the two-pointer Fuel Qty bar with both tanks
// and the rudder trim scale. The rectangles are absolute in the local space of the MFD region (495 x
// 367; the strip stands in x 4 to 158 and y 30 to 343). The entries are the same kinds as the engine
// page and are drawn by the same code; a move is an edit of this table and of the independent
// reference in tests/map-strip-reference.ts. Static text only in capitals; no unit after a number.
// Data only: no AFM wording.

import type { PageEntry, BarEntry } from './engine-page';

const BAR_H = 28;
const STRIP_X = 8;
const STRIP_W = 142;
const ARC_RADIUS = 20;
const ARC_Y = 32;
/** Room above the arc centre (scale mark and ring) and below it (caption and number). */
const ARC_CELL_H = 64;
/** The arc centre lies this far below the top of its cell. */
const ARC_CENTRE_DY = 26;

const arc = (
  id: string,
  label: string,
  quantity: string,
  x: number,
  scaleLabels = false,
): PageEntry => ({
  id,
  kind: 'arc',
  label,
  quantity,
  decimals: 0,
  rect: { x, y: ARC_Y, w: STRIP_W / 2, h: ARC_CELL_H },
  centre: { x: x + STRIP_W / 4, y: ARC_Y + ARC_CENTRE_DY },
  radius: ARC_RADIUS,
  fine: true,
  scaleLabels,
});

const bar = (
  id: string,
  label: string,
  quantity: string,
  decimals: number,
  y: number,
): BarEntry => ({
  id,
  kind: 'bar',
  label,
  quantity,
  decimals,
  unit: false,
  rect: { x: STRIP_X, y, w: STRIP_W, h: BAR_H },
});

const FLOW_Y = ARC_Y + ARC_CELL_H + 1;
const BARS_Y = FLOW_Y + 13;

export const MAP_STRIP: readonly PageEntry[] = [
  arc('load', 'Load', 'load_pct', STRIP_X, true),
  arc('rpm', 'RPM', 'rpm', STRIP_X + STRIP_W / 2),
  {
    id: 'fuel_flow',
    kind: 'flow',
    label: 'FFlow GPH',
    quantity: 'fuel_flow_gph',
    decimals: 1,
    rect: { x: STRIP_X, y: FLOW_Y, w: STRIP_W, h: 12 },
  },
  bar('oil_pres', 'Oil pres', 'oil_pressure_bar', 1, BARS_Y),
  bar('oil_temp', 'Oil temp', 'oil_temp_c', 0, BARS_Y + BAR_H),
  bar('coolant_temp', 'Coolant temp', 'coolant_temp_c', 0, BARS_Y + 2 * BAR_H),
  bar('gearbox_temp', 'Gearbox temp', 'gearbox_temp_c', 0, BARS_Y + 3 * BAR_H),
  bar('volts', 'Volts', 'bus_volts', 1, BARS_Y + 4 * BAR_H),
  {
    id: 'fuel_qty',
    kind: 'dual',
    label: 'Fuel qty gal',
    quantity: 'fuel_qty_lh_gal',
    second: 'fuel_qty_rh_gal',
    decimals: 0,
    marks: ['L', 'R'],
    scale: [0, 5, 10, 15, 20, 25],
    rect: { x: STRIP_X, y: BARS_Y + 5 * BAR_H + 1, w: STRIP_W, h: 52 },
  },
  {
    id: 'trim',
    kind: 'trim',
    label: 'Rudder trim',
    quantity: 'rudder_trim_pct',
    marks: ['L', 'R'],
    rect: { x: STRIP_X, y: BARS_Y + 5 * BAR_H + 55, w: STRIP_W, h: 32 },
  },
];
