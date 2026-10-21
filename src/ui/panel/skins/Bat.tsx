import type { ToggleDef, TogglePosition } from '../../../engine/registry';
import { paint } from '../Defs';

const FONT = 'B612, system-ui, sans-serif';

/** The pressed ring: drawn only while a pointer is down, never a persistent state (Color 5). */
const PRESSED_RING = '#8fb8e6';

/**
 * How far the handle tip is thrown from the pivot, up or down. A fixed value that fits every bat
 * footprint (the shortest, the 66-tall de-ice toggles, still has the tip and its cap inside), so
 * all toggles read alike whatever their footprint height.
 */
export const BAT_THROW = 14;

/** Footprints shorter than this use the compact variant (PD-08). */
export const COMPACT_BAT_HEIGHT = 39;

export interface BatBodyProps {
  readonly def: Pick<ToggleDef, 'label' | 'hit' | 'ball' | 'nameless'>;
  /** high points the handle up, low down, mid shows a short stub toward the viewer (Table T1). */
  readonly position: TogglePosition;
  /** True only while a pointer is down on the control. */
  readonly pressed: boolean;
}

/** Width estimate of B612 text; also used as textLength so tests match renders. */
function textWidth(text: string, size: number): number {
  return text.length * size * 0.62;
}

interface Handle {
  readonly pivotY: number;
  readonly tipY: number;
  readonly width: number;
  readonly ringR: number;
}

/**
 * Pure bat toggle art (UI-SPEC 8.2): the Phase 1 geometry (pivot circle r 5, bat width 5,
 * round cap, throw up to 14, label 8 above) repainted with a bezel ring r 7, a chrome bat with
 * a 1-unit dark outline and, for ENGINE MASTER, a ball tip r 3.2. The handle points up for
 * `high`, down for `low`, and for `mid` shows a short stub toward the viewer: the tip sits at the
 * pivot and only the ball tip is drawn. The body prints the name only: no state text and no
 * status dot (G-0.1, G-0.3); a nameless bat (plan 21) prints no text at all, a plate placard names
 * it. Footprints under 39 tall (the de-ice bats) use the compact variant
 * (PD-08): throw 8 and the name in Micro 6 just above the footprint in free panel space. No hooks,
 * no state.
 */
export function BatBody({ def, position, pressed }: BatBodyProps) {
  const compact = def.hit.h < COMPACT_BAT_HEIGHT;
  const h = def.hit.h;
  const top = -h / 2;

  const pivotY = compact ? -3 : 4.5;
  const reach = compact ? 8 : BAT_THROW;
  const handle: Handle = {
    pivotY,
    tipY: position === 'high' ? pivotY - reach : position === 'low' ? pivotY + reach : pivotY,
    width: compact ? 4 : 5,
    ringR: compact ? 6 : 7,
  };

  const labelY = compact ? top - 2 : top + 9;
  const labelWidth = compact
    ? textWidth(def.label, 6)
    : Math.min(def.label.length * 5.2, def.hit.w - 2);

  const half = handle.width / 2;
  const stub = position === 'mid';
  // The stub's cap reads as a ball (r 3) without counting as the ENGINE MASTER ball tip (r 3.2).
  const capR = def.ball === true ? 3.2 : stub ? 3 : half;
  const batPoints = [
    `${-half},${handle.pivotY}`,
    `${half},${handle.pivotY}`,
    `${half},${handle.tipY}`,
    `${-half},${handle.tipY}`,
  ].join(' ');

  return (
    <g pointer-events="none">
      {def.nameless === true ? null : (
        <text
          x={0}
          y={labelY}
          text-anchor="middle"
          font-family={FONT}
          font-size={compact ? 6 : 8}
          fill="#aab3bd"
          textLength={labelWidth}
          lengthAdjust="spacingAndGlyphs"
        >
          {def.label}
        </text>
      )}
      <circle
        cx={0}
        cy={handle.pivotY}
        r={handle.ringR}
        fill="#0c0d0f"
        stroke={pressed ? PRESSED_RING : '#2d3138'}
        stroke-width={pressed ? 2 : 1}
      />
      <circle cx={0} cy={handle.pivotY} r={compact ? 4 : 5} fill="#3a424b" stroke="#6b7580" />
      {stub ? null : (
        <polygon points={batPoints} fill={paint('g-chrome')} stroke="#1b1d21" stroke-width={1} />
      )}
      <circle
        cx={0}
        cy={handle.tipY}
        r={capR}
        fill={paint('g-chrome')}
        stroke="#1b1d21"
        stroke-width={1}
      />
    </g>
  );
}
