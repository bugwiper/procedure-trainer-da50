import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  FULL_VIEWBOX,
  afterPairWindow,
  backgroundPoint,
  buttonCoverage,
  activate,
  doubleActivateAt,
  sessionButtonCoverage,
  zoomIntoRegion,
} from './support/zoom';
import type { Point } from './support/zoom';
import { startScenario, shippedScenarios } from './support/session';

// SES-01 (phase 02, plan 10): the session area in the co-pilot legroom is as safe to use as every
// other region. Zoomed into it, the Full panel button covers no session button (U-07); a double
// click or double tap on a session button never zooms and records no control event (UI-SPEC
// gesture contract); a double tap on the background of the area zooms in as on any region.

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here because
// the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
  state(): Record<string, string>;
  quantities(): Record<string, number>;
}
interface SessionHook {
  screen(): string;
  scenarioId(): string | null;
  now(): number | null;
}
type HookHost = { __panel?: PanelHook; __panelSession?: SessionHook };

const AREA = 'scenario_area';
const NEW_SITUATION = '[data-session-hit="session.new"]';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  // The rotate hint of a portrait phone covers the panel until it is dismissed.
  const dismiss = page.getByTestId('rotate-hint-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByTestId('rotate-hint')).toBeHidden();
});

function events(page: Page): Promise<{ id: string; value: string }[]> {
  return page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
}

/** The centre of the NEW SITUATION hit box in page coordinates. */
async function newSituationCentre(page: Page): Promise<Point> {
  const box = await page.locator(NEW_SITUATION).boundingBox();
  if (box === null) throw new Error('NEW SITUATION has no box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('zoomed into the session area, the Full panel button covers no session button and no control', async ({
  page,
  hasTouch,
}) => {
  await zoomIntoRegion(page, hasTouch, AREA);
  await expect(page.getByTestId('zoom-out')).toBeVisible();
  expect(await sessionButtonCoverage(page), 'session buttons under Full panel').toEqual([]);
  expect(await buttonCoverage(page), 'controls under Full panel').toEqual([]);
  // The area is on screen at all: the NEW SITUATION button has a box inside the viewport.
  const box = await page.locator(NEW_SITUATION).boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(0);
});

test('a double tap on the background of the area zooms in as on any region', async ({
  page,
  hasTouch,
}) => {
  const p = await backgroundPoint(page, AREA);
  await doubleActivateAt(page, p, hasTouch);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
  await expect(page.getByTestId('zoom-out')).toBeVisible();
});

test('@hooks a double click or double tap on NEW SITUATION leaves the view at the full panel and records no event', async ({
  page,
  hasTouch,
}) => {
  await doubleActivateAt(page, await newSituationCentre(page), hasTouch);
  await afterPairWindow(page);
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  expect(await events(page)).toEqual([]);
});

// A double press must open exactly one overlay: the first press starts the load, the second lands
// on a busy area or on the shield of the surface the first one opened (U-12, T-02-22).
const dialogs = (page: Page) => page.locator('[role="dialog"], [role="alertdialog"]');

test('@hooks a double tap or double click on NEW SITUATION opens exactly one briefing and records no event', async ({
  page,
  hasTouch,
}) => {
  await doubleActivateAt(page, await newSituationCentre(page), hasTouch);
  await expect(page.getByTestId('level-pick')).toBeVisible();
  await afterPairWindow(page);
  await expect(page.getByTestId('level-pick')).toHaveCount(1);
  await expect(dialogs(page)).toHaveCount(1);
  expect(await events(page)).toEqual([]);
});

test('@hooks a double tap or double click on the list row opens exactly one briefing and records no event', async ({
  page,
  hasTouch,
}) => {
  await activate(page.locator('[data-session-hit="session.choose"]'), hasTouch);
  const row = page.locator('[data-session-hit^="session.row."]').first();
  await expect(row).toBeVisible();
  // The rows ignore presses for 400 ms after the list appears; the double press comes after that.
  await page.waitForTimeout(500);
  const box = await row.boundingBox();
  if (box === null) throw new Error('the row has no box');
  await doubleActivateAt(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, hasTouch);
  await expect(page.getByTestId('level-pick')).toBeVisible();
  await afterPairWindow(page);
  await expect(page.getByTestId('level-pick')).toHaveCount(1);
  await expect(dialogs(page)).toHaveCount(1);
  expect(await events(page)).toEqual([]);
});

test('@hooks a double tap on CHOOSE SITUATION lists once and picks no row', async ({
  page,
  hasTouch,
}) => {
  const box = await page.locator('[data-session-hit="session.choose"]').boundingBox();
  if (box === null) throw new Error('CHOOSE SITUATION has no box');
  await doubleActivateAt(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, hasTouch);
  await afterPairWindow(page);
  // The second press fell on a row or CLOSE LIST of the fresh list and was shielded.
  await expect(page.locator('[data-session-hit^="session.row."]')).toHaveCount(
    shippedScenarios().length,
  );
  await expect(dialogs(page)).toHaveCount(0);
  expect(await events(page)).toEqual([]);
});

// RESET returns the panel to its original state: registry defaults, base quantities, no run, no
// log. On the free panel it acts at once; during a run it goes through the leave-run confirm.
const RESET = '[data-session-hit="session.reset"]';
const ENGINE_ROW = 'engine.eng-oil-temp-green';

function panelState(page: Page) {
  return page.evaluate(() => {
    const host = globalThis as HookHost;
    return {
      state: host.__panel?.state() ?? {},
      quantities: host.__panel?.quantities() ?? {},
      events: host.__panel?.events() ?? [],
      screen: host.__panelSession?.screen() ?? 'no hook',
      scenarioId: host.__panelSession?.scenarioId() ?? null,
      now: host.__panelSession?.now() ?? null,
    };
  });
}

test('@hooks RESET on the free panel puts the changed controls back at once', async ({
  page,
  hasTouch,
}) => {
  const original = await panelState(page);
  await activate(page.locator('[data-detent="lv.cowl_flap:open"]'), hasTouch);
  await expect(page.locator('[data-control-id="lv.cowl_flap"]')).toHaveAttribute(
    'data-state',
    'open',
  );
  await activate(page.locator(RESET), hasTouch);
  await expect(page.getByTestId('leave-run-modal')).toHaveCount(0);
  await expect(page.locator('[data-control-id="lv.cowl_flap"]')).toHaveAttribute(
    'data-state',
    original.state['lv.cowl_flap'] ?? '',
  );
  expect(await panelState(page)).toEqual(original);
});

test('@hooks RESET during a run asks first, then the panel equals its defaults and no run is left', async ({
  page,
  hasTouch,
}) => {
  const original = await panelState(page);
  await startScenario(page, hasTouch, ENGINE_ROW);
  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(page.locator('[data-control-id="lv.power"]')).toHaveAttribute('data-state', 'p50');

  await activate(page.locator(RESET), hasTouch);
  await expect(page.getByTestId('leave-run-modal')).toBeVisible();
  // Keep going leaves the run alone.
  await activate(page.getByTestId('leave-keep'), hasTouch);
  await expect(page.getByTestId('leave-run-modal')).toHaveCount(0);
  expect((await panelState(page)).screen).toBe('running');

  await activate(page.locator(RESET), hasTouch);
  await activate(page.getByTestId('leave-leave'), hasTouch);
  await expect(page.getByTestId('leave-run-modal')).toHaveCount(0);
  await expect(page.getByTestId('procedure-complete')).toHaveCount(0);
  expect(await panelState(page)).toEqual(original);
});
