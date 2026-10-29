import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
import { DA50RG_QUANTITIES, STALL_HEAT_CUTOUT_S } from '../src/aircraft/da50rg/quantities';
import { quantityOf, startRealistic, startScenario } from './support/session';
import { activate, afterPairWindow } from './support/zoom';

// PITOT HEAT and STALL HEAT on the built panel (Phase 6, plan 04; H-01, H-02): the PITOT/STALL HEAT
// rocker turned off shows two yellow cautions on the PFD, turned on removes them, and the free-panel
// flag q=stall_heat_timer_s shows the single ground message. The specs read drawn chips only, so they
// also run against the live site (the specs that read a quantity carry @hooks). The texts and the cut-out time come from the aircraft data in node.

const HEAT = 'sw.pitot_stall_heat';
const TIMER = 'stall_heat_timer_s';
const text = (id: string): string => DA50RG_CAS.get(id)?.text ?? '';

const timerDef = DA50RG_QUANTITIES.get(TIMER);
if (timerDef === undefined) throw new Error(`no quantity ${TIMER}`);
/** A timer value past the cut-out time and inside the range. */
const PAST_CUTOUT = STALL_HEAT_CUTOUT_S + (timerDef.max - STALL_HEAT_CUTOUT_S) / 6;

const chips = (page: Page) => page.locator('[data-testid="cas-chip"]');
const chip = (page: Page, id: string) =>
  page.locator(`[data-testid="cas-chip"][data-cas-id="${id}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  const dismiss = page.getByTestId('rotate-hint-dismiss');
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(page.getByTestId('rotate-hint')).toBeHidden();
});

test('the free panel starts with the heat on and shows no chip', async ({ page }) => {
  await expect(page.locator(`[data-control-id="${HEAT}"]`)).toHaveAttribute('data-state', 'on');
  await expect(chips(page)).toHaveCount(0);
});

test('PITOT/STALL HEAT off shows the cautions PITOT HEAT and STALL HEAT, on removes them', async ({
  page,
  hasTouch,
}) => {
  await activate(page.locator(`[data-hit="${HEAT}"]`), hasTouch);
  await expect(page.locator(`[data-control-id="${HEAT}"]`)).toHaveAttribute('data-state', 'off');
  await expect(chips(page)).toHaveCount(2);
  for (const id of ['pitot_heat', 'stall_heat']) {
    await expect(chip(page, id)).toHaveAttribute('data-level', 'caution');
    await expect(chip(page, id)).toHaveAttribute('aria-label', `Caution: ${text(id)}`);
  }
  await expect(chips(page).nth(0)).toContainText(text('pitot_heat'));
  await expect(chips(page).nth(1)).toContainText(text('stall_heat'));

  await activate(page.locator(`[data-hit="${HEAT}"]`), hasTouch);
  await expect(page.locator(`[data-control-id="${HEAT}"]`)).toHaveAttribute('data-state', 'on');
  await expect(chips(page)).toHaveCount(0);
});

test('?q=stall_heat_timer_s past the cut-out shows the single ground STALL HEAT chip', async ({
  page,
}) => {
  await page.goto(`./?q=${TIMER}:${PAST_CUTOUT}`);
  await expect(page.getByTestId('panel')).toBeVisible();
  await expect(chips(page)).toHaveCount(1);
  await expect(chip(page, 'stall_heat_ground')).toHaveAttribute('data-level', 'caution');
  await expect(chip(page, 'stall_heat_ground')).toHaveAttribute(
    'aria-label',
    `Caution: ${text('stall_heat_ground')}`,
  );
});

test('?q=stall_heat_timer_s at the cut-out time itself shows no chip', async ({ page }) => {
  await page.goto(`./?q=${TIMER}:${STALL_HEAT_CUTOUT_S}`);
  await expect(page.getByTestId('panel')).toBeVisible();
  await expect(chips(page)).toHaveCount(0);
});

// H-03 (owner, D-12; changed 2026-10-29): a situation begins after the take-off checklist, which has
// set the stall heat ON, so a ground situation shows the STALL HEAT chip from the first step at every
// level and it does not pop up seconds in. Real time.
const GROUND_ROWS = ['fire.eng-fire-ground', 'fire.elec-fire-ground', 'fire.takeoff-fire-abort'];
const LEVELS = ['easy', 'medium', 'realistic'] as const;

for (const row of GROUND_ROWS) {
  for (const level of LEVELS) {
    test(`@hooks ${row} (${level}): the STALL HEAT chip is there from the start, the timer already past the cut-out`, async ({
      page,
      hasTouch,
    }) => {
      if (level === 'realistic') await startRealistic(page, hasTouch, row);
      else await startScenario(page, hasTouch, row, level);
      await expect(page.locator(`[data-control-id="${HEAT}"]`)).toHaveAttribute('data-state', 'on');
      // No waiting for a count: the chip and the timer are in their final state at the first look.
      expect(await quantityOf(page, TIMER)).toBeGreaterThan(STALL_HEAT_CUTOUT_S);
      await expect(chip(page, 'stall_heat_ground')).toHaveCount(1, { timeout: 1000 });
      await expect(chip(page, 'stall_heat_ground')).toHaveAttribute('data-level', 'caution');
      await expect(chip(page, 'stall_heat_ground')).toHaveAttribute(
        'aria-label',
        `Caution: ${text('stall_heat_ground')}`,
      );
      await expect(chip(page, 'stall_heat')).toHaveCount(0);
    });
  }
}

test('a ground situation: off swaps the chip for the two cautions, on again brings it back after the cut-out time', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, 'fire.eng-fire-ground', 'easy');
  await expect(chip(page, 'stall_heat_ground')).toHaveCount(1);

  await activate(page.locator(`[data-hit="${HEAT}"]`), hasTouch);
  await expect(page.locator(`[data-control-id="${HEAT}"]`)).toHaveAttribute('data-state', 'off');
  await expect(chip(page, 'stall_heat_ground')).toHaveCount(0);
  await expect(chip(page, 'pitot_heat')).toHaveCount(1);
  await expect(chip(page, 'stall_heat')).toHaveCount(1);

  await afterPairWindow(page);
  await activate(page.locator(`[data-hit="${HEAT}"]`), hasTouch);
  await expect(page.locator(`[data-control-id="${HEAT}"]`)).toHaveAttribute('data-state', 'on');
  await expect(chip(page, 'pitot_heat')).toHaveCount(0);
  await expect(chip(page, 'stall_heat')).toHaveCount(0);
  // The count starts over: the single chip returns only after the cut-out time.
  await expect(chip(page, 'stall_heat_ground')).toHaveCount(1, {
    timeout: (STALL_HEAT_CUTOUT_S + 10) * 1000,
  });
});

test('@hooks in the air with the heat on no STALL HEAT chip shows', async ({ page, hasTouch }) => {
  await startScenario(page, hasTouch, 'fire.elec-fire-flight', 'easy');
  await expect(page.locator(`[data-control-id="${HEAT}"]`)).toHaveAttribute('data-state', 'on');
  await page.waitForTimeout((STALL_HEAT_CUTOUT_S + 2) * 1000);
  expect(await quantityOf(page, TIMER)).toBe(0);
  await expect(chip(page, 'stall_heat_ground')).toHaveCount(0);
  await expect(chip(page, 'stall_heat')).toHaveCount(0);
});
