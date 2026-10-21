import type { ControlSpec } from '../../../engine/registry';

// DE-ICE panel, top far left (D-07b; owner finding G-1, plans 21 and 22). Upper block (region
// deice): the black MAX push button above the three-position MODE toggle, the three derived lamps
// beside it (indicators.ts) and the guarded ALTERNATE switch on the right. Lower row (region
// deice_switches, left to right): the black momentary WIND SHIELD push button (buttons.ts), the
// three-position ICE LIGHT / ANNUN-TEST toggle and the two-way PUMP toggle. The ALTERNATE switch
// is still the cockpit's only guarded switch. The labels are paraphrased placards, the positions
// are layout facts read from the private reference photos (the owner's de-ice photo; no AFM
// wording). The spray, the annunciator self-test and the ice light have no simulated effect yet;
// they come with the scenarios. Normal in-flight position: everything off, PUMP 1 (D-07d, Q-03).
//
// Region deice starts at global (85, 205), region deice_switches at (85, 390).

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
    // The cockpit's only guarded switch (owner finding G-1, plan 22; D-08 amended: no red rocker).
    // A normal toggle under a red guard cover: the guarded position is UP (off), flipped DOWN (on)
    // once the guard is lifted. States in the order on, off so that the second state, off, is the
    // up position. Without rocker size and colour the widget draws the bat toggle. Nameless: the
    // stacked letters ALTERNATE (placards.ts) stand beside it. The footprint is x 121..173, y
    // 41..141; the lifted guard is a flap above it, y 9..41, inside the region.
    id: 'sw.deice_alternate',
    kind: 'guarded-toggle',
    label: 'ALTERNATE',
    region: 'deice',
    x: 147,
    y: 91,
    hit: { w: 52, h: 100 },
    states: [
      { id: 'on', label: 'ON' },
      { id: 'off', label: 'OFF' },
    ],
    default: 'off',
    guardOpenHit: { x: -26, y: -82, w: 52, h: 32 },
    nameless: true,
  },
  {
    // One three-position toggle (owner finding G-1, plan 22): bottom to top ANNUN-TEST, OFF, ICE
    // LIGHT, default OFF (Q-02: maintained, no spring return). Nameless: the placards ICE LIGHT,
    // OFF and ANNUN- / TEST (placards.ts) name the positions. Neither the ice light nor the
    // annunciator self-test has a simulated effect yet; both come with the scenarios.
    id: 'sw.deice_ice_light',
    kind: 'toggle',
    label: 'ICE LIGHT',
    region: 'deice_switches',
    x: 86,
    y: 35,
    // 69 tall so each of the three tap thirds is 23 units: 44 px or more with a pinch-in view
    // (the 66 of the first design gave 43 px).
    hit: { w: 30, h: 69 },
    states: [
      { id: 'annun_test', label: 'ANNUN TEST' },
      { id: 'off', label: 'OFF' },
      { id: 'ice_light', label: 'ICE LIGHT' },
    ],
    default: 'off',
    nameless: true,
  },
  {
    // Two-way PUMP toggle (owner finding G-1, plan 22): up PUMP 2, down PUMP 1, default PUMP 1
    // (Q-03). Nameless: the placards PUMP 2 (above) and PUMP 1 (below) name the positions.
    id: 'sw.deice_pump',
    kind: 'toggle',
    label: 'DE-ICE PUMP',
    region: 'deice_switches',
    x: 142,
    y: 35,
    hit: { w: 30, h: 69 },
    states: [
      { id: 'pump1', label: 'PUMP 1' },
      { id: 'pump2', label: 'PUMP 2' },
    ],
    default: 'pump1',
    nameless: true,
  },
];
