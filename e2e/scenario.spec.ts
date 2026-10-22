import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { activate } from './support/zoom';

// SES-01, SES-03, SES-04, SCN-05 (phase 02): the pilot's path on the built panel. NEW SITUATION in
// the co-pilot legroom starts ENG OIL TEMP in its initial state, the user operates the panel,
// "Procedure complete" in the footer grades the recorded log and the debrief shows PASS or FAIL.
// Every case reads an e2e-only window hook, so all titles carry @hooks.

// Mirrors of the read-only window hooks of the e2e build (src/ui/bridge.ts, src/ui/session.ts).
// Declared here because the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
}
interface SessionHook {
  screen(): string;
  scenarioId(): string | null;
  result(): { result: string } | null;
}
type HookHost = { __panel?: PanelHook; __panelSession?: SessionHook };

const MIN_BUTTON_PX = 44;
const MIN_FOOTER_PX = 52;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);

function events(page: Page): Promise<{ id: string; value: string }[]> {
  return page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
}

function screenOf(page: Page): Promise<string> {
  return page.evaluate(() => (globalThis as HookHost).__panelSession?.screen() ?? 'no hook');
}

function resultOf(page: Page): Promise<{ result: string } | null> {
  return page.evaluate(() => (globalThis as HookHost).__panelSession?.result() ?? null);
}

/** Taps NEW SITUATION and waits until the run is on. */
async function startRun(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-session-hit="session.new"]'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  expect(await screenOf(page)).toBe('running');
}

/** The golden taps: POWER down to the 50 % marker, COWL FLAP to the open marker. */
async function goldenTaps(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p50');
  await activate(page.locator('[data-detent="lv.cowl_flap:open"]'), hasTouch);
  await expect(control(page, 'lv.cowl_flap')).toHaveAttribute('data-state', 'open');
}

test('@hooks NEW SITUATION starts ENG OIL TEMP in its initial state', async ({
  page,
  hasTouch,
}) => {
  // At load: free, no run button, the 28 px footer.
  expect(await screenOf(page)).toBe('free');
  await expect(page.getByTestId('procedure-complete')).toHaveCount(0);
  const idle = await page.locator('footer').boundingBox();
  expect(idle?.height ?? 0).toBeLessThan(MIN_FOOTER_PX);

  await startRun(page, hasTouch);

  expect(await page.evaluate(() => (globalThis as HookHost).__panelSession?.scenarioId())).toBe(
    'eng-oil-temp-green',
  );
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p75');
  await expect(control(page, 'lv.cowl_flap')).toHaveAttribute('data-state', 'closed');
  // The baseline is applied without a single event in the action log.
  expect(await events(page)).toEqual([]);

  const button = await page.getByTestId('procedure-complete').boundingBox();
  expect(button?.height ?? 0).toBeGreaterThanOrEqual(MIN_BUTTON_PX);
  const footer = await page.locator('footer').boundingBox();
  expect(footer?.height ?? 0).toBeGreaterThanOrEqual(MIN_FOOTER_PX);
});

const chips = (page: Page) => page.locator('[data-testid="cas-chip"]');

/** The chip lies inside the PFD region box and right of its centre. */
async function expectChipInPfd(page: Page): Promise<void> {
  const pfd = await page.locator('[data-region-id="pfd"]').boundingBox();
  const chip = await chips(page).boundingBox();
  expect(pfd).not.toBeNull();
  expect(chip).not.toBeNull();
  if (pfd === null || chip === null) return;
  expect(chip.x).toBeGreaterThanOrEqual(pfd.x);
  expect(chip.y).toBeGreaterThanOrEqual(pfd.y);
  expect(chip.x + chip.width).toBeLessThanOrEqual(pfd.x + pfd.width);
  expect(chip.y + chip.height).toBeLessThanOrEqual(pfd.y + pfd.height);
  expect(chip.x).toBeGreaterThan(pfd.x + pfd.width / 2 - 1);
}

test('@hooks the ENG OIL TEMP chip shows during the run and stays after the debrief', async ({
  page,
  hasTouch,
}) => {
  // Free panel: no annunciation is drawn.
  await expect(chips(page)).toHaveCount(0);

  await startRun(page, hasTouch);
  await expect(chips(page)).toHaveCount(1);
  const chip = chips(page).first();
  await expect(chip).toHaveAttribute('data-cas-id', 'eng_oil_temp');
  await expect(chip).toHaveAttribute('data-level', 'warning');
  await expect(chip).toHaveAttribute('aria-label', 'Warning: ENG OIL TEMP');
  await expect(chip).toHaveText('ENG OIL TEMP');
  await expectChipInPfd(page);
  // The exam stays silent: no live region on the chip group.
  await expect(page.locator('[data-testid="cas-chips"] [aria-live]')).toHaveCount(0);

  await goldenTaps(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  await activate(page.getByTestId('debrief-back'), hasTouch);
  await expect(page.getByRole('dialog')).toBeHidden();
  // Closing the debrief keeps the end state, the annunciation included (U-10).
  await expect(chips(page)).toHaveCount(1);
  await expectChipInPfd(page);
});

const mfdGauge = (page: Page, label: string) =>
  page.locator(`[data-region-id="mfd"] [data-gauge="${label}"]`);

test('@hooks the MFD oil gauges read the scenario values and the idle values in the free panel', async ({
  page,
  hasTouch,
}) => {
  await expect(mfdGauge(page, 'Oil temp')).toContainText('15 °C');
  await expect(mfdGauge(page, 'Oil pres')).toContainText('0 BAR');

  await startRun(page, hasTouch);
  // Map page: the engine strip shows 128 degrees C (red band) and 5 bar (green band).
  await expect(mfdGauge(page, 'Oil temp')).toContainText('128 °C');
  await expect(mfdGauge(page, 'Oil pres')).toContainText('5 BAR');
  // Engine page: the same values on the arc and the bar.
  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);
  await expect(page.getByTestId('mfd-engine-page')).toBeVisible();
  await expect(mfdGauge(page, 'Oil temp')).toContainText('128 °C');
  await expect(mfdGauge(page, 'Oil pres')).toContainText('5');
  await expect(mfdGauge(page, 'Oil pres')).toContainText('BAR');
});

test('@hooks the golden run grades PASS and keeps the end state', async ({ page, hasTouch }) => {
  await startRun(page, hasTouch);
  await goldenTaps(page, hasTouch);

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  const rows = page.getByTestId('debrief-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute('data-verdict', 'Done');
  await expect(rows.nth(1)).toHaveAttribute('data-verdict', 'Done');

  await activate(page.getByTestId('debrief-back'), hasTouch);
  await expect(dialog).toBeHidden();
  expect(await screenOf(page)).toBe('free');
  // Closing the debrief keeps the end state (U-10).
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p50');
  await expect(control(page, 'lv.cowl_flap')).toHaveAttribute('data-state', 'open');
  await expect(page.getByTestId('procedure-complete')).toHaveCount(0);
});

test('@hooks doing nothing grades FAIL', async ({ page, hasTouch }) => {
  await startRun(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);

  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  await expect(page.getByTestId('debrief-reason')).toHaveText('2 critical steps were missed.');
  const rows = page.getByTestId('debrief-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute('data-verdict', 'Missed');
});

test('@hooks the exam stays silent and session buttons record nothing', async ({
  page,
  hasTouch,
}) => {
  await startRun(page, hasTouch);
  await goldenTaps(page, hasTouch);

  // No hint, toast, live region or alert while the exam runs (SES-03).
  await expect(page.locator('[aria-live], [role="alert"], [role="alertdialog"]')).toHaveCount(0);
  expect(await resultOf(page)).toBeNull();
  // Starting the run was a session press: only the two control actuations are in the log (T-02-08).
  expect((await events(page)).map((e) => [e.id, e.value])).toEqual([
    ['lv.power', 'p50'],
    ['lv.cowl_flap', 'open'],
  ]);
});
