import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  FULL_VIEWBOX,
  afterPairWindow,
  backgroundPoint,
  buttonCoverage,
  doubleActivateAt,
  sessionButtonCoverage,
  zoomIntoRegion,
} from './support/zoom';
import type { Point } from './support/zoom';

// SES-01 (phase 02, plan 10): the session area in the co-pilot legroom is as safe to use as every
// other region. Zoomed into it, the Full panel button covers no session button (U-07); a double
// click or double tap on a session button never zooms and records no control event (UI-SPEC
// gesture contract); a double tap on the background of the area zooms in as on any region.

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here because
// the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
}
type HookHost = { __panel?: PanelHook };

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
