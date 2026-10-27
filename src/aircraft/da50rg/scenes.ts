import { defineScenes } from '../../engine/scenes';

/**
 * The views out of the windscreen (Phase 5, W-07): the aircraft on the apron in front of a hangar,
 * the take-off roll on a runway, cruise flight and flight in cloud (IMC, for icing). The art of each is in
 * src/ui/panel/windscreen/scenes.tsx, typed by this tuple, so a missing scene fails the typecheck.
 */
export const SCENE_IDS = ['parked', 'takeoff_roll', 'cruise', 'cloud'] as const;

export type SceneId = (typeof SCENE_IDS)[number];

/** The scene of the free panel and of a scenario that names none. */
export const DEFAULT_SCENE: SceneId = 'cruise';

export const DA50RG_SCENES = defineScenes(SCENE_IDS, DEFAULT_SCENE);
