import type { ControlSpec, StateDef } from '../../../engine/registry';

// DE-ICE panel, top far left (D-07b). The panel now holds the full Phase 01.1 inventory
// (D-10): the MODE selector (lv.deice_mode, gear-flaps.ts), this ALTERNATE switch, the toggles
// WIND SHIELD, ICE LIGHT, PUMP 2 and PUMP 1 below, and the ANNUN TEST button (buttons.ts).
// The ALTERNATE switch is still the cockpit's only guarded switch. The labels are paraphrased
// placards, the positions are layout facts read from the private reference photos (P650, SIM;
// no AFM wording), and the OFF/ON states are a planner assumption to confirm against the
// de-ice supplement when the icing scenarios are planned (UI-SPEC unconfirmed item 8).
// Normal in-flight position: OFF (D-07d).
//
// Region-local centre (118, 67), footprint x 90..146, y 33..101. The lifted guard flips up
// into x 90..146, y 3..33, which stays inside the region and overlaps no other control.

const ONOFF: readonly [StateDef, StateDef] = [
  { id: 'off', label: 'OFF' },
  { id: 'on', label: 'ON' },
];

export const DEICE_CONTROLS: readonly ControlSpec[] = [
  {
    id: 'sw.deice_alternate',
    kind: 'guarded-toggle',
    label: 'ALTERNATE',
    region: 'deice',
    x: 118,
    y: 67,
    hit: { w: 56, h: 68 },
    states: [
      { id: 'off', label: 'OFF' },
      { id: 'on', label: 'ON' },
    ],
    default: 'off',
    guardOpenHit: { x: -28, y: -64, w: 56, h: 30 },
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
];
