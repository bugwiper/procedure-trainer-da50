import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { AV_MASTER_CONTROL } from '../src/aircraft/da50rg/avionics';
import { activate, afterPairWindow } from './support/zoom';

// Built-panel gate for the second radio row of the glass header (owner decision, PANEL-REVIEW.md
// item 15): the row (NAV 2 at the left, COM 2 at the right) follows AV MASTER. With the switch on
// both rows show frequencies; with it off each second row is a yellow-grey box with two crossing
// yellow lines. The PFD and the MFD draw the same header, so every check runs on both.

const DISPLAYS = ['pfd', 'mfd'] as const;
/** The two second rows of one header, left and right. */
const ROWS = ['nav2', 'com2'] as const;
/** The first-row marks that never depend on the switch: two swap arrows, two standby frames. */
const FIXED_MARKS = ['data-swap-arrow', 'data-standby-frame'] as const;

const header = (page: Page, display: string) =>
  page.locator(`[data-region-id="${display}"] [data-glass-zone="header"]`);

async function expectSecondRowsLive(page: Page): Promise<void> {
  for (const display of DISPLAYS) {
    const h = header(page, display);
    await expect(h.locator('[data-radio-row-off]'), display).toHaveCount(0);
    await expect(h.locator('[data-radio-row-cross]'), display).toHaveCount(0);
    // Both second-row frequencies are drawn again: 8 frequencies in the header, none removed.
    await expect(h.locator('text.glass-digits'), display).toHaveCount(8);
  }
}

async function expectSecondRowsOff(page: Page): Promise<void> {
  for (const display of DISPLAYS) {
    const h = header(page, display);
    for (const row of ROWS) {
      const box = h.locator(`[data-radio-row-off="${row}"]`);
      await expect(box, `${display} ${row}`).toHaveCount(1);
      await expect(box.locator('rect'), `${display} ${row}`).toBeVisible();
      await expect(box.locator('[data-radio-row-cross]'), `${display} ${row}`).toBeVisible();
    }
    await expect(h.locator('[data-radio-row-off]'), display).toHaveCount(ROWS.length);
    // Only the first-row frequencies remain: half of the live count.
    await expect(h.locator('text.glass-digits'), display).toHaveCount(4);
  }
}

async function expectFirstRowAndMarksStay(page: Page): Promise<void> {
  for (const display of DISPLAYS) {
    const h = header(page, display);
    for (const mark of FIXED_MARKS) await expect(h.locator(`[${mark}]`), display).toHaveCount(2);
    // The stacked radio names and the two small numbers per side stay.
    await expect(h.locator('text:text-is("N")'), display).toHaveCount(1);
    await expect(h.locator('text:text-is("C")'), display).toHaveCount(1);
    await expect(h.locator('text:text-is("1")'), display).toHaveCount(2);
    await expect(h.locator('text:text-is("2")'), display).toHaveCount(2);
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', 'covered by the rotate hint');
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('AV MASTER on (the default): both second rows show frequencies on the PFD and the MFD', async ({
  page,
}) => {
  await expect(page.locator(`[data-control-id="${AV_MASTER_CONTROL}"]`)).toHaveAttribute(
    'data-state',
    'on',
  );
  await expectSecondRowsLive(page);
  await expectFirstRowAndMarksStay(page);
});

test('AV MASTER off crosses out both second rows on both displays, and on brings them back', async ({
  page,
  hasTouch,
}) => {
  const hit = page.locator(`[data-hit="${AV_MASTER_CONTROL}"]`);
  const control = page.locator(`[data-control-id="${AV_MASTER_CONTROL}"]`);

  await activate(hit, hasTouch);
  await expect(control).toHaveAttribute('data-state', 'off');
  await expectSecondRowsOff(page);
  await expectFirstRowAndMarksStay(page);

  await afterPairWindow(page);
  await activate(hit, hasTouch);
  await expect(control).toHaveAttribute('data-state', 'on');
  await expectSecondRowsLive(page);
  await expectFirstRowAndMarksStay(page);
});

test('the MFD page does not change the second rows: the map and the engine page agree', async ({
  page,
  hasTouch,
}) => {
  await activate(page.locator(`[data-hit="${AV_MASTER_CONTROL}"]`), hasTouch);
  await expectSecondRowsOff(page);
  await afterPairWindow(page);
  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);
  await expect(page.locator('[data-mfd-page="engine"]')).toBeVisible();
  await expectSecondRowsOff(page);
  await expectFirstRowAndMarksStay(page);
});

test('only the second rows follow AV MASTER: the rest of the glass stays lit', async ({
  page,
  hasTouch,
}) => {
  const content = (display: string) =>
    page.locator(`[data-region-id="${display}"] [data-glass-zone="content"]`);
  const before = await Promise.all(DISPLAYS.map((d) => content(d).innerHTML()));
  await activate(page.locator(`[data-hit="${AV_MASTER_CONTROL}"]`), hasTouch);
  await expectSecondRowsOff(page);
  const after = await Promise.all(DISPLAYS.map((d) => content(d).innerHTML()));
  expect(after).toEqual(before);
  for (const display of DISPLAYS) {
    await expect(
      page.locator(`[data-region-id="${display}"] [data-glass-zone="screen"]`),
    ).toBeVisible();
  }
});
