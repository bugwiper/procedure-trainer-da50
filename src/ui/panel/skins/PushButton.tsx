import type { MomentaryButtonDef, StateId } from '../../../engine/registry';
import { paint } from '../Defs';

const FONT = 'B612, system-ui, sans-serif';

/** Held-side of the spring toggle, seen from the pilot: left half or right half. */
export type PressedSide = 'left' | 'right' | null;

export interface PushButtonBodyProps {
  readonly def: Pick<MomentaryButtonDef, 'label' | 'hit' | 'states' | 'skin'>;
  readonly state: StateId;
  /** Which half of a three-state toggle is held; always null for two-state buttons. */
  readonly pressedSide: PressedSide;
}

/** The pressed ring: drawn only while a pointer is down, never a persistent state (Color 5). */
export const PRESSED_RING = '#8fb8e6';

/**
 * Pure art of every momentary control, chosen by `def.skin`. No hooks and no state, so node
 * tests can expand and count it. Light comes from the top left; no filters (D-06).
 */
export function PushButtonBody(props: PushButtonBodyProps) {
  switch (props.def.skin) {
    case 'spring-bat':
      return <SpringBatBody {...props} />;
    default:
      return <LegacyBody {...props} />;
  }
}

function stateLabelOf(props: PushButtonBodyProps): string {
  const found = props.def.states.find((s) => s.id === props.state);
  return (found ?? props.def.states[0]).label;
}

/** Phase 1 look, kept for skins that are not drawn yet. */
function LegacyBody(props: PushButtonBodyProps) {
  const { def } = props;
  const isPressed = props.state !== def.states[0].id;
  const top = -def.hit.h / 2;
  const labelY = top + 9;
  const textY = def.hit.h / 2 - 6;
  const capY = (labelY + textY) / 2;
  const capR = Math.min(13, (textY - labelY) / 2 - 8);
  const labelWidth = Math.min(def.label.length * 5.2, def.hit.w - 2);
  return (
    <g pointer-events="none">
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
      <circle
        cx={0}
        cy={capY}
        r={capR + 3}
        fill="none"
        stroke={isPressed ? PRESSED_RING : '#2b3138'}
        stroke-width={2}
      />
      <circle
        cx={0}
        cy={capY + (isPressed ? 1 : 0)}
        r={isPressed ? capR - 1 : capR}
        fill={isPressed ? '#2f353c' : '#4a525c'}
        stroke="#6b7580"
      />
      <text
        data-state-text
        x={0}
        y={textY}
        text-anchor="middle"
        font-family={FONT}
        font-size={8}
        font-weight={700}
        fill="#d8dde3"
      >
        {stateLabelOf(props)}
      </text>
    </g>
  );
}

// Spring-return bat toggle (STALL TEST / GEAR TEST). Style of UI-SPEC 8.2: bezel ring r 7
// #0c0d0f with rim #2d3138, a 5-wide chrome bat with a 1-unit dark outline. The tip points
// straight up at NEUTRAL and is thrown 10 units to the held side.
const BAT_PIVOT_Y = 2;
const BAT_REACH = 11;
const BAT_THROW = 10;

function batPolygon(tipX: number, tipY: number): string {
  // Quadrilateral from a 5-wide base at the pivot to a 3.4-wide tip: a polygon (not a stroked
  // line) so the shared vertical gradient has a real bounding box to paint.
  const dx = tipX;
  const dy = tipY - BAT_PIVOT_Y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const p = (bx: number, by: number, half: number, sign: number) =>
    `${(bx + sign * nx * half).toFixed(2)},${(by + sign * ny * half).toFixed(2)}`;
  return [
    p(0, BAT_PIVOT_Y, 2.5, 1),
    p(tipX, tipY, 1.7, 1),
    p(tipX, tipY, 1.7, -1),
    p(0, BAT_PIVOT_Y, 2.5, -1),
  ].join(' ');
}

/** Caption lines of the two throws, placed above-left and above-right of the footprint. */
const CAPTION_LEFT = ['STALL', 'TEST'] as const;
const CAPTION_RIGHT = ['GEAR', 'TEST'] as const;

function SpringBatBody(props: PushButtonBodyProps) {
  const { def, pressedSide } = props;
  const half = def.hit.h / 2;
  const held = pressedSide !== null;
  const tipX = pressedSide === 'left' ? -BAT_THROW : pressedSide === 'right' ? BAT_THROW : 0;
  const tipY = BAT_PIVOT_Y - BAT_REACH;
  const caption = (lines: readonly string[], x: number, anchor: 'start' | 'end') =>
    lines.map((line, i) => (
      <text
        key={line + String(i)}
        x={x}
        y={-half - 8 + i * 7}
        text-anchor={anchor}
        font-family={FONT}
        font-size={6}
        fill="#aab3bd"
      >
        {line}
      </text>
    ));
  return (
    <g pointer-events="none">
      {caption(CAPTION_LEFT, -4, 'end')}
      {caption(CAPTION_RIGHT, 4, 'start')}
      <circle
        cx={0}
        cy={BAT_PIVOT_Y}
        r={7}
        fill="#0c0d0f"
        stroke={held ? PRESSED_RING : '#2d3138'}
        stroke-width={held ? 2 : 1}
      />
      <polygon
        points={batPolygon(tipX, tipY)}
        fill={paint('g-chrome')}
        stroke="#1b1d21"
        stroke-width={1}
        stroke-linejoin="round"
      />
      <circle cx={tipX} cy={tipY} r={2.4} fill={paint('g-chrome')} stroke="#1b1d21" />
      <text
        data-state-text
        x={0}
        y={half - 3}
        text-anchor="middle"
        font-family={FONT}
        font-size={8}
        font-weight={700}
        fill="#d8dde3"
        textLength={Math.min(stateLabelOf(props).length * 5.4, def.hit.w - 4)}
        lengthAdjust="spacingAndGlyphs"
      >
        {stateLabelOf(props)}
      </text>
    </g>
  );
}
