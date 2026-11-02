import { defineFurther } from '../../engine/further';

/**
 * The further actions of a situation (Phase 7, D-06, D-07): the decisions that are not panel
 * actions, offered as the nine toggle buttons of the pilot footwell (further-pad.ts): the three flight
 * conducts, the calls and the passengers, and the three Avoid actions. The list is fixed for the aircraft; a scenario
 * declares the role of each action and the flight conduct that is right (or none, on the ground) in
 * its `further` section. A line feed in a label breaks it into two lines on the button. The texts are own wording (docs/CONTENT-POLICY.md). Only the option ids
 * and these texts live here; no id is named anywhere else in the application code.
 */
export const DA50RG_FURTHER = defineFurther({
  options: [
    {
      id: 'atc_mayday',
      text: 'MAYDAY (121.5 or current frequency)',
      label: 'ATC: MAYDAY',
      kind: 'action',
    },
    {
      id: 'atc_pan_pan',
      text: 'PAN PAN PAN (advise ATC)',
      label: 'ATC notify\n(PAN PAN PAN)',
      kind: 'action',
    },
    {
      id: 'brief_passengers',
      text: 'Brief passengers (if time permits)',
      label: 'Brief passengers\n(if time permits)',
      kind: 'action',
      // Never required, never fails a run (D-08, R17): lint L27 enforces it.
      unrated: true,
    },
    {
      id: 'avoid_imc',
      text: 'Avoid IMC',
      label: 'Avoid IMC',
      kind: 'action',
      // The Avoid actions qualify the decision to continue; never required, never failing (L27).
      unrated: true,
      avoid: true,
    },
    {
      id: 'avoid_nvfr',
      text: 'Avoid NVFR',
      label: 'Avoid NVFR',
      kind: 'action',
      unrated: true,
      avoid: true,
    },
    {
      id: 'avoid_icing',
      text: 'Avoid icing',
      label: 'Avoid icing',
      kind: 'action',
      unrated: true,
      avoid: true,
    },
    {
      id: 'conduct_destination',
      text: 'Continue to destination',
      label: 'CONTINUE TO\nDESTINATION',
      kind: 'conduct',
    },
    {
      id: 'conduct_precautionary',
      text: 'Initiate precautionary (alternate) landing',
      label: 'ALTERNATE\nLANDING',
      kind: 'conduct',
    },
    {
      id: 'conduct_emergency',
      text: 'Initiate emergency landing',
      label: 'EMERGENCY\nLANDING',
      kind: 'conduct',
      debriefNote: 'The emergency landing itself is not trained yet.',
    },
  ],
  conductTitle: 'Choose further flight conduct',
  /** The profile parameter that puts the aircraft on the ground (physics.ts): no conduct decision there. */
  groundParameter: 'ground_roll',
  /**
   * "Continue to destination" is selected when a run starts, without a press (owner decision 2026-11-02):
   * to deviate the pilot must press another conduct button, and the choice is never cleared.
   */
  defaultConduct: 'conduct_destination',
  /** The conduct a `conduct_note` of a scenario speaks of (plan 07-06, R-22): continuing under VFR. */
  noteConduct: 'conduct_destination',
});
