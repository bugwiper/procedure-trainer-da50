// The layout of the engine strip at the left of the MFD map page as data (Phase 6 walkthrough): the
// left column of the engine page, slimmer and only a little wider than one arc, in the order of the real
// display: the Load arc above the RPM arc, the fuel flow line, five slim bars, the two-pointer Fuel
// Qty bar with both tanks and its scale, and the rudder trim scale. The rectangles are absolute in
// the local space of the MFD region (495 x 367; the strip stands in x 8 to 72 and y 32 to 341).
// The entries are the same kinds as the engine page, drawn by the same code in its slim (`fine`)
// look; a move is an edit of this table and of the independent reference in
// tests/map-strip-reference.ts. Static text only in capitals; no unit after a number; the bars show
// a pointer only, as the real display does. Data only: no AFM wording.

import type { PageEntry, BarEntry } from './engine-page';

const STRIP_X = 8;
const STRIP_W = 64;
/** The right edge of the strip; the map rectangle starts a gap to the right of it. */
export const MAP_STRIP_RIGHT = STRIP_X + STRIP_W;

const ARC_RADIUS = 25;
const ARC_Y = 32;
/** Room above the ring (ticks and ring) and below its two ends; the caption and the number stand in the open part of the ring. */
const ARC_CELL_H = 60;
/** The ring centre lies this far below the top of its cell and this far right of the strip's left edge. */
const ARC_CENTRE_DY = 31;
const ARC_CENTRE_DX = 32;

const arc = (
  id: string,
  label: string,
  quantity: string,
  y: number,
  numerals: readonly number[],
): PageEntry => ({
  id,
  kind: 'arc',
  label,
  quantity,
  decimals: 0,
  rect: { x: STRIP_X, y, w: STRIP_W, h: ARC_CELL_H },
  centre: { x: STRIP_X + ARC_CENTRE_DX, y: y + ARC_CENTRE_DY },
  radius: ARC_RADIUS,
  fine: true,
  numerals,
});

const BAR_H = 22;
const STRIP_BOTTOM = 341;

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
  fine: true,
  rect: { x: STRIP_X, y, w: STRIP_W, h: BAR_H },
});

const FLOW_Y = ARC_Y + 2 * ARC_CELL_H + 2;
const FLOW_H = 11;
const BARS_Y = FLOW_Y + FLOW_H + 3;
const FUEL_Y = BARS_Y + 5 * BAR_H + 4;
const FUEL_H = 33;
const TRIM_H = 20;
/** The rudder trim stands at the very bottom of the strip zone. */
const TRIM_Y = STRIP_BOTTOM - TRIM_H;

export const MAP_STRIP: readonly PageEntry[] = [
  arc('load', 'Load', 'load_pct', ARC_Y, [0, 25, 50, 75, 100]),
  arc('rpm', 'RPM', 'rpm', ARC_Y + ARC_CELL_H, [0, 2500]),
  {
    id: 'fuel_flow',
    kind: 'flow',
    label: 'FFlow GPH',
    quantity: 'fuel_flow_gph',
    decimals: 1,
    fine: true,
    rect: { x: STRIP_X, y: FLOW_Y, w: STRIP_W, h: FLOW_H },
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
    fine: true,
    rect: { x: STRIP_X, y: FUEL_Y, w: STRIP_W, h: FUEL_H },
  },
  {
    id: 'trim',
    kind: 'trim',
    label: 'Rudder trim',
    quantity: 'rudder_trim_pct',
    marks: ['L', 'R'],
    fine: true,
    rect: { x: STRIP_X, y: TRIM_Y, w: STRIP_W, h: TRIM_H },
  },
];
