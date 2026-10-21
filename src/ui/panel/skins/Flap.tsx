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
  /** Pulled angle about the hinge in degrees; allowed 45 to 75 (R2-4.2: at least 45). */
  angleDeg: 60,
  /** Offset of the lifted face from the hinge-to-tip edge, toward the viewer (the right of the panel). */
  lift: 4,
} as const;

const TONE = {
  face: '#2b3036',
  edge: '#4a525c',
  freeEdge: '#6b7580',
  wall: '#222830',
  wallEdge: '#4a525c',
  lifted: '#56606b',
  highlight: '#6b7580',
} as const;

export interface Point {
  readonly x: number;
  readonly y: number;
}

const f = (n: number): string => n.toFixed(2).replace(/\.?0+$/, '');
const pts = (points: readonly Point[]): string =>
  points.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');

/**
 * The side wall of the pulled flap, seen from the right: the hinge corner H, the released free
 * corner R (straight up the panel) and the lifted tip T, a true rotation of R about H by the
 * angle, so |HR| = |HT| = the flap length. Control-local coordinates, y down.
 */
export function flapWall(angleDeg: number = FLAP.angleDeg): readonly [Point, Point, Point] {
  const rad = (angleDeg * Math.PI) / 180;
  const h: Point = { x: FLAP.halfW, y: FLAP.hingeY };
  const r: Point = { x: FLAP.halfW, y: FLAP.hingeY - FLAP.length };
  const t: Point = {
    x: h.x - FLAP.length * Math.sin(rad),
    y: h.y - FLAP.length * Math.cos(rad),
  };
  return [h, r, t];
}

/**
 * The lifted face of the pulled flap: the thin quadrilateral along the hinge-to-tip edge,
 * offset `lift` toward the viewer (perpendicular to the edge, away from the wall).
 */
export function flapFace(angleDeg: number = FLAP.angleDeg): readonly [Point, Point, Point, Point] {
  const [h, , t] = flapWall(angleDeg);
  const dx = t.x - h.x;
  const dy = t.y - h.y;
  const len = Math.hypot(dx, dy);
  // For a pull between 0 and 90 degrees the edge runs up and to the left, so this normal points
  // down and to the left: away from the wall interior, toward the viewer.
  const o: Point = { x: (dy / len) * FLAP.lift, y: (-dx / len) * FLAP.lift };
  return [h, t, { x: t.x + o.x, y: t.y + o.y }, { x: h.x + o.x, y: h.y + o.y }];
}

export interface FlapBodyProps {
  readonly def: Pick<DetentLeverDef, 'hit'>;
  /** The committed detent id: 'set' stands the flap up, anything else leaves it flat. */
  readonly state: string;
  /** True only while a pointer is down on the control. */
  readonly pressed: boolean;
}

/**
 * Pure body of the hinged flap (R2-4.2, D-09): a recess in the console and, released, the flap
 * flat in the panel surface; pulled, the flap stands up by FLAP.angleDeg about its lower hinge,
 * seen from the right as a dark wedge (the side wall) with a lighter lifted face and a highlight
 * on the free edge. Prints no text in either state (G-0.1); the placard names it. No hooks.
 */
export function FlapBody({ state, pressed }: FlapBodyProps) {
  const pulled = state === 'set';
  const [h, , t] = flapWall();
  const face = flapFace();
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
            data-flap-wall=""
            points={pts(flapWall())}
            fill={TONE.wall}
            stroke={TONE.wallEdge}
            stroke-width={0.8}
            stroke-linejoin="round"
          />
          <polygon
            data-flap-face=""
            points={pts(face)}
            fill={TONE.lifted}
            stroke={TONE.edge}
            stroke-width={0.8}
            stroke-linejoin="round"
          />
          <line
            data-flap-free=""
            x1={t.x}
            y1={t.y}
            x2={face[2].x}
            y2={face[2].y}
            stroke={TONE.highlight}
            stroke-width={1}
            stroke-linecap="round"
          />
          <line
            x1={-FLAP.halfW}
            y1={h.y}
            x2={FLAP.halfW}
            y2={h.y}
            stroke={TONE.edge}
            stroke-width={1}
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
