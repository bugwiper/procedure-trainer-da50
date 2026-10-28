// The fuel calculator of the engine page (Phase 6, D-04, F-09): gallons remain, gallons used,
// endurance and range, all derived from the simulated tank, flow and airspeed quantities. It has no
// quantity of its own. Pure TypeScript with + - * / and clamping only, so a live run and its replay
// agree to the last digit. Range has no wind: the ground speed equals the airspeed (on the apron the
// airspeed is the ground speed, so the range reads 0).

/** The quantities the calculator reads; every id lives in quantities.ts. */
export const FUEL_CALCULATOR_QUANTITIES = [
  'fuel_qty_lh_gal',
  'fuel_qty_rh_gal',
  'fuel_used_gal',
  'fuel_flow_gph',
  'airspeed_kt',
] as const;

/** Below this flow in US gallons per hour no endurance is shown (the engine is stopped or idle-dry). */
export const ENDURANCE_MIN_FLOW_GPH = 1;
/** The longest endurance shown: 99 h 59 min, in minutes. */
export const ENDURANCE_MAX_MIN = 99 * 60 + 59;
const MINUTES_PER_HOUR = 60;

export interface FuelCalculatorValues {
  /** Both tanks together, US gallons. */
  readonly remainGal: number;
  /** The fuel used, US gallons. */
  readonly usedGal: number;
  /** Whole minutes at the current flow; null while the flow is below the floor or the result is too long. */
  readonly enduranceMin: number | null;
  /** Nautical miles at the current flow and airspeed, no wind; null where the endurance is null. */
  readonly rangeNm: number | null;
}

type Readings = Readonly<Record<string, number>>;

/** A reading, or 0 when the quantity is missing or not a finite number (never NaN in the text). */
function reading(quantities: Readings, id: (typeof FUEL_CALCULATOR_QUANTITIES)[number]): number {
  const value = Object.hasOwn(quantities, id) ? quantities[id] : undefined;
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

/** The calculator values for the current quantities. */
export function fuelCalculator(quantities: Readings): FuelCalculatorValues {
  const remainGal = reading(quantities, 'fuel_qty_lh_gal') + reading(quantities, 'fuel_qty_rh_gal');
  const usedGal = reading(quantities, 'fuel_used_gal');
  const flow = reading(quantities, 'fuel_flow_gph');
  if (flow < ENDURANCE_MIN_FLOW_GPH) {
    return { remainGal, usedGal, enduranceMin: null, rangeNm: null };
  }
  const hours = remainGal / flow;
  const enduranceMin = Math.floor(hours * MINUTES_PER_HOUR);
  if (enduranceMin > ENDURANCE_MAX_MIN) {
    return { remainGal, usedGal, enduranceMin: null, rangeNm: null };
  }
  return { remainGal, usedGal, enduranceMin, rangeNm: hours * reading(quantities, 'airspeed_kt') };
}

/** Endurance as H:MM, or --:-- where there is none. */
export function formatEndurance(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return '--:--';
  const whole = Math.floor(minutes);
  const hours = Math.floor(whole / MINUTES_PER_HOUR);
  const rest = whole - hours * MINUTES_PER_HOUR;
  return `${String(hours)}:${rest < 10 ? '0' : ''}${String(rest)}`;
}
