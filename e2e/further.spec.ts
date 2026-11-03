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
  pressGreyedFurther,
  shippedScenarios,
  startRealistic,
  startScenario,
  toggleFurther,
} from './support/session';
import { activate, sessionButtonCoverage, zoomIntoRegion } from './support/zoom';

// SES-05 (phase 07, plans 07-02, 07-05 and 07-06): nine toggle buttons in the pilot footwell; every press is
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
const AVOID_IDS = SET.avoidIds();
/** The actions that are drawn in every run: the calls and the passengers, no Avoid action. */
const CALL_IDS = ACTION_IDS.filter((id) => !AVOID_IDS.includes(id));
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

test('a flight scenario draws all nine buttons and the ground scenario only the calls and the passengers', async ({
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
    for (const line of (option.label ?? option.text).split('\n')) {
      await expect(furtherButton(page, option.id)).toContainText(line);
    }
  }
});

test('the ground scenario draws only the calls and the passengers, no flight conduct and no Avoid action, nothing is preselected and the middle row stays in place', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  const flightBox = await furtherHit(page, MAYDAY).boundingBox();
  await page.goto('./');
  await startScenario(page, hasTouch, GROUND_ROW);
  await expect(page.locator('[data-session-hit^="further."]')).toHaveCount(CALL_IDS.length);
  for (const id of CALL_IDS) await expect(furtherHit(page, id)).toHaveCount(1);
  for (const id of [...CONDUCT_IDS, ...AVOID_IDS])
    await expect(furtherHit(page, id)).toHaveCount(0);
  expect(await selectedIds(page)).toEqual([]);
  await expect(page.locator('[data-shell="further-title"]')).toHaveText('FURTHER ACTIONS');
  const groundBox = await furtherHit(page, MAYDAY).boundingBox();
  expect(groundBox?.x).toBeCloseTo(flightBox?.x ?? Number.NaN, 0);
  expect(groundBox?.y).toBeCloseTo(flightBox?.y ?? Number.NaN, 0);
});

test('the three Avoid buttons toggle independently, start unselected and are recorded like every toggle', async ({
  page,
  hasTouch,
}) => {
  const [avoidImc, avoidNvfr, avoidIcing] = AVOID_IDS;
  if (avoidImc === undefined || avoidNvfr === undefined || avoidIcing === undefined) {
    throw new Error('no avoid actions');
  }
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  // Unselected at the start, labelled by aircraft data.
  for (const id of AVOID_IDS) {
    await expect(furtherButton(page, id)).toHaveAttribute('data-selected', 'false');
    await expect(furtherButton(page, id)).toContainText(SET.option(id)?.label ?? '');
  }
  await pickFurther(page, hasTouch, [avoidNvfr]);
  expect((await selectedIds(page)).sort()).toEqual([avoidNvfr, SET.defaultConduct].sort());
  await pickFurther(page, hasTouch, [avoidImc, avoidIcing]);
  await toggleFurther(page, hasTouch, avoidNvfr);
  await expect(furtherButton(page, avoidNvfr)).toHaveAttribute('data-selected', 'false');
  expect((await selectedIds(page)).sort()).toEqual(
    [avoidIcing, avoidImc, SET.defaultConduct].sort(),
  );
  // They neither end the run nor change the conduct.
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  await expect(furtherButton(page, SET.defaultConduct)).toHaveAttribute('aria-pressed', 'true');
  // Listed in the debrief only when picked (the two that stayed on), never as a reason.
  await finish(page, hasTouch);
  await expect(row(page, avoidImc)).toHaveAttribute('data-verdict', 'Done');
  await expect(row(page, avoidIcing)).toHaveAttribute('data-verdict', 'Done');
  await expect(row(page, avoidNvfr)).toHaveCount(0);
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
  // The preselected Continue to destination is selected besides the three actions.
  expect((await selectedIds(page)).sort()).toEqual(
    [mayday, panPan, passengers, SET.defaultConduct].sort(),
  );
  await toggleFurther(page, hasTouch, panPan);
  await expect(furtherButton(page, panPan)).toHaveAttribute('data-selected', 'false');
  await expect(furtherButton(page, mayday)).toHaveAttribute('data-selected', 'true');
  await expect(furtherButton(page, passengers)).toHaveAttribute('data-selected', 'true');
});

test('Continue to destination is preselected without a press; the conduct is a radio group that cannot be cleared', async ({
  page,
  hasTouch,
}) => {
  const [carryOn, precaution, emergency] = CONDUCT_IDS;
  if (carryOn === undefined || precaution === undefined || emergency === undefined) {
    throw new Error('short list');
  }
  expect(SET.defaultConduct).toBe(carryOn);
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  // Highlighted from the start, with no press and no other button selected.
  expect(await selectedIds(page)).toEqual([carryOn]);
  await expect(furtherButton(page, carryOn)).toHaveAttribute('aria-pressed', 'true');
  // A press of the selected one is no change.
  await toggleFurther(page, hasTouch, carryOn);
  expect(await selectedIds(page)).toEqual([carryOn]);
  // Another press switches, a press of the new selection keeps it: exactly one is selected always.
  await toggleFurther(page, hasTouch, emergency);
  expect(await selectedIds(page)).toEqual([emergency]);
  await toggleFurther(page, hasTouch, emergency);
  expect(await selectedIds(page)).toEqual([emergency]);
  await toggleFurther(page, hasTouch, precaution);
  expect(await selectedIds(page)).toEqual([precaution]);
  await toggleFurther(page, hasTouch, carryOn);
  expect(await selectedIds(page)).toEqual([carryOn]);
});

test('the cluster has its headline and the rows of the owner: three conducts on top, passengers and the two ATC calls, then the Avoid actions', async ({
  page,
  hasTouch,
}) => {
  const [carryOn, precaution, emergency] = CONDUCT_IDS;
  const [mayday, panPan, passengers] = [MAYDAY, ACTION_IDS[1], ACTION_IDS[2]];
  const [avoidImc, avoidNvfr, avoidIcing] = AVOID_IDS;
  if (carryOn === undefined || precaution === undefined || emergency === undefined) {
    throw new Error('short list');
  }
  if (panPan === undefined || passengers === undefined) throw new Error('short list');
  if (avoidImc === undefined || avoidNvfr === undefined || avoidIcing === undefined) {
    throw new Error('no avoid actions');
  }
  await page.goto('./');
  // The headline is static plate art: it is there on the free panel, before any run.
  await expect(page.locator('[data-shell="further-title"]')).toHaveText('FURTHER ACTIONS');
  await startScenario(page, hasTouch, FIRE_ROW);
  await expect(page.locator('[data-shell="further-title"]')).toHaveText('FURTHER ACTIONS');
  // All boxes in one read, so a view that is still settling cannot split them.
  const read = await page.evaluate(
    (ids) => {
      const rectOf = (el: Element | null) => {
        if (el === null) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      };
      return {
        hits: ids.map((id) => [
          id,
          rectOf(document.querySelector(`[data-session-hit="further.${id}"]`)),
        ]),
        title: rectOf(document.querySelector('[data-shell="further-title"]')),
        plate: rectOf(document.querySelector('[data-plate="further-pad"]')),
      };
    },
    [...CONDUCT_IDS, ...ACTION_IDS],
  );
  const boxes = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const [id, box] of read.hits) {
    if (typeof id !== 'string' || box === null || box === undefined || typeof box === 'string') {
      throw new Error('no box');
    }
    boxes.set(id, box);
  }
  const at = (id: string) => {
    const box = boxes.get(id);
    if (box === undefined) throw new Error(id);
    return box;
  };
  const tol = 1.5;
  // Row 1: continue to destination at the top left, then alternate, then emergency, on one line.
  expect(Math.abs(at(carryOn).y - at(precaution).y)).toBeLessThan(tol);
  expect(Math.abs(at(carryOn).y - at(emergency).y)).toBeLessThan(tol);
  expect(at(carryOn).x).toBeLessThan(at(precaution).x);
  expect(at(precaution).x).toBeLessThan(at(emergency).x);
  // Row 2: brief passengers, MAYDAY, notify (PAN PAN PAN), one line below row 1.
  expect(Math.abs(at(passengers).y - at(mayday).y)).toBeLessThan(tol);
  expect(Math.abs(at(passengers).y - at(panPan).y)).toBeLessThan(tol);
  expect(at(passengers).x).toBeLessThan(at(mayday).x);
  expect(at(mayday).x).toBeLessThan(at(panPan).x);
  expect(at(passengers).y).toBeGreaterThan(at(carryOn).y + at(carryOn).h - tol);
  // Row 3: the three Avoid actions, one line below row 2.
  expect(Math.abs(at(avoidImc).y - at(avoidNvfr).y)).toBeLessThan(tol);
  expect(Math.abs(at(avoidImc).y - at(avoidIcing).y)).toBeLessThan(tol);
  expect(at(avoidImc).x).toBeLessThan(at(avoidNvfr).x);
  expect(at(avoidNvfr).x).toBeLessThan(at(avoidIcing).x);
  expect(at(avoidImc).y).toBeGreaterThan(at(passengers).y + at(passengers).h - tol);
  expect(Math.abs(at(avoidImc).x - at(carryOn).x)).toBeLessThan(tol);
  // The columns line up, and the headline stands above row 1 inside the plate.
  expect(Math.abs(at(carryOn).x - at(passengers).x)).toBeLessThan(tol);
  const { title, plate } = read;
  if (title === null || plate === null) throw new Error('no title or plate');
  expect(title.y).toBeGreaterThanOrEqual(plate.y);
  expect(title.y + title.h).toBeLessThanOrEqual(at(carryOn).y + tol);
  // The labels of the two calls are the owner's words and fit their buttons.
  await expect(furtherButton(page, mayday).locator('text')).toHaveText('ATC: MAYDAY');
  await expect(furtherButton(page, panPan).locator('tspan')).toHaveText([
    'ATC notify',
    '(PAN PAN PAN)',
  ]);
  await expect(furtherButton(page, passengers).locator('tspan')).toHaveText([
    'Brief passengers',
    '(if time permits)',
  ]);
  // Every label, line by line, stands inside its button with 6 units of margin at least.
  for (const option of SET.options) {
    const hit = at(option.id);
    const lineBoxes = await furtherButton(page, option.id)
      .locator('text')
      .evaluate((el) => {
        const parts = Array.from(el.querySelectorAll('tspan'));
        const nodes: Element[] = parts.length > 0 ? parts : [el];
        return nodes.map((node) => {
          const r = node.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        });
      });
    expect(lineBoxes.length, `${option.id} lines`).toBe((option.label ?? '').split('\n').length);
    // 6 units of margin, less 1 px of font slack: the Linux runner draws the text a fraction of a pixel wider (WORKFLOW, font slack).
    const margin = hit.w * (6 / 150) - 1;
    for (const box of lineBoxes) {
      expect(box.x, `${option.id} left`).toBeGreaterThanOrEqual(hit.x + margin);
      expect(box.x + box.w, `${option.id} right`).toBeLessThanOrEqual(hit.x + hit.w - margin);
      expect(box.y, `${option.id} top`).toBeGreaterThanOrEqual(hit.y);
      expect(box.y + box.h, `${option.id} bottom`).toBeLessThanOrEqual(hit.y + hit.h);
    }
  }
});

test('the debrief shows the picks of the conduct in order and the final one counts, with the follow-on button instead of the note of the emergency landing', async ({
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
  // Engine fire leads into the landing (Phase 9): the button takes the place of the old note, which
  // e2e/follow-on.spec.ts checks for a scenario without a follow-on.
  await expect(page.getByTestId('debrief-follow-on')).toBeVisible();
  await expect(page.getByTestId('debrief-further-note')).toHaveCount(0);
});

test('a run that never switches from the preselected Continue to destination ends FAIL with the wrong conduct, shown as Wrong with its pick', async ({
  page,
  hasTouch,
}) => {
  const [carryOn] = CONDUCT_IDS;
  if (carryOn === undefined) throw new Error('short list');
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  await pickFurther(page, hasTouch, [MAYDAY]);
  await finish(page, hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  await expect(row(page, 'conduct')).toHaveAttribute('data-verdict', 'Wrong');
  // The picked line shows Continue to destination: it was the default, not a press.
  await expect(page.getByTestId('debrief-further-picks')).toContainText(
    `Picked: ${textOf(carryOn)}`,
  );
  await expect(
    page
      .getByTestId('debrief-reason')
      .filter({ hasText: 'The flight decision was not the right one.' }),
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
  await toggleFurther(page, hasTouch, CONDUCT_IDS[2] ?? MAYDAY);
  await page.waitForTimeout(200);
  // Drawn alike before the onset: the preselected Continue to destination shows, no press changes it.
  expect(await selectedIds(page)).toEqual([SET.defaultConduct]);
  await page.waitForFunction(() => {
    const host = globalThis as unknown as {
      __panelSession?: { now(): number | null; onset(): { at: number } | null };
    };
    const now = host.__panelSession?.now() ?? null;
    const onset = host.__panelSession?.onset() ?? null;
    return now !== null && onset !== null && now >= onset.at;
  });
  await pickFurther(page, hasTouch, [MAYDAY]);
  expect((await selectedIds(page)).sort()).toEqual([MAYDAY, SET.defaultConduct].sort());
});

test('a thin divider line on the plate marks the three conduct buttons as one group: it is there on the free panel, inside the plate, between the conduct row and the rows below it', async ({
  page,
  hasTouch,
}) => {
  const [carryOn] = CONDUCT_IDS;
  if (carryOn === undefined) throw new Error('no conduct');
  const divider = page.locator('[data-shell="further-divider"]');
  const measure = async () =>
    page.evaluate(
      ({ conductId, otherId }) => {
        const rectOf = (el: Element | null) => {
          if (el === null) return null;
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        };
        return {
          line: rectOf(document.querySelector('[data-shell="further-divider"]')),
          plate: rectOf(document.querySelector('[data-plate="further-pad"]')),
          conduct: rectOf(document.querySelector(`[data-session-hit="further.${conductId}"]`)),
          other: rectOf(document.querySelector(`[data-session-hit="further.${otherId}"]`)),
        };
      },
      { conductId: carryOn, otherId: MAYDAY },
    );
  await page.goto('./');
  // Static plate art: drawn before any run, no text on it.
  await expect(divider).toHaveCount(1);
  expect(await divider.evaluate((el) => (el.textContent ?? '').trim())).toBe('');
  await startScenario(page, hasTouch, FIRE_ROW);
  await expect(divider).toHaveCount(1);
  const { line, plate, conduct, other } = await measure();
  if (line === null || plate === null || conduct === null || other === null) {
    throw new Error('no boxes');
  }
  // Inside the plate, along the cluster, between the conduct row and the next row, clear of both.
  expect(line.x).toBeGreaterThan(plate.x);
  expect(line.x + line.w).toBeLessThan(plate.x + plate.w);
  expect(line.y).toBeGreaterThan(conduct.y + conduct.h);
  expect(line.y + line.h).toBeLessThan(other.y);
  // The line is thin and it is the only one: exactly one divider, nothing else in the cluster draws a line.
  expect(line.h).toBeLessThan(conduct.h / 10);
  await expect(page.locator('[data-shell="further-divider"]')).toHaveCount(1);
});

test('under the emergency landing Avoid NVFR and Avoid icing are greyed out and ignore a press, Avoid IMC stays open, earlier picks stay and the labels never change', async ({
  page,
  hasTouch,
}) => {
  const [avoidImc, avoidNvfr, avoidIcing] = AVOID_IDS;
  const [carryOn, precaution, emergency] = CONDUCT_IDS;
  if (avoidImc === undefined || avoidNvfr === undefined || avoidIcing === undefined) {
    throw new Error('no avoid actions');
  }
  if (carryOn === undefined || precaution === undefined || emergency === undefined) {
    throw new Error('short list');
  }
  const blockedByEmergency = SET.options.filter((o) => SET.isBlocked(o.id, emergency));
  expect(blockedByEmergency.map((o) => o.id)).toEqual([avoidNvfr, avoidIcing]);
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  // Nothing is greyed out while another conduct is selected.
  for (const id of AVOID_IDS) {
    await expect(furtherButton(page, id)).not.toHaveAttribute('aria-disabled', 'true');
  }
  await pickFurther(page, hasTouch, [avoidNvfr, avoidImc]);
  await pickFurther(page, hasTouch, [emergency]);
  // Greyed out by the static look and aria-disabled; the label text is the same as before (G-0).
  for (const id of [avoidNvfr, avoidIcing]) {
    await expect(furtherButton(page, id)).toHaveAttribute('aria-disabled', 'true');
    await expect(furtherButton(page, id)).toHaveAttribute('data-disabled', 'true');
    await expect(furtherButton(page, id)).toHaveAttribute('opacity', /^0\.\d+$/);
    for (const line of (SET.option(id)?.label ?? '').split('\n')) {
      await expect(furtherButton(page, id)).toContainText(line);
    }
  }
  await expect(furtherButton(page, avoidImc)).not.toHaveAttribute('aria-disabled', 'true');
  // The earlier pick stays recorded (shown dimmed, still selected); a press changes nothing.
  await pressGreyedFurther(page, hasTouch, avoidNvfr);
  await pressGreyedFurther(page, hasTouch, avoidIcing);
  await expect(furtherButton(page, avoidNvfr)).toHaveAttribute('data-selected', 'true');
  await expect(furtherButton(page, avoidIcing)).toHaveAttribute('data-selected', 'false');
  // Avoid IMC still toggles.
  await toggleFurther(page, hasTouch, avoidImc);
  await expect(furtherButton(page, avoidImc)).toHaveAttribute('data-selected', 'false');
  await toggleFurther(page, hasTouch, avoidImc);
  await expect(furtherButton(page, avoidImc)).toHaveAttribute('data-selected', 'true');
  // The keyboard cannot press a greyed-out button either.
  await furtherButton(page, avoidIcing).focus();
  await page.keyboard.press('Enter');
  await expect(furtherButton(page, avoidIcing)).toHaveAttribute('data-selected', 'false');
  // Back to another conduct: both are live again and the old pick counts.
  await pickFurther(page, hasTouch, [precaution]);
  for (const id of AVOID_IDS) {
    await expect(furtherButton(page, id)).not.toHaveAttribute('aria-disabled', 'true');
  }
  await expect(furtherButton(page, avoidNvfr)).toHaveAttribute('data-selected', 'true');
  await pickFurther(page, hasTouch, [avoidIcing]);
});

test('the debrief ignores the greyed-out Avoid picks when the run ends on the emergency landing, and lists them again for another final conduct', async ({
  page,
  hasTouch,
}) => {
  const [avoidImc, avoidNvfr, avoidIcing] = AVOID_IDS;
  const [, precaution, emergency] = CONDUCT_IDS;
  if (avoidImc === undefined || avoidNvfr === undefined || avoidIcing === undefined) {
    throw new Error('no avoid actions');
  }
  if (precaution === undefined || emergency === undefined) throw new Error('short list');
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  await pickFurther(page, hasTouch, [avoidNvfr, avoidIcing, avoidImc, emergency]);
  await finish(page, hasTouch);
  await expect(row(page, avoidImc)).toHaveAttribute('data-verdict', 'Done');
  await expect(row(page, avoidNvfr)).toHaveCount(0);
  await expect(row(page, avoidIcing)).toHaveCount(0);

  // The same picks with another final conduct are all listed.
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  await pickFurther(page, hasTouch, [avoidNvfr, avoidIcing, avoidImc, emergency]);
  await pickFurther(page, hasTouch, [precaution]);
  await finish(page, hasTouch);
  for (const id of AVOID_IDS) await expect(row(page, id)).toHaveAttribute('data-verdict', 'Done');
});
