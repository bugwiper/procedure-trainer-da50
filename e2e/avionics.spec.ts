import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PANEL_VIEWBOX } from '../tests/layout-reference';

// Built-panel gate for the inert avionics units (phase 01.2 plan 06, D-05, D-06, T-01.2-11):
// the six units exist as not-operable groups, hold no control and no hit rectangle, and a tap on
// their background only zooms. The event case reads the e2e-only window hook (@hooks).

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here because
// the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string; source: string; seq: number }[];
  state(): Record<string, string>;
}
type HookHost = { __panel?: PanelHook };

const FULL_VIEWBOX = `0 0 ${PANEL_VIEWBOX.w} ${PANEL_VIEWBOX.h}`;

// Typed in by hand: region id and the label the group announces.
const UNITS: readonly (readonly [string, string])[] = [
  ['pfd_bezel_left', 'PFD KNOB COLUMN LEFT (NOT OPERABLE)'],
  ['pfd_bezel_right', 'PFD KNOB COLUMN RIGHT (NOT OPERABLE)'],
  ['audio_panel', 'AUDIO PANEL (NOT OPERABLE)'],
  ['standby_efis', 'BACKUP EFIS (NOT OPERABLE)'],
  ['autopilot_panel', 'AUTOPILOT PANEL (NOT OPERABLE)'],
  ['mfd_bezel_right', 'MFD KNOB COLUMN RIGHT (NOT OPERABLE)'],
];

interface Point {
  x: number;
  y: number;
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', 'covered by the rotate hint');
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

/** Centre of a unit region's frame on the page: a unit holds no control, so it is background. */
async function unitPoint(page: Page, id: string): Promise<Point> {
  const box = await page.locator(`[data-region-id="${id}"] [data-region-frame]`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  return box;
}

async function activateAt(page: Page, p: Point, hasTouch: boolean): Promise<void> {
  if (hasTouch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

test('the six units are not-operable groups inside their own regions', async ({ page }) => {
  await expect(page.locator('[data-unit]')).toHaveCount(UNITS.length);
  for (const [id, label] of UNITS) {
    const group = page.locator(`[data-region-id="${id}"] [data-unit="${id}"]`);
    await expect(group, id).toHaveCount(1);
    await expect(group, id).toHaveAttribute('role', 'img');
    await expect(group, id).toHaveAttribute('aria-label', label);
    expect(label.endsWith('(NOT OPERABLE)'), id).toBe(true);
    await expect(group.locator('[data-unit-art]'), id).toHaveAttribute('aria-hidden', 'true');
  }
});

test('the units hold no control, no hit rectangle and no control id', async ({ page }) => {
  for (const [id] of UNITS) {
    const region = page.locator(`[data-region-id="${id}"]`);
    await expect(region.locator('[data-control-id]'), id).toHaveCount(0);
    await expect(region.locator('[data-hit]'), id).toHaveCount(0);
    await expect(region.locator('[data-detent]'), id).toHaveCount(0);
    await expect(
      page.locator(`[data-unit="${id}"] [data-hit], [data-unit="${id}"] [data-control-id]`),
    ).toHaveCount(0);
  }
});

test('the housed units draw a housing equal to their region frame', async ({ page }) => {
  for (const id of ['audio_panel', 'standby_efis', 'autopilot_panel']) {
    const region = page.locator(`[data-region-id="${id}"]`);
    const housing = region.locator('[data-unit-housing]');
    await expect(housing, id).toHaveCount(1);
    const [h, f] = await Promise.all([
      housing.evaluate((el) => el.getBoundingClientRect().toJSON() as Record<string, number>),
      region
        .locator('[data-region-frame]')
        .evaluate((el) => el.getBoundingClientRect().toJSON() as Record<string, number>),
    ]);
    for (const key of ['left', 'top', 'width', 'height']) {
      expect(h[key] ?? Number.NaN, `${id} ${key}`).toBeCloseTo(f[key] ?? Number.NaN, 0);
    }
  }
  // The bezel columns sit on their unit plate and draw no housing.
  for (const id of ['pfd_bezel_left', 'pfd_bezel_right', 'mfd_bezel_right']) {
    await expect(page.locator(`[data-region-id="${id}"] [data-unit-housing]`), id).toHaveCount(0);
  }
});

// Plan 07: the knob and key columns draw their static legends and round parts. Typed in by hand:
// the strings each unit shows (sorted), and the counts of knobs, joysticks, swap buttons and keys.
interface ColumnExpect {
  readonly id: string;
  readonly texts: readonly string[];
  readonly knobs: number;
  readonly joysticks: number;
  readonly swaps: number;
  readonly keys: number;
}

const COLUMNS: readonly ColumnExpect[] = [
  {
    id: 'pfd_bezel_left',
    texts: ['VOL', 'PUSH ID', 'NAV', 'PUSH', '1-2', 'HDG', 'PUSH', 'HDG SYNC', 'ALT'],
    knobs: 4,
    joysticks: 0,
    swaps: 1,
    keys: 0,
  },
  {
    id: 'pfd_bezel_right',
    texts: [
      'VOL',
      'PUSH SQ',
      'EMERG',
      'COM',
      'PUSH',
      '1-2',
      'CRS/BARO',
      'PUSH',
      'CRS CTR',
      'RANGE',
      'PUSH',
      'PAN',
      'D',
      'MENU',
      'FPL',
      'PROC',
      'CLR',
      'ENT',
      'DFLT MAP',
      'FMS',
      'PUSH CRSR',
    ],
    knobs: 4,
    joysticks: 1,
    swaps: 1,
    keys: 6,
  },
];

for (const col of COLUMNS) {
  test(`the ${col.id} column shows its legends and ${String(col.knobs)} knobs`, async ({
    page,
  }) => {
    const unit = page.locator(`[data-unit="${col.id}"]`);
    const shown = await unit.locator('text').allTextContents();
    expect([...shown].sort()).toEqual([...col.texts].sort());
    await expect(unit.locator('[data-knob]')).toHaveCount(col.knobs);
    await expect(unit.locator('[data-joystick]')).toHaveCount(col.joysticks);
    await expect(unit.locator('[data-swap]')).toHaveCount(col.swaps);
    await expect(unit.locator('[data-key]')).toHaveCount(col.keys);
  });
}

for (const [id] of UNITS) {
  test(`@hooks a tap on ${id} only zooms: no event, no state change, back to the full view`, async ({
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
    expect(await page.getByTestId('panel').getAttribute('viewBox')).toBe(FULL_VIEWBOX);

    // Tap: the view zooms to the region.
    await activateAt(page, await unitPoint(page, id), hasTouch);
    await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
    expect(await read()).toEqual(before);

    // A second tap after the double-tap window zooms back out.
    await page.waitForTimeout(450);
    await activateAt(page, await unitPoint(page, id), hasTouch);
    await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
    expect(await read()).toEqual(before);

    // Zoom in again and leave by the Full panel button.
    await page.waitForTimeout(450);
    await activateAt(page, await unitPoint(page, id), hasTouch);
    await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
    const button = page.getByTestId('zoom-out');
    if (hasTouch) await button.tap();
    else await button.click();
    await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
    expect(await read()).toEqual(before);
  });
}
