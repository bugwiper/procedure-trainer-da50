import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { DA50RG_INDICATORS } from '../src/aircraft/da50rg/indicators';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { initialQuantities } from '../src/engine/predicates';
import { simSetup, simulate } from '../src/engine/sim';
import { checkScenario } from '../src/scenario/lint';
import { createPackProvider, OPEN_ACCESS } from '../src/scenario/packs';
import { parseScenario } from '../src/scenario/parse';
import { createPanelBridge } from '../src/ui/bridge';
import { createSession } from '../src/ui/session';

// The confirm step (Phase 9, plan 09-05, R-10, P-03): a step key `confirm: true` for a row that must
// already hold in the initial state and says "keep it so". Grading is untouched (rules 5 and 6 enter a
// step that holds at the start at the start); only authoring changes: lint L5 does not report it, L35
// reports a confirm step that is false at the start and one in a scenario with an onset, and L11 does
// not count it, so a run that does nothing still fails. The shipped use is row 11 of the engine-off
// landing. Hand-written cases over the synthetic fixture of tests/fixtures/scenarios/ and the file.

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path: string): string => readFileSync(`${root}${path}`, 'utf8');
const FIXTURE = read('tests/fixtures/scenarios/landing-fixture.toon');

/**
 * The landing fixture with one more group holding the step `pump_off` on the FUEL TRANS knob, the
 * key written as given (`confirm`: a line like `confirm: true`, or none) and the state the step wants.
 */
function withPump(confirm: string | null, is: 'off' | 'on' = 'off', severity = 'standard'): string {
  const group = `  - kind: group
    id: grp_pump
    ordered: false
    steps[1]:
      - id: pump_off
        severity: ${severity}
${confirm === null ? '' : `        ${confirm}\n`}        text: Pump off
        done:
          check: state
          control: sw.fuel_trans
          is: "${is}"
`;
  return FIXTURE.replace('procedure[1]:', 'procedure[2]:').replace(
    'forbidden[0]:',
    `${group}forbidden[0]:`,
  );
}

const messages = (text: string): string[] => {
  const checked = checkScenario(text, DA50RG_ENV);
  return checked.ok ? [] : checked.issues.map((issue) => issue.message);
};

describe('the schema', () => {
  it('accepts confirm: true and a step without the key', () => {
    expect(parseScenario(withPump('confirm: true')).ok).toBe(true);
    expect(parseScenario(withPump(null)).ok).toBe(true);
  });

  it('rejects false and any other value, and names the key', () => {
    for (const value of ['confirm: false', 'confirm: "true"', 'confirm: 1', 'confirm: yes']) {
      const parsed = parseScenario(withPump(value));
      expect(parsed.ok, value).toBe(false);
    }
  });
});

describe('lint (L5, L11, L35)', () => {
  it('a confirm step that holds is clean; the same step without the key is L5', () => {
    expect(messages(withPump('confirm: true'))).toEqual([]);
    const plain = messages(withPump(null));
    expect(plain.some((m) => m.includes('already satisfied in the initial state'))).toBe(true);
    expect(plain.some((m) => m.includes('"pump_off"'))).toBe(true);
  });

  it('L35: a confirm step that is false at the start is reported at its confirm key', () => {
    const text = withPump('confirm: true', 'on');
    const checked = checkScenario(text, DA50RG_ENV);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    const found = checked.issues.filter((issue) => issue.message.includes('confirm step'));
    expect(found).toHaveLength(1);
    expect(found[0]?.path).toContain('confirm');
    expect(text.split('\n')[(found[0]?.line ?? 0) - 1]?.trim()).toBe('confirm: true');
    // It is not also reported as L5: the step does not hold.
    expect(messages(text).some((m) => m.includes('already satisfied'))).toBe(false);
  });

  it('L35: a confirm step in a scenario with an onset is reported', () => {
    const oil = read('scenarios/engine/eng-oil-temp-green.toon');
    expect(oil).toContain('onset:');
    const group = `  - kind: group
    id: grp_pump
    ordered: false
    steps[1]:
      - id: pump_off
        severity: standard
        confirm: true
        text: Pump off
        done:
          check: state
          control: sw.fuel_trans
          is: "off"
`;
    const count = /procedure\[(\d+)\]:/.exec(oil);
    expect(count).not.toBeNull();
    const edited = oil
      .replace(/procedure\[(\d+)\]:/, (_all, n: string) => `procedure[${String(Number(n) + 1)}]:`)
      .replace(/\nforbidden\[/, `\n${group.trimEnd()}\nforbidden[`);
    const found = messages(edited).filter((m) => m.includes('onset'));
    expect(found.some((m) => m.includes('confirm step') && m.includes('"pump_off"'))).toBe(true);
    // The unedited file has no such issue.
    expect(messages(oil)).toEqual([]);
  });

  it('L11: a confirm step is not counted, so a file whose only critical step is a confirm step still fails', () => {
    // Replace the fixture's own critical step by a critical confirm step that holds.
    const only = FIXTURE.replace(
      `      - id: elect_master_off
        severity: critical
        text: Electric master off
        done:
          check: state
          control: sw.elect_master
          is: off`,
      `      - id: pump_off
        severity: critical
        confirm: true
        text: Pump off
        done:
          check: state
          control: sw.fuel_trans
          is: "off"`,
    );
    expect(only).not.toBe(FIXTURE);
    expect(messages(only).some((m) => m.includes('no critical step is graded at the start'))).toBe(
      true,
    );
    // A real critical step beside it satisfies L11 again.
    expect(messages(withPump('confirm: true'))).toEqual([]);
  });
});

describe('grade: the semantics are those of a step that holds at the start', () => {
  const scenario = (() => {
    const parsed = parseScenario(withPump('confirm: true'));
    if (!parsed.ok) throw new Error('the fixture does not parse');
    return parsed.value;
  })();
  const recording = (events: Recording['events']): Recording => ({
    scenarioId: scenario.id,
    completedAt: 10_000,
    events,
  });
  const row = (events: Recording['events']) =>
    grade(scenario, DA50RG_ENV, recording(events)).steps.find((s) => s.id === 'pump_off');
  const master = { t: 1000, id: 'sw.elect_master', value: 'off' };

  it('is credited at the start with enteredAt -1 and no event', () => {
    expect(row([])).toMatchObject({ credited: true, enteredAt: -1, severity: 'standard' });
  });

  it('is uncredited after the pilot switches the pump on and leaves it, credited again when restored', () => {
    const on = { t: 2000, id: 'sw.fuel_trans', value: 'on' };
    const off = { t: 3000, id: 'sw.fuel_trans', value: 'off' };
    expect(row([master, on])?.credited).toBe(false);
    expect(row([master, on, off])).toMatchObject({ credited: true, enteredAt: 2 });
  });

  it('a standard confirm step never changes the verdict', () => {
    const on = { t: 2000, id: 'sw.fuel_trans', value: 'on' };
    const kept = grade(scenario, DA50RG_ENV, recording([master]));
    const spoiled = grade(scenario, DA50RG_ENV, recording([master, on]));
    expect(kept.result).toBe('pass');
    expect(spoiled.result).toBe('pass');
    expect(spoiled.reasons).toEqual(kept.reasons);
    // And a do-nothing run fails through the real critical step.
    expect(grade(scenario, DA50RG_ENV, recording([])).result).toBe('fail');
  });
});

describe('the live sheet marks a confirm step Done from the first frame', () => {
  it('shows it credited before any event, uncredited when the pump is switched on', async () => {
    const manifest = `format: 1
title: Engine
free: true
scenarios[1]:
  - id: landing-fixture
    title: LANDING FIXTURE
    file: landing-fixture
`;
    const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS, DA50RG_ENV);
    const session = createSession({
      bridge,
      packs: {
        provider: createPackProvider({
          manifests: { '/scenarios/engine/pack.toon': manifest },
          loaders: {
            '/scenarios/engine/landing-fixture.toon': () =>
              Promise.resolve(withPump('confirm: true')),
          },
        }),
        policy: OPEN_ACCESS,
      },
      env: DA50RG_ENV,
      rng: () => 0,
      onRunStart: () => undefined,
    });
    await session.newSituation();
    session.setLevel('easy');
    session.startRun();
    expect(session.screen.value).toBe('running');
    session.toggleChecklist();
    const pump = () => session.checklistMarks.value?.steps.find((s) => s.id === 'pump_off');
    expect(pump()).toMatchObject({ credited: true, enteredAt: -1 });
    bridge.actuate('sw.fuel_trans', 'on');
    expect(pump()?.credited).toBe(false);
    bridge.actuate('sw.fuel_trans', 'off');
    expect(pump()?.credited).toBe(true);
  });
});

describe('the shipped engine-off landing starts with the transfer pump off (R-10, R-11)', () => {
  const checked = checkScenario(read('scenarios/landing/landing-engine-off.toon'), DA50RG_ENV);
  if (!checked.ok) throw new Error('the shipped landing does not check');
  const landing = checked.scenario;
  const recording = (events: Recording['events'], completedAt = 30_000): Recording => ({
    scenarioId: landing.id,
    completedAt,
    events,
  });
  const verdict = (events: Recording['events'], id: string) =>
    grade(landing, DA50RG_ENV, recording(events)).steps.find((s) => s.id === id);
  const SHUTDOWN: Recording['events'] = [
    { t: 1000, id: 'sw.engine_master', value: 'off' },
    { t: 2000, id: 'sw.fuel_valve', value: 'off' },
    { t: 3000, id: 'sw.elect_master', value: 'off' },
  ];

  it('has the transfer pump off and the emergency pump on in its initial state', () => {
    expect(landing.initial.controls['sw.fuel_trans']).toBeUndefined();
    expect(landing.initial.controls['sw.emerg_fuel_pump']).toBe('on');
    expect(landing.initial.quantities['fuel_trans_active']).toBeUndefined();
    expect(DA50RG.controls.find((c) => c.id === 'sw.fuel_trans')?.default).toBe('off');
  });

  it('row 11 is a confirm step; no other step of the file is', () => {
    const steps = landing.procedure.flatMap((node) => (node.kind === 'group' ? node.steps : []));
    expect(steps.filter((s) => s.confirm === true).map((s) => s.id)).toEqual(['fuel_trans_off']);
    expect(steps.find((s) => s.id === 'fuel_trans_off')).toMatchObject({
      number: 11,
      severity: 'standard',
    });
  });

  it('shows OIL PRES alone at the first frame and no FUEL TRANS in a do-nothing run', () => {
    const setup = simSetup(DA50RG_ENV, landing);
    const start = initialQuantities(landing, DA50RG_ENV.quantities);
    const active = (untilMs: number): string[] => {
      const { state } = simulate(setup, { events: [], start, untilMs });
      return DA50RG_ENV.cas
        .active(
          { controls: state.controls, baseline: setup.baseline, quantities: state.quantities },
          DA50RG_ENV,
        )
        .map((m) => m.id);
    };
    expect(active(0)).toEqual(['oil_pres']);
    expect(landing.annunciations).toEqual(['oil_pres']);
    for (const t of [1_000, 10_000, 60_000, 120_000]) {
      expect(active(t), String(t)).not.toContain('fuel_trans');
    }
  });

  it('row 11 is credited by doing nothing and row 10 is not', () => {
    expect(verdict([], 'fuel_trans_off')).toMatchObject({ credited: true, enteredAt: -1 });
    expect(verdict([], 'emerg_fuel_pump_off')?.credited).toBe(false);
    expect(
      verdict([{ t: 5000, id: 'sw.emerg_fuel_pump', value: 'off' }], 'emerg_fuel_pump_off')
        ?.credited,
    ).toBe(true);
  });

  it('switching the transfer pump on and leaving it uncredits row 11 and changes no PASS', () => {
    const before = grade(landing, DA50RG_ENV, recording(SHUTDOWN));
    expect(before.result).toBe('pass');
    const spoiled = grade(
      landing,
      DA50RG_ENV,
      recording([...SHUTDOWN, { t: 4000, id: 'sw.fuel_trans', value: 'on' }]),
    );
    expect(spoiled.steps.find((s) => s.id === 'fuel_trans_off')?.credited).toBe(false);
    expect(spoiled.result).toBe('pass');
    const restored = grade(
      landing,
      DA50RG_ENV,
      recording([
        ...SHUTDOWN,
        { t: 4000, id: 'sw.fuel_trans', value: 'on' },
        { t: 5000, id: 'sw.fuel_trans', value: 'off' },
      ]),
    );
    expect(restored.steps.find((s) => s.id === 'fuel_trans_off')?.credited).toBe(true);
  });

  it('a do-nothing run still fails with the critical rows missed', () => {
    const result = grade(landing, DA50RG_ENV, recording([]));
    expect(result.result).toBe('fail');
    const missed = result.steps.filter((s) => s.severity === 'critical' && !s.credited);
    expect(missed.map((s) => s.id).sort()).toEqual([
      'elect_master_off',
      'engine_master_off',
      'fuel_valve_off',
    ]);
  });
});
