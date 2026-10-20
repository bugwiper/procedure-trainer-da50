import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here
// because the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
  state(): Record<string, string>;
}
type HookHost = { __panel?: PanelHook };

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(
  target: Locator,
  hasTouch: boolean,
  position?: { x: number; y: number },
): Promise<void> {
  if (hasTouch) await target.tap(position === undefined ? undefined : { position });
  else await target.click(position === undefined ? undefined : { position });
}

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

async function eventCount(page: Page): Promise<number> {
  return page.evaluate(() => (globalThis as HookHost).__panel?.events().length ?? -1);
}

async function box(target: Locator): Promise<{ x: number; y: number; w: number; h: number }> {
  const b = await target.boundingBox();
  if (b === null) throw new Error('no bounding box');
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

/** Taps the right (clockwise) or left half of a knob, at 75 or 25 percent of its width. */
async function tapHalf(
  page: Page,
  id: string,
  half: 'right' | 'left',
  hasTouch: boolean,
): Promise<void> {
  const hit = page.locator(`[data-hit="${id}"]`);
  const b = await box(hit);
  await activate(hit, hasTouch, { x: b.w * (half === 'right' ? 0.75 : 0.25), y: b.h / 2 });
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('FUEL TRANS is a knob that starts OFF and toggles ON and OFF by tap or click', async ({
  page,
  hasTouch,
}) => {
  const knob = control(page, 'sw.fuel_trans');
  const hit = page.locator('[data-hit="sw.fuel_trans"]');
  await expect(knob).toHaveCount(1);
  await expect(knob).toHaveAttribute('data-kind', 'rotary');
  await expect(knob).toHaveAttribute('data-state', 'off');
  await expect(knob.locator('[data-state-text]')).toHaveText('OFF');

  await activate(hit, hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'on');
  await expect(knob.locator('[data-state-text]')).toHaveText('ON');

  await activate(hit, hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'off');
  await expect(knob.locator('[data-state-text]')).toHaveText('OFF');
});

test('a two-stop knob toggles from either half', async ({ page, hasTouch }) => {
  const knob = control(page, 'sw.fuel_trans');
  await tapHalf(page, 'sw.fuel_trans', 'left', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'on');
  await tapHalf(page, 'sw.fuel_trans', 'left', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'off');
  await tapHalf(page, 'sw.fuel_trans', 'right', hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'on');
});

test('@hooks each tap on FUEL TRANS appends exactly one event, a cancelled pointer none', async ({
  page,
  hasTouch,
}) => {
  const hit = page.locator('[data-hit="sw.fuel_trans"]');
  expect(await eventCount(page)).toBe(0);

  await activate(hit, hasTouch);
  await expect.poll(() => eventCount(page)).toBe(1);
  await activate(hit, hasTouch);
  await expect.poll(() => eventCount(page)).toBe(2);

  // A pointer that goes down and is cancelled records nothing, even if a pointerup follows.
  await hit.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const init = {
      pointerId: 91,
      isPrimary: true,
      bubbles: true,
      clientX: r.left + r.width * 0.75,
      clientY: r.top + r.height / 2,
    };
    el.dispatchEvent(new PointerEvent('pointerdown', init));
    el.dispatchEvent(new PointerEvent('pointercancel', init));
    el.dispatchEvent(new PointerEvent('pointerup', init));
  });
  expect(await eventCount(page)).toBe(2);

  const events = await page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(events.map((e) => [e.id, e.value])).toEqual([
    ['sw.fuel_trans', 'on'],
    ['sw.fuel_trans', 'off'],
  ]);
});
