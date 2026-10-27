import type { DetentLeverDef } from '../../../engine/registry';

// The red door release lever (Phase 5.1, P-09): a long lever in the pilot's arm rest. Locked it
// lies flat along the recess; open it is pulled up and stands as a red plate in the same
// pseudo-perspective as the parking flap, about four times as long. Control-local units, origin at
// the centre of the 56 x 176 footprint. No text in either state (G-0).

/** The pressed ring: drawn only while a pointer is down, never a persistent state. */
const PRESSED_RING = '#8fb8e6';

/** The arm-rest recess the lever lies in, drawn in both states. */
const RECESS = { w: 40, h: 150, rx: 6, fill: '#050506', rim: '#2d3138' } as const;

/** The lever: 26 wide, hinged on its lower end at y 62. */
export const DOOR_LEVER = {
  halfW: 13,
  hingeY: 62,
  /** Length of the lever lying flat. */
  length: 120,
  /** Projected rise of the pulled plate from the hinge line to its top edge. */
  rise: 90,
  /** Top edge of the pulled plate as a fraction of the base, and the shift of its left end. */
  topFraction: 0.7,
  shiftFraction: 0.5,
} as const;

const TONE = {
  face: '#b3201c',
  dark: '#7e1512',
  edge: '#d8514a',
  freeEdge: '#f08a82',
  pin: '#3a4048',
} as const;

export interface Point {
  readonly x: number;
  readonly y: number;
}

const f = (n: number): string => n.toFixed(2).replace(/\.?0+$/, '');
const pts = (points: readonly Point[]): string =>
  points.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');

/** The four points of the pulled plate: hinge left, hinge right, top right, top left (y down). */
export function doorPlate(): readonly [Point, Point, Point, Point] {
  const base = DOOR_LEVER.halfW * 2;
  const topY = DOOR_LEVER.hingeY - DOOR_LEVER.rise;
  const dx = -DOOR_LEVER.halfW + base * DOOR_LEVER.shiftFraction;
  return [
    { x: -DOOR_LEVER.halfW, y: DOOR_LEVER.hingeY },
    { x: DOOR_LEVER.halfW, y: DOOR_LEVER.hingeY },
    { x: dx + base * DOOR_LEVER.topFraction, y: topY },
    { x: dx, y: topY },
  ];
}

export interface DoorReleaseBodyProps {
  readonly def: Pick<DetentLeverDef, 'hit'>;
  /** The committed detent id: 'open' pulls the lever up, anything else leaves it lying. */
  readonly state: string;
  /** True only while a pointer is down on the control. */
  readonly pressed: boolean;
}

/**
 * Pure body of the door release lever: the recess, a hinge pin and, locked, a rounded red bar lying
 * along the recess with a grip mark; open, a red plate standing from the hinge with a highlight on
 * its free edge and a dark shadow on the recess. No hooks.
 */
export function DoorReleaseBody({ state, pressed }: DoorReleaseBodyProps) {
  const open = state === 'open';
  const plate = doorPlate();
  const top = DOOR_LEVER.hingeY - DOOR_LEVER.length;
  return (
    <g data-door={open ? 'open' : 'locked'} pointer-events="none">
      <rect
        x={-RECESS.w / 2}
        y={-RECESS.h / 2}
        width={RECESS.w}
        height={RECESS.h}
        rx={RECESS.rx}
        fill={RECESS.fill}
        stroke={pressed ? PRESSED_RING : RECESS.rim}
        stroke-width={pressed ? 2 : 1}
      />
      {open ? (
        <>
          <polygon
            data-door-shadow=""
            points={pts([
              { x: -DOOR_LEVER.halfW, y: DOOR_LEVER.hingeY },
              { x: DOOR_LEVER.halfW, y: DOOR_LEVER.hingeY },
              { x: DOOR_LEVER.halfW - 2, y: DOOR_LEVER.hingeY - 30 },
              { x: -DOOR_LEVER.halfW + 2, y: DOOR_LEVER.hingeY - 30 },
            ])}
            fill="#14090a"
          />
          <polygon
            data-door-plate=""
            points={pts(plate)}
            fill={TONE.face}
            stroke={TONE.edge}
            stroke-width={1}
            stroke-linejoin="round"
          />
          <line
            data-door-free=""
            x1={plate[3].x + 1}
            y1={plate[3].y}
            x2={plate[2].x - 1}
            y2={plate[2].y}
            stroke={TONE.freeEdge}
            stroke-width={2}
            stroke-linecap="round"
          />
          <line
            x1={plate[0].x + 6}
            y1={plate[0].y - 8}
            x2={plate[3].x + 4}
            y2={plate[3].y + 10}
            stroke={TONE.dark}
            stroke-width={1}
          />
        </>
      ) : (
        <>
          <rect
            data-door-bar=""
            x={-DOOR_LEVER.halfW}
            y={top}
            width={DOOR_LEVER.halfW * 2}
            height={DOOR_LEVER.length}
            rx={6}
            fill={TONE.face}
            stroke={TONE.edge}
            stroke-width={1}
          />
          <line
            data-door-free=""
            x1={-DOOR_LEVER.halfW + 4}
            y1={top + 3}
            x2={DOOR_LEVER.halfW - 4}
            y2={top + 3}
            stroke={TONE.freeEdge}
            stroke-width={2}
            stroke-linecap="round"
          />
          <line
            x1={0}
            y1={top + 14}
            x2={0}
            y2={DOOR_LEVER.hingeY - 14}
            stroke={TONE.dark}
            stroke-width={2}
            stroke-linecap="round"
          />
        </>
      )}
      <circle
        cx={0}
        cy={DOOR_LEVER.hingeY}
        r={4}
        fill={TONE.pin}
        stroke="#59626d"
        stroke-width={1}
      />
    </g>
  );
}
