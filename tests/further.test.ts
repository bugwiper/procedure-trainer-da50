import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import {
  FurtherError,
  defineFurther,
  effectiveSelection,
  gradeFurther,
} from '../src/engine/further';
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
    options: [
      { id: 'a_one', text: 'One', kind: 'action' },
      { id: 'a_two', text: 'Two', kind: 'action' },
      { id: 'c_one', text: 'Conduct', kind: 'conduct', debriefNote: 'Note.' },
    ],
    conductTitle: 'Choose',
    groundParameter: 'on_ground',
    defaultConduct: 'c_one',
    noteConduct: 'c_one',
  };

  it('defines a set and answers has, option and ids in list order', () => {
    const set = defineFurther(valid);
    expect(set.has('a_two')).toBe(true);
    expect(set.has('nope')).toBe(false);
    expect(set.option('c_one')?.debriefNote).toBe('Note.');
    expect(set.ids('action')).toEqual(['a_one', 'a_two']);
    expect(set.ids('conduct')).toEqual(['c_one']);
    expect(set.defaultConduct).toBe('c_one');
    expect(set.noteConduct).toBe('c_one');
    expect(set.avoidIds()).toEqual([]);
  });

  it('lists the Avoid actions in list order', () => {
    const set = defineFurther({
      ...valid,
      options: [
        { id: 'a_one', text: 'One', kind: 'action' },
        { id: 'v_one', text: 'Avoid', kind: 'action', unrated: true, avoid: true },
        { id: 'c_one', text: 'Conduct', kind: 'conduct' },
        { id: 'v_two', text: 'Avoid 2', kind: 'action', unrated: true, avoid: true },
      ],
    });
    expect(set.avoidIds()).toEqual(['v_one', 'v_two']);
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
    [
      'a note on an action',
      { ...valid, options: [{ id: 'a', text: 'x', kind: 'action' as const, debriefNote: 'n' }] },
    ],
    ['a bad ground parameter', { ...valid, groundParameter: 'Ground' }],
    ['a default conduct that is not an option', { ...valid, defaultConduct: 'c_two' }],
    ['a default conduct that is an action', { ...valid, defaultConduct: 'a_one' }],
    ['a note conduct that is not an option', { ...valid, noteConduct: 'c_two' }],
    ['a note conduct that is an action', { ...valid, noteConduct: 'a_one' }],
    [
      'an avoid action that is rated',
      {
        ...valid,
        options: [
          ...valid.options,
          { id: 'v_one', text: 'x', kind: 'action' as const, avoid: true as const },
        ],
      },
    ],
    [
      'an action blocked by an id that is no option',
      {
        ...valid,
        options: [
          ...valid.options,
          { id: 'v_one', text: 'x', kind: 'action' as const, blockedByConduct: ['c_two'] },
        ],
      },
    ],
    [
      'an action blocked by an action',
      {
        ...valid,
        options: [
          ...valid.options,
          { id: 'v_one', text: 'x', kind: 'action' as const, blockedByConduct: ['a_one'] },
        ],
      },
    ],
    [
      'a conduct that is blocked by a conduct',
      {
        ...valid,
        options: [
          ...valid.options,
          { id: 'c_two', text: 'x', kind: 'conduct' as const, blockedByConduct: ['c_one'] },
        ],
      },
    ],
    [
      'an avoid option that is a conduct',
      {
        ...valid,
        options: [
          ...valid.options,
          { id: 'v_two', text: 'x', kind: 'conduct' as const, avoid: true as const },
        ],
      },
    ],
  ])('rejects %s', (_name, definition) => {
    expect(() => defineFurther(definition)).toThrow(FurtherError);
  });

  it('answers isBlocked from the conduct options an action lists', () => {
    const set = defineFurther({
      ...valid,
      options: [
        { id: 'a_one', text: 'One', kind: 'action', blockedByConduct: ['c_two'] },
        { id: 'a_two', text: 'Two', kind: 'action' },
        { id: 'c_one', text: 'Conduct', kind: 'conduct' },
        { id: 'c_two', text: 'Conduct 2', kind: 'conduct' },
      ],
    });
    expect(set.isBlocked('a_one', 'c_two')).toBe(true);
    expect(set.isBlocked('a_one', 'c_one')).toBe(false);
    expect(set.isBlocked('a_one', null)).toBe(false);
    expect(set.isBlocked('a_two', 'c_two')).toBe(false);
    expect(set.isBlocked('nope', 'c_two')).toBe(false);
  });

  it('the aircraft greys Avoid NVFR and Avoid icing out under the emergency landing and nothing else', () => {
    const blocked = (conduct: string | null) =>
      SET.options.filter((o) => SET.isBlocked(o.id, conduct)).map((o) => o.id);
    expect(blocked(emergency)).toEqual(['avoid_nvfr', 'avoid_icing']);
    expect(blocked(carryOn)).toEqual([]);
    expect(blocked(precaution)).toEqual([]);
    expect(blocked(null)).toEqual([]);
    // The blocked ones are Avoid actions; Avoid IMC is not among them, and the grade is untouched.
    for (const id of blocked(emergency)) expect(SET.option(id)?.avoid).toBe(true);
    const picks = [at(1, 'avoid_nvfr'), at(2, 'avoid_imc'), at(3, emergency)];
    const sel = effectiveSelection(picks, SET, true);
    expect([...sel.actions].sort()).toEqual(['avoid_imc', 'avoid_nvfr']);
    expect(sel.conduct).toBe(emergency);
  });

  it('the aircraft list holds the decided options in order', () => {
    expect(SET.options.map((o) => `${o.kind}:${o.id}`)).toEqual([
      'action:atc_mayday',
      'action:atc_pan_pan',
      'action:brief_passengers',
      'action:avoid_imc',
      'action:avoid_nvfr',
      'action:avoid_icing',
      'conduct:conduct_destination',
      'conduct:conduct_precautionary',
      'conduct:conduct_emergency',
    ]);
    expect(SET.option(emergency)?.debriefNote).toBe(
      'The emergency landing itself is not trained yet.',
    );
    // The Avoid actions are unrated actions marked avoid, and the note speaks of continuing to the destination.
    expect(SET.avoidIds()).toEqual(['avoid_imc', 'avoid_nvfr', 'avoid_icing']);
    for (const id of SET.avoidIds()) {
      expect(SET.option(id)).toMatchObject({ kind: 'action', unrated: true, avoid: true });
    }
    expect(SET.noteConduct).toBe(carryOn);
    expect(SET.option(SET.noteConduct)?.text).toBe('Continue to destination');
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
      picks: [carryOn, emergency],
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

  it('no conduct press leaves the preselected default, which counts: wrong here, a wrong last pick is wrong and the last pick wins', () => {
    const untouched = grading([at(1, mayday)]);
    expect(untouched.early).toEqual([{ kind: 'conduct', status: 'wrong' }]);
    expect(untouched.result?.conduct).toEqual({
      declared: 'accept',
      picks: [carryOn],
      last: carryOn,
      status: 'wrong',
    });
    expect(grading([at(1, mayday), at(2, precaution)]).early).toEqual([
      { kind: 'conduct', status: 'wrong' },
    ]);
    // A press of the option that is already selected (the default) is no change and adds no pick.
    expect(grading([at(1, mayday), at(2, carryOn)]).result?.conduct.picks).toEqual([carryOn]);
    const corrected = grading([at(1, mayday), at(2, precaution), at(3, emergency)]);
    expect(corrected.early).toEqual([]);
    expect(corrected.result?.conduct.picks).toEqual([carryOn, precaution, emergency]);
    const escalatedWrong = grading([at(1, mayday), at(2, emergency), at(3, carryOn)]);
    expect(escalatedWrong.early).toEqual([{ kind: 'conduct', status: 'wrong' }]);
  });

  it('puts further_missed before conduct', () => {
    expect(grading([]).early).toEqual([
      { kind: 'further_missed', count: 1 },
      { kind: 'conduct', status: 'wrong' },
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
    // The late press is not graded; the preselected default stands.
    expect(graded.early).toEqual([{ kind: 'conduct', status: 'wrong' }]);
    expect(graded.result?.conduct.picks).toEqual([carryOn]);
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

// Plan 07-05 (R-08): the buttons are toggles. A press is a decision with an optional on flag (absent
// means on); the state at the end counts. Only additions: every case above stays as it was.
describe('effectiveSelection (R-08)', () => {
  const on = (t: number, id: string) => ({ t, id, on: true });
  const off = (t: number, id: string) => ({ t, id, on: false });
  const state = (decisions: readonly { t: number; id: string; on?: boolean }[], offered = true) => {
    const selection = effectiveSelection(decisions, SET, offered);
    return { actions: [...selection.actions].sort(), conduct: selection.conduct };
  };

  it('starts with no action and, where a conduct is offered, the preselected default', () => {
    expect(state([])).toEqual({ actions: [], conduct: carryOn });
    expect(state([], false)).toEqual({ actions: [], conduct: null });
    expect(effectiveSelection([], SET, true).picks).toEqual([carryOn]);
    expect(effectiveSelection([], SET, false).picks).toEqual([]);
  });

  it('switches an action on, off and on again; the last entry counts', () => {
    expect(state([on(1, mayday)]).actions).toEqual([mayday]);
    expect(state([on(1, mayday), off(2, mayday)]).actions).toEqual([]);
    expect(state([on(1, mayday), off(2, mayday), on(3, mayday)]).actions).toEqual([mayday]);
  });

  it('keeps the actions independent of each other', () => {
    expect(
      state([on(1, mayday), on(2, panPan), on(3, passengers), off(4, panPan)]).actions,
    ).toEqual([mayday, passengers].sort());
  });

  it('treats an entry without the flag as on, and only the value false as off', () => {
    expect(state([at(1, mayday)]).actions).toEqual([mayday]);
    expect(state([at(1, mayday), at(2, mayday)]).actions).toEqual([mayday]);
    const odd = { t: 1, id: mayday, on: 'false' as unknown as boolean };
    expect(state([off(0, mayday), odd]).actions).toEqual([mayday]);
  });

  it('makes the conduct a radio group: another option switches the selection, the history heads with the default', () => {
    expect(state([on(1, carryOn)]).conduct).toBe(carryOn);
    expect(state([on(1, carryOn), on(2, precaution)]).conduct).toBe(precaution);
    expect(state([on(1, precaution), on(2, emergency)]).conduct).toBe(emergency);
    expect(
      effectiveSelection([on(1, precaution), on(2, emergency), on(3, emergency)], SET, true).picks,
    ).toEqual([carryOn, precaution, emergency]);
    // Where no conduct is offered nothing is preselected, a pick is still replayed.
    expect(state([on(1, precaution)], false).conduct).toBe(precaution);
    expect(effectiveSelection([on(1, precaution)], SET, false).picks).toEqual([precaution]);
  });

  it('cannot clear the conduct any more: an off entry (an older recording) falls back to the default', () => {
    expect(state([on(1, precaution), off(2, precaution)]).conduct).toBe(carryOn);
    expect(effectiveSelection([on(1, precaution), off(2, precaution)], SET, true).picks).toEqual([
      carryOn,
      precaution,
      carryOn,
    ]);
    // An off entry of an option that is not selected changes nothing, nor does one of the default.
    expect(state([on(1, precaution), off(2, emergency)]).conduct).toBe(precaution);
    expect(state([off(1, carryOn)]).conduct).toBe(carryOn);
    expect(effectiveSelection([off(1, carryOn)], SET, true).picks).toEqual([carryOn]);
    expect(state([on(1, precaution), on(2, emergency), off(3, precaution)]).conduct).toBe(
      emergency,
    );
    // Not offered: the off entry of the selected option leaves nothing.
    expect(state([on(1, precaution), off(2, precaution)], false).conduct).toBeNull();
  });

  it('turns an action that was never on off without effect and skips an unknown id', () => {
    expect(state([off(1, mayday)]).actions).toEqual([]);
    expect(state([on(1, 'nope'), on(2, mayday)])).toEqual({ actions: [mayday], conduct: carryOn });
  });
});

describe('gradeFurther with toggles (R-08)', () => {
  const on = (t: number, id: string) => ({ t, id, on: true });
  const off = (t: number, id: string) => ({ t, id, on: false });
  const roles = section([[mayday, 'required']], { accept: [precaution] });
  const grading = (
    decisions: readonly { t: number; id: string; on?: boolean }[],
    outcomeAt: number | null = null,
  ) => gradeFurther(roles, SET, decisions, outcomeAt);

  it('a required action switched on and off again is missed', () => {
    const graded = grading([on(1, mayday), off(2, mayday), on(3, precaution)]);
    expect(graded.early).toEqual([{ kind: 'further_missed', count: 1 }]);
    expect(graded.result?.actions.find((a) => a.id === mayday)?.done).toBe(false);
  });

  it('on, off, on is done', () => {
    const graded = grading([on(1, mayday), off(2, mayday), on(3, mayday), on(4, precaution)]);
    expect(graded.early).toEqual([]);
    expect(graded.result?.actions.find((a) => a.id === mayday)?.done).toBe(true);
  });

  it('a conduct switched to another option is graded by the final selection; picks keep the history', () => {
    const graded = grading([on(1, mayday), on(2, emergency), on(3, precaution)]);
    expect(graded.early).toEqual([]);
    expect(graded.result?.conduct).toEqual({
      declared: 'accept',
      picks: [carryOn, emergency, precaution],
      last: precaution,
      status: 'ok',
    });
    const wrong = grading([on(1, mayday), on(2, precaution), on(3, emergency)]);
    expect(wrong.result?.conduct.status).toBe('wrong');
  });

  it('an older recording that cleared the conduct ends on the default, which this section does not accept: wrong (was missing)', () => {
    const graded = grading([on(1, mayday), on(2, precaution), off(3, precaution)]);
    expect(graded.early).toEqual([{ kind: 'conduct', status: 'wrong' }]);
    expect(graded.result?.conduct).toEqual({
      declared: 'accept',
      picks: [carryOn, precaution, carryOn],
      last: carryOn,
      status: 'wrong',
    });
  });

  it('a section that accepts the default is right without any press of the conduct', () => {
    const lenient = gradeFurther(
      section([[mayday, 'required']], { accept: [carryOn] }),
      SET,
      [on(1, mayday)],
      null,
    );
    expect(lenient.early).toEqual([]);
    expect(lenient.result?.conduct).toMatchObject({ last: carryOn, status: 'ok' });
  });

  it('an undeclared action that was switched on and off reads like one never selected', () => {
    const graded = grading([on(1, panPan), off(2, panPan), on(3, mayday), on(4, precaution)]);
    expect(graded.result?.actions.map((a) => a.id)).toEqual([mayday]);
  });

  it('a press after the outcome time is not graded, an off entry included', () => {
    const graded = grading([on(1000, mayday), off(5000, mayday), on(1500, precaution)], 2000);
    expect(graded.result?.actions.find((a) => a.id === mayday)?.done).toBe(true);
    const lateOn = grading([on(5000, mayday), on(1500, precaution)], 2000);
    expect(lateOn.early).toEqual([{ kind: 'further_missed', count: 1 }]);
  });

  it('an unknown id throws also when it carries the off flag', () => {
    expect(() => grading([off(1, 'nope')])).toThrow(Error);
  });

  it('a recording without the flag grades as before: the same result as with on true', () => {
    const plain = [at(1000, mayday), at(2000, precaution)];
    const flagged = [on(1000, mayday), on(2000, precaution)];
    expect(JSON.stringify(grading(plain))).toBe(JSON.stringify(grading(flagged)));
  });

  it('grade runs the chain: MAYDAY on then off fails the run with the further_missed reason', () => {
    const base = { scenarioId: fire.id, completedAt: 20000, events: [] as Recording['events'] };
    const done = grade(fire, DA50RG_ENV, {
      ...base,
      decisions: [on(1000, mayday), on(2000, emergency)],
    });
    const cleared = grade(fire, DA50RG_ENV, {
      ...base,
      decisions: [on(1000, mayday), off(1500, mayday), on(2000, emergency)],
    });
    expect(done.reasons.some((r) => r.kind === 'further_missed')).toBe(false);
    expect(cleared.reasons).toContainEqual({ kind: 'further_missed', count: 1 });
  });
});
