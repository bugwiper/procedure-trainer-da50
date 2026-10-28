import { describe, expect, it } from 'vitest';
import {
  DEICE_HIGH_GPH,
  DEICE_NORM_GPH,
  deiceEndurance,
} from '../src/aircraft/da50rg/deice-endurance';
import { formatEndurance } from '../src/aircraft/da50rg/fuel-calculator';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { parsePreviewQuantities } from '../src/ui/preview';

// Phase 6, plan 02: the de-ice endurance and the static display quantities of the engine page. The
// fluid consumption cases (mode flows, the MAX run, the spray, replay) follow with task 3.

const MINUTES_PER_HOUR = 60;

describe('deiceEndurance (E-07)', () => {
  const tank = DA50RG_QUANTITIES.get('deice_qty_gal');
  if (tank === undefined) throw new Error('no deice_qty_gal');

  it('uses the owner flows of 3 and 6 gallons per hour', () => {
    expect(DEICE_NORM_GPH).toBe(3);
    expect(DEICE_HIGH_GPH).toBe(6);
  });

  it('is the quantity over the flow in minutes: 6.8 gal last 2:16 at Norm and 1:08 at High', () => {
    const found = deiceEndurance(6.8);
    expect(found.normMin).toBe(Math.floor((6.8 * MINUTES_PER_HOUR) / DEICE_NORM_GPH));
    expect(found.highMin).toBe(Math.floor((6.8 * MINUTES_PER_HOUR) / DEICE_HIGH_GPH));
    expect(formatEndurance(found.normMin)).toBe('2:16');
    expect(formatEndurance(found.highMin)).toBe('1:08');
  });

  it('the base quantity gives about 2:15 and 1:07, within a minute', () => {
    const found = deiceEndurance(tank.base);
    expect(Math.abs(found.normMin - (2 * 60 + 15))).toBeLessThanOrEqual(1);
    expect(Math.abs(found.highMin - (60 + 7))).toBeLessThanOrEqual(1);
  });

  it('falls in proportion to the quantity, and High is half of Norm', () => {
    const full = deiceEndurance(tank.max);
    const half = deiceEndurance(tank.max / 2);
    expect(Math.abs(full.normMin - 2 * half.normMin)).toBeLessThanOrEqual(1);
    expect(Math.abs(full.highMin - 2 * half.highMin)).toBeLessThanOrEqual(1);
    expect(Math.abs(full.normMin - 2 * full.highMin)).toBeLessThanOrEqual(1);
  });

  it('gives 0:00 for an empty tank and never NaN or a negative figure', () => {
    for (const q of [0, -1, Number.NaN, Number.NEGATIVE_INFINITY]) {
      const found = deiceEndurance(q);
      expect(found, String(q)).toEqual({ normMin: 0, highMin: 0 });
      expect(formatEndurance(found.normMin)).toBe('0:00');
    }
  });
});

describe('the static display quantities of the engine page (E-05)', () => {
  const ids = ['rudder_trim_pct', 'oxygen_psi', 'deice_qty_gal', 'service_hours'] as const;

  it.each(ids)('%s exists with a base inside its range', (id) => {
    const def = DA50RG_QUANTITIES.get(id);
    expect(def, id).toBeDefined();
    expect(def?.base).toBeGreaterThanOrEqual(def?.min ?? Number.NaN);
    expect(def?.base).toBeLessThanOrEqual(def?.max ?? Number.NaN);
  });

  it('the de-ice tank holds the owner maximum of 8.3 US gallons on the fine scale of the fuel', () => {
    const def = DA50RG_QUANTITIES.get('deice_qty_gal');
    expect(def?.max).toBe(8.3);
    expect(def?.scale).toBe(DA50RG_QUANTITIES.get('fuel_qty_lh_gal')?.scale);
  });

  it('the oxygen bands run red, yellow, green, unmarked', () => {
    const colours = DA50RG_QUANTITIES.get('oxygen_psi')?.bands.map((b) => b.colour);
    expect(colours).toEqual(['red', 'yellow', 'green', 'none']);
  });

  it('a preview flag with a value outside the range is ignored (T-06-03)', () => {
    const oxygen = DA50RG_QUANTITIES.get('oxygen_psi');
    if (oxygen === undefined) throw new Error('no oxygen_psi');
    expect(parsePreviewQuantities('?q=oxygen_psi:99999', DA50RG_QUANTITIES)).toEqual({});
    expect(
      parsePreviewQuantities(`?q=oxygen_psi:${String(oxygen.max)}`, DA50RG_QUANTITIES),
    ).toEqual({ oxygen_psi: oxygen.max });
  });
});
