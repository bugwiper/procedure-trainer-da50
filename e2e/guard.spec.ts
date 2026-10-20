import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here
// because the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
}
type HookHost = { __panel?: PanelHook };

const SWITCH = 'sw.deice_alternate';
const GUARD = 'sw.deice_alternate.guard';

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

test('guard must be lifted before ALTERNATE moves and stays up until tapped', async ({
  page,
  hasTouch,
}) => {
  const sw = control(page, SWITCH);
  const guard = control(page, GUARD);
  await expect(sw).toHaveCount(1);
  await expect(guard).toHaveCount(1);
  await expect(guard).toHaveAttribute('data-kind', 'guard');
  await expect(page.locator(`[data-region-id="deice"] [data-control-id="${SWITCH}"]`)).toHaveCount(
    1,
  );
  await expect(sw).toHaveAttribute('data-state', 'off');
  await expect(guard).toHaveAttribute('data-state', 'closed');
  // While the guard is closed the covered switch has no tap target of its own.
  await expect(page.locator(`[data-hit="${SWITCH}"]`)).toHaveCount(0);

  // First tap lifts the guard; the switch does not move.
  await activate(page.locator(`[data-hit="${GUARD}"]`), hasTouch);
  await expect(guard).toHaveAttribute('data-state', 'open');
  await expect(sw).toHaveAttribute('data-state', 'off');
  await expect(guard.locator('[data-state-text]')).toHaveText('OPEN');

  // Second tap flips the switch; the guard stays up.
  await activate(page.locator(`[data-hit="${SWITCH}"]`), hasTouch);
  await expect(sw).toHaveAttribute('data-state', 'on');
  await expect(sw.locator('[data-state-text]')).toHaveText('ON');
  await expect(guard).toHaveAttribute('data-state', 'open');

  // The user closes the guard; the switch keeps its position.
  await activate(page.locator(`[data-hit="${GUARD}"]`), hasTouch);
  await expect(guard).toHaveAttribute('data-state', 'closed');
  await expect(guard.locator('[data-state-text]')).toHaveText('CLOSED');
  await expect(sw).toHaveAttribute('data-state', 'on');
  await expect(page.locator(`[data-hit="${SWITCH}"]`)).toHaveCount(0);

  // A tap on the covered switch can only lift the guard again.
  const box = await sw.boundingBox();
  if (box === null) throw new Error('switch has no bounding box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expect(guard).toHaveAttribute('data-state', 'open');
  await expect(sw).toHaveAttribute('data-state', 'on');
});

test('@hooks the guard sequence appends exactly guard-open, switch-on, guard-closed', async ({
  page,
  hasTouch,
}) => {
  const events = () => page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(await events()).toHaveLength(0);

  await activate(page.locator(`[data-hit="${GUARD}"]`), hasTouch);
  await activate(page.locator(`[data-hit="${SWITCH}"]`), hasTouch);
  await activate(page.locator(`[data-hit="${GUARD}"]`), hasTouch);
  await expect(control(page, GUARD)).toHaveAttribute('data-state', 'closed');

  const log = await events();
  expect(log.map((e) => [e.id, e.value])).toEqual([
    [GUARD, 'open'],
    [SWITCH, 'on'],
    [GUARD, 'closed'],
  ]);
});
