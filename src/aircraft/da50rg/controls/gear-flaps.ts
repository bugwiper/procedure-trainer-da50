import type { ControlSpec } from '../../../engine/registry';

// Front-panel selectors (D-07d, D-19): GEAR sits in the LANDING GEAR block right of PITOT/STALL
// HEAT, FLAPS below the MFD right of centre. Layout facts from the private reference photos
// (D-04b); no AFM wording. Both open in the in-flight configuration, UP.

export const GEAR_FLAPS_CONTROLS: readonly ControlSpec[] = [
  {
    id: 'lv.gear',
    kind: 'detent-lever',
    label: 'GEAR',
    region: 'landing_gear',
    x: 147,
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
    x: 66,
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
];
