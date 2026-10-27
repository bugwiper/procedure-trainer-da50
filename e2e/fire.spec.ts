import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { SESSION_LAYOUT, pageCount } from '../src/ui/panel/session-area';
import { startScenario, shippedScenarios } from './support/session';
import { activate, activateAt, afterPairWindow, leaveZoom, zoomIntoRegion } from './support/zoom';

// The fire and smoke pack (Phase 5.1, plan 02) as the pilot meets it on the built panel: the
// situations of scenarios/fire/ are chosen from the pages of CHOOSE SITUATION, run on their scenes
// with their cues and graded by control state. Titles with @hooks read the e2e window hook.

const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);
const FLAMES = '[data-cue="flames"]';
const scene = (id: string) => `[data-layer="windscreen"] [data-scene="${id}"]`;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  // The rotate hint of a portrait phone covers the panel until it is dismissed.
  const dismiss = page.getByTestId('rotate-hint-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByTestId('rotate-hint')).toBeHidden();
});

/** Taps the right (clockwise) half of the FUEL selector, at 75 percent of its width. */
async function tapFuelSelectorRight(page: Page, hasTouch: boolean): Promise<void> {
  const b = await page.locator('[data-hit="sw.fuel_valve"]').boundingBox();
  if (b === null) throw new Error('no bounding box for the FUEL selector');
  await activateAt(page, { x: b.x + b.width * 0.75, y: b.y + b.height / 2 }, hasTouch);
}

/** ENGINE MASTER off, the FUEL selector to OFF (two taps on the zoomed pedestal), ELECT. MASTER off. */
async function shutDown(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'off');
  await zoomIntoRegion(page, hasTouch, 'pedestal');
  await tapFuelSelectorRight(page, hasTouch);
  await afterPairWindow(page);
  await tapFuelSelectorRight(page, hasTouch);
  await expect(control(page, 'sw.fuel_valve')).toHaveAttribute('data-state', 'off');
  await leaveZoom(page, hasTouch);
  await activate(page.locator('[data-hit="sw.elect_master"]'), hasTouch);
  await expect(control(page, 'sw.elect_master')).toHaveAttribute('data-state', 'off');
}

/** The door release lever to OPEN, on the zoomed door region. */
async function openDoor(page: Page, hasTouch: boolean): Promise<void> {
  await zoomIntoRegion(page, hasTouch, 'door_arm');
  await activate(page.locator('[data-hit="lv.door_release"]'), hasTouch);
  await expect(control(page, 'lv.door_release')).toHaveAttribute('data-state', 'open');
  await leaveZoom(page, hasTouch);
}

test('@hooks Engine Fire on Ground: the parked scene and the flames show, the golden run grades PASS', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, 'fire.eng-fire-ground', 'easy');
  await expect(page.locator(scene('parked'))).toHaveCount(1);
  await expect(page.locator(FLAMES)).toHaveCount(1);
  // The door starts locked, so a do-nothing run never credits the Door row.
  await expect(control(page, 'lv.door_release')).toHaveAttribute('data-state', 'locked');

  await shutDown(page, hasTouch);
  await openDoor(page, hasTouch);

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  for (const id of ['engine_master_off', 'fuel_valve_off', 'elect_master_off', 'door_open']) {
    await expect(page.locator(`[data-step-id="${id}"]`)).toHaveAttribute('data-verdict', 'Done');
  }
});

test('@hooks Engine Fire on Ground without the door lever grades FAIL', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, 'fire.eng-fire-ground', 'easy');
  await shutDown(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  await expect(page.locator('[data-step-id="door_open"]')).toHaveAttribute(
    'data-verdict',
    'Missed',
  );
});

test('the fire situations stand on the pages of CHOOSE SITUATION after the four of page 1', async ({
  page,
  hasTouch,
}) => {
  const fire = shippedScenarios().filter((entry) => entry.pack === 'fire');
  expect(fire.length).toBeGreaterThan(0);
  const all = shippedScenarios();
  const rows = SESSION_LAYOUT.choose.maxRows;
  await activate(page.locator('[data-session-hit="session.choose"]'), hasTouch);
  await page.waitForTimeout(500);
  const listed = page.locator('[data-session-hit^="session.row."]');
  for (let turned = 0; turned < pageCount(all.length); turned++) {
    const onPage = all.slice(turned * rows, turned * rows + rows);
    await expect(listed).toHaveCount(onPage.length);
    for (const entry of onPage) {
      await expect(page.locator(`[data-session-hit="session.row.${entry.row}"]`)).toHaveCount(1);
    }
    // A fire situation never shares page 1 with the four earlier situations.
    if (turned === 0) {
      for (const entry of fire) {
        expect(onPage.some((e) => e.row === entry.row)).toBe(all.length <= rows);
      }
    }
    if (pageCount(all.length) > 1) {
      await afterPairWindow(page);
      await activate(page.locator('[data-session-hit="session.next"]'), hasTouch);
    }
  }
});
