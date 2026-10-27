// Glass-display shape of the DA50 RG panel as pure data (phase 01.2, D-04): the softkey rows
// below the screens, the legend tabs that stand on the glass above the keys, and the zones of
// the glass. Global units of the 2180 x 1300 panel space; no UI imports, so the shell, the
// frames and the tests read one source. Original layout facts only: the legends are functional
// words, no maker or product names (owner rule U-33).

/** The two glass displays of the panel. */
export type DisplayId = 'pfd' | 'mfd';

/** Softkeys per display. */
export const SOFTKEY_SLOT_COUNT = 12;

/** One hardware key: rounded rectangle 30 x 20, rx 3 (Table D2). */
export const SOFTKEY_KEY = { w: 30, h: 20, rx: 3 } as const;

/** Centre y of every key row, global (the bezel lip, Table D1). */
export const SOFTKEY_CENTRE_Y = 589;

export interface SoftkeyRow {
  /** The view-only (or key-owning) region that carries the row. */
  readonly regionId: string;
  /** The glass screen region above the row; legend tabs are drawn in its local space. */
  readonly screenRegionId: string;
  /** Global x of the screen region, for the legend tab centres. */
  readonly screenX: number;
  /** Global x of the centre of slot 0 and the pitch between slots. */
  readonly firstX: number;
  readonly pitch: number;
  /** Width of a legend tab on the glass. */
  readonly tabWidth: number;
}

export const SOFTKEY_ROWS: Readonly<Record<DisplayId, SoftkeyRow>> = {
  // Narrower than the MFD row: pfd_softkeys ends at x 835 because landing_gear starts at 836 and a
  // key may not leave its region (U-13). Slots 0 to 11 end at x 832.9; all 12 keys are inert art.
  pfd: {
    regionId: 'pfd_softkeys',
    screenRegionId: 'pfd',
    screenX: 362,
    firstX: 401,
    pitch: 37.9,
    tabWidth: 34,
  },
  // Centred on the screen; slot 0 is the sw.mfd_page control at (1288, 589).
  mfd: {
    regionId: 'mfd_softkeys',
    screenRegionId: 'mfd',
    screenX: 1269,
    firstX: 1288,
    pitch: 41.5,
    tabWidth: 37,
  },
};

/** Global centre of the key at `slot` (0 to 11). */
export function softkeyCentre(display: DisplayId, slot: number): { x: number; y: number } {
  const row = SOFTKEY_ROWS[display];
  return { x: row.firstX + row.pitch * slot, y: SOFTKEY_CENTRE_Y };
}

/** Centre x of the legend tab of `slot`, in the local space of the screen region. */
export function legendTabCentreX(display: DisplayId, slot: number): number {
  const row = SOFTKEY_ROWS[display];
  return softkeyCentre(display, slot).x - row.screenX;
}

// Glass legends (Table D3), static per page; slot 1 is index 0 and a blank slot keeps an empty
// idle tab. The PFD words are read from the photos (high confidence); of the MFD only slot 1 is
// confirmed, the other slots are low confidence (U-14).

/** PFD: all 12 slots carry a legend. */
export const PFD_LEGENDS: readonly string[] = [
  'CAS',
  'Map/HSI',
  'TFC Map',
  'PFD Opt',
  'OBS',
  'CDI',
  'DME',
  'XPDR',
  'Ident',
  'TMR/REF',
  'Nearest',
  'Alerts',
];

/** MFD map page: slots 1, 3, 9, 10, 11 and 12. */
export const MFD_MAP_LEGENDS: readonly string[] = [
  'Engine',
  '',
  'Map Opt',
  '',
  '',
  '',
  '',
  '',
  'Detail',
  'All',
  'Charts',
  'Checklist',
];

/** MFD engine page: slots 1, 4, 5 and 6. */
export const MFD_ENGINE_LEGENDS: readonly string[] = [
  'Engine',
  '',
  '',
  'DEC Fuel',
  'INC Fuel',
  'RST Fuel',
  '',
  '',
  '',
  '',
  '',
  '',
];

/** Index of the legend tab marked as selected on the MFD engine page (D-04). */
export const MFD_ENGINE_SELECTED_SLOT = 0;

/**
 * Glass zones in the local space of a screen region (495 x 367, inner glass x 4..491, y 4..363;
 * Table D4). Header and legend are fixed bands; the content lies between them.
 */
export const GLASS = {
  header: { y0: 4, y1: 28 },
  content: { y0: 30, y1: 343 },
  legend: { y0: 345, y1: 363 },
  /** Legend tab: top, height, text baseline, and the width per display. */
  tab: { y: 349, h: 13, baseline: 358.5, width: { pfd: 34, mfd: 37 } },
} as const;

// Knob and key columns beside the glass displays (phase 01.2 plan 07, D-04, D-05): inert art as
// plain data. Every element is stored in the local space of its column region (global minus the
// region origin), the tables below are written in global units as in the plan so each number can
// be audited against the layout notes, and `toLocal` converts them once at load.

/** The three regions that hold a knob column. */
export type BezelColumnId = 'pfd_bezel_left' | 'pfd_bezel_right' | 'mfd_bezel_right';

/** A rotary knob: disc of radius r (knurl ticks, cap and highlight are drawn from r). */
export interface ColumnKnob {
  readonly kind: 'knob';
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/** The RANGE joystick: a disc with an inner circle and a highlight, no ticks. */
export interface ColumnJoystick {
  readonly kind: 'joystick';
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/** The swap button: rounded rectangle with a double-arrow path. */
export interface ColumnSwap {
  readonly kind: 'swap';
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly w: number;
  readonly h: number;
}

/** A key: rounded rectangle with a word, or the direct-to glyph (arrow path and the letter D). */
export interface ColumnKey {
  readonly kind: 'key';
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly w: number;
  readonly h: number;
  /** Printed word; null for the direct-to key. A legend with a space is drawn on two lines. */
  readonly legend: string | null;
  /** Lamp sliver on the key (audio panel): lit amber or unlit; absent when the key has none. */
  readonly lamp?: 'lit' | 'unlit';
}

/** A static name or sub-legend; size 8 for knob names, 6 for sub-legends. */
export interface ColumnText {
  readonly kind: 'text';
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly size: 6 | 8;
  readonly anchor: 'start' | 'middle';
}

export type ColumnElement = ColumnKnob | ColumnJoystick | ColumnSwap | ColumnKey | ColumnText;

/** The red DISPLAY BACKUP button of the audio panel: bezel of radius r around a red cap. */
export interface ColumnButton {
  readonly kind: 'button';
  readonly id: string;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/** Everything an avionics unit may draw: the column vocabulary plus the red button. */
export type UnitElement = ColumnElement | ColumnButton;

const knob = (id: string, cx: number, cy: number, r: number): ColumnKnob => ({
  kind: 'knob',
  id,
  cx,
  cy,
  r,
});
const swap = (id: string, cx: number, cy: number, w: number, h = 12): ColumnSwap => ({
  kind: 'swap',
  id,
  cx,
  cy,
  w,
  h,
});
const name = (text: string, x: number, y: number, anchor: 'start' | 'middle' = 'middle') =>
  ({ kind: 'text', text, x, y, size: 8, anchor }) satisfies ColumnText;
const sub = (text: string, x: number, y: number, anchor: 'start' | 'middle' = 'middle') =>
  ({ kind: 'text', text, x, y, size: 6, anchor }) satisfies ColumnText;

/** Table F1, global units: the PFD left column (centre x 308). */
const PFD_LEFT_GLOBAL: readonly ColumnElement[] = [
  knob('vol', 299, 212, 7),
  sub('VOL', 309, 210, 'start'),
  sub('PUSH ID', 309, 217, 'start'),
  swap('swap', 316, 234, 24),
  knob('nav', 308, 278, 16),
  name('NAV', 308, 258),
  sub('PUSH', 308, 302),
  sub('1-2', 308, 309),
  knob('hdg', 308, 350, 16),
  name('HDG', 308, 330),
  sub('PUSH', 308, 374),
  sub('HDG SYNC', 308, 381),
  knob('alt', 308, 568, 15),
  name('ALT', 308, 548),
];

const joystick = (id: string, cx: number, cy: number, r: number): ColumnJoystick => ({
  kind: 'joystick',
  id,
  cx,
  cy,
  r,
});
const key = (id: string, cx: number, cy: number, legend: string | null): ColumnKey => ({
  kind: 'key',
  id,
  cx,
  cy,
  w: 26,
  h: 18,
  legend,
});

/**
 * Table F2, global units: the PFD right column (centre x 909). The 6 keys are the direct-to key
 * (arrow and the letter D, no word) and MENU, FPL and PROC, CLR and ENT.
 */
const PFD_RIGHT_GLOBAL: readonly ColumnElement[] = [
  knob('vol', 899, 212, 7),
  sub('VOL', 909, 210, 'start'),
  sub('PUSH SQ', 909, 217, 'start'),
  swap('swap', 919, 234, 22),
  sub('EMERG', 879, 237, 'start'),
  knob('com', 909, 276, 16),
  name('COM', 909, 256),
  sub('PUSH', 909, 300),
  sub('1-2', 909, 307),
  knob('crs', 909, 344, 16),
  name('CRS/BARO', 909, 324),
  sub('PUSH', 909, 368),
  sub('CRS CTR', 909, 375),
  joystick('range', 909, 406, 11),
  name('RANGE', 909, 392),
  sub('PUSH', 909, 426),
  sub('PAN', 909, 433),
  key('direct-to', 895, 448, null),
  key('menu', 923, 448, 'MENU'),
  key('fpl', 895, 470, 'FPL'),
  key('proc', 923, 470, 'PROC'),
  key('clr', 895, 492, 'CLR'),
  key('ent', 923, 492, 'ENT'),
  sub('DFLT MAP', 879, 508, 'start'),
  knob('fms', 909, 548, 17),
  name('FMS', 909, 526),
  // Table F2 baseline 573 moved up 1 unit: the text box then ends at the region bottom (574).
  sub('PUSH CRSR', 909, 572),
];

/** Local-space copy of a global table: region origin subtracted from every x and y. */
function toLocal<T extends UnitElement>(ox: number, oy: number, list: readonly T[]): readonly T[] {
  return list.map(
    (e) =>
      (e.kind === 'text'
        ? { ...e, x: e.x - ox, y: e.y - oy }
        : { ...e, cx: e.cx - ox, cy: e.cy - oy }) as T,
  );
}

/** Copy of a global table moved right by dx; sizes, radii, legends and baselines are unchanged. */
function shiftedX(dx: number, list: readonly ColumnElement[]): readonly ColumnElement[] {
  return list.map((e): ColumnElement => {
    if (e.kind === 'text') return { ...e, x: e.x + dx };
    return { ...e, cx: e.cx + dx };
  });
}

/**
 * Table F3: the MFD right strip (centre x 1824) is the PFD right column shifted by +915 in x
 * (the real strips are identical on both displays; the strip has room on the wider panel).
 */
const MFD_RIGHT_GLOBAL: readonly ColumnElement[] = shiftedX(915, PFD_RIGHT_GLOBAL);

export const BEZEL_COLUMNS: Readonly<Record<BezelColumnId, readonly ColumnElement[]>> = {
  pfd_bezel_left: toLocal(274, 196, PFD_LEFT_GLOBAL),
  pfd_bezel_right: toLocal(875, 196, PFD_RIGHT_GLOBAL),
  mfd_bezel_right: toLocal(1782, 196, MFD_RIGHT_GLOBAL),
};

// Centre-stack units (phase 01.2 plan 08, D-05, D-06): the audio panel, the backup EFIS and the
// autopilot panel as inert art. Same convention as the columns: tables in global units, stored
// region-local. Layout facts only (key legends are functional words), no maker or model names.

const unitKey = (
  cx: number,
  cy: number,
  legend: string,
  w: number,
  h: number,
  lamp?: 'lit' | 'unlit',
): ColumnKey => ({
  kind: 'key',
  id: legend.toLowerCase().replace(/\s+/g, '-'),
  cx,
  cy,
  w,
  h,
  legend,
  ...(lamp === undefined ? {} : { lamp }),
});

/** Table G1 key legends: left key, right key (null: no key) per row, eleven rows of pitch 26. */
const AUDIO_ROWS: readonly (readonly [string, string | null])[] = [
  ['COM1 MIC', 'COM1'],
  ['COM2 MIC', 'COM2'],
  ['AUX MIC', 'AUX'],
  ['DME', 'NAV1'],
  ['ADF', 'NAV2'],
  ['PILOT ICS', 'TEL'],
  ['COPLT ICS', 'MUS1'],
  ['PASS ICS', 'MUS2'],
  ['SPKR PA', null],
  ['MKR MUTE', 'HI SENS'],
  ['PLAY', 'MAN SQ'],
];

/** Lamp slivers lit as in the photos (U-16); every other key shows an unlit sliver. */
const AUDIO_LIT: readonly string[] = ['COM1 MIC', 'COM1', 'PILOT ICS'];

const audioKeys = (): ColumnKey[] =>
  AUDIO_ROWS.flatMap(([left, right], row): ColumnKey[] => {
    const cy = 214 + 26 * row;
    const lamp = (legend: string): 'lit' | 'unlit' =>
      AUDIO_LIT.includes(legend) ? 'lit' : 'unlit';
    const keys = [unitKey(962, cy, left, 25, 20, lamp(left))];
    if (right !== null) keys.push(unitKey(990, cy, right, 25, 20, lamp(right)));
    return keys;
  });

const AUDIO_GLOBAL: readonly UnitElement[] = [
  ...audioKeys(),
  knob('volume', 976, 508, 11),
  { kind: 'button', id: 'display-backup', cx: 976, cy: 541, r: 9 },
  sub('DISPLAY', 976, 563),
  sub('BACKUP', 976, 570),
];

/** Table G1: the audio panel in the local space of `audio_panel` (946, 196). */
export const AUDIO_PANEL: readonly UnitElement[] = toLocal(946, 196, AUDIO_GLOBAL);

/** A rectangle in the local space of a unit region. */
export interface UnitRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Table G2: the backup EFIS in the local space of `standby_efis` (1026, 296). */
export interface StandbyEfisData {
  readonly housing: UnitRect;
  /** Attitude display: blue over brown, horizon, pitch ticks, roll arc, fixed aircraft symbol. */
  readonly upper: UnitRect;
  /** Tape display: speed tape, altitude tape, KTS and FEET labels, BARO box. */
  readonly lower: UnitRect;
  readonly knob: ColumnKnob;
}

const efisRect = (x: number, y: number, w: number, h: number): UnitRect => ({
  x: x - 1026,
  y: y - 296,
  w,
  h,
});

export const STANDBY_EFIS: StandbyEfisData = {
  housing: efisRect(1029, 298, 114, 264),
  upper: efisRect(1040, 308, 92, 116),
  lower: efisRect(1040, 434, 92, 116),
  knob: { kind: 'knob', id: 'efis', cx: 1134 - 1026, cy: 429 - 296, r: 8 },
};

/**
 * The PFD airspeed (owner addition of 2026-10-27): the readout and the tape follow this quantity,
 * which is the ground speed while the aircraft rolls and the static 140 knots elsewhere
 * (physics.ts). Only the number and the tick positions move; no text is added (G-0).
 */
export const PFD_AIRSPEED_QUANTITY = 'airspeed_kt';

/** The ticks of the PFD speed tape: how many, and the pixels one tick step of 10 knots spans. */
export const SPEED_TICK_COUNT = 7;
export const SPEED_TICK_PX = 30;
const SPEED_TICK_KT = 10;

/** The whole knots the readout shows for a reading; a missing reading shows 0. */
export function airspeedReadout(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return value > 0 ? Math.round(value) : 0;
}

/**
 * The offsets in pixels of the speed tape ticks from the top of the tape band, 7 ticks that wrap
 * round so the count never changes. They fall by one tick step per 10 knots of speed, so the tape
 * moves down as the speed rises; a speed that is a multiple of 10 puts the ticks at their rest
 * places, 15 + 30 i.
 */
export function speedTickOffsets(value: number | undefined): number[] {
  const speed = value === undefined || !Number.isFinite(value) || value < 0 ? 0 : value;
  const span = SPEED_TICK_COUNT * SPEED_TICK_PX;
  const shift = (speed % SPEED_TICK_KT) * (SPEED_TICK_PX / SPEED_TICK_KT);
  return Array.from(
    { length: SPEED_TICK_COUNT },
    (_, i) => (SPEED_TICK_PX / 2 + i * SPEED_TICK_PX + shift) % span,
  );
}

/** Idle tape numerals (proposals, U-18): speed from 180 down to 100, altitude around 1400. */
export const EFIS_SPEED_TAPE: readonly number[] = [180, 160, 140, 120, 100];
export const EFIS_ALTITUDE_TAPE: readonly number[] = [1600, 1500, 1400, 1300, 1200];

/** Table G3 key legends, left key then right key per row; NOSE UP and NOSE DN are two lines. */
const AP_ROWS: readonly (readonly [string, string])[] = [
  ['AP', 'YD'],
  ['FD', 'HDG'],
  ['NAV', 'APR'],
  ['ALT', 'VNV'],
  ['VS', 'NOSE UP'],
  ['FLC', 'NOSE DN'],
];

const AUTOPILOT_GLOBAL: readonly UnitElement[] = [
  knob('vol', 1196, 212, 7),
  sub('VOL', 1206, 210, 'start'),
  sub('PUSH ID', 1206, 217, 'start'),
  swap('swap', 1214, 234, 24),
  knob('nav', 1206, 278, 16),
  name('NAV', 1206, 258),
  sub('PUSH', 1206, 302),
  sub('1-2', 1206, 309),
  knob('hdg', 1206, 350, 16),
  name('HDG', 1206, 330),
  sub('PUSH', 1206, 374),
  sub('HDG SYNC', 1206, 381),
  ...AP_ROWS.flatMap(([left, right], row): ColumnKey[] => {
    const cy = 404 + 26 * row;
    return [unitKey(1189, cy, left, 30, 22), unitKey(1223, cy, right, 30, 22)];
  }),
  knob('alt', 1206, 582, 15),
  name('ALT', 1206, 562),
];

/**
 * Table G3: the autopilot panel in the local space of `autopilot_panel` (1164, 196). In the photos
 * this column is the left strip of the MFD; it is treated as the autopilot panel (U-17).
 */
export const AUTOPILOT_PANEL: readonly UnitElement[] = toLocal(1164, 196, AUTOPILOT_GLOBAL);
