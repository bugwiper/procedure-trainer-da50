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

/** The measures of a pointer shape; the default is the engine page's, the fine one the map strip's. */
export interface PointerSize {
  readonly halfW: number;
  readonly rectH: number;
  readonly tipH: number;
  /** How far the tip reaches into the bar. */
  readonly sink: number;
}

export const POINTER_DEFAULT: PointerSize = {
  halfW: POINTER_HALF_W,
  rectH: POINTER_RECT_H,
  tipH: POINTER_TIP_H,
  sink: POINTER_SINK,
};

/** The smaller pointer of the map strip: about 6 wide and 6 tall, with a 4 thick bar. */
export const POINTER_FINE: PointerSize = { halfW: 3, rectH: 3.5, tipH: 2.5, sink: 1.5 };
export const POINTER_FINE_OUTLINE = 0.4;

/**
 * The outline of a pointer with its tip at (x, tipY). `from: 'above'` puts the rectangle above the
 * tip (a pointer standing over the bar and pointing down), `'below'` puts it under the tip. The
 * path starts at the tip, so its first coordinate is the pointer's position on the scale.
 */
export function pointerPath(
  x: number,
  tipY: number,
  from: 'above' | 'below',
  size: PointerSize = POINTER_DEFAULT,
): string {
  const dir = from === 'above' ? -1 : 1;
  const shoulder = tipY + dir * size.tipH;
  const end = shoulder + dir * size.rectH;
  return [
    `M ${x} ${tipY}`,
    `L ${x + size.halfW} ${shoulder}`,
    `L ${x + size.halfW} ${end}`,
    `L ${x - size.halfW} ${end}`,
    `L ${x - size.halfW} ${shoulder}`,
    'Z',
  ].join(' ');
}

/** The y of the middle of the rectangle part, where a mark inside the pointer is centred. */
export function pointerRectCentreY(
  tipY: number,
  from: 'above' | 'below',
  size: PointerSize = POINTER_DEFAULT,
): number {
  const dir = from === 'above' ? -1 : 1;
  return tipY + dir * (size.tipH + size.rectH / 2);
}
