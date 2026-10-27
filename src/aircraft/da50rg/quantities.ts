import { defineQuantities } from '../../engine/quantities';

// DA50 RG named quantities (D-07, D-08, D-12). Limits and colour bands are the AFM 02-05 instrument
// markings, once, here: the MFD gauge frames read their scale and colours from this table (T-03-04).
// A value on a bound belongs to the lower band, so 125 is high_yellow and 128 is high_red. The
// colour 'none' marks an unmarked scale range. Every quantity has a base value: its reading at the
// registry defaults (in-flight cruise), which is also the equilibrium of its model, so the free
// panel shows cruise and no annunciation fires there. alt2_amps, battery_pct, fire_intensity and the
// windscreen quantities (smoke_density, ice_pilot, ice_copilot, oil_film) have no gauge (hidden
// quantities); the Amps gauge shows alternator 1 (C-10).
// Data only: facts and numbers, no AFM wording.

/**
 * Fuel burns fractions of a gallon per step (about 0.0003 gal at 11 gph and 100 ms); the default
 * scale of 0.01 would round that away, and 1e-5 would still skew the flow by a percent or more.
 * 1e-7 keeps the quantisation error of a step below 0.02 % of the burn.
 */
const FUEL_SCALE = 10_000_000;

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
      { id: 'low_yellow', colour: 'yellow', to: 50 },
      { id: 'green', colour: 'green', to: 105 },
      { id: 'high_yellow', colour: 'yellow', to: 110 },
      { id: 'high_red', colour: 'red', to: 125 },
    ],
  },
  {
    id: 'fuel_temp_c',
    unit: '°C',
    min: -30,
    max: 70,
    base: 20,
    bands: [
      { id: 'low_red', colour: 'red', to: -25 },
      { id: 'low_yellow', colour: 'yellow', to: -20 },
      { id: 'green', colour: 'green', to: 55 },
      { id: 'high_yellow', colour: 'yellow', to: 60 },
      { id: 'high_red', colour: 'red', to: 70 },
    ],
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
    max: 30,
    base: 20,
    scale: FUEL_SCALE,
    bands: [
      { id: 'low_red', colour: 'red', to: 1 },
      { id: 'green', colour: 'green', to: 25 },
      { id: 'unmarked', colour: 'none', to: 30 },
    ],
  },
  {
    id: 'fuel_qty_rh_gal',
    unit: 'gal',
    min: 0,
    max: 30,
    base: 20,
    scale: FUEL_SCALE,
    bands: [
      { id: 'low_red', colour: 'red', to: 1 },
      { id: 'green', colour: 'green', to: 24 },
      { id: 'unmarked', colour: 'none', to: 30 },
    ],
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
]);
