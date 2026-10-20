import type { ControlSpec } from '../../../engine/registry';

// Under-panel pull handles (D-07c positions, D-07d confirmed states), modelled as vertical
// two-detent levers stowed at the top (pos 1) and pulled at the bottom (pos 0). Positions are
// layout facts from the private reference photo DA50_virtual (D-04b), redrawn schematically.
// All three share y 60, hit 44 x 110 and a 60-unit track, each in its own small region.

export const UNDER_PANEL_CONTROLS: readonly ControlSpec[] = [
  {
    // Left of the pilot's left knee.
    id: 'lv.alt_static',
    kind: 'detent-lever',
    label: 'ALTERNATE STATIC',
    region: 'under_panel_left',
    x: 36,
    y: 60,
    hit: { w: 44, h: 110 }, // 44 wide (was 60): free background for region tap at full view (PD-06)
    track: { length: 60, axis: 'v' },
    detents: [
      { id: 'open', label: 'OPEN', pos: 0 },
      { id: 'closed', label: 'CLOSED', pos: 1 },
    ],
    default: 'closed',
  },
  {
    // Left of the pedestal. Safety-consequence control (PNL-06): dragOnly means no tap
    // targets exist, so only a deliberate drag of the handle past the track midpoint moves
    // it. The de-ice ALTERNATE switch stays the only guarded switch (D-07b).
    id: 'lv.emerg_gear',
    kind: 'detent-lever',
    label: 'EMERGENCY GEAR EXTENSION',
    region: 'under_panel_centre',
    x: 47,
    y: 60,
    hit: { w: 44, h: 110 }, // 44 wide (was 60): free background for region tap at full view (PD-06)
    track: { length: 60, axis: 'v' },
    detents: [
      { id: 'emergency', label: 'EMERGENCY', pos: 0 },
      { id: 'normal', label: 'NORMAL', pos: 1 },
    ],
    default: 'normal',
    dragOnly: true,
  },
  {
    // Just right of the pedestal.
    id: 'lv.alt_air',
    kind: 'detent-lever',
    label: 'ALTERNATE AIR',
    region: 'under_panel_right',
    x: 35,
    y: 60,
    hit: { w: 44, h: 110 }, // 44 wide (was 60): free background for region tap at full view (PD-06)
    track: { length: 60, axis: 'v' },
    detents: [
      { id: 'open', label: 'OPEN', pos: 0 },
      { id: 'closed', label: 'CLOSED', pos: 1 },
    ],
    default: 'closed',
  },
];
