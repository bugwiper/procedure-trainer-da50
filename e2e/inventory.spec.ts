import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Every control added by plan 01.1-05 (de-ice panel, LEVEL, environmental sliders, PARKING
// BRAKE) must operate on every device project.

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(target: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await target.tap();
  else await target.click();
}

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('de-ice WIND SHIELD flips by mouse or tap', async ({ page, hasTouch }) => {
  const sw = control(page, 'sw.deice_windshield');
  const hit = page.locator('[data-hit="sw.deice_windshield"]');
  await expect(sw).toHaveCount(1);
  await expect(sw).toHaveAttribute('data-state', 'off');

  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-state', 'on');

  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-state', 'off');
});

test('de-ice ICE LIGHT, PUMP 2 and PUMP 1 flip by mouse or tap', async ({ page, hasTouch }) => {
  for (const id of ['sw.deice_ice_light', 'sw.deice_pump2', 'sw.deice_pump1']) {
    const sw = control(page, id);
    await expect(sw, id).toHaveCount(1);
    await expect(sw, id).toHaveAttribute('data-state', 'off');
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(sw, id).toHaveAttribute('data-state', 'on');
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(sw, id).toHaveAttribute('data-state', 'off');
  }
});

test('de-ice MODE reaches NORM, HIGH, MAX and OFF by marker tap', async ({ page, hasTouch }) => {
  const mode = control(page, 'lv.deice_mode');
  await expect(mode).toHaveAttribute('data-state', 'off');
  for (const detent of ['norm', 'high', 'max', 'off']) {
    await activate(page.locator(`[data-detent="lv.deice_mode:${detent}"]`), hasTouch);
    await expect(mode, detent).toHaveAttribute('data-state', detent);
  }
});

test('ANNUN TEST and LEVEL show PRESSED while held and RELEASED after release', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, 'a touch cannot be held in Playwright; covered by the mouse projects');
  for (const id of ['btn.deice_annun_test', 'btn.level']) {
    const button = control(page, id);
    await expect(button, id).toHaveCount(1);
    await expect(button, id).toHaveAttribute('data-state', 'released');

    await page.locator(`[data-hit="${id}"]`).hover();
    await page.mouse.down();
    await expect(button, id).toHaveAttribute('data-state', 'pressed');

    await page.mouse.up();
    await expect(button, id).toHaveAttribute('data-state', 'released');
  }
});

test('a tap leaves ANNUN TEST and LEVEL RELEASED', async ({ page, hasTouch }) => {
  for (const id of ['btn.deice_annun_test', 'btn.level']) {
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(control(page, id), id).toHaveAttribute('data-state', 'released');
  }
});

test('the ALTERNATE switch is the only guarded control', async ({ page }) => {
  await expect(page.locator('[data-kind="guarded-toggle"]')).toHaveCount(1);
  await expect(control(page, 'sw.deice_alternate')).toHaveAttribute('data-kind', 'guarded-toggle');
});

test('console levers open in their in-flight defaults', async ({ page }) => {
  const defaults: Record<string, string> = {
    'lv.env_direction': 'face',
    'lv.env_temp': 't50',
    'lv.env_circ': 'fresh',
    'lv.parking_brake': 'off',
    'lv.cowl_flap': 'closed',
    'lv.power': 'p70',
    'lv.deice_mode': 'off',
  };
  for (const [id, state] of Object.entries(defaults)) {
    await expect(control(page, id), id).toHaveAttribute('data-state', state);
  }
});

test('every detent of DIRECTION, TEMPERATURE, CIRCULATING AIR, PARKING BRAKE and COWL FLAP is reachable by tap', async ({
  page,
  hasTouch,
}) => {
  const sequences: Record<string, string[]> = {
    'lv.env_direction': ['defrost', 'feet', 'face'],
    'lv.env_temp': ['cold', 't25', 't75', 'warm', 't50'],
    'lv.env_circ': ['recirc', 'fresh'],
    'lv.parking_brake': ['set', 'off'],
    'lv.cowl_flap': ['open', 'closed'],
  };
  for (const [id, detents] of Object.entries(sequences)) {
    const group = control(page, id);
    await expect(group, id).toHaveCount(1);
    for (const detent of detents) {
      await activate(page.locator(`[data-detent="${id}:${detent}"]`), hasTouch);
      await expect(group, `${id}:${detent}`).toHaveAttribute('data-state', detent);
    }
  }
});
