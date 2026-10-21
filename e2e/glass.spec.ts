import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { MFD_ENGINE_LEGENDS, MFD_MAP_LEGENDS, PFD_LEGENDS } from '../src/aircraft/da50rg/avionics';

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

test('the PFD shows 12 inert keys and a 12-slot legend row', async ({ page }) => {
  const region = page.locator('[data-region-id="pfd_softkeys"]');
  await expect(region.locator('[data-softkey]')).toHaveCount(12);
  await expect(region.locator('[data-control-id]')).toHaveCount(0);
  await expect(region.locator('[data-hit]')).toHaveCount(0);
  const tabs = page.locator('[data-region-id="pfd"] [data-legend-tab]');
  await expect(tabs).toHaveCount(12);
  expect(await tabs.allTextContents()).toEqual([...PFD_LEGENDS]);
});

test('@hooks a tap on a PFD key appends no event and changes no state', async ({
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
  for (const slot of [1, 6, 12]) {
    await tapAtCentre(page, page.locator(`[data-softkey="pfd:${slot}"]`), hasTouch);
  }
  expect(await read()).toEqual(before);
});

interface ZoneItem {
  readonly zone: string;
  readonly tag: string;
  readonly text: string;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Every painted element of a glass region in region-local svg units, with its zone tag. */
async function readZones(page: Page, regionId: string): Promise<ZoneItem[]> {
  return page.getByTestId('panel').evaluate((node, id) => {
    const svg = node as unknown as SVGSVGElement;
    const ctm = svg.getScreenCTM();
    if (ctm === null) throw new Error('no screen CTM');
    const inv = ctm.inverse();
    const group = svg.querySelector(`[data-region-id="${id}"]`);
    const frame = group?.querySelector('[data-region-frame]');
    if (group === null || group === undefined || frame === null || frame === undefined) {
      throw new Error(`region ${id} missing`);
    }
    const local = (px: number, py: number) => new DOMPoint(px, py).matrixTransform(inv);
    const fr = frame.getBoundingClientRect();
    const origin = local(fr.left, fr.top);
    const out: ZoneItem[] = [];
    const SELECTOR = 'text, path, circle, ellipse, rect, polygon, line, polyline';
    for (const el of Array.from(group.querySelectorAll(SELECTOR))) {
      if (el.hasAttribute('data-region-frame') || el.hasAttribute('data-hit')) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 && r.height <= 0) continue;
      const p1 = local(r.left, r.top);
      const p2 = local(r.right, r.bottom);
      const zoneEl = el.closest('[data-glass-zone]');
      out.push({
        zone: zoneEl?.getAttribute('data-glass-zone') ?? 'untagged',
        tag: el.tagName.toLowerCase(),
        text: (el.textContent ?? '').trim().slice(0, 30),
        x0: p1.x - origin.x,
        y0: p1.y - origin.y,
        x1: p2.x - origin.x,
        y1: p2.y - origin.y,
      });
    }
    return out;
  }, regionId);
}

const ZONE_TOLERANCE = 0.75;

/** The y range of a zone and, for the content zone, the x range (Table D4). */
function zoneFailures(items: readonly ZoneItem[]): string[] {
  const failures: string[] = [];
  const band: Record<string, readonly [number, number]> = {
    header: [4, 28],
    content: [30, 343],
    legend: [345, 363],
  };
  for (const item of items) {
    if (item.zone === 'screen') continue;
    const range = band[item.zone];
    const label = `${item.zone}: ${item.tag} "${item.text}"`;
    if (range === undefined) {
      failures.push(`${label} is not in a tagged zone`);
      continue;
    }
    if (item.y0 < range[0] - ZONE_TOLERANCE)
      failures.push(`${label} starts at y ${item.y0.toFixed(1)}`);
    if (item.y1 > range[1] + ZONE_TOLERANCE)
      failures.push(`${label} ends at y ${item.y1.toFixed(1)}`);
    if (item.zone === 'content') {
      if (item.x0 < 4 - ZONE_TOLERANCE) failures.push(`${label} starts at x ${item.x0.toFixed(1)}`);
      if (item.x1 > 491 + ZONE_TOLERANCE) failures.push(`${label} ends at x ${item.x1.toFixed(1)}`);
    }
  }
  return failures;
}

test.describe('glass zones', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'geometry gate runs on desktop-chromium',
    );
    await page.setViewportSize({ width: 2200, height: 1400 });
    await page.goto('./');
    await expect(page.getByTestId('panel')).toBeVisible();
  });

  test('every painted element of the PFD lies in the zone it is tagged with', async ({ page }) => {
    const items = await readZones(page, 'pfd');
    expect(items.filter((i) => i.zone === 'header').length).toBeGreaterThan(5);
    expect(items.filter((i) => i.zone === 'content').length).toBeGreaterThan(20);
    expect(items.filter((i) => i.zone === 'legend').length).toBeGreaterThan(20);
    expect(items.filter((i) => i.zone === 'screen')).toHaveLength(1);
    expect(zoneFailures(items)).toEqual([]);
  });

  test('every painted element of the MFD lies in its zone on both pages', async ({ page }) => {
    for (const mode of ['map', 'engine'] as const) {
      if (mode === 'engine') await page.locator('[data-hit="sw.mfd_page"]').click();
      await expect(page.locator(`[data-mfd-page="${mode}"]`)).toBeVisible();
      const items = await readZones(page, 'mfd');
      expect(items.filter((i) => i.zone === 'header').length, mode).toBeGreaterThan(5);
      expect(items.filter((i) => i.zone === 'content').length, mode).toBeGreaterThan(20);
      expect(zoneFailures(items), mode).toEqual([]);
    }
  });

  test('the zone check bites: a moved element would be reported', () => {
    const stray: ZoneItem = {
      zone: 'content',
      tag: 'text',
      text: 'KT',
      x0: 40,
      y0: 18,
      x1: 60,
      y1: 29,
    };
    expect(zoneFailures([stray])).toHaveLength(1);
  });
});
