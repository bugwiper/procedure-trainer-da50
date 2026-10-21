import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { afterPairWindow } from './support/zoom';

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

/** Taps or clicks at a fraction of the height of the hit rectangle (0 top, 1 bottom). */
async function activateAt(target: Locator, hasTouch: boolean, fraction: number): Promise<void> {
  const box = await target.boundingBox();
  if (box === null) throw new Error('hit rectangle has no bounding box');
  const position = { x: box.width / 2, y: box.height * fraction };
  if (hasTouch) await target.tap({ position });
  else await target.click({ position });
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
  // The normal toggle under the red guard: the guarded position is up (off), the bat is the skin.
  await expect(sw).toHaveAttribute('data-skin', 'bat');
  await expect(guard).toHaveAttribute('data-state', 'closed');
  // While the guard is closed the covered switch has no tap target of its own.
  await expect(page.locator(`[data-hit="${SWITCH}"]`)).toHaveCount(0);

  // First tap lifts the guard; the switch does not move.
  await activate(page.locator(`[data-hit="${GUARD}"]`), hasTouch);
  await expect(guard).toHaveAttribute('data-state', 'open');
  await expect(sw).toHaveAttribute('data-state', 'off');

  // Second tap flips the switch; the guard stays up. (The cover and the switch share one pair key,
  // so two quick taps on that spot are a zoom, R3-Z3: wait out the pair window.)
  await afterPairWindow(page);
  await activate(page.locator(`[data-hit="${SWITCH}"]`), hasTouch);
  await expect(sw).toHaveAttribute('data-state', 'on');
  await expect(guard).toHaveAttribute('data-state', 'open');

  // The user closes the guard; the switch keeps its position.
  await afterPairWindow(page);
  await activate(page.locator(`[data-hit="${GUARD}"]`), hasTouch);
  await expect(guard).toHaveAttribute('data-state', 'closed');
  await expect(sw).toHaveAttribute('data-state', 'on');
  await expect(page.locator(`[data-hit="${SWITCH}"]`)).toHaveCount(0);

  // A tap on the covered switch can only lift the guard again.
  await afterPairWindow(page);
  const box = await sw.boundingBox();
  if (box === null) throw new Error('switch has no bounding box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expect(guard).toHaveAttribute('data-state', 'open');
  await expect(sw).toHaveAttribute('data-state', 'on');
});

test('@hooks the guard sequence appends exactly guard-open, switch-on, switch-off, guard-closed', async ({
  page,
  hasTouch,
}) => {
  const events = () => page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(await events()).toHaveLength(0);

  await activate(page.locator(`[data-hit="${GUARD}"]`), hasTouch);
  await afterPairWindow(page);
  await activate(page.locator(`[data-hit="${SWITCH}"]`), hasTouch);
  await expect(control(page, SWITCH)).toHaveAttribute('data-state', 'on');
  await afterPairWindow(page);
  await activate(page.locator(`[data-hit="${SWITCH}"]`), hasTouch);
  await expect(control(page, SWITCH)).toHaveAttribute('data-state', 'off');
  await afterPairWindow(page);
  await activate(page.locator(`[data-hit="${GUARD}"]`), hasTouch);
  await expect(control(page, GUARD)).toHaveAttribute('data-state', 'closed');

  const log = await events();
  expect(log.map((e) => [e.id, e.value])).toEqual([
    [GUARD, 'open'],
    [SWITCH, 'on'],
    [SWITCH, 'off'],
    [GUARD, 'closed'],
  ]);
});

test('ELECT. MASTER and ELT are unguarded and flip with one tap', async ({ page, hasTouch }) => {
  await expect(page.locator('[data-control-id="sw.elect_master.guard"]')).toHaveCount(0);
  await expect(page.locator('[data-control-id="sw.elt.guard"]')).toHaveCount(0);
  // The cockpit's only guarded switch is the de-ice ALTERNATE switch (D-07b).
  const guarded = await page
    .locator('[data-kind="guarded-toggle"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-control-id')));
  expect(guarded).toEqual([SWITCH]);

  const master = control(page, 'sw.elect_master');
  await expect(master).toHaveAttribute('data-state', 'on');
  await activate(page.locator('[data-hit="sw.elect_master"]'), hasTouch);
  await expect(master).toHaveAttribute('data-state', 'off');

  // The ELT has three positions (G-6): a tap in the top, middle and bottom third of its hit
  // rectangle sets ON, ARMED and RESET / TEST in turn, with no guard in between.
  const elt = control(page, 'sw.elt');
  const eltHit = page.locator('[data-hit="sw.elt"]');
  await expect(elt).toHaveAttribute('data-state', 'armed');
  await expect(elt).toHaveAttribute('data-pressed-half', 'level');
  await activateAt(eltHit, hasTouch, 1 / 6);
  await expect(elt).toHaveAttribute('data-state', 'on');
  await expect(elt).toHaveAttribute('data-pressed-half', 'upper');
  await afterPairWindow(page);
  await activateAt(eltHit, hasTouch, 1 / 2);
  await expect(elt).toHaveAttribute('data-state', 'armed');
  await expect(elt).toHaveAttribute('data-pressed-half', 'level');
  await afterPairWindow(page);
  await activateAt(eltHit, hasTouch, 5 / 6);
  await expect(elt).toHaveAttribute('data-state', 'reset_test');
  await expect(elt).toHaveAttribute('data-pressed-half', 'lower');
  // A tap on the position it already holds records no event.
  const count = () => page.evaluate(() => (globalThis as HookHost).__panel?.events().length ?? -1);
  const before = await count();
  await afterPairWindow(page);
  await activateAt(eltHit, hasTouch, 5 / 6);
  await expect(elt).toHaveAttribute('data-state', 'reset_test');
  expect(await count()).toBe(before);
});
