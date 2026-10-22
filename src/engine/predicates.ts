// Predicate evaluation for scenario files (D-22, D-09): the closed vocabulary of Table F3
// (state, state_in, travel, travel_rel, quantity, band) evaluated against a context of control
// states, the scenario baseline and quantity values. Nothing is ever evaluated as a string. An
// unknown control or quantity, or a travel check on a control that is not a detent lever, is a
// programmer error here (lint rejects it for authored files) and throws PredicateError. Control
// and quantity definitions are looked up through the Map-backed registry and quantity set, and
// scenario-keyed records are only read with Object.hasOwn, so a prototype key never resolves
// (T-02-28).
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { Predicate, Scenario } from '../scenario/schema';
import type { AircraftEnv } from './env';
import type { QuantitySet } from './quantities';
import type { DetentLeverDef, Registry, StateId } from './registry';

export class PredicateError extends Error {}

export interface PredicateContext {
  /** Current state of every control. */
  readonly controls: Readonly<Record<string, StateId>>;
  /** State of every control at the start of the run (travel_rel is relative to this). */
  readonly baseline: Readonly<Record<string, StateId>>;
  /** Current value of every quantity. */
  readonly quantities: Readonly<Record<string, number>>;
}

type Op = Extract<Predicate, { check: 'travel' }>['op'];

function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function compare(op: Op, left: number, right: number): boolean {
  switch (op) {
    case 'lt':
      return left < right;
    case 'lte':
      return left <= right;
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
  }
}

/** Travel percent of a detent state: Math.round(pos * 1000) / 10, so p55 is exactly 55. */
export function travelPercent(def: DetentLeverDef, state: StateId): number {
  const detent = def.detents.find((d) => d.id === state);
  if (detent === undefined) {
    throw new PredicateError(`"${state}" is not a detent of lever "${def.id}"`);
  }
  return Math.round(detent.pos * 1000) / 10;
}

function leverOf(env: AircraftEnv, id: string): DetentLeverDef {
  const def = env.registry.get(id);
  if (def === undefined) throw new PredicateError(`unknown control "${id}"`);
  if (def.kind !== 'detent-lever') {
    throw new PredicateError(`a travel check needs a detent lever, "${id}" is a ${def.kind}`);
  }
  return def;
}

function stateOf(env: AircraftEnv, states: Readonly<Record<string, StateId>>, id: string): StateId {
  if (env.registry.get(id) === undefined) throw new PredicateError(`unknown control "${id}"`);
  const state = own(states, id);
  if (state === undefined) throw new PredicateError(`control "${id}" has no state in the context`);
  return state;
}

function quantityOf(env: AircraftEnv, ctx: PredicateContext, id: string): number {
  if (env.quantities.get(id) === undefined) throw new PredicateError(`unknown quantity "${id}"`);
  const value = own(ctx.quantities, id);
  if (value === undefined) throw new PredicateError(`quantity "${id}" has no value in the context`);
  return value;
}

export function evaluatePredicate(p: Predicate, ctx: PredicateContext, env: AircraftEnv): boolean {
  switch (p.check) {
    case 'state':
      return stateOf(env, ctx.controls, p.control) === p.is;
    case 'state_in':
      return p.in.includes(stateOf(env, ctx.controls, p.control));
    case 'travel': {
      const def = leverOf(env, p.control);
      return compare(p.op, travelPercent(def, stateOf(env, ctx.controls, p.control)), p.value);
    }
    case 'travel_rel': {
      const def = leverOf(env, p.control);
      const start = travelPercent(def, stateOf(env, ctx.baseline, p.control));
      // One decimal, so a fractional baseline plus a delta compares without float noise.
      const target = Math.round((start + p.delta) * 10) / 10;
      return compare(p.op, travelPercent(def, stateOf(env, ctx.controls, p.control)), target);
    }
    case 'quantity':
      return compare(p.op, quantityOf(env, ctx, p.quantity), p.value);
    case 'band':
      return p.in.includes(env.quantities.bandOf(p.quantity, quantityOf(env, ctx, p.quantity)));
  }
}

/** The registry defaults overlaid with the scenario's initial controls. */
export function baselineOf(scenario: Scenario, registry: Registry): Record<string, StateId> {
  const baseline: Record<string, StateId> = {};
  for (const def of registry.controls) baseline[def.id] = def.default;
  for (const [id, state] of Object.entries(scenario.initial.controls)) {
    if (registry.get(id) === undefined) throw new PredicateError(`unknown control "${id}"`);
    baseline[id] = state;
  }
  return baseline;
}

/** The idle value of every quantity overlaid with the scenario's initial quantities. */
export function initialQuantities(
  scenario: Scenario,
  quantities: QuantitySet,
): Record<string, number> {
  const values: Record<string, number> = { ...quantities.idleValues() };
  for (const [id, value] of Object.entries(scenario.initial.quantities)) {
    if (quantities.get(id) === undefined) throw new PredicateError(`unknown quantity "${id}"`);
    values[id] = value;
  }
  return values;
}
