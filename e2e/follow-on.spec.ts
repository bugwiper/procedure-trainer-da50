import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { parseScenario } from '../src/scenario/parse';
import { followOnButton, pickFurther, startScenario } from './support/session';
import { activate } from './support/zoom';

// SES-09 (phase 09, plans 09-02 to 09-05): the debrief offers buttons that continue with the
// situations a scenario declares as its follow-on, after PASS or FAIL and whatever conduct was selected
// at the end of the run (R-13): one
// button per target on Easy and Medium (the targets are read from the shipped Engine Fire file in
// node, the texts from the aircraft data), one generic button on Realistic (the landing flows with the
// seeded draw are in e2e/landing.spec.ts). The landing flow itself is in e2e/landing.spec.ts too.

const FIRE_FILE = 'scenarios/engine/eng-fire-in-flight.toon';
const FIRE_ROW = 'engine.eng-fire-in-flight';
const NO_FOLLOW_ON_ROW = 'fire.elec-fire-flight';
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

const fileOf = (pack: string, name: string) =>
  new URL(`../scenarios/${pack}/${name}.toon`, import.meta.url);
const titleOf = (target: { pack: string; scenario: string }): string => {
  const parsed = parseScenario(readFileSync(fileOf(target.pack, target.scenario), 'utf8'));
  if (!parsed.ok) throw new Error(`${target.scenario} does not parse`);
  return parsed.value.title;
};

/** The targets the shipped Engine Fire file names for the emergency landing, in the file's order. */
function shippedTargets(): readonly { pack: string; scenario: string; weight: number }[] {
  const parsed = parseScenario(readFileSync(new URL(`../${FIRE_FILE}`, import.meta.url), 'utf8'));
  if (!parsed.ok) throw new Error('the Engine Fire file does not parse');
  const list = parsed.value.further?.follow_on?.[emergency];
  if (list === undefined) throw new Error('the Engine Fire file names no follow-on');
  return list;
}
const TARGETS = shippedTargets();
const nameOf = (target: { pack: string; scenario: string }): string =>
  `${target.pack}/${target.scenario}`;
/** The button text the aircraft data gives one target (the generic text where it has no entry). */
const textOf = (target: { pack: string; scenario: string }) =>
  SET.followOnTarget(emergency, target) ?? OFFER;

async function finish(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

for (const level of ['easy', 'medium'] as const) {
  test(`@hooks the debrief offers one button per target after the conduct was chosen and each opens its own follow-on at ${level}`, async ({
    page,
    hasTouch,
  }) => {
    expect(TARGETS.length).toBeGreaterThan(0);
    // Each target is tried from a fresh run: the button leads to the briefing of its own target.
    for (const target of TARGETS) {
      await startScenario(page, hasTouch, FIRE_ROW, level);
      await pickFurther(page, hasTouch, [emergency]);
      await finish(page, hasTouch);
      const firstResult = await page.getByTestId('debrief-result').textContent();
      const firstReasons = await page.getByTestId('debrief-reason').allTextContents();

      // One button per target between Retry and Next situation, in the file's order, with the text of
      // the aircraft data (title as aria-label and tooltip), and the old note is gone.
      await expect(followOnButton(page)).toHaveCount(TARGETS.length);
      for (const [index, entry] of TARGETS.entries()) {
        const button = followOnButton(page).nth(index);
        await expect(button).toBeVisible();
        await expect(button).toHaveAttribute('data-follow-on', nameOf(entry));
        await expect(button).toHaveText(textOf(entry).label);
        await expect(button).toHaveAttribute('aria-label', textOf(entry).title);
        await expect(button).toHaveAttribute('title', textOf(entry).title);
      }
      await expect(page.getByTestId('debrief-further-note')).toHaveCount(0);
      const order = await page
        .getByTestId('debrief-modal')
        .locator('button[data-testid^="debrief-"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
      expect(order).toEqual([
        'debrief-retry',
        ...TARGETS.map(() => 'debrief-follow-on'),
        'debrief-next',
        'debrief-back',
      ]);

      await page.waitForTimeout(SHIELD_WAIT_MS);
      await activate(followOnButton(page, nameOf(target)), hasTouch);
      // The same start as Next situation: the briefing of the target, the level kept, no level card.
      await expect(page.getByTestId('briefing')).toBeVisible();
      await expect(page.getByTestId('briefing').getByRole('heading', { level: 2 })).toHaveText(
        titleOf(target),
      );
      await expect(page.getByTestId('level-pick')).toHaveCount(0);
      await expect(page.getByTestId('debrief-result')).toHaveCount(0);
      await activate(page.getByTestId('briefing-start'), hasTouch);
      await expect(page.getByTestId('procedure-complete')).toBeVisible();
      expect(await page.evaluate(() => window.__panelSession?.scenarioId() ?? null)).toBe(
        target.scenario,
      );
      // Nothing of the first run is carried over: the second debrief is its own grade.
      await finish(page, hasTouch);
      await expect(page.getByTestId('debrief-level')).toHaveText(`Level: ${LEVEL_NAMES[level]}`);
      await expect(page.getByTestId('debrief-scenario')).toHaveText(titleOf(target));
      expect(firstResult).toBe('FAIL');
      expect(firstReasons.length).toBeGreaterThan(0);
      // The level is kept and nothing was drawn: Easy and Medium record no follow-on seed.
      expect(await page.evaluate(() => window.__panelSession?.followOn() ?? null)).toBeNull();
      await page.reload();
      await expect(page.getByTestId('panel')).toBeVisible();
    }
  });
}

test('@hooks Retry inside a follow-on repeats the chosen follow-on', async ({ page, hasTouch }) => {
  const target = TARGETS.at(-1);
  if (target === undefined) throw new Error('no follow-on target');
  await startScenario(page, hasTouch, FIRE_ROW);
  await pickFurther(page, hasTouch, [emergency]);
  await finish(page, hasTouch);
  await page.waitForTimeout(SHIELD_WAIT_MS);
  await activate(followOnButton(page, nameOf(target)), hasTouch);
  await expect(page.getByTestId('briefing')).toBeVisible();
  await activate(page.getByTestId('briefing-start'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  await finish(page, hasTouch);
  await page.waitForTimeout(SHIELD_WAIT_MS);
  await activate(page.getByTestId('debrief-retry'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  expect(await page.evaluate(() => window.__panelSession?.scenarioId() ?? null)).toBe(
    target.scenario,
  );
});

test('@hooks the buttons are offered whatever conduct is selected at the end, after FAIL and after PASS (R-13)', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, FIRE_ROW);
  // The preselected conduct (continue to destination) stays and the run FAILs: the scenario declares
  // a follow-on, so the debrief asks whether to continue with exactly this next situation.
  await finish(page, hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  await expect(followOnButton(page)).toHaveCount(TARGETS.length);
  await expect(page.getByTestId('debrief-further-note')).toHaveCount(0);
  await expect(page.getByTestId('debrief-retry')).toBeVisible();
  await expect(page.getByTestId('debrief-next')).toBeVisible();

  await page.waitForTimeout(SHIELD_WAIT_MS);
  await activate(page.getByTestId('debrief-retry'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  // Another conduct selected last: the offer does not depend on it.
  await pickFurther(page, hasTouch, [emergency, carryOn]);
  await finish(page, hasTouch);
  await expect(followOnButton(page)).toHaveCount(TARGETS.length);
});

test('@hooks no button is offered where the scenario names no follow-on, and the note stays true', async ({
  page,
  hasTouch,
}) => {
  // ELEC FIRE FLIGHT names no follow-on (the engine keeps running, owner answer 2026-11-03): even the
  // emergency landing picked there offers no button, and the note of the conduct shows.
  await startScenario(page, hasTouch, NO_FOLLOW_ON_ROW);
  await pickFurther(page, hasTouch, [emergency]);
  await finish(page, hasTouch);
  await expect(followOnButton(page)).toHaveCount(0);
  await expect(page.getByTestId('debrief-further-note')).toHaveText(
    SET.option(emergency)?.debriefNote ?? '',
  );
});
