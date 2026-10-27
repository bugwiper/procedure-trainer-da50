import type { JSX } from 'preact';
import { cueVisible } from '../../../engine/cues';

// The cue layers of the windscreen (Phase 5, W-05): one component per cue id of the aircraft cue
// table, drawn only while the level is visible. Pure components of the level, flat vector art with
// the layer's own `w-` paints, no text (G-0). Size and opacity follow the level; the flicker is a
// CSS animation of stage.css that stops under reduced motion.

/** Where the fire stands on the cowl, in panel space. */
export const FLAME_BASE = { x: 1130, y: -52 } as const;

/** Flame size and opacity from the level: 0.1 shows a small flame, 1 a developed fire. */
export function flameScale(level: number): number {
  return 0.35 + 0.65 * level;
}

export function flameOpacity(level: number): number {
  return 0.55 + 0.45 * level;
}

/** Flames and a smoke trail rising from the cowl. */
export function Flames({ level }: { level: number }) {
  const scale = flameScale(level);
  const opacity = flameOpacity(level);
  return (
    <g
      data-cue="flames"
      data-level={level}
      transform={`translate(${FLAME_BASE.x} ${FLAME_BASE.y}) scale(${scale})`}
      opacity={opacity}
    >
      <g class="w-flicker-smoke">
        <circle cx={-6} cy={-190} r={36} fill="#2f3338" fill-opacity={0.55} />
        <circle cx={-28} cy={-238} r={46} fill="#3a3f45" fill-opacity={0.48} />
        <circle cx={-58} cy={-288} r={52} fill="#454a51" fill-opacity={0.4} />
        <circle cx={-92} cy={-326} r={44} fill="#50555c" fill-opacity={0.3} />
      </g>
      <g class="w-flicker">
        <path
          d="M-70 4 C-96 -50 -50 -92 -44 -170 C-26 -128 6 -112 -6 -60 C22 -92 40 -50 30 4 Z"
          fill="#e8571c"
        />
        <path
          d="M-12 4 C-48 -60 -2 -110 4 -210 C28 -150 70 -120 56 -50 C84 -84 92 -30 70 4 Z"
          fill="#f0791f"
        />
        <path
          d="M-38 4 C-52 -34 -22 -60 -16 -112 C-6 -86 20 -70 14 -34 C30 -48 36 -20 26 4 Z"
          fill="#ffc531"
        />
        <path d="M-18 4 C-24 -20 -8 -34 -4 -58 C4 -40 14 -30 10 4 Z" fill="#fff3b0" />
      </g>
    </g>
  );
}

/** The cue layers by cue id; a cue of the aircraft table without a layer here is not drawn. */
export const CUE_LAYERS: Readonly<Record<string, (props: { level: number }) => JSX.Element>> = {
  flames: Flames,
};

/** The layers of every visible cue, in the order of the layer table. */
export function CueLayers({ levels }: { levels: Readonly<Record<string, number>> }) {
  return (
    <g data-layer="cues">
      {Object.entries(CUE_LAYERS).map(([id, Layer]) => {
        const level = levels[id] ?? 0;
        return cueVisible(level) ? <Layer key={id} level={level} /> : null;
      })}
    </g>
  );
}
