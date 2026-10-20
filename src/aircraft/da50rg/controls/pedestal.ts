import type { ControlSpec, DetentDef } from '../../../engine/registry';

// Pedestal levers (D-05a, D-07c, D-07d). Control inventory: AFM section 7-23 and the private
// reference photo DA50_virtual (layout facts only, no AFM wording, D-04b). The DA50 RG has one
// power lever: the ECU governs engine and propeller speed, so there is no propeller or
// mixture lever, and the POWER range is a plain 0 to 100 % load with no ground-idle gate.

/** POWER snaps in 5 % steps (planner choice under D-07d; data only, reversible). */
const POWER_STEPS: readonly DetentDef[] = Array.from({ length: 21 }, (_, i) => ({
  id: `p${i * 5}`,
  label: `${i * 5} %`,
  pos: (i * 5) / 100,
}));

export const PEDESTAL_CONTROLS: readonly ControlSpec[] = [
  {
    id: 'lv.power',
    kind: 'detent-lever',
    label: 'POWER',
    region: 'pedestal',
    // Global 1110, 1115 in the 2000 x 1300 space. Handle square min(60, 200 - 154) = 46.
    x: 153,
    y: 100,
    hit: { w: 60, h: 200 },
    track: { length: 154, axis: 'v' },
    detents: POWER_STEPS,
    // Tap targets only at 0, 50 and 100 %; every 5 % step stays a snap position.
    markers: ['p0', 'p50', 'p100'],
    default: 'p70', // cruise load, D-07d in-flight default
  },
  {
    // Aft of POWER, left of the centreline; OPEN is fore, as on the real pedestal.
    id: 'lv.cowl_flap',
    kind: 'detent-lever',
    label: 'COWL FLAP',
    region: 'pedestal',
    // Global 1010, 1235. Handle square min(60, 104 - 60) = 44.
    x: 53,
    y: 220,
    hit: { w: 60, h: 104 },
    track: { length: 60, axis: 'v' },
    detents: [
      { id: 'closed', label: 'CLOSED', pos: 0 },
      { id: 'open', label: 'OPEN', pos: 1 },
    ],
    default: 'closed', // cruise setting assumed (D-07d)
  },
];
