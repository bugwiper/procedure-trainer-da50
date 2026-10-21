import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Built-panel gate for owner finding G-0.5: no part of the visible art sticks out of its region
// or off the plate it sits on. Hit rectangles, detent markers and the invisible region frame are
// not art and are skipped. Measured on the real DOM at a viewport where one unit is about one
// pixel; the geometry is converted back to svg units so the result does not depend on scale.

/**
 * Regions the gate does not fail yet because a later plan rebuilds them; each plan removes its
 * entry. The list is empty: plan 21 rebuilt the upper de-ice block and plan 22 the lower row.
 */
const KNOWN_OPEN: readonly string[] = [];

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

interface TextBox {
  /** Region id, or `shell` for text that belongs to no region. */
  readonly owner: string;
  readonly text: string;
  readonly box: Box;
}

interface PanelGeometry {
  readonly frames: Readonly<Record<string, Box>>;
  readonly plates: readonly { id: string; regions: string[]; box: Box }[];
  readonly painted: readonly Painted[];
  readonly wordmark: Box | null;
  readonly texts: readonly TextBox[];
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
    // Every text of the panel svg except the glass displays (instrument data, not placards).
    const texts: TextBox[] = [];
    for (const el of Array.from(svg.querySelectorAll('text'))) {
      const group = el.closest('[data-region-id]');
      const owner = group?.getAttribute('data-region-id') ?? 'shell';
      if (owner === 'pfd' || owner === 'mfd') continue;
      const text = (el.textContent ?? '').trim();
      if (text === '') continue;
      // The glyph band: the middle 60 percent of the text box, about the cap height. The full
      // box includes the font's ascent and descent, which makes stacked lines touch.
      const full = toBox(el);
      texts.push({
        owner,
        text,
        box: { x: full.x, y: full.y + full.h * 0.2, w: full.w, h: full.h * 0.6 },
      });
    }
    const mark = svg.querySelector('[data-shell="wordmark"]');
    return { frames, plates, painted, texts, wordmark: mark === null ? null : toBox(mark) };
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

/**
 * Text pairs known to overlap because they belong to areas plans 17 to 22 rebuild. Entries are
 * "owner:text" of both strings, sorted and joined with a bar (owner is a region id or `shell`).
 * Each plan removes the pairs of the area it rebuilds; the list ends empty.
 */
const TEXT_OVERLAP_KNOWN: readonly string[] = [];

/** Overlap area in square units of two glyph bands. */
function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

test('no two text strings of the panel overlap', async ({ page }) => {
  const geo = await readGeometry(page);
  expect(geo.texts.length).toBeGreaterThan(60);
  const found = new Set<string>();
  for (let i = 0; i < geo.texts.length; i++) {
    for (let j = i + 1; j < geo.texts.length; j++) {
      const a = geo.texts[i];
      const b = geo.texts[j];
      if (a === undefined || b === undefined) continue;
      if (overlapArea(a.box, b.box) <= 0.5) continue;
      found.add([`${a.owner}:${a.text}`, `${b.owner}:${b.text}`].sort().join('|'));
    }
  }
  const unexpected = [...found].filter((pair) => !TEXT_OVERLAP_KNOWN.includes(pair)).sort();
  expect(unexpected).toEqual([]);
  // A stale entry would hide a regression of a fixed area: the list may only name live overlaps.
  const stale = TEXT_OVERLAP_KNOWN.filter((pair) => !found.has(pair));
  expect(stale).toEqual([]);
});
