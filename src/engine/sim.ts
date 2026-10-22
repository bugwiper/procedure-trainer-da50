// The fixed-step simulation (D-01, D-02, SCN-06, PNL-04): the aircraft's physics advanced in whole
// STEP_MS steps from a start state and the control events of an action log. One definition serves
// the live run (run.ts steps it incrementally) and every replay (simulate loops it), so a recording
// stepped live and replayed gives the identical state at every step.
//
// Determinism (RESEARCH Pitfall 1): only + - * / and clamp; every quantity is clamped to its range
// and quantised to 0.01 (or the quantity's own finer scale) after every step, so node and every
// browser engine agree bit for bit.
//
// Reactions (C-20): a control entering a state may start a one-shot reaction with a timer. Step
// order: (1) the due events apply one by one in log order and, after each, a reaction armed by it
// whose condition holds starts unless it is already active; (2) an active reaction whose clear
// condition holds ends at once; (3) the models run, reading the flags of the active reactions;
// (4) every active timer counts down by STEP_MS and its flag goes off at 0. A reaction is thus in
// force for exactly its duration, counted from the step that applied the arming event.
//
// Outcomes (D-06, C-25): after the physics of a step every outcome predicate is evaluated over the
// controls, the scenario baseline and the quantities of the new state. Its held time grows by
// STEP_MS while it holds and drops to 0 when it does not; the first outcome in declared order whose
// held time reaches its hold time fires, with t the time of the new state. A state with an outcome
// is final: no step follows it.
//
// Event timing rule (C-02): an event with time t is applied before the step that starts at the
// first step boundary T with T at least t. Events apply one by one in log order and are never
// sorted by t: a later event of the log waits behind an earlier one that is not yet due.
// Pure TypeScript, no DOM, no framework, no clock (enforced by the ESLint boundary).

import type { AircraftEnv } from './env';
import type { PhysicsInputs } from './physics';
import { baselineOf, evaluatePredicate } from './predicates';
import type { Outcome, Scenario } from '../scenario/schema';

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
  /** The flag of every active reaction, true; a flag of no active reaction is absent. */
  readonly flags: Readonly<Record<string, boolean>>;
  /** Remaining run time in ms of every active reaction, keyed by reaction id (C-20). */
  readonly timers: Readonly<Record<string, number>>;
  /** Held time in ms of every outcome predicate that holds now, keyed by outcome id (C-25). */
  readonly holds: Readonly<Record<string, number>>;
  /** The outcome that ended the run (id and the run time it fired at), or null while none did. */
  readonly outcome: { readonly id: string; readonly t: number } | null;
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
  /** The scenario's named outcomes, in declared order (C-25). */
  readonly outcomes: readonly Outcome[];
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
    outcomes: scenario.outcomes,
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
    timers: Object.freeze({}),
    holds: Object.freeze({}),
    outcome: null,
  });
}

export interface StepResult {
  readonly state: SimState;
  /** Indexes into the due events that started a reaction in this step, in event order. */
  readonly fired: readonly number[];
}

/** The flags of the reactions whose timer is running, each true. */
function activeFlags(
  setup: SimSetup,
  timers: Readonly<Record<string, number>>,
): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const reaction of setup.env.physics.reactions) {
    if (Object.hasOwn(timers, reaction.id)) flags[reaction.flag] = true;
  }
  return flags;
}

/**
 * Advances the state by one step in the order of C-20: applies the due events in order (starting
 * the reactions they arm), ends the reactions whose clear condition holds, evaluates every model
 * with the parameters and flags in force, clamps and quantises each result, counts the timers down
 * evaluates the outcomes and moves t by STEP_MS. A state that already has an outcome is returned
 * unchanged. An event naming a control the state does not have throws Error naming it.
 */
export function stepSim(setup: SimSetup, state: SimState, due: readonly SimEvent[]): StepResult {
  if (state.outcome !== null) return { state, fired: Object.freeze([]) };
  const reactions = setup.env.physics.reactions;
  const controls: Record<string, string> = { ...state.controls };
  let timers: Record<string, number> = { ...state.timers };
  const fired: number[] = [];

  // (1) The due events, one by one; a reaction armed by the event starts unless it is active.
  due.forEach((event, index) => {
    if (!Object.hasOwn(controls, event.id)) {
      throw new Error(`event names unknown control "${event.id}"`);
    }
    controls[event.id] = event.value;
    let started = false;
    for (const reaction of reactions) {
      if (reaction.on.control !== event.id || reaction.on.value !== event.value) continue;
      if (Object.hasOwn(timers, reaction.id) || !reaction.when(controls)) continue;
      timers[reaction.id] = reaction.durationMs;
      started = true;
    }
    if (started) fired.push(index);
  });

  // (2) A reaction whose clear condition holds ends at once.
  const kept: Record<string, number> = {};
  for (const reaction of reactions) {
    const remaining = Object.hasOwn(timers, reaction.id) ? timers[reaction.id] : undefined;
    if (remaining !== undefined && !reaction.clearsWhen(controls)) kept[reaction.id] = remaining;
  }
  timers = kept;

  // (3) The models, reading the flags of the active reactions.
  const inputs: PhysicsInputs = {
    controls,
    parameters: state.t >= setup.onsetAt ? setup.faultedParameters : setup.normalParameters,
    quantities: state.quantities,
    flags: activeFlags(setup, timers),
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

  // (4) Every active timer counts down; a flag goes off when its timer reaches 0.
  const counted: Record<string, number> = {};
  for (const reaction of reactions) {
    const remaining = Object.hasOwn(timers, reaction.id) ? timers[reaction.id] : undefined;
    if (remaining !== undefined && remaining - STEP_MS > 0) {
      counted[reaction.id] = remaining - STEP_MS;
    }
  }

  // (5) The outcomes, over the new controls and quantities: a held time grows while the predicate
  // holds and drops to 0 when it does not; the first declared outcome whose hold is complete fires.
  const t = state.t + STEP_MS;
  const context = { controls, baseline: setup.baseline, quantities };
  const holds: Record<string, number> = {};
  let outcome: SimState['outcome'] = null;
  for (const item of setup.outcomes) {
    if (!evaluatePredicate(item.when, context, setup.env)) continue;
    const held = (Object.hasOwn(state.holds, item.id) ? (state.holds[item.id] ?? 0) : 0) + STEP_MS;
    holds[item.id] = held;
    if (outcome === null && held >= item.hold_s * 1000) outcome = { id: item.id, t };
  }

  return {
    state: Object.freeze({
      t,
      controls: Object.freeze(controls),
      quantities: Object.freeze(quantities),
      flags: Object.freeze(activeFlags(setup, counted)),
      timers: Object.freeze(counted),
      holds: Object.freeze(holds),
      outcome,
    }),
    fired: Object.freeze(fired),
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
 * MAX_RUN_MS, or until an outcome fires. Each step is handed the events, in log order, from the first not yet applied up to
 * the first whose time is after the step's start (C-02).
 */
export function simulate(setup: SimSetup, input: SimInput): { readonly state: SimState } {
  let state = initSim(setup, input.start);
  const limit = Math.min(input.untilMs, MAX_RUN_MS);
  let next = 0;
  while (state.t < limit && state.outcome === null) {
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
