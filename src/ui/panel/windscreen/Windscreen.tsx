import { DEFAULT_SCENE } from '../../../aircraft/da50rg/scenes';
import { cueVisible } from '../../../engine/cues';
import { CueLayers } from './cue-layers';
import { CanopyFrame, Cowl, Disc, FrameDefs, StoppedBlade } from './frame';
import { Ice } from './Ice';
import { OilStreaks } from './OilStreaks';
import { SCENES, SceneDefs, isSceneId } from './scenes';

// The windscreen above the instrument panel (Phase 5, W-03): one static art layer drawn before the
// shell, so the glare shield covers its lower edge. Pure component of its props (the scene id and
// the cue levels), flat vector art with its own `w-` paints, no text, no handler, pointer-events
// none, outside the region groups (the region `windscreen` is invisible geometry for the zoom).
// Order: the scene, the propeller (a faint disc while the engine turns, a crisp blade once it stands), the cowl, the oil streaks, the
// ice and the cue layers, clipped to the opening; then the canopy frame over their edges. The oil and
// the ice lie on the glass over the scene, the blade and the cowl; the flames are drawn over them so
// the cue stays readable.

export function Windscreen({
  scene,
  cues,
  spray = false,
}: {
  scene: string;
  cues: Readonly<Record<string, number>>;
  /** The WIND SHIELD spray is running (the aircraft flag). */
  spray?: boolean;
}) {
  // A scene id the art does not know cannot reach here (lint L22, the session); the default is a
  // safety net so the layer never draws a hole.
  const oil = cues['oil_streaks'] ?? 0;
  const Scene = SCENES[isSceneId(scene) ? scene : DEFAULT_SCENE];
  return (
    <g data-layer="windscreen" data-scene-id={scene} pointer-events="none">
      <defs>
        <SceneDefs />
        <FrameDefs />
      </defs>
      <g clip-path="url(#w-opening)">
        <Scene />
        <Disc level={cues['prop_stopped'] ?? 0} />
        <StoppedBlade level={cues['prop_stopped'] ?? 0} />
        <Cowl />
        {cueVisible(oil) ? <OilStreaks level={oil} /> : null}
        <Ice
          pilot={cues['ice_pilot_side'] ?? 0}
          copilot={cues['ice_copilot_side'] ?? 0}
          spray={spray}
        />
        <CueLayers levels={cues} />
      </g>
      <CanopyFrame />
    </g>
  );
}
