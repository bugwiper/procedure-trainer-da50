import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { parseScenario } from '../src/scenario/parse';
import { pickFurther, startScenario } from './support/session';
import { activate } from './support/zoom';

// SES-09 (phase 09, plan 09-02): the debrief offers a button that continues with the situation a
// scenario names as the follow-on of the conduct selected at the end of the run. No shipped file
// declares a follow-on before plan 09-03, so the spec patches the text of the shipped engine pack on
// its way into the page: it adds a follow_on map to the Engine Fire file that points at the Engine Oil
// Temperature file (an existing situation, so the real pack seam, the real session and the real debrief
// are exercised). Once a shipped file declares its own follow-on, the patch steps aside and the
// target is read from that file in node. The button text comes from the aircraft data.

const FIRE_FILE = 'scenarios/engine/eng-fire-in-flight.toon';
const FIRE_ROW = 'engine.eng-fire-in-flight';
const TARGET = { pack: 'engine', scenario: 'eng-oil-temp-green' };
/** The 400 ms input shield of a freshly shown overlay plus 100 ms of margin. */
const SHIELD_WAIT_MS = 500;
const LEVEL_NAMES = { easy: 'Easy', medium: 'Medium' } as const;
const SET = DA50RG_ENV.further;
const [firstConduct, , lastConduct] = SET.ids('conduct');
if (firstConduct === undefined || lastConduct === undefined) {
  throw new Error('short conduct list');
}
const carryOn: string = firstConduct;
const emergency: string = lastConduct;
const OFFER = SET.option(emergency)?.followOn;
if (OFFER === undefined) throw new Error('the aircraft gives the emergency landing no follow-on');

const fileOf = (name: string) => new URL(`../scenarios/engine/${name}.toon`, import.meta.url);
const titleOf = (name: string): string => {
  const parsed = parseScenario(readFileSync(fileOf(name), 'utf8'));
  if (!parsed.ok) throw new Error(`${name} does not parse`);
  return parsed.value.title;
};

/** The target of the follow-on: the shipped one when the file declares it, else the patched one. */
function shippedTarget(): { pack: string; scenario: string } | null {
  const parsed = parseScenario(readFileSync(new URL(`../${FIRE_FILE}`, import.meta.url), 'utf8'));
  if (!parsed.ok) throw new Error('the Engine Fire file does not parse');
  return parsed.value.further?.follow_on?.[emergency] ?? null;
}
const TARGET_NOW = shippedTarget() ?? TARGET;

/** Adds the follow-on to the Engine Fire text in the engine pack chunk, unless the file has one. */
async function patchPack(page: Page): Promise<void> {
  if (shippedTarget() !== null) return;
  await page.route('**/pack-engine-*.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const line = 'accept[1]: conduct_emergency\n';
    if (!body.includes(line)) throw new Error('the Engine Fire conduct line is not in the pack');
    const patched = body.replace(
      line,
      `${line}  follow_on:\n    ${emergency}:\n      pack: ${TARGET.pack}\n      scenario: ${TARGET.scenario}\n`,
    );
    await route.fulfill({ response, body: patched });
  });
}

async function finish(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

for (const level of ['easy', 'medium'] as const) {
  test(`@hooks the debrief offers Emergency landing after the conduct was chosen and it opens the follow-on at ${level}`, async ({
    page,
    hasTouch,
  }) => {
    await patchPack(page);
    await startScenario(page, hasTouch, FIRE_ROW, level);
    await pickFurther(page, hasTouch, [emergency]);
    await finish(page, hasTouch);
    const firstResult = await page.getByTestId('debrief-result').textContent();
    const firstReasons = await page.getByTestId('debrief-reason').allTextContents();

    // The button stands between Retry and Next situation, with the label of the aircraft data, its
    // title as aria-label and tooltip, and the old note ("not trained yet") is gone.
    const button = page.getByTestId('debrief-follow-on');
    await expect(button).toBeVisible();
    await expect(button).toHaveText(OFFER.label);
    await expect(button).toHaveAttribute('aria-label', OFFER.title);
    await expect(button).toHaveAttribute('title', OFFER.title);
    await expect(page.getByTestId('debrief-further-note')).toHaveCount(0);
    const order = await page
      .getByTestId('debrief-modal')
      .locator('button[data-testid^="debrief-"]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    expect(order).toEqual(['debrief-retry', 'debrief-follow-on', 'debrief-next', 'debrief-back']);

    await page.waitForTimeout(SHIELD_WAIT_MS);
    await activate(button, hasTouch);
    // The same start as Next situation: the briefing of the target, the level kept, no level card.
    await expect(page.getByTestId('briefing')).toBeVisible();
    await expect(page.getByTestId('briefing').getByRole('heading', { level: 2 })).toHaveText(
      titleOf(TARGET_NOW.scenario),
    );
    await expect(page.getByTestId('level-pick')).toHaveCount(0);
    await expect(page.getByTestId('debrief-result')).toHaveCount(0);
    await activate(page.getByTestId('briefing-start'), hasTouch);
    await expect(page.getByTestId('procedure-complete')).toBeVisible();
    expect(await page.evaluate(() => window.__panelSession?.scenarioId() ?? null)).toBe(
      TARGET_NOW.scenario,
    );
    // Nothing of the first run is carried over: the second debrief is its own grade.
    await finish(page, hasTouch);
    await expect(page.getByTestId('debrief-level')).toHaveText(`Level: ${LEVEL_NAMES[level]}`);
    await expect(page.getByTestId('debrief-scenario')).toHaveText(titleOf(TARGET_NOW.scenario));
    expect(firstResult).toBe('FAIL');
    expect(firstReasons.length).toBeGreaterThan(0);
  });
}

test('@hooks Retry inside the follow-on repeats the follow-on', async ({ page, hasTouch }) => {
  await patchPack(page);
  await startScenario(page, hasTouch, FIRE_ROW);
  await pickFurther(page, hasTouch, [emergency]);
  await finish(page, hasTouch);
  await page.waitForTimeout(SHIELD_WAIT_MS);
  await activate(page.getByTestId('debrief-follow-on'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeVisible();
  await activate(page.getByTestId('briefing-start'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  await finish(page, hasTouch);
  await page.waitForTimeout(SHIELD_WAIT_MS);
  await activate(page.getByTestId('debrief-retry'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  expect(await page.evaluate(() => window.__panelSession?.scenarioId() ?? null)).toBe(
    TARGET_NOW.scenario,
  );
});

test('@hooks no button is offered when another conduct is selected at the end', async ({
  page,
  hasTouch,
}) => {
  await patchPack(page);
  await startScenario(page, hasTouch, FIRE_ROW);
  // The default (continue to destination) stays: the follow-on belongs to the emergency landing only.
  await finish(page, hasTouch);
  await expect(page.getByTestId('debrief-follow-on')).toHaveCount(0);
  await expect(page.getByTestId('debrief-retry')).toBeVisible();
  await expect(page.getByTestId('debrief-next')).toBeVisible();

  await page.waitForTimeout(SHIELD_WAIT_MS);
  await activate(page.getByTestId('debrief-retry'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  await pickFurther(page, hasTouch, [emergency, carryOn]);
  await finish(page, hasTouch);
  await expect(page.getByTestId('debrief-follow-on')).toHaveCount(0);
});

test('@hooks no button is offered where the scenario names no follow-on, and the note stays true', async ({
  page,
  hasTouch,
}) => {
  test.skip(
    shippedTarget() !== null,
    'the shipped Engine Fire file declares a follow-on of its own',
  );
  // No patch: the shipped file has no follow_on map.
  await startScenario(page, hasTouch, FIRE_ROW);
  await pickFurther(page, hasTouch, [emergency]);
  await finish(page, hasTouch);
  await expect(page.getByTestId('debrief-follow-on')).toHaveCount(0);
  await expect(page.getByTestId('debrief-further-note')).toHaveText(
    SET.option(emergency)?.debriefNote ?? '',
  );
});
