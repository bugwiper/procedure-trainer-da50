import { definePhysics } from '../../engine/physics';
import type { PhysicsInputs, QuantityModel } from '../../engine/physics';
import { travelPercent } from '../../engine/predicates';
import type { DetentLeverDef } from '../../engine/registry';
import { DEICE_MAX_ACTIVE } from './indicators';
import { DA50RG } from './panel';
import { DA50RG_QUANTITIES } from './quantities';

// DA50 RG physics (D-01, D-02, D-10, D-12, C-03, C-05, C-09): how the named quantities move during
// a run. Aircraft behaviour, never a scenario fact: a scenario only sets a parameter such as the
// oil cooling. Every model is anchored (C-09): at the registry defaults with normal parameters its
// target equals the quantity's base value (quantities.ts), so the base is the equilibrium and the
// free panel and every untouched run stay put. The time constants are compressed (tens of seconds)
// so that a scenario resolves in one to five minutes: a training-aid choice. All constants are an
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
// rises 200 rpm from cruise to POWER 100 % (2300 rpm, inside green).
const RPM_PER_PERCENT = 20 / 3;
const OIL_PRESSURE_PER_PERCENT = 0.01;
const COOLANT_PER_PERCENT = 0.3;
const GEARBOX_PER_PERCENT = 0.3;
const FUEL_TEMP_PER_PERCENT = 0.15;
/** An open cowl flap cools the coolant by this many degrees. */
const COWL_OPEN_COOLANT_DROP = 10;

/** The EMERG FUEL PUMP adds this pressure, with the engine running or not. */
const EMERG_PUMP_BAR = 0.3;

/** Fuel burned from the left tank at the cruise load, gallons per minute (not compressed). */
const FUEL_BURN_CRUISE_PER_MIN = 0.1;
/** FUEL TRANS moves this much from the right tank to the left one, gallons per minute. */
const FUEL_TRANSFER_PER_MIN = 1;
/** The right tank stops giving at this level. */
const FUEL_TRANSFER_RH_FLOOR = 1;

/** Alternator 2 current with ESS BUS on (it then also supplies the main bus). */
const ALT2_ESS_ON_AMPS = 35;
/** Bus volts on the battery alone: this plus BATTERY_VOLTS_SPAN at a full battery. */
const BATTERY_VOLTS_FLOOR = 22;
const BATTERY_VOLTS_SPAN = 4;
/** The target of a dead bus lies this far below the scale minimum. */
const DEAD_BUS_UNDERSHOOT_V = 1;
/** Battery charge per minute with an alternator supply, and the compressed discharge without one. */
const BATTERY_CHARGE_PER_MIN = 10;
const BATTERY_DISCHARGE_PER_MIN = 25;

// Engine fire (plan 03-08, C-44): aircraft behaviour, compressed, an instructor-review item (RESEARCH
// A1). The fire intensity (0 to 100) moves toward the product of the scenario's fire parameter,
// the full scale and a fuel-feed factor. The feed is high while the engine runs, higher with the
// EMERG FUEL PUMP on, lower with the pump alone, and zero once the fuel is cut (ENGINE MASTER off
// or the FUEL selector OFF cuts the engine, so only the pump can still feed; the selector OFF cuts
// that too). The fire adds heat to the oil, the coolant and the gearbox in proportion to its
// intensity, at most these many degrees.
const FIRE_TAU_MS = 30_000;
const FIRE_FEED_RUNNING = 0.9;
const FIRE_FEED_RUNNING_PUMP = 1;
const FIRE_FEED_PUMP_ONLY = 0.6;
const FIRE_OIL_RISE = 30;
const FIRE_COOLANT_RISE = 30;
const FIRE_GEARBOX_RISE = 40;

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

/** Alternator 1 delivers: running, switched on, breaker in, ELECT. MASTER on, output above 0. */
function alt1Delivers(inputs: PhysicsInputs): boolean {
  return (
    running(inputs) &&
    stateOf(inputs, 'sw.alternator_1') === 'on' &&
    stateOf(inputs, 'cb.alt1') === 'in' &&
    stateOf(inputs, 'sw.elect_master') === 'on' &&
    parameterOf(inputs, 'alt1_output') > 0
  );
}

/** Alternator 2 runs: running, switched on, breaker in, ELECT. MASTER on. */
function alt2Runs(inputs: PhysicsInputs): boolean {
  return (
    running(inputs) &&
    stateOf(inputs, 'sw.alternator_2') === 'on' &&
    stateOf(inputs, 'cb.alt2') === 'in' &&
    stateOf(inputs, 'sw.elect_master') === 'on'
  );
}

/** Alternator 2 supplies the main bus only with ESS BUS on. */
function mainBusSupplied(inputs: PhysicsInputs): boolean {
  return alt1Delivers(inputs) || (alt2Runs(inputs) && stateOf(inputs, 'sw.ess_bus') === 'on');
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
  const pump = stateOf(inputs, 'sw.emerg_fuel_pump') === 'on';
  if (running(inputs)) return pump ? FIRE_FEED_RUNNING_PUMP : FIRE_FEED_RUNNING;
  return pump ? FIRE_FEED_PUMP_ONLY : 0;
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

/** Engine speed: rises with the load; 0 with the engine off. */
function rpmTarget(inputs: PhysicsInputs): number {
  if (!running(inputs)) return 0;
  return baseOf('rpm') + (loadPercent(inputs) - CRUISE_PERCENT) * RPM_PER_PERCENT;
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
 * but has no fuel to push with the FUEL selector OFF.
 */
function fuelPressureTarget(inputs: PhysicsInputs): number {
  const engine = running(inputs) ? baseOf('fuel_pressure_bar') : 0;
  const pump =
    stateOf(inputs, 'sw.emerg_fuel_pump') === 'on' && !fuelCut(inputs) ? EMERG_PUMP_BAR : 0;
  return engine + pump;
}

/** Gallons per minute moved from the right to the left tank: FUEL TRANS on, RH not empty, LH not full. */
function fuelTransferPerMinute(inputs: PhysicsInputs): number {
  if (stateOf(inputs, 'sw.fuel_trans') !== 'on') return 0;
  if (quantityOf(inputs, 'fuel_qty_rh_gal') <= FUEL_TRANSFER_RH_FLOOR) return 0;
  if (quantityOf(inputs, 'fuel_qty_lh_gal') >= bandTop('fuel_qty_lh_gal', 'green')) return 0;
  return FUEL_TRANSFER_PER_MIN;
}

/** Fuel burn from the left tank, in proportion to the POWER load while running. */
function fuelBurnPerMinute(inputs: PhysicsInputs): number {
  return (FUEL_BURN_CRUISE_PER_MIN * loadPercent(inputs)) / CRUISE_PERCENT;
}

/** The Amps gauge shows alternator 1 (C-10); it delivers its base current times the output. */
function alt1AmpsTarget(inputs: PhysicsInputs): number {
  return alt1Delivers(inputs) ? baseOf('alt1_amps') * parameterOf(inputs, 'alt1_output') : 0;
}

/** Alternator 2 carries the essential bus; with ESS BUS on it also carries the main bus. */
function alt2AmpsTarget(inputs: PhysicsInputs): number {
  if (!alt2Runs(inputs)) return 0;
  return stateOf(inputs, 'sw.ess_bus') === 'on' ? ALT2_ESS_ON_AMPS : baseOf('alt2_amps');
}

/** The battery charges with an alternator supply on the main bus, drains without one. */
function batteryPerMinute(inputs: PhysicsInputs): number {
  if (stateOf(inputs, 'sw.elect_master') !== 'on') return 0;
  return mainBusSupplied(inputs) ? BATTERY_CHARGE_PER_MIN : -BATTERY_DISCHARGE_PER_MIN;
}

/** Main bus voltage: the alternator level, the battery alone, or the scale minimum with the master off. */
function busVoltsTarget(inputs: PhysicsInputs): number {
  if (stateOf(inputs, 'sw.elect_master') !== 'on') {
    const def = DA50RG_QUANTITIES.get('bus_volts');
    if (def === undefined) throw new Error('physics needs the quantity "bus_volts"');
    // One volt below the scale: the clamp then lands exactly on the scale minimum (a dead bus),
    // where a lag toward the minimum itself would stop short at the 0.01 rounding.
    return def.min - DEAD_BUS_UNDERSHOOT_V;
  }
  if (mainBusSupplied(inputs)) return baseOf('bus_volts');
  return BATTERY_VOLTS_FLOOR + (BATTERY_VOLTS_SPAN * quantityOf(inputs, 'battery_pct')) / 100;
}

/** The de-ice MAX run lasts 120 s of run time (owner finding G-1). */
const DEICE_MAX_RUN_MS = 120_000;

const lag = (
  quantity: string,
  tauMs: number,
  target: (inputs: PhysicsInputs) => number,
): QuantityModel => ({ quantity, mode: 'lag', tauMs, target });

export const DA50RG_PHYSICS = definePhysics(
  {
    parameters: [
      // 1 is the normal cooling; a scenario degrades it. The lower bound keeps the divisor positive.
      { id: 'oil_cooling', min: 0.2, max: 1, normal: 1 },
      // 1 is the normal output of alternator 1; 0 is a failed alternator (the electrical scenario).
      { id: 'alt1_output', min: 0, max: 1, normal: 1 },
      // 0 is no fire; 1 is a fire that burns while fuel feeds it (the Engine Fire scenario).
      { id: 'engine_fire', min: 0, max: 1, normal: 0 },
    ],
    models: [
      lag('rpm', RPM_TAU_MS, rpmTarget),
      lag('load_pct', LOAD_TAU_MS, loadPercent),
      lag('oil_pressure_bar', OIL_PRESSURE_TAU_MS, oilPressureTarget),
      lag('oil_temp_c', OIL_TEMP_TAU_MS, oilTempTarget),
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
      lag('alt1_amps', AMPS_TAU_MS, alt1AmpsTarget),
      lag('alt2_amps', AMPS_TAU_MS, alt2AmpsTarget),
      { quantity: 'battery_pct', mode: 'rate', perMinute: batteryPerMinute },
      lag('bus_volts', VOLTS_TAU_MS, busVoltsTarget),
      lag('fire_intensity', FIRE_TAU_MS, fireTarget),
    ],
    reactions: [
      // D-04, SCN-06: pressing MAX with the de-ice mode on HIGH lights the top amber lamp for 120 s
      // of run time; leaving HIGH puts it out at once. A press with the mode on NORM or OFF starts
      // nothing, and a press during the run is ignored. The lamps read the flag, never the button.
      // Still deferred (D-04): ANNUN-TEST, the WIND SHIELD spray, the ICE LIGHT effect and the ELT
      // lamp in RESET / TEST.
      {
        id: 'deice_max',
        on: { control: 'btn.deice_max', value: 'pressed' },
        when: (controls) => controls['sw.deice_mode'] === 'high',
        flag: DEICE_MAX_ACTIVE,
        durationMs: DEICE_MAX_RUN_MS,
        clearsWhen: (controls) => controls['sw.deice_mode'] !== 'high',
      },
    ],
  },
  { registry: DA50RG, quantities: DA50RG_QUANTITIES },
);
