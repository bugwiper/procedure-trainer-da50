import type { ControlSpec, StateDef } from '../../../engine/registry';

// DE-ICE panel, top far left (D-07b). Upper block (plan 21, owner finding G-1): the black MAX push
// button above the three-position MODE toggle, the three derived lamps beside it (indicators.ts)
// and the ALTERNATE switch at its final place on the right. Below, in region deice_switches, the
// toggles WIND SHIELD, ICE LIGHT, PUMP 2 and PUMP 1 and the ANNUN TEST button (buttons.ts) stay as
// they were until plan 22. The ALTERNATE switch is still the cockpit's only guarded switch. The
// labels are paraphrased placards, the positions are layout facts read from the private reference
// photos (P650, SIM, the owner's de-ice photo; no AFM wording), and the OFF/ON states are a
// planner assumption to confirm against the de-ice supplement when the icing scenarios are planned
// (UI-SPEC unconfirmed item 8). Normal in-flight position: OFF (D-07d).
//
// Region deice starts at global (85, 205). The ALTERNATE footprint is x 119..175, y 57..125; the
// lifted guard flips up into y 27..57, inside the region and over no other control.

const ONOFF: readonly [StateDef, StateDef] = [
  { id: 'off', label: 'OFF' },
  { id: 'on', label: 'ON' },
];

export const DEICE_CONTROLS: readonly ControlSpec[] = [
  {
    // Three-position mini toggle, bottom to top OFF, NORM, HIGH (owner finding G-1). Nameless: the
    // placards HIGH, NORM and OFF (placards.ts) name the positions, nothing else is printed. Each
    // third of the 90-high hit is 30 units and selects its position.
    id: 'sw.deice_mode',
    kind: 'toggle',
    label: 'DE-ICE MODE',
    region: 'deice',
    x: 35,
    y: 137,
    hit: { w: 40, h: 90 },
    states: [
      { id: 'off', label: 'OFF' },
      { id: 'norm', label: 'NORM' },
      { id: 'high', label: 'HIGH' },
    ],
    default: 'off',
    nameless: true,
  },
  {
    // Black momentary push button above the mode toggle (owner finding G-1). The 120 s MAX run is
    // engine behaviour (the flag deice.max_active, indicators.ts); the button only records its
    // press and release like every momentary button.
    id: 'btn.deice_max',
    kind: 'momentary-button',
    label: 'MAX',
    region: 'deice',
    x: 26,
    y: 49,
    hit: { w: 36, h: 36 },
    states: [
      { id: 'released', label: 'RELEASED' },
      { id: 'pressed', label: 'PRESSED' },
    ],
    default: 'released',
    skin: 'black-dome',
  },
  {
    id: 'sw.deice_alternate',
    kind: 'guarded-toggle',
    label: 'ALTERNATE',
    region: 'deice',
    x: 147,
    y: 91,
    hit: { w: 56, h: 68 },
    states: [
      { id: 'off', label: 'OFF' },
      { id: 'on', label: 'ON' },
    ],
    default: 'off',
    guardOpenHit: { x: -28, y: -64, w: 56, h: 30 },
    // Red rocker under the translucent red guard cover (D-08, UI-SPEC 8.6; photos P650, SIM).
    // Size M is a proposal within +/- 10 percent (unconfirmed item 2).
    size: 'M',
    colour: 'red',
  },
  // The switch row of region deice_switches (global y 410, hit 30 x 36). Kinds and state names
  // are unconfirmed (UI-SPEC unconfirmed item 8); in-flight default OFF.
  {
    id: 'sw.deice_windshield',
    kind: 'toggle',
    label: 'WIND SHIELD',
    region: 'deice_switches',
    x: 44,
    y: 20,
    hit: { w: 30, h: 36 },
    states: ONOFF,
    default: 'off',
  },
  {
    id: 'sw.deice_ice_light',
    kind: 'toggle',
    label: 'ICE LIGHT',
    region: 'deice_switches',
    x: 91,
    y: 20,
    hit: { w: 30, h: 36 },
    states: ONOFF,
    default: 'off',
  },
  {
    id: 'sw.deice_pump2',
    kind: 'toggle',
    label: 'PUMP 2',
    region: 'deice_switches',
    x: 137,
    y: 20,
    hit: { w: 30, h: 36 },
    states: ONOFF,
    default: 'off',
  },
  {
    id: 'sw.deice_pump1',
    kind: 'toggle',
    label: 'PUMP 1',
    region: 'deice_switches',
    x: 120,
    y: 57,
    hit: { w: 30, h: 36 },
    states: ONOFF,
    default: 'off',
  },
];
