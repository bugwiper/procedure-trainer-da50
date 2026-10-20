import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Built-panel gate for owner finding G-0.5: no part of the visible art sticks out of its region
// or off the plate it sits on. Hit rectangles, detent markers and the invisible region frame are
// not art and are skipped. Measured on the real DOM at a viewport where one unit is about one
// pixel; the geometry is converted back to svg units so the result does not depend on scale.

/**
 * Regions the gate does not fail yet because a later plan rebuilds them; each plan removes its
 * entry. landing_gear (17), right_panel (18), pedestal (19), env_control (20), deice (21),
 * deice_switches (22).
 */
const KNOWN_OPEN: readonly string[] = [
  // Rebuilt by plans 17 to 22.
  'landing_gear',
  'right_panel',
  'pedestal',
  'env_control',
  'deice',
  'deice_switches',
  // Fixed by task 3 of plan 16, then removed from this list.
  'light_knobs',
  'switch_bank',
  'under_panel_centre',
  'under_panel_right',
];

/** ART_FIT_STRICT=1 also checks the known-open regions, to see what a rebuild still has to fix. */
const STRICT = process.env['ART_FIT_STRICT'] === '1';

const TOLERANCE = 0.75;

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Painted {
  readonly region: string;
  readonly tag: string;
  readonly text: string;
  readonly box: Box;
}

interface PanelGeometry {
  readonly frames: Readonly<Record<string, Box>>;
  readonly plates: readonly { id: string; regions: string[]; box: Box }[];
  readonly painted: readonly Painted[];
  readonly wordmark: Box | null;
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'geometry gate runs on desktop-chromium');
  await page.setViewportSize({ width: 2000, height: 1400 });
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

/** Reads the geometry of every region, plate and painted element in svg units. */
async function readGeometry(page: Page): Promise<PanelGeometry> {
  return page.getByTestId('panel').evaluate((node) => {
    const svg = node as unknown as SVGSVGElement;
    const ctm = svg.getScreenCTM();
    if (ctm === null) throw new Error('no screen CTM');
    const inv = ctm.inverse();
    const toBox = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      const p1 = new DOMPoint(r.left, r.top).matrixTransform(inv);
      const p2 = new DOMPoint(r.right, r.bottom).matrixTransform(inv);
      return { x: p1.x, y: p1.y, w: p2.x - p1.x, h: p2.y - p1.y };
    };
    const frames: Record<string, Box> = {};
    const painted: Painted[] = [];
    const SELECTOR = 'text, path, circle, ellipse, rect, polygon, line, polyline';
    for (const group of Array.from(svg.querySelectorAll('[data-region-id]'))) {
      const region = group.getAttribute('data-region-id') ?? '';
      const frame = group.querySelector('[data-region-frame]');
      if (frame !== null) frames[region] = toBox(frame);
      for (const el of Array.from(group.querySelectorAll(SELECTOR))) {
        if (
          el.hasAttribute('data-hit') ||
          el.hasAttribute('data-detent') ||
          el.hasAttribute('data-region-frame') ||
          el.closest('[data-hit], [data-detent]') !== null
        ) {
          continue;
        }
        const box = toBox(el);
        if (box.w <= 0 && box.h <= 0) continue;
        painted.push({
          region,
          tag: el.tagName.toLowerCase(),
          text: (el.textContent ?? '').trim().slice(0, 40),
          box,
        });
      }
    }
    const plates = Array.from(svg.querySelectorAll('[data-plate]')).map((el) => ({
      id: el.getAttribute('data-plate') ?? '',
      regions: (el.getAttribute('data-plate-regions') ?? '').split(' ').filter((r) => r !== ''),
      box: toBox(el),
    }));
    const mark = svg.querySelector('[data-shell="wordmark"]');
    return { frames, plates, painted, wordmark: mark === null ? null : toBox(mark) };
  });
}

function outside(inner: Box, outer: Box): string | null {
  const dl = outer.x - inner.x;
  const dt = outer.y - inner.y;
  const dr = inner.x + inner.w - (outer.x + outer.w);
  const db = inner.y + inner.h - (outer.y + outer.h);
  const worst = Math.max(dl, dt, dr, db);
  if (worst <= TOLERANCE) return null;
  const side = worst === dl ? 'left' : worst === dt ? 'top' : worst === dr ? 'right' : 'bottom';
  return `${side} by ${worst.toFixed(1)}`;
}

test('the art of every region lies inside its region and its plate', async ({ page }) => {
  const geo = await readGeometry(page);
  const failures: string[] = [];
  const plateOf = new Map<string, { id: string; box: Box }>();
  for (const plate of geo.plates) {
    for (const region of plate.regions) plateOf.set(region, plate);
  }
  expect(geo.painted.length).toBeGreaterThan(100);
  for (const item of geo.painted) {
    if (item.region === 'pfd' || item.region === 'mfd') continue;
    if (!STRICT && KNOWN_OPEN.includes(item.region)) continue;
    const frame = geo.frames[item.region];
    if (frame === undefined) continue;
    const region = outside(item.box, frame);
    if (region !== null) {
      failures.push(`${item.region}: ${item.tag} "${item.text}" leaves its region (${region})`);
    }
    const plate = plateOf.get(item.region);
    if (plate !== undefined) {
      const onPlate = outside(item.box, plate.box);
      if (onPlate !== null) {
        failures.push(
          `${item.region}: ${item.tag} "${item.text}" leaves plate ${plate.id} (${onPlate})`,
        );
      }
    }
  }
  expect(failures).toEqual([]);
});

test('the RUBIN mark and the LEVEL button lie on one plate and no plate seam crosses them', async ({
  page,
}) => {
  const geo = await readGeometry(page);
  const flaps = geo.plates.find((p) => p.id === 'strip-flaps');
  const gear = geo.plates.find((p) => p.id === 'strip-gear');
  if (flaps === undefined || gear === undefined) throw new Error('strip plates missing');
  if (geo.wordmark === null) throw new Error('no wordmark');
  expect(outside(geo.wordmark, flaps.box), 'RUBIN mark on strip-flaps').toBeNull();

  const level = geo.painted.filter((p) => p.region === 'level');
  expect(level.length).toBeGreaterThan(0);
  for (const item of level) {
    expect(outside(item.box, gear.box), `level ${item.tag} "${item.text}"`).toBeNull();
  }
});
