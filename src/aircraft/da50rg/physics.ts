import { interpolate } from '../../engine/curve';
import { definePhysics } from '../../engine/physics';
import type { PhysicsInputs, QuantityModel } from '../../engine/physics';
import { travelPercent } from '../../engine/predicates';
import type { DetentLeverDef } from '../../engine/registry';
import { DEFAULT_SCALE, STEP_MS, quantise } from '../../engine/sim';
import { DEICE_HIGH_GPH, DEICE_NORM_GPH } from './deice-endurance';
import { acuFault, electricalState } from './electrical';
import { DEICE_MAX_ACTIVE, WINDSHIELD_PROTECT_ACTIVE, WINDSHIELD_SPRAY_ACTIVE } from './indicators';
import { DA50RG } from './panel';
import { OIL_TEMP_RISE_RATE_CURVE } from './oil-temp-curve';
import { PROP_SPEED_CURVE } from './prop-curve';
import { DA50RG_QUANTITIES } from './quantities';

// DA50 RG physics (D-01, D-02, D-10, D-12, C-03, C-05, C-09): how the named quantities move during
// a run. Aircraft behaviour, never a scenario fact: a scenario only sets a parameter such as the
// oil cooling. Every model is anchored (C-09): at the registry defaults with normal parameters its
// target equals the quantity's base value (quantities.ts), so the base is the equilibrium and the
// free panel and every untouched run stay put. The time constants are compressed (a few seconds to
// tens of seconds, against minutes in the real engine) so that a scenario resolves in one to five
// minutes: a training-aid choice stated here, once. The oil temperature lag may be sped up further
// by a rate (oil-temp-curve.ts): a rising oil temperature follows its target at a speed that depends
// on its own reading, fast below the red band and slow in and above it. All constants are an
// instructor-review item (RESEARCH A1, A3), not measured values. No AFM wording; only + - * /
// (RESEARCH Pitfall 1).

// The outside air temperature is the parameter oat_c (normal 15 degrees C); the engine-off targets of
// the oil, the coolant and the gearbox and the fuel temperatures follow it (Phase 6, D-04c).
/** Heat the oil must shed with the power at 0 % and per unit of load (0 to 1). */
const HEAT_BASE = 20;
const HEAT_PER_LOAD = 80;
/** An open cowl flap multiplies the oil cooling by this factor. */
const COWL_OPEN_COOLING = 1.3;
/** Oil temperature time constant, compressed. */
const OIL_TEMP_TAU_MS = 60_000;
/**
 * How many times faster than the time constant a falling oil temperature follows its target: the
 * plain lag. With POWER down and the cowl flap open the ENG OIL TEMP message goes out within a
 * second when the pilot acts as it shows, about 40 s later from 139 degrees, and the reading is back
 * in green after about 70 s from the message and about 110 s from 139 degrees (instructor-review
 * values, measured by simulation in tests/sim.test.ts). A rising temperature uses
 * OIL_TEMP_RISE_RATE_CURVE instead.
 */
const OIL_TEMP_RECOVERY_RATE = 1;

// Time constants of the other quantities, compressed like the oil temperature.
const RPM_TAU_MS = 2_000;
const LOAD_TAU_MS = 1_000;
const OIL_PRESSURE_TAU_MS = 2_000;
const COOLANT_TAU_MS = 40_000;
const GEARBOX_TAU_MS = 60_000;
const FUEL_TEMP_TAU_MS = 60_000;
/** The resolution of the fuel flow reading, 1 / scale gph (the default scale of the quantity). */
const FUEL_FLOW_SCALE = DA50RG_QUANTITIES.get('fuel_flow_gph')?.scale ?? DEFAULT_SCALE;
const FUEL_PRESSURE_TAU_MS = 1_000;
const AMPS_TAU_MS = 1_500;
const VOLTS_TAU_MS = 1_000;

// Effects of the POWER load, per percent of travel away from the cruise load. The engine speed
// is not among them: it follows the propeller set curve (prop-curve.ts).
const OIL_PRESSURE_PER_PERCENT = 0.01;
const COOLANT_PER_PERCENT = 0.3;
const GEARBOX_PER_PERCENT = 0.3;

/**
 * The left fuel tank settles this many degrees above the outside air temperature (owner,
 * 2026-10-28, D-04c). The right tank settles `fuel_temp_delta_c` below the left one: the delta is a
 * parameter a situation sets (normal 3 degrees, the owner range is 2 to 5, other situations may
 * reverse it), never a constant of the model. Instructor-review data.
 */
export const FUEL_TEMP_LH_OFFSET_C = 8;
/** An open cowl flap cools the coolant by this many degrees. */
const COWL_OPEN_COOLANT_DROP = 10;

/** The EMERG FUEL PUMP adds this pressure while it has power, with the engine running or not. */
const EMERG_PUMP_BAR = 0.3;

/**
 * Fuel flow while the engine runs, US gallons per hour, linear in the load (POWER travel in
 * percent): burn = BASE + PER_PERCENT * load. Fitted to two readings of the owner (first live test,
 * 2026-10-23): 10.1 gph at 60 % load and 11.8 gph at 75 % load. Tunable data: change a reading
 * here and the line follows (the owner tunes these during the beta). The burn leaves the left tank
 * at real time (not compressed); the model takes gallons per minute, so the flow is divided by
 * MINUTES_PER_HOUR. The MFD has no fuel flow readout; if one is added it reads this value in gph.
 */
const FUEL_FLOW_LOW_POINT = { loadPercent: 60, gph: 10.1 };
const FUEL_FLOW_HIGH_POINT = { loadPercent: 75, gph: 11.8 };
const FUEL_FLOW_PER_PERCENT_GPH =
  (FUEL_FLOW_HIGH_POINT.gph - FUEL_FLOW_LOW_POINT.gph) /
  (FUEL_FLOW_HIGH_POINT.loadPercent - FUEL_FLOW_LOW_POINT.loadPercent);
const FUEL_FLOW_BASE_GPH =
  FUEL_FLOW_LOW_POINT.gph - FUEL_FLOW_PER_PERCENT_GPH * FUEL_FLOW_LOW_POINT.loadPercent;
const MINUTES_PER_HOUR = 60;
/**
 * The supply flow of the fuel pump to the engine rail, US gallons per hour, present while the
 * engine runs (D-04a). The engine burns only part of it; the rest returns to the LEFT tank, whatever
 * the FUEL selector says. Above the burn at full POWER (14.6 gph) so the return is never negative.
 * Instructor-review data, not an owner figure.
 */
export const FUEL_SUPPLY_GPH = 30;
/**
 * FUEL TRANS moves this much from the right tank to the left one, gallons per minute: 1 gal/min is
 * exactly the 60 US gal/h of the owner (D-04b). It stops when the right tank is empty or the left
 * tank is full.
 */
export const FUEL_TRANSFER_PER_MIN = 1;

// Engine fire (plan 03-08, C-44): aircraft behaviour, compressed, an instructor-review item (RESEARCH
// A1). The fire intensity (0 to 100) moves toward the product of the scenario's fire parameter,
// the full scale and a fuel-feed factor. The feed is high while the engine runs, higher with the
// EMERG FUEL PUMP on, lower with the pump alone, and zero once the fuel is cut (ENGINE MASTER off
// or the FUEL selector OFF cuts the engine, so only the pump can still feed; the selector OFF cuts
// that too). The pump feeds the fire only while it has power, which the battery gives it through the
// closed tie relay with ELECT. MASTER on and ESS BUS off. The fire adds heat to the oil, the coolant
// and the gearbox in proportion to its intensity, at most these many degrees.
const FIRE_TAU_MS = 30_000;
const FIRE_FEED_RUNNING = 0.9;
const FIRE_FEED_RUNNING_PUMP = 1;
const FIRE_FEED_PUMP_ONLY = 0.6;
const FIRE_OIL_RISE = 30;
const FIRE_COOLANT_RISE = 30;
const FIRE_GEARBOX_RISE = 40;

// Cabin smoke (Phase 5, C-02; ventilation and the source switch from Phase 5.1): the hidden smoke
// density (0 to 100) lags toward the full scale times the scenario parameter smoke_source while
// ELECT. MASTER is on, and toward 0 once it is off (the electrical source is gone). The build-up
// has the plain time constant. The clearing runs SMOKE_CLEAR_BASE times as fast, plus
// SMOKE_CLEAR_FRESH_AIR with CIRCULATING AIR at fresh, plus SMOKE_CLEAR_WINDOW with the emergency
// window open, so at most 3 times as fast. Compressed, instructor-review values.
const SMOKE_TAU_MS = 15_000;
const SMOKE_CLEAR_BASE = 1;
const SMOKE_CLEAR_FRESH_AIR = 1;
const SMOKE_CLEAR_WINDOW = 1;

// Windscreen ice (Phase 5, C-04; the end of the icing area and the lasting spray from Phase 5.1)
// and the WIND SHIELD spray. All values are instructor-review values, none is an AFM figure. Per
// half of the windscreen the ice (0 to 100) grows by ICE_ACCRETE_PER_MIN times the parameter
// ice_accretion. The icing area ends: the hidden icing_exposure (0 to 100) runs while the
// parameter is above 0 and is full after ICING_AREA_MS of run time, and once it is full the ice
// stops growing on both sides (owner, 2026-10-27; "leave the icing area" stays a display row).
// Ice already on the glass melts only by warm air toward the windscreen (DIRECTION at DEFROST,
// TEMPERATURE at 75 or WARM), very slowly (ICE_WARM_CLEAR_PER_MIN), or by the spray. Pressing WIND
// SHIELD sprays the pilot side (the left half) for WINDSHIELD_SPRAY_MS: the airflow carries the
// fluid upward and the ice on that side is gone directly, within about a second
// (ICE_SPRAY_CLEAR_PER_MIN). The same press arms a protection of WINDSHIELD_PROTECT_MS (owner,
// 2026-10-27: the pilot side stays clear for several minutes): the pilot side takes no ice for that
// long, so after the area has ended it stays clear for the rest of a normal run. The co-pilot side
// is untouched by the press and keeps its ice until warm air melts it.
const ICE_ACCRETE_PER_MIN = 40;
const ICE_WARM_CLEAR_PER_MIN = 6;
const ICE_SPRAY_CLEAR_PER_MIN = 6_000;
/**
 * The stall heat timer counts one second per second while the PITOT/STALL HEAT switch is on and the
 * aircraft is on the ground (H-02), and falls back to 0 within one step otherwise: in the air, or with
 * the switch off, the ground cut-out message goes at once. The reset rate is the whole range (60 s)
 * per step (STEP_MS), the clamp holds the reading at 0.
 */
const STALL_HEAT_COUNT_PER_MIN = 60;
const STALL_HEAT_RESET_PER_MIN = (60 * 60_000) / STEP_MS;
export const WINDSHIELD_SPRAY_MS = 10_000;
const WINDSHIELD_PROTECT_MS = 600_000;
const MS_PER_MINUTE = 60_000;
/** The icing area lasts this long (run time); the exposure quantity fills its 0 to 100 in that time. */
const ICING_AREA_MS = 180_000;
const ICING_EXPOSURE_FULL = 100;
/** The exposure counts as full from here: a margin below the top for the quantisation of the rate. */
const ICING_EXPOSURE_DONE_AT = 99.9;

// Oil on the windscreen (Phase 5, C-06): the oil film (0 to 100) grows by OIL_FILM_PER_MIN times the
// scenario parameter oil_leak while the engine runs and never decays. An instructor-review value.
const OIL_FILM_PER_MIN = 30;

// Ground roll (Phase 5.1, P-03): the speed over the ground follows the POWER travel and the
// brakes. All values are instructor-review values, none is an AFM figure. Only a scenario that
// sets ground_roll gets the model; every other run holds the speed it starts with.
/** Acceleration in knots per second per percent of POWER travel while the engine runs. */
const GROUND_ACCEL_PER_PERCENT = 0.02;
/** Rolling and air drag in knots per second, running and engine off. */
const GROUND_DRAG_RUNNING = 0.3;
const GROUND_DRAG_STOPPED = 0.6;
/** Braking in knots per second while the toe brakes are applied or the parking brake is set. */
const GROUND_BRAKING = 4;
const SECONDS_PER_MINUTE = 60;

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

function parameterOf(inputs: Pick<PhysicsInputs, 'parameters'>, id: string): number {
  const value = Object.hasOwn(inputs.parameters, id) ? inputs.parameters[id] : undefined;
  if (value === undefined) throw new Error(`physics reads parameter "${id}" which is not set`);
  return value;
}

function quantityOf(inputs: PhysicsInputs, id: string): number {
  const value = Object.hasOwn(inputs.quantities, id) ? inputs.quantities[id] : undefined;
  if (value === undefined) throw new Error(`physics reads quantity "${id}" which has no value`);
  return value;
}

/** The base value of a quantity: its reading at the registry defaults (the anchor of C-09). */
function baseOf(id: string): number {
  const def = DA50RG_QUANTITIES.get(id);
  if (def === undefined) throw new Error(`physics needs the quantity "${id}"`);
  return def.base;
}

/** The upper bound of a band of a quantity, for example the top of the green fuel range. */
function bandTop(quantity: string, band: string): number {
  const found = DA50RG_QUANTITIES.get(quantity)?.bands.find((b) => b.id === band);
  if (found === undefined) throw new Error(`physics needs band "${band}" of "${quantity}"`);
  return found.to;
}

/** The POWER travel at the registry default: the cruise load every base value belongs to. */
const CRUISE_PERCENT = travelPercent(POWER, POWER.default);

/** The outside air temperature of the situation, degrees C (the parameter oat_c). */
function outsideAirC(inputs: PhysicsInputs): number {
  return parameterOf(inputs, 'oat_c');
}

const LEFT_TANK = 'fuel_qty_lh_gal';
const RIGHT_TANK = 'fuel_qty_rh_gal';

/**
 * The tank the engine draws from, by the FUEL selector: NORMAL the left tank, EMERGENCY the right
 * tank, OFF none (owner, D-04a).
 */
function drawnTank(inputs: PhysicsInputs): typeof LEFT_TANK | typeof RIGHT_TANK | null {
  const selector = stateOf(inputs, 'sw.fuel_valve');
  if (selector === 'normal') return LEFT_TANK;
  if (selector === 'emergency') return RIGHT_TANK;
  return null;
}

/**
 * No fuel reaches the engine and the EMERG FUEL PUMP: the FUEL selector is OFF, or the tank it picks
 * is empty (starvation, D-04). The engine comes back at once when fuel is available again; no relight
 * procedure is modelled.
 */
function fuelCut(inputs: PhysicsInputs): boolean {
  const tank = drawnTank(inputs);
  return tank === null || quantityOf(inputs, tank) <= 0;
}

/** Engine running: ENGINE MASTER on and the FUEL selector not OFF (NORMAL and EMERGENCY feed alike). */
function running(inputs: PhysicsInputs): boolean {
  return stateOf(inputs, 'sw.engine_master') === 'on' && !fuelCut(inputs);
}

/** POWER travel in percent while running, else 0. */
function loadPercent(inputs: PhysicsInputs): number {
  return running(inputs) ? travelPercent(POWER, stateOf(inputs, 'lv.power')) : 0;
}

/** The whole electrical state at this step (E-01 to E-11): electrical.ts, one function for all. */
function electrical(inputs: PhysicsInputs) {
  return electricalState(inputs, running(inputs));
}

/**
 * The EMERG FUEL PUMP has power: its switch is on, its breaker is in and the main bus is live
 * (electrical.ts, E-11). With the engine stopped the battery gives it that through the closed tie
 * relay while ELECT. MASTER is on and ESS BUS off.
 */
function pumpPowered(inputs: PhysicsInputs): boolean {
  return electrical(inputs).emergPump;
}

/** The full scale of the fire intensity: the top of its one band. */
const FIRE_FULL = bandTop('fire_intensity', 'unmarked');

/** The fire intensity as a share of its full scale, 0 to 1. */
function fireShare(inputs: PhysicsInputs): number {
  return quantityOf(inputs, 'fire_intensity') / FIRE_FULL;
}

/** How well fuel feeds the fire: see the constants above. */
function fireFeed(inputs: PhysicsInputs): number {
  if (fuelCut(inputs)) return 0;
  const pump = pumpPowered(inputs);
  if (running(inputs)) return pump ? FIRE_FEED_RUNNING_PUMP : FIRE_FEED_RUNNING;
  return pump ? FIRE_FEED_PUMP_ONLY : 0;
}

/** The full scale of the smoke density: the top of its one band. */
const SMOKE_FULL = bandTop('smoke_density', 'unmarked');

function smokeTarget(inputs: PhysicsInputs): number {
  if (stateOf(inputs, 'sw.elect_master') !== 'on') return 0;
  return SMOKE_FULL * parameterOf(inputs, 'smoke_source');
}

/**
 * The rate of the smoke lag: the build-up is the plain lag, the clearing (the target below the
 * reading) is faster with fresh air and with the open emergency window.
 */
function smokeRate(inputs: PhysicsInputs): number {
  if (smokeTarget(inputs) >= quantityOf(inputs, 'smoke_density')) return 1;
  const fresh = stateOf(inputs, 'lv.env_circ') === 'fresh' ? SMOKE_CLEAR_FRESH_AIR : 0;
  const windowOpen = stateOf(inputs, 'sw.emerg_window') === 'open' ? SMOKE_CLEAR_WINDOW : 0;
  return SMOKE_CLEAR_BASE + fresh + windowOpen;
}

/** Warm air toward the windscreen: DIRECTION at DEFROST with TEMPERATURE at 75 or WARM. */
function warmAirToWindscreen(inputs: PhysicsInputs): boolean {
  const temperature = stateOf(inputs, 'lv.env_temp');
  return (
    stateOf(inputs, 'lv.env_direction') === 'defrost' &&
    (temperature === 't75' || temperature === 'warm')
  );
}

/** Exposure to icing per minute: the full scale over the icing area, while the parameter is above 0. */
function icingExposurePerMinute(inputs: PhysicsInputs): number {
  if (parameterOf(inputs, 'ice_accretion') <= 0) return 0;
  return (ICING_EXPOSURE_FULL * MS_PER_MINUTE) / ICING_AREA_MS;
}

/** True once the aircraft has been in the icing area for its whole length: no more ice grows. */
function icingAreaEnded(inputs: PhysicsInputs): boolean {
  return quantityOf(inputs, 'icing_exposure') >= ICING_EXPOSURE_DONE_AT;
}

/** Ice change per minute on one half of the windscreen; `pilot` is the left half, the one the spray reaches. */
function icePerMinute(inputs: PhysicsInputs, pilot: boolean): number {
  if (pilot && inputs.flags[WINDSHIELD_SPRAY_ACTIVE] === true) return -ICE_SPRAY_CLEAR_PER_MIN;
  const protectedSide = pilot && inputs.flags[WINDSHIELD_PROTECT_ACTIVE] === true;
  const growing = icingAreaEnded(inputs) || protectedSide;
  const accretion = growing ? 0 : ICE_ACCRETE_PER_MIN * parameterOf(inputs, 'ice_accretion');
  const warm = warmAirToWindscreen(inputs) ? ICE_WARM_CLEAR_PER_MIN : 0;
  return accretion - warm;
}

function fireTarget(inputs: PhysicsInputs): number {
  return FIRE_FULL * parameterOf(inputs, 'engine_fire') * fireFeed(inputs);
}

/**
 * The temperature the oil settles at: the heat to shed (rising with the POWER load) divided by
 * the cooling (the parameter, raised by an open cowl flap). With the engine master off the oil
 * cools toward ambient. Cases (cooling 1, POWER 70 %, cowl closed) give 91 degrees C, the base
 * value (a green cruise value); a degraded cooling with POWER 75 % and the cowl closed settles
 * above the red range.
 */
function oilTempTarget(inputs: PhysicsInputs): number {
  const fire = FIRE_OIL_RISE * fireShare(inputs);
  if (!running(inputs)) return outsideAirC(inputs) + fire;
  const load = travelPercent(POWER, stateOf(inputs, 'lv.power')) / 100;
  const flap = stateOf(inputs, 'lv.cowl_flap') === 'open' ? COWL_OPEN_COOLING : 1;
  const cooling = parameterOf(inputs, 'oil_cooling') * flap;
  return outsideAirC(inputs) + (HEAT_BASE + HEAT_PER_LOAD * load) / cooling + fire;
}

/**
 * Engine speed: the propeller set curve at the POWER lever position (the propeller is governed, so
 * the lever alone sets the speed; it falls first, then rises); 0 with the engine off. At the
 * registry default lever the curve gives the base value, the equilibrium of C-09.
 */
function rpmTarget(inputs: PhysicsInputs): number {
  if (!running(inputs)) return 0;
  return interpolate(PROP_SPEED_CURVE, loadPercent(inputs));
}

function oilPressureTarget(inputs: PhysicsInputs): number {
  if (!running(inputs)) return 0;
  return (
    baseOf('oil_pressure_bar') + (loadPercent(inputs) - CRUISE_PERCENT) * OIL_PRESSURE_PER_PERCENT
  );
}

/** Coolant: warmer with the load, cooler with the cowl flap open, toward ambient with the engine off. */
function coolantTarget(inputs: PhysicsInputs): number {
  const fire = FIRE_COOLANT_RISE * fireShare(inputs);
  if (!running(inputs)) return outsideAirC(inputs) + fire;
  const cowl = stateOf(inputs, 'lv.cowl_flap') === 'open' ? COWL_OPEN_COOLANT_DROP : 0;
  return (
    baseOf('coolant_temp_c') +
    (loadPercent(inputs) - CRUISE_PERCENT) * COOLANT_PER_PERCENT -
    cowl +
    fire
  );
}

function gearboxTarget(inputs: PhysicsInputs): number {
  const fire = FIRE_GEARBOX_RISE * fireShare(inputs);
  if (!running(inputs)) return outsideAirC(inputs) + fire;
  return (
    baseOf('gearbox_temp_c') + (loadPercent(inputs) - CRUISE_PERCENT) * GEARBOX_PER_PERCENT + fire
  );
}

/** A fuel temperature limit: the top of the first red band (minimum) or of the second yellow band (maximum). */
const FUEL_TEMP_MIN_C = bandTop('fuel_temp_lh_c', 'low_red');
const FUEL_TEMP_MAX_C = bandTop('fuel_temp_lh_c', 'high_yellow');

/** A derived fuel temperature never enters a red zone by itself: it is held to the limits. */
function withinFuelTempLimits(celsius: number): number {
  if (celsius < FUEL_TEMP_MIN_C) return FUEL_TEMP_MIN_C;
  return celsius > FUEL_TEMP_MAX_C ? FUEL_TEMP_MAX_C : celsius;
}

/** Left tank: the outside air temperature plus the offset (D-04c). */
function fuelTempLeftC(inputs: PhysicsInputs): number {
  return outsideAirC(inputs) + FUEL_TEMP_LH_OFFSET_C;
}

/** Right tank: the left tank less the situation's delta; a negative delta puts the right tank above. */
function fuelTempRightC(inputs: PhysicsInputs): number {
  return fuelTempLeftC(inputs) - parameterOf(inputs, 'fuel_temp_delta_c');
}

/**
 * Fuel pressure: the engine pump while running, plus the EMERG FUEL PUMP, which also works alone
 * but needs power (a live main bus) and has no fuel to push with the FUEL selector OFF.
 */
function fuelPressureTarget(inputs: PhysicsInputs): number {
  const engine = running(inputs) ? baseOf('fuel_pressure_bar') : 0;
  const pump = pumpPowered(inputs) && !fuelCut(inputs) ? EMERG_PUMP_BAR : 0;
  return engine + pump;
}

/** The capacity of a tank: the top of its quantity range (quantities.ts, TANK_CAPACITY_GAL). */
function capacityOf(quantity: string): number {
  const def = DA50RG_QUANTITIES.get(quantity);
  if (def === undefined) throw new Error(`physics needs the quantity "${quantity}"`);
  return def.max;
}

/**
 * Gallons per minute moved from the right to the left tank: FUEL TRANS on, the right tank above 0
 * and the left tank below its capacity. The pump does not read the electrical state (the pump bus
 * and breaker are not modelled).
 */
function fuelTransferPerMinute(inputs: PhysicsInputs): number {
  if (stateOf(inputs, 'sw.fuel_trans') !== 'on') return 0;
  if (quantityOf(inputs, RIGHT_TANK) <= 0) return 0;
  if (quantityOf(inputs, LEFT_TANK) >= capacityOf(LEFT_TANK)) return 0;
  return FUEL_TRANSFER_PER_MIN;
}

/** Fuel flow in US gallons per hour: linear in the POWER load while running, 0 with the engine stopped. */
function fuelFlowGph(inputs: PhysicsInputs): number {
  if (!running(inputs)) return 0;
  return FUEL_FLOW_BASE_GPH + FUEL_FLOW_PER_PERCENT_GPH * loadPercent(inputs);
}

/** The burn in gallons per minute, the unit of the rate model of the tanks. */
function fuelBurnPerMinute(inputs: PhysicsInputs): number {
  return fuelFlowGph(inputs) / MINUTES_PER_HOUR;
}

/** The supply flow of the pump in gallons per minute: constant while the engine runs, else 0. */
function fuelSupplyPerMinute(inputs: PhysicsInputs): number {
  return running(inputs) ? FUEL_SUPPLY_GPH / MINUTES_PER_HOUR : 0;
}

/**
 * The return flow in gallons per minute: supply less burn, back into the LEFT tank while it has
 * room (below its capacity), else none.
 */
function fuelReturnPerMinute(inputs: PhysicsInputs): number {
  if (quantityOf(inputs, LEFT_TANK) >= capacityOf(LEFT_TANK)) return 0;
  const supply = fuelSupplyPerMinute(inputs);
  const burn = fuelBurnPerMinute(inputs);
  return supply > burn ? supply - burn : 0;
}

/**
 * What the drawn tank loses per minute: the whole supply flow that left it, which is the burn plus
 * the return (more than the displayed fuel flow on EMERGENCY). 0 for a tank that is not drawn.
 */
function fuelDrawnLossPerMinute(inputs: PhysicsInputs, tank: string): number {
  if (drawnTank(inputs) !== tank) return 0;
  return fuelBurnPerMinute(inputs) + fuelReturnPerMinute(inputs);
}

/**
 * The change of the left tank in gallons per minute. Drawn (NORMAL): its loss and its own return
 * cancel, so it falls by the burn alone. Not drawn: it gains the return flow. Plus the FUEL TRANS
 * pump. A leak adds one more term here later.
 */
function fuelLeftPerMinute(inputs: PhysicsInputs): number {
  const flow =
    drawnTank(inputs) === LEFT_TANK ? -fuelBurnPerMinute(inputs) : fuelReturnPerMinute(inputs);
  return flow + fuelTransferPerMinute(inputs);
}

/** The change of the right tank in gallons per minute: its loss when drawn, less the FUEL TRANS pump. */
function fuelRightPerMinute(inputs: PhysicsInputs): number {
  return -fuelDrawnLossPerMinute(inputs, RIGHT_TANK) - fuelTransferPerMinute(inputs);
}

/** Change of the stall heat timer in seconds per minute: 60 on the ground with the heat on, else a reset. */
function stallHeatTimerPerMinute(inputs: PhysicsInputs): number {
  const heatOn = stateOf(inputs, 'sw.pitot_stall_heat') === 'on';
  const onGround = parameterOf(inputs, 'ground_roll') > 0;
  return heatOn && onGround ? STALL_HEAT_COUNT_PER_MIN : -STALL_HEAT_RESET_PER_MIN;
}

/** Change of the ground speed in knots per minute: zero unless the scenario sets ground_roll. */
function groundSpeedPerMinute(inputs: PhysicsInputs): number {
  const roll = parameterOf(inputs, 'ground_roll');
  const drag = running(inputs) ? GROUND_DRAG_RUNNING : GROUND_DRAG_STOPPED;
  const braked =
    stateOf(inputs, 'lv.toe_brakes') === 'applied' || stateOf(inputs, 'lv.parking_brake') === 'set';
  const braking = braked ? GROUND_BRAKING : 0;
  return (
    roll * SECONDS_PER_MINUTE * (GROUND_ACCEL_PER_PERCENT * loadPercent(inputs) - drag - braking)
  );
}

// Flight (Phase 6, plan 03; D-08, D-09, V-01 to V-04): the quantities of the PFD (airspeed, vertical
// speed, altitude, pitch and bank) follow a scripted flight state, not an aerodynamic model. The
// situation is data of the scenario (its profile: the parameters flagged `profile` below); the
// models only move the readings toward it with the time constants here. Three regimes: on the
// ground (the parameter ground_roll is above 0) the airspeed is the ground speed and the rest is
// level; in flight with the engine running the targets are the flight_* parameters; with the engine
// stopped (ENGINE MASTER off, the FUEL selector OFF or the drawn tank empty) they are the glide_*
// ones. Nothing else moves them, in particular not the POWER lever. Compressed, instructor-review
// values, none is an AFM figure. The free panel is static: at the normal parameters with the engine
// running every flight quantity holds its base (C-09).
/** The airspeed follows its target with this time constant in flight. */
const AIRSPEED_TAU_MS = 5_000;
/**
 * On the ground the airspeed follows the ground speed within one step: this rate times STEP_MS is
 * the time constant, so the step fraction is exactly 1 (the behaviour since Phase 5.1).
 */
const AIRSPEED_GROUND_RATE = AIRSPEED_TAU_MS / STEP_MS;
const VERTICAL_SPEED_TAU_MS = 3_000;
const ATTITUDE_TAU_MS = 2_000;

/**
 * Pitch target (V-04): the flight-path angle plus an angle of attack that grows as the speed falls
 * below the cruise speed. Feet per minute per knot per degree of flight path: 6076.12 ft per nautical
 * mile, divided by 60 minutes, times the sine of one degree (0.017452) = 1.7675.
 */
export const PITCH_FPM_PER_KT_DEG = 1.7675;
/** The speed in the flight-path division never falls below this (knots), so the division is safe. */
export const PITCH_MIN_SPEED_KT = 40;
/** Degrees of nose-up pitch for every knot below the cruise speed (the airspeed base). */
export const PITCH_PER_KT = 0.06;

type FlightRegime = 'ground' | 'powered' | 'glide';

function flightRegime(inputs: PhysicsInputs): FlightRegime {
  if (parameterOf(inputs, 'ground_roll') > 0) return 'ground';
  return running(inputs) ? 'powered' : 'glide';
}

/** The vertical speed the situation scripts for the regime, feet per minute (0 on the ground). */
function scriptedVerticalSpeed(inputs: PhysicsInputs): number {
  switch (flightRegime(inputs)) {
    case 'ground':
      return 0;
    case 'powered':
      return parameterOf(inputs, 'flight_vs_fpm');
    case 'glide':
      return parameterOf(inputs, 'glide_vs_fpm');
  }
}

/** The airspeed the situation scripts for the regime, knots (the ground speed on the ground). */
function airspeedTarget(inputs: PhysicsInputs): number {
  switch (flightRegime(inputs)) {
    case 'ground':
      return quantityOf(inputs, 'ground_speed_kt');
    case 'powered':
      return parameterOf(inputs, 'flight_speed_kt');
    case 'glide':
      return parameterOf(inputs, 'glide_speed_kt');
  }
}

function airspeedRate(inputs: PhysicsInputs): number {
  return flightRegime(inputs) === 'ground' ? AIRSPEED_GROUND_RATE : 1;
}

/** True while the aircraft is at or below the terrain: it cannot sink further. */
function atTerrain(inputs: PhysicsInputs): boolean {
  return quantityOf(inputs, 'altitude_ft') <= parameterOf(inputs, 'terrain_ft');
}

/** The vertical speed the aircraft heads for in feet per minute; at the terrain it never sinks. */
function verticalSpeedTarget(inputs: PhysicsInputs): number {
  const target = scriptedVerticalSpeed(inputs);
  return atTerrain(inputs) && target < 0 ? 0 : target;
}

/**
 * The altitude changes by the vertical speed, in feet per minute, but never below the terrain: a
 * fall that would pass it is cut to the fall that ends exactly on it. On the ground it holds.
 */
function altitudePerMinute(inputs: PhysicsInputs): number {
  if (flightRegime(inputs) === 'ground') return 0;
  const above = quantityOf(inputs, 'altitude_ft') - parameterOf(inputs, 'terrain_ft');
  const reach = (-above * MS_PER_MINUTE) / STEP_MS;
  const rate = quantityOf(inputs, 'vertical_speed_fpm');
  return rate < reach ? reach : rate;
}

/**
 * The aircraft is in the air: not on the ground regime, and either above the terrain or climbing.
 * A parked or rolling aircraft, or one that has glided down to the terrain, stands level.
 */
function airborne(inputs: PhysicsInputs): boolean {
  if (flightRegime(inputs) === 'ground') return false;
  return !atTerrain(inputs) || scriptedVerticalSpeed(inputs) > 0;
}

/**
 * The pitch the aircraft heads for in degrees (V-04): the flight-path angle of the scripted vertical
 * speed at the airspeed (floored at PITCH_MIN_SPEED_KT) plus PITCH_PER_KT for every knot below the
 * cruise speed. A level cruise reads 0, a 70 kt climb of 500 fpm about +8 degrees, a 90 kt glide of
 * -700 fpm about -1.4 degrees. Not airborne: 0.
 */
function pitchTarget(inputs: PhysicsInputs): number {
  if (!airborne(inputs)) return 0;
  const speed = quantityOf(inputs, 'airspeed_kt');
  const divisor = speed < PITCH_MIN_SPEED_KT ? PITCH_MIN_SPEED_KT : speed;
  const flightPath = scriptedVerticalSpeed(inputs) / (divisor * PITCH_FPM_PER_KT_DEG);
  return flightPath + PITCH_PER_KT * (baseOf('airspeed_kt') - speed);
}

/** The bank the situation scripts (degrees, positive to the right); 0 on the ground. */
function bankTarget(inputs: PhysicsInputs): number {
  return flightRegime(inputs) === 'ground' ? 0 : parameterOf(inputs, 'flight_bank_deg');
}

/** The de-ice MAX run lasts 120 s of run time (owner finding G-1). */
export const DEICE_MAX_RUN_MS = 120_000;

// The de-ice fluid (Phase 6, plan 02, E-08; the owner's TKS figures of 2026-10-28, D-11): the tank
// quantity deice_qty_gal falls by the flow of the de-ice mode, NORM 3 and HIGH 6 US gal/h (the same
// constants the engine page uses for the endurance, deice-endurance.ts). One MAX activation takes
// 0.4 gal in total over its 120 s run, taking the place of the HIGH flow during the run (open
// owner point: whether the 0.4 gal come on top of the HIGH flow is a one-line change). One WIND
// SHIELD spray takes 40 ml over its 10 s, on top of the mode flow (a separate nozzle). Volumes are
// constants with the unit in the name; the conversion uses + - * / only.
export const DEICE_MAX_ACTIVATION_GAL = 0.4;
export const DEICE_SPRAY_ML = 40;
export const ML_PER_US_GAL = 3785.41;
const DEICE_SPRAY_GAL = DEICE_SPRAY_ML / ML_PER_US_GAL;

/** The fluid flow of the de-ice system in US gallons per minute, negative: the tank empties. */
function deiceFluidPerMinute(inputs: PhysicsInputs): number {
  const mode = stateOf(inputs, 'sw.deice_mode');
  const maxRun = mode === 'high' && inputs.flags[DEICE_MAX_ACTIVE] === true;
  let used = 0;
  if (maxRun) used = DEICE_MAX_ACTIVATION_GAL / (DEICE_MAX_RUN_MS / MS_PER_MINUTE);
  else if (mode === 'high') used = DEICE_HIGH_GPH / MINUTES_PER_HOUR;
  else if (mode === 'norm') used = DEICE_NORM_GPH / MINUTES_PER_HOUR;
  if (inputs.flags[WINDSHIELD_SPRAY_ACTIVE] === true) {
    used += DEICE_SPRAY_GAL / (WINDSHIELD_SPRAY_MS / MS_PER_MINUTE);
  }
  return -used;
}

// A shorted alternator pops its breaker again soon after the pilot pushes it in (phase 3.1, V-09;
// alternator 2 in phase 4, E-08). The 2 s are an instructor-review value, not an AFM figure.
const ALT_SHORT_REPOP_MS = 2_000;

const lag = (
  quantity: string,
  tauMs: number,
  target: (inputs: PhysicsInputs) => number,
  rate?: (inputs: PhysicsInputs) => number,
): QuantityModel => ({
  quantity,
  mode: 'lag',
  tauMs,
  target,
  ...(rate === undefined ? {} : { rate }),
});

/**
 * The rate of the oil temperature lag: the rise reads the curve at the current reading (fast below
 * the red band, slow in and above it), the recovery is the plain lag. Only the sign of the gap to
 * the target selects the branch, so a target equal to the reading counts as a rise (no movement).
 */
function oilTempRate(inputs: PhysicsInputs): number {
  const current = quantityOf(inputs, 'oil_temp_c');
  if (oilTempTarget(inputs) < current) return OIL_TEMP_RECOVERY_RATE;
  return interpolate(OIL_TEMP_RISE_RATE_CURVE, current);
}

export const DA50RG_PHYSICS = definePhysics(
  {
    parameters: [
      // 1 is the normal cooling; a scenario degrades it. The lower bound keeps the divisor positive.
      { id: 'oil_cooling', min: 0.2, max: 1, normal: 1 },
      // 1 is the normal output of alternator 1; 0 is a failed alternator (the electrical scenario).
      { id: 'alt1_output', min: 0, max: 1, normal: 1 },
      // 0 is alternator 1 without a short; above 0 it has one and its breaker pops again (trips).
      { id: 'alt1_short', min: 0, max: 1, normal: 0 },
      // The same two parameters for alternator 2 (E-08).
      { id: 'alt2_output', min: 0, max: 1, normal: 1 },
      { id: 'alt2_short', min: 0, max: 1, normal: 0 },
      // 0 is no fire; 1 is a fire that burns while fuel feeds it (the Engine Fire scenario).
      { id: 'engine_fire', min: 0, max: 1, normal: 0 },
      // 0 is a clear cabin; 1 is a source that fills it with smoke (a scenario of Phase 5.1).
      { id: 'smoke_source', min: 0, max: 1, normal: 0 },
      // 0 is a clear windscreen; 1 is a windscreen that ices over at ICE_ACCRETE_PER_MIN.
      { id: 'ice_accretion', min: 0, max: 1, normal: 0 },
      // 0 is no oil leak; 1 is a leak that smears the windscreen at OIL_FILM_PER_MIN while the engine runs.
      { id: 'oil_leak', min: 0, max: 1, normal: 0 },
      // 0 is an aircraft at rest or in flight (the speed holds); 1 is a ground roll (Phase 5.1).
      { id: 'ground_roll', min: 0, max: 1, normal: 0 },
      // The outside air temperature in degrees C (Phase 6, D-04c); 15 is the normal situation.
      { id: 'oat_c', min: -40, max: 50, normal: 15, profile: true },
      // How much warmer the left fuel tank is than the right one, degrees C: 3 in the normal situation
      // (owner range 2 to 5); other situations may differ or reverse it (negative).
      { id: 'fuel_temp_delta_c', min: -10, max: 10, normal: 3, profile: true },
      // The flight situation (Phase 6, plan 03): properties of the situation from the first second,
      // so a scenario's profile may set them (lint L25). The speed (knots), the vertical speed (feet
      // per minute, positive climbs) and the bank (degrees, positive to the right) of powered flight.
      { id: 'flight_speed_kt', min: 0, max: 200, normal: 140, profile: true },
      { id: 'flight_vs_fpm', min: -2000, max: 2000, normal: 0, profile: true },
      { id: 'flight_bank_deg', min: -60, max: 60, normal: 0, profile: true },
      // The same for the engine stopped; the defaults are instructor-review values, not the AFM
      // best-glide figure, and a scenario may override them.
      { id: 'glide_speed_kt', min: 0, max: 200, normal: 90, profile: true },
      { id: 'glide_vs_fpm', min: -2000, max: 2000, normal: -700, profile: true },
      // The altitude never sinks below this terrain height in feet (the free panel's 1400 ft base).
      { id: 'terrain_ft', min: 0, max: 10000, normal: 1400, profile: true },
    ],
    models: [
      lag('rpm', RPM_TAU_MS, rpmTarget),
      lag('load_pct', LOAD_TAU_MS, loadPercent),
      lag('oil_pressure_bar', OIL_PRESSURE_TAU_MS, oilPressureTarget),
      lag('oil_temp_c', OIL_TEMP_TAU_MS, oilTempTarget, oilTempRate),
      lag('coolant_temp_c', COOLANT_TAU_MS, coolantTarget),
      lag('gearbox_temp_c', GEARBOX_TAU_MS, gearboxTarget),
      lag('fuel_temp_lh_c', FUEL_TEMP_TAU_MS, (inputs) =>
        withinFuelTempLimits(fuelTempLeftC(inputs)),
      ),
      lag('fuel_temp_rh_c', FUEL_TEMP_TAU_MS, (inputs) =>
        withinFuelTempLimits(fuelTempRightC(inputs)),
      ),
      // The reading follows the flow within one step. The target is held to the resolution of the
      // reading, so that at the cruise load it equals the base (11.23) like every other anchor (C-09).
      lag('fuel_flow_gph', STEP_MS, (inputs) => quantise(fuelFlowGph(inputs), FUEL_FLOW_SCALE)),
      { quantity: 'fuel_used_gal', mode: 'rate', perMinute: fuelBurnPerMinute },
      lag('fuel_pressure_bar', FUEL_PRESSURE_TAU_MS, fuelPressureTarget),
      {
        quantity: LEFT_TANK,
        mode: 'rate',
        perMinute: fuelLeftPerMinute,
      },
      {
        quantity: RIGHT_TANK,
        mode: 'rate',
        perMinute: fuelRightPerMinute,
      },
      lag('alt1_amps', AMPS_TAU_MS, (inputs) => electrical(inputs).alt1Amps),
      lag('alt2_amps', AMPS_TAU_MS, (inputs) => electrical(inputs).alt2Amps),
      {
        quantity: 'battery_pct',
        mode: 'rate',
        perMinute: (inputs) => electrical(inputs).batteryPerMinute,
      },
      lag('bus_volts', VOLTS_TAU_MS, (inputs) => electrical(inputs).busVolts),
      // The control unit flags follow the logic in one step (E-07); CAS rules read them as bands.
      lag('alt1_fault', STEP_MS, (inputs) => (acuFault(inputs, 1) ? 1 : 0)),
      lag('alt2_fault', STEP_MS, (inputs) => (acuFault(inputs, 2) ? 1 : 0)),
      // 1 exactly while the transfer pump moves fuel; the FUEL TRANS message reads its band (D-04b).
      lag('fuel_trans_active', STEP_MS, (inputs) => (fuelTransferPerMinute(inputs) > 0 ? 1 : 0)),
      lag('fire_intensity', FIRE_TAU_MS, fireTarget),
      lag('smoke_density', SMOKE_TAU_MS, smokeTarget, smokeRate),
      { quantity: 'icing_exposure', mode: 'rate', perMinute: icingExposurePerMinute },
      { quantity: 'ice_pilot', mode: 'rate', perMinute: (inputs) => icePerMinute(inputs, true) },
      { quantity: 'ice_copilot', mode: 'rate', perMinute: (inputs) => icePerMinute(inputs, false) },
      {
        quantity: 'oil_film',
        mode: 'rate',
        perMinute: (inputs) =>
          running(inputs) ? OIL_FILM_PER_MIN * parameterOf(inputs, 'oil_leak') : 0,
      },
      { quantity: 'ground_speed_kt', mode: 'rate', perMinute: groundSpeedPerMinute },
      // The ground cut-out of the stall heat (H-02): counts while the heat is on and the aircraft rolls
      // or stands on the ground; the message STALL HEAT reads its `cut` band (cas.ts).
      { quantity: 'stall_heat_timer_s', mode: 'rate', perMinute: stallHeatTimerPerMinute },
      // The de-ice fluid of the engine page: the mode flow, the MAX run and the WIND SHIELD spray (E-08).
      { quantity: 'deice_qty_gal', mode: 'rate', perMinute: deiceFluidPerMinute },
      // The flight state of the PFD (Phase 6, plan 03): the regimes above. On the ground the airspeed
      // follows the ground speed within one step (rate AIRSPEED_GROUND_RATE), in flight it lags toward
      // the scripted speed; the vertical speed, pitch and bank lag toward their scripted values and
      // the altitude integrates the vertical speed. The free panel is static (the base values are
      // the equilibrium).
      lag('airspeed_kt', AIRSPEED_TAU_MS, airspeedTarget, airspeedRate),
      lag('vertical_speed_fpm', VERTICAL_SPEED_TAU_MS, verticalSpeedTarget),
      { quantity: 'altitude_ft', mode: 'rate', perMinute: altitudePerMinute },
      lag('pitch_deg', ATTITUDE_TAU_MS, pitchTarget),
      lag('bank_deg', ATTITUDE_TAU_MS, bankTarget),
    ],
    trips: [
      {
        id: 'alt1_breaker',
        control: 'cb.alt1',
        to: 'out',
        delayMs: ALT_SHORT_REPOP_MS,
        when: (inputs) => parameterOf(inputs, 'alt1_short') > 0,
      },
      {
        id: 'alt2_breaker',
        control: 'cb.alt2',
        to: 'out',
        delayMs: ALT_SHORT_REPOP_MS,
        when: (inputs) => parameterOf(inputs, 'alt2_short') > 0,
      },
    ],
    reactions: [
      // D-04, SCN-06: pressing MAX with the de-ice mode on HIGH lights the top amber lamp for 120 s
      // of run time; leaving HIGH puts it out at once. A press with the mode on NORM or OFF starts
      // nothing, and a press during the run is ignored. The lamps read the flag, never the button.
      // The flag also drives the fluid: the 0.4 gal of one activation leave the tank over the run
      // (deiceFluidPerMinute). ANNUN TEST lights the lamps (indicators.ts). Still deferred (D-04): the
      // ICE LIGHT effect (night only) and the ELT lamp in RESET / TEST (no source for its behaviour).
      {
        id: 'deice_max',
        on: { control: 'btn.deice_max', value: 'pressed' },
        when: (controls) => controls['sw.deice_mode'] === 'high',
        flag: DEICE_MAX_ACTIVE,
        durationMs: DEICE_MAX_RUN_MS,
        clearsWhen: (controls) => controls['sw.deice_mode'] !== 'high',
      },
      // C-04: pressing WIND SHIELD sprays the windscreen for 10 s of run time, whatever the mode; a
      // press during the spray is ignored and nothing ends it early. The spray also takes its 40 ml
      // from the de-ice fluid (deiceFluidPerMinute).
      {
        id: 'windshield_spray',
        on: { control: 'btn.deice_windshield', value: 'pressed' },
        when: () => true,
        flag: WINDSHIELD_SPRAY_ACTIVE,
        durationMs: WINDSHIELD_SPRAY_MS,
        clearsWhen: () => false,
      },
      // The same press protects the pilot side from new ice for 10 minutes of run time (owner,
      // 2026-10-27); a second press during that time neither restarts nor extends it.
      {
        id: 'windshield_protect',
        on: { control: 'btn.deice_windshield', value: 'pressed' },
        when: () => true,
        flag: WINDSHIELD_PROTECT_ACTIVE,
        durationMs: WINDSHIELD_PROTECT_MS,
        clearsWhen: () => false,
      },
    ],
  },
  { registry: DA50RG, quantities: DA50RG_QUANTITIES },
);
