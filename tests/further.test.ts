import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { FurtherError, defineFurther, gradeFurther } from '../src/engine/further';
import type { FurtherDefinition } from '../src/engine/further';
import { grade } from '../src/engine/grading';
import type { Recording } from '../src/engine/grading';
import { parseScenario } from '../src/scenario/parse';
import type { FurtherSection, Scenario } from '../src/scenario/schema';

// The further actions (Phase 7, plan 07-02): defineFurther and the pure grading of the decisions
// (R16 to R18). The section of a scenario is built here, not read from a shipped file, so the cases
// do not move when a shipped declaration is tuned; the full chain through grade is checked on the
// real Engine Fire file with the section replaced.
const root = fileURLToPath(new URL('../', import.meta.url));
const FIRE_TEXT = readFileSync(join(root, 'scenarios/engine/eng-fire-in-flight.toon'), 'utf8');
const parsed = parseScenario(FIRE_TEXT);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
const fire: Scenario = parsed.value;

const SET = DA50RG_ENV.further;

const ACTIONS = SET.ids('action');
const CONDUCTS = SET.ids('conduct');
const [mayday, panPan, passengers] = ACTIONS;
const [carryOn, precaution, emergency] = CONDUCTS;
if (mayday === undefined || panPan === undefined || passengers === undefined) {
  throw new Error('the aircraft lists fewer than three actions');
}
if (carryOn === undefined || precaution === undefined || emergency === undefined) {
  throw new Error('the aircraft lists fewer than three conduct options');
}

const section = (
  roles: readonly (readonly [string, FurtherSection['actions'][number]['role'], boolean?])[],
  conduct: FurtherSection['conduct'],
): FurtherSection => ({
  actions: roles.map(([id, role, failsRun]) => ({ id, role, fails_run: failsRun ?? false })),
  conduct,
});

const at = (t: number, id: string) => ({ t, id });

describe('defineFurther', () => {
  const valid: FurtherDefinition = {
    groups: [{ id: 'g', text: 'Group' }],
    options: [
      { id: 'a_one', text: 'One', kind: 'action', group: 'g' },
      { id: 'a_two', text: 'Two', kind: 'action' },
      { id: 'c_one', text: 'Conduct', kind: 'conduct', debriefNote: 'Note.' },
    ],
    conductTitle: 'Choose',
    groundParameter: 'on_ground',
  };

  it('defines a set and answers has, option and ids in list order', () => {
    const set = defineFurther(valid);
    expect(set.has('a_two')).toBe(true);
    expect(set.has('nope')).toBe(false);
    expect(set.option('c_one')?.debriefNote).toBe('Note.');
    expect(set.ids('action')).toEqual(['a_one', 'a_two']);
    expect(set.ids('conduct')).toEqual(['c_one']);
  });

  it.each([
    ['a bad option id', { ...valid, options: [{ id: 'Bad', text: 'x', kind: 'action' as const }] }],
    [
      'a repeated option id',
      {
        ...valid,
        options: [
          { id: 'a', text: 'x', kind: 'action' as const },
          { id: 'a', text: 'y', kind: 'action' as const },
        ],
      },
    ],
    ['a repeated group id', { ...valid, groups: [...valid.groups, ...valid.groups] }],
    [
      'an unknown group',
      { ...valid, options: [{ id: 'a', text: 'x', kind: 'action' as const, group: 'zz' }] },
    ],
    [
      'a conduct in a group',
      { ...valid, options: [{ id: 'c', text: 'x', kind: 'conduct' as const, group: 'g' }] },
    ],
    [
      'a note on an action',
      { ...valid, options: [{ id: 'a', text: 'x', kind: 'action' as const, debriefNote: 'n' }] },
    ],
    ['a bad ground parameter', { ...valid, groundParameter: 'Ground' }],
  ])('rejects %s', (_name, definition) => {
    expect(() => defineFurther(definition)).toThrow(FurtherError);
  });

  it('the aircraft list holds the decided options in order', () => {
    expect(SET.options.map((o) => `${o.kind}:${o.id}`)).toEqual([
      'action:atc_mayday',
      'action:atc_pan_pan',
      'action:brief_passengers',
      'conduct:conduct_continue',
      'conduct:conduct_precautionary',
      'conduct:conduct_emergency',
    ]);
    expect(SET.option(emergency)?.debriefNote).toBe(
      'The emergency landing itself is not trained yet.',
    );
  });
});

describe('gradeFurther (R16 to R18)', () => {
  const roles = section(
    [
      [mayday, 'required'],
      [panPan, 'optional'],
      [passengers, 'recommended'],
    ],
    { accept: [emergency] },
  );
  const grading = (
    decisions: readonly { t: number; id: string }[] | undefined,
    outcomeAt: number | null = null,
  ) => gradeFurther(roles, SET, decisions, outcomeAt);

  it('a missing required action is one further_missed reason and the entry is not done', () => {
    const graded = grading([at(1000, emergency)]);
    expect(graded.early).toEqual([{ kind: 'further_missed', count: 1 }]);
    expect(graded.result?.actions.find((a) => a.id === mayday)).toEqual({
      id: mayday,
      role: 'required',
      done: false,
      failsRun: false,
    });
  });

  it('a done required action and the right conduct add no reason', () => {
    const graded = grading([at(1000, mayday), at(2000, emergency)]);
    expect(graded.early).toEqual([]);
    expect(graded.late).toEqual([]);
    expect(graded.result?.conduct).toEqual({
      declared: 'accept',
      picks: [emergency],
      last: emergency,
      status: 'ok',
    });
  });

  it('recommended and optional actions never change the verdict, done or not', () => {
    const none = grading([at(1000, mayday), at(2000, emergency)]);
    const all = grading([
      at(1000, mayday),
      at(1500, panPan),
      at(1800, passengers),
      at(2000, emergency),
    ]);
    expect(none.early).toEqual(all.early);
    expect(none.late).toEqual(all.late);
    expect(all.result?.actions.map((a) => a.done)).toEqual([true, true, true]);
    expect(none.result?.actions.map((a) => a.done)).toEqual([true, false, false]);
  });

  it('a harmful action fails the run only with fails_run', () => {
    const lenient = gradeFurther(
      section([[panPan, 'harmful']], { accept: [precaution] }),
      SET,
      [at(1, panPan), at(2, precaution)],
      null,
    );
    expect(lenient.late).toEqual([]);
    expect(lenient.result?.actions).toEqual([
      { id: panPan, role: 'harmful', done: true, failsRun: false },
    ]);
    const strict = gradeFurther(
      section([[panPan, 'harmful', true]], { accept: [precaution] }),
      SET,
      [at(1, panPan), at(2, precaution)],
      null,
    );
    expect(strict.late).toEqual([{ kind: 'further_harmful', id: panPan }]);
    const avoided = gradeFurther(
      section([[panPan, 'harmful', true]], { accept: [precaution] }),
      SET,
      [at(2, precaution)],
      null,
    );
    expect(avoided.late).toEqual([]);
  });

  it('no conduct pick is missing, a wrong last pick is wrong and the last pick wins', () => {
    expect(grading([at(1, mayday)]).early).toEqual([{ kind: 'conduct', status: 'missing' }]);
    expect(grading([at(1, mayday), at(2, carryOn)]).early).toEqual([
      { kind: 'conduct', status: 'wrong' },
    ]);
    const corrected = grading([at(1, mayday), at(2, carryOn), at(3, emergency)]);
    expect(corrected.early).toEqual([]);
    expect(corrected.result?.conduct.picks).toEqual([carryOn, emergency]);
    const escalatedWrong = grading([at(1, mayday), at(2, emergency), at(3, carryOn)]);
    expect(escalatedWrong.early).toEqual([{ kind: 'conduct', status: 'wrong' }]);
  });

  it('puts further_missed before conduct', () => {
    expect(grading([]).early).toEqual([
      { kind: 'further_missed', count: 1 },
      { kind: 'conduct', status: 'missing' },
    ]);
  });

  it('conduct none never fails and keeps the picks for the debrief', () => {
    const ground = section([[mayday, 'recommended']], 'none');
    const bare = gradeFurther(ground, SET, undefined, null);
    expect(bare.early).toEqual([]);
    expect(bare.result?.conduct).toEqual({
      declared: 'none',
      picks: [],
      last: null,
      status: 'not_declared',
    });
    const picked = gradeFurther(ground, SET, [at(1, carryOn)], null);
    expect(picked.early).toEqual([]);
    expect(picked.result?.conduct.picks).toEqual([carryOn]);
  });

  it('an action picked twice counts once', () => {
    const graded = grading([at(1, mayday), at(2, mayday), at(3, emergency)]);
    expect(graded.result?.actions.find((a) => a.id === mayday)?.done).toBe(true);
    expect(graded.result?.actions).toHaveLength(3);
  });

  it('decisions after the outcome time are not graded', () => {
    const graded = grading([at(1000, mayday), at(5000, emergency)], 2000);
    expect(graded.early).toEqual([{ kind: 'conduct', status: 'missing' }]);
    expect(graded.result?.conduct.picks).toEqual([]);
    const onTheDot = grading([at(1000, mayday), at(2000, emergency)], 2000);
    expect(onTheDot.early).toEqual([]);
  });

  it('an unknown id throws, even after the outcome time', () => {
    expect(() => grading([at(1, 'nope')])).toThrow(Error);
    expect(() => grading([at(5000, 'nope')], 2000)).toThrow(Error);
  });

  it('lists the actions in the list order of the aircraft, declared or picked', () => {
    const graded = gradeFurther(
      section([[passengers, 'optional']], 'none'),
      SET,
      [at(1, panPan)],
      null,
    );
    expect(graded.result?.actions.map((a) => a.id)).toEqual([panPan, passengers]);
    expect(graded.result?.actions[0]?.role).toBe('optional');
  });

  it('a scenario without the section grades picked actions as optional and the conduct as not declared', () => {
    const graded = gradeFurther(undefined, SET, [at(1, mayday), at(2, carryOn)], null);
    expect(graded.early).toEqual([]);
    expect(graded.late).toEqual([]);
    expect(graded.result).toEqual({
      actions: [{ id: mayday, role: 'optional', done: true, failsRun: false }],
      conduct: { declared: null, picks: [carryOn], last: carryOn, status: 'not_declared' },
    });
  });

  it('no section and no decision leave the result absent', () => {
    expect(gradeFurther(undefined, SET, undefined, null)).toEqual({
      result: undefined,
      early: [],
      late: [],
    });
    expect(gradeFurther(undefined, SET, [], null).result).toBeUndefined();
  });
});

describe('grade with the section (R16 to R18)', () => {
  const recording = (extra: Partial<Recording>): Recording => ({
    scenarioId: fire.id,
    completedAt: 20000,
    events: [],
    ...extra,
  });

  it('a file without the section grades exactly as before: no further key', () => {
    const { further: _declared, ...plain } = fire;
    void _declared;
    const result = grade(plain, DA50RG_ENV, recording({}));
    expect('further' in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain('further');
  });

  it('the decisions of the recording reach the result and a throw for an unknown id', () => {
    const result = grade(fire, DA50RG_ENV, recording({ decisions: [at(1000, mayday)] }));
    expect(result.further?.actions.find((a) => a.id === mayday)?.done).toBe(true);
    expect(() => grade(fire, DA50RG_ENV, recording({ decisions: [at(1, 'nope')] }))).toThrow(Error);
  });

  it('a decision after the outcome of a run that escalated is not graded', () => {
    const long = recording({ completedAt: 600000, decisions: [at(590000, mayday)] });
    const result = grade(fire, DA50RG_ENV, long);
    expect(result.outcome).not.toBeNull();
    expect(result.further?.actions.find((a) => a.id === mayday)?.done).toBe(false);
  });

  it('puts the reasons in the order of D-11', () => {
    const result = grade(
      fire,
      DA50RG_ENV,
      recording({ events: [{ t: 3000, id: 'sw.emerg_fuel_pump', value: 'on' }] }),
    );
    expect(result.reasons.map((r) => r.kind)).toEqual([
      'critical_missed',
      'further_missed',
      'conduct',
      'forbidden',
    ]);
  });
});
