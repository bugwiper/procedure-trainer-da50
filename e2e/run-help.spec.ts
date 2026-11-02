import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { parseScenario } from '../src/scenario/parse';
import type { ProcedureNode, Scenario, Step } from '../src/scenario/schema';
import { CATALOG_REFERENCE } from '../tests/checklist-catalog-reference';
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

    await expect(page.locator('[data-session-button="session.checklist"]')).toContainText(
      'SHOW CHECKLIST',
    );
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
    if (covered) await hideSheet(page, hasTouch);
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
    await hideSheet(page, hasTouch);
    await expect(sheet).toHaveCount(0);
  });
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

/** The hide button ignores a click for the first 400 ms after the sheet appeared: wait it out, then press it. */
async function hideSheet(page: Page, hasTouch: boolean): Promise<void> {
  await page.waitForTimeout(450);
  await activate(page.getByTestId('run-checklist-hide'), hasTouch);
}

const ENTRIES = '[data-testid="run-checklist-entry"]';
const GREYED = '[data-testid="run-checklist-entry-greyed"]';
const TAP = '[data-testid="sheet-tap"]';
const entryOf = (page: Page, heading: string) =>
  page.locator(ENTRIES).filter({ hasText: heading }).first();

/** The catalog group of a shipped scenario: id of the tab that holds its entry (independent reference). */
function groupOfShipped(pack: string, id: string): string {
  const group = CATALOG_REFERENCE.find((g) => g.rows.some((row) => row[2] === `${pack}/${id}`));
  if (group === undefined) throw new Error(`${pack}/${id} is in no catalog group`);
  return group.id;
}

/** Presses the tab of a group in the open Realistic list. */
async function pressListTab(page: Page, hasTouch: boolean, group: string): Promise<void> {
  const tab = page.getByTestId(`run-checklist-tab-${group}`);
  await activate(tab, hasTouch);
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

test('@hooks Realistic: SHOW CHECKLIST lists the three printed groups as tabs before the onset, unlinked entries greyed, none marked as the right one', async ({
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
  // The same static label on every level (owner decision 2026-11-02); there is no CHOOSE CHECKLIST button.
  await expect(page.locator('[data-session-button="session.checklist"]')).toContainText(
    'SHOW CHECKLIST',
  );
  await expect(page.getByText('CHOOSE CHECKLIST')).toHaveCount(0);

  await activate(page.locator(CHECKLIST), hasTouch);
  await expect(page.getByTestId('run-checklist-tabs')).toBeVisible();
  // One tab per printed group with its full heading; the first is selected in every run.
  await expect(page.getByRole('tab')).toHaveText(CATALOG_REFERENCE.map((g) => g.heading));
  const first = CATALOG_REFERENCE[0];
  await expect(page.getByTestId(`run-checklist-tab-${first?.id ?? ''}`)).toHaveAttribute(
    'aria-selected',
    'true',
  );
  for (const group of CATALOG_REFERENCE) {
    await pressListTab(page, hasTouch, group.id);
    const linked = group.rows.filter((row) => row[2] !== null);
    const unlinked = group.rows.filter((row) => row[2] === null);
    await expect(page.locator(ENTRIES)).toHaveCount(linked.length);
    await expect(page.locator(GREYED)).toHaveCount(unlinked.length);
    // The rows stand in the printed order, a qualifier as a second line of its entry.
    await expect(page.locator(`${ENTRIES}, ${GREYED}`)).toHaveText(
      group.rows.map(([tag, detail]) => (detail === null ? tag : `${tag}${detail}`)),
    );
    for (const greyed of await page.locator(GREYED).all()) {
      await expect(greyed).toBeDisabled();
      await expect(greyed).toHaveAttribute('aria-disabled', 'true');
    }
    // Alike: no linked entry carries a mark, a state or a title of its own.
    const attrs = await page
      .locator(ENTRIES)
      .evaluateAll((nodes) => nodes.map((node) => node.getAttributeNames().sort().join(',')));
    expect(new Set(attrs).size).toBeLessThanOrEqual(1);
  }
  // Not a modal: no dialog.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The hide button hides the sheet anywhere.
  await hideSheet(page, hasTouch);
  await expect(page.getByTestId('run-checklist')).toHaveCount(0);
});

test('@hooks Realistic: the own checklist is marked after the onset, a foreign one from the real actions, the debrief names the last choice and the real situation', async ({
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
  const foreignFile = scenarioFile(`${foreign.pack}/${foreign.file}`);
  const foreignHeading = foreignFile.checklist?.heading ?? foreign.title;
  expect(foreignHeading).not.toBe(ownHeading);
  const first = stepsOf(own.procedure)[0];
  // The first step of the foreign file that one press of a toggle satisfies (the asked state is not
  // the panel default), and the control it asks for.
  const foreignStep = stepsOf(foreignFile.procedure).find((st) => {
    if (st.done.check !== 'state') return false;
    const def = DA50RG.get(st.done.control);
    return def?.kind === 'toggle' && def.default !== st.done.is;
  });
  if (first === undefined || foreignStep === undefined) throw new Error('the files have no step');
  if (foreignStep.done.check !== 'state') throw new Error('not a state step');
  const askedControl = foreignStep.done.control;

  await startRealistic(page, hasTouch, ENGINE_ROW);
  await activate(page.locator(CHECKLIST), hasTouch);
  await expect(page.locator(ENTRIES).first()).toBeVisible();

  // The own checklist, chosen after the onset and then the step done: exactly that row is green.
  await afterOnset(page);
  await pressListTab(page, hasTouch, groupOfShipped('engine', 'eng-oil-temp-green'));
  await activate(entryOf(page, ownHeading), hasTouch);
  await expect(page.getByTestId('run-checklist')).toContainText(own.checklist?.message ?? '');
  await expect(page.getByTestId('run-checklist-back')).toBeVisible();
  await expect(page.locator('[data-testid="sheet-step"][data-verdict]')).toHaveCount(0);
  await hideSheet(page, hasTouch);
  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p50');
  // The press reopens the chosen checklist, not the list, and the label has not changed.
  await activate(page.locator(CHECKLIST), hasTouch);
  await expect(page.locator('[data-session-button="session.checklist"]')).toContainText(
    'SHOW CHECKLIST',
  );
  const done = page.locator('[data-testid="sheet-step"][data-verdict="Done"]');
  await expect(done).toHaveCount(1);
  await expect(done).toHaveAttribute('data-step-id', first.id);

  // A foreign checklist: the real power action satisfies none of its steps, so nothing is marked ...
  await activate(page.getByTestId('run-checklist-back'), hasTouch);
  await pressListTab(page, hasTouch, groupOfShipped(foreign.pack, foreign.id));
  await activate(entryOf(page, foreignHeading), hasTouch);
  await expect(page.getByTestId('run-checklist')).toContainText(foreignHeading);
  await expect(page.locator('[data-testid="sheet-step"][data-verdict]')).toHaveCount(0);
  await expect(page.getByTestId('debrief-row')).toHaveCount(0);

  // ... until the pilot really does what one of its panel steps asks: that row turns green (it is
  // wrong for this situation, the marks come from the panel alone).
  await hideSheet(page, hasTouch);
  await activate(page.locator(`[data-hit="${askedControl}"]`), hasTouch);
  await activate(page.locator(CHECKLIST), hasTouch);
  await expect(
    page.locator(`[data-testid="sheet-step"][data-step-id="${foreignStep.id}"]`),
  ).toHaveAttribute('data-verdict', 'Done');

  // The last choice is named in the debrief with the neutral line; the verdict is the grade of the panel alone.
  await hideSheet(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
  await expect(page.getByTestId('debrief-checklist')).toHaveText(
    `Checklist used: ${foreignHeading}`,
  );
  await expect(page.getByTestId('debrief-checklist-note')).toContainText(
    `The situation was ${own.title}.`,
  );
});

test('@hooks Realistic: the own checklist as the choice gets no debrief note', async ({
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
  await startRealistic(page, hasTouch, ENGINE_ROW);
  await activate(page.locator(CHECKLIST), hasTouch);
  await pressListTab(page, hasTouch, groupOfShipped('engine', 'eng-oil-temp-green'));
  await activate(entryOf(page, own.checklist?.heading ?? own.title), hasTouch);
  await hideSheet(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-checklist')).toHaveText(
    `Checklist used: ${own.checklist?.heading ?? own.title}`,
  );
  await expect(page.getByTestId('debrief-checklist-note')).toHaveCount(0);
});

test('a line row of the sheet can be ticked and cleared, is a 44 px button, keeps its text, and the tick is gone after Retry', async ({
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
  await startScenario(page, hasTouch, ENGINE_ROW, 'easy');
  await activate(page.locator(CHECKLIST), hasTouch);
  const sheet = page.getByTestId('run-checklist');
  await expect(sheet).toBeVisible();
  const taps = sheet.locator(TAP);
  // On Easy the steps come from the grade, so only the plain action lines can be ticked.
  const lines = sheet.locator('[data-kind="line"]');
  expect(await lines.count()).toBeGreaterThan(0);
  await expect(taps).toHaveCount(await lines.count());
  await expect(sheet.locator('[data-testid="sheet-step"] [data-testid="sheet-tap"]')).toHaveCount(
    0,
  );

  const row = taps.first();
  const text = await row.innerText();
  const box = await row.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(row).toHaveAttribute('aria-pressed', 'false');
  await activate(row, hasTouch);
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  await expect(row).toHaveAttribute('data-ticked', 'true');
  await expect(row).toHaveCSS('background-color', 'rgba(47, 211, 111, 0.14)');
  expect(await row.innerText()).toBe(text);
  await page.waitForTimeout(450);
  await activate(row, hasTouch);
  await expect(row).toHaveAttribute('aria-pressed', 'false');
  await expect(row).not.toHaveAttribute('data-ticked', 'true');

  // A tick again, then the run ends: Retry starts clean.
  await page.waitForTimeout(450);
  await activate(row, hasTouch);
  await expect(row).toHaveAttribute('data-ticked', 'true');
  await hideSheet(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
  await expect(page.getByTestId('debrief-modal')).not.toHaveAttribute('data-shield', 'on');
  await activate(page.getByTestId('debrief-retry'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  await activate(page.locator(CHECKLIST), hasTouch);
  await expect(sheet.locator(TAP).first()).toHaveAttribute('aria-pressed', 'false');
  await expect(sheet.locator('[data-ticked="true"]')).toHaveCount(0);
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
