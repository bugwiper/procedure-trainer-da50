import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { h } from 'preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { grade } from '../src/engine/grading';
import { parseScenario } from '../src/scenario/parse';
import { anyModalOpen, holdModal, releaseModal } from '../src/ui/modals';
import { Debrief } from '../src/ui/screens/Debrief';
import { INPUT_SHIELD_MS, Modal, isShielded, nextFocusIndex } from '../src/ui/screens/Modal';
import { expand, findElements, textOf } from './vnode-walk';

// The modal shell helpers, the modal registry and the debrief's use of the shell (plan 02-09,
// Table M1; U-12): pure cases in the node environment.

describe('isShielded', () => {
  it('is true up to 399 ms after opening and false from 400 ms', () => {
    expect(INPUT_SHIELD_MS).toBe(400);
    expect(isShielded(1000, 1000)).toBe(true);
    expect(isShielded(1000, 1399)).toBe(true);
    expect(isShielded(1000, 1400)).toBe(false);
    expect(isShielded(1000, 5000)).toBe(false);
  });
});

describe('nextFocusIndex', () => {
  it('wraps forward from the last to the first and backward from the first to the last', () => {
    expect(nextFocusIndex(2, 3, false)).toBe(0);
    expect(nextFocusIndex(0, 3, true)).toBe(2);
  });

  it('steps inside the list', () => {
    expect(nextFocusIndex(0, 3, false)).toBe(1);
    expect(nextFocusIndex(2, 3, true)).toBe(1);
  });

  it('enters the list from outside at the first or the last element', () => {
    expect(nextFocusIndex(-1, 3, false)).toBe(0);
    expect(nextFocusIndex(-1, 3, true)).toBe(2);
  });

  it('stays on a single element and has no target in an empty card', () => {
    expect(nextFocusIndex(0, 1, false)).toBe(0);
    expect(nextFocusIndex(0, 1, true)).toBe(0);
    expect(nextFocusIndex(-1, 0, false)).toBe(-1);
  });
});

describe('modal registry', () => {
  afterEach(() => {
    releaseModal('a');
    releaseModal('b');
  });

  it('stays open until every held id is released', () => {
    expect(anyModalOpen.value).toBe(false);
    holdModal('a');
    holdModal('b');
    expect(anyModalOpen.value).toBe(true);
    releaseModal('a');
    expect(anyModalOpen.value).toBe(true);
    releaseModal('b');
    expect(anyModalOpen.value).toBe(false);
  });

  it('holds an id once and ignores a release of an unknown id', () => {
    holdModal('a');
    holdModal('a');
    releaseModal('unknown');
    expect(anyModalOpen.value).toBe(true);
    releaseModal('a');
    expect(anyModalOpen.value).toBe(false);
  });
});

describe('Debrief on the shell', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const text = readFileSync(join(root, 'scenarios/engine/eng-oil-temp-green.toon'), 'utf8');
  const parsed = parseScenario(text);
  if (!parsed.ok) throw new Error('the blueprint scenario does not parse');
  const scenario = parsed.value;
  const result = grade(scenario, DA50RG_ENV, {
    scenarioId: scenario.id,
    completedAt: 0,
    events: [],
  });

  it('renders as a Modal with the debrief id and Escape as Back to panel', () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();
    const onNext = vi.fn();
    const vnode = Debrief({
      further: DA50RG_ENV.further,
      scenario,
      result,
      level: 'easy',
      checklistUsed: null,
      checklistNote: null,
      completedAt: 0,
      onClose,
      onRetry,
      onNext,
    });
    expect(vnode.type).toBe(Modal);
    const props = vnode.props as {
      id: string;
      labelledBy: string;
      layer?: string;
      onEscape: (() => void) | null;
      actions: { props: { children: ({ props: Record<string, unknown> } | null)[] } };
    };
    expect(props.id).toBe('debrief');
    expect(props.labelledBy).toBe('debrief-result');
    expect(props.layer).toBeUndefined();
    expect(props.onEscape).toBe(onClose);
    // Retry is the primary action (first), then Next situation; Back to panel runs the same close.
    // The follow-on slot between Retry and Next is empty: this scenario names no follow-on.
    const buttons = props.actions.props.children.flatMap((child) =>
      child === null ? [] : [child.props],
    );
    expect(buttons.map((b) => b['data-testid'])).toEqual([
      'debrief-retry',
      'debrief-next',
      'debrief-back',
    ]);
    expect(buttons[0]?.['onClick']).toBe(onRetry);
    expect(buttons[1]?.['onClick']).toBe(onNext);
    expect(buttons[2]?.['onClick']).toBe(onClose);
  });

  it('adds the follow-on button between Retry and Next situation when the scenario names one for the final conduct (Phase 9, D-02)', () => {
    const emergency = DA50RG_ENV.further.ids('conduct').at(-1);
    const text = DA50RG_ENV.further.option(emergency ?? '')?.followOn;
    if (emergency === undefined || text === undefined) throw new Error('no follow-on conduct');
    const target = { pack: 'engine', scenario: 'landing-fixture' };
    const landing: typeof scenario = {
      ...scenario,
      further: {
        actions: [],
        conduct: { accept: [emergency] },
        follow_on: { [emergency]: target },
      },
    };
    const landed = grade(landing, DA50RG_ENV, {
      scenarioId: landing.id,
      completedAt: 0,
      events: [],
      decisions: [{ t: 0, id: emergency, on: true }],
    });
    const onFollowOn = vi.fn();
    const vnode = Debrief({
      further: DA50RG_ENV.further,
      scenario: landing,
      result: landed,
      level: 'easy',
      checklistUsed: null,
      checklistNote: null,
      completedAt: 0,
      onClose: vi.fn(),
      onRetry: vi.fn(),
      onNext: vi.fn(),
      onFollowOn,
    });
    const props = vnode.props as {
      actions: { props: { children: ({ props: Record<string, unknown> } | null)[] } };
    };
    const buttons = props.actions.props.children.flatMap((child) =>
      child === null ? [] : [child.props],
    );
    expect(buttons.map((b) => b['data-testid'])).toEqual([
      'debrief-retry',
      'debrief-follow-on',
      'debrief-next',
      'debrief-back',
    ]);
    const button = buttons[1];
    expect(button?.['children']).toBe(text.label);
    expect(button?.['aria-label']).toBe(text.title);
    expect(button?.['title']).toBe(text.title);
    expect(button?.['class']).toBe('secondary-button');
    expect(button?.['onClick']).toBe(onFollowOn);
  });

  /** The text of the line "Checklist used: ..." the debrief prints, or null when it prints none. */
  function checklistLine(
    level: 'easy' | 'medium' | 'realistic',
    used: string | null,
    note: string | null = null,
    testId = 'debrief-checklist',
  ) {
    const vnode = Debrief({
      further: DA50RG_ENV.further,
      scenario,
      result,
      level,
      checklistUsed: used,
      checklistNote: note,
      completedAt: 0,
      onClose: vi.fn(),
      onRetry: vi.fn(),
      onNext: vi.fn(),
    });
    const tree = expand(h('div', null, (vnode.props as { children: never }).children));
    const lines = findElements(tree, (el) => el.props['data-testid'] === testId);
    return lines.length === 0 ? null : textOf(lines[0] ?? tree);
  }

  it('names the checklist used on Realistic only, and none when none was chosen (R-03)', () => {
    expect(checklistLine('realistic', 'ALTN 1 FAIL')).toBe('Checklist used: ALTN 1 FAIL');
    expect(checklistLine('realistic', null)).toBe('Checklist used: none');
    expect(checklistLine('easy', 'ALTN 1 FAIL')).toBeNull();
    expect(checklistLine('medium', null)).toBeNull();
  });

  it('prints the neutral checklist note on Realistic only, under the line, and nothing without a note (R-24)', () => {
    const NOTE = 'The situation was X. The checklist you used belongs to another situation.';
    const note = (level: 'easy' | 'medium' | 'realistic', text: string | null) =>
      checklistLine(level, 'ALTN 1 FAIL', text, 'debrief-checklist-note');
    expect(note('realistic', NOTE)).toBe(NOTE);
    expect(note('realistic', null)).toBeNull();
    expect(note('easy', NOTE)).toBeNull();
    expect(note('medium', NOTE)).toBeNull();
  });

  it('prints the finish text as one line only when the run ended at the finish (Phase 9, D-09)', () => {
    const landingText = readFileSync(
      join(root, 'tests/fixtures/scenarios/landing-fixture.toon'),
      'utf8',
    );
    const landing = parseScenario(landingText);
    if (!landing.ok) throw new Error('the landing fixture does not parse');
    const landed = grade(landing.value, DA50RG_ENV, {
      scenarioId: landing.value.id,
      completedAt: 0,
      events: [],
    });
    const lineOf = (ended: boolean | undefined, which = landing.value, graded = landed) => {
      const vnode = Debrief({
        further: DA50RG_ENV.further,
        scenario: which,
        result: graded,
        level: 'easy',
        checklistUsed: null,
        checklistNote: null,
        completedAt: 0,
        ...(ended === undefined ? {} : { endedByFinish: ended }),
        onClose: vi.fn(),
        onRetry: vi.fn(),
        onNext: vi.fn(),
      });
      const tree = expand(h('div', null, (vnode.props as { children: never }).children));
      const lines = findElements(tree, (el) => el.props['data-testid'] === 'debrief-finish');
      return lines.length === 0 ? null : textOf(lines[0] ?? tree);
    };
    expect(lineOf(true)).toBe('The aircraft reached the field');
    expect(lineOf(false)).toBeNull();
    expect(lineOf(undefined)).toBeNull();
    // A scenario with no finish prints none, whatever the flag says.
    expect(lineOf(true, scenario, result)).toBeNull();
  });
});
