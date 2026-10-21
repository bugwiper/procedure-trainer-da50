import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here
// because the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
  state(): Record<string, string>;
  legal(): Record<string, string[]>;
}
type HookHost = { __panel?: PanelHook };

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

test('ENGINE MASTER flips by mouse or tap and shows its new state', async ({ page, hasTouch }) => {
  const sw = control(page, 'sw.engine_master');
  const hit = page.locator('[data-hit="sw.engine_master"]');
  await expect(sw).toHaveCount(1);
  await expect(sw).toHaveAttribute('data-state', 'on');

  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-state', 'off');

  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-state', 'on');
});

test('MFD PAGE softkey flips between MAP and ENGINE', async ({ page, hasTouch }) => {
  const key = control(page, 'sw.mfd_page');
  const hit = page.locator('[data-hit="sw.mfd_page"]');
  await expect(key).toHaveCount(1);
  await expect(key).toHaveAttribute('data-state', 'map');

  await activate(hit, hasTouch);
  await expect(key).toHaveAttribute('data-state', 'engine');

  await activate(hit, hasTouch);
  await expect(key).toHaveAttribute('data-state', 'map');
});

test('@hooks each accepted flip appends exactly one event', async ({ page, hasTouch }) => {
  const hit = page.locator('[data-hit="sw.engine_master"]');
  const count = () => page.evaluate(() => (globalThis as HookHost).__panel?.events().length ?? -1);
  const before = await count();
  expect(before).toBe(0);

  await activate(hit, hasTouch);
  await expect.poll(count).toBe(before + 1);
  await activate(hit, hasTouch);
  await expect.poll(count).toBe(before + 2);

  const events = await page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(events.map((e) => [e.id, e.value])).toEqual([
    ['sw.engine_master', 'off'],
    ['sw.engine_master', 'on'],
  ]);
});

test('@hooks every control reports only legal states', async ({ page, hasTouch }) => {
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);

  const { state, legal } = await page.evaluate(() => ({
    state: (globalThis as HookHost).__panel?.state() ?? {},
    legal: (globalThis as HookHost).__panel?.legal() ?? {},
  }));
  expect(Object.keys(state).length).toBeGreaterThan(0);
  for (const [id, value] of Object.entries(state)) {
    expect(legal[id], id).toContain(value);
  }
});

test('every plain toggle flips by mouse or tap', async ({ page, hasTouch }) => {
  const ids = await page
    .locator(
      '[data-kind="toggle"]:not([data-control-id="sw.elt"]):not([data-control-id="sw.deice_mode"]):not([data-control-id="sw.deice_ice_light"])',
    )
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-control-id') ?? ''));
  // The plain toggles of the instrument panel plus the MFD PAGE softkey; the three-position ELT
  // and the two de-ice toggles (mode, ICE LIGHT) are exercised by their own cases (e2e/guard.spec.ts,
  // e2e/switch-skins.spec.ts, e2e/inventory.spec.ts).
  expect(ids.length).toBeGreaterThanOrEqual(12);
  for (const id of ids) {
    const group = control(page, id);
    const before = (await group.getAttribute('data-state')) ?? '';
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(group, id).not.toHaveAttribute('data-state', before);
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(group, id).toHaveAttribute('data-state', before);
  }
});
