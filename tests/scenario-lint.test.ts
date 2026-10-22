import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { defineCasRules } from '../src/engine/cas';
import { checkScenario, lintScenario, MAX_BRANCH_LEVELS } from '../src/scenario/lint';
import { colOf, lineOf, MINIMAL, nested, swap } from './scenario-text';

// Lint rules L1 to L8 (SCN-02, Table L1) through checkScenario: one failing case per rule, each an
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
