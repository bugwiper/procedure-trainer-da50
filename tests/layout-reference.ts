// Shared layout reference for the DA50 RG panel (PNL-08, D-03). Not a test file: imported by
// tests/layout.test.ts. Positions are global centres in the 2000 x 1300 space, layout facts
// read from the private reference photos named in the UI-SPEC (git-ignored), never copied or
// traced (D-06). `review` marks every row the owner must check after the first render (D-03).
// `tol` is the allowed distance on each axis: 3 for a confirmed position, 8 for an unconfirmed
// one, 12 for the de-ice panel. The UI-SPEC id sw.stall_gear_test is recorded under its registry
// id btn.stall_gear_test (PD-04); sw.deice_mode is the three-position toggle of plan 21.
// A row whose control does not exist yet is skipped by the test, never counted as a pass.

export interface ReferencePosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly tol: 3 | 8 | 12;
  readonly review: boolean;
}

export type Relation =
  | 'left-of'
  | 'right-of'
  | 'above'
  | 'below'
  | 'x-within'
  | 'same-row'
  | 'x-greater-than'
  | 'under-left-quarter-of';

/** Interactive controls: 42 rows. */
export const REFERENCE_POSITIONS: readonly ReferencePosition[] = [
  { id: 'sw.light_landing', x: 1047, y: 90, tol: 8, review: true },
  { id: 'sw.light_taxi', x: 1095, y: 90, tol: 8, review: true },
  { id: 'sw.light_position', x: 1143, y: 90, tol: 8, review: true },
  { id: 'sw.light_strobe', x: 1191, y: 90, tol: 8, review: true },
  { id: 'sw.instr_light', x: 1047, y: 238, tol: 8, review: true },
  { id: 'sw.flood_light', x: 1126, y: 238, tol: 8, review: true },
  { id: 'sw.deice_mode', x: 120, y: 342, tol: 12, review: true },
  { id: 'sw.deice_alternate', x: 232, y: 296, tol: 12, review: true },
  { id: 'sw.deice_windshield', x: 129, y: 410, tol: 12, review: true },
  { id: 'sw.deice_ice_light', x: 176, y: 410, tol: 12, review: true },
  { id: 'sw.deice_pump2', x: 222, y: 410, tol: 12, review: true },
  { id: 'btn.deice_annun_test', x: 150, y: 447, tol: 12, review: true },
  { id: 'sw.deice_pump1', x: 205, y: 447, tol: 12, review: true },
  { id: 'sw.fadec', x: 126, y: 506, tol: 3, review: false },
  { id: 'btn.fadec_test', x: 206, y: 506, tol: 3, review: true },
  { id: 'sw.alternator_1', x: 134, y: 570, tol: 3, review: false },
  { id: 'sw.alternator_2', x: 210, y: 570, tol: 3, review: false },
  { id: 'sw.prop_deice', x: 114, y: 664, tol: 3, review: true },
  { id: 'sw.fuel_trans', x: 189, y: 664, tol: 3, review: true },
  { id: 'sw.emerg_fuel_pump', x: 276, y: 664, tol: 3, review: false },
  { id: 'btn.engine_start', x: 386, y: 664, tol: 3, review: false },
  { id: 'sw.engine_master', x: 470, y: 664, tol: 3, review: false },
  { id: 'sw.ess_bus', x: 572, y: 664, tol: 3, review: false },
  { id: 'sw.elect_master', x: 656, y: 664, tol: 3, review: false },
  { id: 'sw.av_master', x: 731, y: 664, tol: 3, review: false },
  { id: 'sw.pitot_stall_heat', x: 801, y: 664, tol: 3, review: true },
  { id: 'btn.stall_gear_test', x: 872, y: 686, tol: 8, review: true },
  { id: 'lv.gear', x: 997, y: 656.5, tol: 3, review: false },
  { id: 'btn.level', x: 1099, y: 674, tol: 3, review: true },
  { id: 'sw.mfd_page', x: 1288, y: 589, tol: 3, review: false },
  { id: 'lv.flaps', x: 1366, y: 670.5, tol: 3, review: false },
  { id: 'sw.elt', x: 1776, y: 656, tol: 3, review: true },
  { id: 'lv.alt_static', x: 51, y: 805, tol: 3, review: true },
  { id: 'lv.emerg_gear', x: 907, y: 805, tol: 3, review: false },
  { id: 'lv.alt_air', x: 1205, y: 805, tol: 3, review: false },
  { id: 'lv.env_direction', x: 1004, y: 828, tol: 8, review: true },
  { id: 'lv.env_temp', x: 1100, y: 880, tol: 8, review: true },
  { id: 'sw.env_fan', x: 1020, y: 932, tol: 8, review: true },
  { id: 'lv.env_circ', x: 1063, y: 1010, tol: 8, review: true },
  { id: 'lv.parking_brake', x: 1008, y: 1110, tol: 8, review: true },
  { id: 'lv.power', x: 1115, y: 1160, tol: 8, review: true },
  { id: 'lv.cowl_flap', x: 1058, y: 1218, tol: 8, review: true },
];

/** The eleven derived lamps (seven gear and flap lamps, the ELT lamp, two cowl-flap lamps, de-ice NORM). */
export const INDICATOR_POSITIONS: readonly ReferencePosition[] = [
  { id: 'lt.gear_nose', x: 916, y: 682, tol: 8, review: true },
  { id: 'lt.gear_left', x: 894, y: 714, tol: 8, review: true },
  { id: 'lt.gear_right', x: 936, y: 714, tol: 8, review: true },
  { id: 'lt.gear_unsafe', x: 860, y: 714, tol: 8, review: true },
  { id: 'lt.flap_up', x: 1278, y: 629, tol: 8, review: true },
  { id: 'lt.flap_to', x: 1274, y: 660, tol: 8, review: true },
  { id: 'lt.flap_ldg', x: 1263, y: 689, tol: 8, review: true },
  { id: 'lt.elt', x: 1752, y: 656, tol: 8, review: true },
  { id: 'lt.cowl_open', x: 1022, y: 1188, tol: 8, review: true },
  { id: 'lt.cowl_closed', x: 1022, y: 1248, tol: 8, review: true },
  { id: 'lt.deice_norm', x: 164, y: 340, tol: 12, review: true },
];

/**
 * Reference ordering table (PNL-08, D-19): subject, relation, object. A subject is a control
 * id, an lt.* id or "region:<id>"; the object of x-greater-than is a number. A relation whose
 * side is not in DA50RG yet is skipped, so a later plan can require zero skipped rows.
 */
const SWITCH_ROW = [
  'sw.prop_deice',
  'sw.fuel_trans',
  'sw.emerg_fuel_pump',
  'btn.engine_start',
  'sw.engine_master',
  'sw.ess_bus',
  'sw.elect_master',
  'sw.av_master',
  'sw.pitot_stall_heat',
] as const;

const LIGHT_SWITCHES = [
  'sw.light_landing',
  'sw.light_taxi',
  'sw.light_position',
  'sw.light_strobe',
] as const;

const ENV_CONTROLS = ['lv.env_direction', 'lv.env_temp', 'sw.env_fan', 'lv.env_circ'] as const;
const FLAP_LAMPS = ['lt.flap_up', 'lt.flap_to', 'lt.flap_ldg'] as const;

type OrderRow = readonly [string, Relation, string | number];

function chain(ids: readonly string[], relation: Relation): OrderRow[] {
  return ids.slice(1).map((id, i): OrderRow => [ids[i] ?? '', relation, id]);
}

export const ORDERING: readonly OrderRow[] = [
  // Phase 1 rows.
  ['sw.deice_alternate', 'above', 'sw.fadec'],
  ['sw.fadec', 'above', 'sw.alternator_1'],
  ['sw.fadec', 'left-of', 'btn.fadec_test'],
  ['sw.alternator_1', 'left-of', 'sw.alternator_2'],
  ['sw.alternator_1', 'above', 'sw.prop_deice'],
  ['region:deice', 'left-of', 'region:pfd'],
  ['region:engine_controls', 'left-of', 'region:pfd'],
  ...chain(SWITCH_ROW, 'left-of'),
  ...chain(SWITCH_ROW, 'same-row'),
  ...SWITCH_ROW.map((id): OrderRow => [id, 'below', 'region:pfd']),
  ['sw.pitot_stall_heat', 'x-within', 'region:pfd'],
  ['sw.pitot_stall_heat', 'left-of', 'lv.gear'],
  ['lv.gear', 'left-of', 'lv.flaps'],
  ['lv.flaps', 'below', 'region:mfd'],
  ['lv.flaps', 'x-within', 'region:mfd'],
  ['lv.flaps', 'x-greater-than', 1000],
  ['lv.flaps', 'left-of', 'sw.elt'],
  ['sw.elt', 'below', 'region:mfd'],
  ['sw.mfd_page', 'under-left-quarter-of', 'region:mfd'],
  ['lv.alt_static', 'left-of', 'lv.emerg_gear'],
  ['lv.emerg_gear', 'left-of', 'region:pedestal'],
  ['lv.alt_air', 'right-of', 'region:pedestal'],
  ['lv.power', 'above', 'lv.cowl_flap'],
  // Glareshield light switches and dimmer knobs (D-08).
  ...chain(LIGHT_SWITCHES, 'left-of'),
  ...chain(LIGHT_SWITCHES, 'same-row'),
  ...LIGHT_SWITCHES.map((id): OrderRow => [id, 'above', 'region:pfd']),
  ['sw.light_landing', 'above', 'sw.instr_light'],
  ['sw.instr_light', 'left-of', 'sw.flood_light'],
  ['sw.instr_light', 'same-row', 'sw.flood_light'],
  ['sw.instr_light', 'right-of', 'region:pfd'],
  ['sw.flood_light', 'left-of', 'region:mfd'],
  // De-ice panel.
  ['sw.deice_mode', 'left-of', 'sw.deice_alternate'],
  ['sw.deice_mode', 'above', 'sw.deice_windshield'],
  ['lt.deice_norm', 'right-of', 'sw.deice_mode'],
  ['lt.deice_norm', 'left-of', 'sw.deice_alternate'],
  ...chain(['sw.deice_windshield', 'sw.deice_ice_light', 'sw.deice_pump2'], 'left-of'),
  ...chain(['sw.deice_windshield', 'sw.deice_ice_light', 'sw.deice_pump2'], 'same-row'),
  ['btn.deice_annun_test', 'left-of', 'sw.deice_pump1'],
  ['sw.deice_windshield', 'above', 'btn.deice_annun_test'],
  ['sw.deice_pump2', 'above', 'sw.deice_pump1'],
  ['sw.deice_alternate', 'above', 'sw.deice_pump2'],
  ['btn.deice_annun_test', 'above', 'sw.fadec'],
  // Lower centre.
  ['sw.pitot_stall_heat', 'left-of', 'btn.stall_gear_test'],
  ['btn.stall_gear_test', 'left-of', 'lv.gear'],
  ['lv.gear', 'left-of', 'btn.level'],
  ['btn.level', 'left-of', 'lv.flaps'],
  // Environmental control.
  ['lv.env_direction', 'above', 'sw.env_fan'],
  ['sw.env_fan', 'above', 'lv.env_circ'],
  ['lv.env_temp', 'above', 'lv.env_circ'],
  ['lv.env_direction', 'left-of', 'lv.env_temp'],
  ['sw.env_fan', 'left-of', 'lv.env_temp'],
  ...ENV_CONTROLS.flatMap((id): OrderRow[] => [
    [id, 'above', 'lv.parking_brake'],
    [id, 'above', 'lv.cowl_flap'],
    [id, 'above', 'lv.power'],
  ]),
  // Pedestal (plan 19, Table D2): parking brake upper left, cowl flap lower middle, throttle right.
  ['lv.parking_brake', 'above', 'lv.cowl_flap'],
  ['lv.parking_brake', 'left-of', 'lv.cowl_flap'],
  ['lv.cowl_flap', 'left-of', 'lv.power'],
  ['lv.parking_brake', 'left-of', 'lv.power'],
  ['lt.cowl_open', 'above', 'lt.cowl_closed'],
  ['lt.cowl_open', 'left-of', 'lv.cowl_flap'],
  ['lt.cowl_closed', 'left-of', 'lv.cowl_flap'],
  // Indicators: resolved once plan 01.1-04 adds them.
  ['lt.gear_unsafe', 'left-of', 'lt.gear_left'],
  ['lt.gear_left', 'left-of', 'lt.gear_nose'],
  ['lt.gear_nose', 'left-of', 'lt.gear_right'],
  ['lt.gear_nose', 'above', 'lt.gear_left'],
  ['lt.gear_nose', 'above', 'lt.gear_right'],
  ['lt.gear_left', 'same-row', 'lt.gear_right'],
  ['lt.gear_right', 'left-of', 'lv.gear'],
  ['lt.flap_up', 'above', 'lt.flap_to'],
  ['lt.flap_to', 'above', 'lt.flap_ldg'],
  ...FLAP_LAMPS.map((id): OrderRow => [id, 'left-of', 'lv.flaps']),
  ['btn.level', 'left-of', 'lt.flap_up'],
  ['lt.elt', 'left-of', 'sw.elt'],
  ['lt.elt', 'same-row', 'sw.elt'],
];

export const FRONT_PANEL_REGIONS: readonly string[] = [
  'lights',
  'deice',
  'deice_switches',
  'engine_controls',
  'pfd',
  'light_knobs',
  'mfd',
  'mfd_softkeys',
  'switch_bank',
  'landing_gear',
  'level',
  'flaps',
  'right_panel',
];

export const UNDER_PANEL_REGIONS: readonly string[] = [
  'under_panel_left',
  'under_panel_centre',
  'env_control',
  'env_circ',
  'pedestal',
  'under_panel_right',
];
