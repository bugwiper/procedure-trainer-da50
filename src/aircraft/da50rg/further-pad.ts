/**
 * The footwell cluster of the further actions (Phase 7, plan 07-05, R-07; reworked on 2026-11-02 after
 * the owner feedback and again in plan 07-06, R-21): nine toggle buttons in the trainer region
 * `further_area`, on the plate `further-pad` between the under-panel row and the toe brakes of the
 * pilot's footwell. Slots are region-local (origin: top left of the region, 514 x 264 units), one per
 * option id of `further.ts`; the static labels are the `label` of those options. The plate carries
 * the static headline FURTHER ACTIONS (`FURTHER_TITLE` in plates.ts) above the buttons. Three rows of
 * three: the three flight conducts on top (continue to destination, alternate landing, emergency
 * landing; drawn only when the scenario offers a conduct, R-09), then brief passengers and the two
 * ATC calls (always drawn), then the three Avoid actions (drawn like the conducts, R-21; the row
 * stays empty where no conduct is offered so no button moves between scenarios). Measured values:
 * slots 150 x 60 with 7 units between the columns and 5 between the rows (the cluster is 464 x 190); the region stands
 * 25 units from the cluster left and right, 35 above it and 39 below it, so the zoomed view leaves
 * room for the Full panel corner above and below the buttons on a landscape phone (a run leaves
 * about 300 px of height there) and the buttons stay 44 px high on a portrait phone 393 px wide
 * (44.2 px; the starting value of the plan, 58 units high, gave 42.7 px). Independent reference:
 * tests/further-pad-reference.ts.
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
  region: { w: 514, h: 264 },
  slots: [
    { id: 'conduct_destination', x: 25, y: 35, w: 150, h: 60 },
    { id: 'conduct_precautionary', x: 182, y: 35, w: 150, h: 60 },
    { id: 'conduct_emergency', x: 339, y: 35, w: 150, h: 60 },
    { id: 'brief_passengers', x: 25, y: 100, w: 150, h: 60 },
    { id: 'atc_mayday', x: 182, y: 100, w: 150, h: 60 },
    { id: 'atc_pan_pan', x: 339, y: 100, w: 150, h: 60 },
    { id: 'avoid_imc', x: 25, y: 165, w: 150, h: 60 },
    { id: 'avoid_nvfr', x: 182, y: 165, w: 150, h: 60 },
    { id: 'avoid_icing', x: 339, y: 165, w: 150, h: 60 },
  ],
};
