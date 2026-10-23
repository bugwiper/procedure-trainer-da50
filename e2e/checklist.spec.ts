import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PRINTED } from '../tests/checklist-reference';
import type {
  PrintedChecklist,
  PrintedItem,
  PrintedOutlineItem,
} from '../tests/checklist-reference';
import { chooseScenario, startScenario } from './support/session';
import { activate } from './support/zoom';

// The checklists as printed (plan 03-14, owner decision 2026-10-23) on the built app: the Easy
// briefing and the debrief render the numbered table (number and item at the left, action at the
// right, full-width and boxed comment rows) and the marked outline, compared with the independent
// printed reference of tests/checklist-reference.ts. Geometry is read from the layout; no spec here
// types a checklist word, the reference table and the scenario data supply them.

const ALTN1 = 'electrical.elec-altn1-fail';
const FIRE = 'engine.eng-fire-in-flight';
const OIL = 'engine.eng-oil-temp-green';

/** Pixel slack for sub-pixel layout. */
const EDGE_PX = 2;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

function printed(id: string): PrintedChecklist {
  const found = PRINTED[id];
  if (found === undefined) throw new Error(`no printed checklist for ${id}`);
  return found;
}

function printedTable(id: string): Extract<PrintedChecklist, { form: 'table' }> {
  const found = printed(id);
  if (found.form !== 'table') throw new Error(`${id} is not a table`);
  return found;
}

/** Opens the Easy briefing of one scenario through CHOOSE SITUATION. */
async function openBriefing(page: Page, hasTouch: boolean, row: string): Promise<Locator> {
  await chooseScenario(page, hasTouch, row);
  await page.waitForTimeout(450);
  await activate(page.getByTestId('level-pick-easy'), hasTouch);
  const briefing = page.getByTestId('briefing');
  await expect(briefing).toBeVisible();
  return briefing;
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('element has no layout box');
  return box;
}

/** True when the card does not scroll sideways. */
async function noSidewaysScroll(card: Locator): Promise<void> {
  const overflow = await card.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

function rows(items: readonly PrintedItem[]) {
  return items.flatMap((item) => (item.kind === 'row' ? [item] : []));
}

/** The table of the printed reference against the rendered rows, in order. */
async function expectTable(list: Locator, id: string): Promise<void> {
  const table = printedTable(id);
  const items = list.locator('li[data-kind]');
  await expect(items).toHaveCount(table.rows.length);
  for (const [i, row] of table.rows.entries()) {
    const li = items.nth(i);
    if (row.kind === 'comment') {
      await expect(li).toHaveAttribute('data-kind', 'comment');
      await expect(li.locator('.outline-text')).toHaveText(row.text);
      await expect(li.locator('.outline-number')).toHaveCount(0);
      if (row.boxed === true) {
        await expect(li).toHaveAttribute('data-boxed', 'true');
        await expect(li.locator('.outline-action')).toHaveText(row.reference ?? '');
      } else {
        await expect(li).not.toHaveAttribute('data-boxed', 'true');
      }
      continue;
    }
    await expect(li).toHaveAttribute('data-kind', /^(line|step)$/);
    await expect(li.locator('.outline-text')).toHaveText(row.item);
    if (row.number === undefined) {
      await expect(li.locator('.outline-number')).toHaveCount(0);
    } else {
      await expect(li.locator('.outline-number')).toHaveText(String(row.number));
    }
    if (row.action === undefined) {
      await expect(li.locator('.outline-action')).toHaveCount(0);
    } else {
      await expect(li.locator('.outline-action')).toHaveText(row.action);
    }
  }
}

/** Number at the left edge, action at the right edge, comment rows across the whole list. */
async function expectAlignment(list: Locator): Promise<void> {
  const listBox = await boxOf(list);
  const numbers = list.locator(
    'li[data-kind="line"] .outline-number, li[data-kind="step"] .outline-number',
  );
  const numberCount = await numbers.count();
  expect(numberCount).toBeGreaterThan(0);
  for (let i = 0; i < numberCount; i += 1) {
    const box = await boxOf(numbers.nth(i));
    expect(Math.abs(box.x - listBox.x)).toBeLessThanOrEqual(EDGE_PX);
  }
  const actions = list.locator(
    'li[data-kind="line"] .outline-action, li[data-kind="step"] .outline-action',
  );
  const actionCount = await actions.count();
  expect(actionCount).toBeGreaterThan(0);
  for (let i = 0; i < actionCount; i += 1) {
    const box = await boxOf(actions.nth(i));
    expect(Math.abs(box.x + box.width - (listBox.x + listBox.width))).toBeLessThanOrEqual(EDGE_PX);
  }
  const comments = list.locator('li[data-kind="comment"]');
  const commentCount = await comments.count();
  for (let i = 0; i < commentCount; i += 1) {
    const box = await boxOf(comments.nth(i));
    expect(Math.abs(box.width - listBox.width)).toBeLessThanOrEqual(EDGE_PX);
    expect(Math.abs(box.x - listBox.x)).toBeLessThanOrEqual(EDGE_PX);
  }
}

test('the Easy briefing of ALTN 1 FAIL reads like the printed table', async ({
  page,
  hasTouch,
}) => {
  const table = printedTable('elec-altn1-fail');
  const briefing = await openBriefing(page, hasTouch, ALTN1);

  // The printed heading and the message tag, above the rows.
  const heading = briefing.getByTestId('checklist-heading');
  await expect(heading).toBeVisible();
  await expect(heading.getByTestId('checklist-title')).toHaveText(table.heading);
  await expect(heading.getByTestId('checklist-message')).toHaveText(table.message ?? '');

  const list = briefing.getByTestId('briefing-outline').locator('ul.outline-table').first();
  await expect(list).toBeVisible();
  // Four numbered rows (the printed ones), two comment rows, nothing else.
  expect(rows(table.rows)).toHaveLength(4);
  await expectTable(list, 'elec-altn1-fail');
  await expectAlignment(list);

  // The briefing shows no tag, no verdict and no marker shape.
  await expect(briefing).not.toContainText('CRITICAL');
  await expect(briefing).not.toContainText('Not graded');
  await expect(briefing.locator('svg.outline-marker')).toHaveCount(0);
  await noSidewaysScroll(briefing);
});

/** The printed markers in reading order; the children of items for which `hide` is true are left out. */
function printedMarkers(
  list: readonly PrintedOutlineItem[],
  hide: (item: PrintedOutlineItem) => boolean,
): string[] {
  return list.flatMap((item) => [
    ...(item.marker === undefined ? [] : [item.marker]),
    ...(item.children === undefined || hide(item) ? [] : printedMarkers(item.children, hide)),
  ]);
}

function printedOutline(id: string): Extract<PrintedChecklist, { form: 'outline' }> {
  const found = printed(id);
  if (found.form !== 'outline') throw new Error(`${id} is not an outline`);
  return found;
}

/** Does a do-nothing run of the scenario and opens its debrief; the run starts at level Easy. */
async function doNothing(page: Page, hasTouch: boolean, row: string): Promise<Locator> {
  await startScenario(page, hasTouch, row);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  const debrief = page.getByTestId('debrief');
  await expect(debrief).toBeVisible();
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  return debrief;
}

test('the Easy briefing of Engine Fire reads like the printed table, boxed reference included', async ({
  page,
  hasTouch,
}) => {
  const table = printedTable('eng-fire-in-flight');
  const briefing = await openBriefing(page, hasTouch, FIRE);
  await expect(briefing.getByTestId('checklist-title')).toHaveText(table.heading);
  // The printed page has no message tag.
  await expect(briefing.getByTestId('checklist-message')).toHaveCount(0);

  const list = briefing.getByTestId('briefing-outline').locator('ul.outline-table').first();
  await expectTable(list, 'eng-fire-in-flight');
  await expectAlignment(list);

  // Rows 1 to 8 in order, then the one row that is not printed, without a number.
  const numbers = await list
    .locator('li[data-kind="line"] .outline-number, li[data-kind="step"] .outline-number')
    .allTextContents();
  expect(numbers).toEqual(
    rows(table.rows).flatMap((r) => (r.number === undefined ? [] : [String(r.number)])),
  );
  expect(numbers.map(Number)).toEqual(numbers.map((_, i) => i + 1));
  const last = list.locator('li[data-kind]').last();
  await expect(last).toHaveAttribute('data-kind', /^(line|step)$/);
  await expect(last.locator('.outline-number')).toHaveCount(0);

  // The boxed row: framed, and its reference sits at its right edge.
  const boxed = list.locator('li[data-boxed="true"]');
  await expect(boxed).toHaveCount(1);
  const boxBox = await boxOf(boxed);
  const refBox = await boxOf(boxed.locator('.outline-action'));
  expect(boxBox.x + boxBox.width - (refBox.x + refBox.width)).toBeGreaterThanOrEqual(0);
  expect(boxBox.x + boxBox.width - (refBox.x + refBox.width)).toBeLessThanOrEqual(12);
  expect(
    await boxed.locator('.outline-comment').evaluate((el) => getComputedStyle(el).borderTopWidth),
  ).not.toBe('0px');
  await noSidewaysScroll(briefing);
});

test('the Easy briefing of ENG OIL TEMP shows the printed outline with its markers', async ({
  page,
  hasTouch,
}) => {
  const outline = printedOutline('eng-oil-temp-green');
  const briefing = await openBriefing(page, hasTouch, OIL);
  await expect(briefing.getByTestId('checklist-title')).toHaveText(outline.heading);
  await expect(briefing.getByTestId('checklist-message')).toHaveText(outline.message ?? '');

  const list = briefing.getByTestId('briefing-outline');
  // The branch that does not apply keeps its marker and shows no children.
  const hiddenLabels = await list
    .locator('li[data-status="not_applicable"] > div > .outline-label')
    .allTextContents();
  expect(hiddenLabels.length).toBeGreaterThan(0);
  const expected = printedMarkers(outline.items, (item) => hiddenLabels.includes(item.text));
  const drawn = await list
    .locator('svg.outline-marker')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-marker')));
  expect(drawn).toEqual(expected);
  await expect(list.locator('svg.outline-marker[aria-hidden="true"]')).toHaveCount(expected.length);
  // Real list nesting: the deepest printed line is four lists in.
  await expect(list.locator('ul ul ul')).not.toHaveCount(0);
  await expect(list.locator('ul.outline-table')).toHaveCount(0);

  // A marker sits before the text of its own row.
  const first = list.locator('li[data-kind="decision"]').first().locator(':scope > div');
  const markerBox = await boxOf(first.locator('svg.outline-marker'));
  const textBox = await boxOf(first.locator('.outline-text'));
  expect(markerBox.x + markerBox.width).toBeLessThanOrEqual(textBox.x + EDGE_PX);
  await noSidewaysScroll(briefing);
});

test('the debrief of a do-nothing ALTN 1 FAIL run keeps tag, verdict and Not graded in the table', async ({
  page,
  hasTouch,
}) => {
  const table = printedTable('elec-altn1-fail');
  const debrief = await doNothing(page, hasTouch, ALTN1);
  await expect(debrief.getByTestId('checklist-title')).toHaveText(table.heading);
  await expect(debrief.getByTestId('checklist-message')).toHaveText(table.message ?? '');

  const list = debrief.locator('ul.outline-table').first();
  await expectTable(list, 'elec-altn1-fail');

  const printedRows = rows(table.rows);
  const graded = debrief.getByTestId('debrief-row');
  await expect(graded).toHaveCount(2);
  for (const [i, number] of [2, 3].entries()) {
    const row = graded.nth(i);
    const printedRow = printedRows.find((r) => r.number === number);
    await expect(row.locator('.outline-number')).toHaveText(String(number));
    await expect(row.locator('.outline-text')).toHaveText(printedRow?.item ?? '');
    await expect(row.locator('.outline-action')).toHaveText(printedRow?.action ?? '');
    await expect(row.locator('.outline-tag')).toHaveText('CRITICAL');
    await expect(row.locator('.outline-verdict')).toHaveText('Missed');
    await expect(row).toHaveAttribute('data-verdict', 'Missed');
  }
  for (const number of [1, 4]) {
    const row = list.locator('li[data-kind="line"]', {
      has: page.locator('.outline-number', { hasText: new RegExp(`^${String(number)}$`) }),
    });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Not graded');
    await expect(row.locator('.outline-verdict')).toHaveCount(0);
  }
  const comments = list.locator('li[data-kind="comment"]');
  await expect(comments).toHaveCount(2);
  for (let i = 0; i < 2; i += 1) {
    await expect(
      comments.nth(i).locator('.outline-verdict, .outline-tag, .outline-meta'),
    ).toHaveCount(0);
    await expect(comments.nth(i)).not.toContainText('Not graded');
  }
  await noSidewaysScroll(debrief);
});

test('the debrief of ENG OIL TEMP draws every printed marker', async ({ page, hasTouch }) => {
  const outline = printedOutline('eng-oil-temp-green');
  const debrief = await doNothing(page, hasTouch, OIL);
  const drawn = await debrief
    .locator('svg.outline-marker')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-marker')));
  expect(drawn).toEqual(printedMarkers(outline.items, () => false));
  await noSidewaysScroll(debrief);
});

test('a 375 px phone does not scroll the briefing or the debrief of Engine Fire sideways', async ({
  page,
  hasTouch,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const table = printedTable('eng-fire-in-flight');
  const briefing = await openBriefing(page, hasTouch, FIRE);
  const list = briefing.getByTestId('briefing-outline').locator('ul.outline-table').first();
  await expectTable(list, 'eng-fire-in-flight');
  await noSidewaysScroll(briefing);
  // The longest action keeps to the right edge of its own line.
  const listBox = await boxOf(list);
  const longest = rows(table.rows).reduce((a, b) =>
    (b.action ?? '').length > (a.action ?? '').length ? b : a,
  );
  const action = list.locator('.outline-action', { hasText: longest.action ?? '' });
  const actionBox = await boxOf(action);
  expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(listBox.x + listBox.width + EDGE_PX);
  expect(actionBox.x).toBeGreaterThanOrEqual(listBox.x - EDGE_PX);

  await activate(page.getByTestId('briefing-start'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  const debrief = page.getByTestId('debrief');
  await expect(debrief).toBeVisible();
  await expect(debrief.getByTestId('checklist-title')).toHaveText(table.heading);
  await noSidewaysScroll(debrief);
});
