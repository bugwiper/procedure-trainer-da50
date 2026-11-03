// The panel a run leaves (Phase 9, R-14, P-04): the state of every control when a graded run
// completes, captured as one plain record so that a follow-on situation can start with the panel as
// the pilot left it. The carry is the full record, not a difference against the registry defaults:
// a difference would let the follow-on file's own start controls win for every control the pilot
// left at its default. A momentary button is captured at its rest state, because a held press
// cannot be carried. Quantities are never carried (the models bring them to the values the carried
// controls give). Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { Registry, StateId } from './registry';

/** Control id to state id for every control of the aircraft, as a run left them. */
export type Carry = Readonly<Record<string, StateId>>;

/**
 * The carry of a panel state: one entry for every control of the registry, read from `state`, a
 * momentary button at its rest state. Returns a frozen record. Throws RangeError naming the control
 * when the state map lacks one (a partial map would silently fall back to the defaults).
 */
export function carryOf(registry: Registry, state: Readonly<Record<string, StateId>>): Carry {
  const carry: Record<string, StateId> = {};
  for (const def of registry.controls) {
    if (def.kind === 'momentary-button') {
      carry[def.id] = def.default;
      continue;
    }
    const value = Object.hasOwn(state, def.id) ? state[def.id] : undefined;
    if (value === undefined) {
      throw new RangeError(`the panel state has no state for control "${def.id}"`);
    }
    carry[def.id] = value;
  }
  return Object.freeze(carry);
}
