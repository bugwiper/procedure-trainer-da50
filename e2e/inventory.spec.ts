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

test('de-ice PUMP toggle flips between PUMP 1 and PUMP 2 by mouse or tap', async ({
  page,
  hasTouch,
}) => {
  const sw = control(page, 'sw.deice_pump');
  const hit = page.locator('[data-hit="sw.deice_pump"]');
  await expect(sw).toHaveCount(1);
  await expect(sw).toHaveAttribute('data-state', 'pump1');
  for (const id of ['sw.deice_pump1', 'sw.deice_pump2', 'sw.deice_windshield']) {
    await expect(control(page, id), id).toHaveCount(0);
  }
  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-state', 'pump2');
  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-state', 'pump1');
  // Nameless: the toggle prints nothing itself, the static placards name the positions.
  await expect(sw.locator('text')).toHaveCount(0);
  for (const id of ['deice_pump.pump2', 'deice_pump.pump1']) {
    await expect(page.locator(`[data-placard="${id}"]`), id).toHaveCount(1);
  }
});

test('de-ice MODE toggle reaches HIGH, NORM and OFF by a tap in the top, middle and bottom third', async ({
  page,
  hasTouch,
}) => {
  const mode = control(page, 'sw.deice_mode');
  const hit = page.locator('[data-hit="sw.deice_mode"]');
  await expect(mode).toHaveCount(1);
  await expect(mode).toHaveAttribute('data-state', 'off');
  await expect(page.locator('[data-control-id="lv.deice_mode"]')).toHaveCount(0);
  for (const [fraction, state] of [
    [1 / 6, 'high'],
    [1 / 2, 'norm'],
    [5 / 6, 'off'],
  ] as const) {
    const box = await hit.boundingBox();
    if (box === null) throw new Error('no hit box for the de-ice mode toggle');
    const position = { x: box.width / 2, y: box.height * fraction };
    if (hasTouch) await hit.tap({ position });
    else await hit.click({ position });
    await expect(mode, state).toHaveAttribute('data-state', state);
  }
  // Nameless: the toggle prints nothing itself, the static placards name the positions.
  await expect(mode.locator('text')).toHaveCount(0);
  for (const id of ['deice_mode.high', 'deice_mode.norm', 'deice_mode.off']) {
    await expect(page.locator(`[data-placard="${id}"]`), id).toHaveCount(1);
  }
});

test('de-ice ICE LIGHT toggle reaches ICE LIGHT, OFF and ANNUN-TEST by a tap in the top, middle and bottom third', async ({
  page,
  hasTouch,
}) => {
  const sw = control(page, 'sw.deice_ice_light');
  const hit = page.locator('[data-hit="sw.deice_ice_light"]');
  await expect(sw).toHaveCount(1);
  await expect(sw).toHaveAttribute('data-state', 'off');
  await expect(page.locator('[data-control-id="btn.deice_annun_test"]')).toHaveCount(0);
  for (const [fraction, state] of [
    [1 / 6, 'ice_light'],
    [1 / 2, 'off'],
    [5 / 6, 'annun_test'],
    [1 / 2, 'off'],
  ] as const) {
    const box = await hit.boundingBox();
    if (box === null) throw new Error('no hit box for the ICE LIGHT toggle');
    const position = { x: box.width / 2, y: box.height * fraction };
    if (hasTouch) await hit.tap({ position });
    else await hit.click({ position });
    await expect(sw, state).toHaveAttribute('data-state', state);
  }
  // Nameless: the toggle prints nothing itself, the static placards name the positions.
  await expect(sw.locator('text')).toHaveCount(0);
  for (const id of [
    'deice_ice_light.ice_light',
    'deice_ice_light.off',
    'deice_ice_light.annun_test',
  ]) {
    await expect(page.locator(`[data-placard="${id}"]`), id).toHaveCount(
      id.endsWith('test') ? 2 : 1,
    );
  }
});

test('WIND SHIELD, MAX and LEVEL show PRESSED while held and RELEASED after release', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, 'a touch cannot be held in Playwright; covered by the mouse projects');
  for (const id of ['btn.deice_windshield', 'btn.deice_max', 'btn.level']) {
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

test('a tap leaves WIND SHIELD, MAX and LEVEL RELEASED', async ({ page, hasTouch }) => {
  for (const id of ['btn.deice_windshield', 'btn.deice_max', 'btn.level']) {
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(control(page, id), id).toHaveAttribute('data-state', 'released');
  }
});

test('the de-ice unit shows the framed DE ICE heading and ALTERNATE as nine stacked letters', async ({
  page,
}) => {
  const heading = page.locator('[data-shell="plate-heading"][data-heading="deice"]');
  await expect(heading).toHaveCount(1);
  await expect(heading.locator('text')).toHaveText('DE ICE');
  await expect(heading.locator('rect')).toHaveAttribute('fill', 'none');
  const letters = page.locator('[data-placard="deice_alternate.name"]');
  await expect(letters).toHaveCount(9);
  expect((await letters.allTextContents()).join('')).toBe('ALTERNATE');
  // The old ALTERNATE name is no longer drawn by the switch itself.
  await expect(page.locator('[data-control-id="sw.deice_alternate"] text')).toHaveCount(0);
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
