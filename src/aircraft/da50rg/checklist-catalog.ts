import { defineCatalog } from '../../engine/catalog';

/**
 * The checklist catalog of the DA50 RG (Phase 7, plan 07-06, R-16): the contents pages of the
 * emergency checklist booklet (edition 4.1) in its three printed groups. The tags are the printed
 * message tags as the owner typed them (checklist text policy, docs/CONTENT-POLICY.md section 2); the
 * short tab labels are own wording for the narrow pad. An entry links to a shipped scenario by `ref`;
 * an entry without one is shown greyed in the Realistic checklist chooser and is not listed on the
 * pad. Group three holds the shipped procedures under the checklist headings of their files; the
 * printed procedures without a scenario are a todo until the owner names their exact headings. The
 * independent hand-typed copy is tests/checklist-catalog-reference.ts; `npm run validate` checks
 * every shipped scenario against this data (lint L29 and L30).
 */
export const DA50RG_CATALOG = defineCatalog({
  source: 'src/aircraft/da50rg/checklist-catalog.ts',
  groups: [
    {
      id: 'warnings',
      heading: 'ANNUNCIATED WARNINGS',
      tab: 'WARNINGS',
      entries: [
        { tag: 'ALTN 1 AMPS / ALTN 2 AMPS' },
        { tag: 'ALTN 1 FAIL AND ALTN 2 FAIL' },
        { tag: 'COOLANT TEMP' },
        { tag: 'ENG INTAKE' },
        { tag: 'ENG OIL TEMP', ref: { pack: 'engine', scenario: 'eng-oil-temp-green' } },
        { tag: 'FUEL PRESS' },
        { tag: 'GB OIL TEMP' },
        { tag: 'L DOOR OPEN / R DOOR OPEN / REAR DOOR OPEN' },
        { tag: 'L FUEL TEMP / R FUEL TEMP' },
        { tag: 'OIL PRES' },
        { tag: 'STARTER' },
      ],
    },
    {
      id: 'cautions',
      heading: 'ANNUNCIATED CAUTIONS',
      tab: 'CAUTIONS',
      entries: [
        { tag: 'ALTN 1 FAIL', ref: { pack: 'electrical', scenario: 'elec-altn1-fail' } },
        { tag: 'ALTN 2 FAIL', ref: { pack: 'electrical', scenario: 'elec-altn2-fail' } },
        { tag: 'CHECK GEAR' },
        { tag: 'COOLANT LVL' },
        { tag: 'ECU A FAIL' },
        { tag: 'ECU B FAIL' },
        { tag: 'ENG INTAKE' },
        { tag: 'FUEL LOW' },
        { tag: 'PITOT FAIL' },
        { tag: 'PITOT HT OFF' },
        { tag: 'STALL HT FAIL' },
        { tag: 'STALL HT OFF' },
        { tag: 'STALL WARN FAIL' },
        { tag: 'VOLTS LOW' },
        { tag: 'DEIC LVL LO' },
        { tag: 'DEIC PRES LO' },
        { tag: 'DEIC PRES HI' },
        { tag: 'PROP DE-ICE FAIL' },
        { tag: 'OXY PRESS LO', detail: 'below 500 psi' },
        { tag: 'OXY PRESS LO', detail: 'below 850 psi' },
      ],
    },
    {
      id: 'emergency',
      heading: 'NON-ANNUNCIATED EMERGENCY PROCEDURES',
      tab: 'EMERGENCY',
      entries: [
        {
          tag: 'EMERGENCY LANDING (ENGINE OFF)',
          ref: { pack: 'landing', scenario: 'landing-engine-off' },
        },
        // Booklet page 10, directly after page 9 (printed page order).
        { tag: 'DITCHING', ref: { pack: 'landing', scenario: 'ditching' } },
        { tag: 'ENGINE FIRE IN FLIGHT', ref: { pack: 'engine', scenario: 'eng-fire-in-flight' } },
        { tag: 'ENGINE FIRE ON GROUND', ref: { pack: 'fire', scenario: 'eng-fire-ground' } },
        {
          tag: 'ELECTRIC FIRE / SMOKE ON GROUND',
          ref: { pack: 'fire', scenario: 'elec-fire-ground' },
        },
        {
          tag: 'FIRE / SMOKE DURING ABORTED TKOF',
          ref: { pack: 'fire', scenario: 'takeoff-fire-abort' },
        },
        {
          tag: 'FIRE / SMOKE DURING CONTINUED TKOF',
          ref: { pack: 'fire', scenario: 'takeoff-fire-no-abort' },
        },
        {
          tag: 'ELECTRIC FIRE WITH SMOKE IN FLIGHT',
          ref: { pack: 'fire', scenario: 'elec-fire-flight' },
        },
        {
          tag: 'UNINTENTIONAL FLIGHT INTO ICING',
          ref: { pack: 'icing', scenario: 'icing-unintentional' },
        },
      ],
    },
  ],
});
