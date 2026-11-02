import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { grade } from '../src/engine/grading';
import type { GradeResult, OrderViolation, Reason } from '../src/engine/grading';
import { parseScenario } from '../src/scenario/parse';
import type { FurtherSection, Group } from '../src/scenario/schema';
import { MAX_RUN_MS } from '../src/engine/sim';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import {
  checklistNote,
  conductNote,
  furtherNote,
  furtherRows,
  harmfulLine,
  limitLine,
  orderLine,
  reasonLines,
  timingLine,
} from '../src/ui/debrief-text';

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
    timing: { onsetAt: 0, firstActionMs: null },
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

  it('names steps done before the onset on the missed-steps line only when one was pre-empted', () => {
    const step = {
      id: 's',
      group: 'g',
      severity: 'critical' as const,
      credited: false,
      enteredAt: null,
    };
    expect(
      reasonLines(
        result({
          result: 'fail',
          reasons: [{ kind: 'critical_missed', count: 1 }],
          steps: [{ ...step, preempted: true }],
        }),
      ),
    ).toEqual(['1 critical step was missed. Steps done before the onset do not count.']);
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

  it('an outcome reason reads "The failure escalated: TEXT." and comes first', () => {
    const escalated = result({
      result: 'fail',
      reasons: [
        { kind: 'outcome', id: 'engine_failure' },
        { kind: 'critical_missed', count: 2 },
      ],
      outcome: { id: 'engine_failure', text: 'Engine failure from overheating', t: 43000 },
    });
    expect(reasonLines(escalated)).toEqual([
      'The failure escalated: Engine failure from overheating.',
      '2 critical steps were missed.',
    ]);
  });

  it('the PASS line is unchanged by the outcome field', () => {
    expect(reasonLines(result({ outcome: null }))).toEqual(['All critical steps done.']);
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

describe('timingLine (D-05, C-34)', () => {
  it('says there was no action when nothing came after the onset', () => {
    expect(timingLine(result({}))).toBe('No action after the onset.');
  });

  it('prints the reaction time with one decimal', () => {
    const timed = (firstActionMs: number | null) =>
      result({ timing: { onsetAt: 10000, firstActionMs } });
    expect(timingLine(timed(3500))).toBe('First action 3.5 s after the onset.');
    expect(timingLine(timed(0))).toBe('First action 0.0 s after the onset.');
    expect(timingLine(timed(12000))).toBe('First action 12.0 s after the onset.');
    expect(timingLine(timed(1234))).toBe('First action 1.2 s after the onset.');
  });
});

describe('limitLine (WR-05, V-14)', () => {
  it('names the limit only for a run that reached the cap', () => {
    expect(limitLine(0)).toBeNull();
    expect(limitLine(MAX_RUN_MS - 100)).toBeNull();
    expect(limitLine(MAX_RUN_MS)).toBe(
      `The run reached the ${String(MAX_RUN_MS / 60_000)} minute limit.`,
    );
  });
});

describe('further actions (Phase 7, plan 07-02, R19)', () => {
  const SET = DA50RG_ENV.further;
  const [mayday, panPan, passengers] = SET.ids('action');
  const [carryOn, , emergency] = SET.ids('conduct');
  if (!mayday || !panPan || !passengers || !carryOn || !emergency) throw new Error('short list');

  it('words the reasons of the further actions', () => {
    expect(reasonLines(failing([{ kind: 'further_missed', count: 1 }]))).toEqual([
      '1 required further action was missed.',
    ]);
    expect(reasonLines(failing([{ kind: 'further_missed', count: 2 }]))).toEqual([
      '2 required further actions were missed.',
    ]);
    expect(reasonLines(failing([{ kind: 'conduct', status: 'wrong' }]))).toEqual([
      'The flight decision was not the right one.',
    ]);
    expect(reasonLines(failing([{ kind: 'further_harmful', id: panPan }]))).toEqual([
      'A harmful action counts as a fail in this scenario.',
    ]);
    // A harmful panel action and a harmful further action are one cause line.
    expect(
      reasonLines(
        failing([
          { kind: 'forbidden', id: 'x' },
          { kind: 'further_harmful', id: panPan },
        ]),
      ),
    ).toEqual(['A harmful action counts as a fail in this scenario.']);
  });

  const withFurther = (further: GradeResult['further']): GradeResult => result({ further });

  it('gives no rows for a result without a further entry', () => {
    expect(furtherRows(result({}), SET)).toEqual([]);
    expect(furtherNote(result({}), SET)).toBeNull();
  });

  it('gives a row per entry with the role word and the verdict word, then the flight decision', () => {
    const rows = furtherRows(
      withFurther({
        actions: [
          { id: mayday, role: 'required', done: false, failsRun: false },
          { id: panPan, role: 'optional', done: true, failsRun: false },
          { id: passengers, role: 'recommended', done: false, failsRun: false },
        ],
        // Never switched: the preselected Continue to destination is the pick and it is wrong here.
        conduct: { declared: 'accept', picks: [carryOn], last: carryOn, status: 'wrong' },
      }),
      SET,
    );
    expect(rows.map((r) => [r.id, r.role, r.verdict])).toEqual([
      [mayday, 'Required', 'Missed'],
      [panPan, 'Optional', 'Done'],
      [passengers, 'Recommended', 'Recommended and not done'],
      ['conduct', 'Required', 'Wrong'],
    ]);
    expect(rows[0]?.label).toBe(SET.option(mayday)?.text);
    expect(rows[3]?.label).toBe(SET.conductTitle);
    // The picked line shows Continue to destination when it was the default.
    expect(rows[3]?.picks).toBe(`Picked: ${SET.option(carryOn)?.text ?? ''}`);
  });

  it('words the harmful rows and the right and wrong flight decision with the earlier picks', () => {
    const base = {
      actions: [
        { id: mayday, role: 'harmful' as const, done: true, failsRun: true },
        { id: panPan, role: 'harmful' as const, done: false, failsRun: true },
      ],
    };
    const right = furtherRows(
      withFurther({
        ...base,
        conduct: {
          declared: 'accept',
          picks: [carryOn, emergency],
          last: emergency,
          status: 'ok',
        },
      }),
      SET,
    );
    expect(right.map((r) => r.verdict)).toEqual(['Harmful', 'Not done', 'Right']);
    expect(right[2]?.picks).toBe(
      `Picks in order: ${SET.option(carryOn)?.text ?? ''}, then ${SET.option(emergency)?.text ?? ''}`,
    );
    const wrong = furtherRows(
      withFurther({
        actions: [],
        conduct: { declared: 'accept', picks: [carryOn], last: carryOn, status: 'wrong' },
      }),
      SET,
    );
    expect(wrong.map((r) => r.verdict)).toEqual(['Wrong']);
    expect(wrong[0]?.picks).toBe(`Picked: ${SET.option(carryOn)?.text ?? ''}`);
  });

  it('notes the emergency landing only when it is the final selection', () => {
    const kept = withFurther({
      actions: [],
      conduct: { declared: 'accept', picks: [carryOn, emergency], last: emergency, status: 'ok' },
    });
    expect(furtherNote(kept, SET)).toBe(SET.option(emergency)?.debriefNote ?? null);
    const switched = withFurther({
      actions: [],
      conduct: {
        declared: 'accept',
        picks: [carryOn, emergency, carryOn],
        last: carryOn,
        status: 'wrong',
      },
    });
    expect(furtherNote(switched, SET)).toBeNull();
    // The history heads with the preselected default (R-08).
    const rows = furtherRows(switched, SET);
    expect(rows[0]?.picks).toBe(
      `Picks in order: ${SET.option(carryOn)?.text ?? ''}, then ${SET.option(emergency)?.text ?? ''}, then ${SET.option(carryOn)?.text ?? ''}`,
    );
  });

  it('shows an action that was selected and cleared like one never selected', () => {
    const scenario = parseScenario(
      readFileSync(join(process.cwd(), 'scenarios/engine/eng-fire-in-flight.toon'), 'utf8'),
    );
    if (!scenario.ok) throw new Error('no scenario');
    const graded = (decisions: { t: number; id: string; on?: boolean }[]) =>
      furtherRows(
        grade(scenario.value, DA50RG_ENV, {
          scenarioId: scenario.value.id,
          completedAt: 20000,
          events: [],
          decisions,
        }),
        SET,
      ).find((r) => r.id === passengers);
    const never = graded([]);
    const cleared = graded([
      { t: 1000, id: passengers, on: true },
      { t: 2000, id: passengers, on: false },
    ]);
    expect(cleared).toEqual(never);
    expect(graded([{ t: 1000, id: passengers, on: true }])?.verdict).toBe('Done');
  });

  it('shows no conduct row for none without a pick, and a row marked Not graded with one', () => {
    const none = (picks: string[]) =>
      furtherRows(
        withFurther({
          actions: [],
          conduct: {
            declared: 'none',
            picks,
            last: picks.at(-1) ?? null,
            status: 'not_declared',
          },
        }),
        SET,
      );
    expect(none([])).toEqual([]);
    expect(none([carryOn]).map((r) => [r.role, r.verdict])).toEqual([[null, 'Not graded']]);
  });

  it('gives the note of the aircraft data only when the last conduct pick carries one', () => {
    const last = (id: string | null): GradeResult =>
      withFurther({
        actions: [],
        conduct: {
          declared: 'accept',
          picks: id === null ? [] : [id],
          last: id,
          status: 'ok',
        },
      });
    expect(furtherNote(last(emergency), SET)).toBe(SET.option(emergency)?.debriefNote);
    expect(furtherNote(last(emergency), SET)).not.toBeNull();
    expect(furtherNote(last(carryOn), SET)).toBeNull();
    expect(furtherNote(last(null), SET)).toBeNull();
  });
});

describe('checklistNote (plan 07-06, R-24)', () => {
  const own = { pack: 'engine', scenario: 'eng-oil-temp-green' };
  it('names the situation for a checklist that is not the situation own', () => {
    const line = checklistNote(
      { ref: { pack: 'electrical', scenario: 'elec-altn1-fail' } },
      own,
      'ENG OIL TEMP',
    );
    expect(line).toBe(
      'The situation was ENG OIL TEMP. The checklist you used belongs to another situation; the harmful actions below still list what was wrong for the real one.',
    );
  });

  it('is null for the own checklist, no choice and no opened scenario', () => {
    expect(checklistNote({ ref: { ...own } }, own, 'ENG OIL TEMP')).toBeNull();
    expect(checklistNote(null, own, 'ENG OIL TEMP')).toBeNull();
    expect(checklistNote({ ref: { pack: 'a', scenario: 'b' } }, null, 'X')).toBeNull();
  });

  it('treats the same scenario id in another pack as another checklist', () => {
    expect(
      checklistNote({ ref: { pack: 'locked', scenario: own.scenario } }, own, 'T'),
    ).not.toBeNull();
  });
});

// Plan 07-06 (R-22): the conduct note, outside the verdict, every branch of it.
describe('conductNote (plan 07-06, R-22)', () => {
  const SET = DA50RG_ENV.further;
  const NOTE = 'Continuing is fine under VFR only.';
  const AVOID = SET.avoidIds();
  const section = (note: string | undefined): FurtherSection => ({
    actions: [],
    conduct: { accept: [SET.noteConduct] },
    ...(note === undefined ? {} : { conduct_note: note }),
  });
  const withChoice = (last: string | null, chosen: readonly string[]): GradeResult =>
    result({
      further: {
        actions: chosen.map((id) => ({
          id,
          role: 'optional' as const,
          done: true,
          failsRun: false,
        })),
        conduct: { declared: 'accept', picks: last === null ? [] : [last], last, status: 'ok' },
      },
    });
  const text = (id: string): string => SET.option(id)?.text ?? id;

  it('shows the note and names every Avoid action not chosen when none was chosen', () => {
    const hint = conductNote(withChoice(SET.noteConduct, []), section(NOTE), SET);
    expect(hint).toEqual({
      tone: 'standard',
      lines: [NOTE, `Not chosen: ${AVOID.map(text).join(', ')}.`],
    });
    // The labels are the texts of the Avoid options.
    for (const id of AVOID) expect(hint?.lines.join(' ')).toContain(text(id));
  });

  it('names only the Avoid actions that are missing when some were chosen', () => {
    const [first, ...rest] = AVOID;
    const hint = conductNote(
      withChoice(SET.noteConduct, first === undefined ? [] : [first]),
      section(NOTE),
      SET,
    );
    expect(hint?.tone).toBe('standard');
    expect(hint?.lines).toEqual([NOTE, `Not chosen: ${rest.map(text).join(', ')}.`]);
  });

  it('shows a green line instead when all of them were chosen', () => {
    const hint = conductNote(withChoice(SET.noteConduct, AVOID), section(NOTE), SET);
    expect(hint?.tone).toBe('done');
    expect(hint?.lines).toEqual([
      `You also chose ${AVOID.slice(0, -1).map(text).join(', ')} and ${text(AVOID[AVOID.length - 1] ?? '')}, which fits continuing under VFR.`,
    ]);
  });

  it('shows nothing for another final conduct, no note, a result without a further part or no conduct', () => {
    const other = SET.ids('conduct').find((id) => id !== SET.noteConduct) ?? '';
    expect(conductNote(withChoice(other, []), section(NOTE), SET)).toBeNull();
    expect(conductNote(withChoice(SET.noteConduct, []), section(undefined), SET)).toBeNull();
    expect(conductNote(withChoice(SET.noteConduct, []), undefined, SET)).toBeNull();
    expect(conductNote(result({}), section(NOTE), SET)).toBeNull();
    expect(conductNote(withChoice(null, []), section(NOTE), SET)).toBeNull();
  });

  it('uses the final selection: an Avoid action chosen and then switched off is missing', () => {
    // The result lists an action with done false when it was declared or picked and then cleared.
    const result2 = result({
      further: {
        actions: AVOID.map((id, i) => ({
          id,
          role: 'optional' as const,
          done: i !== 0,
          failsRun: false,
        })),
        conduct: {
          declared: 'accept',
          picks: [SET.noteConduct],
          last: SET.noteConduct,
          status: 'ok',
        },
      },
    });
    expect(conductNote(result2, section(NOTE), SET)?.lines[1]).toBe(
      `Not chosen: ${text(AVOID[0] ?? '')}.`,
    );
  });
});
