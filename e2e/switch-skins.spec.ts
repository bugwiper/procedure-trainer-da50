import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { FULL_VIEWBOX, afterPairWindow, backgroundPoint, doubleActivateAt } from './support/zoom';

// Switch skins (PNL-11, D-08): the rocker half pressed follows the state on every device.

// Mouse projects click, touch projects tap; both reach the same pointer handlers.
async function activate(hit: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await hit.tap();
  else await hit.click();
}

function control(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('ELECT. MASTER is the big red rocker and its pressed half follows its state', async ({
  page,
  hasTouch,
}) => {
  const sw = control(page, 'sw.elect_master');
  const hit = page.locator('[data-hit="sw.elect_master"]');
  await expect(sw).toHaveCount(1);
  await expect(sw).toHaveAttribute('data-skin', 'rocker');
  await expect(sw).toHaveAttribute('data-size', 'L');
  await expect(sw).toHaveAttribute('data-colour', 'red');
  await expect(sw).toHaveAttribute('data-pressed-half', 'upper');
  await expect(sw).toHaveAttribute('data-state', 'on');
  await expect(sw.locator('text')).toHaveCount(1);

  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-pressed-half', 'lower');
  await expect(sw).toHaveAttribute('data-state', 'off');

  await activate(hit, hasTouch);
  await expect(sw).toHaveAttribute('data-pressed-half', 'upper');
  await expect(sw).toHaveAttribute('data-state', 'on');
});

const RED_IDS = ['sw.elect_master', 'sw.elt'];

/** Taps or clicks at a fraction of the height of the hit rectangle (0 top, 1 bottom). */
async function activateAt(hit: Locator, hasTouch: boolean, fraction: number): Promise<void> {
  const box = await hit.boundingBox();
  if (box === null) throw new Error('hit rectangle has no bounding box');
  const position = { x: box.width / 2, y: box.height * fraction };
  if (hasTouch) await hit.tap({ position });
  else await hit.click({ position });
}

// The pressed half per state: the upper end (on) is upper, the middle (armed) is level, the
// lower end (off, reset_test) is lower.
function expectedHalf(state: string | null): string {
  return state === 'on' ? 'upper' : state === 'armed' ? 'level' : 'lower';
}

test('the three-position ELT rocker shows upper, level and lower for on, armed and reset_test', async ({
  page,
  hasTouch,
}) => {
  const elt = control(page, 'sw.elt');
  const hit = page.locator('[data-hit="sw.elt"]');
  await expect(elt).toHaveAttribute('data-skin', 'rocker');
  await expect(elt).toHaveAttribute('data-state', 'armed');
  await expect(elt).toHaveAttribute('data-pressed-half', 'level');
  for (const [fraction, state] of [
    [1 / 6, 'on'],
    [1 / 2, 'armed'],
    [5 / 6, 'reset_test'],
    [1 / 2, 'armed'],
  ] as const) {
    await activateAt(hit, hasTouch, fraction);
    await expect(elt).toHaveAttribute('data-state', state);
    await expect(elt).toHaveAttribute('data-pressed-half', expectedHalf(state));
  }
});

test('every rocker pressed half matches its state before and after one tap', async ({
  page,
  hasTouch,
}) => {
  const ids = await page
    .locator('[data-skin="rocker"][data-kind="toggle"]:not([data-control-id="sw.elt"])')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-control-id') ?? ''));
  // The three-position ELT has its own case above.
  expect(ids.length).toBeGreaterThanOrEqual(10);
  for (const id of ids) {
    const group = control(page, id);
    const half = async () => {
      const state = await group.getAttribute('data-state');
      // The second state in registry order (ON for every two-state rocker) is the upper end.
      return expectedHalf(state);
    };
    await expect(group, id).toHaveAttribute('data-pressed-half', await half());
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(group, id).toHaveAttribute('data-pressed-half', await half());
    const afterTap = await group.getAttribute('data-pressed-half');
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(group, id).not.toHaveAttribute('data-pressed-half', afterTap ?? '');
  }
});

test('red rockers are exactly ELECT. MASTER and ELT, the rest white; the ALTERNATE switch is a bat under its guard', async ({
  page,
}) => {
  const red = await page
    .locator('[data-skin="rocker"][data-colour="red"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-control-id')));
  expect(red.sort()).toEqual(RED_IDS);
  const white = page.locator('[data-skin="rocker"][data-colour="white"]');
  await expect(white).toHaveCount(9);
});

test('the four light rockers are white, flip and keep LIGHT size', async ({ page, hasTouch }) => {
  for (const id of ['sw.light_landing', 'sw.light_taxi', 'sw.light_position', 'sw.light_strobe']) {
    const group = control(page, id);
    await expect(group, id).toHaveAttribute('data-size', 'LIGHT');
    await expect(group, id).toHaveAttribute('data-colour', 'white');
    const before = await group.getAttribute('data-state');
    await activate(page.locator(`[data-hit="${id}"]`), hasTouch);
    await expect(group, id).not.toHaveAttribute('data-state', before ?? '');
  }
});

test('the pressed ring is transient: present while the mouse is held, gone after release', async ({
  page,
  hasTouch,
}, testInfo) => {
  test.skip(hasTouch || testInfo.project.name !== 'desktop-chromium', 'mouse hold on desktop');
  const group = control(page, 'sw.ess_bus');
  const hit = page.locator('[data-hit="sw.ess_bus"]');
  await expect(group).not.toHaveAttribute('data-pressed', 'true');
  const box = await hit.boundingBox();
  if (box === null) throw new Error('ESS BUS has no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(group).toHaveAttribute('data-pressed', 'true');
  await page.mouse.up();
  await expect(group).not.toHaveAttribute('data-pressed', 'true');
});

test('the guarded ALTERNATE toggle is a bat that follows its state once the guard is lifted', async ({
  page,
  hasTouch,
}) => {
  const sw = control(page, 'sw.deice_alternate');
  await expect(sw).toHaveAttribute('data-skin', 'bat');
  await expect(sw).not.toHaveAttribute('data-size', /.*/);
  await expect(sw).not.toHaveAttribute('data-colour', /.*/);
  await expect(sw).toHaveAttribute('data-state', 'off');
  await expect(sw.locator('text')).toHaveCount(0);
  await activate(page.locator('[data-hit="sw.deice_alternate.guard"]'), hasTouch);
  await afterPairWindow(page);
  await activate(page.locator('[data-hit="sw.deice_alternate"]'), hasTouch);
  await expect(sw).toHaveAttribute('data-state', 'on');
  await afterPairWindow(page);
  await activate(page.locator('[data-hit="sw.deice_alternate"]'), hasTouch);
  await expect(sw).toHaveAttribute('data-state', 'off');
});

test('the EMERGENCY WINDOW oval toggles by a click or tap, is drawn ajar when open and prints no text', async ({
  page,
  hasTouch,
}) => {
  const win = control(page, 'sw.emerg_window');
  const hit = page.locator('[data-hit="sw.emerg_window"]');
  await expect(win).toHaveAttribute('data-skin', 'window');
  await expect(win).toHaveAttribute('data-state', 'closed');
  await expect(win.locator('[data-window="closed"]')).toHaveCount(1);
  await expect(win.locator('[data-window-gap]')).toHaveCount(0);
  await activate(hit, hasTouch);
  await expect(win).toHaveAttribute('data-state', 'open');
  await expect(win.locator('[data-window="open"]')).toHaveCount(1);
  await expect(win.locator('[data-window-gap]')).toHaveCount(1);
  await expect(win.locator('text')).toHaveCount(0);
  await afterPairWindow(page);
  await activate(hit, hasTouch);
  await expect(win).toHaveAttribute('data-state', 'closed');
  await expect(win.locator('[data-window-gap]')).toHaveCount(0);
});

test('a double tap on the pane beside the oval zooms into the window region and out again', async ({
  page,
  hasTouch,
}) => {
  const p = await backgroundPoint(page, 'side_window');
  await doubleActivateAt(page, p, hasTouch);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  const view = (await page.getByTestId('panel').getAttribute('viewBox')) ?? '';
  // The view is the small region around the pane in the left strip, not the whole panel.
  expect(Number(view.split(' ')[2])).toBeLessThan(400);
  await afterPairWindow(page);
  await expect(page.locator('[data-control-id="sw.emerg_window"]')).toHaveAttribute(
    'data-state',
    'closed',
  );
});
