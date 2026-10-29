// The pointer of the MFD bars: an arrow-with-rectangle shape (a rectangle whose lower edge narrows to
// a point that reaches into the bar), as on the real page. Pure geometry shared by BarGauge,
// DualGauge and the rudder trim; no frame, no state.

/** Half the width of the rectangle part; the pointer is POINTER_HALF_W * 2 wide. */
export const POINTER_HALF_W = 5.5;
/** Height of the rectangle part and of the point below it (above it for a pointer under the bar). */
export const POINTER_RECT_H = 6;
export const POINTER_TIP_H = 4;
/** How far the tip reaches into the bar (the bar is 7 tall). */
export const POINTER_SINK = 3;
/** Thin outline in the glass colour so a pointer stays readable on a band of its own colour. */
export const POINTER_OUTLINE = 0.6;

/**
 * The outline of a pointer with its tip at (x, tipY). `from: 'above'` puts the rectangle above the
 * tip (a pointer standing over the bar and pointing down), `'below'` puts it under the tip. The
 * path starts at the tip, so its first coordinate is the pointer's position on the scale.
 */
export function pointerPath(x: number, tipY: number, from: 'above' | 'below'): string {
  const dir = from === 'above' ? -1 : 1;
  const shoulder = tipY + dir * POINTER_TIP_H;
  const end = shoulder + dir * POINTER_RECT_H;
  return [
    `M ${x} ${tipY}`,
    `L ${x + POINTER_HALF_W} ${shoulder}`,
    `L ${x + POINTER_HALF_W} ${end}`,
    `L ${x - POINTER_HALF_W} ${end}`,
    `L ${x - POINTER_HALF_W} ${shoulder}`,
    'Z',
  ].join(' ');
}

/** The y of the middle of the rectangle part, where a mark inside the pointer is centred. */
export function pointerRectCentreY(tipY: number, from: 'above' | 'below'): number {
  const dir = from === 'above' ? -1 : 1;
  return tipY + dir * (POINTER_TIP_H + POINTER_RECT_H / 2);
}
