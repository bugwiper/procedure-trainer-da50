import { defineCues } from '../../engine/cues';
import { DA50RG_QUANTITIES } from './quantities';

// DA50 RG visual cues (Phase 5, W-05): each is a simulated quantity read as a level 0 to 1 that the
// windscreen layer draws. Art values, not AFM numbers: they are listed for the instructor review.
// A cue id never equals a physics parameter id (tests/cues.test.ts).
export const DA50RG_CUES = defineCues(
  [
    // Flames and a smoke trail over the cowl. fire_intensity runs 0 to 100; the art is at full size
    // from 60 (a developed fire); a scenario that starts at 40 shows it at once.
    { id: 'flames', quantity: 'fire_intensity', from: 0, to: 60 },
    // Smoke in the cabin over the panel (C-02): smoke_density runs 0 to 100; the overlay is at full
    // strength from 70.
    { id: 'cabin_smoke', quantity: 'smoke_density', from: 0, to: 70 },
    // Ice on the windscreen, per half (C-05): the veil is at full strength from 60.
    { id: 'ice_pilot_side', quantity: 'ice_pilot', from: 0, to: 60 },
    { id: 'ice_copilot_side', quantity: 'ice_copilot', from: 0, to: 60 },
    // The propeller stands still (C-06): the cue reads the engine speed and runs the other way, from
    // 600 rpm (level 0, the blur) down to 0 (level 1, a crisp blade). ENGINE MASTER off shows it.
    { id: 'prop_stopped', quantity: 'rpm', from: 600, to: 0 },
    // Oil streaks running back over the glass (C-06): the oil film is at full strength from 50.
    { id: 'oil_streaks', quantity: 'oil_film', from: 0, to: 50 },
  ],
  DA50RG_QUANTITIES,
);
