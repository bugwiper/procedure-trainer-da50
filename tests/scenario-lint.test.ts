import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { defineCasRules } from '../src/engine/cas';
import {
  checkScenario,
  lintScenario,
  MAX_BRANCH_LEVELS,
  REALISTIC_SHOW_WITHIN_MS,
} from '../src/scenario/lint';
import { parseScenario } from '../src/scenario/parse';
import { colOf, lineOf, MINIMAL, nested, swap } from './scenario-text';

// Lint rules L1 to L8 and L10 to L14 (SCN-02, Table L1) through checkScenario: one failing case per rule, each an
// edit of the minimal valid scenario, with the exact line and column of the edit.
const root = fileURLToPath(new URL('../', import.meta.url));
const BLUEPRINT = readFileSync(`${root}scenarios/engine/eng-oil-temp-green.toon`, 'utf8');

function issuesOf(text: string) {
  const result = checkScenario(text, DA50RG_ENV);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.issues;
}

const GROUP = [
  '- kind: group',
  '  id: inner',
  '  ordered: false',
  '  steps[1]:',
  '    - id: inner_step',
  '      severity: standard',
  '      text: Open cowl flap',
  '      done:',
  '        check: state',
  '        control: lv.cowl_flap',
  '        is: open',
].join('\n');

describe('checkScenario passes valid files', () => {
  it('passes the minimal scenario and the blueprint', () => {
    expect(checkScenario(MINIMAL, DA50RG_ENV).ok).toBe(true);
    expect(checkScenario(BLUEPRINT, DA50RG_ENV).ok).toBe(true);
    expect(lintScenario(parsedOf(BLUEPRINT), DA50RG_ENV)).toEqual([]);
  });

  it('keeps the same scenario value the parser returns', () => {
    const result = checkScenario(MINIMAL, DA50RG_ENV);
    expect(result.ok && result.scenario.id).toBe('minimal');
  });
});

function parsedOf(text: string) {
  const result = checkScenario(text, DA50RG_ENV);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.scenario;
}

describe('L1: initial controls', () => {
  it('rejects an unknown control', () => {
    const text = swap(MINIMAL, 'lv.cowl_flap: closed', 'lv.nope: closed');
    expect(issuesOf(text)).toEqual([
      {
        path: 'initial.controls.lv.nope',
        message: 'unknown control "lv.nope"',
        line: lineOf(text, 'lv.nope'),
        col: colOf(text, 'lv.nope', 'lv.nope'),
      },
    ]);
  });

  it('rejects a state the control does not have', () => {
    const text = swap(MINIMAL, 'lv.cowl_flap: closed', 'lv.cowl_flap: ajar');
    expect(issuesOf(text)).toEqual([
      {
        path: 'initial.controls.lv.cowl_flap',
        message: '"ajar" is not a state of control "lv.cowl_flap"',
        line: lineOf(text, 'ajar'),
        col: colOf(text, 'ajar', 'lv.cowl_flap'),
      },
    ]);
  });

  it('does not resolve a prototype key', () => {
    const text = swap(MINIMAL, 'lv.cowl_flap: closed', 'constructor: closed');
    expect(issuesOf(text)[0]).toMatchObject({
      path: 'initial.controls.constructor',
      line: lineOf(text, 'constructor'),
    });
  });
});

describe('L2: initial quantities', () => {
  it('rejects an unknown quantity', () => {
    const text = swap(MINIMAL, 'oil_temp_c: 128', 'oil_nope: 128');
    expect(issuesOf(text)[0]).toMatchObject({
      path: 'initial.quantities.oil_nope',
      line: lineOf(text, 'oil_nope'),
      col: colOf(text, 'oil_nope', 'oil_nope'),
    });
  });

  it('rejects a value outside min..max', () => {
    const text = swap(MINIMAL, 'oil_temp_c: 128', 'oil_temp_c: 5000');
    expect(issuesOf(text)[0]).toMatchObject({
      path: 'initial.quantities.oil_temp_c',
      line: lineOf(text, '5000'),
    });
  });
});

describe('L3: predicates', () => {
  it('rejects an unknown control in a step', () => {
    const text = swap(
      MINIMAL,
      'control: lv.cowl_flap\n          is: open',
      'control: lv.nope\n          is: open',
    );
    expect(issuesOf(text)).toEqual([
      {
        path: 'procedure.0.steps.1.done.control',
        message: 'unknown control "lv.nope"',
        line: lineOf(text, 'control: lv.nope'),
        col: colOf(text, 'control: lv.nope', 'control'),
      },
    ]);
  });

  it('rejects a state the control does not have', () => {
    const text = swap(MINIMAL, 'is: open', 'is: ajar');
    expect(issuesOf(text)[0]).toMatchObject({
      path: 'procedure.0.steps.1.done.is',
      line: lineOf(text, 'is: ajar'),
    });
  });

  it('rejects a travel check on a control that is not a detent lever', () => {
    const text = swap(
      MINIMAL,
      'check: state\n          control: lv.cowl_flap\n          is: open',
      'check: travel\n          control: sw.fadec\n          op: gte\n          value: 10',
    );
    const issue = issuesOf(text)[0];
    expect(issue).toMatchObject({
      path: 'procedure.0.steps.1.done.control',
      line: lineOf(text, 'control: sw.fadec'),
    });
    expect(issue?.message).toContain('needs a detent lever');
  });

  it('rejects an unknown quantity and an unknown band', () => {
    const quantity = swap(
      MINIMAL,
      'check: state\n          control: lv.cowl_flap\n          is: open',
      'check: quantity\n          quantity: oil_nope\n          op: lt\n          value: 100',
    );
    expect(issuesOf(quantity)[0]).toMatchObject({
      path: 'procedure.0.steps.1.done.quantity',
      line: lineOf(quantity, 'quantity: oil_nope'),
    });
    const band = swap(
      MINIMAL,
      'check: state\n          control: lv.cowl_flap\n          is: open',
      'check: band\n          quantity: oil_temp_c\n          in[2]: green,purple',
    );
    expect(issuesOf(band)[0]).toMatchObject({
      path: 'procedure.0.steps.1.done.in.1',
      line: lineOf(band, 'in[2]'),
    });
  });

  it('checks the predicates of forbidden items too', () => {
    const text = swap(MINIMAL, 'control: lv.power\n      op: gt', 'control: lv.nope\n      op: gt');
    expect(issuesOf(text)[0]).toMatchObject({
      path: 'forbidden.0.trigger.control',
      line: lineOf(text, 'control: lv.nope'),
    });
  });
});

describe('L4: duplicate ids', () => {
  it('rejects two steps with one id, at the second', () => {
    const text = swap(MINIMAL, 'id: open_cowl_flap', 'id: reduce_power');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'procedure.0.steps.1.id',
      line: lineOf(text, 'text: Open cowl flap') - 2,
      // The id is the first field of the list item, so it starts where the text field starts.
      col: colOf(text, 'text: Open cowl flap', 'text'),
    });
  });

  it('rejects a forbidden id equal to a group id, and a step id equal to a group id', () => {
    const forbidden = swap(MINIMAL, 'id: power_increased', 'id: immediate');
    expect(issuesOf(forbidden)[0]).toMatchObject({
      path: 'forbidden.0.id',
      line: lineOf(forbidden, 'text: Increase power') - 1,
    });
    const step = swap(MINIMAL, 'id: reduce_power', 'id: immediate');
    expect(issuesOf(step)[0]).toMatchObject({
      path: 'procedure.0.steps.0.id',
      line: lineOf(step, 'text: Reduce power') - 2,
    });
  });
});

describe('L5: step already satisfied', () => {
  it('rejects a graded step that holds in the initial state', () => {
    const text = swap(MINIMAL, 'lv.cowl_flap: closed', 'lv.cowl_flap: open');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'procedure.0.steps.1.done',
      line: lineOf(text, 'text: Open cowl flap') + 1,
      col: colOf(text, 'done:', 'done'),
    });
    expect(issues[0]?.message).toContain('already satisfied');
  });

  it('does not judge a group below a branch that does not apply at the start', () => {
    // The branch asks for an open cowl flap, which the initial state does not have; the group
    // would be satisfied by an open flap, but it is not graded here.
    const text = nested(1, GROUP.replace('is: open', 'is: closed'), undefined, 'open');
    expect(checkScenario(text, DA50RG_ENV).ok).toBe(true);
  });

  it('judges a group below a branch that applies at the start', () => {
    const text = nested(1, GROUP.replace('is: open', 'is: closed'));
    expect(issuesOf(text)[0]?.message).toContain('already satisfied');
  });
});

describe('L6: forbidden trigger already true', () => {
  it('rejects a watched trigger that holds in the initial state', () => {
    const text = swap(
      MINIMAL,
      'check: travel_rel\n      control: lv.power\n      op: gt\n      delta: 0',
      'check: state\n      control: lv.cowl_flap\n      is: closed',
    );
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'forbidden.0.trigger',
      line: lineOf(text, 'trigger:'),
      col: colOf(text, 'trigger:', 'trigger'),
    });
  });

  it('accepts such a trigger when its when-condition does not hold', () => {
    const text = swap(
      MINIMAL,
      '    trigger:\n      check: travel_rel\n      control: lv.power\n      op: gt\n      delta: 0',
      '    trigger:\n      check: state\n      control: lv.cowl_flap\n      is: closed\n    when:\n      check: state\n      control: lv.cowl_flap\n      is: open',
    );
    expect(checkScenario(text, DA50RG_ENV).ok).toBe(true);
  });
});

describe('L7: branch levels', () => {
  const inner = '- kind: line\n  text: Land';

  it('accepts three levels', () => {
    expect(MAX_BRANCH_LEVELS).toBe(3);
    expect(checkScenario(nested(MAX_BRANCH_LEVELS, inner), DA50RG_ENV).ok).toBe(true);
  });

  it('rejects the fourth level, at that branch', () => {
    const text = nested(MAX_BRANCH_LEVELS + 1, inner);
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('procedure.0.nodes.0.nodes.0.nodes.0');
    expect(issues[0]?.line).toBe(lineOf(text, 'If level 4:') - 1);
    expect(issues[0]?.col).toBe(colOf(text, 'If level 4:', 'label') - 2);
    expect(issues[0]?.message).toContain('at most 3');
  });

  it('counts the branches of a decision', () => {
    const decision = [
      '- kind: decision',
      '  text: Check',
      '  branches[1]:',
      '    - label: "If more:"',
      '      when:',
      '        check: state',
      '        control: lv.cowl_flap',
      '        is: closed',
    ].join('\n');
    const issues = issuesOf(nested(MAX_BRANCH_LEVELS, decision));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('procedure.0.nodes.0.nodes.0.nodes.0.branches.0');
  });
});

describe('L8: groups under a branch decided during the run', () => {
  it('rejects a group below a run branch, at the group', () => {
    const text = nested(1, GROUP, 1);
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'procedure.0.nodes.0',
      line: lineOf(text, 'kind: group'),
    });
    expect(issues[0]?.message).toContain('decided during the run');
  });

  it('rejects a group deeper below a run branch', () => {
    const issues = issuesOf(nested(2, GROUP, 1));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('procedure.0.nodes.0.nodes.0');
  });

  it('accepts a run branch with lines only', () => {
    expect(checkScenario(nested(1, '- kind: line\n  text: Land', 1), DA50RG_ENV).ok).toBe(true);
  });
});

describe('L12: physics parameters', () => {
  const withParameters = (lines: string): string =>
    swap(
      MINIMAL,
      'annunciations[1]: eng_oil_temp',
      `parameters:\n${lines}\nannunciations[1]: eng_oil_temp`,
    );

  it('passes a parameter inside its range, also on the range bounds', () => {
    for (const value of ['0.55', '1', '0.2']) {
      expect(checkScenario(withParameters(`  oil_cooling: ${value}`), DA50RG_ENV).ok, value).toBe(
        true,
      );
    }
  });

  it('rejects an unknown parameter at parameters.ID', () => {
    const text = withParameters('  oil_nope: 0.5');
    expect(issuesOf(text)).toEqual([
      {
        path: 'parameters.oil_nope',
        message: 'unknown parameter "oil_nope"',
        line: lineOf(text, 'oil_nope'),
        col: colOf(text, 'oil_nope', 'oil_nope'),
      },
    ]);
  });

  it('rejects a value outside the range of the parameter', () => {
    for (const value of ['1.5', '0.1', '-3']) {
      const text = withParameters(`  oil_cooling: ${value}`);
      expect(issuesOf(text), value).toEqual([
        {
          path: 'parameters.oil_cooling',
          message: `${value} is outside 0.2..1 of parameter "oil_cooling"`,
          line: lineOf(text, `oil_cooling: ${value}`),
          col: colOf(text, `oil_cooling: ${value}`, 'oil_cooling'),
        },
      ]);
    }
  });

  it('does not resolve a prototype key', () => {
    const text = withParameters('  constructor: 0.5');
    expect(issuesOf(text)[0]).toMatchObject({
      path: 'parameters.constructor',
      message: 'unknown parameter "constructor"',
    });
  });

  it('the blueprint sets a parameter and passes', () => {
    expect(BLUEPRINT).toContain('parameters:');
    expect(checkScenario(BLUEPRINT, DA50RG_ENV).ok).toBe(true);
  });
});

describe('L11: a run that does nothing must fail', () => {
  it('rejects a blueprint whose applying branch holds no step', () => {
    // 2.5 bar is in the low band: "If too low:" applies and has no nodes, the green branch does not.
    const text = swap(BLUEPRINT, 'oil_pressure_bar: 5', 'oil_pressure_bar: 2.5');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'procedure',
      line: lineOf(text, 'procedure[1]:'),
      col: 1,
    });
    expect(issues[0]?.message).toContain('a run that does nothing would pass');
  });

  it('rejects a scenario without a critical step', () => {
    const text = MINIMAL.replaceAll('severity: critical', 'severity: standard');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ path: 'procedure', line: lineOf(text, 'procedure[2]:') });
  });

  it('passes the minimal scenario and the blueprint', () => {
    expect(checkScenario(MINIMAL, DA50RG_ENV).ok).toBe(true);
    expect(checkScenario(BLUEPRINT, DA50RG_ENV).ok).toBe(true);
  });
});

describe('L10: annunciations equal the rules that fire at the start', () => {
  it('names an unknown CAS id at its list item', () => {
    const text = swap(
      MINIMAL,
      'annunciations[1]: eng_oil_temp',
      'annunciations[2]: eng_oil_temp,eng_nope',
    );
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'annunciations.1',
      message: 'unknown CAS id "eng_nope"',
      line: lineOf(text, 'annunciations[2]'),
    });
  });

  it('flags a missing expected annunciation', () => {
    const text = swap(MINIMAL, 'annunciations[1]: eng_oil_temp', 'annunciations[0]:');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'annunciations',
      message: expect.stringContaining('"eng_oil_temp"') as string,
      line: lineOf(text, 'annunciations[0]'),
    });
  });

  it('flags an extra annunciation whose rule does not fire', () => {
    const text = swap(MINIMAL, 'oil_temp_c: 128', 'oil_temp_c: 100');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'annunciations.0',
      message: expect.stringContaining('does not fire') as string,
      line: lineOf(text, 'annunciations[1]'),
    });
  });

  it('flags a duplicate listing', () => {
    const text = swap(
      MINIMAL,
      'annunciations[1]: eng_oil_temp',
      'annunciations[2]: eng_oil_temp,eng_oil_temp',
    );
    const issues = issuesOf(text);
    expect(issues.map((i) => i.path)).toEqual(['annunciations.1']);
  });

  it('flags more than 6 active rules at the start', () => {
    const rules = Array.from({ length: 7 }, (_, i) => ({
      id: `m${String(i)}`,
      text: `MSG ${String(i)}`,
      level: 'caution' as const,
      when: { check: 'quantity' as const, quantity: 'oil_temp_c', op: 'gt' as const, value: 100 },
    }));
    const env = {
      ...DA50RG_ENV,
      cas: defineCasRules(rules, DA50RG_ENV),
    };
    const scenario = { ...parsedOf(MINIMAL), annunciations: rules.map((r) => r.id) };
    const found = lintScenario(scenario, env);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      path: 'annunciations',
      message: expect.stringContaining('at most 6') as string,
    });
  });

  it('passes the blueprint and the minimal scenario', () => {
    expect(lintScenario(parsedOf(BLUEPRINT), DA50RG_ENV)).toEqual([]);
    expect(lintScenario(parsedOf(MINIMAL), DA50RG_ENV)).toEqual([]);
  });
});

describe('L13: outcomes', () => {
  const outcome = (id: string, quantityLine = 'quantity: oil_temp_c', value = 140): string =>
    [
      `  - id: ${id}`,
      '    text: Engine failure from overheating',
      '    hold_s: 15',
      '    when:',
      '      check: quantity',
      `      ${quantityLine}`,
      '      op: gte',
      `      value: ${String(value)}`,
      '',
    ].join('\n');
  const withOutcomes = (items: readonly string[]): string =>
    `${MINIMAL}outcomes[${String(items.length)}]:\n${items.join('')}`;
  const ID_COL = 5;

  it('passes a well-formed outcome', () => {
    expect(checkScenario(withOutcomes([outcome('engine_failure')]), DA50RG_ENV).ok).toBe(true);
  });

  it('rejects an unknown quantity at the predicate path', () => {
    const text = withOutcomes([outcome('engine_failure', 'quantity: oil_nope')]);
    expect(issuesOf(text)).toEqual([
      expect.objectContaining({
        path: 'outcomes.0.when.quantity',
        message: 'unknown quantity "oil_nope"',
        line: lineOf(text, 'quantity: oil_nope'),
      }),
    ]);
  });

  it('rejects an unknown band', () => {
    const text = swap(
      withOutcomes([outcome('engine_failure')]),
      'check: quantity\n      quantity: oil_temp_c\n      op: gte\n      value: 140',
      'check: band\n      quantity: oil_temp_c\n      in[1]: purple',
    );
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'outcomes.0.when.in.0',
      line: lineOf(text, 'in[1]: purple'),
    });
  });

  it('rejects an illegal control state', () => {
    const text = swap(
      withOutcomes([outcome('engine_failure')]),
      'check: quantity\n      quantity: oil_temp_c\n      op: gte\n      value: 140',
      'check: state\n      control: lv.cowl_flap\n      is: ajar',
    );
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'outcomes.0.when.is',
      line: lineOf(text, 'is: ajar'),
    });
  });

  it('rejects an id used by a step, a group or a forbidden item, at the outcome', () => {
    for (const id of ['reduce_power', 'immediate', 'power_increased']) {
      const text = withOutcomes([outcome(id)]);
      const issues = issuesOf(text);
      expect(issues, id).toHaveLength(1);
      expect(issues[0], id).toMatchObject({
        path: 'outcomes.0.id',
        line: lineOf(text, 'text: Engine failure from overheating') - 1,
        col: ID_COL,
      });
      expect(issues[0]?.message, id).toContain(`duplicate id "${id}"`);
    }
  });

  it('rejects two outcomes with one id, at the second', () => {
    const text = withOutcomes([
      outcome('engine_failure'),
      outcome('engine_failure', undefined, 145),
    ]);
    const issues = issuesOf(text);
    expect(issues.map((i) => i.path)).toEqual(['outcomes.1.id']);
  });

  it('rejects an outcome that already holds in the initial state', () => {
    const text = withOutcomes([outcome('engine_failure', undefined, 100)]);
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'outcomes.0.when',
      message:
        'outcome "engine_failure" already holds in the initial state; the run would end at once',
      line: lineOf(text, 'when:'),
    });
  });

  it('rejects a hold time above 600 s and more than 4 outcomes with a line and column', () => {
    const slow = swap(withOutcomes([outcome('engine_failure')]), 'hold_s: 15', 'hold_s: 601');
    expect(issuesOf(slow)[0]).toMatchObject({
      path: 'outcomes.0.hold_s',
      line: lineOf(slow, 'hold_s: 601'),
      col: colOf(slow, 'hold_s: 601', 'hold_s'),
    });
    const many = withOutcomes(['a', 'b', 'c', 'd', 'e'].map((id) => outcome(`fail_${id}`)));
    const issues = issuesOf(many);
    expect(issues[0]?.path).toBe('outcomes');
    expect(issues[0]?.line).toBeGreaterThan(0);
    expect(issues[0]?.col).toBeGreaterThan(0);
  });

  it('passes the shipped blueprint with its outcome', () => {
    expect(lintScenario(parsedOf(BLUEPRINT), DA50RG_ENV)).toEqual([]);
    expect(parsedOf(BLUEPRINT).outcomes).toHaveLength(1);
  });
});

describe('L14: the realistic level starts clean and shows what the scenario lists (D-05)', () => {
  /** The window of the blueprint as written in the file, read from the file and never typed. */
  const WINDOW_LINE = /window_s\[2\]: \d+,\d+/.exec(BLUEPRINT)?.[0] ?? '';

  const WITH_ONSET = `${MINIMAL}onset:\n  window_s[2]: 5,20\n`;

  /** An aircraft whose ENG OIL TEMP rule already fires at the cruise base value of the oil temperature. */
  const earlyEnv = {
    ...DA50RG_ENV,
    cas: defineCasRules(
      [
        {
          id: 'eng_oil_temp',
          text: 'ENG OIL TEMP',
          level: 'warning' as const,
          when: {
            check: 'quantity' as const,
            quantity: 'oil_temp_c',
            op: 'gt' as const,
            value: 80,
          },
        },
      ],
      DA50RG_ENV,
    ),
  };

  it('does not apply to a scenario without an onset', () => {
    // MINIMAL sets no parameter, so the listed annunciation never shows; without an onset nobody asks.
    expect(checkScenario(MINIMAL, DA50RG_ENV).ok).toBe(true);
  });

  it('passes the blueprint: it starts clean and ENG OIL TEMP shows after the onset', () => {
    expect(parsedOf(BLUEPRINT).onset).toEqual({
      window_s: [2, 6],
      quantities: { oil_temp_c: 114 },
      parameters: {},
      controls: {},
      message_within_s: 22,
    });
    expect(lintScenario(parsedOf(BLUEPRINT), DA50RG_ENV)).toEqual([]);
  });

  it('rejects a listed annunciation that a do-nothing realistic run never shows', () => {
    const issues = issuesOf(WITH_ONSET);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'annunciations.0',
      message: expect.stringContaining('"eng_oil_temp"') as string,
      line: lineOf(WITH_ONSET, 'annunciations[1]'),
    });
    expect(issues[0]?.message).toContain('realistic');
  });

  it('rejects a message that is already active at the realistic start, at the onset quantities', () => {
    // The blueprint sets the start reading in its onset block, so that is where the finding points.
    const found = lintScenario(parsedOf(BLUEPRINT), earlyEnv);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      path: 'onset.quantities',
      message: expect.stringContaining('"eng_oil_temp"') as string,
    });
    expect(found[0]?.message).toContain('realistic start');
  });

  it('rejects a message that the base values fire at the realistic start, at the initial controls', () => {
    const parsed = parseScenario(WITH_ONSET);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const found = lintScenario(parsed.value, earlyEnv);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      path: 'initial.controls',
      message: expect.stringContaining('"eng_oil_temp"') as string,
    });
    expect(found[0]?.message).toContain('realistic start');
  });

  it('rejects an outcome that holds at the realistic start, at the outcome', () => {
    // 120 lies below the initial reading (128) and above the Realistic start reading (114).
    const text = swap(
      BLUEPRINT,
      '      op: gte\n      value: 140',
      '      op: lte\n      value: 120',
    );
    const result = checkScenario(text, DA50RG_ENV);
    expect(result.ok).toBe(false);
    const issues = result.ok ? [] : result.issues;
    expect(issues).toContainEqual(
      expect.objectContaining({
        path: 'outcomes.0.when',
        message: expect.stringContaining('realistic start') as string,
        // The `when:` of the outcome sits at the indent of the outcome item (four spaces).
        line: text.split('\n').lastIndexOf('    when:') + 1,
      }),
    );
  });

  it('bounds the window in the schema: inside 1 to 120 s and the first at most the second', () => {
    for (const bad of ['0,20', '5,121', '20,5']) {
      const text = swap(BLUEPRINT, WINDOW_LINE, `window_s[2]: ${bad}`);
      const result = checkScenario(text, DA50RG_ENV);
      expect(result.ok, bad).toBe(false);
      const first = result.ok ? undefined : result.issues[0];
      expect(first?.path, bad).toMatch(/^onset\.window_s/);
      expect(first?.line, bad).toBe(lineOf(text, 'window_s[2]'));
    }
  });
});

/** The three shipped scenario files. */
const SHIPPED = [
  'scenarios/engine/eng-oil-temp-green.toon',
  'scenarios/electrical/elec-altn1-fail.toon',
  'scenarios/engine/eng-fire-in-flight.toon',
].map((file) => `${root}${file}`);

describe('the Realistic setup: L12 on the onset block, L14 on its start, L15 speed and guard (plan 03-11)', () => {
  const issuesFor = (text: string) => {
    const result = checkScenario(text, DA50RG_ENV);
    return result.ok ? [] : result.issues;
  };
  const withOnset = (from: string, to: string): string => swap(BLUEPRINT, from, to);
  /** The blueprint with one onset parameter line (the shipped file sets none since the rate curve). */
  const withParameter = (line: string): string =>
    withOnset('  message_within_s: 22\n', `  message_within_s: 22\n  parameters:\n    ${line}\n`);

  it('the blueprint with the onset parameter oil_cooling 0.55 (the scenario value) passes', () => {
    expect(issuesFor(withParameter('oil_cooling: 0.55'))).toEqual([]);
  });

  it('L12 reports an unknown onset parameter at onset.parameters.<id>', () => {
    const text = withParameter('oil_coolin: 0.55');
    const issues = issuesFor(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'onset.parameters.oil_coolin',
      message: 'unknown parameter "oil_coolin"',
      line: lineOf(text, 'oil_coolin: 0.55'),
    });
  });

  it.each([0.1, 1.5])('L12 reports an onset parameter outside the range: oil_cooling %s', (bad) => {
    const text = withParameter(`oil_cooling: ${String(bad)}`);
    const issues = issuesFor(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'onset.parameters.oil_cooling',
      message: `${String(bad)} is outside 0.2..1 of parameter "oil_cooling"`,
      line: lineOf(text, `oil_cooling: ${String(bad)}`),
    });
  });

  it('reports an unknown onset quantity and one outside its range at onset.quantities.<id>', () => {
    const unknown = withOnset('oil_temp_c: 114', 'oil_temperature: 114');
    expect(issuesFor(unknown)).toContainEqual(
      expect.objectContaining({
        path: 'onset.quantities.oil_temperature',
        message: 'unknown quantity "oil_temperature"',
        line: lineOf(unknown, 'oil_temperature'),
      }),
    );
    const outside = withOnset('oil_temp_c: 114', 'oil_temp_c: 400');
    expect(issuesFor(outside)).toContainEqual(
      expect.objectContaining({
        path: 'onset.quantities.oil_temp_c',
        message: expect.stringContaining('is outside') as string,
        line: lineOf(outside, 'oil_temp_c: 400'),
      }),
    );
  });

  it('L14 starts from the onset quantities: a start that fires the message is reported there', () => {
    const text = withOnset('oil_temp_c: 114', 'oil_temp_c: 130');
    const issues = issuesFor(text);
    expect(issues).toContainEqual(
      expect.objectContaining({
        path: 'onset.quantities',
        message: expect.stringContaining('already active at the realistic start') as string,
      }),
    );
  });

  it('L14 reports an onset quantity that already holds an outcome', () => {
    const text = withOnset('oil_temp_c: 114', 'oil_temp_c: 145');
    const issues = issuesFor(text);
    expect(issues).toContainEqual(
      expect.objectContaining({
        path: 'outcomes.0.when',
        message: expect.stringContaining('realistic start') as string,
      }),
    );
  });

  /** The seconds the L15 message names as measured, from the first issue of a text. */
  const measuredS = (text: string): number => {
    const issues = issuesFor(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'annunciations.0',
      line: lineOf(text, 'annunciations[1]'),
    });
    expect(issues[0]?.message).toMatch(/shows \d+\.\d s after the onset/);
    return Number(/shows (\d+\.\d) s/.exec(issues[0]?.message ?? '')?.[1]);
  };

  it('L15 speed: a scenario without its own bound is held to the default, with the seconds', () => {
    const text = withOnset('  message_within_s: 22\n', '');
    const measured = measuredS(text);
    expect(measured * 1000).toBeGreaterThan(REALISTIC_SHOW_WITHIN_MS);
    expect(issuesFor(text)[0]?.message).toContain(
      `within ${String(REALISTIC_SHOW_WITHIN_MS / 1000)} s`,
    );
  });

  it('L15 speed: the bound of the scenario file replaces the default for that file', () => {
    const text = withOnset('message_within_s: 22', 'message_within_s: 19');
    const measured = measuredS(text);
    expect(measured).toBeGreaterThan(19);
    expect(measured).toBeLessThanOrEqual(22);
    expect(issuesFor(text)[0]?.message).toContain('within 19 s');
    expect(issuesFor(BLUEPRINT)).toEqual([]);
  });

  it('L15 speed: the other two scenarios declare no bound of their own and keep the default', () => {
    for (const file of SHIPPED) {
      const parsed = parseScenario(readFileSync(file, 'utf8'));
      if (!parsed.ok) throw new Error(`${file} does not parse`);
      if (file.endsWith('eng-oil-temp-green.toon')) {
        expect(parsed.value.onset?.message_within_s, file).toBe(22);
      } else {
        expect(parsed.value.onset?.message_within_s, file).toBeUndefined();
      }
    }
  });

  it('L15 guard: a branch decided at the start that reads an onset quantity is reported there', () => {
    // The pressure check of the blueprint reads oil_pressure_bar; the onset block now sets it too.
    const text = withOnset(
      '    oil_temp_c: 114\n',
      '    oil_temp_c: 114\n    oil_pressure_bar: 5\n',
    );
    const issues = issuesFor(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'onset.quantities.oil_pressure_bar',
      // The line of the new entry, the last one of that key (the initial block has the first).
      line: text.split('\n').lastIndexOf('    oil_pressure_bar: 5') + 1,
    });
    expect(issues[0]?.message).toContain('decided at the start');
  });

  it('the shipped scenarios pass: the blueprint, ALTN 1 FAIL and Engine Fire', () => {
    for (const file of SHIPPED) {
      const result = checkScenario(readFileSync(file, 'utf8'), DA50RG_ENV);
      expect(result.ok, file).toBe(true);
    }
  });

  it('every shipped scenario declares the window 2 to 6 s and still fails a do-nothing run', () => {
    for (const file of SHIPPED) {
      const parsed = parseScenario(readFileSync(file, 'utf8'));
      if (!parsed.ok) throw new Error(`${file} does not parse`);
      expect(parsed.value.onset?.window_s, file).toEqual([2, 6]);
      // L11: a run that does nothing must fail, so a critical step is graded at the start.
      expect(lintScenario(parsed.value, DA50RG_ENV), file).toEqual([]);
    }
  });
});

describe('L16 and L17: a checklist as printed (plan 03-13)', () => {
  // MINIMAL as a numbered table: the two steps of its group are rows 1 and 2, the line row 3.
  const TABLE = swap(
    swap(
      swap(
        swap(MINIMAL, 'procedure[2]:', 'checklist:\n  form: table\nprocedure[2]:'),
        'text: Reduce power',
        'text: Reduce power\n        number: 1',
      ),
      'text: Open cowl flap',
      'text: Open cowl flap\n        number: 2',
    ),
    'text: Increase airspeed',
    'text: Increase airspeed\n    number: 3',
  );

  it('passes the numbered table and a checklist without numbers', () => {
    expect(checkScenario(TABLE, DA50RG_ENV).ok).toBe(true);
    expect(checkScenario(MINIMAL, DA50RG_ENV).ok).toBe(true);
    // rows 1 and 2 stay numbered, the last row is free
    expect(checkScenario(swap(TABLE, '\n    number: 3', ''), DA50RG_ENV).ok).toBe(true);
  });

  it('L16: reports a gap at the number, with the expected and the found number', () => {
    const text = swap(TABLE, 'number: 3', 'number: 4');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'procedure.1.number',
      line: lineOf(text, 'number: 4'),
      col: colOf(text, 'number: 4', 'number'),
    });
    expect(issues[0]?.message).toContain('expected 3');
    expect(issues[0]?.message).toContain('4');
  });

  it('L16: reports a repeat and a start other than 1, one issue each', () => {
    const repeat = swap(TABLE, 'number: 3', 'number: 2');
    const repeated = issuesOf(repeat);
    expect(repeated).toHaveLength(1);
    expect(repeated[0]).toMatchObject({
      path: 'procedure.1.number',
      line: lineOf(repeat, 'text: Increase airspeed') + 1,
    });
    expect(repeated[0]?.message).toContain('expected 3');

    const late = swap(
      swap(swap(TABLE, 'number: 3', 'number: 4'), 'number: 2', 'number: 3'),
      'number: 1',
      'number: 2',
    );
    const start = issuesOf(late);
    expect(start).toHaveLength(1);
    expect(start[0]).toMatchObject({
      path: 'procedure.0.steps.0.number',
      line: lineOf(late, 'text: Reduce power') + 1,
    });
    expect(start[0]?.message).toContain('expected 1');
  });

  it('L16: rows without a number are free between numbered rows', () => {
    const text = swap(
      TABLE,
      '  - kind: line\n    text: Increase airspeed\n    number: 3',
      '  - kind: comment\n    text: Select appropriate emergency landing area\n  - kind: line\n    text: Increase airspeed\n    number: 3',
    ).replace('procedure[2]:', 'procedure[3]:');
    expect(checkScenario(text, DA50RG_ENV).ok).toBe(true);
  });

  it('L17: a decision and a branch in a table, each at its node', () => {
    const branch = [
      '  - kind: branch',
      '    label: "If something:"',
      '    when:',
      '      check: state',
      '      control: lv.cowl_flap',
      '      is: closed',
    ].join('\n');
    const decision = [
      '  - kind: decision',
      '    text: Check',
      '    branches[1]:',
      '      - label: "If more:"',
      '        when:',
      '          check: state',
      '          control: lv.cowl_flap',
      '          is: closed',
    ].join('\n');
    for (const [node, word] of [
      [branch, 'branch'],
      [decision, 'decision'],
    ] as const) {
      const text = swap(TABLE, '    number: 3', `    number: 3\n${node}`).replace(
        'procedure[2]:',
        'procedure[3]:',
      );
      const issues = issuesOf(text);
      expect(issues, word).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: 'procedure.2',
        line: lineOf(text, `kind: ${word}`),
        col: colOf(text, `kind: ${word}`, 'kind') - 2,
      });
      expect(issues[0]?.message).toContain(word);
    }
  });

  it('L17: a number, an action and a comment in the default form, each at its key', () => {
    const numbered = swap(
      MINIMAL,
      'text: Increase airspeed',
      'text: Increase airspeed\n    number: 1',
    );
    const a = issuesOf(numbered);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({
      path: 'procedure.1.number',
      line: lineOf(numbered, 'number: 1'),
      col: colOf(numbered, 'number: 1', 'number'),
    });

    const action = swap(
      MINIMAL,
      'text: Increase airspeed',
      'text: Increase airspeed\n    action: ON',
    );
    const b = issuesOf(action);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ path: 'procedure.1.action', line: lineOf(action, 'action: ON') });

    const comment = swap(
      MINIMAL,
      'text: Increase airspeed',
      'text: Increase airspeed\n  - kind: comment\n    text: Leave icing conditions.',
    ).replace('procedure[2]:', 'procedure[3]:');
    const c = issuesOf(comment);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({
      path: 'procedure.2',
      line: lineOf(comment, 'kind: comment'),
      col: colOf(comment, 'kind: comment', 'kind') - 2,
    });
  });

  it('L17: a step number and action in the default form are reported at the step key', () => {
    const text = swap(MINIMAL, 'text: Reduce power', 'text: Reduce power\n        number: 1');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('procedure.0.steps.0.number');
  });

  it('L17: a marker in the table form, at its key, on a line and on a step', () => {
    const line = swap(TABLE, '    number: 3', '    number: 3\n    marker: arrow');
    const a = issuesOf(line);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({
      path: 'procedure.1.marker',
      line: lineOf(line, 'marker: arrow'),
      col: colOf(line, 'marker: arrow', 'marker'),
    });
    expect(a[0]?.message).toContain('marker');

    const step = swap(TABLE, '        number: 1', '        number: 1\n        marker: square');
    const b = issuesOf(step);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({
      path: 'procedure.0.steps.0.marker',
      line: lineOf(step, 'marker: square'),
    });
  });

  it('L17: a marker in the default (outline) form is fine', () => {
    const text = swap(
      MINIMAL,
      'text: Increase airspeed',
      'text: Increase airspeed\n    marker: double_arrow',
    );
    expect(checkScenario(text, DA50RG_ENV).ok).toBe(true);
  });
});
