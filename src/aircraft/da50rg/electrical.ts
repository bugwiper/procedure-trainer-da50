import type { PhysicsInputs } from '../../engine/physics';
import { DA50RG_QUANTITIES } from './quantities';

// DA50 RG electrical system as aircraft data (phase 4, E-01 to E-11): the buses, the bus tie
// relay, the consumers, the alternator currents, the battery and the Volts reading, all derived by
// one pure function (electricalState) from control states, parameters and the battery charge; and
// which alternator is online and when its control unit raises the ALTN n FAIL caution. No scenario
// fact, only + - * / and comparisons. The caution comes from the alternator control unit logic,
// never from a current: it stays after the alternator is switched off and goes when the only cause
// is gone. Every number below is an instructor-review value unless it is a base value of
// quantities.ts (the anchor of C-09).

/** What the electrical rules read: control states and the scenario parameters in force. */
export type ElectricalInputs = Pick<PhysicsInputs, 'controls' | 'parameters'>;

/** The inputs of the whole bus model: also the battery charge. */
export type ElectricalStateInputs = Pick<PhysicsInputs, 'controls' | 'parameters' | 'quantities'>;

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

function baseOf(id: string): number {
  const def = DA50RG_QUANTITIES.get(id);
  if (def === undefined) throw new Error(`electrical needs the quantity "${id}"`);
  return def.base;
}

/** The main load, carried by alternator 1 alone with ESS BUS off: the base of the Amps reading. */
const MAIN_LOAD_A = baseOf('alt1_amps');
/** The additional loads (RACC), carried by alternator 2 alone: the base of its hidden Amps. */
const RACC_LOAD_A = baseOf('alt2_amps');
/** With ESS BUS on and both alternators online the main load is shared in these parts (E-06). */
const SHARE_PARTS = 2;
/** The regulated bus voltage while an alternator carries the essential bus. */
const REGULATED_V = baseOf('bus_volts');
/** Bus volts on the battery alone: this plus BATTERY_VOLTS_SPAN at a full battery. */
const BATTERY_VOLTS_FLOOR = 22;
const BATTERY_VOLTS_SPAN = 4;
/** The target of a dead bus lies this far below the scale minimum (so the clamp lands on it). */
const DEAD_BUS_UNDERSHOOT_V = 1;
/** Battery charge per minute with an alternator supply, and the compressed discharge without one. */
const BATTERY_CHARGE_PER_MIN = 10;
const BATTERY_DISCHARGE_PER_MIN = 25;
const PERCENT = 100;

/** The derived state of the whole electrical system at one step. */
export interface ElectricalState {
  readonly alt1Online: boolean;
  readonly alt2Online: boolean;
  /** Both tie breakers in: the path between the main and the essential bus. */
  readonly tiePath: boolean;
  /** ESS BUS on with ELECT. MASTER on and a live master control line (E-01). */
  readonly tieEnergised: boolean;
  /** The main-to-essential contact of the tie relay: closed exactly when the coil is not energised. */
  readonly tieClosed: boolean;
  readonly batteryBus: boolean;
  /** The hot bus keeps the battery whatever the master does. */
  readonly hot: boolean;
  /** The battery reaches the essential bus: battery bus live and cb.batt in. */
  readonly batteryFeed: boolean;
  readonly main: boolean;
  readonly essential: boolean;
  readonly avionics: boolean;
  readonly ecuA: boolean;
  readonly ecuB: boolean;
  readonly mainPump: boolean;
  readonly emergPump: boolean;
  /** The additional loads, hung on alternator 2, shed by ESS BUS on. */
  readonly racc: boolean;
  /** An alternator carries the essential bus. */
  readonly alternatorOnEssential: boolean;
  readonly alt1Amps: number;
  readonly alt2Amps: number;
  readonly busVolts: number;
  readonly batteryPerMinute: number;
}

/**
 * The electrical state from Figure 1 and the wiring diagrams (E-01 to E-06, E-09 to E-11).
 * `engineRunning` is the engine state of the physics (ENGINE MASTER on and fuel not cut).
 */
export function electricalState(
  inputs: ElectricalStateInputs,
  engineRunning: boolean,
): ElectricalState {
  const on = (control: string): boolean => stateOf(inputs, control) === 'on';
  const inBreaker = (name: string): boolean => stateOf(inputs, `cb.${name}`) === 'in';
  const charge = inputs.quantities['battery_pct'];
  if (charge === undefined) throw new Error('electrical reads the quantity "battery_pct"');

  const alt1Online = alternatorOnline(inputs, 1, engineRunning);
  const alt2Online = alternatorOnline(inputs, 2, engineRunning);
  const essOn = on('sw.ess_bus');
  const electOn = on('sw.elect_master');
  const engineMaster = on('sw.engine_master');

  const tiePath = inBreaker('ess_tie') && inBreaker('main_tie');
  const batteryBus = electOn && charge > 0;
  const hot = charge > 0;
  const batteryFeed = batteryBus && inBreaker('batt');

  // The master control line of the tie relay coil: alternator 2's output, or the 2 A line from the
  // essential bus. The essential bus is taken without alternator 2's help, so nothing is circular.
  const essentialWithoutAlt2 = batteryFeed || (tiePath && alt1Online);
  const tieEnergised =
    essOn && electOn && (alt2Online || (inBreaker('master_ctrl') && essentialWithoutAlt2));
  const tieClosed = !tieEnergised;

  const alternatorOnMain = alt1Online || (alt2Online && tieEnergised);
  const main = alternatorOnMain || (tieClosed && tiePath && batteryFeed);
  const alternatorOnEssential = tiePath && alternatorOnMain;
  const essential = batteryFeed || alternatorOnEssential;

  const avionics =
    main && on('sw.av_master') && inBreaker('av_bus') && inBreaker('master_ctrl') && essential;
  const ecuA = engineMaster && inBreaker('ecu_a') && (essential || on('sw.alternator_1'));
  const mainPump = engineMaster && inBreaker('main_pump') && (essential || on('sw.alternator_1'));
  const ecuB = engineMaster && inBreaker('ecu_b') && (main || alt2Online);
  const emergPump = on('sw.emerg_fuel_pump') && inBreaker('emerg_pump') && (main || alt2Online);
  const racc = alt2Online && !essOn;

  // E-06: alternator 1 carries the main load alone with ESS BUS off; with ESS BUS on the load is
  // shared (one alternator alone carries all of it). RACC hangs on alternator 2 with ESS BUS off.
  const shared = alt1Online && alt2Online;
  const alt1Load = essOn ? (shared ? MAIN_LOAD_A / SHARE_PARTS : MAIN_LOAD_A) : MAIN_LOAD_A;
  const alt2Load = essOn ? (shared ? MAIN_LOAD_A / SHARE_PARTS : MAIN_LOAD_A) : RACC_LOAD_A;
  const alt1Amps = alt1Online ? alt1Load * parameterOf(inputs, 'alt1_output') : 0;
  const alt2Amps = alt2Online ? alt2Load * parameterOf(inputs, 'alt2_output') : 0;

  // E-05: the Volts bar reads the essential bus.
  const deadBusV = (): number => {
    const def = DA50RG_QUANTITIES.get('bus_volts');
    if (def === undefined) throw new Error('electrical needs the quantity "bus_volts"');
    return def.min - DEAD_BUS_UNDERSHOOT_V;
  };
  const busVolts = alternatorOnEssential
    ? REGULATED_V
    : batteryFeed
      ? BATTERY_VOLTS_FLOOR + (BATTERY_VOLTS_SPAN * charge) / PERCENT
      : deadBusV();

  // The battery charges while an alternator carries the essential bus through cb.batt (also when
  // flat), drains while it carries the essential bus alone, and keeps its charge otherwise.
  const batteryPerMinute =
    electOn && inBreaker('batt') && alternatorOnEssential
      ? BATTERY_CHARGE_PER_MIN
      : batteryFeed && !alternatorOnEssential
        ? -BATTERY_DISCHARGE_PER_MIN
        : 0;

  return Object.freeze({
    alt1Online,
    alt2Online,
    tiePath,
    tieEnergised,
    tieClosed,
    batteryBus,
    hot,
    batteryFeed,
    main,
    essential,
    avionics,
    ecuA,
    ecuB,
    mainPump,
    emergPump,
    racc,
    alternatorOnEssential,
    alt1Amps,
    alt2Amps,
    busVolts,
    batteryPerMinute,
  });
}
