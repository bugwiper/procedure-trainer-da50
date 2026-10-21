import type { DetentLeverDef } from '../../../engine/registry';

/** The pressed ring: drawn only while a pointer is down, never a persistent state (Color 5). */
const PRESSED_RING = '#8fb8e6';

/** Console recess the flap sits in (as in the owner's side-view photo), drawn in both states. */
const RECESS = { w: 36, h: 44, cy: 4, fill: '#050506', rim: '#2d3138' } as const;

/** The flap: 30 wide, 34 long, hinged on its lower edge; x -15 to 15, y -12 to 22 when released. */
export const FLAP = {
  halfW: 15,
  length: 34,
  hingeY: 22,
  /**
   * Documented geometric model: the pulled flap stands this many degrees about its hinge (allowed
   * 45 to 75, R2-4.2). The drawn rise of the plate lies between length x cos and length x sin of it.
   */
  angleDeg: 60,
} as const;

/**
 * The pulled plate in perspective (R3-4.1, owner sketch): a quadrilateral over the hinge line. Its
 * bottom edge is the level hinge line; its top edge is level, shorter than the base and shifted to
 * the right of the base's left end; the left side slants up to the right and the right side up and
 * slightly right. The sketch measures a top edge of 0.83 of the base and the owner's words say
 * 55 to 60 percent; 0.7 is the middle and keeps the plate inside the 44 wide footprint.
 */
export const PLATE = {
  /** Top edge length as a fraction of the base (the hinge line, 30 wide). */
  topFraction: 0.7,
  /** Shift of the top edge's left end to the right of the base's left end, as a fraction of the base. */
  shiftFraction: 0.5,
  /** Projected rise from the hinge line to the top edge, control-local units (17 to 29.4 for 60 degrees). */
  rise: 22,
} as const;

const TONE = {
  face: '#2b3036',
  edge: '#4a525c',
  freeEdge: '#6b7580',
} as const;

export interface Point {
  readonly x: number;
  readonly y: number;
}

const f = (n: number): string => n.toFixed(2).replace(/\.?0+$/, '');
const pts = (points: readonly Point[]): string =>
  points.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');

/**
 * The four points of the pulled plate, control-local, y down: A hinge left, B hinge right (the
 * level bottom edge, as wide as the flap), C top right, D top left (the level top edge).
 */
export function flapPlate(): readonly [Point, Point, Point, Point] {
  const base = FLAP.halfW * 2;
  const topY = FLAP.hingeY - PLATE.rise;
  const dx = -FLAP.halfW + base * PLATE.shiftFraction;
  return [
    { x: -FLAP.halfW, y: FLAP.hingeY },
    { x: FLAP.halfW, y: FLAP.hingeY },
    { x: dx + base * PLATE.topFraction, y: topY },
    { x: dx, y: topY },
  ];
}

export interface FlapBodyProps {
  readonly def: Pick<DetentLeverDef, 'hit'>;
  /** The committed detent id: 'set' stands the flap up, anything else leaves it flat. */
  readonly state: string;
  /** True only while a pointer is down on the control. */
  readonly pressed: boolean;
}

/**
 * Pure body of the hinged flap (R2-4.2, D-09, R3-4.1): a recess in the console and, released, the
 * flap flat in the panel surface; pulled, one plate in the flap's grey hinged on the same bottom
 * line and tilted back (see PLATE), with a highlight on its top edge. Prints no text in either
 * state (G-0.1); the placard names it. No hooks.
 */
export function FlapBody({ state, pressed }: FlapBodyProps) {
  const pulled = state === 'set';
  const plate = flapPlate();
  const top = FLAP.hingeY - FLAP.length;
  return (
    <g data-flap={pulled ? 'set' : 'off'} pointer-events="none">
      <rect
        x={-RECESS.w / 2}
        y={RECESS.cy - RECESS.h / 2}
        width={RECESS.w}
        height={RECESS.h}
        rx={4}
        fill={RECESS.fill}
        stroke={pressed ? PRESSED_RING : RECESS.rim}
        stroke-width={pressed ? 2 : 1}
      />
      {pulled ? (
        <>
          <polygon
            data-flap-plate=""
            points={pts(plate)}
            fill={TONE.face}
            stroke={TONE.edge}
            stroke-width={1}
            stroke-linejoin="round"
          />
          <line
            data-flap-free=""
            x1={plate[3].x + 1}
            y1={plate[3].y}
            x2={plate[2].x - 1}
            y2={plate[2].y}
            stroke={TONE.freeEdge}
            stroke-width={1}
            stroke-linecap="round"
          />
        </>
      ) : (
        <>
          <rect
            data-flap-face=""
            x={-FLAP.halfW}
            y={top}
            width={FLAP.halfW * 2}
            height={FLAP.length}
            rx={3}
            fill={TONE.face}
            stroke={TONE.edge}
            stroke-width={1}
          />
          <line
            data-flap-free=""
            x1={-FLAP.halfW + 3}
            y1={top + 1}
            x2={FLAP.halfW - 3}
            y2={top + 1}
            stroke={TONE.freeEdge}
            stroke-width={1}
          />
        </>
      )}
    </g>
  );
}
