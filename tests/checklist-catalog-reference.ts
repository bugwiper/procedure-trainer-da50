// The checklist catalog of the booklet (Phase 7, plan 07-06, R-16), typed in by hand from the
// owner's transcription of the contents pages (pages 1 and 27 of the booklet, edition 4.1) and
// independent of src/aircraft/da50rg/checklist-catalog.ts. Three groups with their printed headings
// and the short tab labels of the narrow pad (since plan 09-05, R-17, two lines each, a line feed breaks them), then one row per printed entry: [tag, detail or null,
// link or null]. The link is "pack/scenario" of the shipped scenario; an entry without one is
// shown greyed in the Realistic checklist chooser and is not listed on the pad. No count is typed:
// the tests derive every number from these rows.

export interface CatalogReferenceGroup {
  readonly id: string;
  readonly heading: string;
  readonly tab: string;
  /** [tag, detail, link] */
  readonly rows: readonly (readonly [string, string | null, string | null])[];
}

export const CATALOG_REFERENCE: readonly CatalogReferenceGroup[] = [
  {
    id: 'warnings',
    heading: 'ANNUNCIATED WARNINGS',
    tab: 'Annunciated\nWARNINGS',
    rows: [
      ['ALTN 1 AMPS / ALTN 2 AMPS', null, null],
      ['ALTN 1 FAIL AND ALTN 2 FAIL', null, null],
      ['COOLANT TEMP', null, null],
      ['ENG INTAKE', null, null],
      ['ENG OIL TEMP', null, 'engine/eng-oil-temp-green'],
      ['FUEL PRESS', null, null],
      ['GB OIL TEMP', null, null],
      ['L DOOR OPEN / R DOOR OPEN / REAR DOOR OPEN', null, null],
      ['L FUEL TEMP / R FUEL TEMP', null, null],
      ['OIL PRES', null, null],
      ['STARTER', null, null],
    ],
  },
  {
    id: 'cautions',
    heading: 'ANNUNCIATED CAUTIONS',
    tab: 'Annunciated\nCAUTIONS',
    rows: [
      ['ALTN 1 FAIL', null, 'electrical/elec-altn1-fail'],
      ['ALTN 2 FAIL', null, 'electrical/elec-altn2-fail'],
      ['CHECK GEAR', null, null],
      ['COOLANT LVL', null, null],
      ['ECU A FAIL', null, null],
      ['ECU B FAIL', null, null],
      ['ENG INTAKE', null, null],
      ['FUEL LOW', null, null],
      ['PITOT FAIL', null, null],
      ['PITOT HT OFF', null, null],
      ['STALL HT FAIL', null, null],
      ['STALL HT OFF', null, null],
      ['STALL WARN FAIL', null, null],
      ['VOLTS LOW', null, null],
      ['DEIC LVL LO', null, null],
      ['DEIC PRES LO', null, null],
      ['DEIC PRES HI', null, null],
      ['PROP DE-ICE FAIL', null, null],
      ['OXY PRESS LO', 'below 500 psi', null],
      ['OXY PRESS LO', 'below 850 psi', null],
    ],
  },
  {
    id: 'emergency',
    heading: 'NON-ANNUNCIATED EMERGENCY PROCEDURES',
    tab: 'Non-annunciated\nEMERGENCIES',
    rows: [
      ['EMERGENCY LANDING (ENGINE OFF)', null, 'landing/landing-engine-off'],
      ['DITCHING', null, 'landing/ditching'],
      ['ENGINE FIRE IN FLIGHT', null, 'engine/eng-fire-in-flight'],
      ['ENGINE FIRE ON GROUND', null, 'fire/eng-fire-ground'],
      ['ELECTRIC FIRE / SMOKE ON GROUND', null, 'fire/elec-fire-ground'],
      ['FIRE / SMOKE DURING ABORTED TKOF', null, 'fire/takeoff-fire-abort'],
      ['FIRE / SMOKE DURING CONTINUED TKOF', null, 'fire/takeoff-fire-no-abort'],
      ['ELECTRIC FIRE WITH SMOKE IN FLIGHT', null, 'fire/elec-fire-flight'],
      ['UNINTENTIONAL FLIGHT INTO ICING', null, 'icing/icing-unintentional'],
    ],
  },
];

/**
 * The resulting listing order of the shipped scenarios: group by group, the linked entries in the
 * printed order. This is the order of CHOOSE SITUATION and of Next situation. Rows of
 * [pack, scenario], typed by hand and not read from the rows above.
 */
export const CATALOG_LISTING_ORDER: readonly (readonly [string, string])[] = [
  ['engine', 'eng-oil-temp-green'],
  ['electrical', 'elec-altn1-fail'],
  ['electrical', 'elec-altn2-fail'],
  ['landing', 'landing-engine-off'],
  ['landing', 'ditching'],
  ['engine', 'eng-fire-in-flight'],
  ['fire', 'eng-fire-ground'],
  ['fire', 'elec-fire-ground'],
  ['fire', 'takeoff-fire-abort'],
  ['fire', 'takeoff-fire-no-abort'],
  ['fire', 'elec-fire-flight'],
  ['icing', 'icing-unintentional'],
];

/** The group id of a shipped scenario ("pack/scenario"), read from the reference rows. */
export function referenceGroupOf(link: string): string | undefined {
  return CATALOG_REFERENCE.find((group) => group.rows.some((row) => row[2] === link))?.id;
}
