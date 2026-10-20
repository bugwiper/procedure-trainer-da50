import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

// Built-panel gate for owner finding G-0.1: nothing printed on the panel changes with state.
// Controls and lamps show their state by position and light only. The spec drives the real
// pointer handlers and reads only the DOM, so it also runs against the live site.

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(target: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await target.tap();
  else await target.click();
}

/**
 * All text strings of the panel svg (every svg text element): trimmed, non-empty, sorted. The
 * glass displays (PFD and MFD regions) are excluded unless the text belongs to a control: their
 * content is instrument data, and the MFD page softkey legitimately switches it between MAP and
 * ENGINE. Everything else on the panel is placard, caption or scale text and must stay put.
 */
async function panelText(page: Page): Promise<string[]> {
  return page.locator('[data-testid="panel"]').evaluate((svg) =>
    Array.from(svg.querySelectorAll('text'))
      .filter(
        (el) =>
          el.closest('[data-control-id]') !== null ||
          el.closest('[data-region-id="pfd"], [data-region-id="mfd"]') === null,
      )
      .map((el) => (el.textContent ?? '').trim())
      .filter((text) => text.length > 0)
      .sort(),
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('no element of the built panel carries the state-text marker', async ({ page }) => {
  await expect(page.locator('[data-state-text]')).toHaveCount(0);
  await expect(page.locator('[data-indicator-group]')).toHaveCount(0);
});

test('the panel text is identical before and after operating a representative set of controls', async ({
  page,
  hasTouch,
}) => {
  const before = await panelText(page);
  expect(before.length).toBeGreaterThan(0);
  // The lamps keep their static captions.
  for (const caption of ['NOSE', 'LEFT', 'RIGHT', 'UNSAFE', 'UP', 'T/O 133 KIAS', 'LDG 121 KIAS']) {
    expect(before, caption).toContain(caption);
  }

  // A rocker, a bat, the ENGINE softkey and a dimmer knob step.
  await activate(page.locator('[data-hit="sw.light_landing"]'), hasTouch);
  await expect(page.locator('[data-control-id="sw.light_landing"]')).not.toHaveAttribute(
    'data-state',
    'off',
  );
  await activate(page.locator('[data-hit="sw.alternator_1"]'), hasTouch);
  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);
  await expect(page.locator('[data-control-id="sw.mfd_page"]')).toHaveAttribute(
    'data-state',
    'engine',
  );
  const hit = page.locator('[data-hit="sw.instr_light"]');
  const box = await hit.boundingBox();
  if (box === null) throw new Error('no bounding box');
  const stepBefore = await page
    .locator('[data-control-id="sw.instr_light"]')
    .getAttribute('data-state');
  if (hasTouch) await page.touchscreen.tap(box.x + box.width * 0.75, box.y + box.height / 2);
  else await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);
  await expect(page.locator('[data-control-id="sw.instr_light"]')).not.toHaveAttribute(
    'data-state',
    stepBefore ?? '',
  );

  // The levers: GEAR to DOWN, FLAPS to LDG.
  await activate(page.locator('[data-detent="lv.gear:down"]'), hasTouch);
  await expect(page.locator('[data-indicator-id="lt.gear_nose"]')).toHaveAttribute(
    'data-lit',
    'true',
  );
  await activate(page.locator('[data-detent="lv.flaps:ldg"]'), hasTouch);
  await expect(page.locator('[data-indicator-id="lt.flap_ldg"]')).toHaveAttribute(
    'data-lit',
    'true',
  );

  // The de-ice guard lifted.
  await activate(page.locator('[data-hit="sw.deice_alternate.guard"]'), hasTouch);
  await expect(page.locator('[data-control-id="sw.deice_alternate.guard"]')).toHaveAttribute(
    'data-state',
    'open',
  );

  const after = await panelText(page);
  expect(after).toEqual(before);
});
