import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { ALL_REGION_IDS, CB_REFERENCE } from '../tests/layout-reference';
import { FULL_VIEWBOX, activate, buttonCoverage, zoomIntoRegion } from './support/zoom';

// Circuit-breaker contract on the built panel (PNL-12, D-02, D-03, owner rule G-0.1): the first
// breaker, cb.pitot, starts pushed in without a ring, one tap pulls it (raised cap, one white ring),
// a second tap pushes it back in, and no state text exists at any time. The second half of the
// file covers all 51 breakers of the registry (ids from the independent reference table).

const ID = 'cb.pitot';
const REGION = 'cb_essential';
const PORTRAIT_NOTE =
  'Portrait phones are covered by the rotate hint (D-02); pinch zoom reaches full tap size there';

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here because
// the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string; source: string; seq: number }[];
}
type HookHost = { __panel?: PanelHook };

function breaker(page: Page): Locator {
  return page.locator(`[data-control-id="${ID}"]`);
}

function breakerOf(page: Page, id: string): Locator {
  return page.locator(`[data-control-id="${id}"]`);
}

function hit(page: Page): Locator {
  return page.locator(`[data-hit="${ID}"]`);
}

/** Mouse projects click the hit; touch projects zoom into the region first, then tap the hit. */
async function reach(page: Page, hasTouch: boolean): Promise<void> {
  if (!hasTouch) return;
  await zoomIntoRegion(page, hasTouch, REGION);
}

/** All text strings of the panel svg outside the glass displays, trimmed, non-empty, sorted. */
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

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('cb.pitot starts pushed in, without a ring, with its static label and rating', async ({
  page,
}) => {
  const cb = breaker(page);
  await expect(cb).toHaveCount(1);
  await expect(cb).toHaveAttribute('data-kind', 'circuit-breaker');
  await expect(cb).toHaveAttribute('data-state', 'in');
  await expect(cb).toHaveAttribute('data-group', 'essential');
  await expect(cb).toHaveAttribute('data-rating', '20');
  await expect(cb).toHaveAttribute('aria-label', 'CIRCUIT BREAKER PITOT: IN');
  await expect(cb.locator('[data-breaker-ring]')).toHaveCount(0);
  await expect(cb.locator('[data-breaker-cap]')).toHaveCount(1);
  await expect(cb.locator('[data-breaker-socket]')).toHaveCount(1);
  await expect(hit(page)).toHaveCount(1);
});

test('a tap pulls the breaker out with one ring, a second tap pushes it in again', async ({
  page,
  hasTouch,
}) => {
  const cb = breaker(page);
  const cap = cb.locator('[data-breaker-cap]');
  const capIn = await cap.getAttribute('transform');
  await reach(page, hasTouch);

  await activate(hit(page), hasTouch);
  await expect(cb).toHaveAttribute('data-state', 'out');
  await expect(cb).toHaveAttribute('aria-label', 'CIRCUIT BREAKER PITOT: OUT');
  await expect(cb.locator('[data-breaker-ring]')).toHaveCount(1);
  expect(await cap.getAttribute('transform')).not.toBe(capIn);

  await activate(hit(page), hasTouch);
  await expect(cb).toHaveAttribute('data-state', 'in');
  await expect(cb.locator('[data-breaker-ring]')).toHaveCount(0);
  expect(await cap.getAttribute('transform')).toBe(capIn);
});

test('the printed panel text is identical before and after a pull, and no state text exists', async ({
  page,
  hasTouch,
}) => {
  const before = await panelText(page);
  expect(before.length).toBeGreaterThan(0);
  await expect(page.locator('[data-state-text]')).toHaveCount(0);
  // The breaker prints only its label and its rating, in both states.
  expect(await breaker(page).locator('text').allTextContents()).toEqual(['20', 'PITOT']);

  await reach(page, hasTouch);
  await activate(hit(page), hasTouch);
  await expect(breaker(page)).toHaveAttribute('data-state', 'out');
  expect(await panelText(page)).toEqual(before);
  expect(await breaker(page).locator('text').allTextContents()).toEqual(['20', 'PITOT']);
  await expect(page.locator('[data-state-text]')).toHaveCount(0);

  await activate(hit(page), hasTouch);
  await expect(breaker(page)).toHaveAttribute('data-state', 'in');
  expect(await panelText(page)).toEqual(before);
});

test('@hooks the first tap appends exactly one event, cb.pitot out', async ({ page, hasTouch }) => {
  const events = () => page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(await events()).toHaveLength(0);

  await reach(page, hasTouch);
  await activate(hit(page), hasTouch);
  await expect(breaker(page)).toHaveAttribute('data-state', 'out');
  const logged = await events();
  expect(logged).toHaveLength(1);
  expect(logged[0]?.id).toBe(ID);
  expect(logged[0]?.value).toBe('out');

  await activate(hit(page), hasTouch);
  await expect(breaker(page)).toHaveAttribute('data-state', 'in');
  expect((await events()).map((e) => [e.id, e.value])).toEqual([
    [ID, 'out'],
    [ID, 'in'],
  ]);
});

// ---------------------------------------------------------------------------------------------
// All breakers (plan 04): the ids come from the independent reference table, never a typed list.

const ALL_IDS: readonly string[] = CB_REFERENCE.map((r) => r.id);
const BREAKER_REGIONS: readonly string[] = ALL_REGION_IDS.filter((id) => id.startsWith('cb_'));

/** Budget of svg elements below the panel root (UI-SPEC U-27; an unmeasured figure of the plan). */
const ELEMENT_BUDGET = 2500;

/** Region id of every breaker, read from the DOM, in reference order. */
async function regionOfEach(page: Page): Promise<Map<string, string>> {
  const pairs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-kind="circuit-breaker"]')).map((el) => [
      el.getAttribute('data-control-id') ?? '',
      el.closest('[data-region-id]')?.getAttribute('data-region-id') ?? '',
    ]),
  );
  return new Map(pairs.map(([id, region]) => [id ?? '', region ?? '']));
}

/** Zooms into a region from whatever the current view is (touch and mouse alike). */
async function zoomInto(page: Page, hasTouch: boolean, region: string): Promise<void> {
  await zoomIntoRegion(page, hasTouch, region);
}

/**
 * Taps every breaker once, in reference order. Mouse projects click each hit at the full view;
 * touch projects zoom into the region first and zoom out between regions.
 */
async function tapEach(page: Page, hasTouch: boolean): Promise<void> {
  if (!hasTouch) {
    for (const id of ALL_IDS) await page.locator(`[data-hit="${id}"]`).click();
    return;
  }
  const regionOf = await regionOfEach(page);
  for (const region of BREAKER_REGIONS) {
    const ids = ALL_IDS.filter((id) => regionOf.get(id) === region);
    expect(ids.length, region).toBeGreaterThan(0);
    await zoomInto(page, hasTouch, region);
    for (const id of ids) await page.locator(`[data-hit="${id}"]`).tap();
  }
  if ((await page.getByTestId('zoom-out').count()) > 0) {
    await page.getByTestId('zoom-out').tap();
    await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  }
}

test('all 51 breakers exist, start pushed in and show no ring', async ({ page }) => {
  const cbs = page.locator('[data-kind="circuit-breaker"]');
  await expect(cbs).toHaveCount(ALL_IDS.length);
  expect(ALL_IDS).toHaveLength(51);
  const ids = await cbs.evaluateAll((els) => els.map((el) => el.getAttribute('data-control-id')));
  expect([...ids].sort()).toEqual([...ALL_IDS].sort());
  for (const id of ALL_IDS) {
    await expect(breakerOf(page, id), id).toHaveAttribute('data-state', 'in');
  }
  await expect(page.locator('[data-breaker-ring]')).toHaveCount(0);
  await expect(page.locator('[data-hit^="cb."]')).toHaveCount(ALL_IDS.length);
});

test('every breaker can be pulled and pushed in again, with 51 rings when all are out', async ({
  page,
  hasTouch,
}) => {
  const before = await panelText(page);
  await tapEach(page, hasTouch);
  for (const id of ALL_IDS) {
    await expect(breakerOf(page, id), id).toHaveAttribute('data-state', 'out');
  }
  await expect(page.locator('[data-breaker-ring]')).toHaveCount(ALL_IDS.length);
  expect(await panelText(page), 'text list unchanged with all breakers out').toEqual(before);
  await expect(page.locator('[data-state-text]')).toHaveCount(0);

  await tapEach(page, hasTouch);
  for (const id of ALL_IDS) {
    await expect(breakerOf(page, id), id).toHaveAttribute('data-state', 'in');
  }
  await expect(page.locator('[data-breaker-ring]')).toHaveCount(0);
  expect(await panelText(page), 'text list unchanged after pushing all in').toEqual(before);
});

test('@hooks 102 events: 51 out then 51 in, in order, all from the user', async ({
  page,
  hasTouch,
}) => {
  const events = () => page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
  expect(await events()).toHaveLength(0);
  await tapEach(page, hasTouch);
  await tapEach(page, hasTouch);
  const logged = await events();
  expect(logged).toHaveLength(2 * ALL_IDS.length);
  expect(logged.map((e) => [e.id, e.value])).toEqual([
    ...ALL_IDS.map((id) => [id, 'out']),
    ...ALL_IDS.map((id) => [id, 'in']),
  ]);
  for (const e of logged) expect(e.source).toBe('user');
  expect(logged.map((e) => e.seq)).toEqual(logged.map((_e, i) => i));
});

test('the Full panel button covers no breaker hit in any breaker region', async ({
  page,
  hasTouch,
}) => {
  for (const region of BREAKER_REGIONS) {
    await zoomInto(page, hasTouch, region);
    const covered = await buttonCoverage(page);
    expect(covered, region).toEqual([]);
  }
});

test('the built panel stays within its element budget', async ({ page }, testInfo) => {
  const count = await page.getByTestId('panel').evaluate((svg) => svg.querySelectorAll('*').length);
  testInfo.annotations.push({ type: 'element-count', description: String(count) });
  // The measured number lands in the log and the SUMMARY (UI-SPEC U-27).
  console.log(`panel svg elements below the root: ${count} (budget ${ELEMENT_BUDGET})`);
  expect(count, `panel svg elements (budget ${ELEMENT_BUDGET})`).toBeLessThanOrEqual(
    ELEMENT_BUDGET,
  );
});
