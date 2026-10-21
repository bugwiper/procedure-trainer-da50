import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { PANEL_VIEWBOX } from '../tests/layout-reference';

// Circuit-breaker contract on the built panel (PNL-12, D-02, D-03, owner rule G-0.1): the first
// breaker, cb.pitot, starts pushed in without a ring, one tap pulls it (raised cap, one white ring),
// a second tap pushes it back in, and no state text exists at any time.

const ID = 'cb.pitot';
const REGION = 'cb_essential';
const FULL_VIEWBOX = `0 0 ${PANEL_VIEWBOX.w} ${PANEL_VIEWBOX.h}`;
const PORTRAIT_NOTE =
  'Portrait phones are covered by the rotate hint (D-02); pinch zoom reaches full tap size there';

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here because
// the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
}
type HookHost = { __panel?: PanelHook };

interface Point {
  x: number;
  y: number;
}

function breaker(page: Page): Locator {
  return page.locator(`[data-control-id="${ID}"]`);
}

function hit(page: Page): Locator {
  return page.locator(`[data-hit="${ID}"]`);
}

/**
 * A page point inside the region's frame that is visible on screen, outside the "Full panel"
 * button and as far as possible from every tap target of the whole panel (at least 1.5 px), away
 * from the frame edge. Copy of the helper of e2e/zoom.spec.ts (the specs share no helper module).
 */
async function backgroundPoint(page: Page, regionId: string): Promise<Point> {
  const point = await page.evaluate((id) => {
    const region = document.querySelector(`[data-region-id="${id}"]`);
    if (region === null) return null;
    const frame = region.querySelector('[data-region-frame]');
    if (frame === null) return null;
    const box = frame.getBoundingClientRect();
    const targets = Array.from(document.querySelectorAll('[data-hit], [data-detent]')).map((el) =>
      el.getBoundingClientRect(),
    );
    const button = document.querySelector('[data-testid="zoom-out"]')?.getBoundingClientRect();
    const screenW = document.documentElement.clientWidth;
    const screenH = document.documentElement.clientHeight - 28;
    const clearance = (x: number, y: number): number => {
      let best = Infinity;
      for (const t of targets) {
        const dx = Math.max(t.left - x, 0, x - t.right);
        const dy = Math.max(t.top - y, 0, y - t.bottom);
        best = Math.min(best, Math.hypot(dx, dy));
      }
      return best;
    };
    let found: { x: number; y: number } | null = null;
    let bestClearance = 1.5;
    const steps = 48;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        const x = box.left + (0.1 + (0.8 * (i + 0.5)) / steps) * box.width;
        const y = box.top + (0.1 + (0.8 * (j + 0.5)) / steps) * box.height;
        if (x < 2 || y < 2 || x > screenW - 2 || y > screenH - 2) continue;
        const underButton =
          button !== undefined &&
          x >= button.left - 4 &&
          x <= button.right + 4 &&
          y >= button.top - 4 &&
          y <= button.bottom + 4;
        if (underButton) continue;
        const c = clearance(x, y);
        if (c > bestClearance) {
          bestClearance = c;
          found = { x, y };
        }
      }
    }
    return found;
  }, regionId);
  if (point === null) throw new Error(`no background point in region ${regionId}`);
  return point;
}

/** Mouse projects click the hit; touch projects zoom into the region first, then tap the hit. */
async function reach(page: Page, hasTouch: boolean): Promise<void> {
  if (!hasTouch) return;
  const p = await backgroundPoint(page, REGION);
  await page.touchscreen.tap(p.x, p.y);
  await expect(page.getByTestId('panel')).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
}

async function activate(target: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await target.tap();
  else await target.click();
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
