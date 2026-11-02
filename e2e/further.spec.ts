import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { offersConduct } from '../src/engine/further';
import { parseScenario } from '../src/scenario/parse';
import {
  furtherButton,
  furtherHit,
  pickFurther,
  shippedScenarios,
  startRealistic,
  startScenario,
  toggleFurther,
} from './support/session';
import { activate, sessionButtonCoverage, zoomIntoRegion } from './support/zoom';

// SES-05 (phase 07, plans 07-02 and 07-05): six toggle buttons in the pilot footwell; every press is
// recorded with the run time and the on flag, the state at the end is graded with the panel actions
// when Procedure complete is pressed and shown in the debrief with the role and verdict words. Texts
// come from the aircraft data in node.

const FIRE_ROW = 'engine.eng-fire-in-flight';
const GROUND_ROW = 'fire.eng-fire-ground';
const OIL_ROW = 'engine.eng-oil-temp-green';
const SET = DA50RG_ENV.further;
const textOf = (id: string): string => SET.option(id)?.text ?? id;
const [MAYDAY] = SET.ids('action');
if (MAYDAY === undefined) throw new Error('the aircraft lists no action');

/** Whether the shipped file of a row declares a flight conduct, read in node from the scenario file. */
function conductOffered(row: string): boolean {
  const entry = shippedScenarios().find((e) => e.row === row);
  if (entry === undefined) throw new Error(`no shipped scenario ${row}`);
  const text = readFileSync(
    new URL(`../scenarios/${entry.pack}/${entry.file}.toon`, import.meta.url),
    'utf8',
  );
  const parsed = parseScenario(text);
  if (!parsed.ok) throw new Error(`${row} does not parse`);
  return offersConduct(parsed.value.further);
}

const ACTION_IDS = SET.ids('action');
const CONDUCT_IDS = SET.ids('conduct');
const selectedIds = async (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    Array.from(
      document.querySelectorAll('[data-session-button^="further."][data-selected="true"]'),
    ).map((el) => (el.getAttribute('data-session-button') ?? '').slice('further.'.length)),
  );

const row = (page: Page, id: string) => page.locator(`[data-further-id="${id}"]`);

async function finish(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief')).toBeVisible();
}

test('the MAYDAY button toggles in the footwell and the final state is graded: Done, and no missed-action reason', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  await expect(furtherButton(page, MAYDAY)).toHaveAttribute('data-selected', 'false');
  await expect(furtherButton(page, MAYDAY)).toHaveAttribute('aria-pressed', 'false');
  await pickFurther(page, hasTouch, [MAYDAY]);
  await expect(furtherButton(page, MAYDAY)).toHaveAttribute('aria-pressed', 'true');
  // Nothing ended the run and no dialog opened: the run goes on until Procedure complete.
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  await expect(page.getByTestId('debrief')).toHaveCount(0);
  await finish(page, hasTouch);

  await expect(page.getByTestId('debrief-further-heading')).toBeVisible();
  const mayday = row(page, MAYDAY);
  await expect(mayday).toContainText(textOf(MAYDAY));
  await expect(mayday).toHaveAttribute('data-verdict', 'Done');
  await expect(
    page.getByTestId('debrief-reason').filter({ hasText: /further action/ }),
  ).toHaveCount(0);
});

test('a second press switches MAYDAY off again: the debrief says Missed and gives the reason line', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  await pickFurther(page, hasTouch, [MAYDAY]);
  await toggleFurther(page, hasTouch, MAYDAY);
  await expect(furtherButton(page, MAYDAY)).toHaveAttribute('data-selected', 'false');
  await finish(page, hasTouch);

  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  await expect(row(page, MAYDAY)).toHaveAttribute('data-verdict', 'Missed');
  await expect(
    page.getByTestId('debrief-reason').filter({ hasText: /required further action/ }),
  ).toHaveCount(1);
});

test('zoomed into the footwell area during a run, every button is at least 44 px and the Full panel button covers none', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  await zoomIntoRegion(page, hasTouch, 'further_area');
  await expect(page.getByTestId('zoom-out')).toBeVisible();
  expect(await sessionButtonCoverage(page), 'footwell buttons under Full panel').toEqual([]);
  const sizes = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-session-hit^="further."]')).map(
      (el): [string, number, number] => {
        const r = el.getBoundingClientRect();
        return [el.getAttribute('data-session-hit') ?? '', r.width, r.height];
      },
    ),
  );
  expect(sizes.map(([id]) => id).sort()).toEqual(SET.options.map((o) => `further.${o.id}`).sort());
  for (const [id, w, h] of sizes) {
    expect(w, `${id} wide`).toBeGreaterThanOrEqual(44);
    expect(h, `${id} high`).toBeGreaterThanOrEqual(44);
  }
});

test('a flight scenario draws all six buttons and the ground scenario only the actions', async ({
  page,
  hasTouch,
}) => {
  expect(conductOffered(FIRE_ROW)).toBe(true);
  expect(conductOffered(GROUND_ROW)).toBe(false);
  await page.goto('./');
  // The plate is on the free panel, the buttons are not.
  await expect(page.locator('[data-plate="further-pad"]')).toHaveCount(1);
  await expect(page.locator('[data-session-hit^="further."]')).toHaveCount(0);
  await startScenario(page, hasTouch, FIRE_ROW);
  await expect(page.locator('[data-session-hit^="further."]')).toHaveCount(SET.options.length);
  for (const option of SET.options) {
    await expect(furtherButton(page, option.id)).toContainText(option.label ?? option.text);
  }
});

test('the ground scenario draws only the actions and no flight conduct', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await startScenario(page, hasTouch, GROUND_ROW);
  await expect(page.locator('[data-session-hit^="further."]')).toHaveCount(ACTION_IDS.length);
  for (const id of ACTION_IDS) await expect(furtherHit(page, id)).toHaveCount(1);
  for (const id of CONDUCT_IDS) await expect(furtherHit(page, id)).toHaveCount(0);
});

test('MAYDAY and PAN PAN PAN can both be selected, independently of each other and of the passengers', async ({
  page,
  hasTouch,
}) => {
  const [mayday, panPan, passengers] = [MAYDAY, ACTION_IDS[1], ACTION_IDS[2]];
  if (panPan === undefined || passengers === undefined) throw new Error('short list');
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  await pickFurther(page, hasTouch, [mayday, panPan, passengers]);
  expect((await selectedIds(page)).sort()).toEqual([mayday, panPan, passengers].sort());
  await toggleFurther(page, hasTouch, panPan);
  await expect(furtherButton(page, panPan)).toHaveAttribute('data-selected', 'false');
  await expect(furtherButton(page, mayday)).toHaveAttribute('data-selected', 'true');
  await expect(furtherButton(page, passengers)).toHaveAttribute('data-selected', 'true');
});

test('the conduct is a radio group: another press switches, a second press of the selected one clears', async ({
  page,
  hasTouch,
}) => {
  const [carryOn, precaution, emergency] = CONDUCT_IDS;
  if (carryOn === undefined || precaution === undefined || emergency === undefined) {
    throw new Error('short list');
  }
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  await pickFurther(page, hasTouch, [carryOn]);
  await pickFurther(page, hasTouch, [emergency]);
  expect(await selectedIds(page)).toEqual([emergency]);
  await toggleFurther(page, hasTouch, emergency);
  expect(await selectedIds(page)).toEqual([]);
  await pickFurther(page, hasTouch, [precaution]);
  expect(await selectedIds(page)).toEqual([precaution]);
});

test('the debrief shows the picks of the conduct in order and the final one counts, with the note of the emergency landing', async ({
  page,
  hasTouch,
}) => {
  const [carryOn, , emergency] = CONDUCT_IDS;
  if (carryOn === undefined || emergency === undefined) throw new Error('short list');
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  await pickFurther(page, hasTouch, [MAYDAY, carryOn]);
  await pickFurther(page, hasTouch, [emergency]);
  await finish(page, hasTouch);
  await expect(row(page, 'conduct')).toHaveAttribute('data-verdict', 'Right');
  await expect(page.getByTestId('debrief-further-picks')).toContainText(
    `${textOf(carryOn)}, then ${textOf(emergency)}`,
  );
  await expect(page.getByTestId('debrief-further-note')).toHaveText(
    SET.option(emergency)?.debriefNote ?? '',
  );
});

test('a conduct that was selected and then cleared ends FAIL with the conduct reason, shown as Missing with its pick', async ({
  page,
  hasTouch,
}) => {
  const emergency = CONDUCT_IDS[2];
  if (emergency === undefined) throw new Error('short list');
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  await pickFurther(page, hasTouch, [MAYDAY, emergency]);
  await toggleFurther(page, hasTouch, emergency);
  await finish(page, hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  await expect(row(page, 'conduct')).toHaveAttribute('data-verdict', 'Missing');
  await expect(page.getByTestId('debrief-further-picks')).toContainText(textOf(emergency));
  await expect(
    page.getByTestId('debrief-reason').filter({ hasText: 'The flight decision was missing.' }),
  ).toHaveCount(1);
  await expect(page.getByTestId('debrief-further-note')).toHaveCount(0);
});

test('a conduct that was wrong and was switched to the right option passes with the panel actions', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await startScenario(page, hasTouch, OIL_ROW);
  // The golden panel actions of e2e/scenario.spec.ts: POWER to the 50 % marker, COWL FLAP open.
  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(page.locator('[data-control-id="lv.power"]')).toHaveAttribute('data-state', 'p50');
  await activate(page.locator('[data-detent="lv.cowl_flap:open"]'), hasTouch);
  await expect(page.locator('[data-control-id="lv.cowl_flap"]')).toHaveAttribute(
    'data-state',
    'open',
  );
  const [carryOn, precaution] = CONDUCT_IDS;
  if (carryOn === undefined || precaution === undefined) throw new Error('short list');
  await pickFurther(page, hasTouch, [carryOn]);
  await pickFurther(page, hasTouch, [precaution]);
  await finish(page, hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  await expect(row(page, 'conduct')).toHaveAttribute('data-verdict', 'Right');
});

test('@hooks Realistic: a press before the onset changes nothing, after the onset the buttons work', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await startRealistic(page, hasTouch, FIRE_ROW);
  const before = await page.evaluate(() => {
    const host = globalThis as unknown as {
      __panelSession?: { now(): number | null; onset(): { at: number } | null };
    };
    const now = host.__panelSession?.now() ?? Number.NaN;
    return now < (host.__panelSession?.onset()?.at ?? 0);
  });
  expect(before, 'the run is still before the onset when the first press is made').toBe(true);
  // Buttons are drawn alike before the onset (nothing gives the failure away) and ignore the press.
  await expect(page.locator('[data-session-hit^="further."]')).toHaveCount(SET.options.length);
  await toggleFurther(page, hasTouch, MAYDAY);
  await page.waitForTimeout(200);
  expect(await selectedIds(page)).toEqual([]);
  await page.waitForFunction(() => {
    const host = globalThis as unknown as {
      __panelSession?: { now(): number | null; onset(): { at: number } | null };
    };
    const now = host.__panelSession?.now() ?? null;
    const onset = host.__panelSession?.onset() ?? null;
    return now !== null && onset !== null && now >= onset.at;
  });
  await pickFurther(page, hasTouch, [MAYDAY]);
  expect(await selectedIds(page)).toEqual([MAYDAY]);
});
