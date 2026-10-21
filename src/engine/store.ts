// Pure panel state store: the only authority on legal control state (D-09).
// The engine never reads a clock; t is always supplied by the caller.

import { guardIdFor, legalStates } from './registry';
import type { ControlDef, ControlId, Registry, StateId } from './registry';

export interface ControlEvent {
  readonly seq: number;
  readonly t: number;
  readonly id: ControlId;
  readonly value: StateId;
  readonly source: 'user';
}

export type RejectReason = 'unknown' | 'illegal-state' | 'blocked' | 'unchanged';
export type DispatchResult =
  | { readonly ok: true; readonly event: ControlEvent }
  | { readonly ok: false; readonly reason: RejectReason };

/** Why a retract was refused (Table S1 of plan 01.1-35). Checked in this order. */
export type RetractRefusal = 'unknown-event' | 'consumed' | 'not-last';
export type RetractResult =
  | { readonly ok: true; readonly event: ControlEvent; readonly restored: StateId }
  | { readonly ok: false; readonly reason: RetractRefusal };

/**
 * The control state map defined by an action log: the default of every control, then every event
 * applied in order (the later value wins). The one definition shared by the live state, retract
 * and the tests. Events are trusted: they were accepted by dispatch, so no legality is checked.
 */
export function deriveState(
  registry: Registry,
  events: readonly ControlEvent[],
): Record<ControlId, StateId> {
  const state: Record<ControlId, StateId> = {};
  for (const def of registry.controls) state[def.id] = def.default;
  for (const event of events) state[event.id] = event.value;
  return state;
}

export class PanelStore {
  readonly registry: Registry;
  private state: Map<ControlId, StateId>;
  private readonly log: ControlEvent[] = [];
  private readonly listeners = new Set<(event: ControlEvent) => void>();
  private readonly retractListeners = new Set<(event: ControlEvent, restored: StateId) => void>();
  private consumed = -1;

  constructor(registry: Registry) {
    this.registry = registry;
    this.state = new Map(Object.entries(deriveState(registry, this.log)));
  }

  /** Highest seq a time-driven reaction has consumed; -1 when none (retract refuses these). */
  get consumedThrough(): number {
    return this.consumed;
  }

  get(id: ControlId): StateId | undefined {
    return this.state.get(id);
  }

  snapshot(): Readonly<Record<ControlId, StateId>> {
    return Object.fromEntries(this.state);
  }

  events(): readonly ControlEvent[] {
    return this.log.slice();
  }

  /** True for a guarded-toggle whose guard is 'closed'. */
  isBlocked(id: ControlId): boolean {
    const def = this.registry.get(id);
    if (def?.kind !== 'guarded-toggle') return false;
    return this.state.get(guardIdFor(id)) === 'closed';
  }

  dispatch(id: ControlId, value: StateId, t: number): DispatchResult {
    if (!Number.isFinite(t) || t < 0) {
      throw new RangeError(`dispatch time must be a finite number >= 0 (got ${String(t)})`);
    }
    const def: ControlDef | undefined = this.registry.get(id);
    if (def === undefined) return { ok: false, reason: 'unknown' };
    if (!legalStates(def).includes(value)) return { ok: false, reason: 'illegal-state' };
    if (this.isBlocked(id)) return { ok: false, reason: 'blocked' };
    if (this.state.get(id) === value) return { ok: false, reason: 'unchanged' };

    this.state.set(id, value);
    const event: ControlEvent = { seq: this.log.length, t, id, value, source: 'user' };
    this.log.push(event);
    for (const listener of [...this.listeners]) listener(event);
    return { ok: true, event };
  }

  /**
   * Removes the LAST event from the log (not a counter-event) and rebuilds the state from the
   * remaining log, so the log stays the truthful grading record: a retracted tap never happened.
   * Refused, changing nothing and notifying nobody, when seq is not an event of the log
   * (unknown-event), is at or below the consumed watermark (consumed), or is not the last event
   * (not-last), checked in that order. Retract listeners are called once with the removed event
   * and the restored value of its control; dispatch listeners are not called. A seq is a position
   * in the current log, so the next accepted event reuses the retracted seq.
   *
   * Rule for Phase 3: a time-driven reaction (timer, ramp or trigger) that consumes an event must
   * call markConsumed up to that event, and retract then refuses it. The pair window (time, pixels,
   * same control) is a UI rule; the engine has no clock and never sees time here.
   */
  retract(seq: number): RetractResult {
    if (!Number.isInteger(seq) || seq < 0 || seq >= this.log.length) {
      return { ok: false, reason: 'unknown-event' };
    }
    if (seq <= this.consumed) return { ok: false, reason: 'consumed' };
    if (seq !== this.log.length - 1) return { ok: false, reason: 'not-last' };

    const event = this.log[seq];
    if (event === undefined) return { ok: false, reason: 'unknown-event' };
    const remaining = this.log.slice(0, seq);
    const next = deriveState(this.registry, remaining);
    const restored = next[event.id];
    if (restored === undefined)
      throw new Error(`event ${String(seq)} names unknown control "${event.id}"`);
    this.log.length = seq;
    this.state = new Map(Object.entries(next));
    for (const listener of [...this.retractListeners]) listener(event, restored);
    return { ok: true, event, restored };
  }

  /**
   * Raises the consumed watermark to throughSeq: every event up to and including it has been used
   * by a reaction and can no longer be retracted. Phase 3 seam: a time-driven reaction calls this
   * for every event it consumes; nothing calls it in phase 01.1 because no reaction exists yet.
   * Throws RangeError unless throughSeq is an integer, not below the current watermark and below
   * the log length.
   */
  markConsumed(throughSeq: number): void {
    if (
      !Number.isInteger(throughSeq) ||
      throughSeq < this.consumed ||
      throughSeq >= this.log.length
    ) {
      throw new RangeError(
        `markConsumed needs an integer from ${String(this.consumed)} to ${String(this.log.length - 1)} (got ${String(throughSeq)})`,
      );
    }
    this.consumed = throughSeq;
  }

  onRetract(listener: (event: ControlEvent, restored: StateId) => void): () => void {
    this.retractListeners.add(listener);
    return () => {
      this.retractListeners.delete(listener);
    };
  }

  subscribe(listener: (event: ControlEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
