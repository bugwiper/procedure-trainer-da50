// Cabin smoke (Phase 5, C-02): a translucent haze over the whole view, thickest over the displays
// (the puffs stand over the PFD, the MFD and the hump between them), drifting slowly. It lies over everything, never takes a press (pointer-events
// none) and keeps the displays partly readable (at most SMOKE_MAX_OPACITY). Pure component of the
// level; flat vector with its own `w-` gradients of at most three stops, no filter, no text (G-0).
// The drift is a CSS animation of stage.css that stops under reduced motion.

import { VIEWBOX, WINDSCREEN_H } from '../../../aircraft/da50rg/panel';

/** The most opaque the smoke gets, so the displays stay partly readable. */
export const SMOKE_MAX_OPACITY = 0.75;

/** Opacity of the whole overlay from the level 0 to 1. */
export function smokeOpacity(level: number): number {
  return SMOKE_MAX_OPACITY * level;
}

const PUFFS = [
  { cx: 610, cy: 380, rx: 620, ry: 300 },
  { cx: 1520, cy: 390, rx: 640, ry: 310 },
  { cx: 1070, cy: 520, rx: 520, ry: 260 },
  { cx: 330, cy: 640, rx: 420, ry: 240 },
  { cx: 1850, cy: 650, rx: 420, ry: 240 },
  { cx: 1090, cy: 90, rx: 760, ry: 200 },
] as const;

export function CabinSmoke({ level }: { level: number }) {
  return (
    <g
      data-cue="cabin_smoke"
      data-level={level}
      aria-hidden="true"
      pointer-events="none"
      opacity={smokeOpacity(level)}
      clip-path="url(#w-smoke-clip)"
    >
      <defs>
        {/* The puffs end at the edge of the panel space, not in the letterbox beside it. */}
        <clipPath id="w-smoke-clip">
          <rect x={0} y={-WINDSCREEN_H} width={VIEWBOX.w} height={VIEWBOX.h + WINDSCREEN_H} />
        </clipPath>
        <linearGradient id="w-smoke-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8d9298" stop-opacity={0.4} />
          <stop offset="0.5" stop-color="#8d9298" stop-opacity={0.85} />
          <stop offset="1" stop-color="#8d9298" stop-opacity={0.4} />
        </linearGradient>
        <radialGradient id="w-smoke-puff">
          <stop offset="0" stop-color="#b4b8bc" stop-opacity={0.95} />
          <stop offset="0.55" stop-color="#a0a5aa" stop-opacity={0.55} />
          <stop offset="1" stop-color="#8d9298" stop-opacity={0} />
        </radialGradient>
      </defs>
      <rect
        x={0}
        y={-WINDSCREEN_H}
        width={VIEWBOX.w}
        height={VIEWBOX.h + WINDSCREEN_H}
        fill="url(#w-smoke-haze)"
      />
      <g class="w-smoke-drift">
        {PUFFS.map((p) => (
          <ellipse
            key={`${String(p.cx)}-${String(p.cy)}`}
            cx={p.cx}
            cy={p.cy}
            rx={p.rx}
            ry={p.ry}
            fill="url(#w-smoke-puff)"
          />
        ))}
      </g>
    </g>
  );
}
