import type { ControlSpec } from '../../../engine/registry';

// MFD page softkey (D-04a): the leftmost of the 12 softkeys under the MFD screen, where the real
// ENGINE softkey is (global centre 1288, 589, slot 1 of avionics.ts). No wider than the real
// softkey pitch, because its neighbours are real keys (inert art, SoftkeysFrame). The key prints
// no word: the legend Engine stands on the glass above it. The page is panel state so it is
// gradable later.
export const MFD_CONTROLS: readonly ControlSpec[] = [
  {
    id: 'sw.mfd_page',
    kind: 'toggle',
    skin: 'softkey',
    label: 'ENGINE',
    region: 'mfd_softkeys',
    x: 26,
    y: 19,
    hit: { w: 36, h: 36 },
    states: [
      { id: 'map', label: 'NOT SELECTED' },
      { id: 'engine', label: 'SELECTED' },
    ],
    default: 'map',
  },
];
