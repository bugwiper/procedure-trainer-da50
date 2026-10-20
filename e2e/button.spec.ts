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
  await expect(button.locator('[data-state-text]')).toHaveText('RELEASED');

  await page.locator(`[data-hit="${START}"]`).hover();
  await page.mouse.down();
  await expect(button).toHaveAttribute('data-state', 'pressed');
  await expect(button.locator('[data-state-text]')).toHaveText('PRESSED');

  await page.mouse.up();
  await expect(button).toHaveAttribute('data-state', 'released');
  await expect(button.locator('[data-state-text]')).toHaveText('RELEASED');
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
  await expect(button.locator('[data-state-text]')).toHaveText('RELEASED');
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
