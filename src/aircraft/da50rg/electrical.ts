import type { PhysicsInputs } from '../../engine/physics';

// DA50 RG electrical system as aircraft data (phase 4, E-04, E-07): which alternator is online and
// when its control unit raises the ALTN n FAIL caution. Pure functions over control states and
// parameters, no scenario fact, only + - * / and comparisons. The caution comes from the alternator
// control unit logic, never from a current: it stays after the alternator is switched off and goes
// when the only cause is gone.

/** What the electrical rules read: control states and the scenario parameters in force. */
export type ElectricalInputs = Pick<PhysicsInputs, 'controls' | 'parameters'>;

/** The two alternators. */
export type Alternator = 1 | 2;

function stateOf(inputs: ElectricalInputs, id: string): string {
  const state = Object.hasOwn(inputs.controls, id) ? inputs.controls[id] : undefined;
  if (state === undefined) throw new Error(`electrical reads control "${id}" which has no state`);
  return state;
}

function parameterOf(inputs: ElectricalInputs, id: string): number {
  const value = Object.hasOwn(inputs.parameters, id) ? inputs.parameters[id] : undefined;
  if (value === undefined) {
    throw new Error(`electrical reads parameter "${id}" which is not set`);
  }
  return value;
}

/** The output parameter of an alternator: 1 is normal, 0 is dead. */
function output(inputs: ElectricalInputs, n: Alternator): number {
  return parameterOf(inputs, `alt${String(n)}_output`);
}

/**
 * Alternator n is online: the engine runs, its ALTERNATOR switch is on, its breaker is in, ELECT.
 * MASTER is on and its output is above 0. The battery charge never decides (E-04: the excitation
 * batteries are assumed charged).
 */
export function alternatorOnline(
  inputs: ElectricalInputs,
  n: Alternator,
  engineRunning: boolean,
): boolean {
  return (
    engineRunning &&
    stateOf(inputs, `sw.alternator_${String(n)}`) === 'on' &&
    stateOf(inputs, `cb.alt${String(n)}`) === 'in' &&
    stateOf(inputs, 'sw.elect_master') === 'on' &&
    output(inputs, n) > 0
  );
}

/**
 * The alternator control unit of alternator n reports a fault (E-07): its output is below normal,
 * it has a short, its breaker is out or its ALTERNATOR switch is OFF. Not the engine state and not
 * ELECT. MASTER.
 */
export function acuFault(inputs: ElectricalInputs, n: Alternator): boolean {
  return (
    output(inputs, n) < 1 ||
    parameterOf(inputs, `alt${String(n)}_short`) > 0 ||
    stateOf(inputs, `cb.alt${String(n)}`) === 'out' ||
    stateOf(inputs, `sw.alternator_${String(n)}`) === 'off'
  );
}
