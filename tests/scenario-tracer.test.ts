import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { branchStatuses, grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { baselineOf, evaluatePredicate, initialQuantities } from '../src/engine/predicates';
import type { PredicateContext } from '../src/engine/predicates';
import { defineQuantities, QuantityError } from '../src/engine/quantities';
import { DISCLAIMER_IDS, DISCLAIMERS } from '../src/scenario/disclaimers';
import { lintScenario } from '../src/scenario/lint';
import { MAX_TEXT_LENGTH, parseManifest, parseScenario } from '../src/scenario/parse';
import { createPackProvider, OPEN_ACCESS, openScenario } from '../src/scenario/packs';
import type { AccessPolicy } from '../src/scenario/packs';
import { VITE_PACKS } from '../src/scenario/packs-vite';
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

  it('has one forbidden item that fails the run', () => {
    expect(scenario.forbidden).toHaveLength(1);
    expect(scenario.forbidden[0]?.id).toBe('power_increased');
    expect(scenario.forbidden[0]?.fails_run).toBe(true);
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
      text: swap(
        'quantity: oil_temp_c\n              in[3]',
        'quantity: oil_nope\n              in[3]',
      ),
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

  it('returns an issue for a 21-word step text (the checklist cap is 20 words)', () => {
    const words = Array.from({ length: 21 }, (_, i) => `w${String(i)}`).join(' ');
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
    expect(result.issues[0]).toMatchObject({ line: 1, col: 1 });
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

  it('offers the base values', () => {
    const derived = Object.fromEntries(DA50RG_QUANTITIES.all.map((d) => [d.id, d.base]));
    expect(DA50RG_QUANTITIES.baseValues()).toEqual(derived);
  });

  it('rejects a band list with a gap or a wrong end', () => {
    const base = { id: 'q', unit: 'u', min: 0, max: 10, base: 0 } as const;
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

  it('rejects a duplicate id and a base value outside the range', () => {
    const def = {
      id: 'q',
      unit: 'u',
      min: 0,
      max: 10,
      base: 0,
      bands: [{ id: 'a', colour: 'green', to: 10 }],
    } as const;
    expect(() => defineQuantities([def, def])).toThrow(QuantityError);
    expect(() => defineQuantities([{ ...def, base: 11 }])).toThrow(QuantityError);
    expect(() => defineQuantities([{ ...def, base: -1 }])).toThrow(/base/);
  });

  it('accepts a none band for an unmarked range and rejects a scale that is not a positive integer', () => {
    const def = {
      id: 'q',
      unit: 'u',
      min: 0,
      max: 10,
      base: 5,
      bands: [
        { id: 'a', colour: 'green', to: 6 },
        { id: 'unmarked', colour: 'none', to: 10 },
      ],
    } as const;
    const set = defineQuantities([def]);
    expect(set.bandOf('q', 8)).toBe('unmarked');
    expect(set.get('q')?.bands[1]?.colour).toBe('none');
    expect(defineQuantities([{ ...def, scale: 1000 }]).get('q')?.scale).toBe(1000);
    for (const scale of [0, -10, 1.5, Number.NaN]) {
      expect(() => defineQuantities([{ ...def, scale }]), String(scale)).toThrow(QuantityError);
    }
  });

  it('is part of the DA50 RG environment next to the registry', () => {
    expect(DA50RG_ENV.quantities).toBe(DA50RG_QUANTITIES);
    expect(DA50RG_ENV.registry.get('lv.power')?.kind).toBe('detent-lever');
  });
});

// Tracer of plan 02 (D-20, PLT-03, D-09, D-10, D-13): the blueprint is listed and opened only
// through the pack seam and graded PASS or FAIL by a pure function of the recorded log.
describe('the pack seam', () => {
  const REF = { pack: 'engine', scenario: 'eng-oil-temp-green' } as const;
  const MANIFEST = readFileSync(join(root, 'scenarios/engine/pack.toon'), 'utf8');

  /** A provider over fake modules; `calls` counts every loader call. */
  function fake(files: Record<string, string | Error>) {
    const calls = { count: 0 };
    const loaders: Record<string, () => Promise<string>> = {};
    for (const [name, text] of Object.entries(files)) {
      loaders[`/scenarios/engine/${name}.toon`] = () => {
        calls.count += 1;
        return text instanceof Error ? Promise.reject(text) : Promise.resolve(text);
      };
    }
    const provider = createPackProvider({
      manifests: { '/scenarios/engine/pack.toon': MANIFEST },
      loaders,
    });
    return { provider, calls };
  }

  it('lists the engine pack from its manifest', async () => {
    const packs = await VITE_PACKS.listPacks();
    expect(packs).toEqual([
      {
        id: 'engine',
        title: 'Engine',
        free: true,
        scenarios: [
          { id: 'eng-oil-temp-green', title: 'ENG OIL TEMP', file: 'eng-oil-temp-green' },
          { id: 'eng-fire-in-flight', title: 'ENGINE FIRE', file: 'eng-fire-in-flight' },
        ],
      },
    ]);
  });

  it('lists packs without calling a scenario loader', async () => {
    const { provider, calls } = fake({ 'eng-oil-temp-green': BLUEPRINT });
    expect(await provider.listPacks()).toHaveLength(1);
    expect(calls.count).toBe(0);
  });

  it('opens the blueprint through the real provider and the open policy', async () => {
    const result = await openScenario(
      { provider: VITE_PACKS, policy: OPEN_ACCESS },
      DA50RG_ENV,
      REF,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scenario.title).toBe('ENG OIL TEMP');
    expect(result.scenario.initial.controls['lv.power']).toBe('p75');
  });

  it('denies a pack the policy refuses and calls no loader', async () => {
    const { provider, calls } = fake({ 'eng-oil-temp-green': BLUEPRINT });
    const policy: AccessPolicy = { canAccess: () => false };
    const result = await openScenario({ provider, policy }, DA50RG_ENV, REF);
    expect(result).toMatchObject({ ok: false, reason: 'denied' });
    expect(calls.count).toBe(0);
  });

  it('denies when the policy throws', async () => {
    const { provider, calls } = fake({ 'eng-oil-temp-green': BLUEPRINT });
    const policy: AccessPolicy = {
      canAccess: () => Promise.reject(new Error('offline')),
    };
    const result = await openScenario({ provider, policy }, DA50RG_ENV, REF);
    expect(result).toMatchObject({ ok: false, reason: 'denied' });
    expect(calls.count).toBe(0);
  });

  it('reports an unknown scenario id or pack as missing', async () => {
    const { provider } = fake({ 'eng-oil-temp-green': BLUEPRINT });
    const source = { provider, policy: OPEN_ACCESS };
    expect(
      await openScenario(source, DA50RG_ENV, { pack: 'engine', scenario: 'nope' }),
    ).toMatchObject({
      ok: false,
      reason: 'missing',
    });
    expect(await openScenario(source, DA50RG_ENV, { pack: 'nope', scenario: 'x' })).toMatchObject({
      ok: false,
      reason: 'missing',
    });
  });

  it('reports a manifest entry without a file as missing', async () => {
    const { provider } = fake({ other: BLUEPRINT });
    const result = await openScenario({ provider, policy: OPEN_ACCESS }, DA50RG_ENV, REF);
    expect(result).toMatchObject({ ok: false, reason: 'missing' });
  });

  it('reports a rejecting loader as load-failed instead of throwing', async () => {
    const { provider } = fake({ 'eng-oil-temp-green': new Error('chunk 404') });
    const result = await openScenario({ provider, policy: OPEN_ACCESS }, DA50RG_ENV, REF);
    expect(result).toMatchObject({ ok: false, reason: 'load-failed' });
    if (result.ok) return;
    expect(result.issues[0]?.message).toBe('chunk 404');
  });

  it('reports a file that fails lint as invalid with its issues', async () => {
    const { provider } = fake({
      'eng-oil-temp-green': swap('control: lv.cowl_flap', 'control: lv.nope'),
    });
    const result = await openScenario({ provider, policy: OPEN_ACCESS }, DA50RG_ENV, REF);
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
    if (result.ok) return;
    expect(result.issues.map((i) => i.path)).toEqual([
      'procedure.0.branches.1.nodes.0.steps.1.done.control',
    ]);
  });

  it('reports a file that does not parse, or has another id than its entry, as invalid', async () => {
    const broken = fake({ 'eng-oil-temp-green': 'format: 1\nbogus: [' });
    expect(
      await openScenario({ provider: broken.provider, policy: OPEN_ACCESS }, DA50RG_ENV, REF),
    ).toMatchObject({ ok: false, reason: 'invalid' });
    const renamed = fake({ 'eng-oil-temp-green': swap('id: eng-oil-temp-green', 'id: other-id') });
    expect(
      await openScenario({ provider: renamed.provider, policy: OPEN_ACCESS }, DA50RG_ENV, REF),
    ).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('throws an error naming the path for an invalid manifest', async () => {
    const provider = createPackProvider({
      manifests: { '/scenarios/engine/pack.toon': 'format: 1\nbogus: 1' },
      loaders: {},
    });
    await expect(provider.listPacks()).rejects.toThrow('/scenarios/engine/pack.toon');
  });
});

describe('grading the blueprint', () => {
  const scenario = parsed(BLUEPRINT);
  const recording = (events: Recording['events']): Recording => ({
    scenarioId: scenario.id,
    completedAt: 20000,
    events,
  });

  it('grades the golden events pass with both steps credited', () => {
    const result = grade(
      scenario,
      DA50RG_ENV,
      recording([
        { t: 8000, id: 'lv.power', value: 'p60' },
        { t: 15000, id: 'lv.cowl_flap', value: 'open' },
      ]),
    );
    expect(result.result).toBe('pass');
    expect(result.reasons).toEqual([]);
    expect(result.steps.map((s) => [s.id, s.credited, s.enteredAt])).toEqual([
      ['reduce_power', true, 0],
      ['open_cowl_flap', true, 1],
    ]);
  });

  it('grades an empty recording fail with both critical steps missed', () => {
    const result = grade(scenario, DA50RG_ENV, recording([]));
    expect(result.result).toBe('fail');
    expect(result.reasons).toEqual([{ kind: 'critical_missed', count: 2 }]);
  });

  it('takes the branch statuses from the engine', () => {
    const expected = [
      { path: 'procedure.0.branches.0', status: 'not_applicable' },
      { path: 'procedure.0.branches.1', status: 'applies' },
      { path: 'procedure.0.branches.1.nodes.3', status: 'open' },
    ];
    expect(branchStatuses(scenario, DA50RG_ENV)).toEqual(expected);
    expect(grade(scenario, DA50RG_ENV, recording([])).branches).toEqual(expected);
  });

  it('refuses a recording of another scenario', () => {
    expect(() => grade(scenario, DA50RG_ENV, { ...recording([]), scenarioId: 'other' })).toThrow(
      Error,
    );
  });
});

describe('evaluatePredicate', () => {
  const scenario = parsed(BLUEPRINT);
  const baseline = baselineOf(scenario, DA50RG_ENV.registry);
  const quantities = initialQuantities(scenario, DA50RG_QUANTITIES);
  const at = (power: string): PredicateContext => ({
    controls: { ...baseline, 'lv.power': power },
    baseline,
    quantities,
  });
  const reduced = {
    check: 'travel_rel',
    control: 'lv.power',
    op: 'lte',
    delta: -10,
  } as const;

  it('reads travel_rel relative to the baseline', () => {
    expect(baseline['lv.power']).toBe('p75');
    expect(evaluatePredicate(reduced, at('p65'), DA50RG_ENV)).toBe(true);
    expect(evaluatePredicate(reduced, at('p70'), DA50RG_ENV)).toBe(false);
  });
});
