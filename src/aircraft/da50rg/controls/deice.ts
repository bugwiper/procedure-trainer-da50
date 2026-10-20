import type { ControlSpec } from '../../../engine/registry';

// DE-ICE panel, top far left (D-07b). The ALTERNATE switch is the cockpit's only guarded
// switch; no other de-ice controls exist in this phase. The label is a paraphrased placard,
// the position is discretionary (read from the private reference photos as a layout fact,
// no AFM wording), and the two OFF/ON states are a planner assumption to confirm against
// the de-ice supplement when the icing scenarios are planned. Normal in-flight position:
// OFF (D-07d).
//
// Region-local centre (118, 67), footprint x 90..146, y 33..101. The lifted guard flips up
// into x 90..146, y 3..33, which stays inside the region and overlaps no other control.

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
];
