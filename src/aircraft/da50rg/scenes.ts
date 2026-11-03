import { defineScenes } from '../../engine/scenes';

/**
 * The views out of the windscreen (Phase 5, W-07): the aircraft on the apron in front of a hangar,
 * the take-off roll on a runway, cruise flight, flight in cloud (IMC, for icing) and the approach to an
 * off-airport field (`outlanding`, Phase 9: the cruise landscape with one landing field that grows with
 * the descent). The art of each is in
 * src/ui/panel/windscreen/scenes.tsx, typed by this tuple, so a missing scene fails the typecheck.
 */
export const SCENE_IDS = ['parked', 'takeoff_roll', 'cruise', 'cloud', 'outlanding'] as const;

export type SceneId = (typeof SCENE_IDS)[number];

/** The scene of the free panel and of a scenario that names none. */
export const DEFAULT_SCENE: SceneId = 'cruise';

export const DA50RG_SCENES = defineScenes(SCENE_IDS, DEFAULT_SCENE);
