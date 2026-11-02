import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseScenario } from '../src/scenario/parse';
import type { ProcedureNode, Scenario, Step } from '../src/scenario/schema';
import { chooseScenario, shippedScenarios, startRealistic, startScenario } from './support/session';
import { activate } from './support/zoom';

// SES-02 (phase 07, plans 07-04): there is no mode; every run has a CHECKLIST button whose sheet marks
// the steps already done in green, live. Expected wording is read from the shipped files in node,
// never typed here.

const ENGINE_ROW = 'engine.eng-oil-temp-green';
const CHECKLIST = '[data-session-hit="session.checklist"]';
const HINT = '[data-session-hit="session.hint"]';
const WEBKIT_LINUX_TOUCH =
  'a touch tap on the CHECKLIST pad button is not delivered in Playwright WebKit on Linux (passes on macOS)';

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

type HookHost = { __panelSession?: { now(): number | null } };
function clockNow(page: Page): Promise<number | null> {
  return page.evaluate(() => (globalThis as HookHost).__panelSession?.now() ?? null);
}

type Box = { x: number; y: number; width: number; height: number };
const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);
const overlaps = (hit: Box | null, other: Box): boolean =>
  hit !== null &&
  hit.x < other.x + other.width &&
  hit.x + hit.width > other.x &&
  hit.y < other.y + other.height &&
  hit.y + hit.height > other.y;

test('there is no mode card: the level card is the first card of a scenario', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await chooseScenario(page, hasTouch, ENGINE_ROW);
  await expect(page.getByTestId('level-pick')).toBeVisible();
  await expect(page.locator('[data-testid^="mode-"]')).toHaveCount(0);
  for (const level of ['easy', 'medium', 'realistic']) {
    await expect(page.getByTestId(`level-pick-${level}`)).toBeVisible();
  }
});

test('the briefing names how a run ends and the debrief names no mode', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await chooseScenario(page, hasTouch, ENGINE_ROW);
  await page.waitForTimeout(450);
  await activate(page.getByTestId('level-pick-easy'), hasTouch);
  await expect(page.getByTestId('briefing-note')).toHaveText(
    'When you are done, press Procedure complete.',
  );
  await activate(page.getByTestId('briefing-start'), hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
  await expect(page.getByTestId('debrief-level')).toHaveText('Level: Easy');
  await expect(page.getByText(/^Mode:/)).toHaveCount(0);
});

for (const level of ['easy', 'medium'] as const) {
  test(`@hooks ${level}: the CHECKLIST sheet shows the printed rows and marks a step Done as soon as it is done`, async ({
    page,
    hasTouch,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit' && hasTouch && process.platform === 'linux',
      WEBKIT_LINUX_TOUCH,
    );
    await page.goto('./');
    await expect(page.getByTestId('panel')).toBeVisible();
    const scenario = scenarioFile('engine/eng-oil-temp-green');
    const steps = stepsOf(scenario.procedure);
    const first = steps[0];
    if (first === undefined) throw new Error('the file has no step');
    const head = scenario.checklist;

    await startScenario(page, hasTouch, ENGINE_ROW, level);
    await expect(page.locator('[data-session-view="run"]')).toHaveCount(1);
    // No hint button exists on Easy and Medium (R-04).
    await expect(page.locator(HINT)).toHaveCount(0);
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
    // Nothing is done yet: no row is marked, and the sheet rows are not debrief rows.
    await expect(sheet.getByTestId('sheet-step')).toHaveCount(steps.length);
    await expect(sheet.locator('[data-testid="sheet-step"][data-verdict]')).toHaveCount(0);
    await expect(page.getByTestId('debrief-row')).toHaveCount(0);

    // Not a modal: no dialog, the clock keeps advancing.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const before = await clockNow(page);
    await page.waitForTimeout(800);
    expect(await clockNow(page)).toBeGreaterThan((before ?? 0) + 400);

    // Play the first step with the sheet open (a covered control is reached with the sheet hidden).
    const box = await sheet.boundingBox();
    if (box === null) throw new Error('the sheet has no box');
    const target = page.locator('[data-detent="lv.power:p50"]');
    const covered = overlaps(await target.boundingBox(), box);
    if (covered) await activate(page.getByTestId('run-checklist-hide'), hasTouch);
    await activate(target, hasTouch);
    await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p50');
    if (covered) await activate(page.locator(CHECKLIST), hasTouch);
    await expect(sheet).toBeVisible();

    // Exactly the first step is marked, in green, and the clock is still running.
    const done = sheet.locator('[data-testid="sheet-step"][data-verdict="Done"]');
    await expect(done).toHaveCount(1);
    await expect(done).toHaveAttribute('data-step-id', first.id);
    await expect(done).toContainText('Done');
    await expect(done.locator('.outline-verdict')).toHaveCSS('color', 'rgb(47, 211, 111)');
    expect(await clockNow(page)).toBeGreaterThan((before ?? 0) + 400);

    // A second tap on CHECKLIST hides the sheet where it leaves the button free; the hide button
    // hides it anywhere (on a narrow portrait phone the bottom sheet covers the pad).
    const padCovered = overlaps(await page.locator(CHECKLIST).boundingBox(), box);
    if (!padCovered) {
      await activate(page.locator(CHECKLIST), hasTouch);
      await expect(sheet).toHaveCount(0);
      await activate(page.locator(CHECKLIST), hasTouch);
      await expect(sheet).toBeVisible();
      // Shown again, the sheet is up to date at once.
      await expect(sheet.locator('[data-testid="sheet-step"][data-verdict="Done"]')).toHaveCount(1);
    }
    // The hide button ignores a click for the first 400 ms after the sheet appeared.
    await page.waitForTimeout(450);
    await activate(page.getByTestId('run-checklist-hide'), hasTouch);
    await expect(sheet).toHaveCount(0);
  });
}

/** The heading the list shows for a shipped scenario: the printed heading, else the title. */
function headingOfShipped(file: string, title: string): string {
  return scenarioFile(file).checklist?.heading ?? title;
}

/** The headings of all shipped checklists in listing order, derived in node from the files. */
function expectedHeadings(): string[] {
  return shippedScenarios().map((entry) =>
    headingOfShipped(`${entry.pack}/${entry.file}`, entry.title),
  );
}

/** Waits until the run clock stands at or past the onset of a Realistic run. */
async function afterOnset(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const host = globalThis as unknown as {
      __panelSession?: { now(): number | null; onset(): { at: number } | null };
    };
    const now = host.__panelSession?.now() ?? null;
    const onset = host.__panelSession?.onset() ?? null;
    return now !== null && onset !== null && now >= onset.at;
  });
}

const ENTRIES = '[data-testid="run-checklist-entry"]';
const entryOf = (page: Page, heading: string) =>
  page.locator(ENTRIES).filter({ hasText: heading }).first();

test('@hooks Realistic: CHOOSE CHECKLIST lists the headings of all checklists before the onset, none marked as the right one', async ({
  page,
  hasTouch,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit' && hasTouch && process.platform === 'linux',
    WEBKIT_LINUX_TOUCH,
  );
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await startRealistic(page, hasTouch, ENGINE_ROW);
  await expect(page.locator('[data-session-button="session.checklist"]')).toContainText(
    'CHOOSE CHECKLIST',
  );

  await activate(page.locator(CHECKLIST), hasTouch);
  await expect(page.getByTestId('run-checklist-list')).toBeVisible();
  await expect(page.locator(ENTRIES)).toHaveText(expectedHeadings());
  // Alike: no entry carries a mark, a state or a title of its own.
  const attrs = await page
    .locator(ENTRIES)
    .evaluateAll((nodes) => nodes.map((node) => node.getAttributeNames().sort().join(',')));
  expect(new Set(attrs).size).toBe(1);
  // Not a modal: no dialog.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // A second press hides the sheet where it leaves the button free; the hide button anywhere.
  await activate(page.getByTestId('run-checklist-hide'), hasTouch);
  await expect(page.getByTestId('run-checklist')).toHaveCount(0);
});

test('@hooks Realistic: the own checklist is marked after the onset, a foreign one never, the debrief names the last choice', async ({
  page,
  hasTouch,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit' && hasTouch && process.platform === 'linux',
    WEBKIT_LINUX_TOUCH,
  );
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  const own = scenarioFile('engine/eng-oil-temp-green');
  const ownHeading = own.checklist?.heading ?? own.title;
  const foreign = shippedScenarios().find((entry) => entry.row !== ENGINE_ROW);
  if (foreign === undefined) throw new Error('only one scenario is shipped');
  const foreignHeading = headingOfShipped(`${foreign.pack}/${foreign.file}`, foreign.title);
  expect(foreignHeading).not.toBe(ownHeading);
  const first = stepsOf(own.procedure)[0];
  if (first === undefined) throw new Error('the file has no step');

  await startRealistic(page, hasTouch, ENGINE_ROW);
  await activate(page.locator(CHECKLIST), hasTouch);
  await expect(page.locator(ENTRIES).first()).toBeVisible();

  // The own checklist, chosen after the onset and then the step done: exactly that row is green.
  await afterOnset(page);
  await activate(entryOf(page, ownHeading), hasTouch);
  await expect(page.getByTestId('run-checklist')).toContainText(own.checklist?.message ?? '');
  await expect(page.getByTestId('run-checklist-back')).toBeVisible();
  await expect(page.locator('[data-testid="sheet-step"][data-verdict]')).toHaveCount(0);
  await activate(page.getByTestId('run-checklist-hide'), hasTouch);
  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p50');
  // The press reopens the chosen checklist, not the list.
  await activate(page.locator(CHECKLIST), hasTouch);
  const done = page.locator('[data-testid="sheet-step"][data-verdict="Done"]');
  await expect(done).toHaveCount(1);
  await expect(done).toHaveAttribute('data-step-id', first.id);

  // A foreign checklist: its rows, nothing marked.
  await activate(page.getByTestId('run-checklist-back'), hasTouch);
  await activate(entryOf(page, foreignHeading), hasTouch);
  await expect(page.getByTestId('run-checklist')).toContainText(foreignHeading);
  await expect(page.locator('[data-testid="sheet-step"][data-verdict]')).toHaveCount(0);
  await expect(page.getByTestId('debrief-row')).toHaveCount(0);

  // The last choice is named in the debrief and the verdict is the grade of the panel alone.
  await activate(page.getByTestId('run-checklist-hide'), hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
  await expect(page.getByTestId('debrief-checklist')).toHaveText(
    `Checklist used: ${foreignHeading}`,
  );
});

test('@hooks Realistic: a run without a choice prints "Checklist used: none"; Easy prints no such line', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await startRealistic(page, hasTouch, ENGINE_ROW);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-checklist')).toHaveText('Checklist used: none');
  await activate(page.getByTestId('debrief-back'), hasTouch);

  await startScenario(page, hasTouch, ENGINE_ROW, 'easy');
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
  await expect(page.getByTestId('debrief-checklist')).toHaveCount(0);
});

test('@hooks Realistic: HINT shows the situation name and text of the file, a second press hides the box, and before the onset it does nothing', async ({
  page,
  hasTouch,
  browserName,
}) => {
  test.skip(
    browserName === 'webkit' && hasTouch && process.platform === 'linux',
    WEBKIT_LINUX_TOUCH,
  );
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  const scenario = scenarioFile('engine/eng-oil-temp-green');
  await startRealistic(page, hasTouch, ENGINE_ROW);

  // The clean start: the box would name the situation, so the press shows nothing.
  await activate(page.locator(HINT), hasTouch);
  await expect(page.getByTestId('hint-box')).toHaveCount(0);

  await afterOnset(page);
  await activate(page.locator(HINT), hasTouch);
  await expect(page.getByTestId('hint-box')).toBeVisible();
  await expect(page.getByTestId('hint-box-title')).toHaveText(scenario.title);
  await expect(page.getByTestId('hint-box-situation')).toHaveText(scenario.briefing.situation);
  await expect(page.locator('[data-session-button="session.hint"]')).toHaveAttribute(
    'data-pressed',
    'true',
  );
  // A box over the windscreen that takes no press; no dialog; the panel keeps working.
  await expect(page.getByTestId('hint-box')).toHaveCSS('pointer-events', 'none');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p50');

  await activate(page.locator(HINT), hasTouch);
  await expect(page.getByTestId('hint-box')).toHaveCount(0);

  // It is gone when the run ends.
  await activate(page.locator(HINT), hasTouch);
  await expect(page.getByTestId('hint-box')).toBeVisible();
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
  await expect(page.getByTestId('hint-box')).toHaveCount(0);
});

test('the sheet is gone when the run ends', async ({ page, hasTouch, browserName }) => {
  test.skip(
    browserName === 'webkit' && hasTouch && process.platform === 'linux',
    WEBKIT_LINUX_TOUCH,
  );
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await startScenario(page, hasTouch, ENGINE_ROW, 'easy');
  await activate(page.locator(CHECKLIST), hasTouch);
  await expect(page.getByTestId('run-checklist')).toBeVisible();
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
  await expect(page.getByTestId('run-checklist')).toHaveCount(0);
});

for (const level of ['easy', 'medium', 'realistic'] as const) {
  test(`${level}: LEAVE is drawn during a run, NEW, CHOOSE and RESET are not, and all three are back after leaving`, async ({
    page,
    hasTouch,
  }) => {
    await page.goto('./');
    await expect(page.getByTestId('panel')).toBeVisible();
    if (level === 'realistic') await startRealistic(page, hasTouch, ENGINE_ROW);
    else await startScenario(page, hasTouch, ENGINE_ROW, level);
    const free = ['session.new', 'session.choose', 'session.reset'];
    await expect(page.locator('[data-session-hit="session.leave"]')).toHaveCount(1);
    await expect(page.locator('[data-session-button="session.leave"]')).toContainText('LEAVE');
    for (const id of free) await expect(page.locator(`[data-session-hit="${id}"]`)).toHaveCount(0);
    // The hint button exists on Realistic only.
    await expect(page.locator(HINT)).toHaveCount(level === 'realistic' ? 1 : 0);

    // LEAVE asks through the leave-run confirm; Keep going leaves the run alone, Leave run goes.
    await activate(page.locator('[data-session-hit="session.leave"]'), hasTouch);
    await expect(page.getByTestId('leave-run-modal')).toBeVisible();
    await activate(page.getByTestId('leave-keep'), hasTouch);
    await expect(page.getByTestId('leave-run-modal')).toHaveCount(0);
    await expect(page.getByTestId('procedure-complete')).toBeVisible();
    await activate(page.locator('[data-session-hit="session.leave"]'), hasTouch);
    await activate(page.getByTestId('leave-leave'), hasTouch);
    await expect(page.getByTestId('procedure-complete')).toHaveCount(0);
    for (const id of free) await expect(page.locator(`[data-session-hit="${id}"]`)).toHaveCount(1);
    await expect(page.locator('[data-session-hit="session.leave"]')).toHaveCount(0);
  });
}
