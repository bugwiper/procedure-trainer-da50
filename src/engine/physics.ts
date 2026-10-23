// Generic physics types and their validation (D-01, D-02): a quantity such as oil temperature
// moves under a small model that belongs to the aircraft, never to a scenario. A model is a
// first-order lag toward a target or a rate per minute; both are evaluated by sim.ts in fixed
// steps with + - * / only. A scenario sets named parameters (for example a degraded cooling) inside
// the ranges declared here. This module knows no constant, no parameter id and no scenario fact:
// the aircraft data (src/aircraft/da50rg/physics.ts) supplies them.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { PredicateEnv } from './predicates';
import { QUANTITY_ID_PATTERN } from './quantities';
import { legalStates } from './registry';
import { MAX_RUN_MS, STEP_MS } from './sim';

export class PhysicsError extends Error {}

/** What a model reads: the state at the start of the step, never written by a model. */
export interface PhysicsInputs {
  /** Current state of every control (after the events due at this step were applied). */
  readonly controls: Readonly<Record<string, string>>;
  /** The parameters in force: the aircraft's normal values, or the scenario's from its onset. */
  readonly parameters: Readonly<Record<string, number>>;
  /** Every quantity as it is at the start of the step. */
  readonly quantities: Readonly<Record<string, number>>;
  /** Named boolean flags in force: the flag of every active reaction (C-20). */
  readonly flags: Readonly<Record<string, boolean>>;
}

/** A flag name: dotted lower-case ids such as "deice.max_active" (the indicator flag names). */
export const FLAG_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

/** A physics parameter a scenario may set: a finite range and the aircraft's normal value. */
export interface ParameterDef {
  readonly id: string;
  readonly min: number;
  readonly max: number;
  readonly normal: number;
}

/**
 * q moves toward target(inputs) with time constant tauMs. The optional `rate` (C-60) is a
 * multiplier of the step length: the effective time constant is tauMs divided by the rate. A model
 * without a rate, or with rate 1, steps bit for bit as before. The rate is data of the aircraft
 * (read from a physics parameter), never of a scenario file; sim.ts throws for a rate that is not
 * finite or not above 0.
 */
export interface LagModel {
  readonly quantity: string;
  readonly mode: 'lag';
  readonly tauMs: number;
  readonly target: (inputs: PhysicsInputs) => number;
  readonly rate?: (inputs: PhysicsInputs) => number;
}

/** q moves by perMinute(inputs) units per minute. */
export interface RateModel {
  readonly quantity: string;
  readonly mode: 'rate';
  readonly perMinute: (inputs: PhysicsInputs) => number;
}

export type QuantityModel = LagModel | RateModel;

/**
 * A one-shot reaction with a timer (D-03, D-04, C-20). A control entering a state (`on`) arms it
 * when `when` holds for the controls at that moment; it then sets `flag` for `durationMs` of run
 * time and ignores further events until it has ended. `clearsWhen` ends it at once. The event is
 * the trigger, not a state poll: a press and release inside one step still start the reaction.
 */
export interface ReactionSpec {
  readonly id: string;
  /** The event that arms it: this control entering this state. */
  readonly on: { readonly control: string; readonly value: string };
  /** Checked right after the event is applied, over the controls at that moment. */
  readonly when: (controls: Readonly<Record<string, string>>) => boolean;
  /** The flag set while the reaction is active (read by lamps and models). */
  readonly flag: string;
  readonly durationMs: number;
  /** When true for the controls after a step's events, the reaction ends at once. */
  readonly clearsWhen: (controls: Readonly<Record<string, string>>) => boolean;
}

export interface PhysicsSpec {
  readonly parameters: readonly ParameterDef[];
  readonly models: readonly QuantityModel[];
  /** One-shot reactions; none when absent. */
  readonly reactions?: readonly ReactionSpec[];
}

export interface Physics {
  readonly parameters: readonly ParameterDef[];
  readonly models: readonly QuantityModel[];
  readonly reactions: readonly ReactionSpec[];
  /** Map-backed, so a prototype key such as "constructor" never resolves. */
  parameter(id: string): ParameterDef | undefined;
  /** The normal value of every parameter, keyed by id. */
  normalParameters(): Readonly<Record<string, number>>;
}

/**
 * Validates a physics spec against the aircraft and freezes it. Throws PhysicsError naming the id
 * for a malformed or duplicate parameter id, a non-finite or inverted range, a normal value
 * outside its range, a model of an unknown quantity, two models of one quantity, and a lag whose
 * tauMs is not finite or is below STEP_MS. A quantity without a model keeps its value. A reaction
 * must have a unique id of the quantity-id pattern, name a registry control and one of its legal
 * states as trigger, a dotted lower-case flag name and a finite durationMs from STEP_MS to
 * MAX_RUN_MS.
 */
export function definePhysics(spec: PhysicsSpec, env: PredicateEnv): Physics {
  const seen = new Set<string>();
  for (const def of spec.parameters) {
    if (!QUANTITY_ID_PATTERN.test(def.id)) {
      throw new PhysicsError(
        `parameter id "${def.id}" does not match ${QUANTITY_ID_PATTERN.source}`,
      );
    }
    if (seen.has(def.id)) throw new PhysicsError(`duplicate parameter id "${def.id}"`);
    seen.add(def.id);
    if (![def.min, def.max, def.normal].every(Number.isFinite)) {
      throw new PhysicsError(`parameter "${def.id}" needs finite min, max and normal`);
    }
    if (!(def.min <= def.normal && def.normal <= def.max)) {
      throw new PhysicsError(
        `parameter "${def.id}" has normal ${String(def.normal)} outside ${String(def.min)}..${String(def.max)}`,
      );
    }
  }

  const modelled = new Set<string>();
  for (const model of spec.models) {
    if (env.quantities.get(model.quantity) === undefined) {
      throw new PhysicsError(`model names unknown quantity "${model.quantity}"`);
    }
    if (modelled.has(model.quantity)) {
      throw new PhysicsError(`quantity "${model.quantity}" has more than one model`);
    }
    modelled.add(model.quantity);
    if (model.mode === 'lag' && !(Number.isFinite(model.tauMs) && model.tauMs >= STEP_MS)) {
      throw new PhysicsError(
        `lag model of "${model.quantity}" needs a finite tauMs of at least ${String(STEP_MS)} (got ${String(model.tauMs)})`,
      );
    }
  }

  const reactionIds = new Set<string>();
  for (const reaction of spec.reactions ?? []) {
    if (!QUANTITY_ID_PATTERN.test(reaction.id)) {
      throw new PhysicsError(
        `reaction id "${reaction.id}" does not match ${QUANTITY_ID_PATTERN.source}`,
      );
    }
    if (reactionIds.has(reaction.id)) {
      throw new PhysicsError(`duplicate reaction id "${reaction.id}"`);
    }
    reactionIds.add(reaction.id);
    const control = env.registry.get(reaction.on.control);
    if (control === undefined) {
      throw new PhysicsError(
        `reaction "${reaction.id}" is armed by unknown control "${reaction.on.control}"`,
      );
    }
    if (!legalStates(control).includes(reaction.on.value)) {
      throw new PhysicsError(
        `reaction "${reaction.id}" is armed by state "${reaction.on.value}" which is not legal for control "${reaction.on.control}"`,
      );
    }
    if (!FLAG_PATTERN.test(reaction.flag)) {
      throw new PhysicsError(
        `reaction "${reaction.id}" has flag "${reaction.flag}" which does not match ${FLAG_PATTERN.source}`,
      );
    }
    if (!(
      Number.isFinite(reaction.durationMs) &&
      reaction.durationMs >= STEP_MS &&
      reaction.durationMs <= MAX_RUN_MS
    )) {
      throw new PhysicsError(
        `reaction "${reaction.id}" needs a finite durationMs from ${String(STEP_MS)} to ${String(MAX_RUN_MS)} (got ${String(reaction.durationMs)})`,
      );
    }
  }

  const parameters = Object.freeze(spec.parameters.map((d) => Object.freeze({ ...d })));
  const byId = new Map(parameters.map((d) => [d.id, d]));
  const normal: Record<string, number> = {};
  for (const d of parameters) normal[d.id] = d.normal;
  Object.freeze(normal);

  return Object.freeze({
    parameters,
    models: Object.freeze(spec.models.map((m) => Object.freeze({ ...m }))),
    reactions: Object.freeze(
      (spec.reactions ?? []).map((r) => Object.freeze({ ...r, on: Object.freeze({ ...r.on }) })),
    ),
    parameter: (id: string) => byId.get(id),
    normalParameters: () => normal,
  });
}
