import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here
// because the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
}
type HookHost = { __panel?: PanelHook };

const START = 'btn.engine_start';
const FADEC_TEST = 'btn.fadec_test';

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

test('ENGINE START shows PRESSED while held and RELEASED after release', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, 'a touch cannot be held in Playwright; covered by the mouse projects');
  const button = control(page, START);
  await expect(button).toHaveAttribute('data-state', 'released');

  await page.locator(`[data-hit="${START}"]`).hover();
  await page.mouse.down();
  await expect(button).toHaveAttribute('data-state', 'pressed');

  await page.mouse.up();
  await expect(button).toHaveAttribute('data-state', 'released');
});

test('releasing outside the button still releases ENGINE START', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'mouse drag-off path');
  const button = control(page, START);
  const hit = page.locator(`[data-hit="${START}"]`);
  await hit.hover();
  const box = await hit.boundingBox();
  if (box === null) throw new Error('no hit box');
  await page.mouse.down();
  await expect(button).toHaveAttribute('data-state', 'pressed');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 200, { steps: 6 });
  await page.mouse.up();
  await expect(button).toHaveAttribute('data-state', 'released');
});

test('a tap leaves FADEC TEST RELEASED', async ({ page, hasTouch }) => {
  const button = control(page, FADEC_TEST);
  await expect(button).toHaveCount(1);
  await expect(button).toHaveAttribute('data-state', 'released');
  await activate(page.locator(`[data-hit="${FADEC_TEST}"]`), hasTouch);
  await expect(button).toHaveAttribute('data-state', 'released');
});

test('@hooks one press appends exactly pressed then released', async ({ page, hasTouch }) => {
  const events = () => page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(await events()).toHaveLength(0);

  await activate(page.locator(`[data-hit="${FADEC_TEST}"]`), hasTouch);
  await activate(page.locator(`[data-hit="${START}"]`), hasTouch);
  await expect(control(page, START)).toHaveAttribute('data-state', 'released');

  const log = await events();
  expect(log.map((e) => [e.id, e.value])).toEqual([
    [FADEC_TEST, 'pressed'],
    [FADEC_TEST, 'released'],
    [START, 'pressed'],
    [START, 'released'],
  ]);
});

test('@hooks the black MAX button records one pressed and one released and lights no lamp', async ({
  page,
  hasTouch,
}) => {
  const events = () => page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  const id = 'btn.deice_max';
  const button = control(page, id);
  await expect(button).toHaveCount(1);
  await expect(button).toHaveAttribute('data-skin', 'black-dome');
  await expect(button.locator('text')).toHaveText('MAX');
  await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
  await expect(button).toHaveAttribute('data-state', 'released');
  expect((await events()).map((e) => [e.id, e.value])).toEqual([
    [id, 'pressed'],
    [id, 'released'],
  ]);
  // Pressing MAX alone lights none of the de-ice lamps (the run is engine behaviour).
  for (const lamp of ['lt.deice_max', 'lt.deice_high', 'lt.deice_norm']) {
    await expect(page.locator(`[data-indicator-id="${lamp}"]`)).toHaveAttribute(
      'data-lit',
      'false',
    );
  }
});

const SPRING = 'btn.stall_gear_test';

/** Press the mouse at a fraction of the hit box width (0 left edge, 1 right edge). */
async function pressAt(page: Page, id: string, fraction: number): Promise<void> {
  const box = await page.locator(`[data-hit="${id}"]`).boundingBox();
  if (box === null) throw new Error(`no hit box for ${id}`);
  await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
  await page.mouse.down();
}

test('holding the left half of the spring toggle shows STALL TEST, release returns NEUTRAL', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, 'a touch cannot be held in Playwright; covered by the mouse projects');
  const toggle = control(page, SPRING);
  await expect(toggle).toHaveAttribute('data-state', 'neutral');

  await pressAt(page, SPRING, 0.25);
  await expect(toggle).toHaveAttribute('data-state', 'stall_test');

  await page.mouse.up();
  await expect(toggle).toHaveAttribute('data-state', 'neutral');
});

test('holding the right half of the spring toggle shows GEAR TEST', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'a touch cannot be held in Playwright; covered by the mouse projects');
  const toggle = control(page, SPRING);
  await pressAt(page, SPRING, 0.75);
  await expect(toggle).toHaveAttribute('data-state', 'gear_test');
  await page.mouse.up();
  await expect(toggle).toHaveAttribute('data-state', 'neutral');
});

test('a pointercancel during the hold returns the spring toggle to NEUTRAL', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, 'a touch cannot be held in Playwright; covered by the mouse projects');
  const toggle = control(page, SPRING);
  await pressAt(page, SPRING, 0.75);
  await expect(toggle).toHaveAttribute('data-state', 'gear_test');
  await page.evaluate((id) => {
    const hit = document.querySelector(`[data-hit="${id}"]`);
    hit?.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, isPrimary: true }));
  }, SPRING);
  await expect(toggle).toHaveAttribute('data-state', 'neutral');
  await page.mouse.up();
  await expect(toggle).toHaveAttribute('data-state', 'neutral');
});

test('@hooks one hold of the spring toggle appends exactly the side, then neutral', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, 'a touch cannot be held in Playwright; covered by the mouse projects');
  const events = () => page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(await events()).toHaveLength(0);

  await pressAt(page, SPRING, 0.25);
  await expect(control(page, SPRING)).toHaveAttribute('data-state', 'stall_test');
  await page.mouse.up();
  await expect(control(page, SPRING)).toHaveAttribute('data-state', 'neutral');
  await pressAt(page, SPRING, 0.75);
  await page.mouse.up();
  await expect(control(page, SPRING)).toHaveAttribute('data-state', 'neutral');

  expect((await events()).map((e) => [e.id, e.value])).toEqual([
    [SPRING, 'stall_test'],
    [SPRING, 'neutral'],
    [SPRING, 'gear_test'],
    [SPRING, 'neutral'],
  ]);
});
