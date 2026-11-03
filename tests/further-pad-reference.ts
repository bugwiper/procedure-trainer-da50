// The slots of the footwell cluster of the further actions (Phase 7, plan 07-05, R-07; reworked on
// 2026-11-02 after the owner feedback and in plan 07-06, R-21), typed in by hand and independent of
// src/aircraft/da50rg/further-pad.ts. Region-local rectangles: the region further_area is 514 x 264
// and the nine slots (150 x 60, 7 units apart in a row, 7 between the conduct row and the middle row
// and 5 between the middle row and the Avoid row, together 464 x 192) stand 25 units from its left and
// right edge, the top row 35 units below its top and the bottom row ending 37 units above its bottom
// (the plate carries the headline FURTHER ACTIONS above the top row; the zoomed view leaves room for
// the Full panel corner above and below the buttons on a phone). Top row: the three flight conducts,
// middle row: brief passengers and the two ATC calls, bottom row: the three Avoid actions. The labels
// are the static button labels (the owner's wording of 2026-11-02; a line feed is a line break on the
// button: CONTINUE TO / DESTINATION, ALTERNATE / LANDING, EMERGENCY / LANDING, ATC notify / (PAN PAN PAN), Brief passengers / (if time
// permits)). Name: [option id, label, x, y, w, h].
export const FURTHER_PAD_REGION = { w: 514, h: 264 } as const;

export const FURTHER_PAD_REFERENCE: readonly (readonly [
  string,
  string,
  number,
  number,
  number,
  number,
])[] = [
  ['conduct_destination', 'CONTINUE TO\nDESTINATION', 25, 35, 150, 60],
  ['conduct_precautionary', 'ALTERNATE\nLANDING', 182, 35, 150, 60],
  ['conduct_emergency', 'EMERGENCY\nLANDING', 339, 35, 150, 60],
  ['brief_passengers', 'Brief passengers\n(if time permits)', 25, 102, 150, 60],
  ['atc_mayday', 'ATC: MAYDAY', 182, 102, 150, 60],
  ['atc_pan_pan', 'ATC notify\n(PAN PAN PAN)', 339, 102, 150, 60],
  ['avoid_imc', 'Avoid IMC', 25, 167, 150, 60],
  ['avoid_nvfr', 'Avoid NVFR', 182, 167, 150, 60],
  ['avoid_icing', 'Avoid icing', 339, 167, 150, 60],
];

/** The static headline on the plate above the buttons (global units, centred on the plate at x 520). */
export const FURTHER_PAD_TITLE = { text: 'FURTHER ACTIONS', x: 520, y: 892, size: 14 } as const;

/**
 * The thin divider line on the plate (owner decision 2026-11-03), in global units: it marks the three
 * flight conduct buttons as one group. It runs the width of the cluster (x 288 to 752), stands at the
 * middle of the gap between the conduct row (ends y 961) and the middle row (starts y 968) and is
 * 1 unit thick. Typed in by hand, independent of plates.ts.
 */
export const FURTHER_PAD_DIVIDER = { x1: 288, x2: 752, y: 964.5, width: 1 } as const;
