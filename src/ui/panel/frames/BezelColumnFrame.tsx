import { BEZEL_COLUMNS } from '../../../aircraft/da50rg/avionics';
import type {
  BezelColumnId,
  ColumnElement,
  ColumnJoystick,
  ColumnKey,
  ColumnKnob,
  ColumnSwap,
  ColumnText,
} from '../../../aircraft/da50rg/avionics';
import type { FrameProps } from './MfdFrame';
import { UnitGroup } from './UnitHousing';

// Knob and key columns beside the glass displays (phase 01.2 plan 07, D-04, D-05, T-01.2-12):
// inert art drawn from the BEZEL_COLUMNS tables, one function per element type. Hook-free, no
// handler, no hit rectangle, no control id; the surrounding UnitGroup hides it from assistive
// technology and turns pointer events off, so a tap on it only zooms. Knurl ticks and highlights
// are single paths each, so a knob is four shapes and the element budget holds.

const FONT = 'B612, system-ui, sans-serif';
const DISC = '#0d0e10';
const DISC_RIM = '#3a3f46';
const KNURL = '#2e3238';
const CAP = '#1a1c20';
const HIGHLIGHT = 'rgba(255,255,255,0.14)';
const KEY_FILL = '#15181c';
const KEY_RIM = '#2d3138';
const KEY_TOP_EDGE = 'rgba(255,255,255,0.14)';
const GLYPH = '#e6e9ed';
const NAME_FILL = '#c9d0d8';
const SUB_FILL = '#aab3bd';

const TICKS = 16;

/** Rounded to two decimals so the path strings stay short and stable. */
const n = (value: number): string => String(Math.round(value * 100) / 100);

/** Point on a circle at a screen angle in degrees (y points down). */
function polar(cx: number, cy: number, r: number, degrees: number): string {
  const rad = (degrees * Math.PI) / 180;
  return `${n(cx + r * Math.cos(rad))} ${n(cy + r * Math.sin(rad))}`;
}

/** The 16 knurl ticks from 0.82 R to R as one path. */
function knurlPath(cx: number, cy: number, r: number): string {
  const parts: string[] = [];
  for (let i = 0; i < TICKS; i++) {
    const a = (360 / TICKS) * i;
    parts.push(`M ${polar(cx, cy, r * 0.82, a)} L ${polar(cx, cy, r, a)}`);
  }
  return parts.join(' ');
}

/** The top-left highlight: a short arc just inside the rim, one path. */
function highlightPath(cx: number, cy: number, r: number): string {
  const ra = r * 0.9;
  return `M ${polar(cx, cy, ra, 205)} A ${n(ra)} ${n(ra)} 0 0 1 ${polar(cx, cy, ra, 250)}`;
}

function Knob({ e }: { e: ColumnKnob }) {
  return (
    <g data-knob={e.id}>
      <circle cx={e.cx} cy={e.cy} r={e.r} fill={DISC} stroke={DISC_RIM} stroke-width={1} />
      <path d={knurlPath(e.cx, e.cy, e.r)} fill="none" stroke={KNURL} stroke-width={0.8} />
      <circle cx={e.cx} cy={e.cy} r={n(e.r * 0.55)} fill={CAP} />
      <path d={highlightPath(e.cx, e.cy, e.r)} fill="none" stroke={HIGHLIGHT} stroke-width={0.8} />
    </g>
  );
}

function Joystick({ e }: { e: ColumnJoystick }) {
  return (
    <g data-joystick={e.id}>
      <circle cx={e.cx} cy={e.cy} r={e.r} fill={DISC} stroke={DISC_RIM} stroke-width={1} />
      <circle cx={e.cx} cy={e.cy} r={n(e.r * 0.5)} fill={CAP} />
      <path d={highlightPath(e.cx, e.cy, e.r)} fill="none" stroke={HIGHLIGHT} stroke-width={0.8} />
    </g>
  );
}

/** Rounded cap shared by the swap button and the keys: dark face, light top edge, thin rim. */
function Cap({ cx, cy, w, h }: { cx: number; cy: number; w: number; h: number }) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  return (
    <>
      <rect
        x={n(x)}
        y={n(y)}
        width={w}
        height={h}
        rx={3}
        fill={KEY_FILL}
        stroke={KEY_RIM}
        stroke-width={1}
      />
      <path
        d={`M ${n(x + 3)} ${n(y + 1.5)} H ${n(x + w - 3)}`}
        fill="none"
        stroke={KEY_TOP_EDGE}
        stroke-width={1}
      />
    </>
  );
}

function Swap({ e }: { e: ColumnSwap }) {
  const half = e.w / 2 - 6;
  const l = e.cx - half;
  const r = e.cx + half;
  // Double arrow: a shaft with a head at each end, one path.
  const d =
    `M ${n(l)} ${n(e.cy)} H ${n(r)}` +
    ` M ${n(l + 3)} ${n(e.cy - 2.5)} L ${n(l)} ${n(e.cy)} L ${n(l + 3)} ${n(e.cy + 2.5)}` +
    ` M ${n(r - 3)} ${n(e.cy - 2.5)} L ${n(r)} ${n(e.cy)} L ${n(r - 3)} ${n(e.cy + 2.5)}`;
  return (
    <g data-swap={e.id}>
      <Cap cx={e.cx} cy={e.cy} w={e.w} h={e.h} />
      <path d={d} fill="none" stroke={GLYPH} stroke-width={1} />
    </g>
  );
}

function Key({ e }: { e: ColumnKey }) {
  return (
    <g data-key={e.id}>
      <Cap cx={e.cx} cy={e.cy} w={e.w} h={e.h} />
      {e.legend === null ? (
        <>
          <text
            x={n(e.cx - 9)}
            y={n(e.cy + 2.1)}
            text-anchor="start"
            font-family={FONT}
            font-size={6}
            fill={GLYPH}
          >
            D
          </text>
          <path
            d={`M ${n(e.cx - 2)} ${n(e.cy)} H ${n(e.cx + 7)} M ${n(e.cx + 4)} ${n(e.cy - 2.5)} L ${n(e.cx + 7)} ${n(e.cy)} L ${n(e.cx + 4)} ${n(e.cy + 2.5)}`}
            fill="none"
            stroke={GLYPH}
            stroke-width={1}
          />
        </>
      ) : (
        <text
          x={e.cx}
          y={n(e.cy + 2.1)}
          text-anchor="middle"
          font-family={FONT}
          font-size={6}
          fill={GLYPH}
        >
          {e.legend}
        </text>
      )}
    </g>
  );
}

/** Static name (size 8) or sub-legend (size 6); the literal sizes keep the scale scan honest. */
function Legend({ e }: { e: ColumnText }) {
  return e.size === 8 ? (
    <text x={e.x} y={e.y} text-anchor={e.anchor} font-family={FONT} font-size={8} fill={NAME_FILL}>
      {e.text}
    </text>
  ) : (
    <text x={e.x} y={e.y} text-anchor={e.anchor} font-family={FONT} font-size={6} fill={SUB_FILL}>
      {e.text}
    </text>
  );
}

function Element({ e }: { e: ColumnElement }) {
  switch (e.kind) {
    case 'knob':
      return <Knob e={e} />;
    case 'joystick':
      return <Joystick e={e} />;
    case 'swap':
      return <Swap e={e} />;
    case 'key':
      return <Key e={e} />;
    case 'text':
      return <Legend e={e} />;
  }
}

function isColumn(id: string): id is BezelColumnId {
  return id in BEZEL_COLUMNS;
}

/**
 * One knob and key column, drawn from BEZEL_COLUMNS in the local space of its region. A region
 * without a table draws the empty not-operable group only.
 */
export function BezelColumnFrame({ region }: FrameProps) {
  const elements = isColumn(region.id) ? BEZEL_COLUMNS[region.id] : [];
  return (
    <UnitGroup id={region.id}>
      {elements.map((e, i) => (
        <Element key={i} e={e} />
      ))}
    </UnitGroup>
  );
}
