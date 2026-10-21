// The press-target registry (R3-Z2, plan 01.1-37). A widget no longer owns its pointer: it builds
// a press target (a plain object saying what a tap, a press or a discard does) and registers it
// on its hit element. The gesture layer (zoom.ts) classifies a pointerdown by the registered
// class, feeds the press arbiter and calls the target when the arbiter says so. No DOM is used
// beyond the Element type, so factories built on this module are unit tested without a DOM.

import type { DispatchResult } from '../../engine/store';

/** What a pointerdown on a hit element is, to the arbiter (the class of Table A1). */
export type PressClass = 'latch' | 'momentary' | 'own';

export interface ClientPoint {
  readonly x: number;
  readonly y: number;
}

/** The down point and the up point in client px and the hit element the press landed on. */
export interface PressInfo {
  readonly down: ClientPoint;
  readonly up: ClientPoint;
  readonly hit: Element;
}

export interface PressTarget {
  readonly cls: PressClass;
  /** A latch press began (true) or ended without a tap (false): drives the pressed visual. */
  setPending?(on: boolean): void;
  /** A tap; returns the sequence number of the event it recorded, or null when nothing was recorded. */
  tap?(info: PressInfo): number | null;
  /** A momentary commit. */
  press?(info: PressInfo): number | null;
  /** A momentary release. */
  release?(): void;
  /** A pending press was taken away (a drag, a second pointer, a cancel): the control does not act. */
  discard?(): void;
  /** Own class only: the travel (client px) from which the control owns the pointer. */
  readonly dragStartPx?: number;
  /** The key a double-tap pair is matched on (plan 40); default the key of the element. */
  readonly pairKey?: string;
}

const targets = new WeakMap<Element, PressTarget>();

/**
 * Stores the target for an element and writes its class to the element as data-press, so a gate
 * can check from the built page that every hit element is registered with the class its kind
 * needs. A null element is ignored: it is the unmount call of a ref callback. Called from a ref
 * callback on every render, so the target always closes over the current props.
 */
export function registerPressTarget(el: Element | null, target: PressTarget): void {
  if (el === null) return;
  targets.set(el, target);
  el.setAttribute('data-press', target.cls);
}

/** The target registered for an element, or undefined. */
export function pressTargetOf(el: Element | null | undefined): PressTarget | undefined {
  return el === null || el === undefined ? undefined : targets.get(el);
}

/** The data-detent value of a control element if present, else its data-hit value, else null. */
export function pressKeyOf(el: Element | null | undefined): string | null {
  if (el === null || el === undefined) return null;
  return el.getAttribute('data-detent') ?? el.getAttribute('data-hit');
}

/** The sequence number of a successful dispatch result, null for a rejected one. */
export function seqOf(result: DispatchResult): number | null {
  return result.ok ? result.event.seq : null;
}
