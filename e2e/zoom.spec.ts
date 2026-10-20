import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Region zoom (PNL-09, D-20, D-21): tap or click a region's background to zoom in, operate
// its controls at full tap size, zoom back out.

const FULL_VIEWBOX = '0 0 2000 1010';
const MIN_TAP_PX = 43.5;
const PORTRAIT_NOTE =
  'Portrait phones are covered by the rotate hint (D-02); pinch zoom reaches full tap size there';

interface Point {
  x: number;
  y: number;
}

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

function viewBoxOf(page: Page): Promise<string | null> {
  return page.getByTestId('panel').getAttribute('viewBox');
}

/**
 * A page point inside the region's frame that lies outside every tap target of the whole
 * panel (inflated by 4 px) and outside the "Full panel" button.
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
    const blocked = (x: number, y: number) =>
      targets.some(
        (t) => x >= t.left - 4 && x <= t.right + 4 && y >= t.top - 4 && y <= t.bottom + 4,
      );
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const x = box.left + ((i + 0.5) / steps) * box.width;
        const y = box.top + ((j + 0.5) / steps) * box.height;
        if (!blocked(x, y)) return { x, y };
      }
    }
    return null;
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
