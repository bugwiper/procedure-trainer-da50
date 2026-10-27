import type { ControlSpec } from '../../../engine/registry';

// The cabin openings (Phase 5.1, P-07, P-09, owner answers of 2026-10-27): two separate controls.
// The red door release lever lies low at the left edge, in the pilot's arm rest: locked it lies
// flat along the arm rest, open it is pulled up. The emergency window is the oval in the side pane
// at the far left of the windscreen extent: a click toggles it, there is no lever. Neither has a
// physics effect (plan 05.1-02 reads the window for the cabin smoke and plans 02 and 03 grade the
// door and the window by their state). Both places are assumptions for the owner's review. Static
// labels only (G-0): the labels below are accessible names, no text is drawn.

export const CABIN_CONTROLS: readonly ControlSpec[] = [
  {
    // Global 52, 1120. The hit is 56 x 176 inside a region of 96 x 240 (the parking flap is 44 x
    // 88), so 20 units of background stay left of it. The track stays in the data like the
    // parking brake's; the lever body does not use it.
    id: 'lv.door_release',
    kind: 'detent-lever',
    label: 'DOOR RELEASE',
    nameless: true,
    legends: [],
    region: 'door_arm',
    x: 48,
    y: 120,
    hit: { w: 56, h: 176 },
    track: { length: 88, axis: 'v' },
    detents: [
      { id: 'locked', label: 'LOCKED', pos: 0 },
      { id: 'open', label: 'OPEN', pos: 1 },
    ],
    default: 'locked', // in flight the door is locked
    skin: 'door-release',
    tapToggle: true,
  },
  {
    // Global 62, -175, in the side pane at the far left of the windscreen extent. The hit is 64 x
    // 140 inside a region of 112 x 210, which leaves 12 units of background to the 10 percent inset
    // and keeps a double tap on the pane zooming.
    id: 'sw.emerg_window',
    kind: 'toggle',
    skin: 'window',
    label: 'EMERGENCY WINDOW',
    nameless: true,
    region: 'side_window',
    x: 56,
    y: 105,
    hit: { w: 64, h: 140 },
    states: [
      { id: 'closed', label: 'CLOSED' },
      { id: 'open', label: 'OPEN' },
    ],
    default: 'closed',
  },
];
