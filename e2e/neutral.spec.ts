import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// PNL-06, T-01-19: a tap or click on a neutral panel area appends no control event and
// changes no control state. The specs read the e2e-only window hook, so all are @hooks.

// Mirror of the read-only window hook of the e2e build (src/ui/bridge.ts). Declared here
// because the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
}
type HookHost = { __panel?: PanelHook };

interface Point {
  x: number;
  y: number;
}

const INFLATE_PX = 4;
const MAX_PER_REGION = 3;
const MIN_POINTS = 10;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  // The rotate hint of a portrait phone covers the panel until it is dismissed.
  const dismiss = page.getByTestId('rotate-hint-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByTestId('rotate-hint')).toBeHidden();
});

/**
 * Neutral points in page coordinates: up to three per region frame that lie outside every
 * tap target (inflated by 4 px), two background points outside every region, and the centre
 * of the footer notice.
 */
async function neutralPoints(page: Page): Promise<Point[]> {
  return page.evaluate(
    ({ inflate, perRegion }) => {
      const targets = Array.from(document.querySelectorAll('[data-hit], [data-detent]')).map(
        (el) => {
          const r = el.getBoundingClientRect();
          return {
            left: r.left - inflate,
            right: r.right + inflate,
            top: r.top - inflate,
            bottom: r.bottom + inflate,
          };
        },
      );
      const clear = (x: number, y: number) =>
        targets.every((t) => x < t.left || x > t.right || y < t.top || y > t.bottom);
      const screenW = document.documentElement.clientWidth;
      const screenH = document.documentElement.clientHeight;
      const visible = (x: number, y: number) =>
        x >= 2 && y >= 2 && x <= screenW - 2 && y <= screenH - 2;

      const points: { x: number; y: number }[] = [];
      for (const region of Array.from(document.querySelectorAll('[data-region-id]'))) {
        const frame = region.querySelector('[data-region-frame]');
        if (frame === null) continue;
        const box = frame.getBoundingClientRect();
        const found: { x: number; y: number }[] = [];
        for (let j = 0; j < 8; j++) {
          for (let i = 0; i < 12; i++) {
            const x = box.left + ((i + 0.5) / 12) * box.width;
            const y = box.top + ((j + 0.5) / 8) * box.height;
            if (visible(x, y) && clear(x, y)) found.push({ x, y });
          }
        }
        // Spread the picks over the free points of the region.
        const picks = Math.min(perRegion, found.length);
        for (let k = 0; k < picks; k++) {
          const at = picks === 1 ? 0 : Math.round((k * (found.length - 1)) / (picks - 1));
          const p = found[at];
          if (p !== undefined) points.push(p);
        }
      }

      const svg = document.querySelector<SVGSVGElement>('[data-testid="panel"]');
      const m = svg?.getScreenCTM();
      if (m !== null && m !== undefined) {
        // The centre stack between PFD and MFD, and the panel background right of the MFD.
        for (const [vx, vy] of [
          [1060, 200],
          [1880, 200],
        ] as const) {
          const p = new DOMPoint(vx, vy).matrixTransform(m);
          if (visible(p.x, p.y)) points.push({ x: p.x, y: p.y });
        }
      }

      const notice = document.querySelector('[data-testid="training-aid-notice"]');
      if (notice !== null) {
        const r = notice.getBoundingClientRect();
        points.push({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }
      return points;
    },
    { inflate: INFLATE_PX, perRegion: MAX_PER_REGION },
  );
}

async function controlStates(page: Page): Promise<Record<string, string>> {
  return page
    .locator('[data-control-id]')
    .evaluateAll((els) =>
      Object.fromEntries(
        els.map((el) => [
          el.getAttribute('data-control-id') ?? '',
          el.getAttribute('data-state') ?? '',
        ]),
      ),
    );
}

function eventCount(page: Page): Promise<number> {
  return page.evaluate(() => (globalThis as HookHost).__panel?.events().length ?? -1);
}

test('@hooks taps on neutral areas append no event and change no state', async ({
  page,
  hasTouch,
}) => {
  const points = await neutralPoints(page);
  expect(points.length).toBeGreaterThanOrEqual(MIN_POINTS);

  const statesBefore = await controlStates(page);
  expect(Object.keys(statesBefore).length).toBeGreaterThan(20);
  expect(await eventCount(page)).toBe(0);

  const zoomOut = page.getByTestId('zoom-out');
  for (const p of points) {
    if (hasTouch) await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
    // A background tap inside a region zooms the view (plan 09, D-21): back to the full
    // view so the next point is still where it was measured.
    if (await zoomOut.isVisible()) {
      if (hasTouch) await zoomOut.tap();
      else await zoomOut.click();
      await expect(zoomOut).toBeHidden();
    }
  }

  expect(await eventCount(page)).toBe(0);
  expect(await controlStates(page)).toEqual(statesBefore);
});
