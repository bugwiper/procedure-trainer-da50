// Region zoom: view state and the gesture layer (PNL-09, PNL-06, D-20, D-21).
// Only the root svg viewBox changes; control data, positions and spacing are untouched.
// This module never imports the bridge and never operates a control: a zoom gesture is
// not a control event and is never graded.

import { computed, signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import { VIEWBOX } from '../../aircraft/da50rg/panel';
import type { Rect, Region, Registry, Size } from '../../engine/registry';
import { screenToView, zoomRect } from './viewport';

/** Pointer that starts on one of these elements belongs to that control for its whole life. */
const TAP_TARGET_SELECTOR = '[data-hit], [data-detent]';

const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 300;

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
  readonly downX: number;
  readonly downY: number;
  readonly downAt: number;
}

/**
 * Attaches the zoom gesture layer to the root svg and returns the detach function.
 * Listeners are added with addEventListener, never as JSX props, so widget handlers
 * keep sole ownership of their own pointers.
 */
export function attachZoomGestures(svg: SVGSVGElement, opts: { registry: Registry }): () => void {
  const { registry } = opts;
  const { viewBox } = registry;
  fullView.value = { x: 0, y: 0, w: viewBox.w, h: viewBox.h };

  const controlPointers = new Set<number>();
  const background = new Map<number, BackgroundPointer>();

  const toViewPoint = (clientX: number, clientY: number) => {
    const box = svg.getBoundingClientRect();
    return screenToView(
      viewRect.peek(),
      { w: box.width, h: box.height },
      clientX - box.left,
      clientY - box.top,
    );
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target;
    if (target instanceof Element && target.closest(TAP_TARGET_SELECTOR) !== null) {
      controlPointers.add(e.pointerId);
      return;
    }
    if (controlPointers.size > 0) return;
    background.set(e.pointerId, { downX: e.clientX, downY: e.clientY, downAt: e.timeStamp });
  };

  const onUp = (e: PointerEvent) => {
    if (controlPointers.delete(e.pointerId)) return;
    const p = background.get(e.pointerId);
    if (p === undefined) return;
    background.delete(e.pointerId);
    const isTap =
      Math.hypot(e.clientX - p.downX, e.clientY - p.downY) <= TAP_SLOP_PX &&
      e.timeStamp - p.downAt <= TAP_MAX_MS;
    if (!isTap || isZoomed.peek()) return;
    const at = toViewPoint(e.clientX, e.clientY);
    const hit = registry.regions.find(
      (r) =>
        at.x >= r.bounds.x &&
        at.x <= r.bounds.x + r.bounds.w &&
        at.y >= r.bounds.y &&
        at.y <= r.bounds.y + r.bounds.h,
    );
    if (hit !== undefined) zoomToRegion(hit, viewBox);
  };

  const onCancel = (e: PointerEvent) => {
    controlPointers.delete(e.pointerId);
    background.delete(e.pointerId);
  };

  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onCancel);
  svg.addEventListener('lostpointercapture', onCancel);
  return () => {
    svg.removeEventListener('pointerdown', onDown);
    svg.removeEventListener('pointerup', onUp);
    svg.removeEventListener('pointercancel', onCancel);
    svg.removeEventListener('lostpointercapture', onCancel);
  };
}
