import type { ControlSpec } from '../../../engine/registry';

// Lower switch row of the instrument panel (D-07c). Control inventory: AFM section 7-23
// and the private reference photos IMG_0650 / DA50_virtual (layout facts only, no AFM
// wording). Region-local y 39; slot centres x at the true spacing (D-21):
//   0 PROP DE-ICE 44      1 FUEL TRANS 119     2 EMERG FUEL PUMP 206
//   3 ENGINE START 316 (momentary, plan 07)    4 ENGINE MASTER 400
//   5 ESS BUS 502         6 ELECT. MASTER 586  7 AV MASTER 661
//   8 PITOT/STALL HEAT 731
// The wider gap before ESS BUS is real (its placard sits there).
export const SWITCH_BANK_CONTROLS: readonly ControlSpec[] = [
  {
    id: 'sw.engine_master',
    kind: 'toggle',
    label: 'ENGINE MASTER',
    region: 'switch_bank',
    x: 400,
    y: 39,
    hit: { w: 66, h: 70 }, // grown up to the neighbour gap, the narrowest pitch in the row being 70
    states: [
      { id: 'off', label: 'OFF' },
      { id: 'on', label: 'ON' },
    ],
    default: 'on', // D-07d: normal in-flight configuration
  },
];
