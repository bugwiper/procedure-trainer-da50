import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Switch skins (PNL-11, D-08): the rocker half pressed follows the state on every device.

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(hit: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await hit.tap();
  else await hit.click();
}

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('ELECT. MASTER is the big red rocker and its pressed half follows its state', async ({
  page,
  hasTouch,
}) => {
  const sw = control(page, 'sw.elect_master');
  const hit = page.locator('[data-hit="sw.elect_master"]');
  await expect(sw).toHaveCount(1);
  await expect(sw).toHaveAttribute('data-skin', 'rocker');
  await expect(sw).toHaveAttribute('data-size', 'L');
  await expect(sw).toHaveAttribute('data-colour', 'red');
  await expect(sw).toHaveAttribute('data-pressed-half', 'upper');
  await expect(sw.locator('[data-state-text]')).toHaveText('ON');

  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-pressed-half', 'lower');
  await expect(sw.locator('[data-state-text]')).toHaveText('OFF');

  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-pressed-half', 'upper');
  await expect(sw.locator('[data-state-text]')).toHaveText('ON');
});

const RED_IDS = ['sw.elect_master', 'sw.elt'];

test('every rocker pressed half matches its state before and after one tap', async ({
  page,
  hasTouch,
}) => {
  const ids = await page
    .locator('[data-skin="rocker"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-control-id') ?? ''));
  expect(ids.length).toBeGreaterThanOrEqual(11);
  for (const id of ids) {
    const group = control(page, id);
    const half = async () => {
      const state = await group.getAttribute('data-state');
      // The second state in registry order (ON for every rocker, also ELT) is the upper end.
      return state === 'on' ? 'upper' : 'lower';
    };
    await expect(group, id).toHaveAttribute('data-pressed-half', await half());
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(group, id).toHaveAttribute('data-pressed-half', await half());
    const afterTap = await group.getAttribute('data-pressed-half');
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(group, id).not.toHaveAttribute('data-pressed-half', afterTap ?? '');
  }
});

test('red rockers are exactly ELECT. MASTER and ELT, every other rocker is white', async ({
  page,
}) => {
  const red = await page
    .locator('[data-skin="rocker"][data-colour="red"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-control-id')));
  expect(red.sort()).toEqual(RED_IDS);
  const white = page.locator('[data-skin="rocker"][data-colour="white"]');
  await expect(white).toHaveCount(9);
});

test('the four light rockers are white, flip and keep LIGHT size', async ({ page, hasTouch }) => {
  for (const id of ['sw.light_landing', 'sw.light_taxi', 'sw.light_position', 'sw.light_strobe']) {
    const group = control(page, id);
    await expect(group, id).toHaveAttribute('data-size', 'LIGHT');
    await expect(group, id).toHaveAttribute('data-colour', 'white');
    const before = await group.getAttribute('data-state');
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(group, id).not.toHaveAttribute('data-state', before ?? '');
  }
});

test('the pressed ring is transient: present while the mouse is held, gone after release', async ({
  page,
  hasTouch,
}, testInfo) => {
  test.skip(hasTouch || testInfo.project.name !== 'desktop-chromium', 'mouse hold on desktop');
  const group = control(page, 'sw.ess_bus');
  const hit = page.locator('[data-hit="sw.ess_bus"]');
  await expect(group).not.toHaveAttribute('data-pressed', 'true');
  const box = await hit.boundingBox();
  if (box === null) throw new Error('ESS BUS has no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(group).toHaveAttribute('data-pressed', 'true');
  await page.mouse.up();
  await expect(group).not.toHaveAttribute('data-pressed', 'true');
});
