import type { ControlSpec, StateDef } from '../../../engine/registry';

// Engine area, left edge below DE-ICE (D-07c), at the true spacing (D-21). Control
// inventory: AFM section 7-23 and the private reference photos IMG_0650 / DA50_virtual
// (layout facts only, no AFM wording). The switches are plain toggles; none guarded (D-07b).
// The FADEC TEST push button right of the FADEC switch lives in buttons.ts.

const OFF_ON: readonly [StateDef, StateDef] = [
  { id: 'off', label: 'OFF' },
  { id: 'on', label: 'ON' },
];

export const ENGINE_CONTROLS: readonly ControlSpec[] = [
  {
    id: 'sw.fadec',
    kind: 'toggle',
    label: 'FADEC',
    region: 'engine_controls',
    x: 46,
    y: 36,
    // 66 wide (was 74): leaves free background around the switch so a region tap still
    // zooms at the 0.242 px-per-unit full view of the smallest phone (PD-06). The visible
    // part stays inside the hit rect.
    hit: { w: 66, h: 60 },
    states: [
      { id: 'auto', label: 'AUTO' },
      { id: 'force_b', label: 'FORCE B' },
    ],
    default: 'auto',
  },
  {
    id: 'sw.alternator_1',
    kind: 'toggle',
    label: 'ALTERNATOR 1',
    region: 'engine_controls',
    x: 54,
    y: 100,
    hit: { w: 70, h: 60 },
    states: OFF_ON,
    default: 'on', // D-07d
  },
  {
    id: 'sw.alternator_2',
    kind: 'toggle',
    label: 'ALTERNATOR 2',
    region: 'engine_controls',
    x: 130,
    y: 100,
    hit: { w: 70, h: 60 },
    states: OFF_ON,
    default: 'on', // D-07d
  },
];
