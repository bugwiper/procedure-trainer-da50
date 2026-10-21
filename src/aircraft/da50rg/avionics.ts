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
  /** Printed word; null for the direct-to key. */
  readonly legend: string | null;
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

/** Local-space copy of a global table: region origin subtracted from every x and y. */
function toLocal(ox: number, oy: number, list: readonly ColumnElement[]): readonly ColumnElement[] {
  return list.map((e): ColumnElement => {
    if (e.kind === 'text') return { ...e, x: e.x - ox, y: e.y - oy };
    return { ...e, cx: e.cx - ox, cy: e.cy - oy };
  });
}

export const BEZEL_COLUMNS: Readonly<Record<BezelColumnId, readonly ColumnElement[]>> = {
  pfd_bezel_left: toLocal(274, 196, PFD_LEFT_GLOBAL),
  pfd_bezel_right: [],
  mfd_bezel_right: [],
};
