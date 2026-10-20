import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Region zoom (PNL-09, PNL-06, D-20, D-21): tap or click a region's background to zoom in,
// operate its controls at full tap size, zoom back out; pinch, pan and gesture arbitration.

const FULL_VIEWBOX = '0 0 2000 1300';
const MIN_TAP_PX = 43.5;
const PORTRAIT_NOTE =
  'Portrait phones are covered by the rotate hint (D-02); pinch zoom reaches full tap size there';

interface Point {
  x: number;
  y: number;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

function viewBoxOf(page: Page): Promise<string | null> {
  return page.getByTestId('panel').getAttribute('viewBox');
}

/**
 * A page point inside the region's frame that is visible on screen, outside the "Full panel"
 * button and as far as possible from every tap target of the whole panel (at least 1.5 px), away from the frame edge.
 */
async function backgroundPoint(page: Page, regionId: string): Promise<Point> {
  const point = await page.evaluate((id) => {
    const region = document.querySelector(`[data-region-id="${id}"]`);
    if (region === null) return null;
    const frame = region.querySelector('[data-region-frame]');
    if (frame === null) return null;
    const box = frame.getBoundingClientRect();
    const targets = Array.from(document.querySelectorAll('[data-hit], [data-detent]')).map((el) =>
      el.getBoundingClientRect(),
    );
    const button = document.querySelector('[data-testid="zoom-out"]')?.getBoundingClientRect();
    const screenW = document.documentElement.clientWidth;
    const screenH = document.documentElement.clientHeight - 28;
    const clearance = (x: number, y: number): number => {
      let best = Infinity;
      for (const t of targets) {
        const dx = Math.max(t.left - x, 0, x - t.right);
        const dy = Math.max(t.top - y, 0, y - t.bottom);
        best = Math.min(best, Math.hypot(dx, dy));
      }
      return best;
    };
    let found: { x: number; y: number } | null = null;
    let bestClearance = 1.5;
    const steps = 48;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const x = box.left + (0.1 + (0.8 * (i + 0.5)) / steps) * box.width;
        const y = box.top + (0.1 + (0.8 * (j + 0.5)) / steps) * box.height;
        if (x < 2 || y < 2 || x > screenW - 2 || y > screenH - 2) continue;
        const underButton =
          button !== undefined &&
          x >= button.left - 4 &&
          x <= button.right + 4 &&
          y >= button.top - 4 &&
          y <= button.bottom + 4;
        if (underButton) continue;
        const c = clearance(x, y);
        if (c > bestClearance) {
          bestClearance = c;
          found = { x, y };
        }
      }
    }
    return found;
  }, regionId);
  if (point === null) throw new Error(`no background point in region ${regionId}`);
  return point;
}

async function activateAt(page: Page, p: Point, hasTouch: boolean): Promise<void> {
  if (hasTouch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

async function activate(target: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await target.tap();
  else await target.click();
}

async function doubleActivateAt(page: Page, p: Point, hasTouch: boolean): Promise<void> {
  if (hasTouch) {
    await page.touchscreen.tap(p.x, p.y);
    await page.touchscreen.tap(p.x, p.y);
  } else {
    await page.mouse.dblclick(p.x, p.y);
  }
}

async function sizes(
  page: Page,
  regionId: string,
): Promise<{ id: string; w: number; h: number }[]> {
  return page
    .locator(`[data-region-id="${regionId}"]`)
    .locator('[data-hit], [data-detent]')
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.getAttribute('data-hit') ?? el.getAttribute('data-detent') ?? '',
          w: r.width,
          h: r.height,
        };
      }),
    );
}

type TouchType = 'touchStart' | 'touchMove' | 'touchEnd';
type TouchSender = (type: TouchType, points: Point[]) => Promise<void>;

/** Chromium touch emulation by CDP; point i has touch id i + 1. */
async function touchSender(page: Page): Promise<TouchSender> {
  const cdp = await page.context().newCDPSession(page);
  return async (type, points) => {
    await cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })),
    });
  };
}

async function viewNumbers(page: Page): Promise<{ x: number; y: number; w: number; h: number }> {
  const raw = (await viewBoxOf(page)) ?? '';
  const [x, y, w, h] = raw.split(' ').map(Number);
  return { x: x ?? NaN, y: y ?? NaN, w: w ?? NaN, h: h ?? NaN };
}

async function frameCentre(page: Page, regionId: string): Promise<Point> {
  const box = await page
    .locator(`[data-region-id="${regionId}"] [data-region-frame]`)
    .boundingBox();
  if (box === null) throw new Error('no frame box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function pointArgs(p: Point): [number, number] {
  return [p.x, p.y];
}

function centreOf(b: Box): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Two fingers on a horizontal line about `centre`, moving from `fromGap` to `toGap` apart. */
async function pinch(page: Page, centre: Point, fromGap: number, toGap: number): Promise<void> {
  const send = await touchSender(page);
  const pair = (gap: number): Point[] => [
    { x: centre.x - gap / 2, y: centre.y },
    { x: centre.x + gap / 2, y: centre.y },
  ];
  await send('touchStart', pair(fromGap));
  for (let i = 1; i <= 8; i++) {
    await send('touchMove', pair(fromGap + ((toGap - fromGap) * i) / 8));
  }
  await send('touchEnd', []);
}

async function eventCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (globalThis as unknown as { __panel?: { events(): unknown[] } }).__panel?.events().length ??
      -1,
  );
}

async function stateSnapshot(page: Page): Promise<string> {
  return page.evaluate(() =>
    JSON.stringify(
      (globalThis as unknown as { __panel?: { state(): unknown } }).__panel?.state() ?? null,
    ),
  );
}

async function regionsWithControls(page: Page): Promise<string[]> {
  return page
    .locator('[data-region-id]')
    .evaluateAll((els) =>
      els
        .filter((el) => el.querySelector('[data-hit], [data-detent]') !== null)
        .map((el) => el.getAttribute('data-region-id') ?? ''),
    );
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('a region tap or click zooms into it', async ({ page, hasTouch }, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  expect(await viewBoxOf(page)).toBe(FULL_VIEWBOX);
  await expect(page.getByTestId('zoom-out')).toHaveCount(0);

  await activateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  for (const s of await sizes(page, 'switch_bank')) {
    expect(s.w, s.id).toBeGreaterThanOrEqual(MIN_TAP_PX);
    expect(s.h, s.id).toBeGreaterThanOrEqual(MIN_TAP_PX);
  }

  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'off');

  await activate(page.getByTestId('zoom-out'), hasTouch);
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'off');
  await expect(page.getByTestId('zoom-out')).toHaveCount(0);
});

test('desktop mouse: click to zoom, click a control, Full panel', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop-'), 'desktop mouse path (D-21)');
  const p = await backgroundPoint(page, 'switch_bank');
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  for (const s of await sizes(page, 'switch_bank')) {
    expect(s.w, s.id).toBeGreaterThanOrEqual(MIN_TAP_PX);
    expect(s.h, s.id).toBeGreaterThanOrEqual(MIN_TAP_PX);
  }
  await page.locator('[data-hit="sw.engine_master"]').click();
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'off');
  await page.getByTestId('zoom-out').click();
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'off');
});

test('every region with controls reaches full tap size when zoomed', async ({
  page,
  hasTouch,
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  const regions = await regionsWithControls(page);
  expect(regions.length).toBeGreaterThanOrEqual(8);
  for (const id of regions) {
    if ((await page.getByTestId('zoom-out').count()) > 0) {
      await activate(page.getByTestId('zoom-out'), hasTouch);
      await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
    }
    await activateAt(page, await backgroundPoint(page, id), hasTouch);
    await expect(page.getByTestId('panel'), id).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
    for (const s of await sizes(page, id)) {
      expect(s.w, `${id} ${s.id}`).toBeGreaterThanOrEqual(MIN_TAP_PX);
      expect(s.h, `${id} ${s.id}`).toBeGreaterThanOrEqual(MIN_TAP_PX);
    }
    // The "Full panel" button must not cover any control of the zoomed region.
    const covered = await page.evaluate((regionId) => {
      const button = document.querySelector('[data-testid="zoom-out"]')?.getBoundingClientRect();
      if (button === undefined) return ['no zoom-out button'];
      const region = document.querySelector(`[data-region-id="${regionId}"]`);
      const hits = Array.from(region?.querySelectorAll('[data-hit], [data-detent]') ?? []);
      return hits
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.left < button.right &&
            r.right > button.left &&
            r.top < button.bottom &&
            r.bottom > button.top
          );
        })
        .map((el) => el.getAttribute('data-hit') ?? el.getAttribute('data-detent') ?? '');
    }, id);
    expect(covered, `${id} covered by Full panel`).toEqual([]);
  }
});

test('pinch zooms and pans the view', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
  const centre = await frameCentre(page, 'mfd');
  await pinch(page, centre, 30, 150);
  const zoomed = await viewNumbers(page);
  expect(zoomed.w).toBeLessThan(1000);
  await expect(page.getByTestId('zoom-out')).toBeVisible();

  // One finger drag on the background pans while zoomed: content follows the finger.
  const send = await touchSender(page);
  await send('touchStart', [centre]);
  for (let i = 1; i <= 6; i++) await send('touchMove', [{ x: centre.x - i * 15, y: centre.y }]);
  await send('touchEnd', []);
  const panned = await viewNumbers(page);
  expect(panned.x).toBeGreaterThan(zoomed.x + 1);
  expect(panned.w).toBeCloseTo(zoomed.w);

  // Bringing the fingers together zooms back out.
  await pinch(page, centre, 150, 30);
  const out = await viewNumbers(page);
  expect(out.w).toBeGreaterThan(panned.w);
});

/** Lets the tap suppression window (350 ms) of an earlier tap-driven zoom change pass. */
async function afterSuppression(page: Page): Promise<void> {
  await page.waitForTimeout(450);
}

test('a single tap or click on the background while zoomed zooms fully out', async ({
  page,
  hasTouch,
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  await activateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  await afterSuppression(page);
  await activateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  await expect(page.getByTestId('zoom-out')).toHaveCount(0);
});

test('a double tap while zoomed ends at the full view', async ({ page, hasTouch }, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  await activateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  await afterSuppression(page);
  await doubleActivateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  // The second tap of the double tap is suppressed: the view stays at the full panel.
  await page.waitForTimeout(300);
  expect(await viewBoxOf(page)).toBe(FULL_VIEWBOX);
});

test('from an intermediate pinch level a single tap zooms fully out', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
  await pinch(page, await frameCentre(page, 'mfd'), 30, 100);
  const mid = await viewNumbers(page);
  expect(mid.w).toBeLessThan(2000);
  expect(mid.w).toBeGreaterThan(300);
  await expect(page.getByTestId('zoom-out')).toBeVisible();
  await page.touchscreen.tap(...pointArgs(await backgroundPoint(page, 'mfd')));
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
});

test('a background drag while zoomed pans and does not zoom out', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop mouse path');
  const click = await backgroundPoint(page, 'mfd');
  await page.mouse.click(click.x, click.y);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  await afterSuppression(page);
  const zoomed = await viewNumbers(page);
  const from = await backgroundPoint(page, 'mfd');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 60, from.y - 20, { steps: 6 });
  await page.mouse.up();
  const panned = await viewNumbers(page);
  expect(panned.w).toBeCloseTo(zoomed.w);
  expect(panned.x !== zoomed.x || panned.y !== zoomed.y).toBe(true);
  await expect(page.getByTestId('zoom-out')).toBeVisible();
});

test('the Full panel button stays above the footer and the rotate hint', async ({
  page,
  hasTouch,
}, testInfo) => {
  await activateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  const button = page.getByTestId('zoom-out');
  await expect(button).toBeVisible();

  const report = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="zoom-out"]');
    if (el === null) return null;
    const b = el.getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    const intersects = (r: DOMRect): boolean =>
      r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
    const footer = document.querySelector('.footer')?.getBoundingClientRect();
    const hint = document.querySelector('[data-testid="rotate-hint"]');
    const hintBox =
      hint !== null && getComputedStyle(hint).display !== 'none'
        ? hint.getBoundingClientRect()
        : null;
    return {
      topmost: hit !== null && (hit === el || el.contains(hit)),
      footerOverlap: footer === undefined ? true : intersects(footer),
      hintOverlap: hintBox === null ? false : intersects(hintBox),
      inViewport:
        b.left >= 0 &&
        b.top >= 0 &&
        b.right <= document.documentElement.clientWidth &&
        b.bottom <= document.documentElement.clientHeight,
    };
  });
  expect(report).not.toBeNull();
  expect(report?.topmost, 'button is hit-testable at its centre').toBe(true);
  expect(report?.footerOverlap, 'button intersects footer').toBe(false);
  expect(report?.hintOverlap, 'button intersects rotate hint').toBe(false);
  expect(report?.inViewport, 'button inside viewport').toBe(true);
  if (testInfo.project.name === 'phone-portrait') {
    await expect(page.getByTestId('rotate-hint')).toBeVisible();
  }

  await activate(button, hasTouch);
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
});

test('a lever drag while zoomed is never hijacked', async ({ page }, testInfo) => {
  const name = testInfo.project.name;
  test.skip(name !== 'phone-chromium' && name !== 'desktop-chromium', 'Chromium drags only');
  const touch = name === 'phone-chromium';
  await activateAt(page, await backgroundPoint(page, 'pedestal'), touch);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  const before = await viewBoxOf(page);
  const spare = await backgroundPoint(page, 'pedestal');

  const handle = await page.locator('[data-hit="lv.power"]').boundingBox();
  const low = await page.locator('[data-detent="lv.power:p0"]').boundingBox();
  const high = await page.locator('[data-detent="lv.power:p100"]').boundingBox();
  if (handle === null || low === null || high === null) throw new Error('no lever boxes');
  const from = centreOf(handle);
  const a = centreOf(low);
  const b = centreOf(high);
  const along = (f: number): Point => ({
    x: from.x + (a.x + (b.x - a.x) * 0.9 - from.x) * f,
    y: from.y + (a.y + (b.y - a.y) * 0.9 - from.y) * f,
  });
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p70');

  if (touch) {
    const send = await touchSender(page);
    await send('touchStart', [from]);
    await send('touchMove', [along(0.3)]);
    // A second finger lands on the background during the drag: no pinch starts.
    await send('touchStart', [along(0.3), spare]);
    for (let i = 1; i <= 4; i++) {
      await send('touchMove', [along(0.3 + (0.7 * i) / 4), { x: spare.x + i * 10, y: spare.y }]);
    }
    await send('touchEnd', []);
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(along(1).x, along(1).y, { steps: 8 });
    await page.mouse.up();
  }
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p90');
  expect(await viewBoxOf(page)).toBe(before);
});

test('@hooks zoom gestures emit no control events', async ({ page }, testInfo) => {
  const name = testInfo.project.name;
  test.skip(name !== 'phone-chromium' && name !== 'desktop-chromium', 'Chromium gestures only');
  const touch = name === 'phone-chromium';
  const states = await stateSnapshot(page);
  expect(await eventCount(page)).toBe(0);

  // Region tap or click.
  await activateAt(page, await backgroundPoint(page, 'mfd'), touch);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);

  // Pan.
  const from = await backgroundPoint(page, 'mfd');
  if (touch) {
    const send = await touchSender(page);
    await send('touchStart', [from]);
    for (let i = 1; i <= 6; i++) await send('touchMove', [{ x: from.x - i * 10, y: from.y }]);
    await send('touchEnd', []);
    // Pinch (touch only).
    await pinch(page, await frameCentre(page, 'mfd'), 30, 120);
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 40, from.y, { steps: 5 });
    await page.mouse.up();
  }

  // A single tap or click while zoomed zooms fully out.
  await activateAt(page, await backgroundPoint(page, 'mfd'), touch);
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  await afterSuppression(page);

  // Zoom in again and out with the button.
  await activateAt(page, await backgroundPoint(page, 'mfd'), touch);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  await activate(page.getByTestId('zoom-out'), touch);
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);

  expect(await eventCount(page)).toBe(0);
  expect(await stateSnapshot(page)).toBe(states);
});
