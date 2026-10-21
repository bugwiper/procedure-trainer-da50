import type { ControlSpec } from '../../../engine/registry';

// Front-panel selector levers (D-07d, D-19): GEAR sits in the LANDING GEAR block right of
// PITOT/STALL HEAT and FLAPS below the MFD right of centre. Layout facts from the private
// reference photos (D-04b); no AFM wording. GEAR and FLAPS open in the in-flight configuration,
// UP. The de-ice mode selector is no lever any more: it is the three-position toggle
// sw.deice_mode in controls/deice.ts (plan 21, owner finding G-1).

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
    // Silver fluted knob on a bat stem (P650, P386, PED, SIM; UI-SPEC 8.5).
    skin: 'gear-knob',
  },
  {
    id: 'lv.flaps',
    kind: 'detent-lever',
    label: 'FLAPS',
    region: 'flaps',
    x: 176, // global 1366, 670.5 (region widened to the left for the flap lamps)
    y: 62.5, // global 670.5; the flaps region grew 5 upward (G-4)
    hit: { w: 60, h: 115 },
    // FLAPS travel is short on the real panel.
    track: { length: 79, axis: 'v' },
    detents: [
      { id: 'ldg', label: 'LDG', pos: 0 },
      { id: 'to', label: 'T/O', pos: 0.5 },
      { id: 'up', label: 'UP', pos: 1 },
    ],
    default: 'up',
    // Black matte block in a notched slot (P650, PED, COCK; UI-SPEC 8.5).
    skin: 'flaps-block',
  },
];
