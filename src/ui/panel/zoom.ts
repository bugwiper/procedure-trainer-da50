// Region zoom: view state and the gesture layer (PNL-09, PNL-06, D-20, D-21).
// Only the root svg viewBox changes; control data, positions and spacing are untouched.
// This module never imports the bridge and never operates a control: a zoom gesture is
// not a control event and is never graded.

import { computed, signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import { VIEWBOX } from '../../aircraft/da50rg/panel';
import type { Rect, Region, Registry, Size } from '../../engine/registry';
import { TAP_SLOP_PX, isBackgroundTap, tapIntent } from './tap-intent';
import type { TapPoint } from './tap-intent';
import { fitScale, panRect, pinchRect, screenToView, zoomRect } from './viewport';

/** A pointer that starts on one of these elements belongs to that control for its whole life. */
const TAP_TARGET_SELECTOR = '[data-hit], [data-detent]';

const fullView = signal<Rect>({ x: 0, y: 0, w: VIEWBOX.w, h: VIEWBOX.h });

/** The visible part of the panel in viewBox units; starts as the whole panel. */
export const viewRect = signal<Rect>({ x: 0, y: 0, w: VIEWBOX.w, h: VIEWBOX.h });

export const isZoomed: ReadonlySignal<boolean> = computed(() => {
  const v = viewRect.value;
  const f = fullView.value;
  return v.x !== f.x || v.y !== f.y || v.w !== f.w || v.h !== f.h;
});

/** Value of the root svg viewBox attribute. */
export const viewBoxAttr: ReadonlySignal<string> = computed(() => {
  const v = viewRect.value;
  return `${v.x} ${v.y} ${v.w} ${v.h}`;
});

export function zoomToRegion(region: Region, viewBox: Size): void {
  viewRect.value = zoomRect(region.bounds, viewBox);
}

export function zoomOut(viewBox: Size): void {
  viewRect.value = { x: 0, y: 0, w: viewBox.w, h: viewBox.h };
}

interface BackgroundPointer {
  x: number;
  y: number;
  /** Where a pan delta is measured from; only advanced while panning. */
  anchorX: number;
  anchorY: number;
  readonly downX: number;
  readonly downY: number;
  readonly downAt: number;
  /** Still a candidate for a tap: no travel, no second finger. */
  tapOk: boolean;
  panning: boolean;
  /** Largest number of background pointers down at once while this pointer was down. */
  maxPointers: number;
}

interface Midpoint {
  readonly x: number;
  readonly y: number;
  readonly dist: number;
}

/**
 * Attaches the zoom gesture layer to the root svg and returns the detach function.
 * Listeners are added with addEventListener, never as JSX props, so widget handlers
 * keep sole ownership of their own pointers.
 *
 * Arbitration (mouse, touch and pen alike):
 *  (a) a pointer whose pointerdown target is inside a tap target belongs to that control for
 *      its whole life and is ignored here;
 *  (b) while any control pointer is active every new pointer is ignored, so no pinch or pan
 *      can start during a control drag and the viewBox never moves under a dragging pointer;
 *  (c) two background pointers pinch; (d) one background pointer pans while zoomed;
 *  (e) a single background tap while zoomed, at any zoom level, zooms fully out at once;
 *  (f) a background tap from the full view zooms to the tapped region; the second tap of a
 *      double tap, within SUPPRESS_MS and SUPPRESS_PX of a tap-driven change, is ignored.
 */
export function attachZoomGestures(svg: SVGSVGElement, opts: { registry: Registry }): () => void {
  const { registry } = opts;
  const { viewBox } = registry;
  fullView.value = { x: 0, y: 0, w: viewBox.w, h: viewBox.h };

  const controlPointers = new Set<number>();
  const background = new Map<number, BackgroundPointer>();
  let pinchPrev: Midpoint | null = null;
  let lastChange: TapPoint | null = null;
  /** The view that tap-driven change produced; any later view change (button, pinch, pan) ends the suppression. */
  let lastChangeView: Rect | null = null;

  const screenSize = (): Size => {
    const box = svg.getBoundingClientRect();
    return { w: box.width, h: box.height };
  };

  const toViewPoint = (clientX: number, clientY: number) => {
    const box = svg.getBoundingClientRect();
    return screenToView(
      viewRect.peek(),
      { w: box.width, h: box.height },
      clientX - box.left,
      clientY - box.top,
    );
  };

  const midpointOfTwo = (): Midpoint | null => {
    if (background.size !== 2) return null;
    const [a, b] = Array.from(background.values());
    if (a === undefined || b === undefined) return null;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };

  /** A pinch ended or was cancelled: the remaining finger neither taps nor jumps. */
  const settleRemaining = () => {
    pinchPrev = null;
    for (const p of background.values()) {
      p.tapOk = false;
      p.panning = false;
      p.anchorX = p.x;
      p.anchorY = p.y;
    }
  };

  const dropBackground = (pointerId: number) => {
    if (!background.delete(pointerId)) return;
    settleRemaining();
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target;
    if (target instanceof Element && target.closest(TAP_TARGET_SELECTOR) !== null) {
      controlPointers.add(e.pointerId);
      // A control drag begins: any view gesture in progress ends here.
      if (background.size > 0) {
        background.clear();
        pinchPrev = null;
      }
      return;
    }
    if (controlPointers.size > 0 || background.size >= 2) return;
    background.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      anchorX: e.clientX,
      anchorY: e.clientY,
      downX: e.clientX,
      downY: e.clientY,
      downAt: e.timeStamp,
      tapOk: true,
      panning: false,
      maxPointers: 1,
    });
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone; the release is still handled on pointerup.
    }
    if (background.size === 2) {
      for (const p of background.values()) {
        p.tapOk = false;
        p.maxPointers = 2;
      }
      pinchPrev = midpointOfTwo();
    }
  };

  const pinchTo = (next: Midpoint) => {
    const prev = pinchPrev;
    pinchPrev = next;
    if (prev === null || prev.dist <= 0 || next.dist <= 0) return;
    const box = svg.getBoundingClientRect();
    const screen = { w: box.width, h: box.height };
    const view = viewRect.peek();
    const centre = screenToView(view, screen, next.x - box.left, next.y - box.top);
    const scaled = pinchRect(view, centre, next.dist / prev.dist, viewBox);
    const s = fitScale(scaled, screen);
    viewRect.value = panRect(scaled, -(next.x - prev.x) / s, -(next.y - prev.y) / s, viewBox);
  };

  const onMove = (e: PointerEvent) => {
    const p = background.get(e.pointerId);
    if (p === undefined) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (background.size === 2) {
      const mid = midpointOfTwo();
      if (mid !== null) pinchTo(mid);
      return;
    }
    if (!p.panning) {
      if (Math.hypot(p.x - p.downX, p.y - p.downY) <= TAP_SLOP_PX) return;
      p.tapOk = false;
      p.panning = true;
    }
    if (!isZoomed.peek()) return;
    const view = viewRect.peek();
    const s = fitScale(view, screenSize());
    viewRect.value = panRect(view, -(p.x - p.anchorX) / s, -(p.y - p.anchorY) / s, viewBox);
    p.anchorX = p.x;
    p.anchorY = p.y;
  };

  const onTap = (e: PointerEvent) => {
    const tap: TapPoint = { x: e.clientX, y: e.clientY, at: e.timeStamp };
    const zoomed = isZoomed.peek();
    if (lastChangeView !== viewRect.peek()) lastChange = null;
    const intent = tapIntent({ zoomed, lastChange }, tap);
    if (intent === 'zoom-out') {
      zoomOut(viewBox);
      lastChange = tap;
      lastChangeView = viewRect.peek();
    } else if (intent === 'zoom-in') {
      const at = toViewPoint(e.clientX, e.clientY);
      const hit = registry.regions.find(
        (r) =>
          at.x >= r.bounds.x &&
          at.x <= r.bounds.x + r.bounds.w &&
          at.y >= r.bounds.y &&
          at.y <= r.bounds.y + r.bounds.h,
      );
      if (hit !== undefined) {
        zoomToRegion(hit, viewBox);
        lastChange = tap;
        lastChangeView = viewRect.peek();
      }
    }
  };

  const onUp = (e: PointerEvent) => {
    if (controlPointers.delete(e.pointerId)) return;
    const p = background.get(e.pointerId);
    if (p === undefined) return;
    // Control pointers never enter the background map, so a gesture here never starts on a target.
    const wasTap =
      p.tapOk &&
      isBackgroundTap({
        travelPx: Math.hypot(e.clientX - p.downX, e.clientY - p.downY),
        durationMs: e.timeStamp - p.downAt,
        maxPointers: Math.max(p.maxPointers, background.size),
        startedOnTarget: false,
      });
    dropBackground(e.pointerId);
    if (wasTap) onTap(e);
  };

  const onCancel = (e: PointerEvent) => {
    controlPointers.delete(e.pointerId);
    dropBackground(e.pointerId);
  };

  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onCancel);
  svg.addEventListener('lostpointercapture', onCancel);
  return () => {
    svg.removeEventListener('pointerdown', onDown);
    svg.removeEventListener('pointermove', onMove);
    svg.removeEventListener('pointerup', onUp);
    svg.removeEventListener('pointercancel', onCancel);
    svg.removeEventListener('lostpointercapture', onCancel);
    controlPointers.clear();
    background.clear();
  };
}
