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

function at(oilTemp: number, oilPressure = 5): PredicateContext {
  return {
    controls: {},
    baseline: {},
    quantities: { oil_temp_c: oilTemp, oil_pressure_bar: oilPressure },
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
