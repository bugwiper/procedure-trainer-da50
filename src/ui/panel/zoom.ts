// Region zoom: view state and the gesture layer (PNL-09, PNL-06, D-20, D-21).
// Only the root svg viewBox changes; control data, positions and spacing are untouched.
// This module never imports the bridge and never operates a control: a zoom gesture is
// not a control event and is never graded.

import { computed, signal } from '@preact/signals';
import type { ReadonlySignal } from '@preact/signals';
import { VIEWBOX } from '../../aircraft/da50rg/panel';
import type { Rect, Region, Registry, Size } from '../../engine/registry';
import { createPressArbiter } from './press-arbiter';
import type { Midpoint, PressEffect, TargetDescriptor } from './press-arbiter';
import { pressKeyOf, pressTargetOf } from './press-targets';
import type { PressTarget } from './press-targets';
import { createDoubleTapTracker } from './tap-intent';
import type { PointerKind } from './tap-intent';
import {
  chooseButtonCorner,
  controlFootprints,
  fitScale,
  panRect,
  pinchRect,
  screenToView,
  zoomRect,
} from './viewport';
import type { ButtonCorner } from './viewport';

/** A pointer that starts on one of these elements lands on a control (a registered or own target). */
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

/** The svg area in CSS px, set at attach and by a ResizeObserver; zero until attached. */
export const panelScreen = signal<Size>({ w: 0, h: 0 });

const footprints = signal<readonly Rect[]>([]);

/** The corner chosen last; the rule keeps it while it is still free, so the button does not hop. */
let lastCorner: ButtonCorner = 'tr';

/** The corner of the Full panel button: where it covers no control (R2-T1, D-13). */
export const buttonCorner: ReadonlySignal<ButtonCorner> = computed(() => {
  lastCorner = chooseButtonCorner({
    view: viewRect.value,
    screen: panelScreen.value,
    footprints: footprints.value,
    current: lastCorner,
  });
  return lastCorner;
});

/**
 * Time (event.timeStamp of the lifting pointer) of the last view change made by a double tap, or
 * null; the Full panel button uses it to ignore the synthesized click that follows (plan 32).
 * Plain value, not a signal: nothing renders from it.
 */
let tapViewChangeAt: number | null = null;

export function viewChangedByTapAt(): number | null {
  return tapViewChangeAt;
}

export function zoomToRegion(region: Region, viewBox: Size): void {
  viewRect.value = zoomRect(region.bounds, viewBox);
}

export function zoomOut(viewBox: Size): void {
  viewRect.value = { x: 0, y: 0, w: viewBox.w, h: viewBox.h };
}

/** The pointer kind of an event; pen counts as touch for the slop, an unknown type as touch. */
function kindOf(e: PointerEvent): PointerKind {
  return e.pointerType === 'mouse' ? 'mouse' : e.pointerType === 'pen' ? 'pen' : 'touch';
}

/**
 * Attaches the zoom gesture layer to the root svg and returns the detach function. This is glue:
 * it feeds pointer samples to the pure press arbiter (press-arbiter.ts) and applies the effects
 * to the view. Listeners are added with addEventListener in the capture phase, never as JSX
 * props, so a pointer is seen here before any widget and widget handlers keep sole ownership of
 * what a control does with it.
 *
 * Rules (mouse, touch and pen alike; the machine implements them):
 *  (a) a pointerdown that lands inside a [data-hit] or [data-detent] element is classified by the
 *      press target registered on it (press-targets.ts: latch, momentary or own); an element
 *      nobody registered is an own target with dragStartPx 0; anything else is the background.
 *      The gesture layer calls the target (pending, tap, discard) and captures the pointer on
 *      the svg while the press is pending or the pointer is a view pointer;
 *  (b) one slop per pointer kind: 10 px for touch, pen and an unknown type, 5 px for the mouse;
 *      a press that stays within it and lifts in time is a tap, one that goes beyond it pans
 *      (only while zoomed; a single tap never changes the view);
 *  (c) a second pointer that lands while a view pointer is down starts a pinch with both, over
 *      controls as well as over the background; a third pointer, and every pointer that lands
 *      while a control owns a pointer, is ignored;
 *  (d) a double click or double tap on the background (two taps, lift to lift within
 *      DOUBLE_TAP_MS and DOUBLE_TAP_PX) zooms fully out while zoomed, at any zoom level, and
 *      from the full view zooms to the region under the taps; in no region it does nothing;
 *  (e) anything between the two taps that is not a background tap (a control pointer going down,
 *      a pan, a pinch, a cancel, a view change by the Full panel button) ends the pair, and a
 *      pair is consumed, so a double tap on a control stays two control taps (a control tap
 *      resets the pair tracker);
 *  (f) stale record sweep: a primary pointer going down drops every tracked pointer of its kind,
 *      so a lost pointerup or pointercancel can never leave the panel blocked.
 */
export function attachZoomGestures(svg: SVGSVGElement, opts: { registry: Registry }): () => void {
  const { registry } = opts;
  const { viewBox } = registry;
  fullView.value = { x: 0, y: 0, w: viewBox.w, h: viewBox.h };
  footprints.value = controlFootprints(registry);
  lastCorner = 'tr';
  const measure = () => {
    const box = svg.getBoundingClientRect();
    panelScreen.value = { w: box.width, h: box.height };
  };
  measure();
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
  resizeObserver?.observe(svg);

  const arbiter = createPressArbiter();
  /** What a tracked pointer landed on: its registered target (if any) and the hit element. */
  interface PointerRecord {
    readonly target: PressTarget | undefined;
    readonly hit: Element;
  }
  const records = new Map<number, PointerRecord>();
  /** Pointers this layer captured on the svg; they are released when the machine drops them. */
  const captured = new Set<number>();
  const doubleTaps = createDoubleTapTracker();
  /** The view when the remembered tap happened; a later view change by anything else ends the pair. */
  let lastTapView: Rect | null = null;

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

  const pinchTo = (prev: Midpoint, next: Midpoint) => {
    if (prev.dist <= 0 || next.dist <= 0) return;
    const box = svg.getBoundingClientRect();
    const screen = { w: box.width, h: box.height };
    const view = viewRect.peek();
    const centre = screenToView(view, screen, next.x - box.left, next.y - box.top);
    const scaled = pinchRect(view, centre, next.dist / prev.dist, viewBox);
    const s = fitScale(scaled, screen);
    viewRect.value = panRect(scaled, -(next.x - prev.x) / s, -(next.y - prev.y) / s, viewBox);
  };

  const panBy = (dx: number, dy: number) => {
    if (!isZoomed.peek()) return;
    const view = viewRect.peek();
    const s = fitScale(view, screenSize());
    viewRect.value = panRect(view, -dx / s, -dy / s, viewBox);
  };

  const onTap = (clientX: number, clientY: number, at: number) => {
    if (lastTapView !== viewRect.peek()) doubleTaps.reset();
    const intent = doubleTaps.tap({ x: clientX, y: clientY, at }, isZoomed.peek());
    lastTapView = viewRect.peek();
    if (intent === 'zoom-out') {
      zoomOut(viewBox);
    } else if (intent === 'zoom-in') {
      const point = toViewPoint(clientX, clientY);
      const hit = registry.regions.find(
        (r) =>
          point.x >= r.bounds.x &&
          point.x <= r.bounds.x + r.bounds.w &&
          point.y >= r.bounds.y &&
          point.y <= r.bounds.y + r.bounds.h,
      );
      if (hit !== undefined) zoomToRegion(hit, viewBox);
    }
    // A pair that changed the view is over; the new view is not a tap in progress.
    if (viewRect.peek() !== lastTapView) {
      tapViewChangeAt = at;
      doubleTaps.reset();
      lastTapView = null;
    }
  };

  /**
   * Applies the effects of one arbiter call. `fresh` is the record of the pointer that just went
   * down: the only effect of a pointer going down that concerns itself is "pending on", every
   * other effect with its id belongs to a stale record of the same id and goes to that one.
   */
  const apply = (
    effects: readonly PressEffect[],
    fresh?: { readonly id: number; readonly record: PointerRecord },
  ) => {
    for (const effect of effects) {
      switch (effect.type) {
        case 'pan':
          panBy(effect.dx, effect.dy);
          break;
        case 'pinch':
          pinchTo(effect.prev, effect.next);
          break;
        case 'pending': {
          const record =
            effect.on && fresh?.id === effect.id ? fresh.record : records.get(effect.id);
          record?.target?.setPending?.(effect.on);
          break;
        }
        case 'discard': {
          const target = records.get(effect.id)?.target;
          target?.setPending?.(false);
          target?.discard?.();
          break;
        }
        case 'tap': {
          if (effect.key === null) {
            onTap(effect.up.x, effect.up.y, effect.at);
            break;
          }
          const record = records.get(effect.id);
          record?.target?.tap?.({ down: effect.down, up: effect.up, hit: record.hit });
          // Control taps never pair in this plan: the tracker forgets whatever it remembered.
          doubleTaps.reset();
          lastTapView = null;
          break;
        }
        case 'pair-break':
          doubleTaps.reset();
          break;
      }
    }
  };

  /** A pointer is captured on the svg while its press is pending or it is a view pointer. */
  const syncCapture = (pointerId: number) => {
    const state = arbiter.stateOf(pointerId);
    if (state === undefined) {
      captured.delete(pointerId);
      records.delete(pointerId);
      return;
    }
    const target = records.get(pointerId)?.target;
    const wanted = state === 'view' || (state === 'pending' && target !== undefined);
    if (!wanted || captured.has(pointerId)) return;
    captured.add(pointerId);
    try {
      svg.setPointerCapture(pointerId);
    } catch {
      // The pointer may already be gone; the release is still handled on pointerup.
    }
  };

  /** Every pointer the machine dropped (a stale sweep, a pinch that ended) loses its record. */
  const syncAll = () => {
    for (const id of Array.from(records.keys())) syncCapture(id);
    for (const id of Array.from(captured)) syncCapture(id);
  };

  const sampleOf = (e: PointerEvent) => ({
    id: e.pointerId,
    kind: kindOf(e),
    primary: e.isPrimary,
    x: e.clientX,
    y: e.clientY,
    t: e.timeStamp,
  });

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target;
    const hit = target instanceof Element ? target.closest(TAP_TARGET_SELECTOR) : null;
    let descriptor: TargetDescriptor = { cls: 'background', key: null };
    let record: PointerRecord | null = null;
    if (hit !== null) {
      const key = pressKeyOf(hit);
      const registered = pressTargetOf(hit);
      record = { target: registered, hit };
      descriptor =
        registered === undefined
          ? { cls: 'own', key, dragStartPx: 0 }
          : { cls: registered.cls, key, dragStartPx: registered.dragStartPx ?? 0 };
    }
    // Effects of a stale record with the same pointer id are applied before the new record is
    // stored; the new pointer's own "pending on" is routed to it explicitly.
    apply(
      arbiter.down(sampleOf(e), descriptor),
      record === null ? undefined : { id: e.pointerId, record },
    );
    if (record !== null) records.set(e.pointerId, record);
    else records.delete(e.pointerId);
    syncCapture(e.pointerId);
    // A pinch makes the first pointer a view pointer too, possibly one the machine took over.
    syncAll();
  };

  const onMove = (e: PointerEvent) => {
    apply(arbiter.move(sampleOf(e)));
    syncCapture(e.pointerId);
    syncAll();
  };

  const onUp = (e: PointerEvent) => {
    apply(arbiter.up(sampleOf(e)));
    syncCapture(e.pointerId);
    syncAll();
  };

  // lostpointercapture follows every pointerup: only a pointer still tracked was cancelled.
  const onCancel = (e: PointerEvent) => {
    apply(arbiter.cancel(e.pointerId));
    syncCapture(e.pointerId);
    syncAll();
  };

  svg.addEventListener('pointerdown', onDown, true);
  svg.addEventListener('pointermove', onMove, true);
  svg.addEventListener('pointerup', onUp, true);
  svg.addEventListener('pointercancel', onCancel, true);
  svg.addEventListener('lostpointercapture', onCancel, true);
  return () => {
    resizeObserver?.disconnect();
    svg.removeEventListener('pointerdown', onDown, true);
    svg.removeEventListener('pointermove', onMove, true);
    svg.removeEventListener('pointerup', onUp, true);
    svg.removeEventListener('pointercancel', onCancel, true);
    svg.removeEventListener('lostpointercapture', onCancel, true);
    apply(arbiter.reset());
    captured.clear();
    records.clear();
    doubleTaps.reset();
  };
}
