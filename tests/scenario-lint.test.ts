import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { defineCasRules } from '../src/engine/cas';
import { grade } from '../src/engine/grading';
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

describe('L22: scene (phase 05, W-07)', () => {
  const withScene = (id: string): string =>
    swap(MINIMAL, 'disclaimer: training-aid', `disclaimer: training-aid\nscene: ${id}`);

  it('passes when the scene is absent, the default applies', () => {
    expect(checkScenario(MINIMAL, DA50RG_ENV).ok).toBe(true);
  });

  it.each([...DA50RG_ENV.scenes.ids])('passes the known scene %s', (id) => {
    expect(checkScenario(withScene(id), DA50RG_ENV).ok).toBe(true);
  });

  it('knows the cloud scene', () => {
    expect(DA50RG_ENV.scenes.ids).toContain('cloud');
    expect(checkScenario(withScene('cloud'), DA50RG_ENV).ok).toBe(true);
  });

  it('rejects an unknown scene at scene, with the line of the field and the known ids', () => {
    const text = withScene('night');
    expect(issuesOf(text)).toEqual([
      {
        path: 'scene',
        message: `unknown scene "night"; known scenes: ${DA50RG_ENV.scenes.ids.join(', ')}`,
        line: lineOf(text, 'scene: night'),
        col: colOf(text, 'scene: night', 'scene'),
      },
    ]);
  });

  it('rejects a scene id that does not match the id pattern in the schema', () => {
    const result = checkScenario(withScene('Night-Sky'), DA50RG_ENV);
    expect(result.ok).toBe(false);
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

describe('L25: the flight profile (Phase 6, plan 03)', () => {
  const withProfile = (lines: string): string =>
    swap(
      MINIMAL,
      'annunciations[1]: eng_oil_temp',
      `profile:\n${lines}\nannunciations[1]: eng_oil_temp`,
    );

  it('passes a valid profile, also the oat and the fuel temperature difference, on the bounds', () => {
    for (const lines of [
      '  flight_vs_fpm: 500',
      '  flight_vs_fpm: -2000\n  terrain_ft: 0',
      '  oat_c: -5\n  fuel_temp_delta_c: -4',
      '  oat_c: 50\n  fuel_temp_delta_c: 10',
    ]) {
      expect(checkScenario(withProfile(lines), DA50RG_ENV).ok, lines).toBe(true);
    }
  });

  it('rejects an unknown key at profile.ID', () => {
    const text = withProfile('  flight_nope: 1');
    expect(issuesOf(text)).toEqual([
      {
        path: 'profile.flight_nope',
        message: 'unknown parameter "flight_nope"',
        line: lineOf(text, 'flight_nope'),
        col: colOf(text, 'flight_nope', 'flight_nope'),
      },
    ]);
  });

  it('rejects a failure parameter such as the oil cooling', () => {
    const text = withProfile('  oil_cooling: 0.5');
    expect(issuesOf(text)).toEqual([
      {
        path: 'profile.oil_cooling',
        message: 'parameter "oil_cooling" is not a profile parameter; set it under parameters',
        line: lineOf(text, 'oil_cooling'),
        col: colOf(text, 'oil_cooling', 'oil_cooling'),
      },
    ]);
  });

  it('rejects a value outside the range of the parameter', () => {
    const text = withProfile('  flight_vs_fpm: 2500');
    expect(issuesOf(text)).toEqual([
      {
        path: 'profile.flight_vs_fpm',
        message: '2500 is outside -2000..2000 of parameter "flight_vs_fpm"',
        line: lineOf(text, 'flight_vs_fpm'),
        col: colOf(text, 'flight_vs_fpm', 'flight_vs_fpm'),
      },
    ]);
  });

  it('does not resolve a prototype key', () => {
    expect(issuesOf(withProfile('  constructor: 1'))[0]).toMatchObject({
      path: 'profile.constructor',
      message: 'unknown parameter "constructor"',
    });
  });

  it('rejects a profile value that is not a number in the schema', () => {
    expect(checkScenario(withProfile('  flight_vs_fpm: fast'), DA50RG_ENV).ok).toBe(false);
  });
});

describe('L25: profile conflicts and floors (Phase 6 review, WR-03)', () => {
  const withBlock = (block: string): string =>
    swap(MINIMAL, 'annunciations[1]: eng_oil_temp', `${block}\nannunciations[1]: eng_oil_temp`);

  it('rejects a profile parameter under parameters, at parameters.ID with line and column', () => {
    const text = withBlock('parameters:\n  oat_c: 5');
    expect(issuesOf(text)).toEqual([
      {
        path: 'parameters.oat_c',
        message:
          'parameter "oat_c" is a profile parameter; set it under profile, where it holds from the first second',
        line: lineOf(text, 'oat_c'),
        col: colOf(text, 'oat_c', 'oat_c'),
      },
    ]);
  });

  it('rejects the ground under parameters, the case of the shipped ground situations', () => {
    const text = withBlock('parameters:\n  ground_roll: 1');
    expect(issuesOf(text)).toMatchObject([{ path: 'parameters.ground_roll' }]);
    // In the profile the same key raises no profile issue (the stall heat message of the ground is
    // L26's business, tested below).
    const inProfile = lintScenario(parsedOf(MINIMAL), DA50RG_ENV);
    expect(inProfile).toEqual([]);
    const moved = { ...parsedOf(MINIMAL), profile: { ground_roll: 1 } };
    expect(lintScenario(moved, DA50RG_ENV).map((issue) => issue.path)).not.toContain(
      'profile.ground_roll',
    );
  });

  it('still takes a failure parameter under parameters', () => {
    expect(checkScenario(withBlock('parameters:\n  oil_cooling: 0.5'), DA50RG_ENV).ok).toBe(true);
  });

  it('rejects a key in the profile and again in parameters once, at the profile key', () => {
    const text = withBlock('profile:\n  oat_c: 5\nparameters:\n  oat_c: 8');
    expect(issuesOf(text)).toEqual([
      {
        path: 'profile.oat_c',
        message:
          '"oat_c" is set in the profile and again in parameters; the later layer silently wins from the onset on, so set it once',
        line: lineOf(text, 'oat_c: 5'),
        col: colOf(text, 'oat_c: 5', 'oat_c'),
      },
    ]);
  });

  it('rejects a key in the profile and again in onset.parameters', () => {
    const text = swap(
      swap(
        BLUEPRINT,
        'parameters:\n  oil_cooling: 0.55',
        'profile:\n  oat_c: 5\nparameters:\n  oil_cooling: 0.55',
      ),
      'message_within_s: 22',
      'parameters:\n    oat_c: 8\n  message_within_s: 22',
    );
    expect(issuesOf(text)).toEqual([
      {
        path: 'profile.oat_c',
        message:
          '"oat_c" is set in the profile and again in onset.parameters; the later layer silently wins from the onset on, so set it once',
        line: lineOf(text, 'oat_c: 5'),
        col: colOf(text, 'oat_c: 5', 'oat_c'),
      },
    ]);
  });

  it('allows a profile parameter in onset.parameters alone: a deliberate change at the onset', () => {
    const text = swap(
      BLUEPRINT,
      'message_within_s: 22',
      'parameters:\n    fuel_temp_delta_c: 4\n  message_within_s: 22',
    );
    const result = checkScenario(text, DA50RG_ENV);
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it('rejects a key in the profile and again in the parameters of a variant', () => {
    const scenario = {
      ...parsedOf(MINIMAL),
      profile: { oat_c: 5 },
      variants: [
        {
          id: 'warm',
          weight: 1,
          controls: {},
          parameters: { oat_c: 20 },
          applies: [],
          debrief: 'A warm day.',
        },
      ],
    };
    expect(lintScenario(scenario, DA50RG_ENV)).toMatchObject([
      {
        path: 'profile.oat_c',
        message: expect.stringContaining('again in the parameters of variant "warm"') as string,
      },
    ]);
  });

  it('rejects a terrain above the start altitude at profile.terrain_ft', () => {
    // MINIMAL starts at the base altitude (1400 ft); a terrain of 2000 ft would lift the aircraft.
    const text = withBlock('profile:\n  terrain_ft: 2000');
    expect(issuesOf(text)).toEqual([
      {
        path: 'profile.terrain_ft',
        message:
          'altitude_ft starts at 1400 in the Easy and Medium run, below terrain_ft 2000; the model would lift it to terrain_ft in the first step, so start at or above it',
        line: lineOf(text, 'terrain_ft'),
        col: colOf(text, 'terrain_ft', 'terrain_ft'),
      },
    ]);
  });

  it('accepts a terrain at or below the start altitude', () => {
    for (const lines of ['  terrain_ft: 1400', '  terrain_ft: 0', '  terrain_ft: 1399.5']) {
      expect(checkScenario(withBlock(`profile:\n${lines}`), DA50RG_ENV).ok, lines).toBe(true);
    }
    const high = swap(
      withBlock('profile:\n  terrain_ft: 2500'),
      '    oil_temp_c: 128',
      '    oil_temp_c: 128\n    altitude_ft: 3000',
    );
    expect(checkScenario(high, DA50RG_ENV).ok).toBe(true);
  });

  it('rejects a start altitude below the normal terrain, at initial.quantities.altitude_ft', () => {
    const text = swap(MINIMAL, '    oil_temp_c: 128', '    oil_temp_c: 128\n    altitude_ft: 1000');
    expect(issuesOf(text)).toEqual([
      {
        path: 'initial.quantities.altitude_ft',
        message:
          'altitude_ft starts at 1000 in the Easy and Medium run, below terrain_ft 1400; the model would lift it to terrain_ft in the first step, so start at or above it',
        line: lineOf(text, 'altitude_ft'),
        col: colOf(text, 'altitude_ft', 'altitude_ft'),
      },
    ]);
  });

  it('rejects a terrain above the Realistic start altitude, which differs from the Easy one', () => {
    // The blueprint starts at 4500 ft on every level; the Realistic start is lowered to 3000 ft.
    const text = swap(
      swap(
        BLUEPRINT,
        'parameters:\n  oil_cooling: 0.55',
        'profile:\n  terrain_ft: 4000\nparameters:\n  oil_cooling: 0.55',
      ),
      '    altitude_ft: 4500\n    oil_temp_c: 114',
      '    altitude_ft: 3000\n    oil_temp_c: 114',
    );
    expect(issuesOf(text)).toEqual([
      {
        path: 'profile.terrain_ft',
        message:
          'altitude_ft starts at 3000 in the Realistic run, below terrain_ft 4000; the model would lift it to terrain_ft in the first step, so start at or above it',
        line: lineOf(text, 'terrain_ft'),
        col: colOf(text, 'terrain_ft', 'terrain_ft'),
      },
    ]);
  });

  it('rejects a terrain the onset raises above the start altitude, at onset.parameters.terrain_ft', () => {
    const text = swap(
      BLUEPRINT,
      'message_within_s: 22',
      'parameters:\n    terrain_ft: 6000\n  message_within_s: 22',
    );
    const issues = issuesOf(text);
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue).toMatchObject({
        path: 'onset.parameters.terrain_ft',
        line: lineOf(text, 'terrain_ft'),
        col: colOf(text, 'terrain_ft', 'terrain_ft'),
      });
    }
  });
});

describe('L26: the messages of a run that does nothing (Phase 6 review, WR-01)', () => {
  const ground = (extra = ''): string =>
    swap(
      MINIMAL,
      'annunciations[1]: eng_oil_temp',
      `profile:\n  ground_roll: 1\nannunciations[1]: eng_oil_temp${extra}`,
    );

  it('rejects a message that appears later in a do-nothing run and is not listed', () => {
    // On the ground with the heat on, the stall heat cuts out 5.1 s into the run.
    const text = ground();
    expect(issuesOf(text)).toEqual([
      {
        path: 'annunciations',
        message:
          '"stall_heat_ground" becomes active 5.1 s into a run that does nothing (Easy and Medium) but is not listed; list it under late_annunciations',
        line: lineOf(text, 'annunciations[1]'),
        col: 1,
      },
    ]);
  });

  it('passes when the message is listed under late_annunciations', () => {
    expect(checkScenario(ground('\nlate_annunciations[1]: stall_heat_ground'), DA50RG_ENV).ok).toBe(
      true,
    );
  });

  it('rejects the late message of the Realistic run on its own, in the Realistic form', () => {
    // The blueprint has an onset; the ground message shows in the Easy run and in both Realistic runs.
    // A ground scenario declares conduct none (L28), so the further block says it.
    const text = swap(
      swap(
        BLUEPRINT,
        'parameters:\n  oil_cooling: 0.55',
        'profile:\n  ground_roll: 1\nparameters:\n  oil_cooling: 0.55',
      ),
      '  conduct:\n    accept[1]: conduct_precautionary',
      '  conduct: none',
    );
    const messages = issuesOf(text).map((issue) => issue.message);
    expect(messages).toContain(
      '"stall_heat_ground" becomes active 5.1 s into a run that does nothing (Easy and Medium) but is not listed; list it under late_annunciations',
    );
    expect(messages).toContain(
      '"stall_heat_ground" becomes active 5.1 s into a run that does nothing (Realistic, onset at the lower end) but is not listed; list it under late_annunciations',
    );
    const listed = swap(
      text,
      'annunciations[1]: eng_oil_temp',
      'annunciations[1]: eng_oil_temp\nlate_annunciations[1]: stall_heat_ground',
    );
    const result = checkScenario(listed, DA50RG_ENV);
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it('does not flag what shows at the start: that is L10', () => {
    // The heat off at the start fires PITOT HEAT and STALL HEAT at t 0; L10 asks for them, L26 is silent.
    const text = swap(
      MINIMAL,
      '    lv.cowl_flap: closed',
      '    lv.cowl_flap: closed\n    sw.pitot_stall_heat: "off"',
    );
    const issues = issuesOf(text);
    expect(issues.every((issue) => issue.message.includes('is not listed; its rule fires'))).toBe(
      true,
    );
    expect(issues.some((issue) => issue.message.includes('late_annunciations'))).toBe(false);
  });

  it('rejects a late annunciation that never appears, at late_annunciations.N', () => {
    const text = swap(
      MINIMAL,
      'annunciations[1]: eng_oil_temp',
      'annunciations[1]: eng_oil_temp\nlate_annunciations[1]: fuel_trans',
    );
    expect(issuesOf(text)).toEqual([
      {
        path: 'late_annunciations.0',
        message:
          '"fuel_trans" is listed but never becomes active in a run that does nothing; remove it',
        line: lineOf(text, 'late_annunciations'),
        col: 1,
      },
    ]);
  });

  it('rejects an unknown id, a repeat and an id that is under annunciations as well', () => {
    const base = 'annunciations[1]: eng_oil_temp';
    const unknown = swap(MINIMAL, base, `${base}\nlate_annunciations[1]: no_such_message`);
    expect(issuesOf(unknown)).toMatchObject([
      { path: 'late_annunciations.0', message: 'unknown CAS id "no_such_message"' },
    ]);
    const both = swap(MINIMAL, base, `${base}\nlate_annunciations[1]: eng_oil_temp`);
    expect(issuesOf(both)).toMatchObject([
      {
        path: 'late_annunciations.0',
        message: '"eng_oil_temp" is listed under annunciations as well; list it under one of them',
      },
    ]);
    const twice = swap(
      ground(),
      'annunciations[1]: eng_oil_temp',
      'annunciations[1]: eng_oil_temp\nlate_annunciations[2]: stall_heat_ground,stall_heat_ground',
    );
    expect(issuesOf(twice)).toMatchObject([
      { path: 'late_annunciations.1', message: '"stall_heat_ground" is listed twice' },
    ]);
  });
});

describe('ambient messages: the stall heat of a grounded start (owner, 2026-10-29)', () => {
  const GROUND_FILE = readFileSync(`${root}scenarios/fire/eng-fire-ground.toon`, 'utf8');

  it('the shipped grounded start passes: the chip is listed at the start and the Realistic start carries it', () => {
    expect(checkScenario(GROUND_FILE, DA50RG_ENV).ok).toBe(true);
    expect(DA50RG_ENV.cas.get('stall_heat_ground')?.ambient).toBe(true);
    expect(DA50RG_ENV.cas.get('stall_heat')?.ambient).not.toBe(true);
    expect(DA50RG_ENV.cas.get('eng_oil_temp')?.ambient).not.toBe(true);
  });

  it('L10 still wants the chip listed when it shows at the start', () => {
    const text = swap(GROUND_FILE, 'annunciations[1]: stall_heat_ground', 'annunciations[0]:');
    const issues = issuesOf(text);
    expect(issues.map((issue) => issue.message)).toEqual([
      '"stall_heat_ground" is not listed; its rule fires in the initial state',
    ]);
  });

  it('an Easy start without the timer past the cut band lists a chip that does not fire at the start (L10)', () => {
    const lines = GROUND_FILE.split('\n');
    const at = lines.findIndex((line) => line.includes('stall_heat_timer_s: 60'));
    expect(lines[at - 1]).toContain('owner, 2026-10-29');
    const text = [...lines.slice(0, at - 1), ...lines.slice(at + 1)].join('\n');
    const messages = issuesOf(text).map((issue) => issue.message);
    expect(messages).toContain(
      '"stall_heat_ground" is listed but its rule does not fire in the initial state',
    );
  });

  it('L14 still rejects a message that is not ambient at the Realistic start', () => {
    // The oil temperature above the red line at the Realistic start would give the failure away.
    const text = swap(
      GROUND_FILE,
      '    airspeed_kt: 0\n    stall_heat_timer_s: 60\n  cues',
      '    airspeed_kt: 0\n    stall_heat_timer_s: 60\n    oil_temp_c: 130\n  cues',
    );
    const messages = issuesOf(text).map((issue) => issue.message);
    expect(
      messages.some((m) => m.includes('"eng_oil_temp" is already active at the realistic start')),
    ).toBe(true);
    expect(messages.some((m) => m.includes('stall_heat_ground" is already active'))).toBe(false);
  });

  it('L24: an ambient annunciation does not count as something the onset reveals', () => {
    const text = swap(GROUND_FILE, '  cues[1]: flames', '');
    const messages = issuesOf(text).map((issue) => issue.message);
    expect(messages).toEqual([
      'the onset has no annunciation and no cue; list an annunciation or declare onset.cues, so the level Realistic shows the failure',
    ]);
  });

  it('L26 does not ask for the ambient chip under late_annunciations, and lists it as late only if it appears later', () => {
    const late = swap(
      GROUND_FILE,
      'annunciations[1]: stall_heat_ground',
      'annunciations[1]: stall_heat_ground\nlate_annunciations[1]: stall_heat_ground',
    );
    expect(issuesOf(late).map((issue) => issue.message)).toContain(
      '"stall_heat_ground" is listed under annunciations as well; list it under one of them',
    );
  });
});

describe('L11: a run that does nothing must fail', () => {
  it('rejects a blueprint whose applying branch holds no step', () => {
    // 2.5 bar is in the low band: "If too low:" applies and has no nodes, the green branch does not.
    const text = swap(BLUEPRINT, 'oil_pressure_bar: 4.16', 'oil_pressure_bar: 2.5');
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
      quantities: { altitude_ft: 4500, oil_temp_c: 114 },
      parameters: {},
      controls: {},
      message_within_s: 22,
      cues: [],
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

describe('L23 and L24: the declared onset cue (Phase 5, C-01)', () => {
  const SMOKE = readFileSync(`${root}tests/fixtures/scenarios/smoke-onset.toon`, 'utf8');
  const CUES_LINE = '  cues[1]: cabin_smoke';

  it('passes the smoke fixture: the cabin smoke shows a second or so after the onset', () => {
    expect(checkScenario(SMOKE, DA50RG_ENV).ok).toBe(true);
  });

  it('L24: an onset with neither annunciation nor cue is reported at the onset', () => {
    const text = swap(SMOKE, `${CUES_LINE}\n`, '');
    const issues = issuesOf(text);
    expect(issues.map((i) => i.path)).toContain('onset');
    const hit = issues.find((i) => i.path === 'onset');
    expect(hit?.message).toContain('no annunciation and no cue');
    expect(hit?.line).toBe(lineOf(text, 'onset:'));
  });

  it('L24: an annunciation alone satisfies the rule, a cue alone does too', () => {
    expect(checkScenario(BLUEPRINT, DA50RG_ENV).ok).toBe(true);
    expect(checkScenario(SMOKE, DA50RG_ENV).ok).toBe(true);
  });

  it('L23: an unknown cue is reported at its entry, with the known cues', () => {
    const text = swap(SMOKE, CUES_LINE, '  cues[1]: fog');
    const issues = issuesOf(text);
    expect(issues).toEqual([
      {
        path: 'onset.cues.0',
        message: `unknown cue "fog"; known cues: ${DA50RG_ENV.cues.ids.join(', ')}`,
        line: lineOf(text, 'cues[1]: fog'),
        col: expect.any(Number) as number,
      },
    ]);
  });

  it('L23: a cue listed twice is reported at the second entry', () => {
    const text = swap(SMOKE, CUES_LINE, '  cues[2]: cabin_smoke,cabin_smoke');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ path: 'onset.cues.1' });
    expect(issues[0]?.message).toContain('listed twice');
  });

  it('L23: a cue that is visible at the realistic start is reported at the cue', () => {
    // The onset sets the start reading of the smoke, so the cue stands in the cabin from t 0.
    const text = swap(SMOKE, CUES_LINE, `${CUES_LINE}\n  quantities:\n    smoke_density: 50`);
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ path: 'onset.cues.0', line: lineOf(text, CUES_LINE) });
    expect(issues[0]?.message).toContain('already visible at the realistic start');
  });

  it('L23: a cue that never shows in a do-nothing run is reported at the cue', () => {
    // Without the source parameter the cabin stays clear.
    const text = swap(SMOKE, 'parameters:\n  smoke_source: 1\n', '');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ path: 'onset.cues.0', line: lineOf(text, CUES_LINE) });
    expect(issues[0]?.message).toContain('never becomes visible');
  });

  it('L23: a cue that shows later than the bound is reported with the measured seconds', () => {
    // A small source parameter fills the cabin so slowly that the cue (level 0.1) takes longer than 12 s.
    const text = swap(SMOKE, 'smoke_source: 1', 'smoke_source: 0.1');
    const issues = issuesOf(text);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/shows \d+\.\d s after the onset/);
    expect(issues[0]?.message).toContain(`within ${String(REALISTIC_SHOW_WITHIN_MS / 1000)} s`);
  });

  it('L23: the scenario bound message_within_s replaces the default for a cue too', () => {
    const slow = swap(SMOKE, 'smoke_source: 1', 'smoke_source: 0.1');
    const text = swap(slow, CUES_LINE, `${CUES_LINE}\n  message_within_s: 60`);
    expect(checkScenario(text, DA50RG_ENV).ok).toBe(true);
  });

  it('L19: the per-variant start check reports the same, at the variant', () => {
    const ALTN = readFileSync(`${root}scenarios/electrical/elec-altn1-fail.toon`, 'utf8');
    const at = 'onset:\n  window_s[2]: 2,6';
    expect(ALTN.split(at).length - 1).toBe(1);
    const text = ALTN.replace(at, `${at}\n${CUES_LINE}`);
    const issues = issuesOf(text);
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue.path).toMatch(/^variants\.\d+$/);
      expect(issue.message).toContain(
        'the cue "cabin_smoke" is declared but never becomes visible',
      );
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

  it('L16: a mark 1 right after a comment row starts a follow-on checklist and restarts the count', () => {
    // Rows 1 to 3, a title line, then the follow-on list 1, 2 (the booklet prints ICE PROTECTION FAILURE below).
    const follow = swap(
      TABLE,
      '  - kind: line\n    text: Increase airspeed\n    number: 3',
      '  - kind: line\n    text: Increase airspeed\n    number: 3\n  - kind: comment\n    text: A follow-on checklist\n  - kind: line\n    text: Grasp firmly\n    number: 1\n  - kind: line\n    text: Press the button\n    number: 2',
    ).replace('procedure[2]:', 'procedure[5]:');
    expect(checkScenario(follow, DA50RG_ENV).ok).toBe(true);
    // Without the title line the repeat of 1 is still a slip, and the new list still counts in order.
    const bare = swap(follow, '  - kind: comment\n    text: A follow-on checklist\n', '').replace(
      'procedure[5]:',
      'procedure[4]:',
    );
    expect(issuesOf(bare)[0]?.message).toContain('expected 4');
    const gap = swap(
      follow,
      'text: Press the button\n    number: 2',
      'text: Press the button\n    number: 3',
    );
    expect(issuesOf(gap)[0]?.message).toContain('expected 2');
  });

  it('L16: letters run A, B, C as their place in the alphabet, one style per checklist', () => {
    const lettered = swap(
      swap(swap(TABLE, 'number: 1', 'number: A'), 'number: 2', 'number: B'),
      'number: 3',
      'number: C',
    );
    expect(checkScenario(lettered, DA50RG_ENV).ok).toBe(true);

    const gap = swap(lettered, 'number: C', 'number: D');
    const gapIssues = issuesOf(gap);
    expect(gapIssues).toHaveLength(1);
    expect(gapIssues[0]).toMatchObject({
      path: 'procedure.1.number',
      line: lineOf(gap, 'number: D'),
    });
    expect(gapIssues[0]?.message).toContain('expected C');

    const late = issuesOf(swap(lettered, 'number: A', 'number: B'));
    expect(late[0]?.message).toContain('expected A');
  });

  it('L16: a mix of numbers and letters is one issue at the first mismatch', () => {
    const mixed = swap(TABLE, 'number: 2', 'number: B');
    const issues = issuesOf(mixed);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'procedure.0.steps.1.number',
      line: lineOf(mixed, 'number: B'),
    });
    expect(issues[0]?.message).toContain('mixes numbers and letters');
  });

  it('L17: a comment style in the default form is reported at its key as well', () => {
    const text = swap(
      MINIMAL,
      'text: Increase airspeed',
      'text: Increase airspeed\n  - kind: comment\n    style: subheading\n    text: After Standstill',
    ).replace('procedure[2]:', 'procedure[3]:');
    const paths = issuesOf(text).map((issue) => issue.path);
    expect(paths).toContain('procedure.2');
    expect(paths).toContain('procedure.2.style');
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

// Variants (phase 3.1, SCN-09): L12 for onset.controls and L18 to L21, each with one failing case
// made by text replacement of the shipped ALTN 1 FAIL file.
describe('variants: L12, L18 to L21', () => {
  const ALTN = readFileSync(`${root}scenarios/electrical/elec-altn1-fail.toon`, 'utf8');

  /** The shipped file with one exact text replaced; the text must be there exactly once. */
  function edited(from: string, to: string): string {
    expect(ALTN.split(from).length - 1, `"${from}" in the shipped file`).toBe(1);
    return ALTN.replace(from, to);
  }

  /** The shipped file with the first of several equal texts replaced (the variants repeat lines). */
  function editedFirst(from: string, to: string): string {
    expect(ALTN.includes(from), `"${from}" in the shipped file`).toBe(true);
    return ALTN.replace(from, to);
  }

  /** The issues of an edited file whose message contains the text, located at a line and column. */
  function found(text: string, part: string) {
    const hits = issuesOf(text).filter((issue) => issue.message.includes(part));
    expect(
      hits.map((h) => h.message),
      `an issue containing "${part}"`,
    ).not.toEqual([]);
    for (const hit of hits) {
      expect(hit.line).toBeGreaterThan(0);
      expect(hit.col).toBeGreaterThan(0);
    }
    return hits;
  }

  it('passes the shipped file with its variants', () => {
    expect(checkScenario(ALTN, DA50RG_ENV).ok).toBe(true);
  });

  it('L12: onset.controls names a known control in a legal state', () => {
    const at = 'onset:\n  window_s[2]: 2,6';
    found(edited(at, `${at}\n  controls:\n    cb.nothing: out`), 'unknown control "cb.nothing"');
    found(edited(at, `${at}\n  controls:\n    cb.alt1: sideways`), 'is not a state of control');
  });

  it('L18: a variant id is unique', () => {
    found(edited('  - id: breaker_popped\n', '  - id: alternator_dead\n'), 'duplicate variant id');
  });

  it('L18: controls name a known control in a legal state', () => {
    const text = editedFirst('      cb.alt1: out', '      cb.nothing: out');
    const hits = found(text, 'unknown control');
    // The issue sits on the key inside the variant, not at the top of the file.
    expect(lineOf(text, '      cb.nothing: out')).toBe(hits[0]?.line);
    found(
      editedFirst('      cb.alt1: out', '      cb.alt1: sideways'),
      'is not a state of control',
    );
  });

  it('L18: parameters name a known parameter inside its range', () => {
    found(edited('      alt1_output: 1', '      alt1_nothing: 1'), 'unknown parameter');
    found(edited('      alt1_output: 1', '      alt1_output: 7'), 'is outside');
  });

  it('L18: applies names a step or forbidden item, each once', () => {
    found(edited('applies[1]: alt1_breaker_in', 'applies[1]: no_such_step'), 'names no step');
    found(
      editedFirst('applies[2]: alt1_off,ess_bus_on', 'applies[2]: alt1_off,alt1_off'),
      'is listed twice',
    );
  });

  it('L18: a branch decided at the start must not read a control a variant sets', () => {
    const last = '  - kind: comment\n    text: Leave icing conditions.\n';
    const branch = [
      '  - kind: branch',
      '    label: "If open:"',
      '    when:',
      '      check: state',
      '      control: cb.alt1',
      '      is: out',
      '    decided_at: start',
      '',
    ].join('\n');
    const text = edited(last, last + branch).replace('procedure[5]:', 'procedure[6]:');
    found(text, 'which a variant sets');
  });

  it('L19: the start checks run per variant and name it', () => {
    const text = editedFirst(
      '    applies[2]: alt1_off,ess_bus_on',
      '    controls:\n      sw.alternator_1: off\n    applies[2]: alt1_off,ess_bus_on',
    );
    const hits = found(text, 'already satisfied in the initial state');
    expect(hits[0]?.message).toContain('variant "alternator_dead"');
    expect(hits[0]?.path).toBe('variants.0');
  });

  it('L20 and L21: a step that is harmful in another variant breaks the solution and the pairing', () => {
    // Alternator 1 OFF now counts as a harmful, run-failing action in every variant.
    const text = edited(
      '      control: sw.alternator_2\n      is: off',
      '      control: sw.alternator_1\n      is: off',
    );
    const solution = found(text, 'the solution does not pass');
    expect(solution[0]?.message).toContain('variant "alternator_dead"');
    const pairing = found(text, 'makes the forbidden item');
    expect(pairing[0]?.message).toContain('"alt1_off"');
    expect(pairing[0]?.message).toContain('variant "breaker_popped"');
  });

  it('L20: a step with no panel action cannot be solved', () => {
    const text = ALTN.replace(
      /(- id: ess_bus_on[\s\S]*?done:\n)\s+check: state\n\s+control: sw.ess_bus\n\s+is: on\n/,
      '$1          check: quantity\n          quantity: bus_volts\n          op: gte\n          value: 99\n',
    );
    expect(text).not.toBe(ALTN);
    found(text, 'has no panel action');
  });
});

describe('L27 and L28: the further actions (Phase 7, plan 07-02)', () => {
  const FIRE = readFileSync(`${root}scenarios/engine/eng-fire-in-flight.toon`, 'utf8');
  const GROUND = readFileSync(`${root}scenarios/fire/eng-fire-ground.toon`, 'utf8');
  const ALTN = readFileSync(`${root}scenarios/electrical/elec-altn1-fail.toon`, 'utf8');

  /** The shipped text without its own further section (the section is its last block), plus a block. */
  const stripFurther = (text: string): string => text.split(/^(?:# [^\n]*\n)?further:/m)[0] ?? text;
  const withFurther = (text: string, block: string): string => `${stripFurther(text)}${block}`;
  const section = (actions: string, conduct: string): string => {
    const count = actions.split('\n').filter((line) => line.startsWith('    - id:')).length;
    const tail = conduct === 'none' ? '  conduct: none' : `  conduct:\n${conduct}`;
    return `further:\n  actions[${String(count)}]:\n${actions}\n${tail}\n`;
  };
  /** 1-based line of the last line that contains the text (the section is the last block). */
  const lastLineOf = (text: string, needle: string): number =>
    text.split('\n').findLastIndex((line) => line.includes(needle)) + 1;
  const CALL = '    - id: atc_mayday\n      role: required';
  const ACCEPT = '    accept[1]: conduct_emergency';

  /** The issues of an edited file that contain the text, each located at a line and a column. */
  function found(text: string, part: string) {
    const hits = issuesOf(text).filter((issue) => issue.message.includes(part));
    expect(
      hits.map((h) => h.message),
      `an issue containing "${part}"`,
    ).not.toEqual([]);
    for (const hit of hits) {
      expect(hit.line).toBeGreaterThan(0);
      expect(hit.col).toBeGreaterThan(0);
    }
    return hits;
  }

  it('passes the in-flight file with a section and a file without one', () => {
    expect(checkScenario(withFurther(FIRE, section(CALL, ACCEPT)), DA50RG_ENV).ok).toBe(true);
    expect(checkScenario(stripFurther(FIRE), DA50RG_ENV).ok).toBe(true);
  });

  it('passes a ground file that declares conduct none', () => {
    expect(checkScenario(withFurther(GROUND, section(CALL, 'none')), DA50RG_ENV).ok).toBe(true);
  });

  it('the schema needs the conduct inside the section', () => {
    const text = `${stripFurther(FIRE)}further:\n  actions[1]:\n${CALL}\n`;
    expect(checkScenario(text, DA50RG_ENV).ok).toBe(false);
  });

  it('L27: rejects an unknown action id at its key, naming the known actions', () => {
    const text = withFurther(FIRE, section('    - id: atc_flare\n      role: required', ACCEPT));
    const [hit] = found(text, 'unknown further action "atc_flare"');
    expect(hit?.path).toBe('further.actions.0.id');
    expect(hit?.message).toContain(DA50RG_ENV.further.ids('action').join(', '));
    expect(hit?.line).toBe(lastLineOf(text, 'id: atc_flare'));
  });

  it('L27: rejects a repeated action id at the second entry', () => {
    const text = withFurther(
      FIRE,
      section(`${CALL}\n    - id: atc_mayday\n      role: optional`, ACCEPT),
    );
    const [hit] = found(text, 'the further action "atc_mayday" is listed twice');
    expect(hit?.path).toBe('further.actions.1.id');
  });

  it('L27: rejects a conduct id used as an action', () => {
    const text = withFurther(
      FIRE,
      section('    - id: conduct_continue\n      role: optional', ACCEPT),
    );
    const [hit] = found(text, 'is a flight conduct, not an action');
    expect(hit?.path).toBe('further.actions.0.id');
  });

  it('L27: rejects fails_run on a role other than harmful, and takes it on harmful', () => {
    const bad = withFurther(
      FIRE,
      section('    - id: atc_mayday\n      role: required\n      fails_run: true', ACCEPT),
    );
    const [hit] = found(bad, 'fails_run is only for the role harmful');
    expect(hit?.path).toBe('further.actions.0.fails_run');
    expect(hit?.line).toBe(lastLineOf(bad, 'fails_run: true'));
    const good = withFurther(
      FIRE,
      section('    - id: atc_pan_pan\n      role: harmful\n      fails_run: true', ACCEPT),
    );
    expect(checkScenario(good, DA50RG_ENV).ok).toBe(true);
  });

  it('L27: an unrated action (brief passengers) is never required or harmful, WR-02', () => {
    const unrated = DA50RG_ENV.further.ids('action').filter((id) => {
      return DA50RG_ENV.further.option(id)?.unrated === true;
    });
    expect(unrated.length).toBeGreaterThan(0);
    for (const id of unrated) {
      for (const role of ['required', 'harmful']) {
        const text = withFurther(FIRE, section(`    - id: ${id}\n      role: ${role}`, ACCEPT));
        const [hit] = found(text, 'is never graded');
        expect(hit?.path).toBe('further.actions.0.role');
        expect(hit?.line).toBe(lastLineOf(text, `role: ${role}`));
      }
      for (const role of ['recommended', 'optional']) {
        const text = withFurther(FIRE, section(`    - id: ${id}\n      role: ${role}`, ACCEPT));
        expect(checkScenario(text, DA50RG_ENV).ok).toBe(true);
      }
    }
  });

  it('L28: a scenario in flight must not declare none', () => {
    const text = withFurther(FIRE, section(CALL, 'none'));
    const [hit] = found(text, 'a scenario in flight must declare conduct: accept');
    expect(hit?.path).toBe('further.conduct');
    expect(hit?.line).toBe(lastLineOf(text, 'conduct: none'));
  });

  it('L28: a ground scenario must not declare accept', () => {
    const text = withFurther(GROUND, section(CALL, ACCEPT));
    const [hit] = found(
      text,
      'ground scenario: declare conduct: none, no flight conduct decision is offered on the ground',
    );
    expect(hit?.path).toBe('further.conduct');
  });

  it('L28: the ground test reads the profile value above 0 of the aircraft ground parameter', () => {
    const parameter = DA50RG_ENV.further.groundParameter;
    expect(GROUND).toContain(`  ${parameter}: 1`);
    // The same ground file with the roll at 0 is a scenario in flight: none is wrong there.
    const flying = swap(GROUND, `  ${parameter}: 1`, `  ${parameter}: 0`);
    const text = withFurther(flying, section(CALL, 'none'));
    const hits = issuesOf(text).filter((issue) => issue.path === 'further.conduct');
    expect(hits.map((h) => h.message)).toEqual([
      'a scenario in flight must declare conduct: accept, the flight conduct is part of the decision',
    ]);
  });

  it('L28: rejects an unknown, an action and a repeated accept id, each at its place', () => {
    const unknown = withFurther(FIRE, section(CALL, '    accept[1]: conduct_hover'));
    expect(found(unknown, 'unknown flight conduct "conduct_hover"')[0]?.path).toBe(
      'further.conduct.accept.0',
    );
    const action = withFurther(FIRE, section(CALL, '    accept[1]: atc_mayday'));
    expect(found(action, 'is an action, not a flight conduct')[0]?.path).toBe(
      'further.conduct.accept.0',
    );
    const repeated = withFurther(
      FIRE,
      section(CALL, '    accept[2]: conduct_emergency,conduct_emergency'),
    );
    expect(found(repeated, 'the flight conduct "conduct_emergency" is listed twice')[0]?.path).toBe(
      'further.conduct.accept.1',
    );
  });

  it('L28: rejects an accept that lists every conduct option', () => {
    const all = DA50RG_ENV.further.ids('conduct');
    const text = withFurther(
      FIRE,
      section(CALL, `    accept[${String(all.length)}]: ${all.join(',')}`),
    );
    const [hit] = found(text, 'accept must not list every flight conduct option');
    expect(hit?.path).toBe('further.conduct.accept');
  });

  it('L20: the solution of a variant file carries the required decisions and the first accept', () => {
    const block = section(
      `${CALL}\n    - id: brief_passengers\n      role: recommended`,
      '    accept[2]: conduct_precautionary,conduct_continue',
    );
    const text = withFurther(ALTN, block);
    // Without the decisions in the built solution this would read "the solution does not pass".
    expect(checkScenario(text, DA50RG_ENV).ok).toBe(true);
    const scenario = parsedOf(text);
    const nothing = grade(scenario, DA50RG_ENV, {
      scenarioId: scenario.id,
      completedAt: 20000,
      events: [],
    });
    expect(nothing.reasons.map((r) => r.kind)).toEqual([
      'critical_missed',
      'further_missed',
      'conduct',
    ]);
  });
});
