import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { TERRAIN_HEIGHT_FT } from '../src/aircraft/da50rg/quantities';
import { parseScenario } from '../src/scenario/parse';
import type { Scenario } from '../src/scenario/schema';
import {
  furtherButton,
  furtherHit,
  pickFurther,
  quantityOf,
  shippedScenarios,
  startScenario,
} from './support/session';
import { activate, activateAt, afterPairWindow, leaveZoom, zoomIntoRegion } from './support/zoom';

// The emergency landing situations (Phase 9, plan 09-03): from the debrief of a fire situation the
// pilot continues into the printed landing checklist of booklet page 9, sees the field on the
// windscreen and the PFD, prepares on the panel and the sheet, and ends it by Procedure complete or
// at the field. Every title, id and row key is read from the shipped files in node (the landing
// situations are the shipped scenarios on a landing scene), never typed here. The spec runs against
// the production build; the titles with @hooks read the e2e window hook.

const SET = DA50RG_ENV.further;
const [atcMayday, , brief] = SET.ids('action');
const conductIds = SET.ids('conduct');
const emergency = conductIds[conductIds.length - 1];
const precautionary = conductIds[1];
if (
  atcMayday === undefined ||
  brief === undefined ||
  emergency === undefined ||
  precautionary === undefined
) {
  throw new Error('the aircraft lists too few further options');
}
/** The 400 ms input shield of a freshly shown overlay plus 100 ms of margin. */
const SHIELD_WAIT_MS = 500;

function scenarioOf(entry: { pack: string; file: string }): Scenario {
  const parsed = parseScenario(
    readFileSync(new URL(`../scenarios/${entry.pack}/${entry.file}.toon`, import.meta.url), 'utf8'),
  );
  if (!parsed.ok) throw new Error(`${entry.pack}/${entry.file} does not parse`);
  return parsed.value;
}

const ALL = shippedScenarios();
const LANDINGS = ALL.filter((entry) =>
  DA50RG_ENV.further.landingScenes.includes(scenarioOf(entry).scene ?? ''),
);
const LANDING = LANDINGS[0];
if (LANDING === undefined) throw new Error('no landing situation is shipped');
const LANDING_SCENARIO = scenarioOf(LANDING);

/** The rows that lead into the landing through a follow-on, from the shipped files. */
const SOURCES = ALL.filter((entry) =>
  Object.values(scenarioOf(entry).further?.follow_on ?? {}).some(
    (target) => target.pack === LANDING.pack && target.scenario === LANDING.id,
  ),
);
const ENGINE_FIRE = SOURCES.find((entry) => entry.id === 'eng-fire-in-flight');
const NO_ABORT = SOURCES.find((entry) => entry.id === 'takeoff-fire-no-abort');
const ELEC_FLIGHT = ALL.find((entry) => entry.id === 'elec-fire-flight');
if (ENGINE_FIRE === undefined || NO_ABORT === undefined || ELEC_FLIGHT === undefined) {
  throw new Error('the fire situations that lead into the landing are not shipped');
}

const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);
const scene = (id: string) => `[data-layer="windscreen"] [data-scene="${id}"]`;
const SVT = (id: string) => `[data-testid="pfd-attitude"] [data-svt-art="${id}"]`;

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

/** The FUEL selector from NORMAL to OFF: two taps on the zoomed pedestal. */
async function fuelValveOff(page: Page, hasTouch: boolean): Promise<void> {
  await zoomIntoRegion(page, hasTouch, 'pedestal');
  await tapFuelSelectorRight(page, hasTouch);
  await afterPairWindow(page);
  await tapFuelSelectorRight(page, hasTouch);
  await expect(control(page, 'sw.fuel_valve')).toHaveAttribute('data-state', 'off');
  await leaveZoom(page, hasTouch);
}

/** The engine fire in flight solved on the panel: fresh air, ECS shut-off, the three shutdown rows. */
async function solveEngineFire(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-detent="lv.env_circ:fresh"]'), hasTouch);
  await expect(control(page, 'lv.env_circ')).toHaveAttribute('data-state', 'fresh');
  await activate(page.locator('[data-detent="lv.ecs_shutoff:pulled"]'), hasTouch);
  await expect(control(page, 'lv.ecs_shutoff')).toHaveAttribute('data-state', 'pulled');
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'off');
  await fuelValveOff(page, hasTouch);
  await activate(page.locator('[data-hit="sw.elect_master"]'), hasTouch);
  await expect(control(page, 'sw.elect_master')).toHaveAttribute('data-state', 'off');
}

/** The graded rows of the landing file performed on the panel, in the order of the printed page. */
async function prepareLanding(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-detent="lv.power:p0"]'), hasTouch);
  await expect(control(page, 'lv.power')).toHaveAttribute('data-state', 'p0');
  await activate(page.locator('[data-hit="sw.engine_master"]'), hasTouch);
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'off');
  await fuelValveOff(page, hasTouch);
  // The restart attempt left both pumps on (the file's start): switch them off.
  await activate(page.locator('[data-hit="sw.emerg_fuel_pump"]'), hasTouch);
  await expect(control(page, 'sw.emerg_fuel_pump')).toHaveAttribute('data-state', 'off');
  await activate(page.locator('[data-hit="sw.fuel_trans"]'), hasTouch);
  await expect(control(page, 'sw.fuel_trans')).toHaveAttribute('data-state', 'off');
  // On final: doors, flaps.
  await zoomIntoRegion(page, hasTouch, 'door_arm');
  await activate(page.locator('[data-hit="lv.door_release"]'), hasTouch);
  await expect(control(page, 'lv.door_release')).toHaveAttribute('data-state', 'open');
  await leaveZoom(page, hasTouch);
  await activate(page.locator('[data-detent="lv.flaps:ldg"]'), hasTouch);
  await expect(control(page, 'lv.flaps')).toHaveAttribute('data-state', 'ldg');
  await activate(page.locator('[data-hit="sw.elect_master"]'), hasTouch);
  await expect(control(page, 'sw.elect_master')).toHaveAttribute('data-state', 'off');
}

async function complete(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief')).toBeVisible();
}

/** Presses the follow-on button of a debrief and starts the landing run (the level is kept). */
async function continueIntoLanding(page: Page, hasTouch: boolean): Promise<void> {
  await page.waitForTimeout(SHIELD_WAIT_MS);
  await activate(page.getByTestId('debrief-follow-on'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(page.getByTestId('briefing').getByRole('heading', { level: 2 })).toHaveText(
    LANDING_SCENARIO.title,
  );
  await expect(page.getByTestId('level-pick')).toHaveCount(0);
  await activate(page.getByTestId('briefing-start'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
}

test('@hooks ENGINE FIRE IN FLIGHT leads into the landing situation: the field, the footwell, the panel steps and PASS', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, `${ENGINE_FIRE.pack}.${ENGINE_FIRE.id}`, 'easy');
  await solveEngineFire(page, hasTouch);
  await pickFurther(page, hasTouch, [atcMayday, emergency]);
  await complete(page, hasTouch);
  // The first situation is graded on its own and keeps its verdict.
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  await expect(page.getByTestId('debrief-follow-on')).toBeVisible();

  await continueIntoLanding(page, hasTouch);
  expect(await page.evaluate(() => window.__panelSession?.scenarioId() ?? null)).toBe(LANDING.id);
  // The windscreen shows the approach scene and the PFD the same field.
  await expect(page.locator(scene(LANDING_SCENARIO.scene ?? ''))).toHaveCount(1);
  await expect(page.locator(SVT(LANDING_SCENARIO.scene ?? ''))).toHaveCount(1);
  await expect(page.locator('[data-part="field"]')).toHaveCount(1);
  expect(await quantityOf(page, 'altitude_ft')).toBeGreaterThan(TERRAIN_HEIGHT_FT);
  // The engine is dead from the first frame: the engine master is still on, the propeller stands still.
  await expect(control(page, 'sw.engine_master')).toHaveAttribute('data-state', 'on');
  expect(await quantityOf(page, 'rpm')).toBe(0);

  // The footwell offers the calls and the passengers and no conduct and no Avoid button.
  for (const id of SET.ids('action').filter((a) => !SET.avoidIds().includes(a))) {
    await expect(furtherHit(page, id)).toHaveCount(1);
  }
  for (const id of [...SET.ids('conduct'), ...SET.avoidIds()]) {
    await expect(furtherHit(page, id)).toHaveCount(0);
  }

  await prepareLanding(page, hasTouch);
  await pickFurther(page, hasTouch, [atcMayday, brief]);
  await expect(furtherButton(page, atcMayday)).toHaveAttribute('data-selected', 'true');
  await complete(page, hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  await expect(page.getByTestId('debrief-scenario')).toHaveText(LANDING_SCENARIO.title);
  const graded = LANDING_SCENARIO.procedure.flatMap((node) =>
    node.kind === 'group' ? node.steps.map((step) => step.id) : [],
  );
  expect(graded.length).toBeGreaterThan(0);
  for (const id of graded) {
    await expect(page.locator(`[data-step-id="${id}"]`)).toHaveAttribute('data-verdict', 'Done');
  }
  await expect(page.getByTestId('debrief-further-row').first()).toBeVisible();
  // The finish was not reached: the pilot pressed Procedure complete, so no finish line shows.
  await expect(page.getByTestId('debrief-finish')).toHaveCount(0);
  // The decision to land is made, so no further follow-on is offered from the landing itself.
  await expect(page.getByTestId('debrief-follow-on')).toHaveCount(0);
});

test('@hooks T/O FIRE NO ABORT leads into the same landing situation and a prepared pilot passes', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, `${NO_ABORT.pack}.${NO_ABORT.id}`, 'easy');
  await pickFurther(page, hasTouch, [emergency]);
  await complete(page, hasTouch);
  await continueIntoLanding(page, hasTouch);
  expect(await page.evaluate(() => window.__panelSession?.scenarioId() ?? null)).toBe(LANDING.id);
  await prepareLanding(page, hasTouch);
  await complete(page, hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
});

test('a pilot who does nothing fails when the aircraft reaches the field, and the debrief says so', async ({
  page,
  hasTouch,
}) => {
  // The glide lasts about a hundred seconds (virtual time follows real frames), so the default limit is far too short.
  test.setTimeout(240_000);
  await startScenario(page, hasTouch, `${LANDING.pack}.${LANDING.id}`, 'easy');
  await expect(page.locator(scene(LANDING_SCENARIO.scene ?? ''))).toHaveCount(1);
  // The run ends by itself: the debrief opens without a press.
  await expect(page.getByTestId('debrief')).toBeVisible({ timeout: 200_000 });
  await expect(page.getByTestId('debrief-finish')).toHaveText(LANDING_SCENARIO.finish?.text ?? '');
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  const critical = LANDING_SCENARIO.procedure.flatMap((node) =>
    node.kind === 'group'
      ? node.steps.filter((step) => step.severity === 'critical').map((step) => step.id)
      : [],
  );
  expect(critical.length).toBeGreaterThan(0);
  for (const id of critical) {
    await expect(page.locator(`[data-step-id="${id}"]`)).toHaveAttribute('data-verdict', 'Missed');
  }
  // A landing situation offers no follow-on of its own.
  await expect(page.getByTestId('debrief-follow-on')).toHaveCount(0);
});

test('a run that did not pick the emergency landing shows no follow-on button', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, `${ENGINE_FIRE.pack}.${ENGINE_FIRE.id}`, 'easy');
  await complete(page, hasTouch);
  await expect(page.getByTestId('debrief-follow-on')).toHaveCount(0);
});

test('ELEC FIRE FLIGHT accepts the precautionary landing and offers no follow-on', async ({
  page,
  hasTouch,
}) => {
  const section = scenarioOf(ELEC_FLIGHT).further;
  expect(section?.conduct === 'none' ? [] : section?.conduct.accept).toEqual([precautionary]);
  expect(section?.follow_on).toBeUndefined();
  await startScenario(page, hasTouch, `${ELEC_FLIGHT.pack}.${ELEC_FLIGHT.id}`, 'easy');
  await pickFurther(page, hasTouch, [atcMayday, precautionary]);
  await complete(page, hasTouch);
  await expect(page.getByTestId('debrief-follow-on')).toHaveCount(0);
  await expect(page.getByTestId('debrief-retry')).toBeVisible();
});
