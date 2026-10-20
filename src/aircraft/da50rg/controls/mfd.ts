import type { ControlSpec } from '../../../engine/registry';

// MFD page softkey (D-04a): the leftmost softkey under the MFD screen, where the real
// ENGINE softkey is. No wider than the real softkey pitch, because its unmodelled
// neighbours are real controls. The page is panel state so it is gradable later.
export const MFD_CONTROLS: readonly ControlSpec[] = [
  {
    id: 'sw.mfd_page',
    kind: 'toggle',
    skin: 'softkey',
    label: 'MFD PAGE',
    region: 'mfd_softkeys',
    x: 26,
    y: 19,
    hit: { w: 36, h: 36 },
    states: [
      { id: 'map', label: 'MAP' },
      { id: 'engine', label: 'ENGINE' },
    ],
    default: 'map',
  },
];
