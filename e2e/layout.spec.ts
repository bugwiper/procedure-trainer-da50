import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

const REGION_IDS = [
  'lights',
  'deice',
  'deice_switches',
  'engine_controls',
  'pfd',
  'light_knobs',
  'mfd',
  'mfd_softkeys',
  'switch_bank',
  'landing_gear',
  'level',
  'flaps',
  'right_panel',
  'under_panel_left',
  'under_panel_centre',
  'env_control',
  'pedestal',
  'under_panel_right',
];
const TOLERANCE_PX = 0.5;

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(el: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await el.tap();
  else await el.click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('no horizontal scroll and the whole panel is visible', async ({ page }) => {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);

  const svg = await page.getByTestId('panel').boundingBox();
  if (svg === null) throw new Error('panel has no bounding box');
  expect(svg.x).toBeGreaterThanOrEqual(-TOLERANCE_PX);
  expect(svg.y).toBeGreaterThanOrEqual(-TOLERANCE_PX);
  expect(svg.x + svg.width).toBeLessThanOrEqual(metrics.innerWidth + TOLERANCE_PX);
  expect(svg.y + svg.height).toBeLessThanOrEqual(metrics.innerHeight + TOLERANCE_PX);

  const regions = page.locator('[data-region-id]');
  await expect(regions).toHaveCount(REGION_IDS.length);
  for (const id of REGION_IDS) {
    const box = await page.locator(`[data-region-id="${id}"]`).boundingBox();
    if (box === null) throw new Error(`region ${id} has no bounding box`);
    expect(box.x, id).toBeGreaterThanOrEqual(svg.x - TOLERANCE_PX);
    expect(box.y, id).toBeGreaterThanOrEqual(svg.y - TOLERANCE_PX);
    expect(box.x + box.width, id).toBeLessThanOrEqual(svg.x + svg.width + TOLERANCE_PX);
    expect(box.y + box.height, id).toBeLessThanOrEqual(svg.y + svg.height + TOLERANCE_PX);
  }
});

test('rotate hint shows on a portrait phone only', async ({ page, hasTouch }, testInfo) => {
  const hint = page.getByTestId('rotate-hint');
  if (testInfo.project.name !== 'phone-portrait') {
    await expect(hint).toBeHidden();
    return;
  }

  await expect(hint).toBeVisible();
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const svg = await page.getByTestId('panel').boundingBox();
  expect(svg?.width).toBeCloseTo(viewportWidth, 0);

  await activate(page.getByTestId('rotate-hint-dismiss'), hasTouch);
  await expect(hint).toBeHidden();

  // The panel is still operable after dismissing.
  const master = page.locator('[data-control-id="sw.engine_master"]');
  const before = await master.getAttribute('data-state');
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(master).not.toHaveAttribute('data-state', before ?? '');
});

test('state survives a viewport change', async ({ page, hasTouch }) => {
  const master = page.locator('[data-control-id="sw.engine_master"]');
  const before = await master.getAttribute('data-state');
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(master).not.toHaveAttribute('data-state', before ?? '');
  const flipped = await master.getAttribute('data-state');
  expect(flipped).not.toBeNull();

  const size = page.viewportSize();
  if (size === null) throw new Error('viewport missing');
  await page.setViewportSize({ width: size.height, height: size.width });
  await expect(page.getByTestId('panel')).toBeVisible();
  await expect(master).toHaveAttribute('data-state', flipped ?? '');
});
