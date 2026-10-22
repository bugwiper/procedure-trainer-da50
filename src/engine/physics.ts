// Generic physics types and their validation (D-01, D-02): a quantity such as oil temperature
// moves under a small model that belongs to the aircraft, never to a scenario. A model is a
// first-order lag toward a target or a rate per minute; both are evaluated by sim.ts in fixed
// steps with + - * / only. A scenario sets named parameters (for example a degraded cooling) inside
// the ranges declared here. This module knows no constant, no parameter id and no scenario fact:
// the aircraft data (src/aircraft/da50rg/physics.ts) supplies them.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { PredicateEnv } from './predicates';
import { QUANTITY_ID_PATTERN } from './quantities';
import { STEP_MS } from './sim';

export class PhysicsError extends Error {}

/** What a model reads: the state at the start of the step, never written by a model. */
export interface PhysicsInputs {
  /** Current state of every control (after the events due at this step were applied). */
  readonly controls: Readonly<Record<string, string>>;
  /** The parameters in force: the aircraft's normal values, or the scenario's from its onset. */
  readonly parameters: Readonly<Record<string, number>>;
  /** Every quantity as it is at the start of the step. */
  readonly quantities: Readonly<Record<string, number>>;
  /** Named boolean flags; an empty record until a later plan feeds them. */
  readonly flags: Readonly<Record<string, boolean>>;
}

/** A physics parameter a scenario may set: a finite range and the aircraft's normal value. */
export interface ParameterDef {
  readonly id: string;
  readonly min: number;
  readonly max: number;
  readonly normal: number;
}

/** q moves toward target(inputs) with time constant tauMs. */
export interface LagModel {
  readonly quantity: string;
  readonly mode: 'lag';
  readonly tauMs: number;
  readonly target: (inputs: PhysicsInputs) => number;
}

/** q moves by perMinute(inputs) units per minute. */
export interface RateModel {
  readonly quantity: string;
  readonly mode: 'rate';
  readonly perMinute: (inputs: PhysicsInputs) => number;
}

export type QuantityModel = LagModel | RateModel;

export interface PhysicsSpec {
  readonly parameters: readonly ParameterDef[];
  readonly models: readonly QuantityModel[];
}

export interface Physics {
  readonly parameters: readonly ParameterDef[];
  readonly models: readonly QuantityModel[];
  /** Map-backed, so a prototype key such as "constructor" never resolves. */
  parameter(id: string): ParameterDef | undefined;
  /** The normal value of every parameter, keyed by id. */
  normalParameters(): Readonly<Record<string, number>>;
}

/**
 * Validates a physics spec against the aircraft and freezes it. Throws PhysicsError naming the id
 * for a malformed or duplicate parameter id, a non-finite or inverted range, a normal value
 * outside its range, a model of an unknown quantity, two models of one quantity, and a lag whose
 * tauMs is not finite or is below STEP_MS. A quantity without a model keeps its value.
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

  const parameters = Object.freeze(spec.parameters.map((d) => Object.freeze({ ...d })));
  const byId = new Map(parameters.map((d) => [d.id, d]));
  const normal: Record<string, number> = {};
  for (const d of parameters) normal[d.id] = d.normal;
  Object.freeze(normal);

  return Object.freeze({
    parameters,
    models: Object.freeze(spec.models.map((m) => Object.freeze({ ...m }))),
    parameter: (id: string) => byId.get(id),
    normalParameters: () => normal,
  });
}
