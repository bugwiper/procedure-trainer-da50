import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here
// because the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
  state(): Record<string, string>;
}
interface PageHost {
  __panel?: PanelHook;
  __pointerCancels?: number;
  addEventListener(type: string, listener: () => void): void;
  scrollY: number;
}

const WEBKIT_TOUCH_NOTE =
  'WebKit cannot emulate touch drags (RESEARCH Pitfall 3); the real-device check of plan 07 covers it';

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(target: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await target.tap();
  else await target.click();
}

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

interface Point {
  x: number;
  y: number;
}

async function centre(target: Locator): Promise<Point> {
  const box = await target.boundingBox();
  if (box === null) throw new Error('no bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Page point of a track fraction (0 = pos 0 end, 1 = pos 1 end), by linear interpolation
 * between the centres of the first and last marker targets of a lever.
 */
async function trackPoint(page: Page, id: string, ends: [string, string], fraction: number) {
  const a = await centre(page.locator(`[data-detent="${id}:${ends[0]}"]`));
  const b = await centre(page.locator(`[data-detent="${id}:${ends[1]}"]`));
  return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction };
}

const POWER_ENDS: [string, string] = ['p0', 'p100'];

async function mouseDrag(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 6, from.y + ((to.y - from.y) * i) / 6);
  }
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('POWER starts at the in-flight 70 %', async ({ page }) => {
  const power = control(page, 'lv.power');
  await expect(power).toHaveCount(1);
  await expect(power).toHaveAttribute('data-state', 'p70');
  await expect(power.locator('[data-state-text]')).toHaveText('70 %');
  await expect(page.locator('[data-detent^="lv.power:"]')).toHaveCount(3);
});

test('tapping a marker jumps POWER there', async ({ page, hasTouch }) => {
  const power = control(page, 'lv.power');
  await activate(page.locator('[data-detent="lv.power:p100"]'), hasTouch);
  await expect(power).toHaveAttribute('data-state', 'p100');
  await expect(power.locator('[data-state-text]')).toHaveText('100 %');

  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(power).toHaveAttribute('data-state', 'p50');
  await expect(power.locator('[data-state-text]')).toHaveText('50 %');
});

test('dragging the POWER handle snaps to the nearest 5 % step', async ({ page, hasTouch }) => {
  test.skip(hasTouch, WEBKIT_TOUCH_NOTE);
  const power = control(page, 'lv.power');
  const handle = page.locator('[data-hit="lv.power"]');

  await mouseDrag(page, await centre(handle), await trackPoint(page, 'lv.power', POWER_ENDS, 0.62));
  await expect(power).toHaveAttribute('data-state', 'p60');
  await expect(power.locator('[data-state-text]')).toHaveText('60 %');

  await mouseDrag(page, await centre(handle), await trackPoint(page, 'lv.power', POWER_ENDS, 0.9));
  await expect(power).toHaveAttribute('data-state', 'p90');
});

test('touch drag on POWER snaps without scrolling', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
  await page.evaluate(() => {
    const host = globalThis as unknown as PageHost;
    host.__pointerCancels = 0;
    host.addEventListener('pointercancel', () => {
      host.__pointerCancels = (host.__pointerCancels ?? 0) + 1;
    });
  });
  const from = await centre(page.locator('[data-hit="lv.power"]'));
  const to = await trackPoint(page, 'lv.power', POWER_ENDS, 0.9);

  const cdp = await page.context().newCDPSession(page);
  const touch = (x: number, y: number) => [{ x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: touch(from.x, from.y),
  });
  for (let i = 1; i <= 6; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touch(from.x + ((to.x - from.x) * i) / 6, from.y + ((to.y - from.y) * i) / 6),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p90');
  const after = await page.evaluate(() => {
    const host = globalThis as unknown as PageHost;
    return { scrollY: host.scrollY, cancels: host.__pointerCancels ?? -1 };
  });
  expect(after).toEqual({ scrollY: 0, cancels: 0 });
});

test('@hooks a drag back to the starting detent appends no event and a drag to a new detent appends one', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, WEBKIT_TOUCH_NOTE);
  const handle = page.locator('[data-hit="lv.power"]');
  const count = () =>
    page.evaluate(() => (globalThis as unknown as PageHost).__panel?.events().length ?? -1);
  expect(await count()).toBe(0);

  // Out to 90 % and back to the starting 70 %: in-progress positions never reach the log.
  const start = await centre(handle);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const far = await trackPoint(page, 'lv.power', POWER_ENDS, 0.9);
  await page.mouse.move(far.x, far.y, { steps: 5 });
  expect(await count()).toBe(0);
  await page.mouse.move(start.x, start.y, { steps: 5 });
  await page.mouse.up();
  expect(await count()).toBe(0);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p70');

  await mouseDrag(page, await centre(handle), far);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p90');
  expect(await count()).toBe(1);
  const events = await page.evaluate(
    () => (globalThis as unknown as PageHost).__panel?.events() ?? [],
  );
  expect(events.map((e) => [e.id, e.value])).toEqual([['lv.power', 'p90']]);
});
