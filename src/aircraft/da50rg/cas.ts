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
      // The AFM lists it as a caution (03A-02). It comes from the alternator control unit, not from
      // a current: the fault flag (electrical.ts, E-07) stays while the alternator is switched
      // OFF and goes when a popped breaker was the only cause and is pushed in. Band check: no number.
      level: 'caution',
      when: { check: 'band', quantity: 'alt1_fault', in: ['fault'] },
    },
    {
      id: 'altn_2_fail',
      text: 'ALTN 2 FAIL',
      level: 'caution',
      when: { check: 'band', quantity: 'alt2_fault', in: ['fault'] },
    },
    {
      id: 'pitot_heat',
      text: 'PITOT HT OFF',
      // Whenever the PITOT/STALL HEAT switch is off (Phase 6, plan 04, H-01; owner 2026-10-28): a
      // yellow caution, independent of the STALL HT OFF one. A state check, no number.
      level: 'caution',
      when: { check: 'state', control: 'sw.pitot_stall_heat', is: 'off' },
    },
    {
      id: 'stall_heat',
      text: 'STALL HT OFF',
      // The second message of the switch off. Never a second chip next to stall_heat_ground: a text
      // shows once (RuleSet.active takes the first rule in table order), so the instant after the
      // switch goes off, while the timer still sits in the cut band, still shows one STALL HT OFF.
      level: 'caution',
      when: { check: 'state', control: 'sw.pitot_stall_heat', is: 'off' },
    },
    {
      id: 'stall_heat_ground',
      text: 'STALL HT OFF',
      // On the ground the stall heat cuts out a few seconds after it is on (physics.ts, H-02): the
      // same message returns with the switch on. Band check on the hidden timer, no number. It
      // shares its text with stall_heat, so the two never show together (one chip, one tone). A
      // situation that starts on the ground with the heat on starts with the timer past the cut
      // band: the chip is part of the start state, a message of the situation and no failure cue
      // (owner, 2026-10-29), hence ambient.
      level: 'caution',
      ambient: true,
      when: { check: 'band', quantity: 'stall_heat_timer_s', in: ['cut'] },
    },
    {
      id: 'fuel_trans',
      text: 'FUEL TRANS',
      // The white message while the FUEL TRANS pump runs (Phase 6, D-04b): an advisory, no tone. It
      // reads the hidden quantity fuel_trans_active, which physics sets from the transfer rule, so
      // the message and the pump cannot disagree. Band check: no number here.
      level: 'advisory',
      when: { check: 'band', quantity: 'fuel_trans_active', in: ['active'] },
    },
  ],
  { registry: DA50RG, quantities: DA50RG_QUANTITIES },
);
