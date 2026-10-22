import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { quantityOf } from './support/session';
import { FULL_VIEWBOX, activate } from './support/zoom';

// SES-01, SES-03, SES-04, SCN-05, SCN-07, PLT-04 (phase 02): the pilot's path on the built panel.
// NEW SITUATION in the co-pilot legroom opens the briefing over the unchanged panel, Start run
// starts ENG OIL TEMP in its initial state, the user operates the panel, "Procedure complete" in
// the footer grades the recorded log and the debrief shows PASS or FAIL.
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

const NEW_SITUATION = '[data-session-hit="session.new"]';
const CHOOSE_SITUATION = '[data-session-hit="session.choose"]';
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

/** The 400 ms input shield of a freshly shown list or overlay (U-12) plus 100 ms of margin. */
const SHIELD_WAIT_MS = 500;

async function afterShield(page: Page): Promise<void> {
  await page.waitForTimeout(SHIELD_WAIT_MS);
}

/** Taps NEW SITUATION and waits until the briefing is open. */
async function openBriefing(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-session-hit="session.new"]'), hasTouch);
  await expect(page.getByTestId('level-pick')).toBeVisible();
  await page.waitForTimeout(450);
  await activate(page.getByTestId('level-pick-easy'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeVisible();
  expect(await screenOf(page)).toBe('briefing');
}

/** NEW SITUATION, then Start run; waits until the run is on. The one start of every case. */
async function startRun(page: Page, hasTouch: boolean): Promise<void> {
  await openBriefing(page, hasTouch);
  await activate(page.getByTestId('briefing-start'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeHidden();
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

test('@hooks CHOOSE SITUATION lists the allowed scenarios and a row opens its briefing', async ({
  page,
  hasTouch,
}) => {
  const before = await controlStates(page);
  await activate(page.locator(CHOOSE_SITUATION), hasTouch);

  // The choose view: CLOSE LIST and one row per scenario, titled from the manifest.
  const close = page.locator('[data-session-hit="session.close"]');
  await expect(close).toBeVisible();
  await expect(page.locator(CHOOSE_SITUATION)).toHaveCount(0);
  await expect(page.locator(NEW_SITUATION)).toHaveCount(0);
  const rows = page.locator('[data-session-hit^="session.row."]');
  await expect(rows).toHaveCount(1);
  const row = page.getByRole('button', { name: 'Open briefing: ENG OIL TEMP' });
  await expect(row).toHaveText('ENG OIL TEMP');
  expect(await screenOf(page)).toBe('choosing');
  // Choosing is no session: the footer keeps its idle height and the run button is absent.
  await expect(page.getByTestId('procedure-complete')).toHaveCount(0);

  // CLOSE LIST returns to the two buttons.
  await afterShield(page);
  await activate(close, hasTouch);
  await expect(page.locator(NEW_SITUATION)).toBeVisible();
  await expect(page.locator(CHOOSE_SITUATION)).toBeVisible();
  expect(await screenOf(page)).toBe('free');

  // Escape returns as well.
  await activate(page.locator(CHOOSE_SITUATION), hasTouch);
  await expect(close).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator(NEW_SITUATION)).toBeVisible();
  expect(await screenOf(page)).toBe('free');

  // A row opens the briefing of exactly that scenario; Back to panel returns to the main view.
  await activate(page.locator(CHOOSE_SITUATION), hasTouch);
  await afterShield(page);
  await activate(page.locator('[data-session-hit^="session.row."]').first(), hasTouch);
  await expect(page.getByTestId('level-pick')).toBeVisible();
  await page.waitForTimeout(450);
  await activate(page.getByTestId('level-pick-easy'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(
    page.getByTestId('briefing').getByRole('heading', { name: 'ENG OIL TEMP' }),
  ).toBeVisible();
  expect(await screenOf(page)).toBe('briefing');
  await activate(page.getByTestId('briefing-back'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeHidden();
  await expect(page.locator(NEW_SITUATION)).toBeVisible();
  expect(await screenOf(page)).toBe('free');
  expect(await controlStates(page)).toEqual(before);
  expect(await events(page)).toEqual([]);
});

test('@hooks NEW SITUATION during a run asks first; Keep going and Escape keep the run, Leave run drops it', async ({
  page,
  hasTouch,
}) => {
  await startRun(page, hasTouch);
  await goldenTaps(page, hasTouch);
  await expect(chips(page)).toHaveCount(1);
  const logged = await events(page);

  // NEW SITUATION during a run opens the confirm with Keep going focused; the run is untouched.
  await activate(page.locator(NEW_SITUATION), hasTouch);
  const confirm = page.getByRole('dialog', { name: 'Leave this run?' });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('The current run ends without a result.');
  await expect(page.getByTestId('leave-keep')).toBeFocused();
  expect(await screenOf(page)).toBe('running');

  // Escape is Keep going.
  await page.keyboard.press('Escape');
  await expect(confirm).toBeHidden();
  expect(await screenOf(page)).toBe('running');
  expect(await events(page)).toEqual(logged);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p50');
  await expect(chips(page)).toHaveCount(1);

  // Keep going by button, after the shield of the dialog.
  await activate(page.locator(CHOOSE_SITUATION), hasTouch);
  await expect(confirm).toBeVisible();
  await activate(page.getByTestId('leave-keep'), hasTouch);
  await expect(confirm).toBeHidden();
  expect(await screenOf(page)).toBe('running');
  expect(await events(page)).toEqual(logged);

  // Leave run: no result, the panel at its defaults, no chip, then the briefing of a new situation.
  await activate(page.locator(NEW_SITUATION), hasTouch);
  await expect(confirm).toBeVisible();
  await activate(page.getByTestId('leave-leave'), hasTouch);
  await expect(page.getByTestId('level-pick')).toBeVisible();
  await page.waitForTimeout(450);
  await activate(page.getByTestId('level-pick-easy'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeVisible();
  expect(await screenOf(page)).toBe('briefing');
  expect(await resultOf(page)).toBeNull();
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p70');
  await expect(control(page, 'lv.cowl_flap')).toHaveAttribute('data-state', 'closed');
  await expect(chips(page)).toHaveCount(0);
  expect(await events(page)).toEqual([]);
  await expect(page.getByTestId('debrief')).toHaveCount(0);
});

test('@hooks a pack that cannot be loaded shows the error; Try again retries the same request', async ({
  page,
  hasTouch,
}) => {
  // Requests for the pack chunk fail (the lazy chunk is named pack-<pack>).
  const abort = (route: Route) => route.abort();
  await page.route('**/pack-engine*', abort);

  await activate(page.locator(NEW_SITUATION), hasTouch);
  const error = page.getByRole('alertdialog', { name: 'This situation could not be loaded.' });
  await expect(error).toBeVisible();
  await expect(error).toContainText('Check your connection, then try again.');
  await expect(page.getByTestId('load-error-retry')).toBeFocused();
  expect(await screenOf(page)).toBe('free');
  await expect(page.getByTestId('briefing')).toHaveCount(0);

  // Back to panel (and Escape) close the message without a retry.
  await activate(page.getByTestId('load-error-back'), hasTouch);
  await expect(error).toBeHidden();
  expect(await screenOf(page)).toBe('free');

  await activate(page.locator(NEW_SITUATION), hasTouch);
  await expect(error).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(error).toBeHidden();
  expect(await screenOf(page)).toBe('free');

  // With the abort gone, Try again opens the briefing.
  await activate(page.locator(NEW_SITUATION), hasTouch);
  await expect(error).toBeVisible();
  await page.unroute('**/pack-engine*', abort);
  await activate(page.getByTestId('load-error-retry'), hasTouch);
  await expect(page.getByTestId('level-pick')).toBeVisible();
  await page.waitForTimeout(450);
  await activate(page.getByTestId('level-pick-easy'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(error).toBeHidden();
  expect(await screenOf(page)).toBe('briefing');
});

const BRIEFING_STATE_CONTROLS = ['lv.power', 'lv.cowl_flap'];

async function controlStates(page: Page): Promise<(string | null)[]> {
  return Promise.all(
    BRIEFING_STATE_CONTROLS.map((id) => control(page, id).getAttribute('data-state')),
  );
}

test('@hooks the Easy briefing shows the checklist with the panel steps and the source at the bottom', async ({
  page,
  hasTouch,
}) => {
  const before = await controlStates(page);
  await openBriefing(page, hasTouch);

  const briefing = page.getByTestId('briefing');
  await expect(briefing.getByRole('heading', { name: 'ENG OIL TEMP' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'ENG OIL TEMP' })).toBeVisible();
  await expect(page.getByTestId('briefing-situation')).not.toBeEmpty();
  const source = page.getByTestId('briefing-source');
  await expect(source).toContainText('Source: AFM 03-08 ENG OIL TEMP, issue 018');
  await expect(source).toContainText('AFM DA 50 C, Doc 9.01.01-E, checked 2026-10-22');
  await expect(page.getByTestId('briefing-disclaimer')).toHaveText(
    'Training aid only. Not a replacement for the AFM or for instruction.',
  );
  await expect(briefing.getByRole('heading', { name: 'Checklist' })).toBeVisible();
  await expect(page.getByTestId('briefing-exam')).toHaveText(
    'Exam mode: no hints. When you are done, press Procedure complete.',
  );

  // The decision card, whole: the panel steps of the branch that applies are listed as plain lines,
  // the sibling that does not apply is shown as such, without children.
  const outline = page.getByTestId('briefing-outline');
  await expect(outline).toContainText('Check oil pressure');
  const tooLow = outline.locator('li[data-kind="branch"]', { hasText: 'If too low:' });
  await expect(tooLow).toContainText('Not applicable');
  await expect(tooLow.locator('li')).toHaveCount(0);
  await expect(outline).toContainText('If in green range:');
  await expect(outline).toContainText('Reduce power');
  await expect(outline).toContainText('Open cowl flap');
  await expect(outline).toContainText('Increase airspeed');
  await expect(outline).toContainText('If not returning to green range:');
  // No severity tag, no verdict word, no graded row in the briefing.
  await expect(briefing).not.toContainText('CRITICAL');
  await expect(briefing).not.toContainText('Done');
  await expect(briefing).not.toContainText('Missed');
  await expect(briefing.getByTestId('debrief-row')).toHaveCount(0);

  // The order inside the card, and the source closes the body.
  const order = await briefing.evaluate((card) => {
    const all = [...card.querySelectorAll('*')];
    const at = (id: string) => {
      const el = card.querySelector(`[data-testid="${id}"]`);
      return el === null ? -1 : all.indexOf(el);
    };
    const sourceEl = card.querySelector('[data-testid="briefing-source"]');
    const lastInside = sourceEl === null ? -1 : all.indexOf(sourceEl);
    const body = ['briefing-situation', 'briefing-disclaimer', 'briefing-outline', 'briefing-exam'];
    return {
      ids: [...body, 'briefing-source'].map(at),
      bodyBeforeSource: body.every((id) => at(id) < lastInside),
    };
  });
  expect(order.ids.every((i) => i >= 0)).toBe(true);
  expect(order.ids).toEqual([...order.ids].sort((x, y) => x - y));
  expect(order.bodyBeforeSource).toBe(true);

  // The panel behind it is unchanged: same control states, empty log, no CAS chip yet.
  expect(await controlStates(page)).toEqual(before);
  expect(await events(page)).toEqual([]);
  await expect(chips(page)).toHaveCount(0);
  const footer = await page.locator('footer').boundingBox();
  expect(footer?.height ?? 0).toBeGreaterThanOrEqual(MIN_FOOTER_PX);
});

test('@hooks Level question: Easy, Medium and a disabled Realistic come before any briefing; Medium has no checklist and the debrief names it', async ({
  page,
  hasTouch,
}) => {
  await activate(page.locator('[data-session-hit="session.new"]'), hasTouch);
  await expect(page.getByTestId('level-pick')).toBeVisible();
  await expect(page.getByTestId('briefing')).toHaveCount(0);
  const easy = page.getByTestId('level-pick-easy');
  const medium = page.getByTestId('level-pick-medium');
  const realistic = page.getByTestId('level-pick-realistic');
  await expect(realistic).toBeDisabled();

  // Both level buttons are real touch targets inside the viewport.
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const button of [easy, medium]) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (box === null || viewport === null) return;
    expect(box.height).toBeGreaterThanOrEqual(MIN_BUTTON_PX);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }

  await afterShield(page);
  await activate(medium, hasTouch);
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(page.getByTestId('briefing-outline')).toHaveCount(0);
  await expect(page.getByTestId('briefing-situation')).toBeVisible();

  await activate(page.getByTestId('briefing-start'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeHidden();
  expect(await screenOf(page)).toBe('running');
  await goldenTaps(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  await expect(page.getByTestId('debrief-level')).toHaveText('Level: Medium');
  // The debrief always shows the checklist with its verdicts.
  await expect(page.getByTestId('debrief-row')).toHaveCount(2);
});

test('@hooks Start run starts in the initial state on the full panel', async ({
  page,
  hasTouch,
}) => {
  await openBriefing(page, hasTouch);
  await activate(page.getByTestId('briefing-start'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeHidden();

  expect(await screenOf(page)).toBe('running');
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p75');
  await expect(control(page, 'lv.cowl_flap')).toHaveAttribute('data-state', 'closed');
  await expect(page.getByTestId('panel')).toHaveAttribute('viewBox', FULL_VIEWBOX);
  expect(await events(page)).toEqual([]);
  // The footer kept its 52 px from the briefing on: the panel did not resize.
  const footer = await page.locator('footer').boundingBox();
  expect(footer?.height ?? 0).toBeGreaterThanOrEqual(MIN_FOOTER_PX);
});

for (const how of ['button', 'escape'] as const) {
  test(`@hooks leaving the briefing by ${how} changes nothing`, async ({ page, hasTouch }) => {
    const before = await controlStates(page);
    const idle = await page.locator('footer').boundingBox();
    await openBriefing(page, hasTouch);
    if (how === 'button') await activate(page.getByTestId('briefing-back'), hasTouch);
    else await page.keyboard.press('Escape');

    await expect(page.getByTestId('briefing')).toBeHidden();
    expect(await screenOf(page)).toBe('free');
    expect(await controlStates(page)).toEqual(before);
    expect(await events(page)).toEqual([]);
    await expect(chips(page)).toHaveCount(0);
    await expect(page.getByTestId('procedure-complete')).toHaveCount(0);
    // The footer is back to its idle height: the briefing was not a session.
    const footer = await page.locator('footer').boundingBox();
    expect(footer?.height ?? 0).toBe(idle?.height ?? -1);
  });
}

test('@hooks the briefing action row is reachable without scrolling the page', async ({
  page,
  hasTouch,
}) => {
  await openBriefing(page, hasTouch);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  for (const id of ['briefing-start', 'briefing-back']) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box).not.toBeNull();
    if (box === null || viewport === null) return;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  }
  // The page itself does not scroll; the card scrolls inside itself.
  expect(await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)).toBe(0);
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
  // Closing the debrief keeps the end state (U-10, C-04): the paused run no longer moves the oil
  // temperature, and the annunciation is the one that value derives (above 125 the chip shows).
  const settled = await quantityOf(page, 'oil_temp_c');
  await page.waitForTimeout(1000);
  expect(await quantityOf(page, 'oil_temp_c')).toBe(settled);
  await expect(chips(page)).toHaveCount(settled > 125 ? 1 : 0);
  if (settled > 125) await expectChipInPfd(page);
});

const mfdGauge = (page: Page, label: string) =>
  page.locator(`[data-region-id="mfd"] [data-gauge="${label}"]`);

test('@hooks the MFD oil gauges read the base values in the free panel and the live values in a run', async ({
  page,
  hasTouch,
}) => {
  // The free panel shows the base (cruise) readings at the gauge's resolution; the expected text
  // is read from the quantity data, never typed in.
  const oilTemp = DA50RG_QUANTITIES.get('oil_temp_c');
  const oilPres = DA50RG_QUANTITIES.get('oil_pressure_bar');
  if (oilTemp === undefined || oilPres === undefined) throw new Error('missing quantity data');
  await expect(mfdGauge(page, 'Oil temp')).toContainText(
    `${oilTemp.base.toFixed(0)} ${oilTemp.unit.toUpperCase()}`,
  );
  await expect(mfdGauge(page, 'Oil pres')).toContainText(
    `${oilPres.base.toFixed(1)} ${oilPres.unit.toUpperCase()}`,
  );

  await startRun(page, hasTouch);
  // The oil temperature moves during a run (D-01), so the start values 128 degrees C and 5 bar are
  // read with a tolerance right after Start run; the pressure sits at its base, which is 5.
  expect(Math.abs((await quantityOf(page, 'oil_temp_c')) - 128)).toBeLessThanOrEqual(3);
  expect(Math.abs((await quantityOf(page, 'oil_pressure_bar')) - 5)).toBeLessThanOrEqual(3);
  // Map page: the engine strip shows a number with its unit for each.
  await expect(mfdGauge(page, 'Oil temp')).toContainText(/\d+ °C/);
  await expect(mfdGauge(page, 'Oil pres')).toContainText(/\d+ BAR/);
  // Engine page: the same values on the arc and the bar.
  await activate(page.locator('[data-hit="sw.mfd_page"]'), hasTouch);
  await expect(page.getByTestId('mfd-engine-page')).toBeVisible();
  await expect(mfdGauge(page, 'Oil temp')).toContainText(/\d+ °C/);
  await expect(mfdGauge(page, 'Oil pres')).toContainText(/\d/);
  await expect(mfdGauge(page, 'Oil pres')).toContainText('BAR');
});

test('@hooks the golden run grades PASS and keeps the end state', async ({ page, hasTouch }) => {
  await startRun(page, hasTouch);
  await goldenTaps(page, hasTouch);

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  await expect(page.getByTestId('debrief-level')).toHaveText('Level: Easy');
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

test('@hooks the debrief shows the outline with verdicts, Not graded and the branch that does not apply', async ({
  page,
  hasTouch,
}) => {
  await startRun(page, hasTouch);
  await goldenTaps(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');

  const debrief = page.getByTestId('debrief');
  await expect(debrief.getByRole('heading', { name: 'Steps' })).toBeVisible();
  // The decision card, whole: the sibling that does not apply is shown as such.
  const tooLow = debrief.locator('li[data-kind="branch"]', { hasText: 'If too low:' });
  await expect(tooLow).toContainText('Not applicable');
  await expect(
    debrief.locator('li[data-kind="branch"]', { hasText: 'If in green range:' }),
  ).toBeVisible();
  // The two graded steps: severity tag, text, verdict word.
  const rows = debrief.getByTestId('debrief-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('CRITICAL');
  await expect(rows.nth(0)).toContainText('Reduce power');
  await expect(rows.nth(0)).toContainText('Done');
  await expect(rows.nth(1)).toContainText('CRITICAL');
  await expect(rows.nth(1)).toContainText('Open cowl flap');
  await expect(rows.nth(1)).toContainText('Done');
  // Non-graded lines say so; the decision too.
  const airspeed = debrief.locator('li[data-kind="line"]', { hasText: 'Increase airspeed' });
  await expect(airspeed).toContainText('Not graded');
  await expect(
    debrief
      .locator('li[data-kind="decision"]', { hasText: 'Check oil pressure' })
      .first()
      .locator(':scope > div'),
  ).toContainText('Not graded');
  await expect(
    debrief.locator('li[data-kind="line"]', { hasText: 'Land at nearest suitable airfield' }),
  ).toContainText('Not graded');
  // Nesting is real list nesting, and long lines never scroll the card sideways.
  await expect(debrief.locator('ul ul ul ul')).not.toHaveCount(0);
  const overflow = await debrief.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('@hooks a power increase is a harmful action that fails the run', async ({
  page,
  hasTouch,
}) => {
  await startRun(page, hasTouch);
  // POWER up to the 100 % marker is the harmful action (D-03); it is reverted by the golden taps.
  await activate(page.locator('[data-detent="lv.power:p100"]'), hasTouch);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p100');
  await goldenTaps(page, hasTouch);

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  await expect(page.getByTestId('debrief-reason')).toHaveText(
    'A harmful action counts as a fail in this scenario.',
  );
  const debrief = page.getByTestId('debrief');
  await expect(debrief.getByRole('heading', { name: 'Harmful actions (1)' })).toBeVisible();
  const rows = page.getByTestId('debrief-harmful-row');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toHaveText('Increase power');
  await expect(page.getByTestId('debrief-harmful-none')).toHaveCount(0);
  // The order of the sections: result, steps, harmful actions, action row.
  const order = await debrief.evaluate((card) => {
    const at = (selector: string) => {
      const el = card.querySelector(selector);
      return el === null ? -1 : [...card.querySelectorAll('*')].indexOf(el);
    };
    return [
      at('[data-testid="debrief-result"]'),
      at('[data-testid="debrief-reason"]'),
      at('li[data-kind="step"]'),
      at('[data-testid="debrief-harmful-heading"]'),
      at('[data-testid="debrief-harmful-row"]'),
    ];
  });
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(order.every((i) => i >= 0)).toBe(true);
});

test('@hooks a run without harmful actions says None.', async ({ page, hasTouch }) => {
  await startRun(page, hasTouch);
  await goldenTaps(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  await expect(page.getByRole('heading', { name: 'Harmful actions (0)' })).toBeVisible();
  await expect(page.getByTestId('debrief-harmful-none')).toHaveText('None.');
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
