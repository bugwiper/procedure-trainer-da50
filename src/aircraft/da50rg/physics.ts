import { definePhysics } from '../../engine/physics';
import type { PhysicsInputs } from '../../engine/physics';
import { travelPercent } from '../../engine/predicates';
import type { DetentLeverDef } from '../../engine/registry';
import { DA50RG } from './panel';
import { DA50RG_QUANTITIES } from './quantities';

// DA50 RG physics (D-01, D-02, C-03, C-05): how the named quantities move during a run. Aircraft
// behaviour, never a scenario fact: a scenario only sets a parameter such as the oil cooling.
// The time constants are compressed (tens of seconds) so that a scenario resolves in one to five
// minutes: a training-aid choice. The constants are an instructor-review item (RESEARCH A1), not
// measured values. No AFM wording; only + - * / (RESEARCH Pitfall 1).

/** Ambient and engine-off oil temperature, degrees C. */
const AMBIENT_C = 15;
/** Heat the oil must shed with the power at 0 % and per unit of load (0 to 1). */
const HEAT_BASE = 20;
const HEAT_PER_LOAD = 80;
/** An open cowl flap multiplies the cooling by this factor. */
const COWL_OPEN_COOLING = 1.3;
/** Oil temperature time constant, compressed. */
const OIL_TEMP_TAU_MS = 60_000;

function lever(id: string): DetentLeverDef {
  const def = DA50RG.get(id);
  if (def?.kind !== 'detent-lever') throw new Error(`physics needs the detent lever "${id}"`);
  return def;
}

const POWER = lever('lv.power');

function stateOf(inputs: PhysicsInputs, id: string): string {
  const state = Object.hasOwn(inputs.controls, id) ? inputs.controls[id] : undefined;
  if (state === undefined) throw new Error(`physics reads control "${id}" which has no state`);
  return state;
}

function parameterOf(inputs: PhysicsInputs, id: string): number {
  const value = Object.hasOwn(inputs.parameters, id) ? inputs.parameters[id] : undefined;
  if (value === undefined) throw new Error(`physics reads parameter "${id}" which is not set`);
  return value;
}

/**
 * The temperature the oil settles at: the heat to shed (rising with the POWER load) divided by
 * the cooling (the parameter, raised by an open cowl flap). With the engine master off the oil
 * cools toward ambient. Cases (cooling 1, POWER 70 %, cowl closed) give 91 degrees C, a green
 * cruise value; a degraded cooling with POWER 75 % and the cowl closed settles above the red range.
 */
function oilTempTarget(inputs: PhysicsInputs): number {
  if (stateOf(inputs, 'sw.engine_master') === 'off') return AMBIENT_C;
  const load = travelPercent(POWER, stateOf(inputs, 'lv.power')) / 100;
  const flap = stateOf(inputs, 'lv.cowl_flap') === 'open' ? COWL_OPEN_COOLING : 1;
  const cooling = parameterOf(inputs, 'oil_cooling') * flap;
  return AMBIENT_C + (HEAT_BASE + HEAT_PER_LOAD * load) / cooling;
}

export const DA50RG_PHYSICS = definePhysics(
  {
    parameters: [
      // 1 is the normal cooling; a scenario degrades it. The lower bound keeps the divisor positive.
      { id: 'oil_cooling', min: 0.2, max: 1, normal: 1 },
    ],
    models: [
      { quantity: 'oil_temp_c', mode: 'lag', tauMs: OIL_TEMP_TAU_MS, target: oilTempTarget },
    ],
  },
  { registry: DA50RG, quantities: DA50RG_QUANTITIES },
);
