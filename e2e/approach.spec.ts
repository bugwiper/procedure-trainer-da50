import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { FIELD_SIGHT_FT } from '../src/aircraft/da50rg/cues';
import { TERRAIN_HEIGHT_FT } from '../src/aircraft/da50rg/quantities';

// The approach to an off-airport field (Phase 9, plan 09-01): the scene outlanding shows one landing
// field that grows with the descent, in the windscreen and on the PFD synthetic vision. The free
// panel with preview flags is enough (no hook, no scenario), so the spec also runs against the live
// site. The heights come from the exported constants.

const WINDSCREEN = '[data-layer="windscreen"]';
const SCENE = `${WINDSCREEN} [data-scene="outlanding"]`;
const FIELD = `${SCENE} [data-part="field"]`;

const HEIGHTS = [
  TERRAIN_HEIGHT_FT + FIELD_SIGHT_FT,
  TERRAIN_HEIGHT_FT + FIELD_SIGHT_FT / 2,
  TERRAIN_HEIGHT_FT,
] as const;

interface Size {
  width: number;
  height: number;
}

async function sizeOf(page: Page, selector: string): Promise<Size> {
  const box = await page.locator(selector).first().boundingBox();
  if (box === null) throw new Error(`no box for ${selector}`);
  return { width: box.width, height: box.height };
}

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`./?${query}`);
  await expect(page.getByTestId('panel')).toBeVisible();
}

test('the landing field grows in the windscreen from the sight height to the terrain', async ({
  page,
}) => {
  const sizes: Size[] = [];
  for (const height of HEIGHTS) {
    await open(page, `scene=outlanding&q=altitude_ft:${String(height)}`);
    await expect(page.locator(SCENE)).toHaveCount(1);
    await expect(page.locator(FIELD)).toHaveCount(1);
    sizes.push(await sizeOf(page, FIELD));
  }
  const [far, middle, near] = sizes as [Size, Size, Size];
  expect(middle.height).toBeGreaterThan(far.height);
  expect(middle.width).toBeGreaterThan(far.width);
  expect(near.height).toBeGreaterThan(middle.height);
  expect(near.width).toBeGreaterThan(middle.width);
});

test('the scene draws no text', async ({ page }) => {
  await open(page, `scene=outlanding&q=altitude_ft:${String(HEIGHTS[1])}`);
  await expect(page.locator(SCENE)).toHaveCount(1);
  await expect(page.locator(`${SCENE} text, ${SCENE} tspan`)).toHaveCount(0);
});

test('the free panel without the flag draws no landing field', async ({ page }) => {
  await open(page, '');
  await expect(page.locator(`${WINDSCREEN} [data-scene="cruise"]`)).toHaveCount(1);
  await expect(page.locator('[data-scene="outlanding"]')).toHaveCount(0);
  await expect(page.locator('[data-part="field"]')).toHaveCount(0);
  // The altitude flag alone, without the scene flag, keeps the cruise view.
  await open(page, `q=altitude_ft:${String(TERRAIN_HEIGHT_FT)}`);
  await expect(page.locator('[data-scene="outlanding"]')).toHaveCount(0);
});
