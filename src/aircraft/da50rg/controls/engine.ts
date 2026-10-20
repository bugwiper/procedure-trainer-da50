import type { ControlSpec, StateDef } from '../../../engine/registry';

// Engine area, left edge below DE-ICE (D-07c), at the true spacing (D-21). Control
// inventory: AFM section 7-23 and the private reference photos IMG_0650 / DA50_virtual
// (layout facts only, no AFM wording). The switches are plain toggles; none guarded (D-07b).
// FADEC TEST is a momentary push button right of the FADEC switch (D-07c).

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
    hit: { w: 74, h: 60 },
    states: [
      { id: 'auto', label: 'AUTO' },
      { id: 'force_b', label: 'FORCE B' },
    ],
    default: 'auto',
  },
  {
    id: 'btn.fadec_test',
    kind: 'momentary-button',
    label: 'FADEC TEST',
    region: 'engine_controls',
    x: 126,
    y: 36,
    // Narrower than FADEC (74): the engine area has no other free background, so the gap
    // between the two keeps a tap-to-zoom point that stays clear of both targets (PNL-09).
    hit: { w: 60, h: 60 },
    states: [
      { id: 'released', label: 'RELEASED' },
      { id: 'pressed', label: 'PRESSED' },
    ],
    default: 'released',
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
