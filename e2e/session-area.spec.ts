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
import { SESSION_LAYOUT, pageCount } from '../src/ui/panel/session-area';
import {
  firstShownGroup,
  pressChooseTab,
  scenariosOfGroup,
  startRealistic,
  startScenario,
  walkGroupPages,
} from './support/session';
import { CATALOG_REFERENCE } from '../tests/checklist-catalog-reference';

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

const MIN_HIT_PX = 44;

/** The size on screen of every session-pad hit box that is drawn now, by id (the footwell buttons are `further.*`). */
function hitSizes(page: Page): Promise<[string, number, number][]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-session-hit^="session."]')).map(
      (el): [string, number, number] => {
        const r = el.getBoundingClientRect();
        return [el.getAttribute('data-session-hit') ?? '', r.width, r.height];
      },
    ),
  );
}

test('zoomed into the session area on the free panel, the three buttons are at least 44 px high and wide', async ({
  page,
  hasTouch,
}) => {
  await zoomIntoRegion(page, hasTouch, AREA);
  const sizes = await hitSizes(page);
  expect(sizes.map(([id]) => id).sort()).toEqual([
    'session.choose',
    'session.new',
    'session.reset',
  ]);
  for (const [id, w, h] of sizes) {
    expect(w, `${id} wide`).toBeGreaterThanOrEqual(MIN_HIT_PX);
    expect(h, `${id} high`).toBeGreaterThanOrEqual(MIN_HIT_PX);
  }
});

for (const level of ['easy', 'realistic'] as const) {
  test(`zoomed into the session area during a ${level} run, the run view is at least 44 px, the Full panel button covers none of it and no free-panel button is drawn`, async ({
    page,
    hasTouch,
  }) => {
    if (level === 'easy') await startScenario(page, hasTouch, ENGINE_ROW, 'easy');
    else await startRealistic(page, hasTouch, ENGINE_ROW);
    await zoomIntoRegion(page, hasTouch, AREA);
    await expect(page.getByTestId('zoom-out')).toBeVisible();
    expect(await sessionButtonCoverage(page), 'run view under Full panel').toEqual([]);
    const sizes = await hitSizes(page);
    expect(sizes.map(([id]) => id).sort()).toEqual(
      [
        'session.checklist',
        ...(level === 'realistic' ? ['session.hint'] : []),
        'session.leave',
      ].sort(),
    );
    for (const [id, w, h] of sizes) {
      expect(w, `${id} wide`).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(h, `${id} high`).toBeGreaterThanOrEqual(MIN_HIT_PX);
    }
  });
}

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
    Math.min(scenariosOfGroup(firstShownGroup()).length, SESSION_LAYOUT.choose.maxRows),
  );
  await expect(dialogs(page)).toHaveCount(0);
  expect(await events(page)).toEqual([]);
});

test('every tab pages when it has more situations than rows, and shows NEXT PAGE only then', async ({
  page,
  hasTouch,
}) => {
  const rows = SESSION_LAYOUT.choose.maxRows;
  await activate(page.locator('[data-session-hit="session.choose"]'), hasTouch);
  await page.waitForTimeout(500);
  const sizes = CATALOG_REFERENCE.map((group) => scenariosOfGroup(group.id).length);
  // The shipped scenarios exercise both cases: a tab of one page and a tab of several.
  expect(sizes.some((n) => n > rows)).toBe(true);
  expect(sizes.some((n) => n > 0 && n <= rows)).toBe(true);
  for (const group of CATALOG_REFERENCE) {
    const total = scenariosOfGroup(group.id).length;
    const walked = await walkGroupPages(page, hasTouch, group.id);
    expect(walked).toHaveLength(pageCount(total));
    for (const onScreen of walked) expect(onScreen.rows.length).toBeLessThanOrEqual(rows);
    // Every situation of the tab appears on exactly one page.
    expect(walked.flatMap((onScreen) => onScreen.rows)).toEqual(
      scenariosOfGroup(group.id).map((entry) => entry.row),
    );
  }
});

test('a tab press shows the first page of that tab and marks the tab selected, the others not', async ({
  page,
  hasTouch,
}) => {
  const rows = SESSION_LAYOUT.choose.maxRows;
  const paged = CATALOG_REFERENCE.find((group) => scenariosOfGroup(group.id).length > rows);
  if (paged === undefined) throw new Error('no tab has more than one page');
  const other = CATALOG_REFERENCE.find((group) => group.id !== paged.id);
  if (other === undefined) throw new Error('only one tab');
  await activate(page.locator('[data-session-hit="session.choose"]'), hasTouch);
  await page.waitForTimeout(500);
  await pressChooseTab(page, hasTouch, paged.id);
  await activate(page.locator('[data-session-hit="session.next"]'), hasTouch);
  await afterPairWindow(page);
  const first = scenariosOfGroup(paged.id)[rows];
  await expect(page.locator(`[data-session-hit="session.row.${first?.row ?? ''}"]`)).toHaveCount(1);
  // Back to the first page by changing the tab and returning.
  await pressChooseTab(page, hasTouch, other.id);
  await pressChooseTab(page, hasTouch, paged.id);
  const top = scenariosOfGroup(paged.id)[0];
  await expect(page.locator(`[data-session-hit="session.row.${top?.row ?? ''}"]`)).toHaveCount(1);
  for (const group of CATALOG_REFERENCE) {
    await expect(page.locator(`[data-session-button="session.tab.${group.id}"]`)).toHaveAttribute(
      'aria-pressed',
      group.id === paged.id ? 'true' : 'false',
    );
  }
});

// The two-line choose tabs (Phase 9, plan 09-05, R-17): in the open choose view, zoomed into the
// session area, every tab keeps its hit box at least 44 px high and wide, shows the lines of the
// independent reference, and the text lies inside the face of its tab, centred, with room at the rim.
test('the choose tabs read in two lines that lie inside their tab, centred, with a hit box of at least 44 px', async ({
  page,
  hasTouch,
}) => {
  await zoomIntoRegion(page, hasTouch, AREA);
  await activate(page.locator('[data-session-hit="session.choose"]'), hasTouch);
  await page.waitForTimeout(500);
  const tabs = SESSION_LAYOUT.choose.tabs;
  expect(tabs).toHaveLength(CATALOG_REFERENCE.length);
  for (const [index, group] of CATALOG_REFERENCE.entries()) {
    const unit = tabs[index];
    if (unit === undefined) throw new Error(`no tab rectangle for ${group.id}`);
    const button = page.locator(`[data-session-button="session.tab.${group.id}"]`);
    const hit = await page.locator(`[data-session-hit="session.tab.${group.id}"]`).boundingBox();
    const face = await button.locator('rect').first().boundingBox();
    if (hit === null || face === null) throw new Error(`no box for the tab ${group.id}`);
    expect(hit.width, `${group.id} wide`).toBeGreaterThanOrEqual(MIN_HIT_PX);
    expect(hit.height, `${group.id} high`).toBeGreaterThanOrEqual(MIN_HIT_PX);
    // Screen pixels per panel unit of this tab.
    const scale = face.width / unit.w;
    const lines = group.tab.split('\n');
    const spans = button.locator('text tspan');
    await expect(spans).toHaveCount(lines.length);
    const boxes = [];
    for (const [lineIndex, line] of lines.entries()) {
      await expect(spans.nth(lineIndex)).toHaveText(line);
      const box = await spans.nth(lineIndex).boundingBox();
      if (box === null) throw new Error(`no box for ${line}`);
      boxes.push(box);
      // Inside the face with the margin of the glyph rule (6 units, a unit of slack for rounding).
      expect(box.x - face.x, `${line} left room`).toBeGreaterThanOrEqual(5 * scale);
      expect(
        face.x + face.width - (box.x + box.width),
        `${line} right room`,
      ).toBeGreaterThanOrEqual(5 * scale);
      // Each line is centred on the tab.
      expect(
        Math.abs(box.x + box.width / 2 - (face.x + face.width / 2)),
        `${line} centred`,
      ).toBeLessThan(1.5 * scale);
    }
    const top = Math.min(...boxes.map((b) => b.y));
    const bottom = Math.max(...boxes.map((b) => b.y + b.height));
    expect(top, `${group.id} top`).toBeGreaterThan(face.y);
    expect(bottom, `${group.id} bottom`).toBeLessThan(face.y + face.height);
    // The block of lines is centred on the tab (the text boxes include the line gap, so a few units of slack).
    expect(
      Math.abs((top + bottom) / 2 - (face.y + face.height / 2)),
      `${group.id} block centred`,
    ).toBeLessThan(5 * scale);
  }
});

// RESET returns the panel to its original state: registry defaults, base quantities, no run, no
// log. On the free panel it acts at once; during a run it goes through the leave-run confirm.
const RESET = '[data-session-hit="session.reset"]';
const LEAVE = '[data-session-hit="session.leave"]';
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

test('@hooks LEAVE during a run asks first, then the panel equals its defaults and no run is left; RESET is not drawn during a run', async ({
  page,
  hasTouch,
}) => {
  const original = await panelState(page);
  await startScenario(page, hasTouch, ENGINE_ROW);
  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(page.locator('[data-control-id="lv.power"]')).toHaveAttribute('data-state', 'p50');

  await expect(page.locator(RESET)).toHaveCount(0);
  await activate(page.locator(LEAVE), hasTouch);
  await expect(page.getByTestId('leave-run-modal')).toBeVisible();
  // Keep going leaves the run alone.
  await activate(page.getByTestId('leave-keep'), hasTouch);
  await expect(page.getByTestId('leave-run-modal')).toHaveCount(0);
  expect((await panelState(page)).screen).toBe('running');

  await activate(page.locator(LEAVE), hasTouch);
  await activate(page.getByTestId('leave-leave'), hasTouch);
  await expect(page.getByTestId('leave-run-modal')).toHaveCount(0);
  await expect(page.getByTestId('procedure-complete')).toHaveCount(0);
  expect(await panelState(page)).toEqual(original);
  // The free panel has its three buttons again.
  for (const hit of [NEW_SITUATION, '[data-session-hit="session.choose"]', RESET]) {
    await expect(page.locator(hit)).toHaveCount(1);
  }
});
