import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PANEL_VIEWBOX } from '../tests/layout-reference';
import {
  FULL_VIEWBOX,
  activate,
  activateAt,
  backgroundPoint,
  buttonCoverage,
  doubleActivateAt,
  zoomIntoRegion,
} from './support/zoom';
import type { Point } from './support/zoom';

// Region zoom (PNL-09, PNL-06, D-20, D-21, R2-Z1): double click or double tap a region's
// background to zoom in, operate its controls at full tap size, zoom back out; a single click or
// tap never zooms; pinch, pan and gesture arbitration.

const MIN_TAP_PX = 43.5;
const PORTRAIT_NOTE =
  'Portrait phones are covered by the rotate hint (D-02); pinch zoom reaches full tap size there';

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

test('a double click or double tap on a region background zooms into it', async ({
  page,
  hasTouch,
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  expect(await viewBoxOf(page)).toBe(FULL_VIEWBOX);
  await expect(page.getByTestId('zoom-out')).toHaveCount(0);

  await doubleActivateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  for (const s of await sizes(page, 'switch_bank')) {
    expect(s.w, s.id).toBeGreaterThanOrEqual(MIN_TAP_PX);
    expect(s.h, s.id).toBeGreaterThanOrEqual(MIN_TAP_PX);
  }

  // One tap on a control records one change.
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'off');

  await activate(page.getByTestId('zoom-out'), hasTouch);
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'off');
  await expect(page.getByTestId('zoom-out')).toHaveCount(0);
});

test('desktop mouse: double click to zoom, click a control, Full panel', async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop-'), 'desktop mouse path (D-21)');
  const p = await backgroundPoint(page, 'switch_bank');
  await page.mouse.dblclick(p.x, p.y);
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
    await zoomIntoRegion(page, hasTouch, id);
    const measured = await sizes(page, id);
    for (const s of measured) {
      expect(s.w, `${id} ${s.id}`).toBeGreaterThanOrEqual(MIN_TAP_PX);
      expect(s.h, `${id} ${s.id}`).toBeGreaterThanOrEqual(MIN_TAP_PX);
    }
    // The four FAN click spots are measured one by one (R2-4.1).
    if (id === 'env_control') {
      const ids = measured.map((s) => s.id);
      for (const stop of ['off', 'f1', 'f2', 'f3']) expect(ids).toContain(`sw.env_fan:${stop}`);
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

test('the Full panel button covers no control hit in any region', async ({
  page,
  hasTouch,
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  const ids = await page
    .locator('[data-region-id]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-region-id') ?? ''));
  expect(ids.length).toBeGreaterThanOrEqual(8);
  for (const id of ids) {
    await zoomIntoRegion(page, hasTouch, id);
    expect(await buttonCoverage(page), `${id} covered by Full panel`).toEqual([]);
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
        corner: el.getAttribute('data-corner'),
      };
    });
    expect(report, id).not.toBeNull();
    expect(report?.topmost, `${id}: button is topmost at its centre`).toBe(true);
    expect(report?.footerOverlap, `${id}: button intersects footer`).toBe(false);
    expect(report?.hintOverlap, `${id}: button intersects rotate hint`).toBe(false);
    expect(report?.inViewport, `${id}: button inside viewport`).toBe(true);
    expect(['tr', 'br', 'bl'], `${id}: corner`).toContain(report?.corner);
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

/** Lets the double-tap window (350 ms) of an earlier tap pass, so the next tap starts a new pair. */
async function afterPairWindow(page: Page): Promise<void> {
  await page.waitForTimeout(450);
}

test('a single click or tap on the background never zooms', async ({
  page,
  hasTouch,
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  // Full view: one tap, then a second one after the pair window.
  await activateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
  await page.waitForTimeout(120);
  expect(await viewBoxOf(page)).toBe(FULL_VIEWBOX);
  await afterPairWindow(page);
  await activateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
  await page.waitForTimeout(120);
  expect(await viewBoxOf(page)).toBe(FULL_VIEWBOX);
  await expect(page.getByTestId('zoom-out')).toHaveCount(0);

  // Zoomed: one tap does not zoom out, and neither does a second one after the pair window.
  // (The helper's first tap must not pair with the tap above, so let the window pass first.)
  await afterPairWindow(page);
  await zoomIntoRegion(page, hasTouch, 'switch_bank');
  const zoomed = await viewBoxOf(page);
  await afterPairWindow(page);
  await activateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
  await page.waitForTimeout(120);
  expect(await viewBoxOf(page)).toBe(zoomed);
  await afterPairWindow(page);
  await activateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
  await page.waitForTimeout(120);
  expect(await viewBoxOf(page)).toBe(zoomed);
  await expect(page.getByTestId('zoom-out')).toBeVisible();
});

test('a double click or double tap while zoomed zooms fully out', async ({
  page,
  hasTouch,
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  await zoomIntoRegion(page, hasTouch, 'switch_bank');
  await afterPairWindow(page);
  await doubleActivateAt(page, await backgroundPoint(page, 'switch_bank'), hasTouch);
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  await expect(page.getByTestId('zoom-out')).toHaveCount(0);
  // The pair is consumed: the view stays at the full panel.
  await page.waitForTimeout(300);
  expect(await viewBoxOf(page)).toBe(FULL_VIEWBOX);
});

test('a second tap later than the pair window does nothing', async ({
  page,
  hasTouch,
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  const p = await backgroundPoint(page, 'switch_bank');
  await activateAt(page, p, hasTouch);
  await afterPairWindow(page);
  await activateAt(page, p, hasTouch);
  await page.waitForTimeout(120);
  expect(await viewBoxOf(page)).toBe(FULL_VIEWBOX);
});

test('a double tap in no region does nothing', async ({ page, hasTouch }, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  // The top-left corner of the page lies outside every region frame of the panel.
  const outside = await page.evaluate(() => {
    const frames = Array.from(document.querySelectorAll('[data-region-frame]')).map((el) =>
      el.getBoundingClientRect(),
    );
    const svg = document.querySelector('[data-testid="panel"]')?.getBoundingClientRect();
    if (svg === undefined) return null;
    for (let i = 0; i < 40; i++) {
      for (let j = 0; j < 40; j++) {
        const x = svg.left + ((i + 0.5) * svg.width) / 40;
        const y = svg.top + ((j + 0.5) * svg.height) / 40;
        const onTarget = document
          .elementsFromPoint(x, y)
          .some((el) => el.matches('[data-hit], [data-detent]'));
        const inFrame = frames.some(
          (f) => x >= f.left && x <= f.right && y >= f.top && y <= f.bottom,
        );
        if (!inFrame && !onTarget) return { x, y };
      }
    }
    return null;
  });
  test.skip(outside === null, 'every sampled point of the panel lies inside a region');
  if (outside === null) return;
  await doubleActivateAt(page, outside, hasTouch);
  await page.waitForTimeout(150);
  expect(await viewBoxOf(page)).toBe(FULL_VIEWBOX);
});

test('from an intermediate pinch level a double tap zooms fully out', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'phone-chromium', 'Chromium touch emulation only');
  await pinch(page, await frameCentre(page, 'mfd'), 30, 100);
  const mid = await viewNumbers(page);
  expect(mid.w).toBeLessThan(PANEL_VIEWBOX.w);
  expect(mid.w).toBeGreaterThan(300);
  await expect(page.getByTestId('zoom-out')).toBeVisible();
  const p = await backgroundPoint(page, 'mfd');
  await page.touchscreen.tap(...pointArgs(p));
  await afterPairWindow(page);
  expect(await viewNumbers(page)).toEqual(mid);
  await doubleActivateAt(page, p, true);
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
});

test('a background drag while zoomed pans and does not zoom out', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop mouse path');
  await zoomIntoRegion(page, false, 'mfd');
  await afterPairWindow(page);
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
  await zoomIntoRegion(page, hasTouch, 'switch_bank');
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
  await zoomIntoRegion(page, touch, 'pedestal');
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

  // Double click or double tap zooms in.
  await doubleActivateAt(page, await backgroundPoint(page, 'mfd'), touch);
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

  // A double click or double tap while zoomed zooms fully out.
  await afterPairWindow(page);
  await doubleActivateAt(page, await backgroundPoint(page, 'mfd'), touch);
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  await afterPairWindow(page);

  // Zoom in again and out with the button.
  await doubleActivateAt(page, await backgroundPoint(page, 'mfd'), touch);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  await activate(page.getByTestId('zoom-out'), touch);
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);

  expect(await eventCount(page)).toBe(0);
  expect(await stateSnapshot(page)).toBe(states);
});

/** The centre of a control's hit area on the page. */
async function hitCentre(page: Page, id: string): Promise<Point> {
  const box = await page.locator(`[data-hit="${id}"]`).boundingBox();
  if (box === null) throw new Error(`no hit box for ${id}`);
  return centreOf(box);
}

/**
 * A page point 3 px beside the control's hit that lies inside the control's region frame and
 * not on any tap target: a background point a finger could land on when it just misses.
 */
async function pointBesideHit(page: Page, id: string): Promise<Point> {
  const found = await page.evaluate((controlId) => {
    const hit = document.querySelector(`[data-hit="${controlId}"]`);
    const frame = hit?.closest('[data-region-id]')?.querySelector('[data-region-frame]');
    if (hit === null || hit === undefined || frame === null || frame === undefined) return null;
    const b = hit.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    const candidates = [
      { x: b.right + 3, y: b.top + b.height / 2 },
      { x: b.left - 3, y: b.top + b.height / 2 },
      { x: b.left + b.width / 2, y: b.bottom + 3 },
      { x: b.left + b.width / 2, y: b.top - 3 },
    ];
    return (
      candidates.find(
        (c) =>
          c.x > f.left &&
          c.x < f.right &&
          c.y > f.top &&
          c.y < f.bottom &&
          !document
            .elementsFromPoint(c.x, c.y)
            .some((el) => el.matches('[data-hit], [data-detent]')),
      ) ?? null
    );
  }, id);
  if (found === null) throw new Error(`no background point beside ${id}`);
  return found;
}

test('@hooks a double tap on a control is two control taps and never zooms', async ({
  page,
}, testInfo) => {
  const name = testInfo.project.name;
  test.skip(name !== 'phone-chromium' && name !== 'desktop-chromium', 'Chromium gestures only');
  const touch = name === 'phone-chromium';
  expect(await eventCount(page)).toBe(0);

  // Full view.
  await doubleActivateAt(page, await hitCentre(page, 'sw.engine_master'), touch);
  expect(await eventCount(page)).toBe(2);
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'on');
  expect(await viewBoxOf(page)).toBe(FULL_VIEWBOX);

  // Zoomed into the switch bank.
  await zoomIntoRegion(page, touch, 'switch_bank');
  const zoomed = await viewBoxOf(page);
  await afterPairWindow(page);
  await doubleActivateAt(page, await hitCentre(page, 'sw.engine_master'), touch);
  expect(await eventCount(page)).toBe(4);
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'on');
  expect(await viewBoxOf(page)).toBe(zoomed);
});

test('@hooks a control tap followed by a background tap beside it is not a double tap', async ({
  page,
}, testInfo) => {
  const name = testInfo.project.name;
  test.skip(name !== 'phone-chromium' && name !== 'desktop-chromium', 'Chromium gestures only');
  const touch = name === 'phone-chromium';
  const beside = await pointBesideHit(page, 'sw.engine_master');
  await activateAt(page, await hitCentre(page, 'sw.engine_master'), touch);
  await activateAt(page, beside, touch);
  await page.waitForTimeout(150);
  expect(await eventCount(page)).toBe(1);
  expect(await viewBoxOf(page)).toBe(FULL_VIEWBOX);

  // And the other way round: a background tap, then a control tap.
  await afterPairWindow(page);
  await activateAt(page, beside, touch);
  await activateAt(page, await hitCentre(page, 'sw.engine_master'), touch);
  await page.waitForTimeout(150);
  expect(await eventCount(page)).toBe(2);
  expect(await viewBoxOf(page)).toBe(FULL_VIEWBOX);

  // A control tap between two background taps ends the pair.
  await afterPairWindow(page);
  await activateAt(page, beside, touch);
  await activateAt(page, await hitCentre(page, 'sw.engine_master'), touch);
  await activateAt(page, beside, touch);
  await page.waitForTimeout(150);
  expect(await eventCount(page)).toBe(3);
  expect(await viewBoxOf(page)).toBe(FULL_VIEWBOX);
});

test('@hooks a pan between two taps ends the pair', async ({ page }, testInfo) => {
  const name = testInfo.project.name;
  test.skip(name !== 'phone-chromium' && name !== 'desktop-chromium', 'Chromium gestures only');
  const touch = name === 'phone-chromium';
  await zoomIntoRegion(page, touch, 'mfd');
  const zoomed = await viewNumbers(page);
  await afterPairWindow(page);
  const from = await backgroundPoint(page, 'mfd');
  await activateAt(page, from, touch);
  if (touch) {
    const send = await touchSender(page);
    await send('touchStart', [from]);
    for (let i = 1; i <= 4; i++) await send('touchMove', [{ x: from.x - i * 8, y: from.y }]);
    await send('touchEnd', []);
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 32, from.y, { steps: 4 });
    await page.mouse.up();
  }
  const panned = await viewNumbers(page);
  expect(panned.x !== zoomed.x || panned.y !== zoomed.y).toBe(true);
  // The tap after the pan is a lone tap: it does not zoom out.
  await activateAt(page, await backgroundPoint(page, 'mfd'), touch);
  await page.waitForTimeout(150);
  expect((await viewNumbers(page)).w).toBeCloseTo(zoomed.w);
  await expect(page.getByTestId('zoom-out')).toBeVisible();
  expect(await eventCount(page)).toBe(0);
});
