// Shared layout reference for the DA50 RG panel (PNL-08, D-03). Not a test file: imported by
// tests/layout.test.ts. Positions are global centres in the 2180 x 1300 space (the 180 units on
// the right were added in phase 01.2; positions left of x 1980 are the ones of phase 01.1), layout
// facts read from the private reference photos named in the UI-SPEC (git-ignored), never copied or
// traced (D-06). `review` marks every row the owner must check after the first render (D-03).
// `tol` is the allowed distance on each axis: 3 for a confirmed position, 8 for an unconfirmed
// one, 12 for the de-ice panel. The UI-SPEC id sw.stall_gear_test is recorded under its registry
// id btn.stall_gear_test (PD-04); sw.deice_mode is the three-position toggle of plan 21.
// A row whose control does not exist yet is skipped by the test, never counted as a pass.

/**
 * The panel space as an independent literal (phase 01.2 owner decision U-01): tests and e2e specs
 * read the width from here, never from src, so a changed registry viewBox is caught.
 */
export const PANEL_VIEWBOX = { w: 2180, h: 1300 } as const;

/**
 * The windscreen above the panel (Phase 5, W-01) as an independent literal: its height is typed in
 * here, not read from src. The panel space grows upward by it and nothing of the panel moves.
 */
export const WINDSCREEN_REFERENCE = { h: 440 } as const;

/** The whole drawable space: the instrument-panel space with the windscreen above it. */
export const PANEL_EXTENT = {
  x: 0,
  y: -WINDSCREEN_REFERENCE.h,
  w: PANEL_VIEWBOX.w,
  h: PANEL_VIEWBOX.h + WINDSCREEN_REFERENCE.h,
} as const;

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

/** Interactive controls: reference rows. */
export const REFERENCE_POSITIONS: readonly ReferencePosition[] = [
  { id: 'sw.light_landing', x: 1047, y: 90, tol: 8, review: true },
  { id: 'sw.light_taxi', x: 1095, y: 90, tol: 8, review: true },
  { id: 'sw.light_position', x: 1143, y: 90, tol: 8, review: true },
  { id: 'sw.light_strobe', x: 1191, y: 90, tol: 8, review: true },
  { id: 'sw.instr_light', x: 1047, y: 238, tol: 8, review: true },
  { id: 'sw.flood_light', x: 1126, y: 238, tol: 8, review: true },
  { id: 'btn.deice_max', x: 111, y: 254, tol: 12, review: true },
  { id: 'sw.deice_mode', x: 120, y: 342, tol: 12, review: true },
  { id: 'sw.deice_alternate', x: 232, y: 296, tol: 12, review: true },
  { id: 'btn.deice_windshield', x: 113, y: 425, tol: 12, review: true },
  { id: 'sw.deice_ice_light', x: 171, y: 425, tol: 12, review: true },
  { id: 'sw.deice_pump', x: 227, y: 425, tol: 12, review: true },
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
  // ECS SHUTOFF (owner description 2026-10-22): between ALTERNATE STATIC and the EMERGENCY GEAR
  // EXTENSION handle, about one third of the way from ALTERNATE STATIC, on the row of the pulls.
  { id: 'lv.ecs_shutoff', x: 336, y: 805, tol: 8, review: true },
  { id: 'lv.env_direction', x: 1004, y: 828, tol: 8, review: true },
  { id: 'lv.env_temp', x: 1100, y: 880, tol: 8, review: true },
  { id: 'sw.env_fan', x: 1020, y: 932, tol: 8, review: true },
  { id: 'lv.env_circ', x: 1063, y: 1010, tol: 8, review: true },
  { id: 'lv.parking_brake', x: 1008, y: 1110, tol: 8, review: true },
  { id: 'lv.power', x: 1115, y: 1160, tol: 8, review: true },
  // Shorter and higher than before (owner decision 2026-10-22; was y 1218).
  { id: 'lv.cowl_flap', x: 1058, y: 1192, tol: 8, review: true },
  // FUEL selector (owner decision 2026-10-22): bottom left of the pedestal, next to the throttle.
  { id: 'sw.fuel_valve', x: 1005, y: 1258, tol: 8, review: true },
  // Simplified transponder (phase 03, D-11): a temporary trainer part; the position is an
  // assumption, not a fidelity item. Since Phase 5.1 it stands right of the session pad (region
  // transponder at 1800, 780; centre 160, 100).
  { id: 'kp.squawk', x: 1960, y: 880, tol: 8, review: true },
  // The toe brakes (Phase 5.1, P-02): one latching control drawn as two pedals on the floor of the
  // pilot's footwell, below the transponder plate (region pedals at 300, 1150; centre 180, 55).
  { id: 'lv.toe_brakes', x: 480, y: 1205, tol: 8, review: true },
  // The red door release lever (Phase 5.1, P-09, owner 2026-10-27): low at the left edge, at the
  // pilot's arm rest (region door_arm at 4, 1000; centre 48, 120). The place is an assumption.
  { id: 'lv.door_release', x: 52, y: 1120, tol: 8, review: true },
  // The emergency window (Phase 5.1, P-07): the oval in the side pane at the far left of the
  // windscreen extent, above the panel (region side_window at 6, -280; centre 56, 105).
  { id: 'sw.emerg_window', x: 62, y: -175, tol: 8, review: true },
];

/**
 * Circuit breakers (phase 01.2): global centres of the bus panel grid, typed in independently of
 * the generator in controls/breakers.ts (columns 1906 + 36 (c - 1), rows A1 261, A2 305, A3 349,
 * M4 412, M5 456, V6 514, lower row and flap strip at y 690). Later plans append their rows.
 */
export const CB_REFERENCE: readonly ReferencePosition[] = [
  // Row A1, y 261 (essential bus, region cb_essential).
  { id: 'cb.sam', x: 1906, y: 261, tol: 8, review: true },
  { id: 'cb.ahrs', x: 1942, y: 261, tol: 8, review: true },
  { id: 'cb.com1', x: 1978, y: 261, tol: 8, review: true },
  { id: 'cb.gps_nav1', x: 2014, y: 261, tol: 8, review: true },
  { id: 'cb.adc', x: 2050, y: 261, tol: 8, review: true },
  { id: 'cb.eng_inst', x: 2086, y: 261, tol: 8, review: true },
  // Row A2, y 305.
  { id: 'cb.xpdr', x: 1906, y: 305, tol: 8, review: true },
  { id: 'cb.flaps', x: 1942, y: 305, tol: 8, review: true },
  { id: 'cb.pitot', x: 1978, y: 305, tol: 8, review: true },
  { id: 'cb.landing', x: 2014, y: 305, tol: 8, review: true },
  { id: 'cb.flood', x: 2050, y: 305, tol: 8, review: true },
  { id: 'cb.gear_warn', x: 2086, y: 305, tol: 8, review: true },
  { id: 'cb.emerg_pump', x: 2122, y: 305, tol: 8, review: true },
  // Row A3, y 349 (the cell at x 1978 is a blank plug).
  { id: 'cb.pfd', x: 1906, y: 349, tol: 8, review: true },
  { id: 'cb.master_ctrl', x: 1942, y: 349, tol: 8, review: true },
  { id: 'cb.cowl_flap', x: 2014, y: 349, tol: 8, review: true },
  { id: 'cb.av_gdu_fan', x: 2050, y: 349, tol: 8, review: true },
  { id: 'cb.gear', x: 2086, y: 349, tol: 8, review: true },
  { id: 'cb.main_pump', x: 2122, y: 349, tol: 8, review: true },
  // Row M4, y 412 (region cb_main).
  { id: 'cb.mfd', x: 1906, y: 412, tol: 8, review: true },
  { id: 'cb.strobe', x: 1942, y: 412, tol: 8, review: true },
  { id: 'cb.position', x: 1978, y: 412, tol: 8, review: true },
  { id: 'cb.taxi_map', x: 2014, y: 412, tol: 8, review: true },
  { id: 'cb.inst_lt', x: 2050, y: 412, tol: 8, review: true },
  { id: 'cb.av_bus', x: 2086, y: 412, tol: 8, review: true },
  { id: 'cb.xfr_pump', x: 2122, y: 412, tol: 8, review: true },
  // Row M5, y 456 (the cell at x 2086 is a blank plug).
  { id: 'cb.gcu', x: 1906, y: 456, tol: 8, review: true },
  { id: 'cb.stall_ht', x: 1942, y: 456, tol: 8, review: true },
  { id: 'cb.rudder_trim', x: 1978, y: 456, tol: 8, review: true },
  { id: 'cb.air_ctrl', x: 2014, y: 456, tol: 8, review: true },
  { id: 'cb.tas', x: 2050, y: 456, tol: 8, review: true },
  { id: 'cb.iridium', x: 2122, y: 456, tol: 8, review: true },
  // Row V6, y 514 (avionics bus; the cell at x 2122 is a blank plug).
  { id: 'cb.com2', x: 1906, y: 514, tol: 8, review: true },
  { id: 'cb.gps_nav2', x: 1942, y: 514, tol: 8, review: true },
  { id: 'cb.audio', x: 1978, y: 514, tol: 8, review: true },
  { id: 'cb.afcs_esp', x: 2014, y: 514, tol: 8, review: true },
  { id: 'cb.dme', x: 2050, y: 514, tol: 8, review: true },
  { id: 'cb.twx', x: 2086, y: 514, tol: 8, review: true },
  // Lower row, y 690, pitch 26 (region cb_low).
  { id: 'cb.ecu_a', x: 1897, y: 690, tol: 8, review: true },
  { id: 'cb.ecu_b', x: 1923, y: 690, tol: 8, review: true },
  { id: 'cb.ess_tie', x: 1949, y: 690, tol: 8, review: true },
  { id: 'cb.batt', x: 1975, y: 690, tol: 8, review: true },
  { id: 'cb.alt1', x: 2001, y: 690, tol: 8, review: true },
  { id: 'cb.alt2', x: 2027, y: 690, tol: 8, review: true },
  { id: 'cb.main_tie', x: 2053, y: 690, tol: 8, review: true },
  { id: 'cb.ecs', x: 2079, y: 690, tol: 8, review: true },
  { id: 'cb.usb_ports', x: 2105, y: 690, tol: 8, review: true },
  { id: 'cb.pedals', x: 2131, y: 690, tol: 8, review: true },
  // Flap strip under the MFD, y 690, pitch 36 (region cb_strip).
  { id: 'cb.stall_aoa', x: 1458, y: 690, tol: 8, review: true },
  { id: 'cb.prop_deice', x: 1494, y: 690, tol: 8, review: true },
  { id: 'cb.deice', x: 1530, y: 690, tol: 8, review: true },
];

/**
 * Row and column membership of the breaker grid, typed in by hand from the printed layout (not
 * read from the generator). Task 2 of plan 04 extends the lists with the Main and Avionics rows,
 * the lower row and the flap strip.
 */
export const CB_ROWS = {
  A1: ['cb.sam', 'cb.ahrs', 'cb.com1', 'cb.gps_nav1', 'cb.adc', 'cb.eng_inst'],
  A2: [
    'cb.xpdr',
    'cb.flaps',
    'cb.pitot',
    'cb.landing',
    'cb.flood',
    'cb.gear_warn',
    'cb.emerg_pump',
  ],
  A3: ['cb.pfd', 'cb.master_ctrl', 'cb.cowl_flap', 'cb.av_gdu_fan', 'cb.gear', 'cb.main_pump'],
  M4: [
    'cb.mfd',
    'cb.strobe',
    'cb.position',
    'cb.taxi_map',
    'cb.inst_lt',
    'cb.av_bus',
    'cb.xfr_pump',
  ],
  M5: ['cb.gcu', 'cb.stall_ht', 'cb.rudder_trim', 'cb.air_ctrl', 'cb.tas', 'cb.iridium'],
  V6: ['cb.com2', 'cb.gps_nav2', 'cb.audio', 'cb.afcs_esp', 'cb.dme', 'cb.twx'],
} as const;

/** The lower row, left to right (pitch 26). */
export const CB_LOWER_ROW = [
  'cb.ecu_a',
  'cb.ecu_b',
  'cb.ess_tie',
  'cb.batt',
  'cb.alt1',
  'cb.alt2',
  'cb.main_tie',
  'cb.ecs',
  'cb.usb_ports',
  'cb.pedals',
] as const;

/** The flap strip under the MFD, left to right (pitch 36). */
export const CB_STRIP_ROW = ['cb.stall_aoa', 'cb.prop_deice', 'cb.deice'] as const;

/** Column chains, top to bottom. */
export const CB_COLUMNS = {
  c1: ['cb.sam', 'cb.xpdr', 'cb.pfd', 'cb.mfd', 'cb.gcu', 'cb.com2'],
  c2: ['cb.ahrs', 'cb.flaps', 'cb.master_ctrl', 'cb.strobe', 'cb.stall_ht', 'cb.gps_nav2'],
  c7: ['cb.emerg_pump', 'cb.main_pump', 'cb.xfr_pump', 'cb.iridium'],
} as const;

/** The thirteen derived lamps (seven gear and flap lamps, the ELT lamp, two cowl-flap lamps, three de-ice lamps). */
export const INDICATOR_POSITIONS: readonly ReferencePosition[] = [
  { id: 'lt.gear_nose', x: 916, y: 682, tol: 8, review: true },
  { id: 'lt.gear_left', x: 894, y: 714, tol: 8, review: true },
  { id: 'lt.gear_right', x: 936, y: 714, tol: 8, review: true },
  { id: 'lt.gear_unsafe', x: 860, y: 714, tol: 8, review: true },
  { id: 'lt.flap_up', x: 1278, y: 629, tol: 8, review: true },
  { id: 'lt.flap_to', x: 1274, y: 660, tol: 8, review: true },
  { id: 'lt.flap_ldg', x: 1263, y: 689, tol: 8, review: true },
  { id: 'lt.elt', x: 1752, y: 656, tol: 8, review: true },
  { id: 'lt.cowl_open', x: 1022, y: 1170, tol: 8, review: true },
  { id: 'lt.cowl_closed', x: 1022, y: 1214, tol: 8, review: true },
  { id: 'lt.deice_max', x: 164, y: 256, tol: 12, review: true },
  { id: 'lt.deice_high', x: 164, y: 298, tol: 12, review: true },
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
  // ECS SHUTOFF (owner description 2026-10-22): between ALTERNATE STATIC and the emergency gear
  // handle, on the row of the under-panel pulls.
  ['lv.alt_static', 'left-of', 'lv.ecs_shutoff'],
  ['lv.ecs_shutoff', 'left-of', 'lv.emerg_gear'],
  ['lv.ecs_shutoff', 'same-row', 'lv.alt_static'],
  // FUEL selector: bottom left of the pedestal, left of the throttle, under the brake and cowl flap.
  ['sw.fuel_valve', 'left-of', 'lv.power'],
  ['sw.fuel_valve', 'below', 'lv.parking_brake'],
  ['sw.fuel_valve', 'below', 'lv.cowl_flap'],
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
  ['btn.deice_max', 'above', 'sw.deice_mode'],
  ['btn.deice_max', 'left-of', 'lt.deice_max'],
  ['btn.deice_max', 'same-row', 'lt.deice_max'],
  ['sw.deice_mode', 'left-of', 'sw.deice_alternate'],
  ['sw.deice_mode', 'above', 'btn.deice_windshield'],
  ['lt.deice_max', 'above', 'lt.deice_high'],
  ['lt.deice_high', 'above', 'lt.deice_norm'],
  ...['lt.deice_max', 'lt.deice_high', 'lt.deice_norm'].flatMap((id): OrderRow[] => [
    [id, 'right-of', 'sw.deice_mode'],
    [id, 'left-of', 'sw.deice_alternate'],
  ]),
  ...chain(['btn.deice_windshield', 'sw.deice_ice_light', 'sw.deice_pump'], 'left-of'),
  ...chain(['btn.deice_windshield', 'sw.deice_ice_light', 'sw.deice_pump'], 'same-row'),
  ['sw.deice_alternate', 'above', 'sw.deice_pump'],
  ['sw.deice_ice_light', 'above', 'sw.fadec'],
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
  // Circuit breakers (phase 01.2 plan 04, Table C3): row chains, column chains, the bus panel
  // right of the MFD.
  ...Object.values(CB_ROWS).flatMap((ids): OrderRow[] => [
    ...chain(ids, 'left-of'),
    ...chain(ids, 'same-row'),
  ]),
  ...Object.values(CB_COLUMNS).flatMap((ids): OrderRow[] => chain(ids, 'above')),
  ['cb.master_ctrl', 'left-of', 'cb.cowl_flap'],
  ...chain(CB_LOWER_ROW, 'left-of'),
  ...chain(CB_LOWER_ROW, 'same-row'),
  ...chain(CB_STRIP_ROW, 'same-row'),
  ...chain(['lv.flaps', ...CB_STRIP_ROW, 'sw.elt'], 'left-of'),
  ['cb.ecu_a', 'below', 'cb.com2'],
  ['sw.elt', 'left-of', 'cb.ecu_a'],
  // The 48 breakers outside the flap strip sit right of the MFD; the strip sits under it.
  ...[...Object.values(CB_ROWS).flat(), ...CB_LOWER_ROW].map((id): OrderRow => [
    id,
    'right-of',
    'region:mfd',
  ]),
  ...CB_STRIP_ROW.map((id): OrderRow => [id, 'below', 'region:mfd']),
  // Simplified transponder (phase 03, D-11), since Phase 5.1 right of the session pad in the
  // co-pilot footwell: below the lower breaker row and right of the session area. A trainer part, so the
  // rows only keep it out of the way of the real panel.
  ['kp.squawk', 'right-of', 'region:scenario_area'],
  ['kp.squawk', 'below', 'region:cb_low'],
];

/**
 * Every region id of the panel, written out independently of REGIONS: the 19 regions of phase
 * 01.1 plus the circuit-breaker regions and the avionics unit regions of phase 01.2. The unit
 * inventory and the built-panel layout spec both count against this table.
 */
export const ALL_REGION_IDS: readonly string[] = [
  // The windscreen of phase 5: invisible geometry above the panel, art only, no control.
  'windscreen',
  // The emergency window of Phase 5.1: a narrow region nested inside the windscreen region, one control.
  'side_window',
  // The door release lever of Phase 5.1: at the pilot's arm rest, one control.
  'door_arm',
  'lights',
  'deice',
  'deice_switches',
  'engine_controls',
  'pfd',
  'light_knobs',
  'mfd',
  'mfd_softkeys',
  'pfd_softkeys',
  'switch_bank',
  'landing_gear',
  'level',
  'flaps',
  'right_panel',
  'under_panel_left',
  'under_panel_ecs',
  'under_panel_centre',
  'env_control',
  'env_circ',
  'pedestal',
  'under_panel_right',
  'cb_essential',
  'cb_main',
  'cb_low',
  'cb_strip',
  'pfd_bezel_right',
  'audio_panel',
  'standby_efis',
  'pfd_bezel_left',
  'autopilot_panel',
  'mfd_bezel_right',
  // Session area of phase 02: trainer content in the co-pilot legroom, no registry controls.
  'scenario_area',
  // Simplified transponder of phase 03 (D-11): trainer part in the pilot legroom, one control.
  'transponder',
  // The toe brakes of Phase 5.1: the floor of the pilot's footwell, one control.
  'pedals',
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
  'pfd_softkeys',
  'switch_bank',
  'landing_gear',
  'level',
  'flaps',
  'right_panel',
  'cb_essential',
  'cb_main',
  'cb_low',
  'cb_strip',
  'pfd_bezel_right',
  'audio_panel',
  'standby_efis',
  'pfd_bezel_left',
  'autopilot_panel',
  'mfd_bezel_right',
];

export const UNDER_PANEL_REGIONS: readonly string[] = [
  'under_panel_left',
  // The ECS SHUTOFF pull (owner description 2026-10-22), on the row of the other under-panel pulls.
  'under_panel_ecs',
  'under_panel_centre',
  'env_control',
  'env_circ',
  'pedestal',
  'under_panel_right',
  // The simplified transponder (D-11) sits below the panel, in the pilot's legroom.
  'transponder',
  // The toe brakes (Phase 5.1) sit below the panel, on the floor of the pilot's footwell.
  'pedals',
  // The door release lever (Phase 5.1, owner 2026-10-27) lies low at the left edge, at the arm rest.
  'door_arm',
];
