import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import {
  baselineOf,
  evaluatePredicate,
  initialQuantities,
  PredicateError,
  travelPercent,
} from '../src/engine/predicates';
import type { PredicateContext } from '../src/engine/predicates';
import { parseScenario } from '../src/scenario/parse';
import type { Predicate } from '../src/scenario/schema';

const root = fileURLToPath(new URL('../', import.meta.url));
const text = readFileSync(join(root, 'scenarios/engine/eng-oil-temp-green.toon'), 'utf8');
const parsed = parseScenario(text);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
const scenario = parsed.value;

const baseline = baselineOf(scenario, DA50RG_ENV.registry);
const quantities = initialQuantities(scenario, DA50RG_ENV.quantities);

/** Context with a different power and cowl state and quantity values; baseline stays p75. */
function ctx(
  controls: Record<string, string> = {},
  values: Record<string, number> = {},
): PredicateContext {
  return {
    controls: { ...baseline, ...controls },
    baseline,
    quantities: { ...quantities, ...values },
  };
}
const holds = (p: Predicate, c: PredicateContext = ctx()): boolean =>
  evaluatePredicate(p, c, DA50RG_ENV);

const power = DA50RG_ENV.registry.get('lv.power');
if (power?.kind !== 'detent-lever') throw new Error('lv.power must be a detent lever');

describe('travelPercent', () => {
  it('equals the number of every POWER detent p0 to p100 exactly', () => {
    expect(power.detents).toHaveLength(21);
    for (const detent of power.detents) {
      expect(travelPercent(power, detent.id)).toBe(Number(detent.id.slice(1)));
    }
  });

  it('throws for a state that is not a detent', () => {
    expect(() => travelPercent(power, 'p77')).toThrow(PredicateError);
  });
});

describe('baselineOf and initialQuantities', () => {
  it('overlays the initial controls on the registry defaults', () => {
    expect(baseline['lv.power']).toBe('p75');
    expect(baseline['lv.cowl_flap']).toBe('closed');
    expect(Object.keys(baseline)).toHaveLength(DA50RG_ENV.registry.controls.length);
  });

  it('overlays the initial quantities on the idle values', () => {
    expect(quantities).toEqual({ oil_temp_c: 128, oil_pressure_bar: 5 });
    const bare = { ...scenario, initial: { controls: {}, quantities: { oil_temp_c: 90 } } };
    expect(initialQuantities(bare, DA50RG_ENV.quantities)).toEqual({
      oil_temp_c: 90,
      oil_pressure_bar: 0,
    });
  });

  it('throws for an unknown or prototype key', () => {
    const bad = (key: string) => ({
      ...scenario,
      initial: { controls: { [key]: 'x' }, quantities: {} },
    });
    expect(() => baselineOf(bad('lv.nope'), DA50RG_ENV.registry)).toThrow(PredicateError);
    expect(() => baselineOf(bad('constructor'), DA50RG_ENV.registry)).toThrow(PredicateError);
    const badQuantity = { ...scenario, initial: { controls: {}, quantities: { nope: 1 } } };
    expect(() => initialQuantities(badQuantity, DA50RG_ENV.quantities)).toThrow(PredicateError);
  });
});

describe('every Table F3 check has a true and a false case', () => {
  it('state', () => {
    expect(holds({ check: 'state', control: 'lv.cowl_flap', is: 'closed' })).toBe(true);
    expect(holds({ check: 'state', control: 'lv.cowl_flap', is: 'open' })).toBe(false);
  });

  it('state_in', () => {
    const p: Extract<Predicate, { check: 'state_in' }> = {
      check: 'state_in',
      control: 'lv.cowl_flap',
      in: ['open', 'closed'],
    };
    expect(holds(p)).toBe(true);
    expect(holds({ ...p, in: ['open'] })).toBe(false);
  });

  it('travel with every operator', () => {
    const at = (op: 'lt' | 'lte' | 'gt' | 'gte', value: number) =>
      holds({ check: 'travel', control: 'lv.power', op, value }); // power is p75
    expect([at('lt', 76), at('lt', 75)]).toEqual([true, false]);
    expect([at('lte', 75), at('lte', 74)]).toEqual([true, false]);
    expect([at('gt', 74), at('gt', 75)]).toEqual([true, false]);
    expect([at('gte', 75), at('gte', 76)]).toEqual([true, false]);
  });

  it('travel_rel relative to the baseline', () => {
    const rel = (op: 'lt' | 'lte' | 'gt' | 'gte', delta: number, power: string) =>
      holds({ check: 'travel_rel', control: 'lv.power', op, delta }, ctx({ 'lv.power': power }));
    expect(rel('lte', -10, 'p65')).toBe(true);
    expect(rel('lte', -10, 'p70')).toBe(false);
    expect(rel('gt', 0, 'p80')).toBe(true);
    expect(rel('gt', 0, 'p75')).toBe(false);
    expect(rel('gte', 5, 'p80')).toBe(true);
    expect(rel('lt', 5, 'p80')).toBe(false);
  });

  it('quantity', () => {
    const q = (op: 'lt' | 'lte' | 'gt' | 'gte', value: number) =>
      holds({ check: 'quantity', quantity: 'oil_temp_c', op, value }); // oil_temp_c is 128
    expect([q('gt', 127), q('gt', 128)]).toEqual([true, false]);
    expect([q('gte', 128), q('gte', 129)]).toEqual([true, false]);
    expect([q('lt', 129), q('lt', 128)]).toEqual([true, false]);
    expect([q('lte', 128), q('lte', 127)]).toEqual([true, false]);
  });

  it('band', () => {
    const p: Extract<Predicate, { check: 'band' }> = {
      check: 'band',
      quantity: 'oil_temp_c',
      in: ['high_red'],
    };
    expect(holds(p)).toBe(true);
    expect(holds(p, ctx({}, { oil_temp_c: 100 }))).toBe(false);
    expect(holds({ ...p, in: ['green', 'high_red'] }, ctx({}, { oil_temp_c: 100 }))).toBe(true);
  });
});

describe('programmer errors', () => {
  it('throws for an unknown control or quantity', () => {
    expect(() => holds({ check: 'state', control: 'lv.nope', is: 'x' })).toThrow(PredicateError);
    expect(() => holds({ check: 'state', control: 'constructor', is: 'x' })).toThrow(
      PredicateError,
    );
    expect(() => holds({ check: 'quantity', quantity: 'nope', op: 'gt', value: 1 })).toThrow(
      PredicateError,
    );
    expect(() => holds({ check: 'band', quantity: 'nope', in: ['green'] })).toThrow(PredicateError);
  });

  it('throws for a travel check on a control that is not a detent lever', () => {
    expect(() => holds({ check: 'travel', control: 'sw.fadec', op: 'gt', value: 1 })).toThrow(
      PredicateError,
    );
    expect(() => holds({ check: 'travel_rel', control: 'sw.fadec', op: 'gt', delta: 1 })).toThrow(
      PredicateError,
    );
  });
});
