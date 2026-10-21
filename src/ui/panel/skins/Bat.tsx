import type { ToggleDef, TogglePosition } from '../../../engine/registry';
import { paint } from '../Defs';

const FONT = 'B612, system-ui, sans-serif';

/** The pressed ring: drawn only while a pointer is down, never a persistent state (Color 5). */
const PRESSED_RING = '#8fb8e6';

/**
 * How far the handle tip is thrown from the pivot, up or down. A fixed value that fits every bat
 * footprint (the shortest, the 69-tall de-ice toggles, still has the tip and its cap inside), so
 * all toggles read alike whatever their footprint height.
 */
export const BAT_THROW = 14;

export interface BatBodyProps {
  readonly def: Pick<ToggleDef, 'label' | 'hit' | 'ball' | 'nameless'>;
  /** high points the handle up, low down, mid shows a short stub toward the viewer (Table T1). */
  readonly position: TogglePosition;
  /** True only while a pointer is down on the control. */
  readonly pressed: boolean;
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
 * it. There is one size of bat; the small variant of the old de-ice switches (PD-08) went with the
 * owner's de-ice rebuild (plan 22). No hooks, no state.
 */
export function BatBody({ def, position, pressed }: BatBodyProps) {
  const pivotY = 4.5;
  const handle: Handle = {
    pivotY,
    tipY:
      position === 'high' ? pivotY - BAT_THROW : position === 'low' ? pivotY + BAT_THROW : pivotY,
    width: 5,
    ringR: 7,
  };

  const labelY = -def.hit.h / 2 + 9;
  const labelWidth = Math.min(def.label.length * 5.2, def.hit.w - 2);

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
          font-size={8}
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
      <circle cx={0} cy={handle.pivotY} r={5} fill="#3a424b" stroke="#6b7580" />
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
