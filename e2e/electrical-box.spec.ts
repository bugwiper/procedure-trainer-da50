import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { GLASS } from '../src/aircraft/da50rg/avionics';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { forceVariant, startScenario } from './support/session';
import { activate } from './support/zoom';

// Phase 4 (plan 03): the Electrical box of the MFD engine page on the built app. The readings are
// read from the drawn text (no window hook), so the spec also runs against the live site. The
// expected numbers come from the quantity data in node, never typed in.

const ALTN1_FILE = 'electrical/elec-altn1-fail';
const ALTN1_ROW = 'electrical.elec-altn1-fail';
const ALTN2_FILE = 'electrical/elec-altn2-fail';
const ALTN2_ROW = 'electrical.elec-altn2-fail';
const CAUSE = 'alternator_dead';
const PORTRAIT_NOTE =
  'Portrait phones are covered by the rotate hint (D-02); pinch zoom reaches full tap size there';

const base = (id: string): number => {
  const def = DA50RG_QUANTITIES.get(id);
  if (def === undefined) throw new Error(`no quantity ${id}`);
  return def.base;
};
/** The load one alternator carries alone (alt1 base) and the additional loads (alt2 base). */
const MAIN_LOAD = base('alt1_amps');
const ADDITIONAL_LOAD = base('alt2_amps');
const VOLTS_BASE = base('bus_volts');
const VOLTS_TOLERANCE = 0.2;
const SETTLE_MS = 15_000;

const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);
const box = (page: Page): Locator => page.locator('[data-region-id="mfd"] [data-electrical-box]');
const ampsReadout = (page: Page, which: '1' | '2'): Locator =>
  box(page).locator(`[data-gauge="Amps"] [data-amps-readout="${which}"]`);
const voltsReadout = (page: Page): Locator =>
  box(page).locator('[data-gauge="Volts"] text.glass-digits');

const numberOf = async (readout: Locator): Promise<number> =>
  Number.parseFloat((await readout.textContent()) ?? 'NaN');
const amps = (page: Page, which: '1' | '2') => numberOf(ampsReadout(page, which));
const volts = (page: Page) => numberOf(voltsReadout(page));

async function openEnginePage(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);
  await expect(page.getByTestId('mfd-engine-page')).toBeVisible();
}

/** The static marks of the box: every text that is not a readout number, sorted. */
const marksOf = (page: Page): Promise<string[]> =>
  box(page).evaluate((g) =>
    Array.from(g.querySelectorAll('text'))
      .filter((t) => !t.classList.contains('glass-digits'))
      .map((t) => (t.textContent ?? '').trim())
      .sort(),
  );

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('ALTN 1 FAIL, alternator dead: Amps 0 and the additional loads, then 0 and the main load with ESS BUS on; the marks stay', async ({
  page,
  hasTouch,
}) => {
  await forceVariant(page, ALTN1_FILE, CAUSE);
  await startScenario(page, hasTouch, ALTN1_ROW, 'easy');
  await openEnginePage(page, hasTouch);

  const marks = await marksOf(page);
  expect(marks).toEqual(['1', '2', 'AMPS', 'ELECTRICAL', 'VOLTS']);

  // Alternator 1 delivers nothing; alternator 2 still feeds the additional loads while ESS BUS is
  // off. The Volts bar reads below its regulated base.
  await expect.poll(() => amps(page, '1'), { timeout: SETTLE_MS }).toBe(0);
  await expect.poll(() => amps(page, '2'), { timeout: SETTLE_MS }).toBeCloseTo(ADDITIONAL_LOAD, 0);
  await expect.poll(() => volts(page), { timeout: SETTLE_MS }).toBeLessThan(VOLTS_BASE);

  // The checklist: ALTERNATOR 1 off, ESS BUS on. Alternator 2 now carries the main load.
  await activate(page.locator('[data-hit="sw.alternator_1"]'), hasTouch);
  await expect(control(page, 'sw.alternator_1')).toHaveAttribute('data-state', 'off');
  await activate(page.locator('[data-hit="sw.ess_bus"]'), hasTouch);
  await expect(control(page, 'sw.ess_bus')).toHaveAttribute('data-state', 'on');

  await expect.poll(() => amps(page, '2'), { timeout: SETTLE_MS }).toBeCloseTo(MAIN_LOAD, 0);
  expect(await amps(page, '1')).toBe(0);
  await expect
    .poll(async () => Math.abs((await volts(page)) - VOLTS_BASE), { timeout: SETTLE_MS })
    .toBeLessThanOrEqual(VOLTS_TOLERANCE);

  // Only the numbers moved: the static marks are the same.
  expect(await marksOf(page)).toEqual(marks);
});

test('ALTN 2 FAIL, alternator dead: pointer 1 carries the load, pointer 2 reads 0 and Volts stays normal', async ({
  page,
  hasTouch,
}) => {
  await forceVariant(page, ALTN2_FILE, CAUSE);
  await startScenario(page, hasTouch, ALTN2_ROW, 'easy');
  await openEnginePage(page, hasTouch);

  await expect.poll(() => amps(page, '2'), { timeout: SETTLE_MS }).toBe(0);
  await expect.poll(() => amps(page, '1'), { timeout: SETTLE_MS }).toBeCloseTo(MAIN_LOAD, 0);
  expect(Math.abs((await volts(page)) - VOLTS_BASE)).toBeLessThanOrEqual(VOLTS_TOLERANCE);
});

test('the box lies inside the glass content area and the fuel bars lie below it without overlap', async ({
  page,
  hasTouch,
}) => {
  await openEnginePage(page, hasTouch);
  const geometry = await page.locator('[data-region-id="mfd"]').evaluate((region) => {
    const rectOf = (el: Element) => {
      const b = (el as SVGGraphicsElement).getBBox();
      return { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height };
    };
    const gauge = (label: string) => {
      const el = region.querySelector(`[data-gauge="${label}"]`);
      if (el === null) throw new Error(`no gauge ${label}`);
      return rectOf(el);
    };
    const boxEl = region.querySelector('[data-electrical-box]');
    if (boxEl === null) throw new Error('no box');
    const frame = region.querySelector('[data-glass-zone="screen"]');
    if (frame === null) throw new Error('no screen');
    return {
      box: rectOf(boxEl),
      screen: rectOf(frame),
      fuel: [gauge('Fuel qty LH'), gauge('Fuel qty RH')],
      left: ['Oil temp', 'Coolant temp', 'Gearbox temp', 'Fuel temp', 'Fuel pres'].map(gauge),
      arcs: ['RPM', 'Load', 'Oil pres'].map(gauge),
    };
  });
  const { box: b, screen, fuel, left, arcs } = geometry;
  expect(b.top).toBeGreaterThanOrEqual(GLASS.content.y0);
  expect(b.bottom).toBeLessThanOrEqual(GLASS.content.y1);
  expect(b.left).toBeGreaterThanOrEqual(screen.left);
  expect(b.right).toBeLessThanOrEqual(screen.right);
  let top = b.bottom;
  for (const f of fuel) {
    expect(f.top).toBeGreaterThanOrEqual(top);
    expect(f.bottom).toBeLessThanOrEqual(GLASS.content.y1);
    top = f.bottom;
  }
  for (const other of [...left, ...arcs]) {
    const apart =
      other.right <= b.left ||
      b.right <= other.left ||
      other.bottom <= b.top ||
      b.bottom <= other.top;
    expect(apart, 'another gauge overlaps the box').toBe(true);
  }
});
