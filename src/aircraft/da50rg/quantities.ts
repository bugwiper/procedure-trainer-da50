import { defineQuantities } from '../../engine/quantities';

// DA50 RG named quantities (D-07, D-08, D-12). Limits and colour bands are the AFM 02-05 instrument
// markings, once, here: the MFD gauge frames read their scale and colours from this table (T-03-04).
// A value on a bound belongs to the lower band, so 125 is high_yellow and 128 is high_red. The
// colour 'none' marks an unmarked scale range. Every quantity has a base value: its reading at the
// registry defaults (in-flight cruise), which is also the equilibrium of its model, so the free
// panel shows cruise and no annunciation fires there. alt2_amps, battery_pct, fire_intensity, the
// windscreen quantities (smoke_density, ice_pilot, ice_copilot, oil_film), ground_speed_kt, the stall
// heat timer and the fuel quantities of Phase 6 (fuel_trans_active, fuel_flow_gph, fuel_used_gal) have no gauge of their
// own (hidden quantities); the Amps gauge shows alternator 1 (C-10). rudder_trim_pct, oxygen_psi,
// deice_qty_gal and service_hours are static display values of the engine page (Phase 6, plan 02,
// E-05): no model moves them (the de-ice quantity has a rate model in physics.ts), a scenario may
// set them, and their bases and bands are layout assumptions, not AFM figures. The fuel temperatures, the
// two tank quantities (0 to the tank capacity, one band table) and the fuel flow are the Phase 6 fuel
// model (physics.ts).
// The low red ends of the oil, coolant and gearbox temperature bars (below 0 degrees C) are own
// values from the owner's photo of the real display (Phase 6 walkthrough), not AFM figures.
// Data only: facts and numbers, no AFM wording.

/**
 * Fuel burns fractions of a gallon per step (about 0.0003 gal at 11 gph and 100 ms); the default
 * scale of 0.01 would round that away, and 1e-5 would still skew the flow by a percent or more.
 * 1e-7 keeps the quantisation error of a step below 0.02 % of the burn.
 */
const FUEL_SCALE = 10_000_000;

/** Each fuel tank holds this many US gallons (owner, 2026-10-28); both tanks share one band table. */
export const TANK_CAPACITY_GAL = 26;
/**
 * On the ground the stall heat cuts out this many seconds after it is on (owner, 2026-10-28, D-12;
 * the figure is an instructor-review value, "a few seconds"). The hidden timer `stall_heat_timer_s`
 * counts the seconds, and its band `cut` starts above this value.
 */
export const STALL_HEAT_CUTOUT_S = 5;
/**
 * The fuel temperatures follow their target with a 60 s lag (physics.ts): a step of a degree-sized
 * gap is 1 / 600 of it, which the default scale of 0.01 would round away and stall a few degrees
 * short of the target. 1e-6 keeps the stall below 0.001 degrees.
 */
const FUEL_TEMP_SCALE = 1_000_000;
const FUEL_TEMP_BANDS = [
  { id: 'low_red', colour: 'red', to: -25 },
  { id: 'low_yellow', colour: 'yellow', to: -20 },
  { id: 'green', colour: 'green', to: 55 },
  { id: 'high_yellow', colour: 'yellow', to: 60 },
  { id: 'high_red', colour: 'red', to: 70 },
] as const;
const TANK_BANDS = [
  { id: 'low_red', colour: 'red', to: 1 },
  { id: 'green', colour: 'green', to: TANK_CAPACITY_GAL },
] as const;

/**
 * The oil temperature climbs by 0.002 to 0.01 degrees per step in the slow part of its rate curve
 * (oil-temp-curve.ts); the default scale of 0.01 would round that to all or nothing and turn the
 * slow rise into a fixed 0.1 degrees per second. 1e-4 keeps the quantisation error of a step below
 * 5 % of the slowest step.
 */
const OIL_TEMP_SCALE = 10_000;

/**
 * The windscreen quantities (smoke, ice, oil film) move slowly: a lag step near its target is below
 * 0.005, which the default scale of 0.01 would round away and stall short of the target.
 */
const SLOW_SCALE = 10_000;

export const DA50RG_QUANTITIES = defineQuantities([
  {
    id: 'rpm',
    unit: 'rpm',
    min: 0,
    max: 2500,
    // The propeller set curve at the cruise lever (70 %), read from a photo (prop-curve.ts).
    base: 1995,
    bands: [
      { id: 'green', colour: 'green', to: 2300 },
      { id: 'high_yellow', colour: 'yellow', to: 2340 },
      { id: 'high_red', colour: 'red', to: 2500 },
    ],
  },
  {
    id: 'load_pct',
    unit: '%',
    min: 0,
    max: 100,
    base: 70,
    bands: [
      { id: 'green', colour: 'green', to: 90 },
      { id: 'high_yellow', colour: 'yellow', to: 100 },
    ],
  },
  {
    id: 'oil_pressure_bar',
    unit: 'bar',
    min: 0,
    max: 9,
    base: 5,
    bands: [
      { id: 'low_red', colour: 'red', to: 2 },
      { id: 'low_yellow', colour: 'yellow', to: 3.5 },
      { id: 'green', colour: 'green', to: 7 },
      { id: 'high_yellow', colour: 'yellow', to: 7.5 },
      { id: 'high_red', colour: 'red', to: 9 },
    ],
  },
  {
    id: 'oil_temp_c',
    unit: '°C',
    min: -25,
    max: 150,
    // The cruise equilibrium of the oil temperature model (cooling 1, POWER at its default).
    base: 91,
    scale: OIL_TEMP_SCALE,
    bands: [
      { id: 'low_red', colour: 'red', to: 0 },
      { id: 'low_yellow', colour: 'yellow', to: 50 },
      { id: 'green', colour: 'green', to: 115 },
      { id: 'high_yellow', colour: 'yellow', to: 125 },
      { id: 'high_red', colour: 'red', to: 150 },
    ],
  },
  {
    id: 'coolant_temp_c',
    unit: '°C',
    min: -25,
    max: 125,
    base: 85,
    bands: [
      { id: 'low_red', colour: 'red', to: 0 },
      { id: 'low_yellow', colour: 'yellow', to: 60 },
      { id: 'green', colour: 'green', to: 101 },
      { id: 'high_yellow', colour: 'yellow', to: 105 },
      { id: 'high_red', colour: 'red', to: 125 },
    ],
  },
  {
    id: 'gearbox_temp_c',
    unit: '°C',
    min: -25,
    max: 125,
    base: 75,
    bands: [
      { id: 'low_red', colour: 'red', to: 0 },
      { id: 'low_yellow', colour: 'yellow', to: 50 },
      { id: 'green', colour: 'green', to: 105 },
      { id: 'high_yellow', colour: 'yellow', to: 110 },
      { id: 'high_red', colour: 'red', to: 125 },
    ],
  },
  {
    // The fuel temperature of the left and the right tank (Phase 6, D-04c, D-04d). The red zones start
    // at the owner's limits, -25 and +60 degrees C; the scale is drawn wider so the red ends show.
    id: 'fuel_temp_lh_c',
    unit: '°C',
    min: -30,
    max: 70,
    base: 23,
    scale: FUEL_TEMP_SCALE,
    bands: FUEL_TEMP_BANDS,
  },
  {
    id: 'fuel_temp_rh_c',
    unit: '°C',
    min: -30,
    max: 70,
    base: 20,
    scale: FUEL_TEMP_SCALE,
    bands: FUEL_TEMP_BANDS,
  },
  {
    id: 'fuel_pressure_bar',
    unit: 'bar',
    min: -0.5,
    max: 1.5,
    base: 0.4,
    bands: [
      { id: 'low_red', colour: 'red', to: -0.3 },
      { id: 'green', colour: 'green', to: 1 },
      { id: 'high_red', colour: 'red', to: 1.5 },
    ],
  },
  {
    id: 'fuel_qty_lh_gal',
    unit: 'gal',
    min: 0,
    max: TANK_CAPACITY_GAL,
    base: 20,
    scale: FUEL_SCALE,
    bands: TANK_BANDS,
  },
  {
    id: 'fuel_qty_rh_gal',
    unit: 'gal',
    min: 0,
    max: TANK_CAPACITY_GAL,
    base: 20,
    scale: FUEL_SCALE,
    bands: TANK_BANDS,
  },
  {
    // Hidden: no gauge. 1 while the FUEL TRANS pump runs, else 0 (Phase 6, D-04b); the white FUEL
    // TRANS message reads the active band, so no number enters the CAS table.
    id: 'fuel_trans_active',
    unit: '',
    min: 0,
    max: 1,
    base: 0,
    bands: [
      { id: 'idle', colour: 'none', to: 0.5 },
      { id: 'active', colour: 'none', to: 1 },
    ],
  },
  {
    // The fuel flow in US gallons per hour, derived from the engine state (Phase 6, F-07). The base is
    // the cruise equilibrium of the fitted line (physics.ts), 3.3 + 0.11333 * 70 = 11.23 gph. One
    // unmarked band: the engine page draws it as a number.
    id: 'fuel_flow_gph',
    unit: 'gph',
    min: 0,
    max: 30,
    base: 11.23,
    bands: [{ id: 'unmarked', colour: 'none', to: 30 }],
  },
  {
    // The fuel used, US gallons (F-08). The base is the 52 gal capacity less the 40 gal of the two
    // base tanks. Refuelling and the RST Fuel softkey are not modelled. One unmarked band.
    id: 'fuel_used_gal',
    unit: 'gal',
    min: 0,
    max: 1000,
    base: 12,
    scale: FUEL_SCALE,
    bands: [{ id: 'unmarked', colour: 'none', to: 1000 }],
  },
  {
    // Static display value (E-05): the rudder trim position in percent of travel, 0 is neutral. One
    // unmarked band. The base is a layout assumption.
    id: 'rudder_trim_pct',
    unit: '%',
    min: -100,
    max: 100,
    base: 0,
    bands: [{ id: 'unmarked', colour: 'none', to: 100 }],
  },
  {
    // Static display value (E-05): the oxygen bottle pressure. The base and the bands (red to 250,
    // yellow to 400, green to 1700, unmarked above) are layout assumptions, not AFM figures.
    id: 'oxygen_psi',
    unit: 'psi',
    min: 0,
    max: 2000,
    base: 1270,
    bands: [
      { id: 'low_red', colour: 'red', to: 250 },
      { id: 'low_yellow', colour: 'yellow', to: 400 },
      { id: 'green', colour: 'green', to: 1700 },
      { id: 'unmarked', colour: 'none', to: 2000 },
    ],
  },
  {
    // The de-ice fluid in US gallons. The tank maximum 8.3 is the owner's figure (D-11); the base and
    // the bands (red to 1, green above) are layout assumptions. Fine scale: a NORM step uses only
    // 0.00008 gal and the default scale of 0.01 would round it away (physics.ts, plan 02 task 3).
    id: 'deice_qty_gal',
    unit: 'gal',
    min: 0,
    max: 8.3,
    base: 6.8,
    scale: FUEL_SCALE,
    bands: [
      { id: 'low_red', colour: 'red', to: 1 },
      { id: 'green', colour: 'green', to: 8.3 },
    ],
  },
  {
    // Static display value (E-05): the total service hours of the engine. One unmarked band.
    id: 'service_hours',
    unit: 'h',
    min: 0,
    max: 99999,
    base: 249.5,
    bands: [{ id: 'unmarked', colour: 'none', to: 99999 }],
  },
  {
    id: 'bus_volts',
    unit: 'V',
    min: 20,
    max: 34,
    base: 28,
    bands: [
      { id: 'low_red', colour: 'red', to: 24.1 },
      { id: 'low_yellow', colour: 'yellow', to: 25 },
      { id: 'green', colour: 'green', to: 30 },
      { id: 'high_yellow', colour: 'yellow', to: 32 },
      { id: 'high_red', colour: 'red', to: 34 },
    ],
  },
  {
    id: 'alt1_amps',
    unit: 'A',
    min: 0,
    max: 80,
    base: 30,
    bands: [
      { id: 'green', colour: 'green', to: 60 },
      { id: 'high_yellow', colour: 'yellow', to: 70 },
      { id: 'high_red', colour: 'red', to: 80 },
    ],
  },
  {
    // Hidden: no gauge. Alternator 2 supplies the essential bus and, with ESS BUS on, the main bus.
    id: 'alt2_amps',
    unit: 'A',
    min: 0,
    max: 80,
    base: 10,
    bands: [
      { id: 'green', colour: 'green', to: 60 },
      { id: 'high_yellow', colour: 'yellow', to: 70 },
      { id: 'high_red', colour: 'red', to: 80 },
    ],
  },
  {
    // Hidden: no gauge. The battery charge, 100 when full.
    id: 'battery_pct',
    unit: '%',
    min: 0,
    max: 100,
    base: 100,
    bands: [
      { id: 'low_red', colour: 'red', to: 20 },
      { id: 'green', colour: 'green', to: 100 },
    ],
  },
  {
    // Hidden: no gauge. The seconds the stall heat has run on the ground with the PITOT/STALL HEAT
    // switch on (Phase 6, plan 04, H-02); held at 0 in the air and with the switch off. The STALL HEAT
    // message of the ground cut-out reads the `cut` band, so no number enters the CAS table.
    id: 'stall_heat_timer_s',
    unit: 's',
    min: 0,
    max: 60,
    base: 0,
    bands: [
      { id: 'warm', colour: 'none', to: STALL_HEAT_CUTOUT_S },
      { id: 'cut', colour: 'none', to: 60 },
    ],
  },
  {
    // Hidden: no gauge. 1 while the alternator control unit of alternator n reports a fault (E-07),
    // else 0; the ALTN n FAIL cautions read the fault band, so no number enters the CAS table.
    id: 'alt1_fault',
    unit: '',
    min: 0,
    max: 1,
    base: 0,
    bands: [
      { id: 'ok', colour: 'none', to: 0.5 },
      { id: 'fault', colour: 'none', to: 1 },
    ],
  },
  {
    id: 'alt2_fault',
    unit: '',
    min: 0,
    max: 1,
    base: 0,
    bands: [
      { id: 'ok', colour: 'none', to: 0.5 },
      { id: 'fault', colour: 'none', to: 1 },
    ],
  },
  {
    // Hidden: no gauge. The intensity of an engine fire, 0 when there is none (plan 03-08, C-44).
    // It grows while fuel feeds the fire and decays once the fuel is cut; the engine temperatures
    // rise with it, which is the only sign the pilot sees. One unmarked band: there is no mark.
    id: 'fire_intensity',
    unit: '%',
    min: 0,
    max: 100,
    base: 0,
    bands: [{ id: 'unmarked', colour: 'none', to: 100 }],
  },
  {
    // Hidden: no gauge. The smoke in the cabin, 0 when there is none (Phase 5, C-02). It follows a
    // scenario parameter; the cabin_smoke cue draws it over the panel. One unmarked band.
    id: 'smoke_density',
    unit: '%',
    min: 0,
    max: 100,
    base: 0,
    scale: SLOW_SCALE,
    bands: [{ id: 'unmarked', colour: 'none', to: 100 }],
  },
  {
    // Hidden: no gauge. The ice on the pilot (left) and the co-pilot (right) half of the windscreen,
    // 0 when clear (Phase 5, C-04). It builds from a scenario parameter, warm air toward the
    // windscreen melts it very slowly and the WIND SHIELD spray clears the pilot side. One unmarked band.
    id: 'ice_pilot',
    unit: '%',
    min: 0,
    max: 100,
    base: 0,
    scale: SLOW_SCALE,
    bands: [{ id: 'unmarked', colour: 'none', to: 100 }],
  },
  {
    id: 'ice_copilot',
    unit: '%',
    min: 0,
    max: 100,
    base: 0,
    scale: SLOW_SCALE,
    bands: [{ id: 'unmarked', colour: 'none', to: 100 }],
  },
  {
    // Hidden: no gauge. How far the aircraft is through the icing area (Phase 5.1, I-02): 0 to 100,
    // it runs while the scenario parameter ice_accretion is above 0 and, once full, the ice stops
    // growing on both sides. It reads nothing else; no cue draws it. One unmarked band.
    id: 'icing_exposure',
    unit: '%',
    min: 0,
    max: 100,
    base: 0,
    scale: SLOW_SCALE,
    bands: [{ id: 'unmarked', colour: 'none', to: 100 }],
  },
  {
    // Hidden: no gauge. The oil film on the windscreen from an oil leak (Phase 5, C-06): grows while
    // the engine runs and never decays. The oil_streaks cue draws it. One unmarked band.
    id: 'oil_film',
    unit: '%',
    min: 0,
    max: 100,
    base: 0,
    scale: SLOW_SCALE,
    bands: [{ id: 'unmarked', colour: 'none', to: 100 }],
  },
  {
    // Hidden: no gauge. The speed over the ground in knots, 0 at rest (Phase 5.1, P-03). Only a
    // scenario that sets the parameter ground_roll moves it (physics.ts); the take-off roll scene
    // scrolls at the rate the roll_speed cue reads from it. One unmarked band.
    id: 'ground_speed_kt',
    unit: 'kt',
    min: 0,
    max: 100,
    base: 0,
    bands: [{ id: 'unmarked', colour: 'none', to: 100 }],
  },
  {
    // Hidden: no gauge. The airspeed the PFD tape shows (Phase 5.1, owner addition of 2026-10-27).
    // The base is the static 140 knots of the free panel and of cruise; on the ground (the parameter
    // ground_roll) it follows ground_speed_kt, in flight it lags toward the speed of the scenario's
    // profile, a training approximation (physics.ts). The fine scale: a lag step near the target is
    // below 0.005 and the default scale of 0.01 would stall the reading short of it. One unmarked band.
    id: 'airspeed_kt',
    unit: 'kt',
    min: 0,
    max: 200,
    base: 140,
    scale: SLOW_SCALE,
    bands: [{ id: 'unmarked', colour: 'none', to: 200 }],
  },
  {
    // Hidden: no gauge. The altitude the PFD tape and readout show (Phase 6, plan 03, V-02). The base
    // is the static 1400 ft of the free panel; a scenario starts at its own altitude and the flight
    // models move it by the vertical speed (physics.ts). The fine scale: a climb of 500 fpm gains
    // 0.8333 ft per step, which the default scale of 0.01 would round to 0.83 and lose 2 ft a minute.
    // One unmarked band.
    id: 'altitude_ft',
    unit: 'ft',
    min: 0,
    max: 20000,
    base: 1400,
    scale: SLOW_SCALE,
    bands: [{ id: 'unmarked', colour: 'none', to: 20000 }],
  },
  {
    // Hidden: no gauge. The vertical speed in feet per minute, the PFD vertical speed scale (V-02).
    // Plus and minus 3000 since Phase 6.1 (D-11: the scale of the real display). Base 0: level
    // flight. One unmarked band.
    id: 'vertical_speed_fpm',
    unit: 'fpm',
    min: -3000,
    max: 3000,
    base: 0,
    bands: [{ id: 'unmarked', colour: 'none', to: 3000 }],
  },
  {
    // Hidden: no gauge. The pitch attitude in degrees, positive nose up; the PFD horizon draws it
    // (Phase 6, plan 03, V-02). Base 0: level. The fine scale of the airspeed. One unmarked band.
    id: 'pitch_deg',
    unit: 'deg',
    min: -30,
    max: 30,
    base: 0,
    scale: SLOW_SCALE,
    bands: [{ id: 'unmarked', colour: 'none', to: 30 }],
  },
  {
    // Hidden: no gauge. The bank angle in degrees, positive to the right; the PFD horizon draws it.
    // Base 0: wings level. One unmarked band.
    id: 'bank_deg',
    unit: 'deg',
    min: -60,
    max: 60,
    base: 0,
    scale: SLOW_SCALE,
    bands: [{ id: 'unmarked', colour: 'none', to: 60 }],
  },
]);
