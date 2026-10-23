import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { initialQuantities, realisticQuantities } from '../src/engine/predicates';
import { STEP_MS, simSetup, simulate } from '../src/engine/sim';
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

describe('grade on Realistic: the simulation pops the breaker at the onset (V-06)', () => {
  const ONSET = { at: 3000, seed: 1 };
  const realistic = (
    variant: string,
    events: Recording['events'],
    completedAt = 60_000,
  ): Recording => ({ ...recording(variant, events, completedAt), onset: ONSET });

  it('a push after the onset passes and is entered at its own event', () => {
    const result = grade(
      ALTN,
      DA50RG_ENV,
      realistic('breaker_popped', [{ t: 5000, id: 'cb.alt1', value: 'in' }]),
    );
    expect(result.result).toBe('pass');
    expect(result.steps).toEqual([
      {
        id: 'alt1_breaker_in',
        group: 'breaker_check',
        severity: 'critical',
        credited: true,
        enteredAt: 0,
      },
    ]);
  });

  it('a push only before the onset fails: the breaker pops at the onset (R12)', () => {
    const result = grade(
      ALTN,
      DA50RG_ENV,
      realistic('breaker_popped', [
        { t: 500, id: 'cb.alt1', value: 'out' },
        { t: 800, id: 'cb.alt1', value: 'in' },
      ]),
    );
    expect(result.result).toBe('fail');
    expect(result.reasons).toEqual([{ kind: 'critical_missed', count: 1 }]);
  });

  it('a do-nothing run fails and the pair is not what this cause wants', () => {
    expect(grade(ALTN, DA50RG_ENV, realistic('breaker_popped', [])).result).toBe('fail');
    const pair = realistic('breaker_popped', [
      { t: 5000, id: 'sw.alternator_1', value: 'off' },
      { t: 6000, id: 'sw.ess_bus', value: 'on' },
    ]);
    expect(grade(ALTN, DA50RG_ENV, pair).result).toBe('fail');
  });

  it('alternator_dead on Realistic: the pair after the onset passes, nothing fails', () => {
    const pair = realistic('alternator_dead', [
      { t: 5000, id: 'sw.alternator_1', value: 'off' },
      { t: 6000, id: 'sw.ess_bus', value: 'on' },
    ]);
    expect(grade(ALTN, DA50RG_ENV, pair).result).toBe('pass');
    expect(grade(ALTN, DA50RG_ENV, realistic('alternator_dead', [])).result).toBe('fail');
  });

  it('the replay is deterministic', () => {
    const rec = realistic('breaker_popped', [{ t: 5000, id: 'cb.alt1', value: 'in' }]);
    expect(JSON.stringify(grade(ALTN, DA50RG_ENV, rec))).toBe(
      JSON.stringify(grade(ALTN, DA50RG_ENV, rec)),
    );
  });
});

// Every cause of the shipped file (plan 03.1-02, V-10, V-11): one table, the ids read from the file.
describe('every variant of ALTN 1 FAIL, replayed on Easy and on Realistic', () => {
  const BREAKER = 'cb.alt1';
  const ONSET_AT = 3000;
  const ALT2_OFF = { id: 'sw.alternator_2', value: 'off' };
  const ids = ALTN.variants.map((v) => v.id);

  /** Pilot actions at offsets from the start of the pilot's work; the table is checked against the file. */
  const solutions: Record<string, readonly { dt: number; id: string; value: string }[]> = {
    alternator_dead: [
      { dt: 0, id: 'sw.alternator_1', value: 'off' },
      { dt: 1000, id: 'sw.ess_bus', value: 'on' },
    ],
    breaker_popped: [{ dt: 0, id: BREAKER, value: 'in' }],
    // The push comes first and pops again after the delay, the two switches follow.
    alternator_shorted: [
      { dt: 0, id: BREAKER, value: 'in' },
      { dt: 4000, id: 'sw.alternator_1', value: 'off' },
      { dt: 5000, id: 'sw.ess_bus', value: 'on' },
    ],
    breaker_popped_dead: [
      { dt: 0, id: BREAKER, value: 'in' },
      { dt: 2000, id: 'sw.alternator_1', value: 'off' },
      { dt: 3000, id: 'sw.ess_bus', value: 'on' },
    ],
  };
  /** The switches the scenario asks for in this variant, read from the variant's `applies`. */
  const required = (id: string) => ALTN.variants.find((v) => v.id === id)?.applies.length ?? 0;
  const popped = (id: string) =>
    ALTN.variants.find((v) => v.id === id)?.controls[BREAKER] === 'out';

  it('the table has exactly the variants of the file', () => {
    expect(Object.keys(solutions).sort()).toEqual([...ids].sort());
    expect(ids.length).toBe(4);
  });

  // The ordered copy of the file: the same steps in an ordered, order-critical group.
  const ALTN_TEXT = readFileSync(`${root}scenarios/electrical/elec-altn1-fail.toon`, 'utf8');
  const ORDERED_TEXT = ALTN_TEXT.replace(
    '    id: immediate\n    ordered: false',
    '    id: immediate\n    ordered: true\n    order_critical: true',
  );
  expect(ORDERED_TEXT).not.toBe(ALTN_TEXT);
  const ORDERED = (() => {
    const checked = checkScenario(ORDERED_TEXT, DA50RG_ENV);
    if (!checked.ok) throw new Error('the ordered copy does not pass the scenario check');
    return checked.scenario;
  })();

  for (const realistic of [false, true]) {
    const level = realistic ? 'Realistic' : 'Easy';
    // On Realistic the pilot acts after the onset.
    const base = realistic ? ONSET_AT + 2000 : ONSET_AT;
    const rec = (
      id: string,
      events: readonly { t: number; id: string; value: string }[],
      completedAt: number,
    ): Recording => ({
      scenarioId: ALTN.id,
      completedAt,
      variant: { id, seed: 7 },
      ...(realistic ? { onset: { at: ONSET_AT, seed: 1 } } : {}),
      events,
    });
    const golden = (id: string) =>
      (solutions[id] ?? []).map((a) => ({ t: base + a.dt, id: a.id, value: a.value }));
    const withoutPush = (id: string) => golden(id).filter((e) => e.id !== BREAKER);

    describe(level, () => {
      for (const id of ids) {
        it(`${id}: the golden run passes with nothing harmful, short and 600 s long`, () => {
          const short = grade(ALTN, DA50RG_ENV, rec(id, golden(id), 30_000));
          expect(short.result).toBe('pass');
          expect(short.harmful).toEqual([]);
          const long = grade(ALTN, DA50RG_ENV, rec(id, golden(id), 600_000));
          expect(long.result).toBe('pass');
          expect(long.outcome).toBeNull();
        });

        it(`${id}: doing nothing fails, misses every critical step and runs into the bus loss`, () => {
          const idle = grade(ALTN, DA50RG_ENV, rec(id, [], 30_000));
          expect(idle.result).toBe('fail');
          expect(idle.reasons).toContainEqual({ kind: 'critical_missed', count: required(id) });
          const long = grade(ALTN, DA50RG_ENV, rec(id, [], 600_000));
          expect(long.outcome?.id).toBe('main_bus_lost');
          expect(long.result).toBe('fail');
        });

        it(`${id}: switching off alternator 2 fails for that reason alone`, () => {
          const events = [...golden(id), { t: base + 500, ...ALT2_OFF }];
          const result = grade(ALTN, DA50RG_ENV, rec(id, events, 30_000));
          expect(result.result).toBe('fail');
          expect(result.reasons.map((r) => r.kind)).toEqual(['forbidden']);
          expect(result.harmful.map((h) => h.id)).toEqual(['alt2_off']);
        });

        if (required(id) === 2) {
          it(`${id}: ESS BUS before ALTERNATOR 1 breaks the order of an ordered group`, () => {
            const events = withoutPush(id)
              .reverse()
              .map((e, i) => ({ ...e, t: base + i * 1000 }));
            const result = grade(ORDERED, DA50RG_ENV, rec(id, events, 30_000));
            expect(result.result).toBe('fail');
            expect(result.reasons).toEqual([{ kind: 'order', group: 'immediate' }]);
            const right = grade(ORDERED, DA50RG_ENV, rec(id, withoutPush(id), 30_000));
            expect(right.result).toBe('pass');
          });
        }
      }
    });
  }

  const resolvedRun = (id: string, realistic: boolean, events: SimEventLike[], until: number) => {
    const resolved = resolveVariant(ALTN, id, realistic);
    const setup = simSetup(DA50RG_ENV, resolved, realistic ? { onsetAt: ONSET_AT } : {});
    const start = realistic
      ? realisticQuantities(resolved, DA50RG_ENV.quantities)
      : initialQuantities(resolved, DA50RG_ENV.quantities);
    return simulate(setup, { events, start, untilMs: until });
  };
  type SimEventLike = { t: number; id: string; value: string };
  const casRule = DA50RG_CAS.get('altn_1_fail');
  if (casRule?.when.check !== 'band') throw new Error('ALTN 1 FAIL reads no band');
  const FAULT_QUANTITY = casRule.when.quantity;
  const FAULT_BANDS = casRule.when.in;
  const messageOn = (state: { quantities: Readonly<Record<string, number>> }) =>
    FAULT_BANDS.includes(
      DA50RG_ENV.quantities.bandOf(FAULT_QUANTITY, state.quantities[FAULT_QUANTITY] ?? 0),
    );

  it('breaker_popped: pushing the breaker in clears the message within seconds', () => {
    const push = [{ t: 0, id: BREAKER, value: 'in' }];
    expect(messageOn(resolvedRun('breaker_popped', false, [], 8000).state)).toBe(true);
    expect(messageOn(resolvedRun('breaker_popped', false, push, 8000).state)).toBe(false);
  });

  it('breaker_popped: ALTERNATOR 1 off plus ESS BUS on alone fails, the breaker step is missed', () => {
    const rec = {
      scenarioId: ALTN.id,
      completedAt: 30_000,
      variant: { id: 'breaker_popped', seed: 7 },
      events: [
        { t: 3000, id: 'sw.alternator_1', value: 'off' },
        { t: 4000, id: 'sw.ess_bus', value: 'on' },
      ],
    };
    const result = grade(ALTN, DA50RG_ENV, rec);
    expect(result.result).toBe('fail');
    expect(result.reasons).toEqual([{ kind: 'critical_missed', count: 1 }]);
  });

  it('alternator_shorted: the pushed breaker is out again after the delay, the message stays', () => {
    const push = [{ t: 0, id: BREAKER, value: 'in' }];
    const run = resolvedRun('alternator_shorted', false, push, 10_000);
    expect(run.injected).toEqual([{ t: 2000, id: BREAKER, value: 'out', before: 1 }]);
    expect(run.state.controls[BREAKER]).toBe('out');
    expect(messageOn(run.state)).toBe(true);
    const early = resolvedRun('alternator_shorted', false, push, 2000 - STEP_MS);
    expect(early.state.controls[BREAKER]).toBe('in');
  });

  it('breaker_popped_dead: the pushed breaker stays in and the message stays', () => {
    const push = [{ t: 0, id: BREAKER, value: 'in' }];
    const run = resolvedRun('breaker_popped_dead', false, push, 20_000);
    expect(run.injected).toEqual([]);
    expect(run.state.controls[BREAKER]).toBe('in');
    expect(messageOn(run.state)).toBe(true);
  });

  it('Realistic: the breaker is in before the onset in every variant, out after it in the popped ones', () => {
    for (const id of ids) {
      const before = resolvedRun(id, true, [], ONSET_AT - STEP_MS);
      expect(before.state.controls[BREAKER], `${id} before`).toBe('in');
      const after = resolvedRun(id, true, [], ONSET_AT + 2 * STEP_MS);
      expect(after.state.controls[BREAKER], `${id} after`).toBe(popped(id) ? 'out' : 'in');
    }
  });
});
