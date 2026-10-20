import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(hit: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await hit.tap();
  else await hit.click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('MFD shows the Map page with the engine strip by default', async ({ page }) => {
  await expect(page.locator('[data-mfd-page="map"]')).toBeVisible();
  await expect(page.getByTestId('mfd-engine-strip')).toBeVisible();
});

test('MFD PAGE softkey switches to the Engine page and back', async ({ page, hasTouch }) => {
  const hit = page.locator('[data-hit="sw.mfd_page"]');
  const key = page.locator('[data-control-id="sw.mfd_page"]');

  await activate(hit, hasTouch);
  await expect(page.locator('[data-mfd-page="engine"]')).toBeVisible();
  await expect(page.getByTestId('mfd-engine-page')).toBeVisible();
  await expect(page.locator('[data-mfd-page="map"]')).toHaveCount(0);
  await expect(page.getByTestId('mfd-engine-strip')).toHaveCount(0);
  await expect(key.locator('[data-state-text]')).toHaveText('ENGINE');

  await activate(hit, hasTouch);
  await expect(page.locator('[data-mfd-page="map"]')).toBeVisible();
  await expect(page.getByTestId('mfd-engine-strip')).toBeVisible();
  await expect(page.getByTestId('mfd-engine-page')).toHaveCount(0);
});

test('PFD shows attitude, airspeed, altitude and heading', async ({ page }) => {
  for (const id of ['pfd-attitude', 'pfd-airspeed', 'pfd-altitude', 'pfd-heading']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
});

test('B612 fonts are self-hosted and loaded', async ({ page, baseURL }) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  const origin = new URL(baseURL).origin;
  const urls: string[] = [];
  page.on('response', (res) => urls.push(res.url()));

  await page.reload();
  await expect(page.getByTestId('panel')).toBeVisible();
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      placard: document.fonts.check('700 12px B612'),
      glass: document.fonts.check('12px "B612 Mono"'),
    };
  });
  expect(loaded.placard).toBe(true);
  expect(loaded.glass).toBe(true);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) expect(new URL(url).origin, url).toBe(origin);
});
