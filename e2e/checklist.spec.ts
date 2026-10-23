import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PRINTED } from '../tests/checklist-reference';
import type { PrintedChecklist, PrintedItem } from '../tests/checklist-reference';
import { chooseScenario } from './support/session';
import { activate } from './support/zoom';

// The checklists as printed (plan 03-14, owner decision 2026-10-23) on the built app: the Easy
// briefing and the debrief render the numbered table (number and item at the left, action at the
// right, full-width and boxed comment rows) and the marked outline, compared with the independent
// printed reference of tests/checklist-reference.ts. Geometry is read from the layout; no spec here
// types a checklist word, the reference table and the scenario data supply them.

const ALTN1 = 'electrical.elec-altn1-fail';

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
