import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { DOUBLE_TAP_MS } from '../../src/ui/panel/tap-intent';
import { PANEL_VIEWBOX } from '../../tests/layout-reference';

// Shared e2e zoom helpers (R2-Z1, PNL-15). This is test support, not a spec: its name does not
// end in .spec.ts, so Playwright never collects it. The full viewBox comes from the independent
// reference table, never from src.

export const FULL_VIEWBOX = `0 0 ${PANEL_VIEWBOX.w} ${PANEL_VIEWBOX.h}`;

export interface Point {
  x: number;
  y: number;
}

/**
 * A page point inside the region's frame that is visible on screen, outside the "Full panel"
 * button and as far as possible from every tap target of the whole panel (at least 1.5 px), away
 * from the frame edge.
 */
export async function backgroundPoint(page: Page, regionId: string): Promise<Point> {
  const point = await page.evaluate((id) => {
    const region = document.querySelector(`[data-region-id="${id}"]`);
    if (region === null) return null;
    const frame = region.querySelector('[data-region-frame]');
    if (frame === null) return null;
    const box = frame.getBoundingClientRect();
    const targets = Array.from(
      document.querySelectorAll('[data-hit], [data-detent], [data-session-hit]'),
    ).map((el) => el.getBoundingClientRect());
    const button = document.querySelector('[data-testid="zoom-out"]')?.getBoundingClientRect();
    const screenW = document.documentElement.clientWidth;
    // The footer is 28 px at rest and 52 px during a session: measure it, never assume it.
    const footerH = document.querySelector('footer')?.getBoundingClientRect().height ?? 0;
    const screenH = document.documentElement.clientHeight - footerH;
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
    // At least 48 samples per axis and a sample every 0.5 px where the region is small (at most 300 per axis): on a portrait phone the
    // session buttons are 4 px apart, so the gap between them is found only by a fine grid.
    const stepsX = Math.min(300, Math.max(48, Math.ceil((0.8 * box.width) / 0.5)));
    const stepsY = Math.min(300, Math.max(48, Math.ceil((0.8 * box.height) / 0.5)));
    for (let i = 0; i < stepsX; i++) {
      for (let j = 0; j < stepsY; j++) {
        const x = box.left + (0.1 + (0.8 * (i + 0.5)) / stepsX) * box.width;
        const y = box.top + (0.1 + (0.8 * (j + 0.5)) / stepsY) * box.height;
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

/**
 * Lets the double-tap window of an earlier tap pass, so the next tap starts a new pair. Every spec
 * that taps one latching control twice (R3-Z3: two quick taps on one control are a zoom) or that
 * taps the background twice waits with this one helper, never a literal.
 */
export async function afterPairWindow(page: Page): Promise<void> {
  await page.waitForTimeout(DOUBLE_TAP_MS + 100);
}

/** One click (mouse projects) or one tap (touch projects) at a page point. */
export async function activateAt(page: Page, p: Point, hasTouch: boolean): Promise<void> {
  if (hasTouch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

/** A double click (mouse projects) or two taps in a row (touch projects) at a page point. */
export async function doubleActivateAt(page: Page, p: Point, hasTouch: boolean): Promise<void> {
  if (hasTouch) {
    await page.touchscreen.tap(p.x, p.y);
    await page.touchscreen.tap(p.x, p.y);
  } else {
    await page.mouse.dblclick(p.x, p.y);
  }
}

/** Clicks or taps a locator (mouse projects click, touch projects tap). */
export async function activate(target: Locator, hasTouch: boolean): Promise<void> {
  // A modal swallows pointer and click events for its first 400 ms (data-shield, U-12): a target
  // inside one is pressed only after the shield ends.
  await expect(target.locator('xpath=ancestor-or-self::*[@data-shield]')).toHaveCount(0);
  if (hasTouch) await target.tap();
  else await target.click();
}

/** Taps the Full panel button when it exists and waits for the full viewBox. */
export async function leaveZoom(page: Page, hasTouch: boolean): Promise<void> {
  if ((await page.getByTestId('zoom-out').count()) > 0) {
    await activate(page.getByTestId('zoom-out'), hasTouch);
    await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  }
}

/**
 * Zooms into a region from whatever the current view is: leaves any zoom, taps once at a
 * background point of the region, lets the view attribute settle for 120 ms, asserts that the
 * view is still the full one (a single click or tap never zooms, R2-Z1) and taps the same point
 * once more (double click or double tap), which must leave the full view.
 */
export async function zoomIntoRegion(
  page: Page,
  hasTouch: boolean,
  regionId: string,
): Promise<void> {
  await leaveZoom(page, hasTouch);
  const p = await backgroundPoint(page, regionId);
  await activateAt(page, p, hasTouch);
  await page.waitForTimeout(120);
  expect(
    await page.getByTestId('panel').getAttribute('viewBox'),
    `${regionId}: a single tap must not change the view`,
  ).toBe(FULL_VIEWBOX);
  await activateAt(page, p, hasTouch);
  await expect(page.getByTestId('panel'), regionId).not.toHaveAttribute('viewBox', FULL_VIEWBOX);
}

/**
 * The ids of every [data-hit] and [data-detent] element on the whole page whose box overlaps the
 * box of the Full panel button (touching is not overlap), or ['no button'] when the button is
 * absent (R2-T1, D-13).
 */
export async function buttonCoverage(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const button = document.querySelector('[data-testid="zoom-out"]');
    if (button === null) return ['no button'];
    const b = button.getBoundingClientRect();
    return Array.from(document.querySelectorAll('[data-hit], [data-detent]'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
      })
      .map((el) => el.getAttribute('data-hit') ?? el.getAttribute('data-detent') ?? '');
  });
}

/**
 * The ids of every [data-session-hit] element whose box overlaps the box of the Full panel button
 * (touching is not overlap), or ['no button'] when the button is absent (U-07). Sibling of
 * buttonCoverage for the session buttons, which are no registry controls.
 */
export async function sessionButtonCoverage(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const button = document.querySelector('[data-testid="zoom-out"]');
    if (button === null) return ['no button'];
    const b = button.getBoundingClientRect();
    return Array.from(document.querySelectorAll('[data-session-hit]'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
      })
      .map((el) => el.getAttribute('data-session-hit') ?? '');
  });
}
