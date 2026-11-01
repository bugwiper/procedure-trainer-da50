import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { nextOpenStep } from '../src/engine/hint';
import { parseScenario } from '../src/scenario/parse';
import type { ProcedureNode, Scenario, Step } from '../src/scenario/schema';

// The training hint (Phase 7, plan 07-01, D-04, H-01): the first critical or standard step that the
// grade of the partial recording does not credit, with its stored row mark, text and action. Expected
// values are read from the parsed shipped files, never typed here.
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file: string): string => readFileSync(join(root, file), 'utf8');
const RECORDINGS = JSON.parse(read('tests/fixtures/recordings.json')) as Record<string, Recording>;

function load(text: string): Scenario {
  const result = parseScenario(text);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

const BLUEPRINT_TEXT = read('scenarios/engine/eng-oil-temp-green.toon');
const blueprint = load(BLUEPRINT_TEXT);
const fire = load(read('scenarios/engine/eng-fire-in-flight.toon'));

function recording(name: string): Recording {
  const found = RECORDINGS[name];
  if (found === undefined) throw new Error(`no recording "${name}"`);
  return found;
}

/** Every step of the scenario in declared order, depth first, whether or not its branch applies. */
function stepsOf(nodes: readonly ProcedureNode[]): Step[] {
  return nodes.flatMap((node): Step[] => {
    switch (node.kind) {
      case 'line':
      case 'comment':
        return [];
      case 'group':
        return node.steps;
      case 'branch':
        return stepsOf(node.nodes);
      case 'decision':
        return node.branches.flatMap((branch) => stepsOf(branch.nodes));
    }
  });
}

const empty = (scenario: Scenario, completedAt = 20000): Recording => ({
  scenarioId: scenario.id,
  completedAt,
  events: [],
});

/** The first step of the file that is not optional (what an empty recording must name). */
function firstRequired(scenario: Scenario): Step {
  const found = stepsOf(scenario.procedure).find((step) => step.severity !== 'optional');
  if (found === undefined) throw new Error(`${scenario.id} has no required step`);
  return found;
}

describe('nextOpenStep', () => {
  it('names the first critical or standard step of an empty recording with its stored wording', () => {
    for (const scenario of [blueprint, fire]) {
      const expected = firstRequired(scenario);
      const hint = nextOpenStep(scenario, DA50RG_ENV, empty(scenario));
      expect(hint?.id).toBe(expected.id);
      expect(hint?.text).toBe(expected.text);
      expect(hint?.number).toBe(expected.number);
      expect(hint?.action).toBe(expected.action);
    }
  });

  it('carries the row mark and the action of a table checklist, and none for the outline form', () => {
    const table = nextOpenStep(fire, DA50RG_ENV, empty(fire));
    expect(table?.number).not.toBeUndefined();
    expect(table?.action).not.toBeUndefined();
    const outline = nextOpenStep(blueprint, DA50RG_ENV, empty(blueprint));
    expect(outline).not.toBeNull();
    expect(outline).not.toHaveProperty('number');
    expect(outline).not.toHaveProperty('action');
  });

  it('follows the progress: the next open step after each recorded action, then none', () => {
    const required = stepsOf(fire.procedure).filter((step) => step.severity !== 'optional');
    const full = recording('fire-golden');
    const seen: (string | undefined)[] = [];
    for (let done = 0; done <= full.events.length; done++) {
      const partial: Recording = { ...full, events: full.events.slice(0, done) };
      seen.push(nextOpenStep(fire, DA50RG_ENV, partial)?.id);
    }
    // The golden run first sets the optional squawk (the hint does not move), then does the five
    // required steps in the declared order (the hint moves one step each time), then nothing is open.
    const ids = required.map((step) => step.id);
    expect(ids.length).toBe(full.events.length - 1);
    expect(seen).toEqual([ids[0], ...ids, undefined]);
  });

  it('names nothing after the recorded actions of the golden runs', () => {
    expect(nextOpenStep(blueprint, DA50RG_ENV, recording('golden'))).toBeNull();
    expect(nextOpenStep(blueprint, DA50RG_ENV, recording('golden-long'))).toBeNull();
    expect(nextOpenStep(fire, DA50RG_ENV, recording('fire-golden'))).toBeNull();
  });

  it('names the second step once the first one is done', () => {
    const [first, second] = stepsOf(blueprint.procedure);
    if (first === undefined || second === undefined)
      throw new Error('the blueprint has no two steps');
    const partial: Recording = {
      scenarioId: blueprint.id,
      completedAt: 9000,
      events: [{ t: 8000, id: 'lv.power', value: 'p60' }],
    };
    expect(nextOpenStep(blueprint, DA50RG_ENV, empty(blueprint))?.id).toBe(first.id);
    expect(nextOpenStep(blueprint, DA50RG_ENV, partial)?.id).toBe(second.id);
  });

  it('never names an optional step', () => {
    const optional = stepsOf(fire.procedure).filter((step) => step.severity === 'optional');
    expect(optional.length).toBeGreaterThan(0);
    // The run that skips the optional squawk and does the rest has nothing open.
    expect(nextOpenStep(fire, DA50RG_ENV, recording('fire-no-squawk'))).toBeNull();
    // And an empty recording never names it either.
    const hint = nextOpenStep(fire, DA50RG_ENV, empty(fire));
    expect(optional.map((step) => step.id)).not.toContain(hint?.id);
  });

  it('never names a step of a branch that does not apply', () => {
    // Oil pressure in the red band at the start: the green-range branch (both steps) does not apply.
    const low = load(BLUEPRINT_TEXT.replace('oil_pressure_bar: 4.16', 'oil_pressure_bar: 0.5'));
    const result = grade(low, DA50RG_ENV, empty(low));
    expect(result.steps).toEqual([]);
    expect(stepsOf(low.procedure).length).toBeGreaterThan(0);
    expect(nextOpenStep(low, DA50RG_ENV, empty(low))).toBeNull();
  });

  it('keeps a step open that held at the onset and was not redone (R12)', () => {
    const first = firstRequired(blueprint);
    expect(first.id).toBe('reduce_power');
    const withOnset: Recording = {
      scenarioId: blueprint.id,
      completedAt: 20000,
      onset: { at: 4000, seed: 1 },
      // Power reduced at 1000 ms, before the failure began at 4000 ms: no credit.
      events: [{ t: 1000, id: 'lv.power', value: 'p60' }],
    };
    expect(grade(blueprint, DA50RG_ENV, withOnset).steps[0]?.credited).toBe(false);
    expect(nextOpenStep(blueprint, DA50RG_ENV, withOnset)?.id).toBe(first.id);
    // The same action after the onset is credited.
    const redone: Recording = { ...withOnset, events: [{ t: 5000, id: 'lv.power', value: 'p60' }] };
    expect(nextOpenStep(blueprint, DA50RG_ENV, redone)?.id).not.toBe(first.id);
  });

  it('leaves the grade untouched: the same recording grades JSON-identically before and after', () => {
    for (const name of ['golden', 'do-nothing', 'forbidden', 'toggle-back']) {
      const rec = recording(name);
      const before = JSON.stringify(grade(blueprint, DA50RG_ENV, rec));
      nextOpenStep(blueprint, DA50RG_ENV, rec);
      nextOpenStep(blueprint, DA50RG_ENV, empty(blueprint));
      expect(JSON.stringify(grade(blueprint, DA50RG_ENV, rec))).toBe(before);
    }
    const rec = recording('fire-golden');
    const before = JSON.stringify(grade(fire, DA50RG_ENV, rec));
    nextOpenStep(fire, DA50RG_ENV, rec);
    expect(JSON.stringify(grade(fire, DA50RG_ENV, rec))).toBe(before);
  });

  it('answers the same for the same input (no state, no clock)', () => {
    const a = nextOpenStep(fire, DA50RG_ENV, empty(fire));
    const b = nextOpenStep(fire, DA50RG_ENV, empty(fire));
    expect(a).toEqual(b);
  });
});
