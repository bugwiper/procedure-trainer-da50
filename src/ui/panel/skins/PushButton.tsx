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

/** Visible bezel radius of the round skins (UI-SPEC 8.3 Table B1). */
export const BEZEL_RADIUS = {
  'chrome-round': 26,
  'blue-dome': 16,
  'small-black': 9,
  'black-dome': 17,
} as const;
type RoundSkin = keyof typeof BEZEL_RADIUS;

function isRoundSkin(skin: string | undefined): skin is RoundSkin {
  return (
    skin === 'chrome-round' ||
    skin === 'blue-dome' ||
    skin === 'small-black' ||
    skin === 'black-dome'
  );
}

/** Width estimate of B612 text; the same number is used as textLength so tests match renders. */
export function textWidth(text: string, size: number): number {
  return text.length * size * 0.62;
}

export interface ButtonTextLayout {
  readonly labelLines: readonly string[];
  readonly labelSize: 6 | 8;
  /** Baselines, last line closest to the bezel. */
  readonly labelYs: readonly number[];
}

/**
 * Label above the bezel. A label wider than the footprint drops to one Micro 6 line (ANNUN
 * TEST). A button prints no state text (G-0.1): it shows its state by the cap position only.
 */
export function buttonTextLayout(
  def: Pick<MomentaryButtonDef, 'label' | 'hit'>,
  bezelR: number,
): ButtonTextLayout {
  const labelLines = [def.label];
  const labelSize = textWidth(def.label, 8) > def.hit.w ? 6 : 8;
  const lastY = -(bezelR + 2.5);
  const labelYs = labelLines.map((_, i) => lastY - (labelLines.length - 1 - i) * 7);
  return { labelLines, labelSize, labelYs };
}

/**
 * Pure art of every momentary control, chosen by `def.skin`. No hooks and no state, so node
 * tests can expand and count it. Light comes from the top left; no filters (D-06).
 */
export function PushButtonBody(props: PushButtonBodyProps) {
  const skin = props.def.skin;
  if (skin === 'spring-bat') return <SpringBatBody {...props} />;
  if (isRoundSkin(skin)) return <RoundBody {...props} skin={skin} />;
  return <LegacyBody {...props} />;
}

function RoundBody(props: PushButtonBodyProps & { skin: RoundSkin }) {
  const { def, skin } = props;
  const pressed = props.state !== def.states[0].id;
  const bezelR = BEZEL_RADIUS[skin];
  const text = buttonTextLayout(def, bezelR);
  return (
    <g pointer-events="none">
      {text.labelLines.map((line, i) => (
        <text
          key={line}
          x={0}
          y={text.labelYs[i]}
          text-anchor="middle"
          font-family={FONT}
          font-size={text.labelSize}
          fill="#aab3bd"
          textLength={textWidth(line, text.labelSize)}
          lengthAdjust="spacingAndGlyphs"
        >
          {line}
        </text>
      ))}
      <circle cx={0} cy={0} r={bezelR} fill="#0c0d0f" stroke="#2d3138" />
      {skin === 'chrome-round' ? <ChromeCap pressed={pressed} /> : null}
      {skin === 'blue-dome' ? <BlueCap pressed={pressed} /> : null}
      {skin === 'small-black' ? <SmallCap pressed={pressed} /> : null}
      {skin === 'black-dome' ? <BlackDomeCap pressed={pressed} /> : null}
    </g>
  );
}

/** Chrome ring, brushed cap, two hairlines. Pressed: cap 2 units smaller, darker, 1 down. */
function ChromeCap({ pressed }: { pressed: boolean }) {
  const r = pressed ? 18 : 20;
  const dy = pressed ? 1 : 0;
  return (
    <>
      <circle cx={0} cy={0} r={23} fill="none" stroke={paint('g-chrome')} stroke-width={3} />
      <circle cx={0} cy={dy} r={r} fill={paint('g-brushed')} stroke="#6b7580" stroke-width={0.5} />
      <circle cx={0} cy={dy} r={r - 6} fill="none" stroke="#6b7580" stroke-width={0.5} />
      <circle cx={0} cy={dy} r={r - 12} fill="none" stroke="#6b7580" stroke-width={0.5} />
      {pressed ? (
        <>
          <circle cx={0} cy={dy} r={r} fill="#000000" fill-opacity={0.2} />
          <circle cx={0} cy={0} r={19.8} fill="none" stroke={PRESSED_RING} stroke-width={1.6} />
        </>
      ) : null}
    </>
  );
}

/** Blue dome with a 3-unit highlight arc at the top left. */
function BlueCap({ pressed }: { pressed: boolean }) {
  const r = pressed ? 11 : 13;
  const dy = pressed ? 1 : 0;
  const arcR = r - 3.5;
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(arcR * Math.cos(a)).toFixed(2)} ${(dy + arcR * Math.sin(a)).toFixed(2)}`;
  };
  return (
    <>
      <circle cx={0} cy={dy} r={r} fill={pressed ? '#1858ab' : '#1f6fd6'} stroke="#164f99" />
      <path
        d={`M${at(195)} A${arcR} ${arcR} 0 0 1 ${at(255)}`}
        fill="none"
        stroke={pressed ? '#3f86d9' : '#5ba0f5'}
        stroke-width={3}
        stroke-linecap="round"
      />
      {pressed ? (
        <circle cx={0} cy={0} r={12.8} fill="none" stroke={PRESSED_RING} stroke-width={1.5} />
      ) : null}
    </>
  );
}

/**
 * Black glossy dome (the de-ice MAX button, owner finding G-1): flat dark fills and one highlight
 * arc at the top left, no filter. Pressed: the dome shrinks 2 units, darkens, sinks 1 and shows the
 * pressed ring.
 */
function BlackDomeCap({ pressed }: { pressed: boolean }) {
  const r = pressed ? 11 : 13;
  const dy = pressed ? 1 : 0;
  const arcR = r - 3.5;
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(arcR * Math.cos(a)).toFixed(2)} ${(dy + arcR * Math.sin(a)).toFixed(2)}`;
  };
  return (
    <>
      <circle cx={0} cy={dy} r={r} fill={pressed ? '#050506' : '#111316'} stroke="#3a4048" />
      <path
        d={`M${at(195)} A${arcR} ${arcR} 0 0 1 ${at(255)}`}
        fill="none"
        stroke={pressed ? '#3a4048' : '#6b7580'}
        stroke-width={2.5}
        stroke-linecap="round"
      />
      {pressed ? (
        <circle cx={0} cy={0} r={14.8} fill="none" stroke={PRESSED_RING} stroke-width={1.5} />
      ) : null}
    </>
  );
}

/** Small black button: cap r 6 with a lighter rim. */
function SmallCap({ pressed }: { pressed: boolean }) {
  const r = pressed ? 4 : 6;
  const dy = pressed ? 0.5 : 0;
  return (
    <>
      <circle cx={0} cy={dy} r={r} fill={pressed ? '#101215' : '#1b1d21'} stroke="#4a525c" />
      {pressed ? (
        <circle cx={0} cy={0} r={5.4} fill="none" stroke={PRESSED_RING} stroke-width={1} />
      ) : null}
    </>
  );
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
    </g>
  );
}
