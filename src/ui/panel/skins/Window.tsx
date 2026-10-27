// The emergency window (Phase 5.1, P-07): a dark glass pane with an oval window in it, in the left
// strip above the door lock lever. Closed, the oval lies flat in its frame; open, it is drawn ajar:
// the far side has swung in, the near side shows a slim lit gap. Control-local units, origin at the
// centre of the 60 x 116 footprint; the pane is 76 x 124 and reaches beyond it. No text in either
// state (G-0); the label WINDOW is a plate placard.

/** The pressed ring: drawn only while a pointer is down, never a persistent state. */
const PRESSED_RING = '#8fb8e6';

/** Half sizes of the oval frame (rx 24, ry 46) and the pane (76 x 124) around it. */
export const WINDOW = { rx: 24, ry: 46, paneHalfW: 38, paneHalfH: 62 } as const;

const TONE = {
  pane: '#12161a',
  paneEdge: '#2d3138',
  frame: '#4a525c',
  glass: '#26323c',
  glassEdge: '#59626d',
  shine: '#5d7284',
  hole: '#050607',
  gap: '#dcebf6',
  swung: '#1c262e',
} as const;

export interface WindowBodyProps {
  /** The window is open (ajar). */
  readonly open: boolean;
  /** True only while a pointer is down on the control. */
  readonly pressed: boolean;
}

/** Pure body of the emergency window: no hooks, no text. */
export function WindowBody({ open, pressed }: WindowBodyProps) {
  const { rx, ry } = WINDOW;
  return (
    <g data-window={open ? 'open' : 'closed'} pointer-events="none">
      <rect
        x={-WINDOW.paneHalfW}
        y={-WINDOW.paneHalfH}
        width={WINDOW.paneHalfW * 2}
        height={WINDOW.paneHalfH * 2}
        rx={14}
        fill={TONE.pane}
        stroke={pressed ? PRESSED_RING : TONE.paneEdge}
        stroke-width={pressed ? 3 : 1.5}
      />
      {open ? (
        <>
          <ellipse
            data-window-hole=""
            cx={0}
            cy={0}
            rx={rx}
            ry={ry}
            fill={TONE.hole}
            stroke={TONE.frame}
            stroke-width={3}
          />
          <path
            data-window-gap=""
            d={`M${-rx + 4} ${-ry + 14} Q${-rx - 1} 0 ${-rx + 4} ${ry - 14}`}
            fill="none"
            stroke={TONE.gap}
            stroke-width={4}
            stroke-linecap="round"
          />
          <ellipse
            data-window-swung=""
            cx={rx / 3}
            cy={0}
            rx={rx / 2.5}
            ry={ry - 4}
            fill={TONE.swung}
            stroke={TONE.glassEdge}
            stroke-width={1.5}
          />
          <line
            x1={rx - 3}
            y1={-ry + 14}
            x2={rx - 3}
            y2={ry - 14}
            stroke={TONE.frame}
            stroke-width={2.5}
            stroke-linecap="round"
          />
        </>
      ) : (
        <>
          <ellipse
            data-window-frame=""
            cx={0}
            cy={0}
            rx={rx}
            ry={ry}
            fill={TONE.glass}
            stroke={TONE.frame}
            stroke-width={4}
          />
          <path
            d={`M${-rx / 2} ${-ry / 2} Q${-rx / 4} ${-ry + 14} ${rx / 3} ${-ry + 10}`}
            fill="none"
            stroke={TONE.shine}
            stroke-width={2}
            stroke-linecap="round"
          />
          <line
            x1={-rx + 2}
            y1={0}
            x2={-rx + 8}
            y2={0}
            stroke={TONE.glassEdge}
            stroke-width={3}
            stroke-linecap="round"
          />
        </>
      )}
    </g>
  );
}
