import { defineFurther } from '../../engine/further';

/**
 * The further actions of a situation (Phase 7, D-06, D-07): the decisions that are not panel
 * actions, offered in the FURTHER ACTIONS modal. The list is fixed for the aircraft; a scenario
 * declares the role of each action and the flight conduct that is right (or none, on the ground) in
 * its `further` section. The texts are own wording (docs/CONTENT-POLICY.md). Only the option ids
 * and these texts live here; no id is named anywhere else in the application code.
 */
export const DA50RG_FURTHER = defineFurther({
  groups: [{ id: 'atc', text: 'Inform ATC' }],
  options: [
    { id: 'atc_mayday', text: 'MAYDAY (121.5 or current frequency)', kind: 'action', group: 'atc' },
    { id: 'atc_pan_pan', text: 'PAN PAN PAN (advise ATC)', kind: 'action', group: 'atc' },
    {
      id: 'brief_passengers',
      text: 'Brief passengers (if time permits)',
      kind: 'action',
      // Never required, never fails a run (D-08, R17): lint L27 enforces it.
      unrated: true,
    },
    { id: 'conduct_continue', text: 'Continue flight normally', kind: 'conduct' },
    {
      id: 'conduct_precautionary',
      text: 'Initiate precautionary (alternate) landing',
      kind: 'conduct',
    },
    {
      id: 'conduct_emergency',
      text: 'Initiate emergency landing',
      kind: 'conduct',
      debriefNote: 'The emergency landing itself is not trained yet.',
    },
  ],
  conductTitle: 'Choose further flight conduct',
  /** The profile parameter that puts the aircraft on the ground (physics.ts): no conduct decision there. */
  groundParameter: 'ground_roll',
});
