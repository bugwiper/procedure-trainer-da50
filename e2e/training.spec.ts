import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MODE_HINTS } from '../src/ui/session';
import { parseScenario } from '../src/scenario/parse';
import type { ProcedureNode, Scenario, Step } from '../src/scenario/schema';
import { chooseScenario, pickMode, startScenario } from './support/session';
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
