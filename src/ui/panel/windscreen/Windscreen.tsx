import { DEFAULT_SCENE } from '../../../aircraft/da50rg/scenes';
import { CueLayers } from './cue-layers';
import { Blade, CanopyFrame, Cowl, FrameDefs } from './frame';
import { SCENES, SceneDefs, isSceneId } from './scenes';

// The windscreen above the instrument panel (Phase 5, W-03): one static art layer drawn before the
// shell, so the glare shield covers its lower edge. Pure component of its props (the scene id and
// the cue levels), flat vector art with its own `w-` paints, no text, no handler, pointer-events
// none, outside the region groups (the region `windscreen` is invisible geometry for the zoom).
// Order: the scene, the blade, the cowl and the cue layers, clipped to the opening; then the canopy
// frame over their edges.

export function Windscreen({
  scene,
  cues,
}: {
  scene: string;
  cues: Readonly<Record<string, number>>;
}) {
  // A scene id the art does not know cannot reach here (lint L22, the session); the default is a
  // safety net so the layer never draws a hole.
  const Scene = SCENES[isSceneId(scene) ? scene : DEFAULT_SCENE];
  return (
    <g data-layer="windscreen" data-scene-id={scene} pointer-events="none">
      <defs>
        <SceneDefs />
        <FrameDefs />
      </defs>
      <g clip-path="url(#w-opening)">
        <Scene />
        <Blade />
        <Cowl />
        <CueLayers levels={cues} />
      </g>
      <CanopyFrame />
    </g>
  );
}
