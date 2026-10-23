import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { branchStatuses, grade } from '../src/engine/grading';
import type { GradeResult, StepVerdict } from '../src/engine/grading';
import { MAX_BRANCH_LEVELS, checkScenario } from '../src/scenario/lint';
import type { Scenario } from '../src/scenario/schema';
import { buildOutline, checklistHead, verdictOf } from '../src/ui/outline';
import type { OutlineBranch, OutlineItem, OutlineOrder, OutlineStep } from '../src/ui/outline';
import { PRINTED } from './checklist-reference';
import type { PrintedOutline, PrintedOutlineItem, PrintedTable } from './checklist-reference';
import { ChecklistHeading, ChecklistOutline } from '../src/ui/screens/ChecklistOutline';
import { expand, findElements, textOf } from './vnode-walk';
import type { El, Tree } from './vnode-walk';

// The outline contract (plan 02-11, Table O1, UI-SPEC "Checklist outline" test contract): a pure
// view-model test over the pocket-card fixture (a decision with two branches, a populated branch
// that does not apply, an open nested branch, 3 branch levels) and a DOM-shape test of the
// hook-free renderer. Branch statuses are the engine's; the view never evaluates a condition.

const root = fileURLToPath(new URL('../', import.meta.url));
const POCKET = readFileSync(join(root, 'tests/fixtures/scenarios/pocket-card.toon'), 'utf8');
const BLUEPRINT = readFileSync(join(root, 'scenarios/engine/eng-oil-temp-green.toon'), 'utf8');

function load(text: string): Scenario {
  const checked = checkScenario(text, DA50RG_ENV);
  if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
  return checked.scenario;
}

/** A text with one place replaced; the place must exist exactly once. */
function swap(text: string, from: string, to: string): string {
  expect(text.split(from).length - 1, `"${from}" occurs once`).toBe(1);
  return text.replace(from, () => to);
}

const ORDERED = readFileSync(join(root, 'tests/fixtures/scenarios/ordered-critical.toon'), 'utf8');
const pocket = load(POCKET);
const ordered = load(ORDERED);
const blueprint = load(BLUEPRINT);

function run(scenario: Scenario, events: { id: string; value: string }[]): GradeResult {
  return grade(scenario, DA50RG_ENV, {
    scenarioId: scenario.id,
    completedAt: 60000,
    events: events.map((e, i) => ({ t: i * 1000, ...e })),
  });
}

const GOLDEN = [
  { id: 'lv.power', value: 'p50' },
  { id: 'lv.cowl_flap', value: 'open' },
];

const briefingOf = (scenario: Scenario) =>
  buildOutline(scenario, branchStatuses(scenario, DA50RG_ENV), 'briefing');

function debriefOf(scenario: Scenario, result: GradeResult) {
  return buildOutline(scenario, result.branches, 'debrief', result);
}

// The independent walkers of the tests; none of them looks at a condition.
function everyItem(items: readonly OutlineItem[]): OutlineItem[] {
  return items.flatMap((item) => {
    if (item.kind === 'decision') return [item, ...everyItem(item.branches)];
    if (item.kind === 'branch') return [item, ...everyItem(item.children)];
    return [item];
  });
}

function branchByLabel(items: readonly OutlineItem[], label: string): OutlineBranch {
  const found = everyItem(items).find(
    (i): i is OutlineBranch => i.kind === 'branch' && i.label === label,
  );
  if (found === undefined) throw new Error(`no branch "${label}"`);
  return found;
}

function textsOf(items: readonly OutlineItem[]): string[] {
  return everyItem(items).map((i) => (i.kind === 'branch' ? i.label : i.text));
}

/** Most branches on one path through the model. */
function branchLevels(items: readonly OutlineItem[]): number {
  let best = 0;
  for (const item of items) {
    if (item.kind === 'decision') best = Math.max(best, branchLevels(item.branches));
    else if (item.kind === 'branch') best = Math.max(best, 1 + branchLevels(item.children));
  }
  return best;
}

/** Most nested lists on one path through the model: a decision and a branch each open one. */
function listLevels(items: readonly OutlineItem[]): number {
  let best = 0;
  for (const item of items) {
    if (item.kind === 'decision') best = Math.max(best, listLevels(item.branches));
    else if (item.kind === 'branch') best = Math.max(best, listLevels(item.children));
  }
  return 1 + best;
}

describe('the pocket-card fixture', () => {
  it('passes the scenario check (schema and lint)', () => {
    expect(checkScenario(POCKET, DA50RG_ENV).ok).toBe(true);
  });

  it('has a decision with two branches, a populated branch that does not apply and 3 branch levels', () => {
    expect(pocket.procedure).toHaveLength(1);
    const decision = pocket.procedure[0];
    expect(decision?.kind).toBe('decision');
    if (decision?.kind !== 'decision') return;
    expect(decision.branches.map((b) => b.label)).toEqual(['If too low:', 'If in green range:']);
    const tooLow = decision.branches[0];
    expect(tooLow?.nodes.map((n) => n.kind)).toEqual(['group', 'line']);
    // The engine, not the view, decides which branch applies.
    expect(branchStatuses(pocket, DA50RG_ENV).map((b) => [b.path, b.status])).toEqual([
      ['procedure.0.branches.0', 'not_applicable'],
      ['procedure.0.branches.1', 'applies'],
      ['procedure.0.branches.1.nodes.3', 'open'],
      ['procedure.0.branches.1.nodes.3.nodes.1.branches.0', 'open'],
    ]);
    expect(branchLevels(briefingOf(pocket))).toBe(MAX_BRANCH_LEVELS);
  });
});

describe('buildOutline, briefing form', () => {
  const outline = briefingOf(pocket);

  it('lists the steps of the applying groups as plain steps, none of the branch that does not apply', () => {
    const steps = everyItem(outline).filter((i): i is OutlineStep => i.kind === 'step');
    expect(steps.map((s) => s.text)).toEqual(['Reduce power', 'Open cowl flap']);
    // No tag, no verdict, not muted: a plain checklist line.
    for (const step of steps) {
      expect(step.tag).toBeNull();
      expect(step.verdict).toBeNull();
      expect(step.muted).toBe(false);
    }
    const texts = textsOf(outline);
    for (const hidden of ['Reduce power at once', 'Open cowl flap fully']) {
      expect(texts).not.toContain(hidden);
    }
  });

  it('has no order item and no "Not graded" note, also for an ordered group', () => {
    const items = everyItem(briefingOf(ordered));
    expect(items.filter((i) => i.kind === 'order')).toEqual([]);
    expect(items.some((i) => i.kind === 'step')).toBe(true);
  });

  it('lists the label of the branch that does not apply without any child', () => {
    const tooLow = branchByLabel(outline, 'If too low:');
    expect(tooLow.status).toBe('not_applicable');
    expect(tooLow.children).toEqual([]);
    expect(textsOf(outline)).not.toContain('Prepare for an engine failure');
  });

  it('lists the applying branch and the open nested content, in declared order', () => {
    expect(branchByLabel(outline, 'If in green range:').status).toBe('applies');
    expect(branchByLabel(outline, 'If not returning to green range:').status).toBe('open');
    expect(textsOf(outline)).toEqual([
      'Check oil pressure',
      'If too low:',
      'If in green range:',
      'Reduce power',
      'Open cowl flap',
      'Increase airspeed',
      'Check oil temp in green range',
      'If not returning to green range:',
      'Land at nearest suitable airfield',
      'Check oil temp again',
      'If still red:',
      'Prepare for a precautionary landing',
    ]);
  });

  it('prints no "Not graded" note and mutes nothing', () => {
    for (const item of everyItem(outline)) {
      if (item.kind === 'line' || item.kind === 'decision') {
        expect(item.notGraded).toBe(false);
        expect(item.muted).toBe(false);
      }
    }
  });

  it('shows the shipped blueprint as the pocket card of the first scenario', () => {
    expect(textsOf(briefingOf(blueprint))).toEqual([
      'Check oil pressure',
      'If too low:',
      'If in green range:',
      'Reduce power',
      'Open cowl flap',
      'Increase airspeed',
      'Check oil temp in green range',
      'If not returning to green range:',
      'land at nearest suitable airfield',
    ]);
    expect(branchByLabel(briefingOf(blueprint), 'If too low:').status).toBe('not_applicable');
  });

  it('hides the four printed lines of the too low branch of the blueprint in the briefing', () => {
    const tooLow = branchByLabel(briefingOf(blueprint), 'If too low:');
    expect(tooLow.children).toEqual([]);
    expect(textsOf(briefingOf(blueprint))).not.toContain('Be prepared for emergency landing');
  });

  it('needs no grade result, and the debrief form refuses to build without one', () => {
    expect(() => buildOutline(pocket, branchStatuses(pocket, DA50RG_ENV), 'debrief')).toThrow(
      'grade result',
    );
  });

  it('refuses a branch list that misses a path of the procedure', () => {
    expect(() => buildOutline(pocket, [], 'briefing')).toThrow('no branch status');
  });
});

describe('buildOutline, debrief form of the blueprint', () => {
  it('lists the four printed lines of the too low branch muted and not graded', () => {
    const outline = debriefOf(blueprint, run(blueprint, GOLDEN));
    const tooLow = branchByLabel(outline, 'If too low:');
    expect(tooLow.status).toBe('not_applicable');
    expect(tooLow.children.map((c) => (c.kind === 'line' ? c.text : null))).toEqual([
      'Reduce power',
      'Open cowl flap',
      'Be prepared for loss of oil and engine failure',
      'Be prepared for emergency landing',
    ]);
    for (const child of tooLow.children) {
      expect(child).toMatchObject({ kind: 'line', muted: true });
    }
    // The graded steps of the branch that applies are the only step rows.
    const steps = everyItem(outline).filter((i): i is OutlineStep => i.kind === 'step');
    expect(steps.map((s) => s.id)).toEqual(['reduce_power', 'open_cowl_flap']);
  });
});

describe('buildOutline, debrief form', () => {
  const golden = run(pocket, GOLDEN);
  const outline = debriefOf(pocket, golden);
  const steps = everyItem(outline).filter((i): i is OutlineStep => i.kind === 'step');

  it('gives the applying steps a severity tag and Done when credited', () => {
    const graded = steps.filter((s) => !s.muted);
    expect(graded.map((s) => [s.id, s.tag, s.verdict?.word])).toEqual([
      ['reduce_power', 'CRITICAL', 'Done'],
      ['open_cowl_flap', 'CRITICAL', 'Done'],
    ]);
    expect(graded.every((s) => s.verdict?.tone === 'done')).toBe(true);
  });

  it('maps a missed critical step to Missed', () => {
    const doNothing = debriefOf(pocket, run(pocket, []));
    const graded = everyItem(doNothing).filter(
      (i): i is OutlineStep => i.kind === 'step' && !i.muted,
    );
    expect(graded.map((s) => [s.id, s.verdict?.word, s.verdict?.tone])).toEqual([
      ['reduce_power', 'Missed', 'critical'],
      ['open_cowl_flap', 'Missed', 'critical'],
    ]);
  });

  it('maps standard and optional steps from the severity of the scenario', () => {
    const standard = load(
      swap(
        POCKET,
        'id: open_cowl_flap\n                severity: critical',
        'id: open_cowl_flap\n                severity: standard',
      ),
    );
    const optional = load(
      swap(
        POCKET,
        'id: open_cowl_flap\n                severity: critical',
        'id: open_cowl_flap\n                severity: optional',
      ),
    );
    const rowOf = (scenario: Scenario) =>
      everyItem(debriefOf(scenario, run(scenario, [])))
        .filter((i): i is OutlineStep => i.kind === 'step')
        .find((s) => s.id === 'open_cowl_flap');
    expect(rowOf(standard)).toMatchObject({
      tag: 'STANDARD',
      verdict: { word: 'Missed', tone: 'standard' },
    });
    expect(rowOf(optional)).toMatchObject({
      tag: 'OPTIONAL',
      verdict: { word: 'Not done', tone: 'neutral' },
    });
  });

  it('verdictOf follows credited and severity', () => {
    const base: StepVerdict = {
      id: 's',
      group: 'g',
      severity: 'critical',
      credited: true,
      enteredAt: 0,
    };
    expect(verdictOf(base)).toEqual({ word: 'Done', tone: 'done' });
    expect(verdictOf({ ...base, severity: 'optional' })).toEqual({ word: 'Done', tone: 'done' });
    expect(verdictOf({ ...base, credited: false, enteredAt: null })).toEqual({
      word: 'Missed',
      tone: 'critical',
    });
    expect(verdictOf({ ...base, severity: 'standard', credited: false, enteredAt: null })).toEqual({
      word: 'Missed',
      tone: 'standard',
    });
    expect(verdictOf({ ...base, severity: 'optional', credited: false, enteredAt: null })).toEqual({
      word: 'Not done',
      tone: 'neutral',
    });
  });

  it('mutes the children of the branch that does not apply, without tag or verdict', () => {
    const tooLow = branchByLabel(outline, 'If too low:');
    expect(tooLow.status).toBe('not_applicable');
    expect(tooLow.children.map((c) => c.kind)).toEqual(['step', 'step', 'line']);
    for (const child of tooLow.children) {
      if (child.kind === 'step') {
        expect(child).toMatchObject({ muted: true, tag: null, verdict: null });
      } else if (child.kind === 'line') {
        expect(child).toMatchObject({ muted: true, notGraded: false });
      }
    }
    // Those steps are not graded in this run: the result holds no verdict for them.
    expect(golden.steps.map((s) => s.id)).toEqual(['reduce_power', 'open_cowl_flap']);
  });

  it('puts the steps of a group at the level of the group', () => {
    const green = branchByLabel(outline, 'If in green range:');
    expect(green.children.map((c) => (c.kind === 'step' ? c.id : c.kind))).toEqual([
      'reduce_power',
      'open_cowl_flap',
      'line',
      'line',
      'branch',
    ]);
  });

  it('marks the decision and the non-graded lines "Not graded", the open branch included', () => {
    const open = branchByLabel(outline, 'If not returning to green range:');
    expect(open.status).toBe('open');
    const lines = everyItem(open.children).filter(
      (i) => i.kind === 'line' || i.kind === 'decision',
    );
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      if (line.kind === 'line' || line.kind === 'decision') {
        expect(line).toMatchObject({ notGraded: true, muted: false });
      }
    }
    const decision = outline[0];
    expect(decision).toMatchObject({
      kind: 'decision',
      text: 'Check oil pressure',
      notGraded: true,
    });
  });
});

describe('buildOutline, order lines of an ordered group (D-16, SCN-04)', () => {
  const orderLines = (items: readonly OutlineItem[]) =>
    everyItem(items).filter((i): i is OutlineOrder => i.kind === 'order');

  it('names both step texts when the order was wrong', () => {
    // The cowl flap first, then power: the declared order was power first.
    const wrong = run(ordered, [
      { id: 'lv.cowl_flap', value: 'open' },
      { id: 'lv.power', value: 'p60' },
    ]);
    const lines = orderLines(debriefOf(ordered, wrong));
    expect(lines.map((l) => [l.text, l.kept])).toEqual([
      ['Order wrong: Reduce power was expected before Open cowl flap', false],
    ]);
  });

  it('sits right after the steps of its group', () => {
    const wrong = run(ordered, [
      { id: 'lv.cowl_flap', value: 'open' },
      { id: 'lv.power', value: 'p60' },
    ]);
    const green = branchByLabel(debriefOf(ordered, wrong), 'If in green range:');
    expect(green.children.map((c) => (c.kind === 'step' ? c.id : c.kind))).toEqual([
      'reduce_power',
      'open_cowl_flap',
      'order',
      'line',
    ]);
  });

  it('says Order kept when the order was right', () => {
    const right = run(ordered, [
      { id: 'lv.power', value: 'p60' },
      { id: 'lv.cowl_flap', value: 'open' },
    ]);
    expect(orderLines(debriefOf(ordered, right)).map((l) => [l.text, l.kept])).toEqual([
      ['Order kept', true],
    ]);
  });

  it('has none for an unordered group and none in the briefing', () => {
    expect(orderLines(debriefOf(pocket, run(pocket, GOLDEN)))).toEqual([]);
    expect(orderLines(debriefOf(blueprint, run(blueprint, GOLDEN)))).toEqual([]);
    expect(orderLines(briefingOf(ordered))).toEqual([]);
  });

  it('renders as a meta line under the steps of the group', () => {
    const wrong = run(ordered, [
      { id: 'lv.cowl_flap', value: 'open' },
      { id: 'lv.power', value: 'p60' },
    ]);
    const tree = expand(ChecklistOutline({ items: debriefOf(ordered, wrong) }));
    const rows = findElements(tree, (el) => el.props['data-kind'] === 'order');
    expect(rows).toHaveLength(1);
    expect(textOf(rows[0] ?? tree)).toBe(
      'Order wrong: Reduce power was expected before Open cowl flap',
    );
    // An order line is not a graded step row.
    expect(findElements(tree, (el) => el.props['data-testid'] === 'debrief-row')).toHaveLength(2);
  });
});

// The renderer, expanded without a DOM.

function ulDepth(tree: Tree): number {
  if (typeof tree === 'string') return 0;
  const inner = Math.max(0, ...tree.children.map(ulDepth));
  return inner + (tree.tag === 'ul' ? 1 : 0);
}

/** The branch rows of the tree: `li` elements marked as branches. */
function branchRows(tree: El): El[] {
  return findElements(tree, (el) => el.tag === 'li' && el.props['data-kind'] === 'branch');
}

function rowFor(tree: El, label: string): El {
  const found = branchRows(tree).find((li) => {
    const row = li.children.find((c): c is El => typeof c !== 'string' && c.tag === 'div');
    return row !== undefined && textOf(row).startsWith(label);
  });
  if (found === undefined) throw new Error(`no row for "${label}"`);
  return found;
}

describe('ChecklistOutline', () => {
  it('nests lists as deep as the model: a decision and a branch each open one', () => {
    for (const items of [briefingOf(pocket), debriefOf(pocket, run(pocket, GOLDEN))]) {
      const tree = expand(ChecklistOutline({ items }));
      expect(ulDepth(tree)).toBe(listLevels(items));
    }
    // Pocket card: root, the branches of the decision, 3 branch levels and one more decision.
    expect(listLevels(briefingOf(pocket))).toBe(6);
    expect(listLevels(briefingOf(blueprint))).toBe(4);
  });

  it('prints "Not applicable" right after the label of the branch that does not apply', () => {
    const tree = expand(ChecklistOutline({ items: briefingOf(pocket) }));
    const tooLow = rowFor(tree, 'If too low:');
    expect(textOf(tooLow)).toBe('If too low: Not applicable');
    // No child list at all in the briefing.
    expect(findElements(tooLow, (el) => el.tag === 'ul')).toHaveLength(0);
    const green = rowFor(tree, 'If in green range:');
    expect(textOf(findElements(green, (el) => el.tag === 'div')[0] ?? green)).toBe(
      'If in green range:',
    );
  });

  it('renders a briefing step as its text only: no tag, no verdict word, no debrief-row', () => {
    const tree = expand(ChecklistOutline({ items: briefingOf(pocket) }));
    const text = textOf(tree);
    for (const word of ['CRITICAL', 'STANDARD', 'OPTIONAL', 'Done', 'Missed', 'Not graded']) {
      expect(text).not.toContain(word);
    }
    expect(text).toContain('Reduce power');
    expect(text).toContain('Open cowl flap');
    expect(findElements(tree, (el) => el.props['data-testid'] === 'debrief-row')).toHaveLength(0);
    const steps = findElements(tree, (el) => el.props['data-kind'] === 'step');
    expect(steps.map((el) => textOf(el))).toEqual(['Reduce power', 'Open cowl flap']);
    expect(text).toContain('Check oil pressure');
    expect(text).toContain('Land at nearest suitable airfield');
  });

  it('renders the debrief form with tags, verdicts, the muted children and "Not graded"', () => {
    const tree = expand(ChecklistOutline({ items: debriefOf(pocket, run(pocket, GOLDEN)) }));
    const rows = findElements(tree, (el) => el.props['data-testid'] === 'debrief-row');
    expect(rows.map((r) => [r.props['data-step-id'], r.props['data-verdict']])).toEqual([
      ['reduce_power', 'Done'],
      ['open_cowl_flap', 'Done'],
    ]);
    expect(rows.map((r) => r.props['aria-label'])).toEqual([
      'CRITICAL, Reduce power, Done',
      'CRITICAL, Open cowl flap, Done',
    ]);
    const tooLow = rowFor(tree, 'If too low:');
    const muted = findElements(tooLow, (el) => el.props['data-muted'] === 'true');
    expect(muted).toHaveLength(3);
    const mutedText = textOf(tooLow);
    expect(mutedText).toContain('Reduce power at once');
    for (const word of ['CRITICAL', 'Done', 'Missed', 'Not graded']) {
      expect(mutedText).not.toContain(word);
    }
    const all = textOf(tree);
    expect(all.match(/Not graded/g)?.length).toBe(
      // the decision, two lines, the nested line, the nested decision and the line in its branch
      6,
    );
  });

  it('wraps nothing but text: scenario strings are text children, never markup', () => {
    const hostile = swap(POCKET, 'text: Increase airspeed', 'text: "<img src=x onerror=alert(1)>"');
    const scenario = load(hostile);
    const tree = expand(ChecklistOutline({ items: briefingOf(scenario) }));
    expect(findElements(tree, (el) => el.tag === 'img')).toHaveLength(0);
    expect(textOf(tree)).toContain('<img src=x onerror=alert(1)>');

    // A step text is hostile too, now that the briefing lists the steps.
    const hostileStep = swap(
      POCKET,
      'text: Open cowl flap\n',
      'text: "<img src=x onerror=alert(2)>"\n',
    );
    const stepTree = expand(ChecklistOutline({ items: briefingOf(load(hostileStep)) }));
    expect(findElements(stepTree, (el) => el.tag === 'img')).toHaveLength(0);
    expect(textOf(stepTree)).toContain('<img src=x onerror=alert(2)>');
  });
});

describe('no flat step list', () => {
  it('no view reads the flat list of step verdicts', () => {
    for (const file of [
      'src/ui/outline.ts',
      'src/ui/screens/ChecklistOutline.tsx',
      'src/ui/screens/Briefing.tsx',
      'src/ui/screens/Debrief.tsx',
    ]) {
      const source = readFileSync(join(root, file), 'utf8');
      expect(source, file).not.toMatch(/\.steps\.(map|forEach|filter|flatMap)\(/);
    }
  });

  it('the debrief renders through the outline', () => {
    const source = readFileSync(join(root, 'src/ui/screens/Debrief.tsx'), 'utf8');
    expect(source).toContain('ChecklistOutline');
    expect(source).toContain('buildOutline');
  });
});

// The printed table (plan 03-14, owner decision 2026-10-23): the view model and the renderer of the
// shipped ALTN 1 FAIL file against the independent printed reference of tests/checklist-reference.ts.

const ALTN1 = load(readFileSync(join(root, 'scenarios/electrical/elec-altn1-fail.toon'), 'utf8'));
const ALTN1_PRINTED = PRINTED['elec-altn1-fail'] as PrintedTable;

/** The class names of an element of the expanded tree. */
function classesOf(el: El): string[] {
  const value = el.props['class'];
  return typeof value === 'string' ? value.split(' ') : [];
}

describe('the printed table of ALTN 1 FAIL', () => {
  const items = briefingOf(ALTN1);

  it('names the form, the printed heading and the message tag from the data', () => {
    expect(checklistHead(ALTN1)).toEqual({
      form: 'table',
      heading: ALTN1_PRINTED.heading,
      ...(ALTN1_PRINTED.message === undefined ? {} : { message: ALTN1_PRINTED.message }),
    });
    // A scenario without a checklist block is an unadorned outline with no heading keys.
    expect(checklistHead(pocket)).toEqual({ form: 'outline' });
  });

  it('lists the rows in the printed order with their numbers, texts and actions', () => {
    const shown = items.map((item) => {
      if (item.kind === 'comment') return { kind: 'comment', text: item.text };
      if (item.kind !== 'line' && item.kind !== 'step') throw new Error(`unexpected ${item.kind}`);
      return { kind: 'row', number: item.number, item: item.text, action: item.action };
    });
    const printed = ALTN1_PRINTED.rows.map((row) =>
      row.kind === 'comment'
        ? { kind: 'comment', text: row.text }
        : { kind: 'row', number: row.number, item: row.item, action: row.action },
    );
    expect(shown).toEqual(printed);
  });

  it('carries no marker and no boxed comment, and keeps the graded steps as steps', () => {
    for (const item of items) {
      expect('marker' in item).toBe(false);
      if (item.kind === 'comment') expect('boxed' in item).toBe(false);
    }
    expect(items.filter((i): i is OutlineStep => i.kind === 'step').map((i) => i.id)).toEqual([
      'alt1_breaker_in',
      'alt1_off',
      'ess_bus_on',
    ]);
  });

  it('renders number, text, leader and action per row and comment rows without a number', () => {
    const tree = expand(ChecklistOutline({ items, form: 'table' }));
    const rows = findElements(
      tree,
      (el) =>
        el.tag === 'li' && (el.props['data-kind'] === 'line' || el.props['data-kind'] === 'step'),
    );
    expect(rows).toHaveLength(4);
    const cell = (row: El, name: string) => findElements(row, (el) => classesOf(el).includes(name));
    for (const [i, row] of rows.entries()) {
      const printed = ALTN1_PRINTED.rows.filter((r) => r.kind === 'row')[i];
      expect(textOf(cell(row, 'outline-number')[0] ?? row)).toBe(String(printed?.number));
      expect(cell(row, 'outline-text')).toHaveLength(1);
      const leader = cell(row, 'outline-leader');
      expect(leader).toHaveLength(1);
      expect(leader[0]?.props['aria-hidden']).toBe('true');
      expect(textOf(cell(row, 'outline-action')[0] ?? row)).toBe(printed?.action);
    }
    const comments = findElements(tree, (el) => el.props['data-kind'] === 'comment');
    expect(comments.map((c) => textOf(c))).toEqual(
      ALTN1_PRINTED.rows.flatMap((r) => (r.kind === 'comment' ? [r.text] : [])),
    );
    for (const comment of comments) {
      expect(findElements(comment, (el) => classesOf(el).includes('outline-number'))).toHaveLength(
        0,
      );
      expect(comment.props['data-boxed']).toBeUndefined();
    }
    expect(classesOf(tree)).toContain('outline-table');
  });
});

describe('the debrief of the printed table', () => {
  const result = run(ALTN1, []);
  const items = debriefOf(ALTN1, result);
  const tree = expand(ChecklistOutline({ items, form: 'table' }));
  const rows = findElements(
    tree,
    (el) =>
      el.tag === 'li' && (el.props['data-kind'] === 'line' || el.props['data-kind'] === 'step'),
  );
  const byClass = (el: El, name: string) => findElements(el, (e) => classesOf(e).includes(name));

  it('keeps the test id, the severity tag and the verdict word of a graded row', () => {
    const graded = findElements(tree, (el) => el.props['data-testid'] === 'debrief-row');
    expect(graded.map((r) => [r.props['data-step-id'], r.props['data-verdict']])).toEqual([
      ['alt1_off', 'Missed'],
      ['ess_bus_on', 'Missed'],
    ]);
    for (const row of graded) {
      expect(byClass(row, 'outline-tag').map((t) => textOf(t))).toEqual(['CRITICAL']);
      expect(byClass(row, 'outline-verdict').map((v) => textOf(v))).toEqual(['Missed']);
      expect(byClass(row, 'outline-number')).toHaveLength(1);
      expect(byClass(row, 'outline-action')).toHaveLength(1);
      expect(textOf(row)).not.toContain('Not graded');
    }
  });

  it('says Not graded on the rows that are not panel actions, and only there', () => {
    expect(rows).toHaveLength(4);
    const notGraded = rows.filter((r) => textOf(r).includes('Not graded'));
    expect(notGraded.map((r) => textOf(byClass(r, 'outline-number')[0] ?? r))).toEqual(['4']);
    for (const row of notGraded) expect(byClass(row, 'outline-verdict')).toHaveLength(0);
  });

  it('shows row 1 muted, without tag or verdict, when the drawn cause does not grade it', () => {
    // The recording names no variant, so it grades as the first one, which does not grade row 1.
    const first = rows.find((r) => textOf(byClass(r, 'outline-number')[0] ?? r) === '1');
    expect(first?.props['data-muted']).toBe('true');
    expect(byClass(first ?? tree, 'outline-tag')).toHaveLength(0);
    expect(byClass(first ?? tree, 'outline-verdict')).toHaveLength(0);
    expect(textOf(first ?? tree)).not.toContain('Not graded');
  });

  it('gives a comment row no tag, no verdict and no Not graded', () => {
    const comments = findElements(tree, (el) => el.props['data-kind'] === 'comment');
    expect(comments).toHaveLength(2);
    for (const comment of comments) {
      for (const word of ['CRITICAL', 'Done', 'Missed', 'Not graded']) {
        expect(textOf(comment)).not.toContain(word);
      }
    }
  });
});

// The marked outline of ENG OIL TEMP against the printed markers.

const OIL_PRINTED = PRINTED['eng-oil-temp-green'] as PrintedOutline;

/** The printed markers in reading order; the children of items for which `hide` is true are left out. */
function printedMarkers(
  list: readonly PrintedOutlineItem[],
  hide: (item: PrintedOutlineItem) => boolean,
): (string | undefined)[] {
  return list.flatMap((item) => [
    item.marker,
    ...(item.children === undefined || hide(item) ? [] : printedMarkers(item.children, hide)),
  ]);
}

describe('the printed markers of ENG OIL TEMP', () => {
  const drawn = (tree: El) =>
    findElements(tree, (el) => el.tag === 'svg' && classesOf(el).includes('outline-marker'));

  it('draws, in the briefing, the printed markers of the items that are shown', () => {
    const tree = expand(ChecklistOutline({ items: briefingOf(blueprint) }));
    // The branch that does not apply keeps its own marker and shows no children.
    const hidden = (item: PrintedOutlineItem) => item.marker === 'diamond_arrow';
    const expected = printedMarkers(OIL_PRINTED.items, hidden).filter((m) => m !== undefined);
    expect(drawn(tree).map((el) => el.props['data-marker'])).toEqual(expected);
    expect(ulDepth(tree)).toBe(listLevels(briefingOf(blueprint)));
  });

  it('draws, in the debrief, every printed marker and none for the continuation line', () => {
    const items = debriefOf(blueprint, run(blueprint, GOLDEN));
    const tree = expand(ChecklistOutline({ items }));
    const expected = printedMarkers(OIL_PRINTED.items, () => false).filter((m) => m !== undefined);
    expect(drawn(tree).map((el) => el.props['data-marker'])).toEqual(expected);
    const without = findElements(
      tree,
      (el) => el.tag === 'div' && classesOf(el).includes('outline-row') && drawn(el).length === 0,
    ).filter((row) => textOf(row).includes('Be prepared for emergency landing'));
    expect(without).toHaveLength(1);
    // It lines up with its marked siblings.
    expect(classesOf(without[0] ?? tree)).toContain('outline-nomarker');
  });

  it('is aria-hidden display only: a marker has no text and no title', () => {
    const tree = expand(ChecklistOutline({ items: briefingOf(blueprint) }));
    for (const marker of drawn(tree)) {
      expect(marker.props['aria-hidden']).toBe('true');
      expect(textOf(marker)).toBe('');
    }
  });

  it('draws no marker in the table form', () => {
    const tree = expand(ChecklistOutline({ items: briefingOf(ALTN1), form: 'table' }));
    expect(drawn(tree)).toHaveLength(0);
  });

  it('shows the printed heading band only for a scenario that declares a heading', () => {
    const head = checklistHead(blueprint);
    const band = expand(ChecklistHeading({ heading: head.heading, message: head.message }));
    expect(textOf(band)).toBe(`${OIL_PRINTED.heading} ${OIL_PRINTED.message ?? ''}`.trim());
    expect(ChecklistHeading({ heading: undefined, message: undefined })).toBeNull();
  });
});
