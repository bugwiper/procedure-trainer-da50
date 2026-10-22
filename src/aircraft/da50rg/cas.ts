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
  ],
  { registry: DA50RG, quantities: DA50RG_QUANTITIES },
);
