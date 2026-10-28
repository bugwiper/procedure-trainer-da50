import { describe, expect, it } from 'vitest';
import {
  ENDURANCE_MAX_MIN,
  ENDURANCE_MIN_FLOW_GPH,
  FUEL_CALCULATOR_QUANTITIES,
  formatEndurance,
  fuelCalculator,
} from '../src/aircraft/da50rg/fuel-calculator';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';

// The fuel calculator (Phase 6, plan 06-01, F-09): pure values over the tank, flow and airspeed
// quantities. Expected values are computed from the quantity bases, never typed in.

const base = DA50RG_QUANTITIES.baseValues();
const b = (id: string): number => {
  const value = Object.hasOwn(base, id) ? base[id] : undefined;
  if (value === undefined) throw new Error(`no quantity ${id}`);
  return value;
};

describe('the calculator reads only quantities that exist', () => {
  it('every id of the list is a quantity of the aircraft', () => {
    for (const id of FUEL_CALCULATOR_QUANTITIES) {
      expect(DA50RG_QUANTITIES.get(id), id).toBeDefined();
    }
  });
});

describe('fuelCalculator at the base values', () => {
  const values = fuelCalculator(base);
  const remain = b('fuel_qty_lh_gal') + b('fuel_qty_rh_gal');
  const hours = remain / b('fuel_flow_gph');

  it('remain is left plus right, used is the gallons used', () => {
    expect(values.remainGal).toBe(remain);
    expect(values.usedGal).toBe(b('fuel_used_gal'));
  });

  it('endurance is the remaining gallons over the flow, in whole minutes (truncated)', () => {
    expect(values.enduranceMin).toBe(Math.floor(hours * 60));
    // 40 gal at 11.23 gph is 3 h 33 min (truncated).
    expect(formatEndurance(values.enduranceMin)).toBe('3:33');
    expect(values.enduranceMin).toBeGreaterThan(0);
  });

  it('range is the exact endurance in hours times the airspeed', () => {
    expect(values.rangeNm).toBe(hours * b('airspeed_kt'));
    // Not the truncated minutes.
    expect(values.rangeNm).not.toBe(((values.enduranceMin ?? 0) / 60) * b('airspeed_kt'));
  });
});

describe('endurance limits', () => {
  it('a flow below the floor gives no endurance and no range', () => {
    for (const flow of [0, ENDURANCE_MIN_FLOW_GPH / 2, ENDURANCE_MIN_FLOW_GPH - 0.01]) {
      const values = fuelCalculator({ ...base, fuel_flow_gph: flow });
      expect(values.enduranceMin, String(flow)).toBeNull();
      expect(values.rangeNm, String(flow)).toBeNull();
      expect(formatEndurance(values.enduranceMin)).toBe('--:--');
    }
  });

  it('a flow at the floor gives an endurance as long as the tanks allow', () => {
    const values = fuelCalculator({ ...base, fuel_flow_gph: ENDURANCE_MIN_FLOW_GPH });
    const remain = b('fuel_qty_lh_gal') + b('fuel_qty_rh_gal');
    expect(values.enduranceMin).toBe(Math.floor((remain / ENDURANCE_MIN_FLOW_GPH) * 60));
  });

  it('an endurance above 99 h 59 min gives none', () => {
    // 52 gal over a flow just above the floor is about 52 h: still shown; a bigger tank is not possible,
    // so the cap is checked on a quantity set beyond the real tanks.
    const huge = fuelCalculator({
      ...base,
      fuel_qty_lh_gal: 5000,
      fuel_qty_rh_gal: 5000,
      fuel_flow_gph: ENDURANCE_MIN_FLOW_GPH,
    });
    expect(huge.enduranceMin).toBeNull();
    expect(huge.rangeNm).toBeNull();
    const limit = fuelCalculator({
      ...base,
      fuel_qty_lh_gal: 0,
      fuel_qty_rh_gal: ENDURANCE_MAX_MIN / 60,
      fuel_flow_gph: ENDURANCE_MIN_FLOW_GPH,
    });
    expect(limit.enduranceMin).toBe(ENDURANCE_MAX_MIN);
  });
});

describe('formatEndurance', () => {
  it('prints H:MM with two digits of minutes', () => {
    expect(formatEndurance(135)).toBe('2:15');
    expect(formatEndurance(7)).toBe('0:07');
    expect(formatEndurance(0)).toBe('0:00');
    expect(formatEndurance(ENDURANCE_MAX_MIN)).toBe('99:59');
  });

  it('prints --:-- for none, a negative or a non-finite value', () => {
    for (const bad of [null, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatEndurance(bad), String(bad)).toBe('--:--');
    }
  });
});

describe('the apron and bad readings', () => {
  it('the range is 0 on the apron (airspeed 0)', () => {
    const values = fuelCalculator({ ...base, airspeed_kt: 0 });
    expect(values.rangeNm).toBe(0);
    expect(values.enduranceMin).not.toBeNull();
  });

  it('a missing or non-finite quantity counts as 0 and never gives NaN', () => {
    const partial = fuelCalculator({});
    expect(partial).toEqual({ remainGal: 0, usedGal: 0, enduranceMin: null, rangeNm: null });
    const bad = fuelCalculator({
      ...base,
      fuel_qty_lh_gal: Number.NaN,
      fuel_used_gal: Number.POSITIVE_INFINITY,
      airspeed_kt: Number.NaN,
    });
    expect(bad.remainGal).toBe(b('fuel_qty_rh_gal'));
    expect(bad.usedGal).toBe(0);
    expect(bad.rangeNm).toBe(0);
    for (const value of [bad.remainGal, bad.usedGal, bad.enduranceMin, bad.rangeNm]) {
      expect(Number.isNaN(value)).toBe(false);
    }
    expect(formatEndurance(bad.enduranceMin)).not.toMatch(/NaN/);
  });

  it('reads own properties only, so a prototype key never resolves', () => {
    const values = fuelCalculator(
      Object.create({ fuel_flow_gph: 10, fuel_qty_lh_gal: 10 }) as Record<string, number>,
    );
    expect(values).toEqual({ remainGal: 0, usedGal: 0, enduranceMin: null, rangeNm: null });
  });
});
