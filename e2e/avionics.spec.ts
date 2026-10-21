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

test('the housed units draw a housing equal to their region frame (the backup EFIS: its own bezel)', async ({
  page,
}) => {
  const rectOf = (locator: ReturnType<Page['locator']>) =>
    locator.evaluate((el) => el.getBoundingClientRect().toJSON() as Record<string, number>);
  for (const id of ['audio_panel', 'autopilot_panel']) {
    const region = page.locator(`[data-region-id="${id}"]`);
    const housing = region.locator('[data-unit-housing]');
    await expect(housing, id).toHaveCount(1);
    const [h, f] = await Promise.all([
      rectOf(housing),
      rectOf(region.locator('[data-region-frame]')),
    ]);
    for (const key of ['left', 'top', 'width', 'height']) {
      expect(h[key] ?? Number.NaN, `${id} ${key}`).toBeCloseTo(f[key] ?? Number.NaN, 0);
    }
  }
  // The backup EFIS housing is {1029, 298, 114, 264} inside the region {1026, 296, 120, 278}.
  const efis = page.locator('[data-region-id="standby_efis"]');
  await expect(efis.locator('[data-unit-housing]')).toHaveCount(1);
  const [h, f] = await Promise.all([
    rectOf(efis.locator('[data-unit-housing]')),
    rectOf(efis.locator('[data-region-frame]')),
  ]);
  const scale = (f['width'] ?? Number.NaN) / 120;
  expect(h['left'] ?? Number.NaN).toBeCloseTo((f['left'] ?? 0) + 3 * scale, 0);
  expect(h['top'] ?? Number.NaN).toBeCloseTo((f['top'] ?? 0) + 2 * scale, 0);
  expect(h['width'] ?? Number.NaN).toBeCloseTo(114 * scale, 0);
  expect(h['height'] ?? Number.NaN).toBeCloseTo(264 * scale, 0);
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
  {
    id: 'mfd_bezel_right',
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

test('the three columns show 12 knobs, 2 joysticks, 3 swap buttons and 12 keys in total', async ({
  page,
}) => {
  const columns = page.locator('[data-unit$="_bezel_left"], [data-unit$="_bezel_right"]');
  await expect(columns.locator('[data-knob]')).toHaveCount(12);
  await expect(columns.locator('[data-joystick]')).toHaveCount(2);
  await expect(columns.locator('[data-swap]')).toHaveCount(3);
  await expect(columns.locator('[data-key]')).toHaveCount(12);
});

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

// Plan 08: the audio panel. Typed in by hand: the strings it prints (sorted) and its parts.
const AUDIO_TEXTS = [
  'COM1',
  'MIC',
  'COM1',
  'COM2',
  'MIC',
  'COM2',
  'AUX',
  'MIC',
  'AUX',
  'DME',
  'NAV1',
  'ADF',
  'NAV2',
  'PILOT',
  'ICS',
  'TEL',
  'COPLT',
  'ICS',
  'MUS1',
  'PASS',
  'ICS',
  'MUS2',
  'SPKR',
  'PA',
  'MKR',
  'MUTE',
  'HI',
  'SENS',
  'PLAY',
  'MAN',
  'SQ',
  'DISPLAY',
  'BACKUP',
];

test('the audio panel shows 21 keys, 21 lamp slivers (3 lit), one knob and the DISPLAY BACKUP button', async ({
  page,
}) => {
  const unit = page.locator('[data-unit="audio_panel"]');
  await expect(unit.locator('[data-key]')).toHaveCount(21);
  await expect(unit.locator('[data-lamp]')).toHaveCount(21);
  await expect(unit.locator('[data-lamp-lit="true"]')).toHaveCount(3);
  await expect(unit.locator('[data-knob]')).toHaveCount(1);
  await expect(unit.locator('[data-display-backup]')).toHaveCount(1);
  await expect(unit.locator('[data-hit], [data-control-id], [tabindex]')).toHaveCount(0);
  const shown = await unit.locator('text').allTextContents();
  expect([...shown].sort()).toEqual([...AUDIO_TEXTS].sort());
});

test('@hooks a tap on an audio key and on the DISPLAY BACKUP button emits no event', async ({
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
  for (const selector of ['[data-key="com1-mic"]', '[data-display-backup]']) {
    const target = page.locator(`[data-unit="audio_panel"] ${selector}`);
    const p = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await activateAt(page, p, hasTouch);
    await page.waitForTimeout(450);
    expect(await read(), selector).toEqual(before);
    // Leave the zoomed view so the next target is at its full-view place again.
    if ((await page.getByTestId('panel').getAttribute('viewBox')) !== FULL_VIEWBOX) {
      const button = page.getByTestId('zoom-out');
      if (hasTouch) await button.tap();
      else await button.click();
      await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
    }
  }
});

// Plan 08: the backup EFIS: two displays, one knob and the strings below.
test('the backup EFIS shows two displays, one knob and its tape strings', async ({ page }) => {
  const unit = page.locator('[data-unit="standby_efis"]');
  await expect(unit.locator('[data-efis-display]')).toHaveCount(2);
  await expect(unit.locator('[data-knob]')).toHaveCount(1);
  await expect(unit.locator('[data-key], [data-lamp], [data-display-backup]')).toHaveCount(0);
  await expect(unit.locator('[data-hit], [data-control-id], [tabindex]')).toHaveCount(0);
  const shown = await unit.locator('text').allTextContents();
  for (const word of ['KTS', 'FEET', 'BARO', '1013', '0', '1400']) {
    expect(shown, word).toContain(word);
  }
  expect([...shown].sort()).toEqual(
    [
      'KTS',
      'FEET',
      '0',
      '1400',
      '180',
      '160',
      '140',
      '120',
      '100',
      '1600',
      '1500',
      '1400',
      '1300',
      '1200',
      'BARO',
      '1013',
    ].sort(),
  );
});

// Plan 08: the autopilot panel: 12 keys in six rows, four knobs and the swap button.
test('the autopilot panel shows 12 keys, four knobs, one swap button and its legends', async ({
  page,
}) => {
  const unit = page.locator('[data-unit="autopilot_panel"]');
  await expect(unit.locator('[data-key]')).toHaveCount(12);
  await expect(unit.locator('[data-knob]')).toHaveCount(4);
  await expect(unit.locator('[data-swap]')).toHaveCount(1);
  await expect(unit.locator('[data-lamp], [data-display-backup]')).toHaveCount(0);
  await expect(unit.locator('[data-hit], [data-control-id], [tabindex]')).toHaveCount(0);
  const shown = await unit.locator('text').allTextContents();
  expect([...shown].sort()).toEqual(
    [
      'AP',
      'YD',
      'FD',
      'HDG',
      'NAV',
      'APR',
      'ALT',
      'VNV',
      'VS',
      'NOSE',
      'UP',
      'FLC',
      'NOSE',
      'DN',
      'VOL',
      'PUSH ID',
      'NAV',
      'PUSH',
      '1-2',
      'HDG',
      'PUSH',
      'HDG SYNC',
      'ALT',
    ].sort(),
  );
});

test('the six units together hold 18 knobs, 2 joysticks, 4 swap buttons, 45 keys and no hit', async ({
  page,
}) => {
  await expect(page.locator('[data-unit] [data-knob]')).toHaveCount(18);
  await expect(page.locator('[data-unit] [data-joystick]')).toHaveCount(2);
  await expect(page.locator('[data-unit] [data-swap]')).toHaveCount(4);
  await expect(page.locator('[data-unit] [data-key]')).toHaveCount(45);
  await expect(page.locator('[data-unit] [data-hit], [data-unit] [data-control-id]')).toHaveCount(
    0,
  );
});

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
