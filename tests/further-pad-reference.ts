// The slots of the footwell cluster of the further actions (Phase 7, plan 07-05, R-07), typed in by
// hand and independent of src/aircraft/da50rg/further-pad.ts. Region-local rectangles: the region
// further_area is 660 x 260 and the six slots (600 x 170) stand in its middle, 30 units from the left and
// right edge and 45 from the top and bottom (the zoomed view then leaves room for the Full panel
// corner above them on a phone).
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
  ['brief_passengers', 'BRIEF PASSENGERS', 30, 45, 190, 78],
  ['atc_mayday', 'MAYDAY', 235, 45, 190, 78],
  ['atc_pan_pan', 'PAN PAN PAN', 440, 45, 190, 78],
  ['conduct_continue', 'CONTINUE NORMALLY', 30, 137, 190, 78],
  ['conduct_precautionary', 'ALTERNATE LANDING', 235, 137, 190, 78],
  ['conduct_emergency', 'EMERGENCY LANDING', 440, 137, 190, 78],
];
