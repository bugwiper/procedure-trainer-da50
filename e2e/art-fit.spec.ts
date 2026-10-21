import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { BUS_OUTLINES, BUS_TITLES } from '../src/aircraft/da50rg/bus-boxes';
import type { BusId } from '../src/aircraft/da50rg/bus-boxes';

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

/** Tests of the text-rendering gate run on every landscape project (R3-1.1, no viewport change). */
const EVERY_PROJECT = /^R3-1\.1/;

test.beforeEach(async ({ page }, testInfo) => {
  if (EVERY_PROJECT.test(testInfo.title)) {
    test.skip(testInfo.project.name === 'phone-portrait', 'landscape projects only');
  } else {
    test.skip(
      testInfo.project.name !== 'desktop-chromium',
      'geometry gate runs on desktop-chromium',
    );
    await page.setViewportSize({ width: 2200, height: 1400 });
  }
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

/** The glyph band of every breaker label and plug label, the lines of the bus art and the sockets. */
interface ClearanceGeometry {
  readonly labels: readonly TextBox[];
  /** Points sampled every 0.5 units along every outline path and pump box, in svg units. */
  readonly linePoints: readonly { kind: string; x: number; y: number }[];
  readonly sockets: readonly Box[];
}

async function readClearanceGeometry(page: Page): Promise<ClearanceGeometry> {
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
    const labels: TextBox[] = [];
    for (const el of Array.from(
      svg.querySelectorAll('[data-breaker-label], [data-shell="bus-plug-label"]'),
    )) {
      const full = toBox(el);
      const owner = el.closest('[data-control-id]')?.getAttribute('data-control-id') ?? 'plug';
      labels.push({
        owner,
        text: (el.textContent ?? '').trim(),
        box: { x: full.x, y: full.y + full.h * 0.2, w: full.w, h: full.h * 0.6 },
      });
    }
    const linePoints: { kind: string; x: number; y: number }[] = [];
    const lines = svg.querySelectorAll('[data-shell="bus-outline"], [data-shell="bus-pump-box"]');
    for (const el of Array.from(lines)) {
      const geom = el as unknown as SVGGeometryElement;
      const own = geom.getScreenCTM();
      if (own === null) continue;
      const kind = el.getAttribute('data-shell') ?? '';
      const total = geom.getTotalLength();
      for (let s = 0; s <= total; s += 0.5) {
        const p = geom.getPointAtLength(s);
        const q = new DOMPoint(p.x, p.y).matrixTransform(own).matrixTransform(inv);
        linePoints.push({ kind, x: q.x, y: q.y });
      }
    }
    const sockets = Array.from(svg.querySelectorAll('[data-breaker-socket]')).map(toBox);
    return { labels, linePoints, sockets };
  });
}

test('no breaker or plug label touches an outline, a pump box or the socket of a breaker', async ({
  page,
}) => {
  const geo = await readClearanceGeometry(page);
  expect(geo.labels.length).toBeGreaterThanOrEqual(19);
  expect(geo.linePoints.length).toBeGreaterThan(500);
  const failures: string[] = [];
  for (const label of geo.labels) {
    const b = label.box;
    const hit = geo.linePoints.find(
      (p) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h,
    );
    if (hit !== undefined) {
      failures.push(
        `${label.owner} "${label.text}" touches a ${hit.kind} at ${hit.x.toFixed(1)}, ${hit.y.toFixed(1)}`,
      );
    }
    for (const s of geo.sockets) {
      if (overlapArea(b, s) > 0) {
        failures.push(
          `${label.owner} "${label.text}" touches the socket at ${s.x.toFixed(1)}, ${s.y.toFixed(1)}`,
        );
      }
    }
  }
  expect(failures).toEqual([]);
});

/** The labels of the shell: placards, plate headings with their frames, bracket titles and lines. */
interface ShellLabel {
  /** What the element is: placard, heading, heading-frame, bracket-title or bracket-line. */
  readonly kind: string;
  /** Data id of the placard, heading or bracket group. */
  readonly id: string;
  readonly text: string;
  readonly box: Box;
}

async function readShellLabels(page: Page): Promise<ShellLabel[]> {
  return page.getByTestId('panel').evaluate((node) => {
    const svg = node as unknown as SVGSVGElement;
    const ctm = svg.getScreenCTM();
    if (ctm === null) throw new Error('no screen CTM');
    const inv = ctm.inverse();
    const toBox = (el: Element, band: boolean): Box => {
      const r = el.getBoundingClientRect();
      const p1 = new DOMPoint(r.left, r.top).matrixTransform(inv);
      const p2 = new DOMPoint(r.right, r.bottom).matrixTransform(inv);
      const h = p2.y - p1.y;
      // Texts use the glyph band (middle 60 percent), outlines their whole box.
      return band
        ? { x: p1.x, y: p1.y + h * 0.2, w: p2.x - p1.x, h: h * 0.6 }
        : { x: p1.x, y: p1.y, w: p2.x - p1.x, h };
    };
    const out: ShellLabel[] = [];
    const text = (el: Element) => (el.textContent ?? '').trim();
    for (const el of Array.from(svg.querySelectorAll('[data-placard]'))) {
      out.push({
        kind: 'placard',
        id: el.getAttribute('data-placard') ?? '',
        text: text(el),
        box: toBox(el, true),
      });
    }
    for (const group of Array.from(svg.querySelectorAll('[data-shell="plate-heading"]'))) {
      const id = group.getAttribute('data-heading') ?? '';
      const label = group.querySelector('text');
      const frame = group.querySelector('rect');
      if (label !== null) {
        out.push({ kind: 'heading', id, text: text(label), box: toBox(label, true) });
      }
      if (frame !== null) {
        out.push({
          kind: 'heading-frame',
          id,
          text: text(label ?? frame),
          box: toBox(frame, false),
        });
      }
    }
    for (const group of Array.from(svg.querySelectorAll('[data-shell="bracket-group"]'))) {
      const id = group.getAttribute('data-bracket') ?? '';
      const title = group.querySelector('[data-shell="bracket-title"]');
      const line = group.querySelector('[data-shell="bracket-line"]');
      if (title !== null) {
        out.push({ kind: 'bracket-title', id, text: text(title), box: toBox(title, true) });
      }
      if (line !== null) {
        out.push({ kind: 'bracket-line', id, text: text(title ?? line), box: toBox(line, false) });
      }
    }
    return out;
  });
}

/**
 * Shell labels known to stand off every plate, as "kind:id" with the reason. Entries come from
 * earlier plans; the engine strip (FADEC, ALTERNATOR, the numerals, AUTO, FORCE B, TEST, ON, OFF)
 * must never appear here. A stale entry fails the gate like in the text-overlap list.
 */
const SHELL_LABEL_OFF_PLATE_KNOWN: Readonly<Record<string, string>> = {};

test('every shell placard, heading and bracket title lies on a plate', async ({ page }) => {
  const geo = await readGeometry(page);
  const labels = await readShellLabels(page);
  expect(labels.filter((l) => l.kind === 'placard').length).toBeGreaterThanOrEqual(30);
  expect(labels.filter((l) => l.kind === 'heading').length).toBeGreaterThanOrEqual(3);
  expect(labels.filter((l) => l.kind === 'bracket-title').length).toBeGreaterThanOrEqual(2);
  const off = new Map<string, string>();
  for (const label of labels) {
    const key = `${label.kind}:${label.id}`;
    const onSome = geo.plates.some((plate) => outside(label.box, plate.box) === null);
    if (onSome) continue;
    off.set(key, `"${label.text}" lies on no plate`);
  }
  const unexpected = [...off.keys()].filter((key) => !(key in SHELL_LABEL_OFF_PLATE_KNOWN)).sort();
  expect(unexpected, unexpected.map((key) => `${key}: ${off.get(key) ?? ''}`).join('\n')).toEqual(
    [],
  );
  const stale = Object.keys(SHELL_LABEL_OFF_PLATE_KNOWN).filter((key) => !off.has(key));
  expect(stale).toEqual([]);
});

/**
 * R3-1.1 (owner finding, iPhone Safari): the bus titles ran into each other because a stroked
 * text is painted glyph by glyph on WebKit. No text of the shell may carry a stroke, and the real
 * text box of each bus title must lie inside the plate-coloured rectangle that cuts its edge.
 * Runs on every landscape project, desktop and touch, Chromium and WebKit.
 */
test('R3-1.1 no shell text is stroked and each bus title lies inside its cut', async ({ page }) => {
  const result = await page.getByTestId('panel').evaluate((node) => {
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
    const stroked: string[] = [];
    let shellTexts = 0;
    for (const el of Array.from(svg.querySelectorAll('text'))) {
      if (el.closest('[data-shell]') === null) continue;
      shellTexts += 1;
      const stroke = getComputedStyle(el).stroke;
      if (stroke !== 'none' || el.hasAttribute('paint-order') || el.hasAttribute('stroke')) {
        stroked.push(`${(el.textContent ?? '').trim()}: stroke ${stroke}`);
      }
    }
    const titles = Array.from(svg.querySelectorAll('[data-shell="bus-title"]')).map((title) => {
      const bus = title.getAttribute('data-bus') ?? '';
      const cut = title.previousElementSibling;
      return {
        bus,
        text: (title.textContent ?? '').trim(),
        isCut: cut !== null && cut.getAttribute('data-shell') === 'bus-title-cut',
        text_box: toBox(title),
        cut_box: cut === null ? null : toBox(cut),
      };
    });
    return { stroked, shellTexts, titles };
  });
  expect(result.shellTexts).toBeGreaterThan(60);
  expect(result.stroked).toEqual([]);
  expect(result.titles.map((t) => t.text)).toEqual(['ESSENTIAL BUS', 'MAIN BUS', 'AVIONICS BUS']);
  const failures: string[] = [];
  for (const t of result.titles) {
    if (!t.isCut || t.cut_box === null) {
      failures.push(`${t.text}: not preceded by a cut rectangle`);
      continue;
    }
    const left = t.text_box.x - t.cut_box.x;
    const right = t.cut_box.x + t.cut_box.w - (t.text_box.x + t.text_box.w);
    if (left < 2 || right < 2) {
      failures.push(
        `${t.text}: text box leaves its cut (left gap ${left.toFixed(1)}, right gap ${right.toFixed(1)})`,
      );
    }
    // The horizontal edge of its own outline that the title sits on (data, not the DOM).
    const anchor = BUS_TITLES.find((b) => b.bus === t.bus);
    const pts = BUS_OUTLINES[t.bus as BusId];
    const edgeY = pts
      .filter((a, i) => {
        const b = pts[(i + 1) % pts.length];
        return (
          anchor !== undefined &&
          b !== undefined &&
          a.y === b.y &&
          anchor.y >= a.y &&
          anchor.y - a.y <= 4 &&
          anchor.x >= Math.min(a.x, b.x) &&
          anchor.x <= Math.max(a.x, b.x)
        );
      })
      .map((a) => a.y)[0];
    if (edgeY === undefined) {
      failures.push(`${t.text}: no outline edge under the title`);
      continue;
    }
    if (edgeY < t.cut_box.y + 2 || edgeY > t.cut_box.y + t.cut_box.h - 2) {
      failures.push(`${t.text}: the edge y ${edgeY} lies outside its cut`);
    }
  }
  expect(failures).toEqual([]);
});
