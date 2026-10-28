import type { ComponentChildren } from 'preact';
import { GLASS_DARK, textBoxWidth } from './gauge-alert';

/** Font size of a box title; the width table of the gauge boxes is measured for capitals. */
export const BOX_TITLE_FONT = 8;
const BOX_STROKE = '#3a424b';
const BOX_TITLE_FILL = '#aab3bd';
/** The title is cut into the top edge: a patch of glass colour covers the line behind the text. */
const TITLE_INDENT = 8;
const TITLE_PATCH_H = 4;
const TITLE_PATCH_SLACK = 6;
const TITLE_TEXT_DX = 11;
const TITLE_BASELINE_DY = 2.5;

export interface BoxFrameProps {
  readonly id: string;
  readonly title: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly children?: ComponentChildren;
}

/**
 * A framed box of the engine page with its title cut into the top edge (taken from the Electrical
 * box of phase 4, now used by every box). The title is static text; the children are the gauges and
 * rows of the box, placed by the caller in page space.
 */
export function BoxFrame({ id, title, x, y, w, h, children }: BoxFrameProps) {
  const titleW = textBoxWidth(title, BOX_TITLE_FONT) + TITLE_PATCH_SLACK;
  return (
    <g data-box={id} pointer-events="none">
      <rect
        data-box-frame
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        fill="none"
        stroke={BOX_STROKE}
        stroke-width={1}
      />
      <rect
        x={x + TITLE_INDENT}
        y={y - TITLE_PATCH_H / 2}
        width={titleW}
        height={TITLE_PATCH_H}
        fill={GLASS_DARK}
      />
      <text
        data-box-title
        x={x + TITLE_TEXT_DX}
        y={y + TITLE_BASELINE_DY}
        font-size={BOX_TITLE_FONT}
        fill={BOX_TITLE_FILL}
      >
        {title}
      </text>
      {children}
    </g>
  );
}
