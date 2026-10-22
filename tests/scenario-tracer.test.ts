import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { defineQuantities, QuantityError } from '../src/engine/quantities';
import { DISCLAIMER_IDS, DISCLAIMERS } from '../src/scenario/disclaimers';
import { lintScenario } from '../src/scenario/lint';
import { MAX_TEXT_LENGTH, parseManifest, parseScenario } from '../src/scenario/parse';
import type { Scenario } from '../src/scenario/schema';

// Tracer of phase 02 (SCN-01, SCN-03, SCN-07): the real blueprint file is decoded with the
// pinned TOON parser, validated by the format-1 schema and resolved against the DA50 RG registry
// and quantity data. Faulty copies are built by replacing one place of the real text.
const root = fileURLToPath(new URL('../', import.meta.url));
const BLUEPRINT = readFileSync(join(root, 'scenarios/engine/eng-oil-temp-green.toon'), 'utf8');

/** The blueprint with one place replaced; the place must exist exactly once. */
function swap(from: string, to: string): string {
  expect(BLUEPRINT.split(from).length - 1, `"${from}" occurs once in the blueprint`).toBe(1);
  return BLUEPRINT.replace(from, () => to);
}

function parsed(text: string): Scenario {
  const result = parseScenario(text);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

describe('the blueprint scenario', () => {
  const scenario = parsed(BLUEPRINT);

  it('decodes and validates with its metadata', () => {
    expect(scenario.id).toBe('eng-oil-temp-green');
    expect(scenario.title).toBe('ENG OIL TEMP');
    expect(scenario.source.section).toBe('AFM 03-08 ENG OIL TEMP');
    expect(scenario.source.issue).toBe('018');
    expect(scenario.disclaimer).toBe('training-aid');
    expect(scenario.annunciations).toEqual(['eng_oil_temp']);
  });

  it('sets the initial controls and quantities', () => {
    expect(scenario.initial.controls).toEqual({ 'lv.power': 'p75', 'lv.cowl_flap': 'closed' });
    expect(scenario.initial.quantities).toEqual({ oil_temp_c: 128, oil_pressure_bar: 5 });
  });

  it('holds the procedure tree of the checklist', () => {
    expect(scenario.procedure).toHaveLength(1);
    const decision = scenario.procedure[0];
    if (decision?.kind !== 'decision') throw new Error('expected a decision');
    expect(decision.text).toBe('Check oil pressure');
    expect(decision.branches.map((b) => b.label)).toEqual(['If too low:', 'If in green range:']);
    const [low, green] = decision.branches;
    expect(low?.nodes).toEqual([]);
    expect(low?.decided_at).toBe('start');
    const nodes = green?.nodes ?? [];
    expect(nodes.map((n) => n.kind)).toEqual(['group', 'line', 'line', 'branch']);
    const group = nodes[0];
    if (group?.kind !== 'group') throw new Error('expected a group');
    expect(group.ordered).toBe(false);
    expect(group.order_critical).toBe(false);
    expect(group.steps.map((s) => [s.id, s.severity])).toEqual([
      ['reduce_power', 'critical'],
      ['open_cowl_flap', 'critical'],
    ]);
    expect(group.steps[0]?.done).toEqual({
      check: 'travel_rel',
      control: 'lv.power',
      op: 'lte',
      delta: -10,
    });
    const retry = nodes[3];
    if (retry?.kind !== 'branch') throw new Error('expected a branch');
    expect(retry.decided_at).toBe('run');
    expect(retry.nodes.map((n) => n.kind)).toEqual(['line']);
  });

  it('has one forbidden item that does not fail the run', () => {
    expect(scenario.forbidden).toHaveLength(1);
    expect(scenario.forbidden[0]?.id).toBe('power_increased');
    expect(scenario.forbidden[0]?.fails_run).toBe(false);
  });

  it('resolves against the DA50 RG registry and quantities without an issue', () => {
    expect(lintScenario(scenario, DA50RG_ENV)).toEqual([]);
  });

  it('keeps every text within the limits that the layout relies on', () => {
    expect(scenario.title.length).toBeLessThanOrEqual(18);
    expect(DISCLAIMER_IDS).toContain(scenario.disclaimer);
    expect(DISCLAIMERS[scenario.disclaimer].version).toBe(1);
  });
});

describe('lintScenario on faulty copies', () => {
  const steps1 = 'procedure.0.branches.1.nodes.0.steps.1.done';
  const retry = 'procedure.0.branches.1.nodes.3';
  const cases: readonly { name: string; text: string; path: string }[] = [
    {
      name: 'an unknown control',
      text: swap('control: lv.cowl_flap', 'control: lv.nope'),
      path: `${steps1}.control`,
    },
    {
      name: 'an illegal state',
      text: swap('is: open', 'is: ajar'),
      path: `${steps1}.is`,
    },
    {
      name: 'a travel check on a control that is not a detent lever',
      text: swap(
        'check: state\n                  control: lv.cowl_flap\n                  is: open',
        'check: travel\n                  control: sw.fadec\n                  op: gte\n                  value: 10',
      ),
      path: `${steps1}.control`,
    },
    {
      name: 'an unknown quantity',
      text: swap('quantity: oil_temp_c', 'quantity: oil_nope'),
      path: `${retry}.when.quantity`,
    },
    {
      name: 'an unknown band',
      text: swap('in[3]: low_yellow,high_yellow,high_red', 'in[3]: low_yellow,high_yellow,purple'),
      path: `${retry}.when.in.2`,
    },
    {
      name: 'an initial quantity outside min..max',
      text: swap('oil_temp_c: 128', 'oil_temp_c: 500'),
      path: 'initial.quantities.oil_temp_c',
    },
    {
      name: 'an initial control in an illegal state',
      text: swap('lv.cowl_flap: closed', 'lv.cowl_flap: ajar'),
      path: 'initial.controls.lv.cowl_flap',
    },
    {
      name: 'a prototype key as an initial control',
      text: swap('lv.cowl_flap: closed', 'constructor: closed'),
      path: 'initial.controls.constructor',
    },
  ];

  it.each(cases)('returns exactly one issue for $name', ({ text, path }) => {
    const issues = lintScenario(parsed(text), DA50RG_ENV);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe(path);
  });
});

describe('parseScenario on author errors', () => {
  it('returns issues for a misspelled key, with the key in the path', () => {
    const result = parseScenario(swap('ordered: false', 'ordred: false'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.path.endsWith('.ordred'))).toBe(true);
  });

  it('returns an issue for a 13-word step text', () => {
    const words = Array.from({ length: 13 }, (_, i) => `w${String(i)}`).join(' ');
    const result = parseScenario(swap('text: Reduce power', `text: ${words}`));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.path).toBe('procedure.0.branches.1.nodes.0.steps.0.text');
  });

  it('returns an issue with a line for an array count that does not match', () => {
    const result = parseScenario(
      swap('annunciations[1]: eng_oil_temp', 'annunciations[2]: eng_oil_temp'),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.line).toBeGreaterThan(0);
    expect(result.issues[0]?.message).not.toMatch(/^Line \d+/);
  });

  it('returns one issue without decoding for a text over the limit', () => {
    const result = parseScenario('x'.repeat(MAX_TEXT_LENGTH + 1));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.line).toBeUndefined();
  });

  it('rejects a branch label without a colon and a title over 18 characters', () => {
    expect(parseScenario(swap('"If too low:"', '"If too low"')).ok).toBe(false);
    expect(parseScenario(swap('title: ENG OIL TEMP', 'title: ENG OIL TEMP IS TOO HIGH')).ok).toBe(
      false,
    );
  });

  it('rejects an empty source field and an unknown disclaimer', () => {
    expect(parseScenario(swap('section: AFM 03-08 ENG OIL TEMP', 'section: "  "')).ok).toBe(false);
    expect(parseScenario(swap('disclaimer: training-aid', 'disclaimer: other')).ok).toBe(false);
  });
});

describe('parseManifest', () => {
  const manifest = [
    'format: 1',
    'title: Engine',
    'free: true',
    'scenarios[1]:',
    '  - id: eng-oil-temp-green',
    '    title: ENG OIL TEMP',
    '    file: eng-oil-temp-green',
  ].join('\n');

  it('accepts a pack manifest', () => {
    const result = parseManifest(manifest);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.scenarios.map((s) => s.file)).toEqual(['eng-oil-temp-green']);
  });

  it('rejects an unknown key', () => {
    const result = parseManifest(`${manifest}\ncount: 1`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.path).toBe('count');
  });
});

describe('quantities', () => {
  it('puts a value on a bound into the lower band', () => {
    expect(DA50RG_QUANTITIES.bandOf('oil_temp_c', 125)).toBe('high_yellow');
    expect(DA50RG_QUANTITIES.bandOf('oil_temp_c', 128)).toBe('high_red');
    expect(DA50RG_QUANTITIES.bandOf('oil_temp_c', 115)).toBe('green');
    expect(DA50RG_QUANTITIES.bandOf('oil_pressure_bar', 5)).toBe('green');
  });

  it('clamps a value below min to the first band and above max to the last', () => {
    expect(DA50RG_QUANTITIES.bandOf('oil_temp_c', -100)).toBe('low_yellow');
    expect(DA50RG_QUANTITIES.bandOf('oil_temp_c', 500)).toBe('high_red');
  });

  it('offers the idle values', () => {
    expect(DA50RG_QUANTITIES.idleValues()).toEqual({ oil_temp_c: 15, oil_pressure_bar: 0 });
  });

  it('rejects a band list with a gap or a wrong end', () => {
    const base = { id: 'q', unit: 'u', min: 0, max: 10, idle: 0 } as const;
    expect(() =>
      defineQuantities([{ ...base, bands: [{ id: 'a', colour: 'green', to: 6 }] }]),
    ).toThrow(QuantityError);
    expect(() =>
      defineQuantities([
        {
          ...base,
          bands: [
            { id: 'a', colour: 'green', to: 6 },
            { id: 'b', colour: 'red', to: 5 },
            { id: 'c', colour: 'red', to: 10 },
          ],
        },
      ]),
    ).toThrow(QuantityError);
  });

  it('rejects a duplicate id and an idle value outside the range', () => {
    const def = {
      id: 'q',
      unit: 'u',
      min: 0,
      max: 10,
      idle: 0,
      bands: [{ id: 'a', colour: 'green', to: 10 }],
    } as const;
    expect(() => defineQuantities([def, def])).toThrow(QuantityError);
    expect(() => defineQuantities([{ ...def, idle: 11 }])).toThrow(QuantityError);
  });

  it('is part of the DA50 RG environment next to the registry', () => {
    expect(DA50RG_ENV.quantities).toBe(DA50RG_QUANTITIES);
    expect(DA50RG_ENV.registry.get('lv.power')?.kind).toBe('detent-lever');
  });
});
