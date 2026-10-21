// Pure view geometry for region zoom, pinch and pan (PNL-09, D-20, D-21).
// No DOM and no framework: the gesture layer in zoom.ts feeds these functions and
// applies the result to the root svg viewBox. Zooming never touches the layout data.

import type { ControlDef, Rect, Size } from '../../engine/registry';

/** viewBox units kept around a region when it is zoomed to. */
export const ZOOM_PAD = 10;

/** Pinch-in limit: the narrowest view in viewBox units. */
export const MIN_VIEW_WIDTH = 200;

/** A view this close to the full viewBox in either axis snaps to the full viewBox. */
const SNAP_TO_FULL = 0.98;

/** CSS px per viewBox unit when `view` is fitted into `screen` (xMidYMid meet). */
export function fitScale(view: Size, screen: Size): number {
  return Math.min(screen.w / view.w, screen.h / view.h);
}

function fullRect(viewBox: Size): Rect {
  return { x: 0, y: 0, w: viewBox.w, h: viewBox.h };
}

/** Moves `rect` the shortest way until it lies inside the viewBox (size unchanged). */
function keepInside(rect: Rect, viewBox: Size): Rect {
  const x = Math.min(Math.max(rect.x, 0), Math.max(0, viewBox.w - rect.w));
  const y = Math.min(Math.max(rect.y, 0), Math.max(0, viewBox.h - rect.h));
  return { x, y, w: rect.w, h: rect.h };
}

/** Region bounds padded by ZOOM_PAD, clamped (not shifted) to the viewBox. */
export function zoomRect(bounds: Rect, viewBox: Size): Rect {
  const x1 = Math.max(0, bounds.x - ZOOM_PAD);
  const y1 = Math.max(0, bounds.y - ZOOM_PAD);
  const x2 = Math.min(viewBox.w, bounds.x + bounds.w + ZOOM_PAD);
  const y2 = Math.min(viewBox.h, bounds.y + bounds.h + ZOOM_PAD);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Scales the view about `centre` (viewBox coordinates): factor 2 halves the width. The aspect
 * of the current view is kept. The width stays within MIN_VIEW_WIDTH..viewBox.w and the result
 * inside the viewBox; a view that would reach the full extent in either axis becomes the
 * full viewBox, so pinching out always ends at the whole panel.
 */
export function pinchRect(
  current: Rect,
  centre: { x: number; y: number },
  factor: number,
  viewBox: Size,
): Rect {
  const aspect = current.h / current.w;
  const wanted = current.w / factor;
  const width = Math.min(Math.max(wanted, MIN_VIEW_WIDTH), viewBox.w);
  const height = width * aspect;
  if (width >= viewBox.w * SNAP_TO_FULL || height >= viewBox.h * SNAP_TO_FULL) {
    return fullRect(viewBox);
  }
  const k = width / current.w;
  return keepInside(
    {
      x: centre.x - (centre.x - current.x) * k,
      y: centre.y - (centre.y - current.y) * k,
      w: width,
      h: height,
    },
    viewBox,
  );
}

/** Translates the view by (dx, dy) viewBox units, kept inside the viewBox. */
export function panRect(current: Rect, dx: number, dy: number, viewBox: Size): Rect {
  return keepInside({ x: current.x + dx, y: current.y + dy, w: current.w, h: current.h }, viewBox);
}

/**
 * Converts a point in CSS px relative to the svg element's top-left corner to viewBox
 * coordinates for `view` shown with xMidYMid meet inside `screen`.
 */
export function screenToView(
  view: Rect,
  screen: Size,
  px: number,
  py: number,
): { x: number; y: number } {
  const s = fitScale(view, screen);
  const offX = (screen.w - view.w * s) / 2;
  const offY = (screen.h - view.h * s) / 2;
  return { x: view.x + (px - offX) / s, y: view.y + (py - offY) / s };
}

/**
 * Smallest tap-target side of a control in viewBox units. Mirrors the widgets: toggles and
 * buttons their footprint (a three-state toggle a third of its height, a three-state button half
 * its width), a knob its whole footprint (two
 * stops) or each tap half, a guard also its lifted-guard area, and a lever the handle and marker
 * squares min(across, along - track length, smallest marker spacing).
 */
export function targetSide(def: ControlDef): number {
  switch (def.kind) {
    case 'toggle':
      // A three-state toggle has three stacked tap thirds.
      return def.states.length === 3
        ? Math.min(def.hit.w, def.hit.h / 3)
        : Math.min(def.hit.w, def.hit.h);
    case 'momentary-button':
      // A three-state button (spring-bat) has two pressed positions, one per half of the width.
      return def.states.length === 3
        ? Math.min(def.hit.w / 2, def.hit.h)
        : Math.min(def.hit.w, def.hit.h);
    case 'rotary':
      // Two stops: any tap toggles, so the whole footprint is the target. More stops: the
      // right and left halves are separate targets.
      return def.stops.length === 2
        ? Math.min(def.hit.w, def.hit.h)
        : Math.min(def.hit.w / 2, def.hit.h);
    case 'circuit-breaker':
      // One tap toggles, so the whole hit is the target.
      return Math.min(def.hit.w, def.hit.h);
    case 'guarded-toggle':
      return Math.min(def.hit.w, def.hit.h, def.guardOpenHit.w, def.guardOpenHit.h);
    case 'guard':
      return Math.min(def.hit.w, def.hit.h, def.openHit.w, def.openHit.h);
    case 'detent-lever': {
      // A tap-toggle lever is operated by a tap anywhere on its footprint (R2-4.2).
      if (def.tapToggle === true) return Math.min(def.hit.w, def.hit.h);
      const { length, axis } = def.track;
      const vertical = axis === 'v';
      const along = vertical ? def.hit.h : def.hit.w;
      const across = vertical ? def.hit.w : def.hit.h;
      const markerIds = def.dragOnly === true ? [] : (def.markers ?? def.detents.map((d) => d.id));
      const positions = def.detents
        .filter((d) => markerIds.includes(d.id))
        .map((d) => d.pos * length)
        .sort((a, b) => a - b);
      let spacing = Infinity;
      for (let i = 1; i < positions.length; i++) {
        spacing = Math.min(spacing, (positions[i] ?? 0) - (positions[i - 1] ?? 0));
      }
      return Math.min(across, along - length, spacing);
    }
  }
}

/** The Full panel button box in CSS px; stage.css fixes the width so it never depends on the font. */
export const BUTTON_BOX: Size = { w: 112, h: 44 };

/** Distance of the button from its two nearest panel-area edges in CSS px (safe-area insets come on top in CSS). */
export const BUTTON_INSET = 8;

/** The corners the button may take. Top left is not used: the rotate hint sits there. */
export type ButtonCorner = 'tr' | 'br' | 'bl';

/** Corner priority order: top right first, then the two bottom corners. */
export const BUTTON_CORNERS: readonly ButtonCorner[] = ['tr', 'br', 'bl'];

/**
 * The global rectangle of every control footprint in viewBox units: the region origin plus the
 * control centre minus half the hit, plus the lifted-guard rectangle of every guarded toggle. The
 * footprint is a conservative superset of the real hits, so a corner that is free of footprints is
 * free of hits. The derived guard controls are skipped: their footprint is the switch's own.
 */
export function controlFootprints(registry: {
  readonly regions: readonly { readonly id: string; readonly bounds: Rect }[];
  readonly controls: readonly ControlDef[];
}): Rect[] {
  const origins = new Map(registry.regions.map((r) => [r.id, r.bounds]));
  const out: Rect[] = [];
  for (const def of registry.controls) {
    if (def.kind === 'guard') continue;
    const origin = origins.get(def.region);
    if (origin === undefined) continue;
    const cx = origin.x + def.x;
    const cy = origin.y + def.y;
    out.push({ x: cx - def.hit.w / 2, y: cy - def.hit.h / 2, w: def.hit.w, h: def.hit.h });
    if (def.kind === 'guarded-toggle') {
      const g = def.guardOpenHit;
      out.push({ x: cx + g.x, y: cy + g.y, w: g.w, h: g.h });
    }
  }
  return out;
}

/** The button box of `corner` in CSS px inside `screen` (the svg area). */
export function buttonBox(corner: ButtonCorner, screen: Size): Rect {
  const x = corner === 'bl' ? BUTTON_INSET : screen.w - BUTTON_INSET - BUTTON_BOX.w;
  const y = corner === 'tr' ? BUTTON_INSET : screen.h - BUTTON_INSET - BUTTON_BOX.h;
  return { x, y, w: BUTTON_BOX.w, h: BUTTON_BOX.h };
}

/** Total overlap area in CSS px squared of the button at `corner` with the footprints, for `view` fitted into `screen`. */
export function buttonOverlap(
  corner: ButtonCorner,
  view: Rect,
  screen: Size,
  footprints: readonly Rect[],
): number {
  const s = fitScale(view, screen);
  const offX = (screen.w - view.w * s) / 2;
  const offY = (screen.h - view.h * s) / 2;
  const box = buttonBox(corner, screen);
  let total = 0;
  for (const f of footprints) {
    const left = offX + (f.x - view.x) * s;
    const top = offY + (f.y - view.y) * s;
    const w = Math.min(box.x + box.w, left + f.w * s) - Math.max(box.x, left);
    const h = Math.min(box.y + box.h, top + f.h * s) - Math.max(box.y, top);
    // Touching edges are not overlap.
    if (w > 1e-9 && h > 1e-9) total += w * h;
  }
  return total;
}

/**
 * The corner for the Full panel button: the current corner while it is free of every control
 * footprint (so the button does not hop during a pan), else the first free corner in priority
 * order, else the corner with the smallest total overlap (ties by priority, current first).
 * Pure: no DOM, no clock.
 */
export function chooseButtonCorner(input: {
  view: Rect;
  screen: Size;
  footprints: readonly Rect[];
  current: ButtonCorner;
}): ButtonCorner {
  const { view, screen, footprints, current } = input;
  if (!(screen.w > 0) || !(screen.h > 0)) return current;
  const order: ButtonCorner[] = [current, ...BUTTON_CORNERS.filter((c) => c !== current)];
  const overlap = new Map(order.map((c) => [c, buttonOverlap(c, view, screen, footprints)]));
  const get = (c: ButtonCorner): number => overlap.get(c) ?? Infinity;
  if (get(current) === 0) return current;
  const free = BUTTON_CORNERS.find((c) => get(c) === 0);
  if (free !== undefined) return free;
  let best = current;
  for (const c of order) if (get(c) < get(best)) best = c;
  return best;
}
