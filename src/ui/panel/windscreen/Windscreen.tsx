import { VIEWBOX, WINDSCREEN_H } from '../../../aircraft/da50rg/panel';
import { CueLayers } from './cue-layers';

// The windscreen above the instrument panel (Phase 5, W-03): one static art layer drawn before the
// shell, so the glare shield covers its lower edge. Pure component of its props (the scene id and
// the cue levels), flat vector art with its own `w-` paints, no text, no handler, pointer-events
// none, outside the region groups (the region `windscreen` is invisible geometry for the zoom).

/** The opening of the windscreen in panel space; the art runs down under the glare shield. */
export const OPENING = { x: 0, y: -WINDSCREEN_H, w: VIEWBOX.w, h: WINDSCREEN_H + 110 } as const;

function WindscreenDefs() {
  return (
    <defs>
      <linearGradient id="w-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3f78b8" />
        <stop offset="1" stop-color="#a9cfee" />
      </linearGradient>
      <linearGradient id="w-cowl" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#eef1f4" />
        <stop offset="0.55" stop-color="#b3bac2" />
        <stop offset="1" stop-color="#7d858e" />
      </linearGradient>
      <clipPath id="w-opening">
        <rect x={OPENING.x} y={OPENING.y} width={OPENING.w} height={OPENING.h} />
      </clipPath>
    </defs>
  );
}

/** The silver cowl low in the centre, with a clearly darker edge and shade so it never blends into cloud. */
function Cowl() {
  return (
    <g data-part="cowl">
      <path
        data-cowl-body
        d="M760 112 C790 20 900 -58 1130 -66 C1360 -58 1470 20 1500 112 Z"
        fill="url(#w-cowl)"
        stroke="#3b434c"
        stroke-width={6}
        stroke-linejoin="round"
      />
      <path
        d="M830 112 C860 40 960 -20 1130 -26 C1300 -20 1400 40 1430 112 Z"
        fill="#59616a"
        fill-opacity={0.35}
      />
    </g>
  );
}

export function Windscreen({
  scene,
  cues,
}: {
  scene: string;
  cues: Readonly<Record<string, number>>;
}) {
  return (
    <g data-layer="windscreen" data-scene-id={scene} pointer-events="none">
      <WindscreenDefs />
      <g clip-path="url(#w-opening)">
        <rect
          data-scene="cruise"
          x={OPENING.x}
          y={OPENING.y}
          width={OPENING.w}
          height={OPENING.h}
          fill="url(#w-sky)"
        />
        <Cowl />
        <CueLayers levels={cues} />
      </g>
    </g>
  );
}
