import type { ControlSpec } from '../../../engine/registry';

// Front-panel selector levers (D-07d, D-19): GEAR sits in the LANDING GEAR block right of
// PITOT/STALL HEAT, FLAPS below the MFD right of centre, and the de-ice MODE selector in the
// DE-ICE panel at top far left. Layout facts from the private reference photos (D-04b); no
// AFM wording. GEAR and FLAPS open in the in-flight configuration, UP; MODE opens OFF.
// PD-03: the UI-SPEC id sw.deice_mode is registered as lv.deice_mode because the registry
// kind-prefix invariant requires lv. for a detent lever.

export const GEAR_FLAPS_CONTROLS: readonly ControlSpec[] = [
  {
    id: 'lv.gear',
    kind: 'detent-lever',
    label: 'GEAR',
    region: 'landing_gear',
    x: 161, // global 997, 656.5 in the 2000 x 1300 space (region widened to the left)
    y: 81.5,
    hit: { w: 70, h: 151 },
    track: { length: 91, axis: 'v' },
    detents: [
      { id: 'down', label: 'DOWN', pos: 0 },
      { id: 'up', label: 'UP', pos: 1 },
    ],
    default: 'up',
  },
  {
    id: 'lv.flaps',
    kind: 'detent-lever',
    label: 'FLAPS',
    region: 'flaps',
    x: 176, // global 1366, 670.5 (region widened to the left for the flap lamps)
    y: 57.5,
    hit: { w: 60, h: 115 },
    // FLAPS travel is short on the real panel.
    track: { length: 79, axis: 'v' },
    detents: [
      { id: 'ldg', label: 'LDG', pos: 0 },
      { id: 'to', label: 'T/O', pos: 0.5 },
      { id: 'up', label: 'UP', pos: 1 },
    ],
    default: 'up',
  },
  {
    // Four-position selector, MAX at the top as on the placard. Position names and the
    // selector kind are unconfirmed (UI-SPEC unconfirmed item 8); in-flight default OFF.
    id: 'lv.deice_mode',
    kind: 'detent-lever',
    label: 'MODE',
    region: 'deice',
    x: 44,
    y: 70,
    // Handle square and detent spacing are both 22.5: the narrowest tap size that still gives
    // 44 px at the pinch-zoom limit (MIN_VIEW_WIDTH) on a portrait phone (D-21). Plan table D1
    // said 30 x 80 with a 60 track (spacing 20), which falls short of that guarantee.
    hit: { w: 30, h: 90 },
    track: { length: 67.5, axis: 'v' },
    detents: [
      { id: 'off', label: 'OFF', pos: 0 },
      { id: 'norm', label: 'NORM', pos: 1 / 3 },
      { id: 'high', label: 'HIGH', pos: 2 / 3 },
      { id: 'max', label: 'MAX', pos: 1 },
    ],
    default: 'off',
  },
];
