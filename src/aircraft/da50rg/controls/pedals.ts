import type { ControlSpec } from '../../../engine/registry';

// The toe brakes (Phase 5.1, P-01): ONE latching control drawn as two pedals, a trainer
// simplification the owner accepted on 2026-10-27. A real pilot holds the pedals; here a tap
// applies both and a second tap releases them, so a finger can work the rest of the panel. A step
// reads one control (the predicate vocabulary is closed). The ground speed model of physics.ts
// reads it. Its place is an assumption: the floor of the pilot's footwell, below the transponder
// plate.

export const PEDALS_CONTROLS: readonly ControlSpec[] = [
  {
    // Nameless, no legends, no state text (G-0): the pedals show the state by their position.
    // Global 480, 1205. The hit is 260 x 90 inside a region of 360 x 110, so the strips beside it
    // stay background for the zoom tap.
    id: 'lv.toe_brakes',
    kind: 'detent-lever',
    label: 'TOE BRAKES',
    nameless: true,
    legends: [],
    region: 'pedals',
    x: 180,
    y: 55,
    hit: { w: 260, h: 90 },
    // The track stays in the data like the parking brake's; the pedal body does not use it.
    track: { length: 40, axis: 'v' },
    detents: [
      { id: 'released', label: 'RELEASED', pos: 0 },
      { id: 'applied', label: 'APPLIED', pos: 1 },
    ],
    default: 'released', // in flight the brakes are off
    skin: 'toe-brakes',
    tapToggle: true,
  },
];
