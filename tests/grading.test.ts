import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { branchStatuses, grade } from '../src/engine/grading';
import type { GradeResult, Recording } from '../src/engine/grading';
import { parseScenario } from '../src/scenario/parse';
import type { Scenario } from '../src/scenario/schema';

// Golden replays of the grading rules R1 to R9 (docs/GRADING.md): every recording of
// tests/fixtures/recordings.json is graded and compared with its full expected result.
const root = fileURLToPath(new URL('../', import.meta.url));
const BLUEPRINT = readFileSync(join(root, 'scenarios/engine/eng-oil-temp-green.toon'), 'utf8');
const ORDERED = readFileSync(join(root, 'tests/fixtures/scenarios/ordered-critical.toon'), 'utf8');
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
  return grade(scenario, DA50RG_ENV, { scenarioId: scenario.id, completedAt: 99000, events });
}

const blueprint = load(BLUEPRINT);
const ordered = load(ORDERED);

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

const power_increased = (t: number, seq: number, failsRun = false) => ({
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
      },
    },
    {
      name: 'forbidden',
      scenario: blueprint,
      expected: {
        scenarioId: 'eng-oil-temp-green',
        result: 'pass',
        reasons: [],
        steps: [step('reduce_power', true, 1), step('open_cowl_flap', true, 2)],
        branches: BLUEPRINT_BRANCHES,
        orderViolations: [],
        harmful: [power_increased(5000, 0)],
      },
    },
    {
      name: 'forbidden-reverted',
      scenario: blueprint,
      expected: {
        scenarioId: 'eng-oil-temp-green',
        result: 'pass',
        reasons: [],
        steps: [step('reduce_power', true, 3), step('open_cowl_flap', true, 4)],
        branches: BLUEPRINT_BRANCHES,
        orderViolations: [],
        harmful: [power_increased(4000, 0), power_increased(9000, 2)],
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
    const strict = load(swap(BLUEPRINT, '      delta: 0', '      delta: 0\n    fails_run: true'));
    const result = grade(strict, DA50RG_ENV, recording('forbidden'));
    expect(result.result).toBe('fail');
    expect(result.reasons).toEqual([{ kind: 'forbidden', id: 'power_increased' }]);
    expect(result.harmful).toEqual([power_increased(5000, 0, true)]);
  });

  it('keeps fails_run false as a report only', () => {
    expect(grade(blueprint, DA50RG_ENV, recording('forbidden')).result).toBe('pass');
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
      const scenario = name === 'wrong-order' ? ordered : blueprint;
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
