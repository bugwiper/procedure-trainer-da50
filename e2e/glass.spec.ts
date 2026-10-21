import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { MFD_ENGINE_LEGENDS, MFD_MAP_LEGENDS } from '../src/aircraft/da50rg/avionics';

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here because
// the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string; source: string; seq: number }[];
  state(): Record<string, string>;
}
type HookHost = { __panel?: PanelHook };

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
  await expect(key).toHaveAttribute('data-state', 'engine');

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

test('mfd_softkeys holds 11 inert keys plus the one control, key 1', async ({ page }) => {
  const region = page.locator('[data-region-id="mfd_softkeys"]');
  await expect(region.locator('[data-softkey]')).toHaveCount(11);
  await expect(region.locator('[data-control-id]')).toHaveCount(1);
  await expect(region.locator('[data-control-id="sw.mfd_page"]')).toHaveCount(1);
  await expect(region.locator('[data-hit]')).toHaveCount(1);
  // No inert key takes pointer events, so none of them can be a tap target.
  const pe = await region
    .locator('[data-softkeys]')
    .evaluate((el) => getComputedStyle(el).pointerEvents);
  expect(pe).toBe('none');
});

test('the MFD legend row has 12 tabs on both pages and the Engine tab is selected on the engine page', async ({
  page,
  hasTouch,
}) => {
  const tabs = page.locator('[data-region-id="mfd"] [data-legend-tab]');
  const selected = page.locator('[data-region-id="mfd"] [data-legend-tab][data-selected="true"]');
  await expect(tabs).toHaveCount(12);
  await expect(selected).toHaveCount(0);
  expect(await tabs.allTextContents()).toEqual([...MFD_MAP_LEGENDS]);

  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);
  await expect(page.getByTestId('mfd-engine-page')).toBeVisible();
  await expect(tabs).toHaveCount(12);
  await expect(selected).toHaveCount(1);
  await expect(selected).toHaveText('Engine');
  expect(await tabs.allTextContents()).toEqual([...MFD_ENGINE_LEGENDS]);

  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);
  await expect(page.getByTestId('mfd-map-page')).toBeVisible();
  await expect(selected).toHaveCount(0);
});

/** A tap or click at the centre of an element, without actionability checks (it takes no events). */
async function tapAtCentre(page: Page, target: Locator, hasTouch: boolean): Promise<void> {
  const box = await target.boundingBox();
  if (box === null) throw new Error('inert key has no box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

test('@hooks a tap on an inert MFD key appends no event and changes no state', async ({
  page,
  hasTouch,
}) => {
  const read = () =>
    page.evaluate(() => {
      const hook = (window as unknown as HookHost).__panel;
      if (hook === undefined) throw new Error('test hook missing');
      return { events: hook.events().length, state: JSON.stringify(hook.state()) };
    });
  const before = await read();
  for (const slot of [2, 7, 12]) {
    await tapAtCentre(page, page.locator(`[data-softkey="mfd:${slot}"]`), hasTouch);
  }
  const after = await read();
  expect(after).toEqual(before);
  await expect(page.locator('[data-mfd-page="map"]')).toBeVisible();
});
