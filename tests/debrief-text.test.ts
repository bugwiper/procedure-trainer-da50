import { describe, expect, it } from 'vitest';
import type { GradeResult, OrderViolation, Reason } from '../src/engine/grading';
import type { Group } from '../src/scenario/schema';
import { harmfulLine, orderLine, reasonLines } from '../src/ui/debrief-text';

// Table T1 of plan 02-13: the copy rules of the debrief, pure functions of the grade result.

function result(over: Partial<GradeResult>): GradeResult {
  return {
    scenarioId: 'x',
    result: 'pass',
    reasons: [],
    steps: [],
    branches: [],
    orderViolations: [],
    harmful: [],
    outcome: null,
    ...over,
  };
}

function failing(reasons: readonly Reason[]): GradeResult {
  return result({ result: 'fail', reasons });
}

function group(over: Partial<Group>): Group {
  return {
    kind: 'group',
    id: 'immediate',
    ordered: true,
    order_critical: true,
    steps: [
      {
        id: 'reduce_power',
        severity: 'critical',
        text: 'Reduce power',
        done: { check: 'state', control: 'lv.power', is: 'p50' },
      },
      {
        id: 'open_cowl_flap',
        severity: 'critical',
        text: 'Open cowl flap',
        done: { check: 'state', control: 'lv.cowl_flap', is: 'open' },
      },
    ],
    ...over,
  };
}

const violation: OrderViolation = {
  group: 'immediate',
  expected: 'reduce_power',
  before: 'open_cowl_flap',
  critical: true,
};

describe('reasonLines', () => {
  it('a pass gives one line', () => {
    expect(reasonLines(result({}))).toEqual(['All critical steps done.']);
  });

  it('one critical step is singular, several are plural', () => {
    expect(reasonLines(failing([{ kind: 'critical_missed', count: 1 }]))).toEqual([
      '1 critical step was missed.',
    ]);
    expect(reasonLines(failing([{ kind: 'critical_missed', count: 2 }]))).toEqual([
      '2 critical steps were missed.',
    ]);
    expect(reasonLines(failing([{ kind: 'critical_missed', count: 11 }]))).toEqual([
      '11 critical steps were missed.',
    ]);
  });

  it('gives one line per cause in reason order, each cause once', () => {
    expect(
      reasonLines(
        failing([
          { kind: 'critical_missed', count: 3 },
          { kind: 'order', group: 'a' },
          { kind: 'order', group: 'b' },
          { kind: 'forbidden', id: 'f1' },
          { kind: 'forbidden', id: 'f2' },
        ]),
      ),
    ).toEqual([
      '3 critical steps were missed.',
      'Steps were done in the wrong order.',
      'A harmful action counts as a fail in this scenario.',
    ]);
  });

  it('keeps the reason order of the result', () => {
    expect(
      reasonLines(
        failing([
          { kind: 'order', group: 'a' },
          { kind: 'forbidden', id: 'f1' },
        ]),
      ),
    ).toEqual([
      'Steps were done in the wrong order.',
      'A harmful action counts as a fail in this scenario.',
    ]);
  });
});

describe('orderLine', () => {
  it('an unordered group has no order line', () => {
    expect(orderLine(group({ ordered: false }), result({}))).toEqual([]);
    expect(orderLine(group({ ordered: false }), result({ orderViolations: [violation] }))).toEqual(
      [],
    );
  });

  it('an ordered group without violation says Order kept', () => {
    expect(orderLine(group({}), result({}))).toEqual(['Order kept']);
  });

  it('an ordered group gives one line per violation, naming both step texts', () => {
    expect(orderLine(group({}), result({ orderViolations: [violation] }))).toEqual([
      'Order wrong: Reduce power was expected before Open cowl flap',
    ]);
    const second: OrderViolation = {
      ...violation,
      expected: 'open_cowl_flap',
      before: 'reduce_power',
    };
    expect(orderLine(group({}), result({ orderViolations: [violation, second] }))).toEqual([
      'Order wrong: Reduce power was expected before Open cowl flap',
      'Order wrong: Open cowl flap was expected before Reduce power',
    ]);
  });

  it('ignores the violations of other groups', () => {
    expect(
      orderLine(group({}), result({ orderViolations: [{ ...violation, group: 'other' }] })),
    ).toEqual(['Order kept']);
  });
});

describe('harmfulLine', () => {
  it('prints the text only, for every recorded time', () => {
    for (const t of [0, 2300, 65999]) {
      const line = harmfulLine({ id: 'p', text: 'Increase power', t, seq: 0, failsRun: false });
      expect(line).toBe('Increase power');
      expect(line).not.toMatch(/\d:\d\d/);
    }
  });
});
