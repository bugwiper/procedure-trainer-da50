import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { resolveVariant, variantFromSeed } from '../src/engine/variants';
import { checkScenario } from '../src/scenario/lint';
import type { ProcedureNode, Scenario } from '../src/scenario/schema';

// Scenario variants (phase 3.1, SCN-09): resolveVariant, variantFromSeed and the grade of a
// recording that names a variant. The shipped ALTN 1 FAIL file is the subject.

const root = fileURLToPath(new URL('../', import.meta.url));

function load(name: string): Scenario {
  const checked = checkScenario(readFileSync(`${root}scenarios/${name}.toon`, 'utf8'), DA50RG_ENV);
  if (!checked.ok) throw new Error(`${name} does not pass the scenario check`);
  return checked.scenario;
}

const ALTN = load('electrical/elec-altn1-fail');
const OIL = load('engine/eng-oil-temp-green');

/** The ids of every step of a procedure, in document order. */
function stepIds(nodes: readonly ProcedureNode[]): string[] {
  return nodes.flatMap((node): string[] => {
    switch (node.kind) {
      case 'group':
        return node.steps.map((step) => step.id);
      case 'branch':
        return stepIds(node.nodes);
      case 'decision':
        return node.branches.flatMap((branch) => stepIds(branch.nodes));
      default:
        return [];
    }
  });
}

const recording = (
  variant: string | null,
  events: Recording['events'],
  completedAt = 20_000,
): Recording => ({
  scenarioId: ALTN.id,
  completedAt,
  ...(variant === null ? {} : { variant: { id: variant, seed: 7 } }),
  events,
});

const PUSH = { t: 3000, id: 'cb.alt1', value: 'in' };
const ALT_OFF = { t: 3000, id: 'sw.alternator_1', value: 'off' };
const ESS_ON = { t: 4000, id: 'sw.ess_bus', value: 'on' };

describe('resolveVariant', () => {
  it('returns a scenario without variants as it is', () => {
    expect(resolveVariant(OIL, null, false)).toBe(OIL);
    expect(resolveVariant(OIL, null, true)).toBe(OIL);
  });

  it('throws for an unknown variant and for a variant of a scenario without any', () => {
    expect(() => resolveVariant(ALTN, 'no_such_cause', false)).toThrow(/no_such_cause/);
    expect(() => resolveVariant(OIL, 'alternator_dead', false)).toThrow(/alternator_dead/);
  });

  it('lays the controls over the initial state and the parameters over the scenario', () => {
    const popped = resolveVariant(ALTN, 'breaker_popped', false);
    expect(popped.initial.controls['cb.alt1']).toBe('out');
    expect(popped.parameters['alt1_output']).toBe(1);
    expect(popped.onset?.controls).toEqual({});
    expect(popped.variants).toEqual([]);
    const dead = resolveVariant(ALTN, 'alternator_dead', false);
    expect(dead.initial.controls).toEqual(ALTN.initial.controls);
    expect(dead.parameters).toEqual(ALTN.parameters);
  });

  it('with an onset keeps the start clean and sets the controls at the onset', () => {
    const popped = resolveVariant(ALTN, 'breaker_popped', true);
    expect(popped.initial.controls).toEqual(ALTN.initial.controls);
    expect(popped.onset?.controls['cb.alt1']).toBe('out');
    expect(popped.onset?.parameters['alt1_output']).toBe(1);
    expect(popped.parameters['alt1_output']).toBe(1);
  });

  it('keeps only the steps that apply and every node, so paths stay those of the file', () => {
    const declared = stepIds(ALTN.procedure);
    expect(declared).toEqual(['alt1_breaker_in', 'alt1_off', 'ess_bus_on']);
    expect(stepIds(resolveVariant(ALTN, 'breaker_popped', false).procedure)).toEqual([
      'alt1_breaker_in',
    ]);
    expect(stepIds(resolveVariant(ALTN, 'alternator_dead', false).procedure)).toEqual([
      'alt1_off',
      'ess_bus_on',
    ]);
    const kinds = (s: Scenario) => s.procedure.map((node) => node.kind);
    expect(kinds(resolveVariant(ALTN, 'breaker_popped', false))).toEqual(kinds(ALTN));
  });

  it('a missing id is the first variant', () => {
    const first = ALTN.variants[0]?.id ?? '';
    expect(resolveVariant(ALTN, null, false)).toEqual(resolveVariant(ALTN, first, false));
    expect(resolveVariant(ALTN, null, true)).toEqual(resolveVariant(ALTN, first, true));
  });
});

describe('variantFromSeed', () => {
  it('shares the draws as the weights say, deterministically', () => {
    const total = ALTN.variants.reduce((sum, v) => sum + v.weight, 0);
    const draws = 20_000;
    const counts = new Map<string, number>();
    for (let seed = 0; seed < draws; seed++) {
      const id = variantFromSeed(seed, ALTN.variants);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const v of ALTN.variants) {
      expect((counts.get(v.id) ?? 0) / draws).toBeCloseTo(v.weight / total, 1);
    }
    expect(variantFromSeed(12345, ALTN.variants)).toBe(variantFromSeed(12345, ALTN.variants));
  });

  it('throws for an empty list', () => {
    expect(() => variantFromSeed(1, [])).toThrow(RangeError);
  });
});

describe('grade replays the recorded variant', () => {
  it('breaker_popped: pushing the breaker in passes', () => {
    const result = grade(ALTN, DA50RG_ENV, recording('breaker_popped', [PUSH]));
    expect(result.result).toBe('pass');
    expect(result.variant).toBe('breaker_popped');
    expect(result.steps.map((s) => s.id)).toEqual(['alt1_breaker_in']);
  });

  it('breaker_popped: ALTERNATOR 1 off and ESS BUS on only fails', () => {
    const result = grade(ALTN, DA50RG_ENV, recording('breaker_popped', [ALT_OFF, ESS_ON]));
    expect(result.result).toBe('fail');
    expect(result.reasons).toEqual([{ kind: 'critical_missed', count: 1 }]);
  });

  it('alternator_dead: the pair passes and the breaker alone fails', () => {
    const pair = grade(ALTN, DA50RG_ENV, recording('alternator_dead', [ALT_OFF, ESS_ON]));
    expect(pair.result).toBe('pass');
    expect(pair.steps.map((s) => s.id)).toEqual(['alt1_off', 'ess_bus_on']);
    expect(grade(ALTN, DA50RG_ENV, recording('alternator_dead', [PUSH])).result).toBe('fail');
  });

  it('a recording that names no variant grades as the first one and carries no variant', () => {
    const none = grade(ALTN, DA50RG_ENV, recording(null, [ALT_OFF, ESS_ON]));
    expect(none.result).toBe('pass');
    expect('variant' in none).toBe(false);
    expect(none.steps).toEqual(
      grade(ALTN, DA50RG_ENV, recording('alternator_dead', [ALT_OFF, ESS_ON])).steps,
    );
  });

  it('a do-nothing run fails in every variant', () => {
    for (const v of ALTN.variants) {
      expect(grade(ALTN, DA50RG_ENV, recording(v.id, [], 60_000)).result, v.id).toBe('fail');
    }
  });
});
