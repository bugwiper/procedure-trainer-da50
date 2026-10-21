import { expect, test } from '@playwright/test';

// Code review CR-01: only the main mouse button operates a control. A right or middle press on a
// knob or a lever handle must neither step the knob nor move the lever (nothing reaches the
// graded action log). Every case reads data-state, so it also runs in the live rehearsal.

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.use.hasTouch === true,
    'mouse buttons exist only on the mouse projects',
  );
  await page.goto('./');
});

async function stateOf(page: import('@playwright/test').Page, id: string): Promise<string | null> {
  return page.locator(`[data-control-id="${id}"]`).getAttribute('data-state');
}

test('a right or middle click on a knob does not step it', async ({ page }) => {
  const hit = page.locator('[data-hit="sw.fuel_trans"]');
  await expect(hit).toBeVisible();
  const before = await stateOf(page, 'sw.fuel_trans');
  const box = await hit.boundingBox();
  if (box === null) throw new Error('knob has no box');
  for (const button of ['right', 'middle'] as const) {
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2, { button });
    expect(await stateOf(page, 'sw.fuel_trans'), `${button} click`).toBe(before);
  }
  // The left button still steps it (the right half steps one stop clockwise).
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  expect(await stateOf(page, 'sw.fuel_trans')).not.toBe(before);
});

test('a right-button drag on a lever handle does not move the lever', async ({ page }) => {
  const handle = page.locator(
    '[data-control-id="lv.power"] [data-handle], [data-handle="lv.power"]',
  );
  const target =
    (await handle.count()) > 0 ? handle.first() : page.locator('[data-hit="lv.power"]');
  await expect(target).toBeVisible();
  const before = await stateOf(page, 'lv.power');
  const box = await target.boundingBox();
  if (box === null) throw new Error('lever has no box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x, y - 60, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  expect(await stateOf(page, 'lv.power')).toBe(before);
});
