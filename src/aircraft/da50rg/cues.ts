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
  ],
  DA50RG_QUANTITIES,
);
