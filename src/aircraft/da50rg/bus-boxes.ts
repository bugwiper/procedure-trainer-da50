// Static art of the bus panel as data (phase 01.2, D-01, UI-SPEC Table B3): the three stair-step
// bus outlines and their titles. The shell draws them (src/ui/panel/BusPanelArt.tsx) and the
// geometry tests read them. Global units of the 2180 x 1300 panel space. Layout facts only; the
// corners are read from oblique photos at medium confidence (review item P2-04). Pure data: no
// imports from the UI.

/** The three buses that have an outline. The lower row and the flap strip have none. */
export type BusId = 'essential' | 'main' | 'avionics';

export interface BusPoint {
  readonly x: number;
  readonly y: number;
}

/** Drawing order of the outlines. */
export const BUS_ORDER: readonly BusId[] = ['essential', 'main', 'avionics'];

/**
 * Closed polygons, every edge horizontal or vertical. Cell edges lie at x = 1888 + 36 k and the
 * horizontal levels at y 223, 319, 375, 426, 477 and 531, so the outlines share edges exactly.
 */
export const BUS_OUTLINES: Readonly<Record<BusId, readonly BusPoint[]>> = {
  essential: [
    { x: 1888, y: 223 },
    { x: 2104, y: 223 },
    { x: 2104, y: 319 },
    { x: 1996, y: 319 },
    { x: 1996, y: 375 },
    { x: 1888, y: 375 },
  ],
  main: [
    { x: 1996, y: 319 },
    { x: 2140, y: 319 },
    { x: 2140, y: 426 },
    { x: 2032, y: 426 },
    { x: 2032, y: 477 },
    { x: 1888, y: 477 },
    { x: 1888, y: 375 },
    { x: 1996, y: 375 },
  ],
  avionics: [
    { x: 2032, y: 426 },
    { x: 2140, y: 426 },
    { x: 2140, y: 531 },
    { x: 1888, y: 531 },
    { x: 1888, y: 477 },
    { x: 2032, y: 477 },
  ],
};

/** Corner radius of every outline and every box, in units. */
export const BUS_CORNER_RADIUS = 4;

/** Stroke of the outlines and boxes: solid, no opacity, so shared edges do not double. */
export const BUS_STROKE = { color: '#6b727c', width: 1 } as const;

export interface BusTitle {
  readonly bus: BusId;
  readonly text: string;
  /** Anchor middle; y is the baseline, a few units under the edge the title cuts. */
  readonly x: number;
  readonly y: number;
}

/** Static titles (size 8). Each cuts the horizontal edge of its own outline that it sits on. */
export const BUS_TITLES: readonly BusTitle[] = [
  { bus: 'essential', text: 'ESSENTIAL BUS', x: 1996, y: 226 },
  { bus: 'main', text: 'MAIN BUS', x: 1924, y: 378 },
  { bus: 'avionics', text: 'AVIONICS BUS', x: 1960, y: 480 },
];

/**
 * Colours of a title: the text fill and the plate colour of the cut rectangle behind it (equal to
 * the fill of the bus-panel plate). The title itself is plain filled text: a stroked text is
 * painted glyph by glyph on WebKit and ran into the previous letter (R3-1.1).
 */
export const BUS_TITLE_STYLE = { fill: '#c9d0d8', cut: '#15171a' } as const;

/** Font size of a title (set in the art). */
export const BUS_TITLE_SIZE = 8;

/**
 * Cut geometry of a title (UI-SPEC 01.1 Table B4), design numbers: the font is not measured at
 * build time, so the advance per character is an upper estimate (0.62 of the size plus the 0.06 em
 * letter spacing of stage.css, rounded up for wide capitals). The built-DOM gate measures the real
 * text box; a wider font is fixed by widening these constants.
 */
export const BUS_TITLE_ADVANCE = 6;
/** Clear edge gap beside the glyphs, each side. */
export const BUS_TITLE_MARGIN = 4;
/** The rectangle reaches this far above the baseline (cap height 5.6 plus the edge 3 above it). */
export const BUS_TITLE_CUT_ABOVE = 8;
/** The rectangle reaches this far below the baseline (the edge lies 3 above the baseline). */
export const BUS_TITLE_CUT_BELOW = 3;

/**
 * The plate-coloured rectangle that cuts the outline edge behind a title: centred on the anchor,
 * as wide as the text estimate plus the margin on both sides, from 8 above to 3 below the baseline.
 */
export function busTitleCut(title: BusTitle): {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
} {
  const w = title.text.length * BUS_TITLE_ADVANCE + 2 * BUS_TITLE_MARGIN;
  return {
    x: title.x - w / 2,
    y: title.y - BUS_TITLE_CUT_ABOVE,
    w,
    h: BUS_TITLE_CUT_ABOVE + BUS_TITLE_CUT_BELOW,
  };
}

/** A rounded rectangle of the bus art, global units. */
export interface BusRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rx: number;
}

/**
 * The three fuel pump boxes right of the outlines (same stroke as the outlines). EMERG PUMP sits
 * in its own box beside the ESSENTIAL outline; MAIN PUMP and XFR PUMP lie inside the MAIN outline.
 * The names are the printed pump names of the breakers they frame (not drawn as text here).
 */
export const BUS_PUMP_BOXES: readonly (BusRect & { readonly name: string })[] = [
  { name: 'EMERG PUMP', x: 2106, y: 275, w: 32, h: 44, rx: 3 },
  { name: 'MAIN PUMP', x: 2106, y: 319, w: 32, h: 44, rx: 3 },
  { name: 'XFR PUMP', x: 2106, y: 382, w: 32, h: 44, rx: 3 },
];

/** The sub-panel that holds the lower breaker row (region cb_low), darker than the plate. */
export const BUS_SUBPANEL: BusRect & { readonly fill: string; readonly stroke: string } = {
  x: 1878,
  y: 642,
  w: 272,
  h: 68,
  rx: 4,
  fill: '#101215',
  stroke: '#2d3138',
};

/**
 * A blank plug: a hole in the real breaker grid. Not a control: no hit, no state, no id of the
 * control registry. The printed label (if any) uses the breaker label rule.
 */
export interface BusPlug {
  readonly id: string;
  readonly bus: BusId;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** Printed lines, top to bottom; empty for the unlabelled plug. */
  readonly labelLines: readonly string[];
  /** Sideways shift of the label, only if the text-overlap gate asks for it. */
  readonly labelDx?: number;
}

export const BUS_PLUGS: readonly BusPlug[] = [
  { id: 'plug-essential', bus: 'essential', x: 1978, y: 349, r: 11, labelLines: [] },
  { id: 'plug-adf', bus: 'avionics', x: 2086, y: 456, r: 11, labelLines: ['ADF'] },
  { id: 'plug-data-link', bus: 'avionics', x: 2122, y: 514, r: 11, labelLines: ['DATA', 'LINK'] },
];

/** Colours of a plug disc and its rim; the label colour is set in the art like a breaker label. */
export const BUS_PLUG_STYLE = { fill: '#050506', rim: '#2d3138', rimWidth: 1 } as const;
