// Session area layout (phase 02, UI-SPEC "Session Control Area"): region-local rectangles of the
// two views of the region scenario_area, as pure data. Origin (0, 0) is the top left of the region
// (global x 1300, y 780); the region is 820 x 480. The widgets that draw the buttons come in
// plan 06; nothing here touches the DOM or a registry control.

export interface LocalRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Row tops of the choose view; at most four situations are listed. */
const CHOOSE_ROW_TOPS = [110, 200, 290, 380] as const;

export const SESSION_LAYOUT = {
  /** Size of the region in panel units. */
  region: { w: 820, h: 480 },
  /** Main view: NEW SITUATION, CHOOSE SITUATION and a free slot reserved below them. */
  main: {
    new: { x: 20, y: 20, w: 780, h: 120 },
    choose: { x: 20, y: 160, w: 780, h: 120 },
    /** Reserved, y 300 to 440. */
    freeSlot: { x: 20, y: 300, w: 780, h: 140 },
  },
  /** Choose view: a close button on top and at most four situation rows below it. */
  choose: {
    close: { x: 20, y: 20, w: 780, h: 80 },
    rows: CHOOSE_ROW_TOPS.map((y): LocalRect => ({ x: 20, y, w: 780, h: 80 })),
    maxRows: CHOOSE_ROW_TOPS.length,
  },
  /** Button labels: size 14, weight 700, centred at local x 410, baseline top + h / 2 + 5. */
  label: { size: 14, weight: 700, anchorX: 410, baselineOffset: 5 },
} as const;

/** Baseline of a button label inside the rectangle r (label rule of SESSION_LAYOUT). */
export function labelBaseline(r: LocalRect): number {
  return r.y + r.h / 2 + SESSION_LAYOUT.label.baselineOffset;
}
