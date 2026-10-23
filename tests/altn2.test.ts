import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { initialQuantities, realisticQuantities } from '../src/engine/predicates';
import { STEP_MS, simSetup, simulate } from '../src/engine/sim';
import { resolveVariant } from '../src/engine/variants';
import { checkScenario } from '../src/scenario/lint';
import type { Scenario } from '../src/scenario/schema';

// ALTN 2 FAIL (phase 4, plan 02, E-12 to E-14): every cause of the shipped file replayed on Easy and
// on Realistic, the harmful and harmless extra actions, and the simulated bus. Ids and counts are
// read from the shipped file; the table of pilot solutions is checked against it.

const root = fileURLToPath(new URL('../', import.meta.url));
const FILE = `${root}scenarios/electrical/elec-altn2-fail.toon`;

const checked = checkScenario(readFileSync(FILE, 'utf8'), DA50RG_ENV);
if (!checked.ok) throw new Error('elec-altn2-fail does not pass the scenario check');
const ALTN2: Scenario = checked.scenario;

const BREAKER = 'cb.alt2';
const ONSET_AT = 3000;
const ids = ALTN2.variants.map((v) => v.id);

type Action = { dt: number; id: string; value: string };
/** Pilot actions at offsets from the start of the pilot's work; the table is checked against the file. */
const solutions: Record<string, readonly Action[]> = {
  alternator_dead: [{ dt: 0, id: 'sw.alternator_2', value: 'off' }],
  breaker_popped: [{ dt: 0, id: BREAKER, value: 'in' }],
  // The push comes first and pops again after the delay, the switch follows.
  alternator_shorted: [
    { dt: 0, id: BREAKER, value: 'in' },
    { dt: 4000, id: 'sw.alternator_2', value: 'off' },
  ],
  breaker_popped_dead: [
    { dt: 0, id: BREAKER, value: 'in' },
    { dt: 2000, id: 'sw.alternator_2', value: 'off' },
  ],
};

const variantOf = (id: string) => ALTN2.variants.find((v) => v.id === id);
/** The critical steps the scenario asks for in this variant, read from the variant's `applies`. */
const required = (id: string) => variantOf(id)?.applies.length ?? 0;
const popped = (id: string) => variantOf(id)?.controls[BREAKER] === 'out';
const harmfulId = (control: string) => {
  const found = ALTN2.forbidden.find(
    (f) => f.trigger.check === 'state' && f.trigger.control === control,
  );
  if (found === undefined) throw new Error(`no forbidden item watches ${control}`);
  return found.id;
};

type SimEventLike = { t: number; id: string; value: string };

const resolvedRun = (id: string, realistic: boolean, events: SimEventLike[], until: number) => {
  const resolved = resolveVariant(ALTN2, id, realistic);
  const setup = simSetup(DA50RG_ENV, resolved, realistic ? { onsetAt: ONSET_AT } : {});
  const start = realistic
    ? realisticQuantities(resolved, DA50RG_ENV.quantities)
    : initialQuantities(resolved, DA50RG_ENV.quantities);
  return simulate(setup, { events, start, untilMs: until });
};

/** The ids of the active CAS messages over a simulated state. */
const messages = (state: {
  controls: Readonly<Record<string, string>>;
  quantities: Readonly<Record<string, number>>;
}): string[] =>
  DA50RG_CAS.active(
    { controls: state.controls, baseline: state.controls, quantities: state.quantities },
    DA50RG_ENV,
  ).map((m) => m.id);

const baseOf = (quantity: string) => DA50RG_ENV.quantities.get(quantity)?.base ?? Number.NaN;

describe('every variant of ALTN 2 FAIL, replayed on Easy and on Realistic', () => {
  it('the table has exactly the variants of the file', () => {
    expect(Object.keys(solutions).sort()).toEqual([...ids].sort());
    expect(ids.length).toBeGreaterThan(1);
  });

  it('the file passes checkScenario and carries no outcome', () => {
    expect(ALTN2.outcomes).toEqual([]);
  });

  for (const realistic of [false, true]) {
    const level = realistic ? 'Realistic' : 'Easy';
    // On Realistic the pilot acts after the onset.
    const base = realistic ? ONSET_AT + 2000 : ONSET_AT;
    const rec = (id: string, events: readonly SimEventLike[], completedAt: number): Recording => ({
      scenarioId: ALTN2.id,
      completedAt,
      variant: { id, seed: 7 },
      ...(realistic ? { onset: { at: ONSET_AT, seed: 1 } } : {}),
      events,
    });
    const golden = (id: string): SimEventLike[] =>
      (solutions[id] ?? []).map((a) => ({ t: base + a.dt, id: a.id, value: a.value }));

    describe(level, () => {
      for (const id of ids) {
        it(`${id}: the golden run passes with nothing harmful, short and 600 s long`, () => {
          const short = grade(ALTN2, DA50RG_ENV, rec(id, golden(id), 30_000));
          expect(short.result).toBe('pass');
          expect(short.harmful).toEqual([]);
          const long = grade(ALTN2, DA50RG_ENV, rec(id, golden(id), 600_000));
          expect(long.result).toBe('pass');
          expect(long.outcome).toBeNull();
        });

        it(`${id}: the main bus stays up after the golden run`, () => {
          const run = resolvedRun(id, realistic, golden(id), base + 60_000);
          expect(run.state.quantities['bus_volts']).toBe(baseOf('bus_volts'));
          expect(run.state.quantities['alt1_amps']).toBe(baseOf('alt1_amps'));
        });

        it(`${id}: doing nothing fails, misses every critical step and nothing escalates`, () => {
          const idle = grade(ALTN2, DA50RG_ENV, rec(id, [], 30_000));
          expect(idle.result).toBe('fail');
          expect(idle.reasons).toContainEqual({ kind: 'critical_missed', count: required(id) });
          const long = grade(ALTN2, DA50RG_ENV, rec(id, [], 600_000));
          expect(long.outcome).toBeNull();
          expect(long.result).toBe('fail');
          const run = resolvedRun(id, realistic, [], 600_000);
          expect(run.state.quantities['bus_volts']).toBe(baseOf('bus_volts'));
          expect(messages(run.state)).toContain('altn_2_fail');
        });

        it(`${id}: switching off alternator 1 fails for that reason alone`, () => {
          const events = [...golden(id), { t: base + 500, id: 'sw.alternator_1', value: 'off' }];
          const result = grade(ALTN2, DA50RG_ENV, rec(id, events, 30_000));
          expect(result.result).toBe('fail');
          expect(result.reasons.map((r) => r.kind)).toEqual(['forbidden']);
          expect(result.harmful.map((h) => h.id)).toEqual([harmfulId('sw.alternator_1')]);
        });

        it(`${id}: switching off the electrical master fails for that reason alone`, () => {
          const events = [...golden(id), { t: base + 500, id: 'sw.elect_master', value: 'off' }];
          const result = grade(ALTN2, DA50RG_ENV, rec(id, events, 30_000));
          expect(result.result).toBe('fail');
          expect(result.reasons.map((r) => r.kind)).toEqual(['forbidden']);
          expect(result.harmful.map((h) => h.id)).toEqual([harmfulId('sw.elect_master')]);
        });

        it(`${id}: ESS BUS on is harmless and not reported`, () => {
          const events = [...golden(id), { t: base + 500, id: 'sw.ess_bus', value: 'on' }];
          const result = grade(ALTN2, DA50RG_ENV, rec(id, events, 30_000));
          expect(result.result).toBe('pass');
          expect(result.harmful).toEqual([]);
        });
      }
    });
  }

  // The faulted breaker and the message, per level.
  for (const id of ids) {
    it(`${id}: the breaker is in before the onset on Realistic, out after it when the cause pops it`, () => {
      const before = resolvedRun(id, true, [], ONSET_AT - STEP_MS);
      expect(before.state.controls[BREAKER]).toBe('in');
      const after = resolvedRun(id, true, [], ONSET_AT + 1000);
      expect(after.state.controls[BREAKER]).toBe(popped(id) ? 'out' : 'in');
    });

    it(`${id}: the message is ALTN 2 FAIL and never ALTN 1 FAIL`, () => {
      for (const realistic of [false, true]) {
        const run = resolvedRun(id, realistic, [], ONSET_AT + 10_000);
        const active = messages(run.state);
        expect(active, `${id} ${realistic ? 'Realistic' : 'Easy'}`).toContain('altn_2_fail');
        expect(active).not.toContain('altn_1_fail');
      }
    });
  }

  it('breaker_popped: pushing the breaker in clears the message within seconds', () => {
    const push = [{ t: 0, id: BREAKER, value: 'in' }];
    const messageOn = (events: SimEventLike[]) => {
      const run = resolvedRun('breaker_popped', false, events, 8000);
      return messages(run.state).includes('altn_2_fail');
    };
    expect(messageOn([])).toBe(true);
    expect(messageOn(push)).toBe(false);
  });

  it('breaker_popped: ALTERNATOR 2 off alone fails, the breaker step is missed', () => {
    const rec: Recording = {
      scenarioId: ALTN2.id,
      completedAt: 30_000,
      variant: { id: 'breaker_popped', seed: 7 },
      events: [{ t: 3000, id: 'sw.alternator_2', value: 'off' }],
    };
    const result = grade(ALTN2, DA50RG_ENV, rec);
    expect(result.result).toBe('fail');
    expect(result.reasons).toEqual([{ kind: 'critical_missed', count: 1 }]);
  });

  it('alternator_shorted: the pushed breaker is out again after the delay, the message stays', () => {
    const push = [{ t: 0, id: BREAKER, value: 'in' }];
    const run = resolvedRun('alternator_shorted', false, push, 10_000);
    expect(run.injected).toEqual([{ t: 2000, id: BREAKER, value: 'out', before: 1 }]);
    expect(run.state.controls[BREAKER]).toBe('out');
    expect(messages(run.state)).toContain('altn_2_fail');
    const early = resolvedRun('alternator_shorted', false, push, 2000 - STEP_MS);
    expect(early.state.controls[BREAKER]).toBe('in');
  });

  it('breaker_popped_dead: the pushed breaker stays in and the message stays', () => {
    const push = [{ t: 0, id: BREAKER, value: 'in' }];
    const run = resolvedRun('breaker_popped_dead', false, push, 20_000);
    expect(run.injected).toEqual([]);
    expect(run.state.controls[BREAKER]).toBe('in');
    expect(messages(run.state)).toContain('altn_2_fail');
  });
});
