import type { ControlSpec } from '../../../engine/registry';

// The cabin openings (Phase 5.1, P-07, P-09, owner answers of 2026-10-27, place corrected the same
// day): two separate controls stacked in the left strip below ALTERNATE STATIC on one plate
// (`cabin-pad`), the oval emergency window above the red door lock lever. Locked the lever lies flat
// along the arm rest; open it swings up and to the left in perspective. A click on the oval toggles
// it, there is no lever. Neither has a physics effect (plan 05.1-02 reads the window for the cabin
// smoke and plans 02 and 03 grade the door and the window by their state). Both places are
// assumptions for the owner's review. Static labels only (G-0): the names WINDOW and DOOR LOCK are
// plate placards (placards.ts), the accessible names below are not drawn.

export const CABIN_CONTROLS: readonly ControlSpec[] = [
  {
    // Global 60, 1156. The hit is 76 x 132 inside a region of 96 x 196 (the parking flap is 44 x 88):
    // the open lever swings 34 units left of the centre, so the footprint is wider on the left than
    // the red bar needs; 10 units of background stay on each side. The placard DOOR LOCK stands
    // below the hit. The track stays in the data like the parking brake's; the lever body does not
    // use it.
    id: 'lv.door_release',
    kind: 'detent-lever',
    label: 'DOOR RELEASE',
    nameless: true,
    legends: [],
    region: 'door_arm',
    x: 48,
    y: 74,
    hit: { w: 76, h: 132 },
    track: { length: 66, axis: 'v' },
    detents: [
      { id: 'locked', label: 'LOCKED', pos: 0 },
      { id: 'open', label: 'OPEN', pos: 1 },
    ],
    default: 'locked', // in flight the door is locked
    skin: 'door-release',
    tapToggle: true,
  },
  {
    // Global 60, 954, above the door lock lever. The hit is 60 x 116 inside a region of 96 x 180,
    // which leaves 18 units of background left and right for a double tap that zooms. The placard
    // WINDOW stands below the pane.
    id: 'sw.emerg_window',
    kind: 'toggle',
    skin: 'window',
    label: 'EMERGENCY WINDOW',
    nameless: true,
    region: 'side_window',
    x: 48,
    y: 66,
    hit: { w: 60, h: 116 },
    states: [
      { id: 'closed', label: 'CLOSED' },
      { id: 'open', label: 'OPEN' },
    ],
    default: 'closed',
  },
];
