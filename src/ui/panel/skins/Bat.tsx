import type { ToggleDef } from '../../../engine/registry';
import { paint } from '../Defs';

const FONT = 'B612, system-ui, sans-serif';

/** The pressed ring: drawn only while a pointer is down, never a persistent state (Color 5). */
const PRESSED_RING = '#8fb8e6';

/** Footprints shorter than this use the compact variant (PD-08). */
export const COMPACT_BAT_HEIGHT = 39;

export interface BatBodyProps {
  readonly def: Pick<ToggleDef, 'label' | 'hit' | 'ball'>;
  readonly isSecond: boolean;
  /** True only while a pointer is down on the control. */
  readonly pressed: boolean;
  readonly stateLabel: string;
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
 * round cap, throw up to 14, label 8 above, lamp dot r 3.5, state text) repainted with a
 * bezel ring r 7, a chrome bat with a 1-unit dark outline and, for ENGINE MASTER, a ball tip
 * r 3.2. The handle points up for the second state and down for the first. Footprints under
 * 39 tall (the de-ice bats) use the compact variant (PD-08): throw 8, the name in Micro 6 just
 * above the footprint in free panel space, the state text 8 inside the footprint under the ring,
 * no lamp dot. No hooks, no state.
 */
export function BatBody({ def, isSecond, pressed, stateLabel }: BatBodyProps) {
  const compact = def.hit.h < COMPACT_BAT_HEIGHT;
  const h = def.hit.h;
  const top = -h / 2;

  const handle: Handle = compact
    ? { pivotY: -3, tipY: isSecond ? -11 : 5, width: 4, ringR: 6 }
    : (() => {
        const pivotY = 4.5;
        const reach = Math.min(14, (h - 37) / 2 - 1);
        return { pivotY, tipY: isSecond ? pivotY - reach : pivotY + reach, width: 5, ringR: 7 };
      })();

  const labelSize = compact ? 6 : 8;
  const labelY = compact ? top - 2 : top + 9;
  const labelWidth = compact
    ? textWidth(def.label, labelSize)
    : Math.min(def.label.length * 5.2, def.hit.w - 2);
  const lampY = labelY + 10;
  const stateSize = compact ? 8 : 10;
  const stateY = compact ? h / 2 - 3 : h / 2 - 6;

  const half = handle.width / 2;
  const capR = def.ball === true ? 3.2 : half;
  const batPoints = [
    `${-half},${handle.pivotY}`,
    `${half},${handle.pivotY}`,
    `${half},${handle.tipY}`,
    `${-half},${handle.tipY}`,
  ].join(' ');

  return (
    <g pointer-events="none">
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
      {compact ? null : (
        <circle
          cx={0}
          cy={lampY}
          r={3.5}
          fill={isSecond ? '#39d98a' : '#2b3138'}
          stroke="#4a525c"
          stroke-width={1}
        />
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
      <polygon points={batPoints} fill={paint('g-chrome')} stroke="#1b1d21" stroke-width={1} />
      <circle
        cx={0}
        cy={handle.tipY}
        r={capR}
        fill={paint('g-chrome')}
        stroke="#1b1d21"
        stroke-width={1}
      />
      <text
        data-state-text
        x={0}
        y={stateY}
        text-anchor="middle"
        font-family={FONT}
        font-size={compact ? 8 : 10}
        font-weight={700}
        fill="#e6e9ed"
        textLength={Math.max(textWidth(stateLabel, stateSize), 1)}
        lengthAdjust="spacingAndGlyphs"
      >
        {stateLabel}
      </text>
    </g>
  );
}
