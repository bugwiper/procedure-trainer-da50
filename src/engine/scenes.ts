// Windscreen scenes (Phase 5, W-07): a scenario names the view out of the cockpit by an id. The
// aircraft owns the ids and the default (src/aircraft/da50rg/scenes.ts); nothing here knows one.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

export const SCENE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;

export interface SceneSet {
  readonly ids: readonly string[];
  /** The scene shown when a scenario names none, and on the free panel. */
  readonly default: string;
  has(id: string): boolean;
}

export class SceneError extends Error {}

export function defineScenes(ids: readonly string[], defaultId: string): SceneSet {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!SCENE_ID_PATTERN.test(id)) {
      throw new SceneError(`scene id "${id}" does not match ${SCENE_ID_PATTERN.source}`);
    }
    if (seen.has(id)) throw new SceneError(`scene "${id}" is defined twice`);
    seen.add(id);
  }
  if (!seen.has(defaultId)) throw new SceneError(`the default scene "${defaultId}" is not defined`);
  return Object.freeze({
    ids: Object.freeze([...ids]),
    default: defaultId,
    has: (id: string) => seen.has(id),
  });
}
