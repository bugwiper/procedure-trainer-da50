import type { ControlSpec, StateDef, ToggleDef } from '../../../engine/registry';

// Lower switch row of the instrument panel (D-07c). Control inventory: AFM section 7-23
// and the private reference photos IMG_0650 / DA50_virtual (layout facts only, no AFM
// wording). Region-local y 39; slot centres x at the true spacing (D-21):
//   0 PROP DE-ICE 44      1 FUEL TRANS 119     2 EMERG FUEL PUMP 206
//   3 ENGINE START 316 (momentary, lives in buttons.ts)    4 ENGINE MASTER 400
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

/** Skin fields of a toggle (UI-SPEC 8.1, 8.2); absent means the chrome bat. */
type Look = Pick<ToggleDef, 'skin' | 'size' | 'colour' | 'ball'>;

function rowSwitch(
  id: string,
  label: string,
  x: number,
  initial: 'on' | 'off',
  look: Look = {},
): ToggleDef {
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
    ...look,
  };
}

export const SWITCH_BANK_CONTROLS: readonly ControlSpec[] = [
  // White rockers (D-08): sizes are proposals within +/- 10 percent (UI-SPEC unconfirmed item 2).
  // PROP DE-ICE: photos P650, SIM, PED.
  rowSwitch('sw.prop_deice', 'PROP DE-ICE', 44, 'off', {
    skin: 'rocker',
    size: 'M',
    colour: 'white',
  }),
  // Round knob with OFF and ON, not a toggle (UI-SPEC row 19; pointer angles unconfirmed).
  {
    id: 'sw.fuel_trans',
    kind: 'rotary',
    label: 'FUEL TRANS',
    region: 'switch_bank',
    x: 119,
    y: 39,
    hit: { w: 66, h: 70 },
    r: 16,
    scale: 'none',
    stops: [
      { id: 'off', label: 'OFF', angle: -60 },
      { id: 'on', label: 'ON', angle: 60 },
    ],
    default: 'off',
  },
  // EMERG FUEL PUMP: P650, P386, SIM.
  rowSwitch('sw.emerg_fuel_pump', 'EMERG FUEL PUMP', 206, 'off', {
    skin: 'rocker',
    size: 'M',
    colour: 'white',
  }),
  // Slot 3 (x 316) is the ENGINE START push button, defined in buttons.ts.
  // ENGINE MASTER stays a chrome bat, now with the ball tip (P386, P650).
  rowSwitch('sw.engine_master', 'ENGINE MASTER', 400, 'on', { ball: true }),
  // ESS BUS: white rocker per the photos P650 and P386 (owner decision 2026-10-20, replaces the
  // medium red of D-08). Its placard reserves it for abnormal operation.
  rowSwitch('sw.ess_bus', 'ESS BUS', 502, 'off', { skin: 'rocker', size: 'M', colour: 'white' }),
  // Big red rocker with bezel ears (D-08; P650, P386, PED). Size ratios are proposals.
  rowSwitch('sw.elect_master', 'ELECT. MASTER', 586, 'on', {
    skin: 'rocker',
    size: 'L',
    colour: 'red',
  }),
  // AV MASTER: P650, P386.
  rowSwitch('sw.av_master', 'AV MASTER', 661, 'on', { skin: 'rocker', size: 'M', colour: 'white' }),
  // PITOT/STALL HEAT: the widest white rocker (P650, P386).
  rowSwitch('sw.pitot_stall_heat', 'PITOT/STALL HEAT', 731, 'on', {
    skin: 'rocker',
    size: 'W',
    colour: 'white',
  }),
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
    // Small red rocker; the second state (ON) is the upper end (P650, PED, P807).
    skin: 'rocker',
    size: 'S',
    colour: 'red',
  },
];
