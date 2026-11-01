import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parseScenario } from '../src/scenario/parse';
import {
  pickFurther,
  quantityOf,
  shippedScenarios,
  startRealistic,
  startScenario,
} from './support/session';
import type { ShippedScenario } from './support/session';
import { activate } from './support/zoom';

// SES-06 (phase 07, plan 03): Retry and Next situation from the debrief. Retry starts the same
// situation again from a clean initial state at the same level and mode (and, on Realistic, with
// the same onset); Next situation opens the next entry of the listing, wrapping, with the mode and
// level cards skipped.

interface SessionHook {
  screen(): string;
  onset(): { at: number; seed: number } | null;
}
type HookHost = { __panelSession?: SessionHook };

const ENGINE_ROW = 'engine.eng-oil-temp-green';
/** The oil temperature at the start of ENG OIL TEMP, read with the tolerance of the run (D-01). */
const OIL_START = 128;
const OIL_TOLERANCE = 3;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

/** The title the briefing shows for a shipped scenario: the file's own, not the manifest's. */
function fileTitle(entry: ShippedScenario): string {
  const text = readFileSync(
    new URL(`../scenarios/${entry.pack}/${entry.file}.toon`, import.meta.url),
    'utf8',
  );
  const parsed = parseScenario(text);
  if (!parsed.ok) throw new Error(`${entry.row} does not parse`);
  return parsed.value.title;
}

function hasOnset(entry: ShippedScenario): boolean {
  const text = readFileSync(
    new URL(`../scenarios/${entry.pack}/${entry.file}.toon`, import.meta.url),
    'utf8',
  );
  const parsed = parseScenario(text);
  if (!parsed.ok) throw new Error(`${entry.row} does not parse`);
  return parsed.value.onset !== undefined;
}

function onsetOf(page: Page): Promise<{ at: number; seed: number } | null> {
  return page.evaluate(() => (globalThis as HookHost).__panelSession?.onset() ?? null);
}

/** Procedure complete, then waits until the shield of the debrief is down. */
async function completeToDebrief(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
  await expect(page.getByTestId('debrief-modal')).not.toHaveAttribute('data-shield', 'on');
}

const entryAt = (index: number): ShippedScenario => {
  const entry = shippedScenarios()[index];
  if (entry === undefined) throw new Error(`no shipped scenario at ${index}`);
  return entry;
};

test('Retry puts the panel back at the start at the same level and mode', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ENGINE_ROW, 'medium', 'training');
  // Operate the panel and pick a further action, so there is something to clean up.
  await activate(page.locator('[data-detent="lv.power:p50"]'), hasTouch);
  await expect(page.locator('[data-control-id="lv.power"]')).toHaveAttribute('data-state', 'p50');
  await pickFurther(page, hasTouch, ['conduct_precautionary']);
  await completeToDebrief(page, hasTouch);
  await expect(page.getByTestId('debrief-level')).toHaveText('Level: Medium');
  await expect(page.getByTestId('debrief-mode')).toHaveText('Mode: Training');

  await activate(page.getByTestId('debrief-retry'), hasTouch);

  await expect(page.getByTestId('debrief-result')).toHaveCount(0);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  // No briefing and no card: the run is on at once.
  await expect(page.getByTestId('briefing')).toHaveCount(0);
  await expect(page.getByTestId('level-pick')).toHaveCount(0);
  await expect(page.getByTestId('mode-pick')).toHaveCount(0);
  await expect(page.locator('[data-control-id="lv.power"]')).toHaveAttribute('data-state', 'p75');
  expect(Math.abs((await quantityOf(page, 'oil_temp_c')) - OIL_START)).toBeLessThanOrEqual(
    OIL_TOLERANCE,
  );
  // Training is kept: the hint button of the run view is there.
  await expect(page.locator('[data-session-hit="session.hint"]')).toBeVisible();

  // A clean run: nothing done, so it fails with the same names in its debrief.
  await completeToDebrief(page, hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  await expect(page.getByTestId('debrief-level')).toHaveText('Level: Medium');
  await expect(page.getByTestId('debrief-mode')).toHaveText('Mode: Training');
});

test('Next situation opens the briefing of the next entry, the cards skipped', async ({
  page,
  hasTouch,
}) => {
  const all = shippedScenarios();
  const at = all.findIndex((entry) => entry.row === ENGINE_ROW);
  expect(at).toBeGreaterThanOrEqual(0);
  await startScenario(page, hasTouch, ENGINE_ROW);
  await completeToDebrief(page, hasTouch);

  await activate(page.getByTestId('debrief-next'), hasTouch);

  const expected = fileTitle(entryAt((at + 1) % all.length));
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(page.getByTestId('briefing').getByRole('heading', { level: 2 })).toHaveText(
    expected,
  );
  await expect(page.getByTestId('mode-pick')).toHaveCount(0);
  await expect(page.getByTestId('level-pick')).toHaveCount(0);
  await expect(page.getByTestId('debrief-result')).toHaveCount(0);
  // The mode (Exam) is kept: the briefing carries the exam note.
  await expect(page.getByTestId('briefing-exam')).toBeVisible();
});

test('Next situation wraps from the last entry to the first', async ({ page, hasTouch }) => {
  const all = shippedScenarios();
  const last = entryAt(all.length - 1);
  await startScenario(page, hasTouch, last.row, 'medium', 'training');
  await completeToDebrief(page, hasTouch);

  await activate(page.getByTestId('debrief-next'), hasTouch);

  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(page.getByTestId('briefing').getByRole('heading', { level: 2 })).toHaveText(
    fileTitle(entryAt(0)),
  );
  await expect(page.getByTestId('briefing-training')).toBeVisible();
});

test('@hooks a Realistic retry has the same onset again and again', async ({ page, hasTouch }) => {
  await startRealistic(page, hasTouch, ENGINE_ROW);
  const first = await onsetOf(page);
  expect(first).not.toBeNull();
  await completeToDebrief(page, hasTouch);
  await expect(page.getByTestId('debrief-level')).toHaveText('Level: Realistic');

  await activate(page.getByTestId('debrief-retry'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  expect(await onsetOf(page)).toEqual(first);
  await completeToDebrief(page, hasTouch);

  await activate(page.getByTestId('debrief-retry'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  expect(await onsetOf(page)).toEqual(first);
});

test('@hooks Next situation on Realistic starts the run, or shows the level card without an onset', async ({
  page,
  hasTouch,
}) => {
  const all = shippedScenarios();
  const at = all.findIndex((entry) => entry.row === ENGINE_ROW);
  const upcoming = entryAt((at + 1) % all.length);
  await startRealistic(page, hasTouch, ENGINE_ROW);
  await completeToDebrief(page, hasTouch);

  await activate(page.getByTestId('debrief-next'), hasTouch);

  if (hasOnset(upcoming)) {
    await expect(page.getByTestId('procedure-complete')).toBeVisible();
    await expect(page.getByTestId('briefing')).toHaveCount(0);
    expect(await onsetOf(page)).not.toBeNull();
  } else {
    await expect(page.getByTestId('level-pick')).toBeVisible();
    await expect(page.getByTestId('mode-pick')).toHaveCount(0);
  }
});
