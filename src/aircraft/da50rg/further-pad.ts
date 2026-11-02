/**
 * The footwell cluster of the further actions (Phase 7, plan 07-05, R-07): six toggle buttons in the
 * trainer region `further_area`, on the plate `further-pad` between the under-panel row and the toe
 * brakes of the pilot's footwell. Slots are region-local (origin: top left of the region, 660 x 260
 * units), one per option id of `further.ts`; the static caps labels are the `label` of those options.
 * The cluster (600 x 170) stands in the middle of the region: the zoomed view then leaves room above
 * and below it for the Full panel corner on a landscape phone, where a run leaves about 300 px of
 * height, and the buttons stay 44 px high on a portrait phone (e2e/further.spec.ts). Top row: brief
 * passengers and the two calls; bottom row: the three flight conducts (drawn only when the scenario
 * offers a conduct, R-09). Independent reference: tests/further-pad-reference.ts.
 */
/** A region-local rectangle in panel units. */
export interface SlotRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface FurtherSlot extends SlotRect {
  /** The option id of `further.ts` the slot belongs to. */
  readonly id: string;
}

export const FURTHER_PAD: {
  /** Size of the region in panel units. */
  readonly region: { readonly w: number; readonly h: number };
  readonly slots: readonly FurtherSlot[];
} = {
  region: { w: 660, h: 260 },
  slots: [
    { id: 'brief_passengers', x: 30, y: 45, w: 190, h: 78 },
    { id: 'atc_mayday', x: 235, y: 45, w: 190, h: 78 },
    { id: 'atc_pan_pan', x: 440, y: 45, w: 190, h: 78 },
    { id: 'conduct_continue', x: 30, y: 137, w: 190, h: 78 },
    { id: 'conduct_precautionary', x: 235, y: 137, w: 190, h: 78 },
    { id: 'conduct_emergency', x: 440, y: 137, w: 190, h: 78 },
  ],
};
