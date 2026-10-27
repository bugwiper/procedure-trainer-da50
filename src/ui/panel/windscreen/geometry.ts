import { VIEWBOX, WINDSCREEN_H } from '../../../aircraft/da50rg/panel';

// Shared geometry of the windscreen layer (Phase 5, W-03, W-04), in panel space. The layer runs
// from the top of the extent down to y 110: the glare shield (coaming top between y 12 and 96)
// covers its lower edge.

/** The drawn area: the whole extent width, the windscreen height plus the part under the shield. */
export const OPENING = { x: 0, y: -WINDSCREEN_H, w: VIEWBOX.w, h: WINDSCREEN_H + 110 } as const;

/** The centre of the view: the strut, over the hump of the glare shield (x 1130). */
export const SCENE_CENTRE_X = 1130;

/** Mirrors an x about the strut. */
export const mirrorX = (x: number): number => 2 * SCENE_CENTRE_X - x;

/**
 * The wide arched opening between the dark canopy frame (the photo of the owner, in own words):
 * left pillar rising from the sill, a round arch, mirrored about the strut.
 */
export const OPENING_PATH = [
  'M150 110',
  'L126 -100',
  'C120 -262 225 -366 430 -392',
  'C700 -414 930 -420 1130 -420',
  `C${mirrorX(930)} -420 ${mirrorX(700)} -414 ${mirrorX(430)} -392`,
  `C${mirrorX(225)} -366 ${mirrorX(120)} -262 ${mirrorX(126)} -100`,
  `L${mirrorX(150)} 110`,
  'Z',
].join(' ');
