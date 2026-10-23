import { describe, expect, it } from 'vitest';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { CasError, defineCasRules, MAX_CAS_CHIPS } from '../src/engine/cas';
import type { CasRuleSpec } from '../src/engine/cas';
import type { PredicateContext } from '../src/engine/predicates';
import { casChipSlots } from '../src/ui/panel/frames/CasChips';

// The CAS rule engine (D-06, D-06a, D-08) on a synthetic table, the DA50 RG table's one rule, and
// the stacking rule of the chips (UI-SPEC populated-chip backstop).

const env = { registry: DA50RG_ENV.registry, quantities: DA50RG_ENV.quantities };

/** The two control unit fault flags, 0 at the cruise base state (read from the quantity data). */
const NO_FAULT = DA50RG_ENV.quantities.get('alt1_fault')?.base ?? Number.NaN;
/** A flag value inside the fault band of both quantities. */
const FAULT = DA50RG_ENV.quantities.get('alt1_fault')?.max ?? Number.NaN;

function at(
  oilTemp: number,
  oilPressure = 5,
  fault1 = NO_FAULT,
  fault2 = NO_FAULT,
): PredicateContext {
  return {
    controls: {},
    baseline: {},
    quantities: {
      oil_temp_c: oilTemp,
      oil_pressure_bar: oilPressure,
      alt1_fault: fault1,
      alt2_fault: fault2,
    },
  };
}

const rule = (id: string, over: Partial<CasRuleSpec> = {}): CasRuleSpec => ({
  id,
  text: id.toUpperCase().replace(/_/g, ' '),
  level: 'warning',
  when: { check: 'quantity', quantity: 'oil_temp_c', op: 'gt', value: 100 },
  ...over,
});

describe('defineCasRules rejects malformed rules', () => {
  it('rejects a duplicate id', () => {
    expect(() => defineCasRules([rule('a'), rule('a')], env)).toThrow(/"a".*twice/);
  });

  it('rejects a malformed id', () => {
    expect(() => defineCasRules([rule('A b')], env)).toThrow(CasError);
  });

  it('rejects a 13-character text and accepts 12', () => {
    expect(() => defineCasRules([rule('a', { text: 'ABCDEFGHIJKLM' })], env)).toThrow(/"a"/);
    expect(() => defineCasRules([rule('a', { text: 'ABCDEFGHIJKL' })], env)).not.toThrow();
  });

  it('rejects an empty or lower-case text', () => {
    expect(() => defineCasRules([rule('a', { text: '' })], env)).toThrow(CasError);
    expect(() => defineCasRules([rule('a', { text: 'Eng oil' })], env)).toThrow(CasError);
  });

  it('rejects an unknown level', () => {
    const bad = rule('a', { level: 'advisory' as unknown as 'warning' });
    expect(() => defineCasRules([bad], env)).toThrow(/level "advisory"/);
  });

  it('rejects a predicate that does not resolve', () => {
    const bad = rule('a', {
      when: { check: 'quantity', quantity: 'no_such', op: 'gt', value: 1 },
    });
    expect(() => defineCasRules([bad], env)).toThrow(/"a".*unknown quantity "no_such"/);
  });
});

describe('active', () => {
  const table = defineCasRules(
    [
      rule('c1', { level: 'caution', text: 'C ONE' }),
      rule('w1', { text: 'W ONE' }),
      rule('c2', { level: 'caution', text: 'C TWO' }),
      rule('w2', { text: 'W TWO' }),
      rule('off', {
        text: 'NOT ACTIVE',
        when: { check: 'quantity', quantity: 'oil_temp_c', op: 'gt', value: 140 },
      }),
    ],
    env,
  );

  it('orders warnings first, then cautions, each in table order', () => {
    expect(table.active(at(120), env).map((m) => m.id)).toEqual(['w1', 'w2', 'c1', 'c2']);
  });

  it('returns id, text and level only', () => {
    expect(table.active(at(120), env)[0]).toEqual({ id: 'w1', text: 'W ONE', level: 'warning' });
  });

  it('is empty when no rule holds', () => {
    expect(table.active(at(90), env)).toEqual([]);
  });

  it('exposes the rules read-only', () => {
    expect(Object.isFrozen(table)).toBe(true);
    expect(table.get('w1')?.text).toBe('W ONE');
    expect(table.get('missing')).toBeUndefined();
  });

  it('lists the controls a rule reads', () => {
    const withControl = defineCasRules(
      [rule('g', { when: { check: 'state', control: 'lv.cowl_flap', is: 'open' } })],
      env,
    );
    expect(withControl.controlsRead).toEqual(['lv.cowl_flap']);
  });
});

describe('DA50 RG table', () => {
  it('has ENG OIL TEMP as a warning, off at 125 and on at 125.1', () => {
    expect(DA50RG_CAS.get('eng_oil_temp')).toMatchObject({
      text: 'ENG OIL TEMP',
      level: 'warning',
    });
    expect(DA50RG_CAS.active(at(125), DA50RG_ENV)).toEqual([]);
    expect(DA50RG_CAS.active(at(125.1), DA50RG_ENV)).toEqual([
      { id: 'eng_oil_temp', text: 'ENG OIL TEMP', level: 'warning' },
    ]);
  });
});

describe('DA50 RG table: ALTN 1 FAIL and ALTN 2 FAIL (phase 4, E-07)', () => {
  const message = { id: 'altn_1_fail', text: 'ALTN 1 FAIL', level: 'caution' };
  const message2 = { id: 'altn_2_fail', text: 'ALTN 2 FAIL', level: 'caution' };
  const WARNING = { id: 'eng_oil_temp', text: 'ENG OIL TEMP', level: 'warning' };

  it('are cautions', () => {
    expect(DA50RG_CAS.get('altn_1_fail')).toMatchObject({ text: 'ALTN 1 FAIL', level: 'caution' });
    expect(DA50RG_CAS.get('altn_2_fail')).toMatchObject({ text: 'ALTN 2 FAIL', level: 'caution' });
  });

  it('are band rules over the fault quantities, with no number in the rule', () => {
    for (const [id, quantity] of [
      ['altn_1_fail', 'alt1_fault'],
      ['altn_2_fail', 'alt2_fault'],
    ] as const) {
      expect(DA50RG_CAS.get(id)?.when).toEqual({ check: 'band', quantity, in: ['fault'] });
    }
  });

  it('are off at the base values', () => {
    expect(
      DA50RG_CAS.active(at(DA50RG_ENV.quantities.get('oil_temp_c')?.base ?? 0), DA50RG_ENV),
    ).toEqual([]);
  });

  it('each follow their own flag alone', () => {
    expect(DA50RG_CAS.active(at(91, 5, FAULT, NO_FAULT), DA50RG_ENV)).toEqual([message]);
    expect(DA50RG_CAS.active(at(91, 5, NO_FAULT, FAULT), DA50RG_ENV)).toEqual([message2]);
  });

  it('read the flag, not a current: a healthy alternator at a low current raises nothing', () => {
    const lowCurrent: PredicateContext = {
      ...at(91),
      quantities: { ...at(91).quantities, alt1_amps: 0, alt2_amps: 0 },
    };
    expect(DA50RG_CAS.active(lowCurrent, DA50RG_ENV)).toEqual([]);
  });

  it('stay on after ALTERNATOR 1 is switched OFF while the flag is set', () => {
    const switchedOff: PredicateContext = {
      ...at(91, 5, FAULT),
      controls: { 'sw.alternator_1': 'off' },
    };
    expect(DA50RG_CAS.active(switchedOff, DA50RG_ENV)).toEqual([message]);
  });

  it('go out when the flag is 0, whatever the amps', () => {
    const cleared: PredicateContext = {
      ...at(91),
      quantities: { ...at(91).quantities, alt1_amps: 0 },
    };
    expect(DA50RG_CAS.active(cleared, DA50RG_ENV)).toEqual([]);
  });

  it('come after a warning in the display order, ALTN 2 FAIL after ALTN 1 FAIL', () => {
    expect(DA50RG_CAS.active(at(126, 5, FAULT, FAULT), DA50RG_ENV)).toEqual([
      WARNING,
      message,
      message2,
    ]);
  });
});

describe('DA50 RG table: OIL PRES (plan 03-08, C-46)', () => {
  const message = { id: 'oil_pres', text: 'OIL PRES', level: 'warning' };
  const ENG_OIL_TEMP = { id: 'eng_oil_temp', text: 'ENG OIL TEMP', level: 'warning' };
  const ALTN_1_FAIL = { id: 'altn_1_fail', text: 'ALTN 1 FAIL', level: 'caution' };
  /** Band bounds from the quantity data: the low red range ends at the top of low_red. */
  const bands = DA50RG_ENV.quantities.get('oil_pressure_bar')?.bands ?? [];
  const top = (id: string): number => bands.find((b) => b.id === id)?.to ?? Number.NaN;
  const BASE_TEMP = DA50RG_ENV.quantities.get('oil_temp_c')?.base ?? 0;

  it('is a warning', () => {
    expect(DA50RG_CAS.get('oil_pres')).toMatchObject({ text: 'OIL PRES', level: 'warning' });
  });

  it('is off at the base values', () => {
    const base = DA50RG_ENV.quantities.get('oil_pressure_bar')?.base ?? Number.NaN;
    expect(DA50RG_CAS.active(at(BASE_TEMP, base), DA50RG_ENV)).toEqual([]);
  });

  it('is on with no oil pressure (engine off)', () => {
    expect(DA50RG_CAS.active(at(BASE_TEMP, 0), DA50RG_ENV)).toEqual([message]);
  });

  it('is on at the top of the low red band and off just above it', () => {
    expect(DA50RG_CAS.active(at(BASE_TEMP, top('low_red')), DA50RG_ENV)).toEqual([message]);
    expect(DA50RG_CAS.active(at(BASE_TEMP, top('low_red') + 0.1), DA50RG_ENV)).toEqual([]);
  });

  it('is on in the high red band and off at the top of the high yellow band', () => {
    expect(DA50RG_CAS.active(at(BASE_TEMP, top('high_yellow') + 0.1), DA50RG_ENV)).toEqual([
      message,
    ]);
    expect(DA50RG_CAS.active(at(BASE_TEMP, top('high_yellow')), DA50RG_ENV)).toEqual([]);
  });

  it('stays off in the yellow and green bands', () => {
    for (const pressure of [top('low_red') + 0.5, top('low_yellow'), top('green')]) {
      expect(DA50RG_CAS.active(at(BASE_TEMP, pressure), DA50RG_ENV), String(pressure)).toEqual([]);
    }
  });

  it('comes after ENG OIL TEMP among the warnings and before the cautions', () => {
    expect(DA50RG_CAS.active(at(126, 0, FAULT), DA50RG_ENV)).toEqual([
      ENG_OIL_TEMP,
      message,
      ALTN_1_FAIL,
    ]);
  });
});

describe('casChipSlots', () => {
  it('stacks two per row from row 0 upward, right slot first', () => {
    expect(casChipSlots(6)).toEqual([
      { x: 294, y: 236 },
      { x: 190, y: 236 },
      { x: 294, y: 212 },
      { x: 190, y: 212 },
      { x: 294, y: 188 },
      { x: 190, y: 188 },
    ]);
  });

  it('draws only the slots that exist for 7 chips', () => {
    expect(MAX_CAS_CHIPS).toBe(6);
    expect(casChipSlots(7)).toHaveLength(6);
    expect(casChipSlots(0)).toEqual([]);
    expect(casChipSlots(1)).toEqual([{ x: 294, y: 236 }]);
  });
});
