import { defineQuantities } from '../../engine/quantities';

// DA50 RG named quantities (D-07, D-08, D-12). Limits and colour bands are the AFM 02-05 instrument
// markings, once, here: the MFD gauge frames read their scale and colours from this table (T-03-04).
// A value on a bound belongs to the lower band, so 125 is high_yellow and 128 is high_red. The
// colour 'none' marks an unmarked scale range. Every quantity has a base value: its reading at the
// registry defaults (in-flight cruise), which is also the equilibrium of its model, so the free
// panel shows cruise and no annunciation fires there. alt2_amps, battery_pct and fire_intensity
// have no gauge (hidden quantities); the Amps gauge shows alternator 1 (C-10).
// Data only: facts and numbers, no AFM wording.

/**
 * Fuel burns fractions of a gallon per step (about 0.0003 gal at 11 gph and 100 ms); the default
 * scale of 0.01 would round that away, and 1e-5 would still skew the flow by a percent or more.
 * 1e-7 keeps the quantisation error of a step below 0.02 % of the burn.
 */
const FUEL_SCALE = 10_000_000;

export const DA50RG_QUANTITIES = defineQuantities([
  {
    id: 'rpm',
    unit: 'rpm',
    min: 0,
    max: 2500,
    base: 2100,
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
]);
