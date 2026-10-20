import type { LeverSkin } from '../../../engine/registry';
import { paint } from '../Defs';

// Pure handle and track art for the lever skins (UI-SPEC 8.5, D-09). No hooks, no state: the
// DetentLever widget passes the position in, node tests expand these with tests/vnode-walk.ts.
// Every part is centred on (0, 0) of its own group; LeverBody places the handle at the detent.
// Light comes from the top left, flat paints only, ids from Defs.tsx (shading rules 1 to 6).

const FONT = 'B612, system-ui, sans-serif';

/** Transient grab outline, the same blue as the switch pressed ring. */
const DRAG_RING = '#8fb8e6';
const RED = '#c4161f';
const RED_EDGE = '#8f0f16';
const RED_HIGHLIGHT = '#f0535b';
const BLACK = '#0d0e10';
const BLACK_EDGE = '#2a2d33';
const SLOT = '#050506';
const SLOT_RIM = '#2d3138';
const STEM = '#8b9199';
const LEGEND = '#c9d0d8';
const METAL_EDGE = '#5d646c';

/**
 * Visible half extents of each skin's art and the tick it prints at every detent. `along` is the
 * larger of the handle and the slot margin beyond the track end; LeverBody uses it to keep the
 * lever name and the state text clear of the handle at either end.
 */
export interface SkinArt {
  readonly along: number;
  readonly across: number;
  /** Visible extent beneath the state text's column, where it is less than `along` (a round knob). */
  readonly under?: number;
  /** Smallest gap between the region top and the name baseline, 4 unless the tab needs less. */
  readonly nameInset?: number;
  /** Half length of the detent tick, across the track. */
  readonly tick: number;
  readonly tickColour: string;
}

export const LEVER_ART: Readonly<Record<LeverSkin, SkinArt>> = {
  'gear-knob': { along: 22, across: 22, under: 17, tick: 9, tickColour: '#6b7580' },
  'flaps-block': { along: 18, across: 27, nameInset: 6.5, tick: 27, tickColour: '#4a525c' },
  'bat-small': { along: 8, across: 7, tick: 7, tickColour: '#6b7580' },
  'pull-t': { along: 11, across: 11, tick: 8, tickColour: '#6b7580' },
  'pull-tab': { along: 20, across: 7, nameInset: 6.5, tick: 8, tickColour: '#6b7580' },
  'pull-boot': { along: 22, across: 12, nameInset: 6.5, tick: 8, tickColour: '#6b7580' },
  'power-grip': { along: 15, across: 22, tick: 7, tickColour: '#4a525c' },
  'cowl-slider': { along: 8, across: 10, tick: 4, tickColour: '#4a525c' },
  'parking-lever': { along: 14, across: 10, tick: 4, tickColour: '#4a525c' },
  'env-slider': { along: 7, across: 11, tick: 6, tickColour: '#6b7580' },
};

function outline(dragging: boolean, rest: string): { stroke: string; 'stroke-width': number } {
  return dragging ? { stroke: DRAG_RING, 'stroke-width': 2 } : { stroke: rest, 'stroke-width': 1 };
}

const round = (n: number): number => Math.round(n * 100) / 100;

/** Twelve radial flute lines of the gear knob as one path. */
const FLUTES = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return `M${round(9 * c)} ${round(9 * s)}L${round(20 * c)} ${round(20 * s)}`;
}).join('');

export interface LeverHandleProps {
  readonly skin: LeverSkin;
  readonly axis: 'v' | 'h';
  /** True only while the handle is being dragged. */
  readonly dragging: boolean;
}

/** The handle art of one skin, centred on its own origin. */
export function LeverHandle({ skin, axis, dragging }: LeverHandleProps) {
  switch (skin) {
    case 'gear-knob':
      return (
        <g>
          <circle r={22} fill={paint('g-silver')} {...outline(dragging, METAL_EDGE)} />
          <path d={FLUTES} fill="none" stroke="#7d838b" stroke-width={0.8} />
          <circle r={8} fill={paint('g-chrome')} stroke={METAL_EDGE} stroke-width={0.8} />
        </g>
      );
    case 'flaps-block':
      return (
        <g>
          <rect
            x={-23}
            y={-13}
            width={46}
            height={26}
            rx={4}
            fill={BLACK}
            {...outline(dragging, BLACK_EDGE)}
          />
          <rect x={-19} y={-12} width={38} height={1} fill={BLACK_EDGE} />
        </g>
      );
    case 'bat-small':
      return (
        <g>
          <circle r={6} fill="#14171b" {...outline(dragging, METAL_EDGE)} />
          <path
            d="M-1.6 6.5L1.6 6.5L2.4 -6.5L-2.4 -6.5Z"
            fill={paint('g-chrome')}
            stroke="#3a4048"
            stroke-width={0.8}
            stroke-linejoin="round"
          />
        </g>
      );
    case 'pull-t':
      return (
        <g>
          <circle r={11} fill={RED} {...outline(dragging, RED_EDGE)} />
          <ellipse cx={-3} cy={-5} rx={5} ry={2.5} fill={RED_HIGHLIGHT} />
          <text
            x={0}
            y={2.5}
            text-anchor="middle"
            font-family={FONT}
            font-size={6}
            font-weight={700}
            fill="#ffffff"
          >
            PULL
          </text>
        </g>
      );
    case 'pull-tab':
      return (
        <g>
          <rect
            x={-7}
            y={-20}
            width={14}
            height={40}
            rx={2}
            fill={RED}
            {...outline(dragging, RED_EDGE)}
          />
          <rect x={-6} y={-19} width={12} height={1} fill={RED_HIGHLIGHT} />
          <text
            transform="rotate(90)"
            x={0}
            y={2}
            text-anchor="middle"
            font-family={FONT}
            font-size={6}
            font-weight={700}
            fill="#ffffff"
          >
            PULL
          </text>
        </g>
      );
    case 'pull-boot':
      return (
        <g>
          <rect
            x={-12}
            y={-22}
            width={24}
            height={44}
            rx={5}
            fill="#0f1012"
            {...outline(dragging, SLOT_RIM)}
          />
          <rect x={-8} y={-21} width={16} height={1} fill={BLACK_EDGE} />
          <text
            transform="rotate(90)"
            x={0}
            y={2}
            text-anchor="middle"
            font-family={FONT}
            font-size={6}
            font-weight={700}
            fill="#ffffff"
            textLength={34}
            lengthAdjust="spacingAndGlyphs"
          >
            ALTERNATE AIR
          </text>
        </g>
      );
    case 'power-grip':
      // Plan view, fore at the top. No emblem or logo on the grip (D-05).
      return (
        <g>
          <path
            d="M-22 15L22 15L17 -15L-17 -15Z"
            fill={paint('p-carbon')}
            stroke={dragging ? DRAG_RING : '#6f757d'}
            stroke-width={dragging ? 2 : 1}
            stroke-linejoin="round"
          />
          <path d="M-22 15L22 15L21 10L-21 10Z" fill="#6f757d" />
          <path d="M-15 -14.2L15 -14.2" stroke="#e8ecf0" stroke-width={1} />
        </g>
      );
    case 'cowl-slider':
      return (
        <g>
          <rect
            x={-10}
            y={-6}
            width={20}
            height={12}
            rx={2}
            fill={BLACK}
            {...outline(dragging, BLACK_EDGE)}
          />
          <rect x={-8} y={-5} width={16} height={1} fill={BLACK_EDGE} />
        </g>
      );
    case 'parking-lever':
      return (
        <g>
          <path
            d="M-10 14L10 14L6 -14L-6 -14Z"
            fill={BLACK}
            stroke={dragging ? DRAG_RING : BLACK_EDGE}
            stroke-width={dragging ? 2 : 1}
            stroke-linejoin="round"
          />
          <path d="M-5 -13L5 -13" stroke={BLACK_EDGE} stroke-width={1} />
        </g>
      );
    case 'env-slider': {
      // 22 across the slot by 14 along it.
      const w = axis === 'v' ? 22 : 14;
      const h = axis === 'v' ? 14 : 22;
      return (
        <g>
          <rect
            x={-w / 2}
            y={-h / 2}
            width={w}
            height={h}
            rx={2}
            fill={BLACK}
            {...outline(dragging, BLACK_EDGE)}
          />
          <rect x={-w / 2 + 2} y={-h / 2 + 1} width={w - 4} height={1} fill={BLACK_EDGE} />
        </g>
      );
    }
    default:
      return unknownSkin(skin);
  }
}

function unknownSkin(skin: never): never {
  throw new Error(`no lever handle for skin "${String(skin)}"`);
}

export interface LeverTrackProps {
  readonly skin: LeverSkin;
  readonly length: number;
  readonly axis: 'v' | 'h';
  /** Handle centre relative to the track centre. */
  readonly handleAt: { readonly dx: number; readonly dy: number };
}

/** Stem from the panel entry (stowed end, top) to a pulled handle: the cable. */
function PullTrack({
  length,
  handleAt,
  along,
}: {
  length: number;
  handleAt: LeverTrackProps['handleAt'];
  along: number;
}) {
  const plateY = -length / 2 - along - 2;
  const stemEnd = handleAt.dy - along;
  return (
    <g>
      <rect x={-2} y={plateY} width={4} height={Math.max(0, stemEnd - plateY)} fill={STEM} />
    </g>
  );
}

/** A dark slot centred on the track, `w` wide across and `length + pad` long along it. */
function Slot({
  axis,
  w,
  length,
  pad,
}: {
  axis: 'v' | 'h';
  w: number;
  length: number;
  pad: number;
}) {
  const long = length + pad;
  return (
    <rect
      x={axis === 'v' ? -w / 2 : -long / 2}
      y={axis === 'v' ? -long / 2 : -w / 2}
      width={axis === 'v' ? w : long}
      height={axis === 'v' ? long : w}
      rx={Math.min(w / 2, 6)}
      fill={SLOT}
      stroke={SLOT_RIM}
      stroke-width={1}
    />
  );
}

/** The track art under the handle: stems, slots, cables and the MAX placard of POWER. */
export function LeverTrack({ skin, length, axis, handleAt }: LeverTrackProps) {
  switch (skin) {
    case 'gear-knob': {
      // Bat stem 6 wide from the track centre to the knob, on a chrome pivot.
      const top = Math.min(0, handleAt.dy);
      return (
        <g>
          <rect x={-3} y={top} width={6} height={Math.abs(handleAt.dy)} fill={paint('g-chrome')} />
          <circle r={6} fill={paint('g-chrome')} stroke={METAL_EDGE} stroke-width={0.8} />
        </g>
      );
    }
    case 'flaps-block':
      return <Slot axis={axis} w={54} length={length} pad={36} />;
    case 'bat-small':
      return <Slot axis={axis} w={4} length={length} pad={16} />;
    case 'pull-t':
    case 'pull-tab':
    case 'pull-boot':
      return <PullTrack length={length} handleAt={handleAt} along={LEVER_ART[skin].along} />;
    case 'power-grip':
      return (
        <g>
          <Slot axis={axis} w={14} length={length} pad={16} />
          <text
            x={-26}
            y={-length / 2 + 2}
            text-anchor="end"
            font-family={FONT}
            font-size={6}
            font-weight={700}
            fill={LEGEND}
          >
            MAX
          </text>
        </g>
      );
    case 'cowl-slider':
      return <Slot axis={axis} w={8} length={length} pad={12} />;
    case 'parking-lever':
      return <Slot axis={axis} w={8} length={length} pad={14} />;
    case 'env-slider':
      return <Slot axis={axis} w={4} length={length} pad={14} />;
    default:
      return unknownSkin(skin);
  }
}

/**
 * Original simple glyphs for the environmental sliders (lines and arcs, 10 x 10, centred on
 * the origin), keyed by detent id. Their meaning is unconfirmed (UI-SPEC unconfirmed item 9).
 */
export const ENV_ICONS: Readonly<Record<string, string>> = {
  // Windshield with two warm-air lines rising into it.
  defrost: 'M-5 4L-3.5 -4H3.5L5 4Z M-2 3V-1 M2 3V-1',
  // Head and shoulders, the air blowing at the face.
  face: 'M-2.2 -3a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0 M-5 5q5 -7 10 0',
  // A shoe sole seen from the side.
  feet: 'M-3 -5V1L-5 3V5H4V3H0V-5Z',
  // Outside air entering the cabin outline.
  fresh: 'M-6 0H0 M-3 -3L0 0L-3 3 M1.5 -4H6V4H1.5',
  // A loop arrow, the cabin air going round.
  recirc: 'M-3.5 -1a4 4 0 1 1 1.4 3.6 M-3.5 -4.5V-1H-0.5',
};

/** Icon placement is the widget's concern; this renders one glyph at a point. */
export function EnvIcon({ detent, x, y }: { detent: string; x: number; y: number }) {
  const d = ENV_ICONS[detent];
  if (d === undefined) return null;
  return (
    <path
      data-icon={detent}
      d={d}
      transform={`translate(${x} ${y})`}
      fill="none"
      stroke={LEGEND}
      stroke-width={1}
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  );
}
