import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { branchStatuses, grade } from '../src/engine/grading';
import type { GradeResult, Recording } from '../src/engine/grading';
import { initialQuantities, realisticQuantities } from '../src/engine/predicates';
import { STEP_MS, simSetup, simulate } from '../src/engine/sim';
import { checkScenario } from '../src/scenario/lint';
import { parseScenario } from '../src/scenario/parse';
import type { Scenario } from '../src/scenario/schema';

// Golden replays of the grading rules R1 to R9 (docs/GRADING.md): every recording of
// tests/fixtures/recordings.json is graded and compared with its full expected result.
const root = fileURLToPath(new URL('../', import.meta.url));
const BLUEPRINT = readFileSync(join(root, 'scenarios/engine/eng-oil-temp-green.toon'), 'utf8');
const ORDERED = readFileSync(join(root, 'tests/fixtures/scenarios/ordered-critical.toon'), 'utf8');
const ELECTRICAL = readFileSync(join(root, 'scenarios/electrical/elec-altn1-fail.toon'), 'utf8');
const ELEC_ORDERED = readFileSync(join(root, 'tests/fixtures/scenarios/elec-ordered.toon'), 'utf8');
const FIRE = readFileSync(join(root, 'scenarios/engine/eng-fire-in-flight.toon'), 'utf8');
const FIRE_ORDERED = readFileSync(join(root, 'tests/fixtures/scenarios/fire-ordered.toon'), 'utf8');
const RECORDINGS = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/recordings.json'), 'utf8'),
) as Record<string, Recording>;

function load(text: string): Scenario {
  const result = parseScenario(text);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

/** A text with one place replaced; the place must exist exactly once. */
function swap(text: string, from: string, to: string): string {
  expect(text.split(from).length - 1, `"${from}" occurs once`).toBe(1);
  return text.replace(from, () => to);
}

function recording(name: string): Recording {
  const found = RECORDINGS[name];
  if (found === undefined) throw new Error(`no recording "${name}"`);
  return found;
}

function power(t: number, value: string) {
  return { t, id: 'lv.power', value };
}
function cowl(t: number, value: string) {
  return { t, id: 'lv.cowl_flap', value };
}
function run(scenario: Scenario, events: Recording['events']): GradeResult {
  return grade(scenario, DA50RG_ENV, { scenarioId: scenario.id, completedAt: 20000, events });
}

const blueprint = load(BLUEPRINT);
const ordered = load(ORDERED);
const electrical = load(ELECTRICAL);
const elecOrdered = load(ELEC_ORDERED);
const fire = load(FIRE);
const fireOrdered = load(FIRE_ORDERED);

/** The scenario a recording belongs to, by its scenario id. */
function scenarioOf(name: string): Scenario {
  const id = recording(name).scenarioId;
  const found = [blueprint, ordered, electrical, elecOrdered, fire, fireOrdered].find(
    (scenario) => scenario.id === id,
  );
  if (found === undefined) throw new Error(`no scenario for the recording "${name}"`);
  return found;
}

const BLUEPRINT_BRANCHES = [
  { path: 'procedure.0.branches.0', status: 'not_applicable' },
  { path: 'procedure.0.branches.1', status: 'applies' },
  { path: 'procedure.0.branches.1.nodes.3', status: 'open' },
] as const;

const step = (
  id: string,
  credited: boolean,
  enteredAt: number | null,
  group = 'immediate',
): GradeResult['steps'][number] => ({ id, group, severity: 'critical', credited, enteredAt });

/** The outcome a simulation of the recording reaches: the definition the graded outcome must equal. */
function simulatedOutcome(scenario: Scenario, name: string) {
  const { completedAt, events } = recording(name);
  return simulate(simSetup(DA50RG_ENV, scenario), {
    events,
    start: initialQuantities(scenario, DA50RG_ENV.quantities),
    untilMs: completedAt,
  }).state.outcome;
}

const declaredOutcome = blueprint.outcomes[0];
if (declaredOutcome === undefined) throw new Error('the blueprint declares no outcome');

const electricalOutcome = electrical.outcomes[0];
if (electricalOutcome === undefined) throw new Error('the electrical scenario declares no outcome');

const ELEC_GROUP = 'immediate';

const fireOutcome = fire.outcomes[0];
if (fireOutcome === undefined) throw new Error('the Engine Fire scenario declares no outcome');

/** The group of every graded step of the Engine Fire scenario (one group each), by step id. */
const FIRE_GROUPS: Readonly<Record<string, string>> = {
  circ_air_fresh: 'grp_circ_air',
  ecs_pulled: 'grp_ecs_pull',
  engine_master_off: 'grp_eng_master',
  fuel_valve_off: 'grp_fuel_valve',
  elect_master_off: 'grp_elect_master',
  squawk_7700: 'grp_xpdr_code',
};

/** The six steps in checklist order; the squawk step is optional, the other five are critical. */
const fireSteps = (
  entered: Readonly<Record<string, number>>,
  groups: Readonly<Record<string, string>> = FIRE_GROUPS,
): GradeResult['steps'] =>
  Object.keys(FIRE_GROUPS).map((id) => ({
    id,
    group: groups[id] ?? '',
    severity: id === 'squawk_7700' ? 'optional' : 'critical',
    credited: id in entered,
    enteredAt: entered[id] ?? null,
  }));

/** The order the ordered copy puts the three shut-down steps in. */
const FIRE_ORDERED_GROUPS = {
  ...FIRE_GROUPS,
  engine_master_off: ELEC_GROUP,
  fuel_valve_off: ELEC_GROUP,
  elect_master_off: ELEC_GROUP,
};

const power_increased = (t: number, seq: number, failsRun = true) => ({
  id: 'power_increased',
  text: 'Increase power',
  t,
  seq,
  failsRun,
});

describe('golden recordings (Table R1)', () => {
  const cases: readonly { name: string; scenario: Scenario; expected: GradeResult }[] = [
    {
      name: 'golden',
      scenario: blueprint,
      expected: {
        scenarioId: 'eng-oil-temp-green',
        result: 'pass',
        reasons: [],
        steps: [step('reduce_power', true, 0), step('open_cowl_flap', true, 1)],
        branches: BLUEPRINT_BRANCHES,
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 8000 },
      },
    },
    {
      name: 'do-nothing',
      scenario: blueprint,
      expected: {
        scenarioId: 'eng-oil-temp-green',
        result: 'fail',
        reasons: [{ kind: 'critical_missed', count: 2 }],
        steps: [step('reduce_power', false, null), step('open_cowl_flap', false, null)],
        branches: BLUEPRINT_BRANCHES,
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: null },
      },
    },
    {
      name: 'forbidden',
      scenario: blueprint,
      expected: {
        scenarioId: 'eng-oil-temp-green',
        result: 'fail',
        reasons: [{ kind: 'forbidden', id: 'power_increased' }],
        steps: [step('reduce_power', true, 1), step('open_cowl_flap', true, 2)],
        branches: BLUEPRINT_BRANCHES,
        orderViolations: [],
        harmful: [power_increased(5000, 0)],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 5000 },
      },
    },
    {
      name: 'forbidden-reverted',
      scenario: blueprint,
      expected: {
        scenarioId: 'eng-oil-temp-green',
        result: 'fail',
        reasons: [{ kind: 'forbidden', id: 'power_increased' }],
        steps: [step('reduce_power', true, 3), step('open_cowl_flap', true, 4)],
        branches: BLUEPRINT_BRANCHES,
        orderViolations: [],
        harmful: [power_increased(4000, 0), power_increased(9000, 2)],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 4000 },
      },
    },
    {
      name: 'toggle-back',
      scenario: blueprint,
      expected: {
        scenarioId: 'eng-oil-temp-green',
        result: 'fail',
        reasons: [{ kind: 'critical_missed', count: 1 }],
        steps: [step('reduce_power', true, 0), step('open_cowl_flap', false, null)],
        branches: BLUEPRINT_BRANCHES,
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 6000 },
      },
    },
    {
      name: 'do-nothing-long',
      scenario: blueprint,
      expected: {
        scenarioId: 'eng-oil-temp-green',
        result: 'fail',
        reasons: [
          { kind: 'outcome', id: declaredOutcome.id },
          { kind: 'critical_missed', count: 2 },
        ],
        steps: [step('reduce_power', false, null), step('open_cowl_flap', false, null)],
        branches: BLUEPRINT_BRANCHES,
        orderViolations: [],
        harmful: [],
        outcome: {
          id: declaredOutcome.id,
          text: declaredOutcome.text,
          t: simulatedOutcome(blueprint, 'do-nothing-long')?.t ?? Number.NaN,
        },
        timing: { onsetAt: 0, firstActionMs: null },
      },
    },
    {
      name: 'golden-long',
      scenario: blueprint,
      expected: {
        scenarioId: 'eng-oil-temp-green',
        result: 'pass',
        reasons: [],
        steps: [step('reduce_power', true, 0), step('open_cowl_flap', true, 1)],
        branches: BLUEPRINT_BRANCHES,
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 8000 },
      },
    },
    {
      name: 'wrong-order',
      scenario: ordered,
      expected: {
        scenarioId: 'ordered-critical',
        result: 'fail',
        reasons: [{ kind: 'order', group: 'immediate' }],
        steps: [step('reduce_power', true, 1), step('open_cowl_flap', true, 0)],
        branches: [{ path: 'procedure.0.branches.0', status: 'applies' }],
        orderViolations: [
          {
            group: 'immediate',
            expected: 'reduce_power',
            before: 'open_cowl_flap',
            critical: true,
          },
        ],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 6000 },
      },
    },
    {
      name: 'elec-golden',
      scenario: electrical,
      expected: {
        scenarioId: 'elec-altn1-fail',
        result: 'pass',
        reasons: [],
        steps: [step('alt1_off', true, 0, ELEC_GROUP), step('ess_bus_on', true, 1, ELEC_GROUP)],
        branches: [],
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 6000 },
      },
    },
    {
      name: 'elec-golden-long',
      scenario: electrical,
      expected: {
        scenarioId: 'elec-altn1-fail',
        result: 'pass',
        reasons: [],
        steps: [step('alt1_off', true, 0, ELEC_GROUP), step('ess_bus_on', true, 1, ELEC_GROUP)],
        branches: [],
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 6000 },
      },
    },
    {
      name: 'elec-do-nothing',
      scenario: electrical,
      expected: {
        scenarioId: 'elec-altn1-fail',
        result: 'fail',
        reasons: [{ kind: 'critical_missed', count: 2 }],
        steps: [
          step('alt1_off', false, null, ELEC_GROUP),
          step('ess_bus_on', false, null, ELEC_GROUP),
        ],
        branches: [],
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: null },
      },
    },
    {
      name: 'elec-do-nothing-long',
      scenario: electrical,
      expected: {
        scenarioId: 'elec-altn1-fail',
        result: 'fail',
        reasons: [
          { kind: 'outcome', id: electricalOutcome.id },
          { kind: 'critical_missed', count: 2 },
        ],
        steps: [
          step('alt1_off', false, null, ELEC_GROUP),
          step('ess_bus_on', false, null, ELEC_GROUP),
        ],
        branches: [],
        orderViolations: [],
        harmful: [],
        outcome: {
          id: electricalOutcome.id,
          text: electricalOutcome.text,
          t: simulatedOutcome(electrical, 'elec-do-nothing-long')?.t ?? Number.NaN,
        },
        timing: { onsetAt: 0, firstActionMs: null },
      },
    },
    {
      name: 'elec-forbidden',
      scenario: electrical,
      expected: {
        scenarioId: 'elec-altn1-fail',
        result: 'fail',
        reasons: [{ kind: 'forbidden', id: 'alt2_off' }],
        steps: [step('alt1_off', true, 1, ELEC_GROUP), step('ess_bus_on', true, 2, ELEC_GROUP)],
        branches: [],
        orderViolations: [],
        harmful: [
          { id: 'alt2_off', text: 'Switch off alternator 2', t: 5000, seq: 0, failsRun: true },
        ],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 5000 },
      },
    },
    {
      // The real group is unordered (C-39): the reverse order is not a violation.
      name: 'elec-wrong-order',
      scenario: electrical,
      expected: {
        scenarioId: 'elec-altn1-fail',
        result: 'pass',
        reasons: [],
        steps: [step('alt1_off', true, 1, ELEC_GROUP), step('ess_bus_on', true, 0, ELEC_GROUP)],
        branches: [],
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 6000 },
      },
    },
    {
      // The synthetic copy with an ordered, order-critical group: the same events fail.
      name: 'elec-wrong-order-ordered',
      scenario: elecOrdered,
      expected: {
        scenarioId: 'elec-ordered',
        result: 'fail',
        reasons: [{ kind: 'order', group: ELEC_GROUP }],
        steps: [step('alt1_off', true, 1, ELEC_GROUP), step('ess_bus_on', true, 0, ELEC_GROUP)],
        branches: [],
        orderViolations: [
          { group: ELEC_GROUP, expected: 'alt1_off', before: 'ess_bus_on', critical: true },
        ],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 6000 },
      },
    },
    {
      name: 'fire-golden',
      scenario: fire,
      expected: {
        scenarioId: 'eng-fire-in-flight',
        result: 'pass',
        reasons: [],
        steps: fireSteps({
          squawk_7700: 0,
          circ_air_fresh: 1,
          ecs_pulled: 2,
          engine_master_off: 3,
          fuel_valve_off: 4,
          elect_master_off: 5,
        }),
        branches: [],
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 2000 },
      },
    },
    {
      name: 'fire-golden-long',
      scenario: fire,
      expected: {
        scenarioId: 'eng-fire-in-flight',
        result: 'pass',
        reasons: [],
        steps: fireSteps({
          squawk_7700: 0,
          circ_air_fresh: 1,
          ecs_pulled: 2,
          engine_master_off: 3,
          fuel_valve_off: 4,
          elect_master_off: 5,
        }),
        branches: [],
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 2000 },
      },
    },
    {
      // The optional squawk never fails a run.
      name: 'fire-no-squawk',
      scenario: fire,
      expected: {
        scenarioId: 'eng-fire-in-flight',
        result: 'pass',
        reasons: [],
        steps: fireSteps({
          circ_air_fresh: 0,
          ecs_pulled: 1,
          engine_master_off: 2,
          fuel_valve_off: 3,
          elect_master_off: 4,
        }),
        branches: [],
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 4000 },
      },
    },
    {
      name: 'fire-do-nothing',
      scenario: fire,
      expected: {
        scenarioId: 'eng-fire-in-flight',
        result: 'fail',
        reasons: [{ kind: 'critical_missed', count: 5 }],
        steps: fireSteps({}),
        branches: [],
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: null },
      },
    },
    {
      name: 'fire-do-nothing-long',
      scenario: fire,
      expected: {
        scenarioId: 'eng-fire-in-flight',
        result: 'fail',
        reasons: [
          { kind: 'outcome', id: fireOutcome.id },
          { kind: 'critical_missed', count: 5 },
        ],
        steps: fireSteps({}),
        branches: [],
        orderViolations: [],
        harmful: [],
        outcome: {
          id: fireOutcome.id,
          text: fireOutcome.text,
          t: simulatedOutcome(fire, 'fire-do-nothing-long')?.t ?? Number.NaN,
        },
        timing: { onsetAt: 0, firstActionMs: null },
      },
    },
    {
      // The pump is logged at its time between the squawk and the fresh air.
      name: 'fire-forbidden',
      scenario: fire,
      expected: {
        scenarioId: 'eng-fire-in-flight',
        result: 'fail',
        reasons: [{ kind: 'forbidden', id: 'emerg_fuel_pump_on' }],
        steps: fireSteps({
          squawk_7700: 0,
          circ_air_fresh: 2,
          ecs_pulled: 3,
          engine_master_off: 4,
          fuel_valve_off: 5,
          elect_master_off: 6,
        }),
        branches: [],
        orderViolations: [],
        harmful: [
          {
            id: 'emerg_fuel_pump_on',
            text: 'Switch on the emergency fuel pump',
            t: 3000,
            seq: 1,
            failsRun: true,
          },
        ],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 2000 },
      },
    },
    {
      // The real groups are unordered (C-48): any order of the five steps passes.
      name: 'fire-wrong-order',
      scenario: fire,
      expected: {
        scenarioId: 'eng-fire-in-flight',
        result: 'pass',
        reasons: [],
        steps: fireSteps({
          elect_master_off: 0,
          fuel_valve_off: 1,
          engine_master_off: 2,
          ecs_pulled: 3,
          circ_air_fresh: 4,
        }),
        branches: [],
        orderViolations: [],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 4000 },
      },
    },
    {
      // The synthetic copy with one ordered, order-critical shut-down group: the same events fail.
      name: 'fire-wrong-order-ordered',
      scenario: fireOrdered,
      expected: {
        scenarioId: 'fire-ordered',
        result: 'fail',
        reasons: [{ kind: 'order', group: ELEC_GROUP }],
        steps: fireSteps(
          {
            elect_master_off: 0,
            fuel_valve_off: 1,
            engine_master_off: 2,
            ecs_pulled: 3,
            circ_air_fresh: 4,
          },
          FIRE_ORDERED_GROUPS,
        ),
        branches: [],
        // Entered in the reverse order: each of the three later steps came before an earlier one.
        orderViolations: [
          {
            group: ELEC_GROUP,
            expected: 'engine_master_off',
            before: 'fuel_valve_off',
            critical: true,
          },
          {
            group: ELEC_GROUP,
            expected: 'engine_master_off',
            before: 'elect_master_off',
            critical: true,
          },
          {
            group: ELEC_GROUP,
            expected: 'fuel_valve_off',
            before: 'elect_master_off',
            critical: true,
          },
        ],
        harmful: [],
        outcome: null,
        timing: { onsetAt: 0, firstActionMs: 4000 },
      },
    },
  ];

  it('covers every recording of the fixture file', () => {
    expect(Object.keys(RECORDINGS).sort()).toEqual(cases.map((c) => c.name).sort());
  });

  for (const { name, scenario, expected } of cases) {
    it(`grades ${name} exactly`, () => {
      expect(grade(scenario, DA50RG_ENV, recording(name))).toEqual(expected);
    });
  }
});

describe('named outcomes (R10, D-06, C-26)', () => {
  const longIgnored = (): NonNullable<GradeResult['outcome']> => {
    const outcome = grade(blueprint, DA50RG_ENV, recording('do-nothing-long')).outcome;
    if (outcome === null) throw new Error('the ignored run did not escalate');
    return outcome;
  };

  it('an ignored run escalates inside its 600 s: a step boundary after 20 s', () => {
    const outcome = longIgnored();
    expect(outcome.id).toBe(declaredOutcome.id);
    expect(outcome.text).toBe(declaredOutcome.text);
    expect(outcome.t % STEP_MS).toBe(0);
    expect(outcome.t).toBeGreaterThan(recording('do-nothing').completedAt);
    expect(outcome.t).toBeLessThan(recording('do-nothing-long').completedAt);
    expect(outcome.t).toBe(simulatedOutcome(blueprint, 'do-nothing-long')?.t);
  });

  it('a handled failure recovers: the golden actions never escalate, however long the run lasts', () => {
    expect(simulatedOutcome(blueprint, 'golden-long')).toBeNull();
    const result = grade(blueprint, DA50RG_ENV, recording('golden-long'));
    expect(result.outcome).toBeNull();
    expect(result.result).toBe('pass');
  });

  it('the same ignored run is not an escalation before its hold time is over', () => {
    const outcome = longIgnored();
    const early = grade(blueprint, DA50RG_ENV, {
      ...recording('do-nothing-long'),
      completedAt: outcome.t - STEP_MS,
    });
    expect(early.outcome).toBeNull();
    expect(early.reasons).toEqual([{ kind: 'critical_missed', count: 2 }]);
    const exact = grade(blueprint, DA50RG_ENV, {
      ...recording('do-nothing-long'),
      completedAt: outcome.t,
    });
    expect(exact.outcome).toEqual(outcome);
  });

  it('does not credit an event recorded after the outcome time', () => {
    const outcome = longIgnored();
    const base = recording('do-nothing-long');
    const late = grade(blueprint, DA50RG_ENV, {
      ...base,
      events: [
        { t: outcome.t + 1000, id: 'lv.power', value: 'p60' },
        { t: outcome.t + 2000, id: 'lv.cowl_flap', value: 'open' },
      ],
    });
    expect(late.steps.map((s) => s.credited)).toEqual([false, false]);
    expect(late.reasons).toEqual(longIgnoredReasons());
    const harmfulLate = grade(blueprint, DA50RG_ENV, {
      ...base,
      events: [{ t: outcome.t + 1000, id: 'lv.power', value: 'p85' }],
    });
    expect(harmfulLate.harmful).toEqual([]);
  });

  it('credits an event recorded before the outcome time', () => {
    const outcome = longIgnored();
    const early = grade(blueprint, DA50RG_ENV, {
      ...recording('do-nothing-long'),
      events: [{ t: outcome.t - 1000, id: 'lv.cowl_flap', value: 'open' }],
    });
    expect(early.steps.map((s) => s.credited)).toEqual([false, true]);
    expect(early.reasons).toEqual(longIgnoredReasons(1));
  });

  function longIgnoredReasons(missed = 2) {
    return [
      { kind: 'outcome', id: declaredOutcome?.id },
      { kind: 'critical_missed', count: missed },
    ];
  }
});

describe('Electrical Failure replays (plan 03-07, D-08, D-06, C-39)', () => {
  it('the scenario and its ordered copy pass the scenario check', () => {
    expect(checkScenario(ELECTRICAL, DA50RG_ENV).ok).toBe(true);
    expect(checkScenario(ELEC_ORDERED, DA50RG_ENV).ok).toBe(true);
    expect(elecOrdered.procedure).toHaveLength(electrical.procedure.length);
  });

  it('a handled failure recovers: the golden actions never escalate, however long the run lasts', () => {
    expect(simulatedOutcome(electrical, 'elec-golden-long')).toBeNull();
    const result = grade(electrical, DA50RG_ENV, recording('elec-golden-long'));
    expect(result.outcome).toBeNull();
    expect(result.result).toBe('pass');
  });

  it('an ignored failure escalates after the short run and before 600 s, on a step boundary', () => {
    const outcome = grade(electrical, DA50RG_ENV, recording('elec-do-nothing-long')).outcome;
    if (outcome === null) throw new Error('the ignored run did not escalate');
    expect(outcome.id).toBe(electricalOutcome.id);
    expect(outcome.t % STEP_MS).toBe(0);
    expect(outcome.t).toBeGreaterThan(recording('elec-do-nothing').completedAt);
    expect(outcome.t).toBeLessThan(recording('elec-do-nothing-long').completedAt);
    expect(outcome.t).toBe(simulatedOutcome(electrical, 'elec-do-nothing-long')?.t);
  });

  it('the forbidden item ELECT. MASTER off also fails the run', () => {
    const result = run(electrical, [{ t: 4000, id: 'sw.elect_master', value: 'off' }]);
    expect(result.result).toBe('fail');
    expect(result.reasons).toContainEqual({ kind: 'forbidden', id: 'elect_master_off' });
  });
});

describe('Engine Fire replays (plan 03-08, D-08, D-06, C-48)', () => {
  it('the scenario and its ordered copy pass the scenario check', () => {
    expect(checkScenario(FIRE, DA50RG_ENV).ok).toBe(true);
    expect(checkScenario(FIRE_ORDERED, DA50RG_ENV).ok).toBe(true);
    // The copy merges the three shut-down groups into one.
    expect(fireOrdered.procedure).toHaveLength(fire.procedure.length - 2);
  });

  it('grades every panel step of the checklist: five critical steps and the optional squawk', () => {
    const steps = grade(fire, DA50RG_ENV, recording('fire-do-nothing')).steps;
    expect(steps.map((s) => s.severity)).toEqual([
      'critical',
      'critical',
      'critical',
      'critical',
      'critical',
      'optional',
    ]);
  });

  it('a handled fire recovers: the golden actions never escalate, however long the run lasts', () => {
    expect(simulatedOutcome(fire, 'fire-golden-long')).toBeNull();
    const result = grade(fire, DA50RG_ENV, recording('fire-golden-long'));
    expect(result.outcome).toBeNull();
    expect(result.result).toBe('pass');
  });

  it('an ignored fire escalates after the short run and before 600 s, on a step boundary', () => {
    const outcome = grade(fire, DA50RG_ENV, recording('fire-do-nothing-long')).outcome;
    if (outcome === null) throw new Error('the ignored fire did not escalate');
    expect(outcome.id).toBe(fireOutcome.id);
    expect(outcome.t % STEP_MS).toBe(0);
    expect(outcome.t).toBeGreaterThan(recording('fire-do-nothing').completedAt);
    expect(outcome.t).toBeLessThan(recording('fire-do-nothing-long').completedAt);
    expect(outcome.t).toBe(simulatedOutcome(fire, 'fire-do-nothing-long')?.t);
  });

  it('the FUEL selector OFF alone ends the fire: no escalation, but the other steps stay missed', () => {
    const events = [{ t: 4000, id: 'sw.fuel_valve', value: 'off' }];
    const long = { scenarioId: fire.id, completedAt: 600000, events };
    const result = grade(fire, DA50RG_ENV, long);
    expect(result.outcome).toBeNull();
    expect(result.result).toBe('fail');
    expect(result.reasons).toEqual([{ kind: 'critical_missed', count: 4 }]);
  });

  it('more power is reported as harmful but does not fail a run that is otherwise right', () => {
    const events = [
      { t: 3000, id: 'lv.power', value: 'p100' },
      ...recording('fire-golden').events.slice(1),
    ];
    const result = run(fire, events);
    expect(result.result).toBe('pass');
    expect(result.harmful).toEqual([
      { id: 'power_increased', text: 'Increase power', t: 3000, seq: 0, failsRun: false },
    ]);
  });

  it('squawk 7700 is credited only for that code', () => {
    const other = run(fire, [{ t: 2000, id: 'kp.squawk', value: '7600' }]);
    expect(other.steps.find((s) => s.id === 'squawk_7700')?.credited).toBe(false);
    const right = run(fire, [{ t: 2000, id: 'kp.squawk', value: '7700' }]);
    expect(right.steps.find((s) => s.id === 'squawk_7700')?.credited).toBe(true);
  });
});

describe('step targets relative to the baseline (D-02, D-09)', () => {
  it('credits reduce_power at p65 and not at p70 from the p75 baseline', () => {
    const at65 = run(blueprint, [power(1000, 'p65')]);
    const at70 = run(blueprint, [power(1000, 'p70')]);
    expect(at65.steps[0]).toMatchObject({ id: 'reduce_power', credited: true, enteredAt: 0 });
    expect(at70.steps[0]).toMatchObject({ id: 'reduce_power', credited: false, enteredAt: null });
  });

  it('does not credit a step whose target no longer holds after the last event', () => {
    const result = run(blueprint, [power(1000, 'p60'), cowl(2000, 'open'), power(3000, 'p75')]);
    expect(result.steps[0]).toMatchObject({ credited: false, enteredAt: null });
    expect(result.steps[1]).toMatchObject({ credited: true, enteredAt: 1 });
    expect(result.reasons).toEqual([{ kind: 'critical_missed', count: 1 }]);
  });

  it('keeps the last entry when a target is left and entered again', () => {
    const result = run(blueprint, [power(1000, 'p60'), power(2000, 'p80'), power(3000, 'p60')]);
    expect(result.steps[0]).toMatchObject({ credited: true, enteredAt: 2 });
  });
});

describe('fails_run and order_critical (D-11, D-12)', () => {
  it('fails the run on a fails_run forbidden item that fired', () => {
    const result = grade(blueprint, DA50RG_ENV, recording('forbidden'));
    expect(result.result).toBe('fail');
    expect(result.reasons).toEqual([{ kind: 'forbidden', id: 'power_increased' }]);
    expect(result.harmful).toEqual([power_increased(5000, 0, true)]);
  });

  it('keeps an item without fails_run as a report only', () => {
    const report = load(swap(BLUEPRINT, '    fails_run: true\n', ''));
    const result = grade(report, DA50RG_ENV, recording('forbidden'));
    expect(result.result).toBe('pass');
    expect(result.reasons).toEqual([]);
    expect(result.harmful).toEqual([power_increased(5000, 0, false)]);
  });

  it('lists a violation of a group that is not order-critical without failing', () => {
    const relaxed = load(swap(ORDERED, 'order_critical: true', 'order_critical: false'));
    const result = grade(relaxed, DA50RG_ENV, recording('wrong-order'));
    expect(result.result).toBe('pass');
    expect(result.reasons).toEqual([]);
    expect(result.orderViolations).toEqual([
      { group: 'immediate', expected: 'reduce_power', before: 'open_cowl_flap', critical: false },
    ]);
  });

  it('gives no violation for an unordered group', () => {
    const loose = load(swap(ORDERED, 'ordered: true', 'ordered: false'));
    expect(grade(loose, DA50RG_ENV, recording('wrong-order')).orderViolations).toEqual([]);
  });

  it('gives no order violation for a step that was never credited', () => {
    const result = run(ordered, [cowl(1000, 'open')]);
    expect(result.orderViolations).toEqual([]);
    expect(result.reasons).toEqual([{ kind: 'critical_missed', count: 1 }]);
  });
});

describe('branch applicability (D-23, D-25)', () => {
  it('never grades a step inside a branch that does not apply', () => {
    // Low oil pressure: the "too low" branch applies, the green branch does not.
    const lowPressure = load(swap(BLUEPRINT, 'oil_pressure_bar: 5', 'oil_pressure_bar: 1'));
    expect(branchStatuses(lowPressure, DA50RG_ENV)).toEqual([
      { path: 'procedure.0.branches.0', status: 'applies' },
      { path: 'procedure.0.branches.1', status: 'not_applicable' },
      { path: 'procedure.0.branches.1.nodes.3', status: 'not_applicable' },
    ]);
    const result = run(lowPressure, []);
    expect(result.steps).toEqual([]);
    expect(result.result).toBe('pass');
  });

  it('never grades a step inside an open branch', () => {
    const nested = load(
      swap(
        BLUEPRINT,
        '            nodes[1]:\n              - kind: line\n                text: Land at nearest suitable airfield',
        [
          '            nodes[1]:',
          '              - kind: group',
          '                id: later',
          '                ordered: false',
          '                steps[1]:',
          '                  - id: land',
          '                    severity: critical',
          '                    text: Land',
          '                    done:',
          '                      check: state',
          '                      control: lv.cowl_flap',
          '                      is: closed',
        ].join('\n'),
      ),
    );
    const result = run(nested, [power(1000, 'p60'), cowl(2000, 'open')]);
    expect(result.steps.map((s) => s.id)).toEqual(['reduce_power', 'open_cowl_flap']);
    expect(result.result).toBe('pass');
  });

  it('never reports a forbidden item whose when does not hold at the start', () => {
    const guarded = load(
      swap(
        BLUEPRINT,
        '      delta: 0',
        '      delta: 0\n    when:\n      check: band\n      quantity: oil_pressure_bar\n      in[1]: low_red',
      ),
    );
    expect(grade(guarded, DA50RG_ENV, recording('forbidden')).harmful).toEqual([]);
  });

  it('watches a forbidden item whose when holds at the start', () => {
    const guarded = load(
      swap(
        BLUEPRINT,
        '      delta: 0',
        '      delta: 0\n    when:\n      check: band\n      quantity: oil_pressure_bar\n      in[1]: green',
      ),
    );
    expect(grade(guarded, DA50RG_ENV, recording('forbidden')).harmful).toHaveLength(1);
  });
});

describe('determinism (R9)', () => {
  it('orders events by log index even when t is equal', () => {
    const inOrder = run(ordered, [power(5000, 'p60'), cowl(5000, 'open')]);
    expect(inOrder.orderViolations).toEqual([]);
    const reversed = run(ordered, [cowl(5000, 'open'), power(5000, 'p60')]);
    expect(reversed.orderViolations).toHaveLength(1);
  });

  it('does not sort events by t', () => {
    const result = run(ordered, [cowl(9000, 'open'), power(1000, 'p60')]);
    expect(result.steps.map((s) => s.enteredAt)).toEqual([1, 0]);
  });

  it('gives JSON-identical results for two calls and survives a JSON round trip', () => {
    for (const name of Object.keys(RECORDINGS)) {
      const scenario = scenarioOf(name);
      const first = grade(scenario, DA50RG_ENV, recording(name));
      const second = grade(scenario, DA50RG_ENV, recording(name));
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    }
  });

  it('does not change the recording', () => {
    const before = JSON.stringify(recording('forbidden-reverted'));
    grade(blueprint, DA50RG_ENV, recording('forbidden-reverted'));
    expect(JSON.stringify(recording('forbidden-reverted'))).toBe(before);
  });

  it('throws for a recording of another scenario and for an unknown control', () => {
    expect(() => grade(blueprint, DA50RG_ENV, recording('wrong-order'))).toThrow(Error);
    expect(() => run(blueprint, [{ t: 1, id: 'lv.nope', value: 'x' }])).toThrow(Error);
    expect(() => run(blueprint, [{ t: 1, id: 'constructor', value: 'x' }])).toThrow(Error);
  });
});

describe('reaction time from the onset (D-05, C-33, C-34)', () => {
  const realistic = (
    onsetAt: number,
    events: Recording['events'],
    completedAt = 20000,
  ): Recording => ({
    scenarioId: blueprint.id,
    completedAt,
    onset: { at: onsetAt, seed: 7 },
    events,
  });

  it('measures the first action from the onset; the event before the onset earns no credit (R12)', () => {
    const result = grade(
      blueprint,
      DA50RG_ENV,
      realistic(10000, [power(4000, 'p60'), cowl(13500, 'open')]),
    );
    expect(result.timing).toEqual({ onsetAt: 10000, firstActionMs: 3500 });
    expect(result.steps.map((s) => s.credited)).toEqual([false, true]);
    expect(result.steps.map((s) => s.preempted)).toEqual([true, undefined]);
    expect(result.result).toBe('fail');
    expect(result.reasons).toEqual([{ kind: 'critical_missed', count: 1 }]);
  });

  it('actions before the onset credit nothing; the same actions after it pass (R12)', () => {
    const before = grade(
      blueprint,
      DA50RG_ENV,
      realistic(10000, [power(4000, 'p60'), cowl(6000, 'open')]),
    );
    expect(before.result).toBe('fail');
    expect(before.steps.map((s) => s.credited)).toEqual([false, false]);
    expect(before.reasons).toEqual([{ kind: 'critical_missed', count: 2 }]);
    expect(before.timing.firstActionMs).toBeNull();
    const after = grade(
      blueprint,
      DA50RG_ENV,
      realistic(10000, [power(12000, 'p60'), cowl(14000, 'open')]),
    );
    expect(after.result).toBe('pass');
    expect(after.reasons).toEqual([]);
    expect(after.steps.every((s) => s.credited && s.preempted === undefined)).toBe(true);
  });

  it('a step done early is credited when the pilot undoes and redoes it after the onset (R12)', () => {
    const redone = grade(
      blueprint,
      DA50RG_ENV,
      realistic(10000, [
        power(4000, 'p60'),
        power(11000, 'p75'),
        power(12000, 'p60'),
        cowl(14000, 'open'),
      ]),
    );
    expect(redone.result).toBe('pass');
    expect(redone.steps.map((s) => s.preempted)).toEqual([undefined, undefined]);
  });

  it('an action exactly at the onset counts (R12)', () => {
    const result = grade(
      blueprint,
      DA50RG_ENV,
      realistic(10000, [power(10000, 'p60'), cowl(10000, 'open')]),
    );
    expect(result.result).toBe('pass');
  });

  it('a log that ends before the onset credits nothing (R12)', () => {
    const result = grade(blueprint, DA50RG_ENV, realistic(10000, [power(4000, 'p60')], 6000));
    expect(result.steps.map((s) => s.credited)).toEqual([false, false]);
    expect(result.result).toBe('fail');
  });

  it('Easy and Medium recordings, with no onset, credit early actions as before (R12)', () => {
    const plain = grade(blueprint, DA50RG_ENV, {
      scenarioId: blueprint.id,
      completedAt: 20000,
      events: [power(4000, 'p60'), cowl(6000, 'open')],
    });
    expect(plain.result).toBe('pass');
    expect(JSON.stringify(plain)).not.toContain('preempted');
  });

  it('is null when nothing happens after the onset', () => {
    const early = grade(blueprint, DA50RG_ENV, realistic(10000, [power(4000, 'p60')]));
    expect(early.timing).toEqual({ onsetAt: 10000, firstActionMs: null });
    const none = grade(blueprint, DA50RG_ENV, realistic(10000, []));
    expect(none.timing).toEqual({ onsetAt: 10000, firstActionMs: null });
  });

  it('counts an action exactly at the onset as zero', () => {
    const result = grade(blueprint, DA50RG_ENV, realistic(10000, [power(10000, 'p60')]));
    expect(result.timing.firstActionMs).toBe(0);
  });

  it('a recording without an onset has onsetAt 0 and the time of its first event', () => {
    const plain = grade(blueprint, DA50RG_ENV, recording('golden'));
    expect(plain.timing).toEqual({ onsetAt: 0, firstActionMs: 8000 });
    const nulled = grade(blueprint, DA50RG_ENV, { ...recording('golden'), onset: null });
    expect(nulled).toEqual(plain);
  });

  it('the same events with and without an onset differ in the timing only', () => {
    const events = [power(12000, 'p60'), cowl(13500, 'open')];
    const withOnset = grade(blueprint, DA50RG_ENV, realistic(10000, events));
    const without = grade(blueprint, DA50RG_ENV, {
      scenarioId: blueprint.id,
      completedAt: 20000,
      events,
    });
    expect({ ...withOnset, timing: null }).toEqual({ ...without, timing: null });
    expect(withOnset.timing).not.toEqual(without.timing);
  });

  it('a late onset moves the escalation: grade equals the simulation with that onset', () => {
    const onsetAt = 20000;
    const ignored = grade(blueprint, DA50RG_ENV, realistic(onsetAt, [], 600000));
    const sooner = grade(blueprint, DA50RG_ENV, recording('do-nothing-long'));
    const simulated = simulate(simSetup(DA50RG_ENV, blueprint, { onsetAt }), {
      events: [],
      start: realisticQuantities(blueprint, DA50RG_ENV.quantities),
      untilMs: 600000,
    }).state.outcome;
    expect(ignored.outcome?.t).toBe(simulated?.t);
    expect(ignored.outcome?.t).toBeGreaterThan(sooner.outcome?.t ?? Number.POSITIVE_INFINITY);
    expect(ignored.result).toBe('fail');
    expect(ignored.timing).toEqual({ onsetAt, firstActionMs: null });
  });

  it('actions after the outcome are not graded and do not set the reaction time', () => {
    const outcome = grade(blueprint, DA50RG_ENV, realistic(20000, [], 600000)).outcome;
    if (outcome === null) throw new Error('the ignored run did not escalate');
    const late = grade(
      blueprint,
      DA50RG_ENV,
      realistic(20000, [power(outcome.t + 1000, 'p60')], 600000),
    );
    expect(late.timing).toEqual({ onsetAt: 20000, firstActionMs: null });
  });

  it('the result never carries a level', () => {
    const keys = Object.keys(grade(blueprint, DA50RG_ENV, realistic(10000, [])));
    expect(keys).not.toContain('level');
  });
});
