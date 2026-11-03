import { defineCues } from '../../engine/cues';
import { DA50RG_QUANTITIES, TERRAIN_HEIGHT_FT, WATER_LEVEL_FT } from './quantities';

// DA50 RG visual cues (Phase 5, W-05): each is a simulated quantity read as a level 0 to 1 that the
// windscreen layer draws. Art values, not AFM numbers: they are listed for the instructor review.
// A cue id never equals a physics parameter id (tests/cues.test.ts).

/**
 * Below this engine speed (rpm) the engine counts as stopped: the engine drone is silent and the
 * windscreen shows the crisp propeller blade instead of the faint spinning disc. Defined once.
 */
export const ENGINE_RPM_STOPPED = 100;

/**
 * The height above the terrain (ft) at which the landing field of the approach scene first shows as
 * a speck (Phase 9, D-06). An instructor-review value, not an AFM figure.
 */
export const FIELD_SIGHT_FT = 1200;

/**
 * The height above the water (ft) at which the waves of the ditching scene first show (Phase 9,
 * R-03). An instructor-review value, not an AFM figure; the ditching starts 450 ft above the water,
 * so the waves are on the way from the first frame.
 */
export const WATER_SIGHT_FT = 600;

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
    // The propeller stands still (C-06): a two-state cue on the engine speed. It is 0 from
    // ENGINE_RPM_STOPPED up (the faint spinning disc) and 1 within one rpm below it (the crisp
    // blade); the layer reads any level above 0 as stopped. ENGINE MASTER off shows it.
    { id: 'prop_stopped', quantity: 'rpm', from: ENGINE_RPM_STOPPED, to: ENGINE_RPM_STOPPED - 1 },
    // Oil streaks running back over the glass (C-06): the oil film is at full strength from 50.
    { id: 'oil_streaks', quantity: 'oil_film', from: 0, to: 50 },
    // The runway marks of the take-off roll scroll at a rate that follows the ground speed (Phase
    // 5.1, P-04): 0 stands still, full rate from 60 kt.
    { id: 'roll_speed', quantity: 'ground_speed_kt', from: 0, to: 60 },
    // The landing field of the approach scene (Phase 9, D-06): a falling cue on the altitude, level 0
    // FIELD_SIGHT_FT above the terrain and level 1 at the terrain. The ground of the approach scene
    // is the aircraft's normal terrain (TERRAIN_HEIGHT_FT, the normal of the parameter terrain_ft);
    // a scenario on that scene keeps it. The windscreen and the synthetic vision both read the level.
    {
      id: 'field_near',
      quantity: 'altitude_ft',
      from: TERRAIN_HEIGHT_FT + FIELD_SIGHT_FT,
      to: TERRAIN_HEIGHT_FT,
    },
    // The sea of the ditching scene (Phase 9, R-03): a falling cue on the altitude, level 0 WATER_SIGHT_FT
    // above the water and level 1 at the water (WATER_LEVEL_FT). The wave bands come toward the pilot
    // with it, on the windscreen and on the PFD synthetic vision.
    {
      id: 'water_near',
      quantity: 'altitude_ft',
      from: WATER_LEVEL_FT + WATER_SIGHT_FT,
      to: WATER_LEVEL_FT,
    },
  ],
  DA50RG_QUANTITIES,
);
