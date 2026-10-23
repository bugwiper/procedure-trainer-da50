import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG } from '../src/aircraft/da50rg/panel';
import { parseScenario } from '../src/scenario/parse';
import { forceVariant, startRealistic, startScenario } from './support/session';
import { activate, leaveZoom, zoomIntoRegion } from './support/zoom';

// Phase 3.1 (plan 02): every cause of ALTN 1 FAIL played on the built panel to a PASS debrief that
// names the cause. The draw is forced with forceVariant; the variants, their faulted controls and
// their debrief texts are read from the shipped file in node, never typed in. All cases use the
// e2e-only window hook through forceVariant's reload, so the titles carry @hooks.

const FILE = 'electrical/elec-altn1-fail';
const ROW = 'electrical.elec-altn1-fail';
const BREAKER = 'cb.alt1';
const PORTRAIT_NOTE =
  'Portrait phones are covered by the rotate hint (D-02); pinch zoom reaches full tap size there';

/** The delay after which a shorted alternator pops its breaker again is 2 s; the spec allows 5 s. */
const REPOP_WITHIN_MS = 5000;
/** Longer than the re-trip delay: a breaker that is still in after this has not been tripped. */
const STAYS_IN_FOR_MS = 3500;
/** The window of the onset on Realistic is 2 to 6 s; the spec allows 10 s. */
const ONSET_WITHIN_MS = 10_000;

const parsed = parseScenario(
  readFileSync(new URL(`../scenarios/${FILE}.toon`, import.meta.url), 'utf8'),
);
if (!parsed.ok) throw new Error(`${FILE} does not parse`);
const VARIANTS = parsed.value.variants;
const BREAKER_REGION = DA50RG.get(BREAKER)?.region ?? '';

/** What the pilot does in each cause, after the cause is seen on the panel. */
type Move = 'push' | 'pushPopsAgain' | 'pushStays' | 'switches';
const SOLUTIONS: Record<string, readonly Move[]> = {
  alternator_dead: ['switches'],
  breaker_popped: ['push'],
  alternator_shorted: ['pushPopsAgain', 'switches'],
  breaker_popped_dead: ['pushStays', 'switches'],
};

const control = (page: Page, id: string) => page.locator(`[data-control-id="${id}"]`);
const chip = (page: Page) => page.locator('[data-testid="cas-chip"]');

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'phone-portrait', PORTRAIT_NOTE);
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('@hooks the spec has a solution for exactly the variants of the file', () => {
  expect(Object.keys(SOLUTIONS).sort()).toEqual(VARIANTS.map((v) => v.id).sort());
});

/** Zooms into the breaker's region on touch projects, taps the breaker, leaves the zoom. */
async function tapBreaker(page: Page, hasTouch: boolean): Promise<void> {
  if (hasTouch) await zoomIntoRegion(page, hasTouch, BREAKER_REGION);
  await activate(page.locator(`[data-hit="${BREAKER}"]`), hasTouch);
  await leaveZoom(page, hasTouch);
}

async function tapSwitches(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator('[data-hit="sw.alternator_1"]'), hasTouch);
  await expect(control(page, 'sw.alternator_1')).toHaveAttribute('data-state', 'off');
  await activate(page.locator('[data-hit="sw.ess_bus"]'), hasTouch);
  await expect(control(page, 'sw.ess_bus')).toHaveAttribute('data-state', 'on');
}

for (const variant of VARIANTS) {
  test(`@hooks ALTN 1 FAIL, cause ${variant.id}: solved on Easy, the debrief names the cause`, async ({
    page,
    hasTouch,
  }) => {
    await forceVariant(page, FILE, variant.id);
    await startScenario(page, hasTouch, ROW, 'easy');

    // The faulted controls of the cause show on the panel, every other breaker control is in.
    const faulted = variant.controls[BREAKER] ?? 'in';
    await expect(control(page, BREAKER)).toHaveAttribute('data-state', faulted);
    // The message shows from the start in every cause.
    await expect(chip(page)).toHaveAttribute('data-cas-id', 'altn_1_fail');

    for (const move of SOLUTIONS[variant.id] ?? []) {
      switch (move) {
        case 'push':
          await tapBreaker(page, hasTouch);
          await expect(control(page, BREAKER)).toHaveAttribute('data-state', 'in');
          // The alternator delivers again: the message goes.
          await expect(chip(page)).toHaveCount(0);
          break;
        case 'pushPopsAgain':
          await tapBreaker(page, hasTouch);
          // The breaker is in for a moment, then the short pops it again.
          await expect(control(page, BREAKER)).toHaveAttribute('data-state', 'out', {
            timeout: REPOP_WITHIN_MS,
          });
          await expect(chip(page)).toHaveCount(1);
          break;
        case 'pushStays':
          await tapBreaker(page, hasTouch);
          await expect(control(page, BREAKER)).toHaveAttribute('data-state', 'in');
          await page.waitForTimeout(STAYS_IN_FOR_MS);
          await expect(control(page, BREAKER)).toHaveAttribute('data-state', 'in');
          await expect(chip(page)).toHaveCount(1);
          break;
        case 'switches':
          await tapSwitches(page, hasTouch);
          break;
      }
    }

    await activate(page.getByTestId('procedure-complete'), hasTouch);
    await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
    await expect(page.getByTestId('debrief-variant')).toHaveText(`Cause: ${variant.debrief}`);
  });
}

test('@hooks ALTN 1 FAIL on Realistic, cause breaker_popped: the breaker pops after the onset and pushing it in passes', async ({
  page,
  hasTouch,
}) => {
  const popped = VARIANTS.find((v) => v.controls[BREAKER] === 'out' && v.applies.length === 1);
  if (popped === undefined) throw new Error('no variant of the file has only the breaker step');
  await forceVariant(page, FILE, popped.id);
  await startRealistic(page, hasTouch, ROW);

  // The start is clean; the simulation pops the breaker inside the onset window.
  await expect(control(page, BREAKER)).toHaveAttribute('data-state', 'in');
  await expect(control(page, BREAKER)).toHaveAttribute('data-state', 'out', {
    timeout: ONSET_WITHIN_MS,
  });
  await expect(chip(page)).toHaveAttribute('data-cas-id', 'altn_1_fail');

  await tapBreaker(page, hasTouch);
  await expect(control(page, BREAKER)).toHaveAttribute('data-state', 'in');
  await expect(chip(page)).toHaveCount(0);

  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('PASS');
  await expect(page.getByTestId('debrief-variant')).toHaveText(`Cause: ${popped.debrief}`);
});
