import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MODE_HINTS, MODE_NAMES, TRAINING_NOTE } from '../src/ui/session';
import { parseScenario } from '../src/scenario/parse';
import type { ProcedureNode, Scenario, Step } from '../src/scenario/schema';
import { chooseScenario, pickMode, startRealistic, startScenario } from './support/session';
import { activate } from './support/zoom';

// SES-02 (phase 07, plan 07-01): Training and Exam are their own card before the level. A Training
// run has a HINT button that names the next open checklist step in the printed wording on a hint
// line, and a CHECKLIST button; an Exam run has neither. Expected wording is read from the shipped
// files in node, never typed here.

const ENGINE_ROW = 'engine.eng-oil-temp-green';
const FIRE_ROW = 'engine.eng-fire-in-flight';
const HINT = '[data-session-hit="session.hint"]';
const CHECKLIST = '[data-session-hit="session.checklist"]';
const MIN_BUTTON_PX = 44;

function scenarioFile(file: string): Scenario {
  const parsed = parseScenario(
    readFileSync(new URL(`../scenarios/${file}.toon`, import.meta.url), 'utf8'),
  );
  if (!parsed.ok) throw new Error(`${file} does not parse`);
  return parsed.value;
}

/** Every step in declared order, depth first. */
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

/** The steps of the scenario that are not optional, in declared order. */
function requiredSteps(scenario: Scenario): Step[] {
  return stepsOf(scenario.procedure).filter((step) => step.severity !== 'optional');
}

/** The hint line must show exactly what the file stores for the step: mark, text and action. */
async function expectHint(page: Page, step: Step): Promise<void> {
  await expect(page.getByTestId('hint-line')).toBeVisible();
  await expect(page.getByTestId('hint-text')).toHaveText(step.text);
  if (step.number === undefined) await expect(page.getByTestId('hint-mark')).toHaveCount(0);
  else await expect(page.getByTestId('hint-mark')).toHaveText(String(step.number));
  if (step.action === undefined) await expect(page.getByTestId('hint-action')).toHaveCount(0);
  else await expect(page.getByTestId('hint-action')).toHaveText(step.action);
}

type HookHost = { __panelSession?: { now(): number | null } };
function clockNow(page: Page): Promise<number | null> {
  return page.evaluate(() => (globalThis as HookHost).__panelSession?.now() ?? null);
}

type Box = { x: number; y: number; width: number; height: number };
const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);

test('the mode card comes before the level card and offers Training and Exam with their lines', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await chooseScenario(page, hasTouch, ENGINE_ROW);
  await expect(page.getByTestId('level-pick')).toHaveCount(0);
  await expect(page.getByTestId('mode-pick')).toBeVisible();
  await expect(page.getByTestId('mode-pick-training-hint')).toHaveText(MODE_HINTS.training);
  await expect(page.getByTestId('mode-pick-exam-hint')).toHaveText(MODE_HINTS.exam);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 0,
  );
  for (const id of ['mode-pick-training', 'mode-pick-exam']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_BUTTON_PX);
  }
  await pickMode(page, hasTouch, 'training');
  await expect(page.getByTestId('mode-pick')).toHaveCount(0);
  await expect(page.getByTestId('level-pick')).toBeVisible();
});

test('Back to panel on the mode card returns to the free panel', async ({ page, hasTouch }) => {
  await page.goto('./');
  await chooseScenario(page, hasTouch, ENGINE_ROW);
  await page.waitForTimeout(500);
  await activate(page.getByTestId('mode-pick-back'), hasTouch);
  await expect(page.getByTestId('mode-pick')).toHaveCount(0);
  await expect(page.locator('[data-session-view="main"]')).toHaveCount(1);
});

test('Training: HINT names the first open step as stored and a second press follows the progress', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  const [first, second] = requiredSteps(scenarioFile('engine/eng-oil-temp-green'));
  if (first === undefined || second === undefined) throw new Error('the file has no two steps');

  await startScenario(page, hasTouch, ENGINE_ROW, 'easy', 'training');
  await expect(page.locator('[data-session-view="run"]')).toHaveCount(1);
  await expect(page.getByTestId('hint-line')).toHaveCount(0);

  await activate(page.locator(HINT), hasTouch);
  await expectHint(page, first);

  // The golden step: POWER down to the 50 % marker; the hint line keeps its words until the next press.
  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p50');
  await expectHint(page, first);
  await activate(page.locator(HINT), hasTouch);
  await expectHint(page, second);

  // The hint is a strip over the windscreen that takes no press.
  await expect(page.getByTestId('hint-line')).toHaveCSS('pointer-events', 'none');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Training: HINT shows the printed row mark, text and action of a table checklist', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  const [first] = requiredSteps(scenarioFile('engine/eng-fire-in-flight'));
  if (first === undefined) throw new Error('the file has no required step');
  expect(first.number).not.toBeUndefined();
  expect(first.action).not.toBeUndefined();

  await startScenario(page, hasTouch, FIRE_ROW, 'easy', 'training');
  await activate(page.locator(HINT), hasTouch);
  await expectHint(page, first);
});

test('Exam: neither HINT nor CHECKLIST is drawn, the three session buttons are', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await startScenario(page, hasTouch, ENGINE_ROW, 'easy', 'exam');
  await expect(page.locator('[data-session-view="run"]')).toHaveCount(1);
  await expect(page.locator(HINT)).toHaveCount(0);
  await expect(page.locator(CHECKLIST)).toHaveCount(0);
  for (const id of ['session.new', 'session.choose', 'session.reset']) {
    await expect(page.locator(`[data-session-hit="${id}"]`)).toHaveCount(1);
  }
  await expect(page.getByTestId('hint-line')).toHaveCount(0);
});

test('@hooks Training on Medium: CHECKLIST shows the printed checklist in a non-modal sheet, the clock keeps running and the panel works', async ({
  page,
  hasTouch,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit' && hasTouch && process.platform === 'linux',
    'a touch tap on the CHECKLIST pad button is not delivered in Playwright WebKit on Linux (passes on macOS)',
  );
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  const scenario = scenarioFile('engine/eng-oil-temp-green');
  const steps = stepsOf(scenario.procedure);
  const head = scenario.checklist;

  await startScenario(page, hasTouch, ENGINE_ROW, 'medium', 'training');
  // Medium has no checklist in the briefing; the sheet is the way to see it.
  await expect(page.getByTestId('run-checklist')).toHaveCount(0);

  await activate(page.locator(CHECKLIST), hasTouch);
  const sheet = page.getByTestId('run-checklist');
  await expect(sheet).toBeVisible();
  if (head?.heading !== undefined) await expect(sheet).toContainText(head.heading);
  if (head?.message !== undefined) await expect(sheet).toContainText(head.message);
  for (const step of steps) await expect(sheet).toContainText(step.text);
  await expect(page.locator('[data-session-button="session.checklist"]')).toHaveAttribute(
    'data-pressed',
    'true',
  );
  // Not a modal: no dialog, the clock keeps advancing.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const before = await clockNow(page);
  await page.waitForTimeout(800);
  expect(await clockNow(page)).toBeGreaterThan((before ?? 0) + 400);

  // The sheet takes at most about 40 per cent of the panel area and stays above the footer.
  const area = await page.locator('.panel-area').boundingBox();
  const box = await sheet.boundingBox();
  const footer = await page.locator('footer').boundingBox();
  if (area === null || box === null || footer === null) throw new Error('no boxes');
  expect(box.width * box.height).toBeLessThanOrEqual(area.width * area.height * 0.41);
  expect(box.y + box.height).toBeLessThanOrEqual(footer.y + 1);

  // A panel control the sheet does not cover takes a press with the sheet open; otherwise it is hidden first.
  const overlaps = (hit: Box | null, other: Box): boolean =>
    hit !== null &&
    hit.x < other.x + other.width &&
    hit.x + hit.width > other.x &&
    hit.y < other.y + other.height &&
    hit.y + hit.height > other.y;
  const target = page.locator('[data-detent="lv.power:p50"]');
  const covered = overlaps(await target.boundingBox(), box);
  if (covered) await activate(page.getByTestId('run-checklist-hide'), hasTouch);
  await activate(target, hasTouch);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p50');
  if (covered) await activate(page.locator(CHECKLIST), hasTouch);
  await expect(sheet).toBeVisible();

  // A second tap on CHECKLIST hides the sheet (where the sheet leaves the button free; on a narrow
  // portrait phone the bottom sheet covers the pad, which is why the sheet has its own hide button),
  // the hide button hides it, Escape inside it hides it.
  const padCovered = overlaps(await page.locator(CHECKLIST).boundingBox(), box);
  if (!padCovered) {
    await activate(page.locator(CHECKLIST), hasTouch);
    await expect(sheet).toHaveCount(0);
    await activate(page.locator(CHECKLIST), hasTouch);
    await expect(sheet).toBeVisible();
  }
  await activate(page.getByTestId('run-checklist-hide'), hasTouch);
  await expect(sheet).toHaveCount(0);
  await activate(page.locator(CHECKLIST), hasTouch);
  await expect(sheet).toBeVisible();
  await page.getByTestId('run-checklist-body').focus();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
});

test('@hooks Training on Realistic: CHECKLIST stays shut until the onset, then shows the sheet', async ({
  page,
  hasTouch,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit' && hasTouch && process.platform === 'linux',
    'a touch tap on the CHECKLIST pad button is not delivered in Playwright WebKit on Linux (passes on macOS)',
  );
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await startRealistic(page, hasTouch, ENGINE_ROW, 'training');
  // The clean start: the sheet would name the situation, so the press shows nothing (WR-01).
  await activate(page.locator(CHECKLIST), hasTouch);
  await expect(page.getByTestId('run-checklist')).toHaveCount(0);
  await page.waitForFunction(() => {
    const host = globalThis as unknown as {
      __panelSession?: { now(): number | null; onset(): { at: number } | null };
    };
    const now = host.__panelSession?.now() ?? null;
    const onset = host.__panelSession?.onset() ?? null;
    return now !== null && onset !== null && now >= onset.at;
  });
  await activate(page.locator(CHECKLIST), hasTouch);
  await expect(page.getByTestId('run-checklist')).toBeVisible();
  // The title of the scenario is still not named on the page; the checklist is the printed one.
  await expect(page.getByTestId('run-checklist')).toContainText(
    scenarioFile('engine/eng-oil-temp-green').checklist?.heading ?? '',
  );
});

test('the sheet is gone when the run ends', async ({ page, hasTouch, browserName }) => {
  test.skip(
    browserName === 'webkit' && hasTouch && process.platform === 'linux',
    'a touch tap on the CHECKLIST pad button is not delivered in Playwright WebKit on Linux (passes on macOS)',
  );
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await startScenario(page, hasTouch, ENGINE_ROW, 'easy', 'training');
  await activate(page.locator(CHECKLIST), hasTouch);
  await expect(page.getByTestId('run-checklist')).toBeVisible();
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
  await expect(page.getByTestId('run-checklist')).toHaveCount(0);
});

for (const mode of ['training', 'exam'] as const) {
  test(`@hooks the briefing and the debrief name the mode: ${mode}`, async ({ page, hasTouch }) => {
    await page.goto('./');
    await expect(page.getByTestId('panel')).toBeVisible();
    await chooseScenario(page, hasTouch, ENGINE_ROW);
    await pickMode(page, hasTouch, mode);
    await page.waitForTimeout(450);
    await activate(page.getByTestId('level-pick-easy'), hasTouch);
    await expect(page.getByTestId('briefing')).toBeVisible();
    if (mode === 'training') {
      await expect(page.getByTestId('briefing-training')).toHaveText(TRAINING_NOTE);
      await expect(page.getByTestId('briefing-exam')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('briefing-exam')).toHaveText(
        'Exam mode: no hints. When you are done, press Procedure complete.',
      );
      await expect(page.getByTestId('briefing-training')).toHaveCount(0);
    }
    await activate(page.getByTestId('briefing-start'), hasTouch);
    await expect(page.getByTestId('procedure-complete')).toBeVisible();
    await activate(page.getByTestId('procedure-complete'), hasTouch);
    await expect(page.getByTestId('debrief-result')).toBeVisible();
    await expect(page.getByTestId('debrief-mode')).toHaveText(`Mode: ${MODE_NAMES[mode]}`);
    await expect(page.getByTestId('debrief-level')).toHaveText('Level: Easy');
  });
}
