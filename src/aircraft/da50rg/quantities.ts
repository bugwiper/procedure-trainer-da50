import { defineQuantities } from '../../engine/quantities';

// DA50 RG named quantities (D-07, D-08). Limits and colour bands are the AFM 02-05 instrument
// markings, the same numbers the MFD gauge frames print (plan 08 makes the MFD read them from
// here). A value on a bound belongs to the lower band, so 125 is high_yellow and 128 is high_red.
// Data only: facts and numbers, no AFM wording.

export const DA50RG_QUANTITIES = defineQuantities([
  {
    id: 'oil_temp_c',
    unit: '°C',
    min: -25,
    max: 150,
    idle: 15,
    bands: [
      { id: 'low_yellow', colour: 'yellow', to: 50 },
      { id: 'green', colour: 'green', to: 115 },
      { id: 'high_yellow', colour: 'yellow', to: 125 },
      { id: 'high_red', colour: 'red', to: 150 },
    ],
  },
  {
    id: 'oil_pressure_bar',
    unit: 'bar',
    min: 0,
    max: 9,
    idle: 0,
    bands: [
      { id: 'low_red', colour: 'red', to: 2 },
      { id: 'low_yellow', colour: 'yellow', to: 3.5 },
      { id: 'green', colour: 'green', to: 7 },
      { id: 'high_yellow', colour: 'yellow', to: 7.5 },
      { id: 'high_red', colour: 'red', to: 9 },
    ],
  },
]);
