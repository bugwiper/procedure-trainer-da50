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

/** The title (font size 8, set in the art) cuts the edge with a stroke in the plate colour. */
export const BUS_TITLE_STYLE = { fill: '#c9d0d8', cut: '#15171a', cutWidth: 5 } as const;
