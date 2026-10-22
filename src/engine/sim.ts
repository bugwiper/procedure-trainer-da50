// The fixed-step simulation (D-01, D-02, SCN-06, PNL-04): the aircraft's physics advanced in whole
// STEP_MS steps from a start state and the control events of an action log. One definition serves
// the live run (run.ts steps it incrementally) and every replay (simulate loops it), so a recording
// stepped live and replayed gives the identical state at every step.
//
// Determinism (RESEARCH Pitfall 1): only + - * / and clamp; every quantity is clamped to its range
// and quantised to 0.01 (or the quantity's own finer scale) after every step, so node and every
// browser engine agree bit for bit.
//
// Event timing rule (C-02): an event with time t is applied before the step that starts at the
// first step boundary T with T at least t. Events apply one by one in log order and are never
// sorted by t: a later event of the log waits behind an earlier one that is not yet due.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { AircraftEnv } from './env';
import type { PhysicsInputs } from './physics';
import { baselineOf } from './predicates';
import type { Scenario } from '../scenario/schema';

/** Length of one simulation step in virtual milliseconds. */
export const STEP_MS = 100;

/** The longest simulated run (30 minutes); bounds every replay and lint loop. */
export const MAX_RUN_MS = 1_800_000;

const MS_PER_MINUTE = 60_000;

/** Readings are rounded to 1 / DEFAULT_SCALE (0.01) unless a quantity declares its own scale. */
export const DEFAULT_SCALE = 100;

/** Rounds to 1 / scale (default 0.01; never -0, so records compare equal). */
export function quantise(value: number, scale: number = DEFAULT_SCALE): number {
  const rounded = Math.round(value * scale) / scale;
  return rounded === 0 ? 0 : rounded;
}

/** One control event as the simulation reads it; ControlEvent and RecordedEvent satisfy it. */
export interface SimEvent {
  readonly t: number;
  readonly id: string;
  readonly value: string;
}

/** The simulated state at the start of the step beginning at t. */
export interface SimState {
  readonly t: number;
  readonly controls: Readonly<Record<string, string>>;
  readonly quantities: Readonly<Record<string, number>>;
  readonly flags: Readonly<Record<string, boolean>>;
}

/** What a simulation is run against: the aircraft, the scenario's baseline and its parameters. */
export interface SimSetup {
  readonly env: AircraftEnv;
  /** The control state at t 0: registry defaults overlaid with the scenario's initial controls. */
  readonly baseline: Readonly<Record<string, string>>;
  /** The aircraft's normal parameter values (before the onset). */
  readonly normalParameters: Readonly<Record<string, number>>;
  /** The normal values overlaid with the scenario's parameters (from the onset). */
  readonly faultedParameters: Readonly<Record<string, number>>;
  /** Before this time the normal parameters are in force; 0 means the failure is there from the start. */
  readonly onsetAt: number;
}

export interface SimOptions {
  readonly onsetAt?: number;
}

export function simSetup(env: AircraftEnv, scenario: Scenario, options: SimOptions = {}): SimSetup {
  const normalParameters = env.physics.normalParameters();
  return Object.freeze({
    env,
    baseline: Object.freeze(baselineOf(scenario, env.registry)),
    normalParameters,
    faultedParameters: Object.freeze({ ...normalParameters, ...scenario.parameters }),
    onsetAt: options.onsetAt ?? 0,
  });
}

/**
 * The state at t 0: the baseline controls and the start quantities (the base values overlaid with
 * the given ones, normally initialQuantities of the scenario).
 */
export function initSim(setup: SimSetup, start: Readonly<Record<string, number>>): SimState {
  return Object.freeze({
    t: 0,
    controls: setup.baseline,
    quantities: Object.freeze({ ...setup.env.quantities.baseValues(), ...start }),
    flags: Object.freeze({}),
  });
}

export interface StepResult {
  readonly state: SimState;
  /** Indexes into the due events that fired a one-shot reaction; empty until reactions exist. */
  readonly fired: readonly number[];
}

/**
 * Advances the state by one step: applies the due events in order, evaluates every model with the
 * parameters in force at state.t, clamps and quantises each result and moves t by STEP_MS. An
 * event naming a control the state does not have throws Error naming it.
 */
export function stepSim(setup: SimSetup, state: SimState, due: readonly SimEvent[]): StepResult {
  const controls: Record<string, string> = { ...state.controls };
  for (const event of due) {
    if (!Object.hasOwn(controls, event.id)) {
      throw new Error(`event names unknown control "${event.id}"`);
    }
    controls[event.id] = event.value;
  }

  const inputs: PhysicsInputs = {
    controls,
    parameters: state.t >= setup.onsetAt ? setup.faultedParameters : setup.normalParameters,
    quantities: state.quantities,
    flags: state.flags,
  };

  const quantities: Record<string, number> = { ...state.quantities };
  for (const model of setup.env.physics.models) {
    const def = setup.env.quantities.get(model.quantity);
    const current = Object.hasOwn(state.quantities, model.quantity)
      ? state.quantities[model.quantity]
      : undefined;
    if (def === undefined || current === undefined) {
      throw new Error(`quantity "${model.quantity}" has no value in the simulation state`);
    }
    const next =
      model.mode === 'lag'
        ? current + ((model.target(inputs) - current) * STEP_MS) / model.tauMs
        : current + (model.perMinute(inputs) * STEP_MS) / MS_PER_MINUTE;
    if (!Number.isFinite(next)) {
      throw new Error(`model of "${model.quantity}" produced ${String(next)}`);
    }
    quantities[model.quantity] = quantise(
      Math.min(def.max, Math.max(def.min, next)),
      def.scale ?? DEFAULT_SCALE,
    );
  }

  return {
    state: Object.freeze({
      t: state.t + STEP_MS,
      controls: Object.freeze(controls),
      quantities: Object.freeze(quantities),
      flags: state.flags,
    }),
    fired: Object.freeze([]),
  };
}

export interface SimInput {
  readonly events: readonly SimEvent[];
  /** The quantities at t 0, as for initSim. */
  readonly start: Readonly<Record<string, number>>;
  /** Simulate until t reaches this time (or MAX_RUN_MS, whichever is smaller). */
  readonly untilMs: number;
}

/**
 * Replays a log from the setup's start state in whole steps until the smaller of untilMs and
 * MAX_RUN_MS. Each step is handed the events, in log order, from the first not yet applied up to
 * the first whose time is after the step's start (C-02).
 */
export function simulate(setup: SimSetup, input: SimInput): { readonly state: SimState } {
  let state = initSim(setup, input.start);
  const limit = Math.min(input.untilMs, MAX_RUN_MS);
  let next = 0;
  while (state.t < limit) {
    const from = next;
    for (;;) {
      const event = input.events[next];
      if (event === undefined || event.t > state.t) break;
      next += 1;
    }
    state = stepSim(setup, state, input.events.slice(from, next)).state;
  }
  return { state };
}
