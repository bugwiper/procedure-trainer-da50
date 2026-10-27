import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseScenario } from '../src/scenario/parse';
import { SESSION_LAYOUT, pageCount } from '../src/ui/panel/session-area';
import { forceVariant, startScenario, shippedScenarios } from './support/session';
import { activate, activateAt, afterPairWindow, leaveZoom, zoomIntoRegion } from './support/zoom';

// The fire and smoke pack (Phase 5.1, plan 02) as the pilot meets it on the built panel: the
// situations of scenarios/fire/ are chosen from the pages of CHOOSE SITUATION, run on their scenes
// with their cues and graded by control state. Titles with @hooks read the e2e window hook.

const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);
const FLAMES = '[data-cue="flames"]';
const scene = (id: string) => `[data-layer="windscreen"] [data-scene="${id}"]`;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  // The rotate hint of a portrait phone covers the panel until it is dismissed.
  const dismiss = page.getByTestId('rotate-hint-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByTestId('rotate-hint')).toBeHidden();
});

/** Taps the right (clockwise) half of the FUEL selector, at 75 percent of its width. */
async function tapFuelSelectorRight(page: Page, hasTouch: boolean): Promise<void> {
  const b = await page.locator('[data-hit="sw.fuel_valve"]').boundingBox();
  if (b === null) throw new Error('no bounding box for the FUEL selector');
  await activateAt(page, { x: b.x + b.width * 0.75, y: b.y + b.height / 2 }, hasTouch);
}

/** ENGINE MASTER off, the FUEL selector to OFF (two taps on the zoomed pedestal), ELECT. MASTER off. */
async function shutDown(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'off');
  await zoomIntoRegion(page, hasTouch, 'pedestal');
  await tapFuelSelectorRight(page, hasTouch);
  await afterPairWindow(page);
  await tapFuelSelectorRight(page, hasTouch);
  await expect(control(page, 'sw.fuel_valve')).toHaveAttribute('data-state', 'off');
  await leaveZoom(page, hasTouch);
  await activate(page.locator('[data-hit="sw.elect_master"]'), hasTouch);
  await expect(control(page, 'sw.elect_master')).toHaveAttribute('data-state', 'off');
}

/** The door release lever to OPEN, on the zoomed door region. */
async function openDoor(page: Page, hasTouch: boolean): Promise<void> {
  await zoomIntoRegion(page, hasTouch, 'door_arm');
  await activate(page.locator('[data-hit="lv.door_release"]'), hasTouch);
  await expect(control(page, 'lv.door_release')).toHaveAttribute('data-state', 'open');
  await leaveZoom(page, hasTouch);
}

test('@hooks Engine Fire on Ground: the parked scene and the flames show, the golden run grades PASS', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, 'fire.eng-fire-ground', 'easy');
  await expect(page.locator(scene('parked'))).toHaveCount(1);
  await expect(page.locator(FLAMES)).toHaveCount(1);
  // The door starts locked, so a do-nothing run never credits the Door row.
  await expect(control(page, 'lv.door_release')).toHaveAttribute('data-state', 'locked');

  await shutDown(page, hasTouch);
  await openDoor(page, hasTouch);

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  for (const id of ['engine_master_off', 'fuel_valve_off', 'elect_master_off', 'door_open']) {
    await expect(page.locator(`[data-step-id="${id}"]`)).toHaveAttribute('data-verdict', 'Done');
  }
});

test('@hooks Engine Fire on Ground without the door lever grades FAIL', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, 'fire.eng-fire-ground', 'easy');
  await shutDown(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  await expect(page.locator('[data-step-id="door_open"]')).toHaveAttribute(
    'data-verdict',
    'Missed',
  );
});

test('the fire situations stand on the pages of CHOOSE SITUATION after the four of page 1', async ({
  page,
  hasTouch,
}) => {
  const fire = shippedScenarios().filter((entry) => entry.pack === 'fire');
  expect(fire.length).toBeGreaterThan(0);
  const all = shippedScenarios();
  const rows = SESSION_LAYOUT.choose.maxRows;
  await activate(page.locator('[data-session-hit="session.choose"]'), hasTouch);
  await page.waitForTimeout(500);
  const listed = page.locator('[data-session-hit^="session.row."]');
  for (let turned = 0; turned < pageCount(all.length); turned++) {
    const onPage = all.slice(turned * rows, turned * rows + rows);
    await expect(listed).toHaveCount(onPage.length);
    for (const entry of onPage) {
      await expect(page.locator(`[data-session-hit="session.row.${entry.row}"]`)).toHaveCount(1);
    }
    // A fire situation never shares page 1 with the four earlier situations.
    if (turned === 0) {
      for (const entry of fire) {
        expect(onPage.some((e) => e.row === entry.row)).toBe(all.length <= rows);
      }
    }
    if (pageCount(all.length) > 1) {
      await afterPairWindow(page);
      await activate(page.locator('[data-session-hit="session.next"]'), hasTouch);
    }
  }
});

// Electrical Fire with Smoke on Ground: smoke over the panel from the start, cleared by ELECT.
// MASTER off, and the two causes (engine running or stopped) drawn by seed.
const SMOKE = '[data-cue="cabin_smoke"]';
const ELEC_FILE = 'fire/elec-fire-ground';
const ELEC_ROW = 'fire.elec-fire-ground';
const elecScenario = parseScenario(
  readFileSync(new URL(`../scenarios/${ELEC_FILE}.toon`, import.meta.url), 'utf8'),
);
if (!elecScenario.ok) throw new Error(`${ELEC_FILE} does not parse`);
const ELEC_VARIANTS = elecScenario.value.variants;
const PORTRAIT_NOTE =
  'Portrait phones are covered by the rotate hint (D-02); pinch zoom reaches full tap size there';
/** The smoke clears within about 20 s of the master off (rate 2, from 40); the spec allows 40 s. */
const CLEARS_WITHIN_MS = 40_000;

for (const variant of ELEC_VARIANTS) {
  test(`@hooks Electrical Fire on Ground, cause ${variant.id}: smoke from the start, the golden run clears it and grades PASS`, async ({
    page,
    hasTouch,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
    await forceVariant(page, ELEC_FILE, variant.id);
    await startScenario(page, hasTouch, ELEC_ROW, 'easy');
    await expect(page.locator(scene('parked'))).toHaveCount(1);
    await expect(page.locator(SMOKE)).toHaveCount(1);
    const stopped = variant.controls['sw.engine_master'] === 'off';
    await expect(control(page, 'sw.engine_master')).toHaveAttribute(
      'data-state',
      stopped ? 'off' : 'on',
    );

    await activate(page.locator('[data-hit="sw.elect_master"]'), hasTouch);
    await expect(control(page, 'sw.elect_master')).toHaveAttribute('data-state', 'off');
    // The source is gone: the smoke thins and the cue is no longer drawn.
    await expect(page.locator(SMOKE)).toHaveCount(0, { timeout: CLEARS_WITHIN_MS });

    if (!stopped) {
      await activate(page.locator('[data-detent="lv.power:p0"]'), hasTouch);
      await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p0');
      await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
      await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'off');
      await zoomIntoRegion(page, hasTouch, 'pedestal');
      await tapFuelSelectorRight(page, hasTouch);
      await afterPairWindow(page);
      await tapFuelSelectorRight(page, hasTouch);
      await expect(control(page, 'sw.fuel_valve')).toHaveAttribute('data-state', 'off');
      await leaveZoom(page, hasTouch);
    }
    await openDoor(page, hasTouch);

    await activate(page.getByTestId('procedure-complete'), hasTouch);
    await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
    await expect(page.getByTestId('debrief-variant')).toHaveText(`Cause: ${variant.debrief}`);
  });
}

test('@hooks Electrical Fire on Ground without the master off grades FAIL and keeps the smoke', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ELEC_ROW, 'easy');
  await expect(page.locator(SMOKE)).toHaveCount(1);
  await openDoor(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
});

// Smoke and Fire During Take-Off: the abort and the no abort, on the roll scene, with the PFD
// airspeed that follows the ground speed.
const ABORT_ROW = 'fire.takeoff-fire-abort';
const NO_ABORT_ROW = 'fire.takeoff-fire-no-abort';
const MARKS = '[data-scene="takeoff_roll"] .w-roll-mark';
const READOUT = '[data-testid="pfd-airspeed"] [data-airspeed-readout]';
/** The aircraft stops within about 20 s of braking and idling; the spec allows 60 s. */
const STOPS_WITHIN_MS = 60_000;

const speedOf = async (page: Page): Promise<number> =>
  Number(await page.locator(READOUT).first().textContent());
const markRate = (page: Page) =>
  page
    .locator(MARKS)
    .first()
    .evaluate((el) => el.getAnimations().map((a) => a.playbackRate));

/** Taps the toe brakes on the zoomed pedals region. */
async function applyBrakes(page: Page, hasTouch: boolean): Promise<void> {
  await zoomIntoRegion(page, hasTouch, 'pedals');
  await activate(page.locator('[data-hit="lv.toe_brakes"]'), hasTouch);
  await expect(control(page, 'lv.toe_brakes')).toHaveAttribute('data-state', 'applied');
  await leaveZoom(page, hasTouch);
}

for (const [row, speed] of [
  [ABORT_ROW, 40],
  [NO_ABORT_ROW, 70],
] as const) {
  test(`@hooks ${row}: the roll scene, the flames and the PFD airspeed of the start show`, async ({
    page,
    hasTouch,
  }) => {
    await startScenario(page, hasTouch, row, 'easy');
    await expect(page.locator(scene('takeoff_roll'))).toHaveCount(1);
    await expect(page.locator(FLAMES)).toHaveCount(1);
    // The reading starts at the start speed of the situation and moves from there.
    await expect.poll(() => speedOf(page)).toBeGreaterThanOrEqual(speed);
    await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p100');
    await expect.poll(() => markRate(page)).not.toEqual([0]);
  });
}

test('@hooks the PFD airspeed shows the static 140 knots on the free panel', async ({ page }) => {
  await expect(page.locator(READOUT)).toHaveText('140');
});

for (const row of ['fire.eng-fire-ground', ELEC_ROW]) {
  test(`@hooks ${row}: the PFD airspeed reads 0 knots while the aircraft stands on the apron`, async ({
    page,
    hasTouch,
  }) => {
    await startScenario(page, hasTouch, row, 'easy');
    await expect(page.locator(READOUT)).toHaveText('0');
    // It stays at 0 for a while (the parking brake holds the aircraft, also with the engine running).
    await page.waitForTimeout(1500);
    await expect(page.locator(READOUT)).toHaveText('0');
  });
}

test('@hooks the PFD airspeed rises with full power and falls with the brakes on', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ABORT_ROW, 'easy');
  const start = await speedOf(page);
  // Full power from the start accelerates the roll.
  await expect.poll(() => speedOf(page), { timeout: 15_000 }).toBeGreaterThan(start + 2);
  const peak = await speedOf(page);
  await applyBrakes(page, hasTouch);
  // The brakes beat the power: the reading falls below where it was.
  await expect.poll(() => speedOf(page), { timeout: 30_000 }).toBeLessThan(peak);
});

test('@hooks T/O FIRE ABORT: the golden run stops the aircraft and the roll scene, and grades PASS', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ABORT_ROW, 'easy');
  await activate(page.locator('[data-detent="lv.power:p0"]'), hasTouch);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p0');
  await applyBrakes(page, hasTouch);
  await activate(page.locator('[data-detent="lv.ecs_shutoff:pulled"]'), hasTouch);
  await expect(control(page, 'lv.ecs_shutoff')).toHaveAttribute('data-state', 'pulled');
  await shutDown(page, hasTouch);

  // The aircraft stands: the readout is 0 and the roll marks play at rate 0.
  await expect.poll(() => speedOf(page), { timeout: STOPS_WITHIN_MS }).toBe(0);
  await expect.poll(() => markRate(page)).toEqual([0]);
  await openDoor(page, hasTouch);

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  await expect(page.locator('[data-step-id="door_open"]')).toHaveAttribute('data-verdict', 'Done');
});

test('@hooks T/O FIRE ABORT without the door grades FAIL', async ({ page, hasTouch }) => {
  await startScenario(page, hasTouch, ABORT_ROW, 'easy');
  await activate(page.locator('[data-detent="lv.power:p0"]'), hasTouch);
  await applyBrakes(page, hasTouch);
  await activate(page.locator('[data-detent="lv.ecs_shutoff:pulled"]'), hasTouch);
  await shutDown(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
});

test('@hooks T/O FIRE NO ABORT: the four critical rows grade PASS, the window and the doors are optional', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, NO_ABORT_ROW, 'easy');
  await activate(page.locator('[data-detent="lv.ecs_shutoff:pulled"]'), hasTouch);
  await expect(control(page, 'lv.ecs_shutoff')).toHaveAttribute('data-state', 'pulled');
  await shutDown(page, hasTouch);
  // The speed holds at 70 knots and the roll marks keep moving in the air.
  await expect.poll(() => speedOf(page)).toBe(70);
  await expect.poll(() => markRate(page)).toEqual([1]);

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  for (const id of ['windows_open', 'doors_open']) {
    await expect(page.locator(`[data-step-id="${id}"]`)).toHaveAttribute(
      'data-verdict',
      'Not done',
    );
  }
});

// Electrical Fire in Flight: smoke over the panel at the start on Easy, cleared by the golden
// actions; the window and the door are optional rows.
const FLIGHT_ROW = 'fire.elec-fire-flight';

/** AVIONIC MASTER off, ELECT. MASTER off, CIRCULATING AIR fresh, the ECS shut-off pulled. */
async function flightGolden(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-hit="sw.av_master"]'), hasTouch);
  await expect(control(page, 'sw.av_master')).toHaveAttribute('data-state', 'off');
  await activate(page.locator('[data-hit="sw.elect_master"]'), hasTouch);
  await expect(control(page, 'sw.elect_master')).toHaveAttribute('data-state', 'off');
  await activate(page.locator('[data-detent="lv.env_circ:fresh"]'), hasTouch);
  await expect(control(page, 'lv.env_circ')).toHaveAttribute('data-state', 'fresh');
  await activate(page.locator('[data-detent="lv.ecs_shutoff:pulled"]'), hasTouch);
  await expect(control(page, 'lv.ecs_shutoff')).toHaveAttribute('data-state', 'pulled');
}

test('@hooks Electrical Fire in Flight: smoke over the cruise scene from the start, the golden run clears it and grades PASS', async ({
  page,
  hasTouch,
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  await startScenario(page, hasTouch, FLIGHT_ROW, 'easy');
  await expect(page.locator(scene('cruise'))).toHaveCount(1);
  await expect(page.locator(SMOKE)).toHaveCount(1);
  await expect(control(page, 'lv.env_circ')).toHaveAttribute('data-state', 'recirc');
  // The aircraft flies: the PFD keeps the static airspeed.
  await expect(page.locator(READOUT)).toHaveText('140');

  await flightGolden(page, hasTouch);
  await expect(page.locator(SMOKE)).toHaveCount(0, { timeout: CLEARS_WITHIN_MS });

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  for (const id of ['av_master_off', 'elect_master_off', 'circ_air_fresh', 'ecs_pulled']) {
    await expect(page.locator(`[data-step-id="${id}"]`)).toHaveAttribute('data-verdict', 'Done');
  }
  for (const id of ['windows_open', 'doors_open']) {
    await expect(page.locator(`[data-step-id="${id}"]`)).toHaveAttribute(
      'data-verdict',
      'Not done',
    );
  }
});

test('@hooks Electrical Fire in Flight: the optional door is credited when it opens, and a run without the masters grades FAIL', async ({
  page,
  hasTouch,
}, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  await startScenario(page, hasTouch, FLIGHT_ROW, 'easy');
  await openDoor(page, hasTouch);
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  await expect(page.locator('[data-step-id="doors_open"]')).toHaveAttribute('data-verdict', 'Done');
  await expect(page.locator('[data-step-id="elect_master_off"]')).toHaveAttribute(
    'data-verdict',
    'Missed',
  );
});

test('the ninth situation, Electrical Fire in Flight, stands on page 3 of CHOOSE SITUATION', async ({
  page,
  hasTouch,
}) => {
  const all = shippedScenarios();
  const rows = SESSION_LAYOUT.choose.maxRows;
  const index = all.findIndex((entry) => entry.row === FLIGHT_ROW);
  expect(index).toBeGreaterThanOrEqual(0);
  const pageOfRow = Math.floor(index / rows);
  await activate(page.locator('[data-session-hit="session.choose"]'), hasTouch);
  await page.waitForTimeout(500);
  for (let turned = 0; turned < pageOfRow; turned++) {
    await expect(page.locator(`[data-session-hit="session.row.${FLIGHT_ROW}"]`)).toHaveCount(0);
    await afterPairWindow(page);
    await activate(page.locator('[data-session-hit="session.next"]'), hasTouch);
  }
  await expect(page.locator(`[data-session-hit="session.row.${FLIGHT_ROW}"]`)).toHaveCount(1);
  expect(pageOfRow).toBe(2);
});
