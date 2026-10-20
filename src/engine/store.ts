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

export class PanelStore {
  readonly registry: Registry;
  private readonly state = new Map<ControlId, StateId>();
  private readonly log: ControlEvent[] = [];
  private readonly listeners = new Set<(event: ControlEvent) => void>();

  constructor(registry: Registry) {
    this.registry = registry;
    for (const def of registry.controls) this.state.set(def.id, def.default);
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

  subscribe(listener: (event: ControlEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
