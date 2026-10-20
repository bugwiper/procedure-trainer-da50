import type { ControlSpec, StateDef } from '../../../engine/registry';

// Lower switch row of the instrument panel (D-07c). Control inventory: AFM section 7-23
// and the private reference photos IMG_0650 / DA50_virtual (layout facts only, no AFM
// wording). Region-local y 39; slot centres x at the true spacing (D-21):
//   0 PROP DE-ICE 44      1 FUEL TRANS 119     2 EMERG FUEL PUMP 206
//   3 ENGINE START 316 (momentary)    4 ENGINE MASTER 400
//   5 ESS BUS 502         6 ELECT. MASTER 586  7 AV MASTER 661
//   8 PITOT/STALL HEAT 731
// The wider gap before ESS BUS is real (its placard sits there). Slot hit footprints are
// 66 wide: grown up to the neighbour gap, the narrowest pitch in the row being 70.
// Defaults are the normal in-flight configuration (D-07d) read from IMG_0650, which was
// taken in flight. Flagged as uncertain: PROP DE-ICE, FUEL TRANS and EMERG FUEL PUMP
// (normal cruise positions assumed) and PITOT/STALL HEAT (photo taken near cloud).

const OFF_ON: readonly [StateDef, StateDef] = [
  { id: 'off', label: 'OFF' },
  { id: 'on', label: 'ON' },
];

const RELEASED_PRESSED: readonly [StateDef, StateDef] = [
  { id: 'released', label: 'RELEASED' },
  { id: 'pressed', label: 'PRESSED' },
];

function rowSwitch(id: string, label: string, x: number, initial: 'on' | 'off'): ControlSpec {
  return {
    id,
    kind: 'toggle',
    label,
    region: 'switch_bank',
    x,
    y: 39,
    hit: { w: 66, h: 70 },
    states: OFF_ON,
    default: initial,
  };
}

export const SWITCH_BANK_CONTROLS: readonly ControlSpec[] = [
  rowSwitch('sw.prop_deice', 'PROP DE-ICE', 44, 'off'),
  rowSwitch('sw.fuel_trans', 'FUEL TRANS', 119, 'off'),
  rowSwitch('sw.emerg_fuel_pump', 'EMERG FUEL PUMP', 206, 'off'),
  // Slot 3 (x 316): the ENGINE START push button between EMERG FUEL PUMP and ENGINE MASTER.
  {
    id: 'btn.engine_start',
    kind: 'momentary-button',
    label: 'ENGINE START',
    region: 'switch_bank',
    x: 316,
    y: 39,
    hit: { w: 66, h: 70 },
    states: RELEASED_PRESSED,
    default: 'released',
  },
  rowSwitch('sw.engine_master', 'ENGINE MASTER', 400, 'on'),
  rowSwitch('sw.ess_bus', 'ESS BUS', 502, 'off'), // its placard reserves it for abnormal operation
  rowSwitch('sw.elect_master', 'ELECT. MASTER', 586, 'on'),
  rowSwitch('sw.av_master', 'AV MASTER', 661, 'on'),
  rowSwitch('sw.pitot_stall_heat', 'PITOT/STALL HEAT', 731, 'on'),
  // ELT sits in RIGHT PANEL at the lower right (D-07c does not mention it); the data
  // stays here with the other panel switches.
  {
    id: 'sw.elt',
    kind: 'toggle',
    label: 'ELT',
    region: 'right_panel',
    x: 56,
    y: 43,
    hit: { w: 50, h: 70 },
    states: [
      { id: 'arm', label: 'ARM' },
      { id: 'on', label: 'ON' },
    ],
    default: 'arm',
  },
];
