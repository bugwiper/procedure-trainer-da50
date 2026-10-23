import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
import { acuFault, alternatorOnline } from '../src/aircraft/da50rg/electrical';
import type { Alternator, ElectricalInputs } from '../src/aircraft/da50rg/electrical';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { DA50RG_PHYSICS } from '../src/aircraft/da50rg/physics';
import { initialQuantities } from '../src/engine/predicates';
import { simSetup, simulate } from '../src/engine/sim';
import { checkScenario } from '../src/scenario/lint';

// The DA50 RG electrical system as aircraft data (phase 4). The expected values are typed from the
// wiring diagrams and Figure 1 of the aircraft documents (described in .planning, never copied), not
// computed from the code under test.

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = checkScenario(
  readFileSync(`${root}scenarios/engine/eng-oil-temp-green.toon`, 'utf8'),
  DA50RG_ENV,
);
if (!checked.ok) throw new Error('the blueprint does not pass the scenario check');
const blueprint = checked.scenario;

/** The control states at the registry defaults (in-flight cruise), overlaid by the given ones. */
function controlsWith(over: Record<string, string> = {}): Record<string, string> {
  const controls: Record<string, string> = {};
  for (const def of DA50RG.controls) controls[def.id] = def.default;
  return { ...controls, ...over };
}

const NORMAL = DA50RG_PHYSICS.normalParameters();

function inputs(
  controls: Record<string, string> = {},
  parameters: Record<string, number> = {},
): ElectricalInputs {
  return { controls: controlsWith(controls), parameters: { ...NORMAL, ...parameters } };
}

const ALTERNATORS: readonly Alternator[] = [1, 2];

describe('alternatorOnline and acuFault (E-04, E-07)', () => {
  for (const n of ALTERNATORS) {
    const sw = `sw.alternator_${String(n)}`;
    const cb = `cb.alt${String(n)}`;
    const output = `alt${String(n)}_output`;
    const short = `alt${String(n)}_short`;

    it(`alternator ${String(n)}: online and without a fault in the normal state`, () => {
      expect(alternatorOnline(inputs(), n, true)).toBe(true);
      expect(acuFault(inputs(), n)).toBe(false);
    });

    it(`alternator ${String(n)}: each cause alone raises the fault`, () => {
      expect(acuFault(inputs({}, { [output]: 0 }), n), 'output 0').toBe(true);
      expect(acuFault(inputs({}, { [output]: 0.5 }), n), 'output below normal').toBe(true);
      expect(acuFault(inputs({}, { [short]: 1 }), n), 'short').toBe(true);
      expect(acuFault(inputs({ [cb]: 'out' }), n), 'breaker out').toBe(true);
      expect(acuFault(inputs({ [sw]: 'off' }), n), 'switch OFF').toBe(true);
    });

    it(`alternator ${String(n)}: each cause alone takes it offline, a short alone does not`, () => {
      expect(alternatorOnline(inputs({}, { [output]: 0 }), n, true)).toBe(false);
      expect(alternatorOnline(inputs({ [cb]: 'out' }), n, true)).toBe(false);
      expect(alternatorOnline(inputs({ [sw]: 'off' }), n, true)).toBe(false);
      expect(alternatorOnline(inputs({}, { [short]: 1 }), n, true)).toBe(true);
    });

    it(`alternator ${String(n)}: engine stopped or ELECT. MASTER off is offline but no fault`, () => {
      expect(alternatorOnline(inputs(), n, false)).toBe(false);
      expect(acuFault(inputs(), n)).toBe(false);
      const masterOff = inputs({ 'sw.elect_master': 'off' });
      expect(alternatorOnline(masterOff, n, true)).toBe(false);
      expect(acuFault(masterOff, n)).toBe(false);
    });
  }

  it('the alternators are independent of each other', () => {
    const one = inputs({}, { alt1_output: 0 });
    expect(acuFault(one, 1)).toBe(true);
    expect(acuFault(one, 2)).toBe(false);
    expect(alternatorOnline(one, 2, true)).toBe(true);
  });
});

describe('a failed alternator raises its caution within one step and nothing else', () => {
  const setupFor = (parameters: Record<string, number>) => {
    const scenario = {
      ...blueprint,
      initial: { controls: {}, quantities: {} },
      parameters,
    };
    return {
      setup: simSetup(DA50RG_ENV, scenario),
      start: initialQuantities(scenario, DA50RG_ENV.quantities),
    };
  };
  const run = (parameters: Record<string, number>, untilMs: number) => {
    const { setup, start } = setupFor(parameters);
    return simulate(setup, { events: [], start, untilMs }).state;
  };
  const active = (state: ReturnType<typeof run>): string[] =>
    DA50RG_CAS.active(
      { controls: state.controls, baseline: {}, quantities: state.quantities },
      DA50RG_ENV,
    ).map((m) => m.id);

  it('the base state shows no caution', () => {
    expect(active(run({}, 1000))).toEqual([]);
  });

  it('alt2_output 0: ALTN 2 FAIL after one step, alt1_fault stays 0', () => {
    const state = run({ alt2_output: 0 }, 100);
    expect(state.quantities['alt2_fault']).toBe(1);
    expect(state.quantities['alt1_fault']).toBe(0);
    expect(active(state)).toEqual(['altn_2_fail']);
    expect(active(run({ alt2_output: 0 }, 60_000))).toEqual(['altn_2_fail']);
  });

  it('alt1_output 0: ALTN 1 FAIL after one step, alt2_fault stays 0', () => {
    const state = run({ alt1_output: 0 }, 100);
    expect(state.quantities['alt1_fault']).toBe(1);
    expect(state.quantities['alt2_fault']).toBe(0);
    expect(active(state)).toEqual(['altn_1_fail']);
    expect(active(run({ alt1_output: 0 }, 60_000))).toEqual(['altn_1_fail']);
  });
});
