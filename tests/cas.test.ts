import { describe, expect, it } from 'vitest';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { CasError, defineCasRules, MAX_CAS_CHIPS } from '../src/engine/cas';
import type { CasRuleSpec } from '../src/engine/cas';
import type { PredicateContext } from '../src/engine/predicates';
import { CAS_COLUMN, casColumnRows } from '../src/aircraft/da50rg/pfd-layout';
import { CasChips } from '../src/ui/panel/frames/CasChips';
import { expand, findElements } from './vnode-walk';

// The CAS rule engine (D-06, D-06a, D-08) on a synthetic table, the DA50 RG table's one rule, and
// the stacking rule of the CAS column on the PFD (Phase 6.1).

const env = { registry: DA50RG_ENV.registry, quantities: DA50RG_ENV.quantities };

/** The two control unit fault flags, 0 at the cruise base state (read from the quantity data). */
const NO_FAULT = DA50RG_ENV.quantities.get('alt1_fault')?.base ?? Number.NaN;
/** The pump flag of FUEL TRANS, 0 (idle) at the cruise base state. */
const NO_PUMP = DA50RG_ENV.quantities.get('fuel_trans_active')?.base ?? Number.NaN;
/** The ground cut-out timer of the stall heat, 0 at the cruise base state. */
const NO_TIMER = DA50RG_ENV.quantities.get('stall_heat_timer_s')?.base ?? Number.NaN;
/** The legal states of the PITOT/STALL HEAT rocker, read from the registry. */
const HEAT_DEF = DA50RG_ENV.registry.get('sw.pitot_stall_heat');
/** A flag value inside the fault band of both quantities. */
const FAULT = DA50RG_ENV.quantities.get('alt1_fault')?.max ?? Number.NaN;

function at(
  oilTemp: number,
  oilPressure = 5,
  fault1 = NO_FAULT,
  fault2 = NO_FAULT,
): PredicateContext {
  return {
    // The two heat rules read the rocker, which the context must carry (at its default: on).
    controls: { 'sw.pitot_stall_heat': HEAT_DEF?.default ?? '' },
    baseline: {},
    quantities: {
      stall_heat_timer_s: NO_TIMER,
      oil_temp_c: oilTemp,
      oil_pressure_bar: oilPressure,
      alt1_fault: fault1,
      alt2_fault: fault2,
      fuel_trans_active: NO_PUMP,
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

  it('rejects an unknown level and accepts the three known ones', () => {
    const bad = rule('a', { level: 'status' as unknown as 'warning' });
    expect(() => defineCasRules([bad], env)).toThrow(/level "status"/);
    for (const level of ['warning', 'caution', 'advisory'] as const) {
      expect(() => defineCasRules([rule('a', { level })], env), level).not.toThrow();
    }
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

  it('lists advisories after the cautions, each level in table order (Phase 6)', () => {
    const withAdvisories = defineCasRules(
      [
        rule('a1', { level: 'advisory', text: 'A ONE' }),
        rule('c1', { level: 'caution', text: 'C ONE' }),
        rule('a2', { level: 'advisory', text: 'A TWO' }),
        rule('w1', { text: 'W ONE' }),
      ],
      env,
    );
    expect(withAdvisories.active(at(120), env).map((m) => m.id)).toEqual(['w1', 'c1', 'a1', 'a2']);
  });

  it('shows a text once: of several rules with one text that hold, the first in display order stands (WR-04)', () => {
    const shared = defineCasRules(
      [
        rule('c_first', { level: 'caution', text: 'SAME' }),
        rule('c_second', { level: 'caution', text: 'SAME' }),
        rule('w_late', { text: 'SAME' }),
        rule('c_other', { level: 'caution', text: 'OTHER' }),
      ],
      env,
    );
    // The warning comes first in display order, so the warning rule stands for the text.
    expect(shared.active(at(120), env)).toEqual([
      { id: 'w_late', text: 'SAME', level: 'warning' },
      { id: 'c_other', text: 'OTHER', level: 'caution' },
    ]);
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
      controls: { ...at(91).controls, 'sw.alternator_1': 'off' },
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

describe('FUEL TRANS advisory (Phase 6, D-04b)', () => {
  /** Quantities from the data: the pump flag idle and active. */
  const FLAG = DA50RG_ENV.quantities.get('fuel_trans_active');
  const withFlag = (value: number): PredicateContext => ({
    controls: at(90).controls,
    baseline: {},
    quantities: { ...at(90).quantities, fuel_trans_active: value },
  });

  it('is a white advisory read from the band of the hidden pump flag', () => {
    expect(DA50RG_CAS.get('fuel_trans')).toMatchObject({ text: 'FUEL TRANS', level: 'advisory' });
    expect(DA50RG_CAS.active(withFlag(FLAG?.base ?? Number.NaN), DA50RG_ENV)).toEqual([]);
    expect(DA50RG_CAS.active(withFlag(FLAG?.max ?? Number.NaN), DA50RG_ENV)).toEqual([
      { id: 'fuel_trans', text: 'FUEL TRANS', level: 'advisory' },
    ]);
  });

  it('comes after a caution and a warning in the display order', () => {
    const ctx = { ...withFlag(FLAG?.max ?? Number.NaN) };
    ctx.quantities = { ...ctx.quantities, oil_temp_c: 126, alt1_fault: FAULT };
    expect(DA50RG_CAS.active(ctx, DA50RG_ENV).map((m) => m.id)).toEqual([
      'eng_oil_temp',
      'altn_1_fail',
      'fuel_trans',
    ]);
  });
});

describe('PITOT HEAT and STALL HEAT cautions (Phase 6, plan 04, H-01)', () => {
  const OFF = 'off';
  /** The timer values inside the warm and cut bands, from the quantity data. */
  const timer = DA50RG_ENV.quantities.get('stall_heat_timer_s');
  const warmTop = timer?.bands.find((b) => b.id === 'warm')?.to ?? Number.NaN;
  const cutTop = timer?.bands.find((b) => b.id === 'cut')?.to ?? Number.NaN;
  const withHeat = (state: string, seconds = NO_TIMER): PredicateContext => ({
    controls: { 'sw.pitot_stall_heat': state },
    baseline: {},
    quantities: { ...at(90).quantities, stall_heat_timer_s: seconds },
  });
  const ids = (ctx: PredicateContext) => DA50RG_CAS.active(ctx, DA50RG_ENV).map((m) => m.id);

  it('the three rules are cautions in the order pitot_heat, stall_heat, stall_heat_ground', () => {
    const rules = DA50RG_CAS.rules.map((r) => r.id);
    const first = rules.indexOf('pitot_heat');
    expect(rules.slice(first, first + 3)).toEqual([
      'pitot_heat',
      'stall_heat',
      'stall_heat_ground',
    ]);
    expect(DA50RG_CAS.get('pitot_heat')).toMatchObject({ text: 'PITOT HEAT', level: 'caution' });
    expect(DA50RG_CAS.get('stall_heat')).toMatchObject({ text: 'STALL HEAT', level: 'caution' });
    expect(DA50RG_CAS.get('stall_heat_ground')).toMatchObject({
      text: 'STALL HEAT',
      level: 'caution',
    });
  });

  it('the first two are state checks on the rocker, the third a band check without a number', () => {
    expect(DA50RG_CAS.get('pitot_heat')?.when).toEqual({
      check: 'state',
      control: 'sw.pitot_stall_heat',
      is: OFF,
    });
    expect(DA50RG_CAS.get('stall_heat')?.when).toEqual(DA50RG_CAS.get('pitot_heat')?.when);
    expect(DA50RG_CAS.get('stall_heat_ground')?.when).toEqual({
      check: 'band',
      quantity: 'stall_heat_timer_s',
      in: ['cut'],
    });
  });

  it('the rocker off gives the two chips, the rocker on none', () => {
    expect(ids(withHeat(OFF))).toEqual(['pitot_heat', 'stall_heat']);
    expect(ids(withHeat(HEAT_DEF?.default ?? ''))).toEqual([]);
  });

  it('the ground rule shows on the cut band alone, off at its lower bound', () => {
    const on = HEAT_DEF?.default ?? '';
    expect(ids(withHeat(on, warmTop))).toEqual([]);
    expect(ids(withHeat(on, warmTop + 0.1))).toEqual(['stall_heat_ground']);
    expect(ids(withHeat(on, cutTop))).toEqual(['stall_heat_ground']);
  });

  it('they come after warnings and before advisories', () => {
    const ctx = withHeat(OFF);
    const loaded: PredicateContext = {
      ...ctx,
      quantities: { ...ctx.quantities, oil_temp_c: 126, fuel_trans_active: 1 },
    };
    expect(ids(loaded)).toEqual(['eng_oil_temp', 'pitot_heat', 'stall_heat', 'fuel_trans']);
  });

  it('the rocker off while the timer still sits in the cut band shows one STALL HEAT (WR-04)', () => {
    // The bridge mixes the live rocker with the quantities of the last step: for one step the rocker
    // reads off and the timer is still cut. Both STALL HEAT rules hold, one chip shows.
    const stale = withHeat(OFF, cutTop);
    const messages = DA50RG_CAS.active(stale, DA50RG_ENV);
    expect(messages.filter((m) => m.text === 'STALL HEAT')).toHaveLength(1);
    expect(messages.map((m) => m.id)).toEqual(['pitot_heat', 'stall_heat']);
  });

  it('no two messages of the whole table ever share a text (any rocker state, any timer)', () => {
    for (const state of [OFF, HEAT_DEF?.default ?? '']) {
      for (const seconds of [NO_TIMER, warmTop, cutTop]) {
        const texts = DA50RG_CAS.active(withHeat(state, seconds), DA50RG_ENV).map((m) => m.text);
        expect(new Set(texts).size, `${state} ${String(seconds)}`).toBe(texts.length);
      }
    }
  });
});

describe('casColumnRows (Phase 6.1: the stacked CAS column)', () => {
  it('gives no rows for no message', () => {
    expect(casColumnRows(0)).toEqual([]);
  });

  it('shares x and width between the rows', () => {
    for (let n = 1; n <= MAX_CAS_CHIPS; n += 1) {
      const rows = casColumnRows(n);
      expect(new Set(rows.map((r) => r.x)).size, `n ${String(n)}`).toBe(1);
      expect(new Set(rows.map((r) => r.width)).size, `n ${String(n)}`).toBe(1);
    }
  });

  it('joins the rows without a gap: the bottom of row i is the top of row i + 1', () => {
    const rows = casColumnRows(MAX_CAS_CHIPS);
    rows.slice(0, -1).forEach((row, i) => {
      expect(row.y + row.height, `row ${String(i)}`).toBe(rows[i + 1]?.y);
    });
  });

  it('keeps the bottom edge for every count and raises the top edge by one row per message', () => {
    const bottomOf = (n: number): number => {
      const last = casColumnRows(n).at(-1);
      return (last?.y ?? Number.NaN) + (last?.height ?? Number.NaN);
    };
    const topOf = (n: number): number => casColumnRows(n)[0]?.y ?? Number.NaN;
    for (let n = 1; n <= MAX_CAS_CHIPS; n += 1) {
      expect(bottomOf(n), `bottom ${String(n)}`).toBe(CAS_COLUMN.bottom);
      expect(topOf(n), `top ${String(n)}`).toBe(CAS_COLUMN.bottom - n * CAS_COLUMN.rowHeight);
    }
    expect(topOf(1) - topOf(2)).toBe(CAS_COLUMN.rowHeight);
  });

  it('draws only the rows that exist for more than the maximum', () => {
    expect(MAX_CAS_CHIPS).toBe(6);
    expect(casColumnRows(7)).toEqual(casColumnRows(MAX_CAS_CHIPS));
    expect(casColumnRows(7)).toHaveLength(MAX_CAS_CHIPS);
    expect(casColumnRows(-1)).toEqual([]);
  });

  it('the real DA50 RG table lists warning, caution, advisory and CasChips draws that list as given', () => {
    const base = at(90);
    const ctx: PredicateContext = {
      ...base,
      controls: { 'sw.pitot_stall_heat': 'off' },
      quantities: { ...base.quantities, oil_temp_c: 126, fuel_trans_active: 1 },
    };
    const list = DA50RG_CAS.active(ctx, DA50RG_ENV);
    expect(list.map((m) => m.level)).toEqual(['warning', 'caution', 'caution', 'advisory']);
    const chips = findElements(
      expand(CasChips({ active: list })),
      (e) => e.props['data-testid'] === 'cas-chip',
    );
    expect(chips.map((c) => c.props['data-cas-id'])).toEqual(list.map((m) => m.id));
    expect(chips.map((c) => c.props['data-level'])).toEqual(list.map((m) => m.level));
  });

  it('draws a synthetic list in the order given, without sorting it', () => {
    // The table lists the levels in display order on its own, so the column needs no sorting.
    const mixed = defineCasRules(
      [
        rule('a1', { level: 'advisory', text: 'A ONE' }),
        rule('c1', { level: 'caution', text: 'C ONE' }),
        rule('w1', { text: 'W ONE' }),
        rule('c2', { level: 'caution', text: 'C TWO' }),
      ],
      env,
    );
    const list = mixed.active(at(120), env);
    expect(list.map((m) => m.level)).toEqual(['warning', 'caution', 'caution', 'advisory']);
    const chips = findElements(
      expand(CasChips({ active: list })),
      (e) => e.props['data-testid'] === 'cas-chip',
    );
    expect(chips.map((c) => c.props['data-cas-id'])).toEqual(list.map((m) => m.id));
    const ys = chips.map((c) => Number(findElements(c, (e) => e.tag === 'rect')[0]?.props['y']));
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });
});
