import { defineCasRules } from '../../engine/cas';
import { DA50RG } from './panel';
import { DA50RG_QUANTITIES } from './quantities';

// DA50 RG CAS rule table (D-06, D-06a, D-07a, D-08): message text, level and trigger are data.
// The chip on the PFD is derived from these rules over the quantities, never set by a scenario.
// Data only: facts and numbers, no AFM wording.

export const DA50RG_CAS = defineCasRules(
  [
    {
      id: 'eng_oil_temp',
      text: 'ENG OIL TEMP',
      level: 'warning',
      // AFM 03-08: the red range of the oil temperature, above 125 degrees C.
      when: { check: 'quantity', quantity: 'oil_temp_c', op: 'gt', value: 125 },
    },
    {
      id: 'oil_pres',
      text: 'OIL PRES',
      level: 'warning',
      // The red ranges of the oil pressure, low and high (AFM 02-05). The correct ENGINE MASTER OFF
      // of the Engine Fire scenario drops the pressure into the low red range, so the warning keeps
      // the chip logic honest (plan 03-08, C-46). Band check: no number here.
      when: { check: 'band', quantity: 'oil_pressure_bar', in: ['low_red', 'high_red'] },
    },
    {
      id: 'altn_1_fail',
      text: 'ALTN 1 FAIL',
      // The AFM lists it as a caution (03A-02). The rule reads the Amps of alternator 1: it fires
      // while the alternator gives (almost) no current, also after ALTERNATOR 1 is switched OFF,
      // because the alternator is still not delivering. 2.5 A is an instructor-review value (C-38).
      level: 'caution',
      when: { check: 'quantity', quantity: 'alt1_amps', op: 'lte', value: 2.5 },
    },
  ],
  { registry: DA50RG, quantities: DA50RG_QUANTITIES },
);
