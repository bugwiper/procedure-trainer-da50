import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { FIELD_SIGHT_FT, WATER_SIGHT_FT } from '../src/aircraft/da50rg/cues';
import { TERRAIN_HEIGHT_FT, WATER_LEVEL_FT } from '../src/aircraft/da50rg/quantities';

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

const SVT_ART = '[data-testid="pfd-attitude"] [data-svt-art="outlanding"]';
const SVT_FIELD = `${SVT_ART} [data-svt-field]`;

test('the field grows on the PFD synthetic vision from the sight height to the terrain', async ({
  page,
}) => {
  const sizes: Size[] = [];
  for (const height of HEIGHTS) {
    await open(page, `scene=outlanding&q=altitude_ft:${String(height)}`);
    await expect(page.locator(SVT_ART)).toHaveCount(1);
    await expect(page.locator(SVT_FIELD)).toHaveCount(1);
    sizes.push(await sizeOf(page, SVT_FIELD));
  }
  const [far, middle, near] = sizes as [Size, Size, Size];
  expect(middle.height).toBeGreaterThan(far.height);
  expect(middle.width).toBeGreaterThan(far.width);
  expect(near.height).toBeGreaterThan(middle.height);
  expect(near.width).toBeGreaterThan(middle.width);
});

test('the PFD draws no landing field on the free panel and no text in the field art', async ({
  page,
}) => {
  await open(page, '');
  await expect(page.locator('[data-testid="pfd-attitude"] [data-svt-scene="cruise"]')).toHaveCount(
    1,
  );
  await expect(page.locator('[data-svt-field]')).toHaveCount(0);
  await open(page, `scene=outlanding&q=altitude_ft:${String(HEIGHTS[1])}`);
  await expect(page.locator(`${SVT_ART} text, ${SVT_ART} tspan`)).toHaveCount(0);
});

test('the horizon of the PFD still moves with the pitch over the approach scene', async ({
  page,
}) => {
  const horizon = '[data-testid="pfd-attitude"] [data-horizon]';
  await open(page, `scene=outlanding&q=altitude_ft:${String(HEIGHTS[1])}`);
  const level = await page.locator(horizon).getAttribute('transform');
  await open(page, `scene=outlanding&q=altitude_ft:${String(HEIGHTS[1])},pitch_deg:8`);
  const pitched = await page.locator(horizon).getAttribute('transform');
  expect(level).not.toBeNull();
  expect(pitched).not.toBe(level);
});

test('the stopped propeller shows on the approach scene as on the others (engine_stopped, Phase 9)', async ({
  page,
}) => {
  await open(page, `scene=outlanding&q=altitude_ft:${String(HEIGHTS[1])},rpm:0`);
  await expect(page.locator(SCENE)).toHaveCount(1);
  await expect(page.locator('[data-part="blade_stopped"]')).toHaveAttribute('opacity', '1');
  await expect(page.locator('[data-part="disc"]')).toHaveAttribute('fill-opacity', '0');
  // A turning engine on the same scene shows the faint disc and no blade.
  await open(page, `scene=outlanding&q=altitude_ft:${String(HEIGHTS[1])},rpm:600`);
  await expect(page.locator('[data-part="blade_stopped"]')).toHaveAttribute('opacity', '0');
});

// The approach to the sea (Phase 9, plan 09-04, R-03): the scene ditching shows wave bands that come
// toward the pilot with the descent, in the windscreen and on the PFD synthetic vision, from one cue
// and one geometry function. Same free-panel approach as above (preview flags, no hook).

const SEA = `${WINDSCREEN} [data-scene="ditching"]`;
const SEA_BANDS = `${SEA} [data-part="wave-trough"]`;
const SVT_SEA = '[data-testid="pfd-attitude"] [data-svt-art="ditching"]';
const SVT_WAVES = `${SVT_SEA} [data-svt-wave]`;
const WATER_HEIGHTS = [
  WATER_LEVEL_FT + WATER_SIGHT_FT,
  WATER_LEVEL_FT + WATER_SIGHT_FT / 2,
  WATER_LEVEL_FT,
] as const;

interface Band {
  top: number;
  bottom: number;
  height: number;
}

/** The box of the nearest band (the first of the group) as top, bottom and height. */
async function nearestBand(page: Page, selector: string): Promise<Band> {
  const box = await page.locator(selector).first().boundingBox();
  if (box === null) throw new Error(`no box for ${selector}`);
  return { top: box.y, bottom: box.y + box.height, height: box.height };
}

test('the wave bands come lower and grow thicker in the windscreen from the sight height to the water', async ({
  page,
}) => {
  const bands: Band[] = [];
  for (const height of WATER_HEIGHTS) {
    await open(page, `scene=ditching&q=altitude_ft:${String(height)}`);
    await expect(page.locator(SEA)).toHaveCount(1);
    await expect(page.locator(`${SEA} [data-cue="water_near"]`)).toHaveCount(1);
    expect(await page.locator(SEA_BANDS).count()).toBeGreaterThan(3);
    bands.push(await nearestBand(page, SEA_BANDS));
  }
  const [far, middle, near] = bands as [Band, Band, Band];
  expect(middle.bottom).toBeGreaterThan(far.bottom);
  expect(near.bottom).toBeGreaterThan(middle.bottom);
  expect(middle.height).toBeGreaterThan(far.height);
  expect(near.height).toBeGreaterThan(middle.height);
});

test('the wave bands come lower and grow thicker on the PFD synthetic vision', async ({ page }) => {
  const bands: Band[] = [];
  for (const height of WATER_HEIGHTS) {
    await open(page, `scene=ditching&q=altitude_ft:${String(height)}`);
    await expect(page.locator(SVT_SEA)).toHaveCount(1);
    expect(await page.locator(SVT_WAVES).count()).toBeGreaterThan(3);
    bands.push(await nearestBand(page, SVT_WAVES));
  }
  const [far, middle, near] = bands as [Band, Band, Band];
  expect(middle.bottom).toBeGreaterThan(far.bottom);
  expect(near.bottom).toBeGreaterThan(middle.bottom);
  expect(middle.height).toBeGreaterThan(far.height);
  expect(near.height).toBeGreaterThan(middle.height);
});

test('the sea draws no text, and the free panel default scene is unchanged', async ({ page }) => {
  await open(page, `scene=ditching&q=altitude_ft:${String(WATER_HEIGHTS[1])}`);
  await expect(
    page.locator(`${SEA} text, ${SEA} tspan, ${SVT_SEA} text, ${SVT_SEA} tspan`),
  ).toHaveCount(0);
  await open(page, '');
  await expect(page.locator(`${WINDSCREEN} [data-scene="cruise"]`)).toHaveCount(1);
  await expect(page.locator('[data-scene="ditching"]')).toHaveCount(0);
  await expect(page.locator('[data-part="wave-trough"]')).toHaveCount(0);
  await expect(page.locator('[data-svt-art="ditching"]')).toHaveCount(0);
  // The altitude flag alone, without the scene flag, keeps the cruise view.
  await open(page, `q=altitude_ft:${String(WATER_LEVEL_FT)}`);
  await expect(page.locator('[data-scene="ditching"]')).toHaveCount(0);
});
