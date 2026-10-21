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
