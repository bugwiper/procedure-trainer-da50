// The slots of the footwell cluster of the further actions (Phase 7, plan 07-05, R-07; reworked on
// 2026-11-02 after the owner feedback), typed in by hand and independent of
// src/aircraft/da50rg/further-pad.ts. Region-local rectangles: the region further_area is 660 x 260
// and the six slots (600 x 170) stand 30 units from its left and right edge, the top row 47 units
// below its top and the bottom row ending 43 units above its bottom (the plate carries the headline
// FURTHER ACTIONS above the top row, the zoomed view leaves room for the Full panel corner above the
// buttons on a phone). Top row: the three flight conducts, bottom row: brief passengers and the two
// ATC calls. The labels are the static button labels (the owner's wording of 2026-11-02; a line feed
// is a line break on the button: ATC notify / (PAN PAN PAN), Brief passengers / (if time permits)).
// Name: [option id, label, x, y, w, h].
export const FURTHER_PAD_REGION = { w: 660, h: 260 } as const;

export const FURTHER_PAD_REFERENCE: readonly (readonly [
  string,
  string,
  number,
  number,
  number,
  number,
])[] = [
  ['conduct_continue', 'CONTINUE NORMALLY', 30, 47, 190, 78],
  ['conduct_precautionary', 'ALTERNATE LANDING', 235, 47, 190, 78],
  ['conduct_emergency', 'EMERGENCY LANDING', 440, 47, 190, 78],
  ['brief_passengers', 'Brief passengers\n(if time permits)', 30, 139, 190, 78],
  ['atc_mayday', 'ATC: MAYDAY', 235, 139, 190, 78],
  ['atc_pan_pan', 'ATC notify\n(PAN PAN PAN)', 440, 139, 190, 78],
];

/** The static headline on the plate above the buttons (global units, centred on the plate at x 520). */
export const FURTHER_PAD_TITLE = { text: 'FURTHER ACTIONS', x: 520, y: 902, size: 14 } as const;
