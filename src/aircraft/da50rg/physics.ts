import { interpolate } from '../../engine/curve';
import { definePhysics } from '../../engine/physics';
import type { PhysicsInputs, QuantityModel } from '../../engine/physics';
import { travelPercent } from '../../engine/predicates';
import type { DetentLeverDef } from '../../engine/registry';
import { STEP_MS } from '../../engine/sim';
import { acuFault, electricalState } from './electrical';
import { DEICE_MAX_ACTIVE, WINDSHIELD_SPRAY_ACTIVE } from './indicators';
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

/** Ambient and engine-off temperature, degrees C. */
const AMBIENT_C = 15;
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
const FUEL_PRESSURE_TAU_MS = 1_000;
const AMPS_TAU_MS = 1_500;
const VOLTS_TAU_MS = 1_000;

// Effects of the POWER load, per percent of travel away from the cruise load. The engine speed
// is not among them: it follows the propeller set curve (prop-curve.ts).
const OIL_PRESSURE_PER_PERCENT = 0.01;
const COOLANT_PER_PERCENT = 0.3;
const GEARBOX_PER_PERCENT = 0.3;
const FUEL_TEMP_PER_PERCENT = 0.15;
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
/** FUEL TRANS moves this much from the right tank to the left one, gallons per minute. */
const FUEL_TRANSFER_PER_MIN = 1;
/** The right tank stops giving at this level. */
const FUEL_TRANSFER_RH_FLOOR = 1;

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

// Windscreen ice (Phase 5, C-04) and the WIND SHIELD spray. All values are instructor-review
// values, none is an AFM figure. Per half of the windscreen the ice (0 to 100) grows by
// ICE_ACCRETE_PER_MIN times the parameter ice_accretion. Warm air toward the windscreen (DIRECTION
// at DEFROST, TEMPERATURE at 75 or WARM) melts it only very slowly (owner, 2026-10-27): light icing
// clears over many minutes and heavy icing is hardly slowed. Pressing WIND SHIELD sprays the pilot
// side (the left half) for WINDSHIELD_SPRAY_MS of run time; the airflow carries the fluid upward
// and the ice on that side is gone directly, within about a second (ICE_SPRAY_CLEAR_PER_MIN), with
// no accretion while the spray runs. The co-pilot side is untouched. Afterwards the pilot side
// accretes again while the parameter is above 0 (no exit-from-icing model before Phase 5.1).
const ICE_ACCRETE_PER_MIN = 40;
const ICE_WARM_CLEAR_PER_MIN = 6;
const ICE_SPRAY_CLEAR_PER_MIN = 6_000;
const WINDSHIELD_SPRAY_MS = 10_000;

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

/** The FUEL selector OFF cuts the fuel to the engine and to the EMERG FUEL PUMP. */
function fuelCut(inputs: PhysicsInputs): boolean {
  return stateOf(inputs, 'sw.fuel_valve') === 'off';
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

/** Ice change per minute on one half of the windscreen; `pilot` is the left half, the one the spray reaches. */
function icePerMinute(inputs: PhysicsInputs, pilot: boolean): number {
  if (pilot && inputs.flags[WINDSHIELD_SPRAY_ACTIVE] === true) return -ICE_SPRAY_CLEAR_PER_MIN;
  const warm = warmAirToWindscreen(inputs) ? ICE_WARM_CLEAR_PER_MIN : 0;
  return ICE_ACCRETE_PER_MIN * parameterOf(inputs, 'ice_accretion') - warm;
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
  if (!running(inputs)) return AMBIENT_C + fire;
  const load = travelPercent(POWER, stateOf(inputs, 'lv.power')) / 100;
  const flap = stateOf(inputs, 'lv.cowl_flap') === 'open' ? COWL_OPEN_COOLING : 1;
  const cooling = parameterOf(inputs, 'oil_cooling') * flap;
  return AMBIENT_C + (HEAT_BASE + HEAT_PER_LOAD * load) / cooling + fire;
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
  if (!running(inputs)) return AMBIENT_C + fire;
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
  if (!running(inputs)) return AMBIENT_C + fire;
  return (
    baseOf('gearbox_temp_c') + (loadPercent(inputs) - CRUISE_PERCENT) * GEARBOX_PER_PERCENT + fire
  );
}

function fuelTempTarget(inputs: PhysicsInputs): number {
  return baseOf('fuel_temp_c') + (loadPercent(inputs) - CRUISE_PERCENT) * FUEL_TEMP_PER_PERCENT;
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

/** Gallons per minute moved from the right to the left tank: FUEL TRANS on, RH not empty, LH not full. */
function fuelTransferPerMinute(inputs: PhysicsInputs): number {
  if (stateOf(inputs, 'sw.fuel_trans') !== 'on') return 0;
  if (quantityOf(inputs, 'fuel_qty_rh_gal') <= FUEL_TRANSFER_RH_FLOOR) return 0;
  if (quantityOf(inputs, 'fuel_qty_lh_gal') >= bandTop('fuel_qty_lh_gal', 'green')) return 0;
  return FUEL_TRANSFER_PER_MIN;
}

/** Fuel flow in US gallons per hour: linear in the POWER load while running, 0 with the engine stopped. */
function fuelFlowGph(inputs: PhysicsInputs): number {
  if (!running(inputs)) return 0;
  return FUEL_FLOW_BASE_GPH + FUEL_FLOW_PER_PERCENT_GPH * loadPercent(inputs);
}

/** The same flow in gallons per minute, the unit of the rate model of the tank. */
function fuelBurnPerMinute(inputs: PhysicsInputs): number {
  return fuelFlowGph(inputs) / MINUTES_PER_HOUR;
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

/** The de-ice MAX run lasts 120 s of run time (owner finding G-1). */
const DEICE_MAX_RUN_MS = 120_000;

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
    ],
    models: [
      lag('rpm', RPM_TAU_MS, rpmTarget),
      lag('load_pct', LOAD_TAU_MS, loadPercent),
      lag('oil_pressure_bar', OIL_PRESSURE_TAU_MS, oilPressureTarget),
      lag('oil_temp_c', OIL_TEMP_TAU_MS, oilTempTarget, oilTempRate),
      lag('coolant_temp_c', COOLANT_TAU_MS, coolantTarget),
      lag('gearbox_temp_c', GEARBOX_TAU_MS, gearboxTarget),
      lag('fuel_temp_c', FUEL_TEMP_TAU_MS, fuelTempTarget),
      lag('fuel_pressure_bar', FUEL_PRESSURE_TAU_MS, fuelPressureTarget),
      {
        quantity: 'fuel_qty_lh_gal',
        mode: 'rate',
        perMinute: (inputs) => fuelTransferPerMinute(inputs) - fuelBurnPerMinute(inputs),
      },
      {
        quantity: 'fuel_qty_rh_gal',
        mode: 'rate',
        perMinute: (inputs) => -fuelTransferPerMinute(inputs),
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
      lag('fire_intensity', FIRE_TAU_MS, fireTarget),
      lag('smoke_density', SMOKE_TAU_MS, smokeTarget, smokeRate),
      { quantity: 'ice_pilot', mode: 'rate', perMinute: (inputs) => icePerMinute(inputs, true) },
      { quantity: 'ice_copilot', mode: 'rate', perMinute: (inputs) => icePerMinute(inputs, false) },
      {
        quantity: 'oil_film',
        mode: 'rate',
        perMinute: (inputs) =>
          running(inputs) ? OIL_FILM_PER_MIN * parameterOf(inputs, 'oil_leak') : 0,
      },
      { quantity: 'ground_speed_kt', mode: 'rate', perMinute: groundSpeedPerMinute },
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
      // Still deferred (D-04): ANNUN-TEST, the ICE LIGHT effect and the ELT lamp in RESET / TEST.
      {
        id: 'deice_max',
        on: { control: 'btn.deice_max', value: 'pressed' },
        when: (controls) => controls['sw.deice_mode'] === 'high',
        flag: DEICE_MAX_ACTIVE,
        durationMs: DEICE_MAX_RUN_MS,
        clearsWhen: (controls) => controls['sw.deice_mode'] !== 'high',
      },
      // C-04: pressing WIND SHIELD sprays the windscreen for 10 s of run time, whatever the mode; a
      // press during the spray is ignored and nothing ends it early.
      {
        id: 'windshield_spray',
        on: { control: 'btn.deice_windshield', value: 'pressed' },
        when: () => true,
        flag: WINDSHIELD_SPRAY_ACTIVE,
        durationMs: WINDSHIELD_SPRAY_MS,
        clearsWhen: () => false,
      },
    ],
  },
  { registry: DA50RG, quantities: DA50RG_QUANTITIES },
);
