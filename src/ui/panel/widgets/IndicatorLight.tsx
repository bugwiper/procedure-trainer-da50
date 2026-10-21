import { BEZEL_EXTRA } from '../../../engine/indicators';
import type { IndicatorColour, IndicatorDef } from '../../../engine/indicators';
import type { PanelBridge } from '../../bridge';
import { paint } from '../Defs';
import type { DefId } from '../Defs';

const FONT = 'B612, system-ui, sans-serif';

/** Halo radius of a lamp: 13 for the standard r 7, and a smaller halo for a smaller lamp. */
export function haloRadius(r: number): number {
  return r + 6;
}

/** Lamp colours (UI-SPEC Color, item 3). Lit and unlit fills keep a luminance ratio of 3:1 or more. */
export const LAMP_COLOURS: Readonly<
  Record<
    IndicatorColour,
    { readonly lit: string; readonly unlit: string; readonly ring: string; readonly halo: DefId }
  >
> = {
  green: { lit: '#3ddc84', unlit: '#16241c', ring: '#35453b', halo: 'g-halo-green' },
  red: { lit: '#ff4338', unlit: '#2a1416', ring: '#4a2a2d', halo: 'g-halo-red' },
  white: { lit: '#f6f8fa', unlit: '#24272b', ring: '#484d54', halo: 'g-halo-white' },
  amber: { lit: '#ffb81c', unlit: '#2a2110', ring: '#4a3d22', halo: 'g-halo-amber' },
};

export interface LampBodyProps {
  readonly label: string;
  readonly colour: IndicatorColour;
  readonly r: number;
  readonly lit: boolean;
  readonly caption: 'above' | 'right' | 'none';
}

/**
 * Pure lamp art: bezel, optional halo, disc, ring and caption. Lit reads without colour: a thick
 * bright ring and an inner white ring. Unlit is a dark disc with a thin hollow ring. No animation.
 */
export function LampBody({ label, colour, r, lit, caption }: LampBodyProps) {
  const c = LAMP_COLOURS[colour];
  const bezel = r + BEZEL_EXTRA;
  return (
    <g>
      <circle r={bezel} fill="#0c0d0f" stroke="#2d3138" stroke-width={1} />
      {lit ? <circle r={haloRadius(r)} fill={paint(c.halo)} /> : null}
      <circle r={r} fill={lit ? c.lit : c.unlit} />
      <circle
        r={lit ? r - 1 : r - 0.5}
        fill="none"
        stroke={lit ? c.lit : c.ring}
        stroke-width={lit ? 2 : 1}
      />
      {lit ? (
        <circle r={r - 3} fill="none" stroke="#ffffff" stroke-opacity={0.7} stroke-width={1} />
      ) : null}
      {caption === 'none' ? null : (
        <text
          x={caption === 'above' ? 0 : bezel + 4}
          y={caption === 'above' ? -(bezel + 3) : 2}
          text-anchor={caption === 'above' ? 'middle' : 'start'}
          font-family={FONT}
          font-size={6}
          fill="#aab3bd"
          pointer-events="none"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/**
 * One derived lamp. Reads its computed signal; has no hit rect, no handler and no tap-target
 * attribute, so a tap on it is a tap on the background (PD-07, T-01.1-09).
 */
export function IndicatorLight({ def, bridge }: { def: IndicatorDef; bridge: PanelBridge }) {
  const lit = bridge.indicatorOf(def.id).value;
  return (
    <g
      data-indicator-id={def.id}
      data-kind="indicator"
      data-lit={lit ? 'true' : 'false'}
      role="img"
      aria-label={`${def.label}: ${lit ? 'LIT' : 'OFF'}`}
      transform={`translate(${def.x} ${def.y})`}
      pointer-events="none"
    >
      <LampBody label={def.label} colour={def.colour} r={def.r} lit={lit} caption={def.caption} />
    </g>
  );
}
