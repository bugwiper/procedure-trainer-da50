import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Gear and flap lamps (PNL-14, D-11): derived from the levers, never operable, never graded.

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here
// because the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
  indicators(): Record<string, 'lit' | 'off'>;
}
interface PageHost {
  __panel?: PanelHook;
}

interface Point {
  x: number;
  y: number;
}

async function activate(target: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await target.tap();
  else await target.click();
}

function lamp(page: Page, id: string): Locator {
  return page.locator(`[data-indicator-id="${id}"]`);
}

const GEAR_LAMPS = ['lt.gear_nose', 'lt.gear_left', 'lt.gear_right', 'lt.gear_unsafe'] as const;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('GEAR DOWN lights the three green lamps and GEAR UP turns all four off', async ({
  page,
  hasTouch,
}) => {
  for (const id of GEAR_LAMPS) await expect(lamp(page, id)).toHaveAttribute('data-lit', 'false');

  await activate(page.locator('[data-detent="lv.gear:down"]'), hasTouch);
  await expect(lamp(page, 'lt.gear_nose')).toHaveAttribute('data-lit', 'true');
  await expect(lamp(page, 'lt.gear_left')).toHaveAttribute('data-lit', 'true');
  await expect(lamp(page, 'lt.gear_right')).toHaveAttribute('data-lit', 'true');
  await expect(lamp(page, 'lt.gear_unsafe')).toHaveAttribute('data-lit', 'false');

  await activate(page.locator('[data-detent="lv.gear:up"]'), hasTouch);
  for (const id of GEAR_LAMPS) await expect(lamp(page, id)).toHaveAttribute('data-lit', 'false');
});

test('holding GEAR TEST lights all four gear lamps and releasing restores the lever picture', async ({
  page,
  hasTouch,
}) => {
  test.skip(hasTouch, 'a touch cannot be held in Playwright; covered by the mouse projects');
  const box = await page.locator('[data-hit="btn.stall_gear_test"]').boundingBox();
  if (box === null) throw new Error('no hit box for the spring toggle');
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
  await page.mouse.down();
  for (const id of GEAR_LAMPS) await expect(lamp(page, id)).toHaveAttribute('data-lit', 'true');
  await page.mouse.up();
  for (const id of GEAR_LAMPS) await expect(lamp(page, id)).toHaveAttribute('data-lit', 'false');

  // STALL TEST (left half) changes no lamp.
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator('[data-control-id="btn.stall_gear_test"]')).toHaveAttribute(
    'data-state',
    'stall_test',
  );
  for (const id of GEAR_LAMPS) await expect(lamp(page, id)).toHaveAttribute('data-lit', 'false');
  await page.mouse.up();
});

const FLAP_LAMPS = ['lt.flap_up', 'lt.flap_to', 'lt.flap_ldg'] as const;
const FLAP_CASES = [
  ['up', 'lt.flap_up'],
  ['to', 'lt.flap_to'],
  ['ldg', 'lt.flap_ldg'],
] as const;

test('each FLAPS marker lights exactly its lamp', async ({ page, hasTouch }) => {
  // Cycle away from the default first so every case is a real change.
  for (const [detent, lit] of [FLAP_CASES[1], FLAP_CASES[2], FLAP_CASES[0]]) {
    await activate(page.locator(`[data-detent="lv.flaps:${detent}"]`), hasTouch);
    for (const id of FLAP_LAMPS) {
      await expect(lamp(page, id), `${detent} ${id}`).toHaveAttribute(
        'data-lit',
        id === lit ? 'true' : 'false',
      );
    }
  }
});

test('lamps are never tap targets', async ({ page }) => {
  // Selector of src/ui/panel/zoom.ts TAP_TARGET_SELECTOR.
  await expect(page.locator('[data-indicator-id] :is([data-hit], [data-detent])')).toHaveCount(0);
  await expect(page.locator('[data-indicator-id]:is([data-hit], [data-detent])')).toHaveCount(0);
  await expect(page.locator('[data-indicator-id]')).toHaveCount(8);
  await expect(page.locator('[data-indicator-id][data-control-id]')).toHaveCount(0);
});

test('the ELT lamp is lit in ON only: top third lights it, middle third turns it off', async ({
  page,
  hasTouch,
}) => {
  const hit = page.locator('[data-hit="sw.elt"]');
  const tapAt = async (fraction: number) => {
    const box = await hit.boundingBox();
    if (box === null) throw new Error('no hit box for the ELT');
    const position = { x: box.width / 2, y: box.height * fraction };
    if (hasTouch) await hit.tap({ position });
    else await hit.click({ position });
  };
  const elt = lamp(page, 'lt.elt');
  await expect(elt).toHaveCount(1);
  await expect(elt).toHaveAttribute('data-lit', 'false');
  await tapAt(1 / 6);
  await expect(elt).toHaveAttribute('data-lit', 'true');
  await tapAt(1 / 2);
  await expect(elt).toHaveAttribute('data-lit', 'false');
  await tapAt(5 / 6);
  await expect(elt).toHaveAttribute('data-lit', 'false');
  // The lamp prints no text of its own.
  await expect(elt.locator('text')).toHaveCount(0);
});

test('@hooks lever moves record only lv.gear events and a tap on a lamp records none', async ({
  page,
  hasTouch,
}) => {
  const events = () =>
    page.evaluate(() => (globalThis as unknown as PageHost).__panel?.events() ?? []);
  await activate(page.locator('[data-detent="lv.gear:down"]'), hasTouch);
  await activate(page.locator('[data-detent="lv.gear:up"]'), hasTouch);
  const logged = await events();
  expect(logged.map((e) => [e.id, e.value])).toEqual([
    ['lv.gear', 'down'],
    ['lv.gear', 'up'],
  ]);
  expect(logged.some((e) => e.id.startsWith('lt.'))).toBe(false);

  const box = await lamp(page, 'lt.gear_nose').boundingBox();
  if (box === null) throw new Error('no bounding box');
  const centre: Point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  if (hasTouch) await page.touchscreen.tap(centre.x, centre.y);
  else await page.mouse.click(centre.x, centre.y);
  expect(await events()).toHaveLength(2);
});

test('@hooks window.__panel.indicators() agrees with every data-lit attribute', async ({
  page,
  hasTouch,
}) => {
  const check = async () => {
    const hook = await page.evaluate(
      () => (globalThis as unknown as PageHost).__panel?.indicators() ?? {},
    );
    expect(Object.keys(hook)).toHaveLength(8);
    for (const [id, state] of Object.entries(hook)) {
      await expect(lamp(page, id), id).toHaveAttribute(
        'data-lit',
        state === 'lit' ? 'true' : 'false',
      );
    }
  };
  await check();
  await activate(page.locator('[data-detent="lv.gear:down"]'), hasTouch);
  await activate(page.locator('[data-detent="lv.flaps:ldg"]'), hasTouch);
  await expect(lamp(page, 'lt.flap_ldg')).toHaveAttribute('data-lit', 'true');
  await check();
});
