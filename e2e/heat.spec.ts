import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG_CAS } from '../src/aircraft/da50rg/cas';
import { DA50RG_QUANTITIES, STALL_HEAT_CUTOUT_S } from '../src/aircraft/da50rg/quantities';
import { startScenario } from './support/session';
import { activate } from './support/zoom';

// PITOT HEAT and STALL HEAT on the built panel (Phase 6, plan 04; H-01, H-02): the PITOT/STALL HEAT
// rocker turned off shows two yellow cautions on the PFD, turned on removes them, and the free-panel
// flag q=stall_heat_timer_s shows the single ground message. The specs read drawn chips only, so they
// also run against the live site. The texts and the cut-out time come from the aircraft data in node.

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

// H-03 (owner, D-12): a ground situation starts with the heat on, so STALL HEAT comes back a few
// seconds into the run; switching the heat off swaps it for the two off cautions. Real time.
test('a ground situation shows STALL HEAT a few seconds into the run, off swaps it for the two cautions', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, 'fire.eng-fire-ground', 'easy');
  await expect(page.locator(`[data-control-id="${HEAT}"]`)).toHaveAttribute('data-state', 'on');
  await expect(chip(page, 'stall_heat_ground')).toHaveCount(1, {
    timeout: (STALL_HEAT_CUTOUT_S + 10) * 1000,
  });
  await expect(chip(page, 'stall_heat_ground')).toHaveAttribute('data-level', 'caution');
  await expect(chip(page, 'stall_heat_ground')).toHaveAttribute(
    'aria-label',
    `Caution: ${text('stall_heat_ground')}`,
  );

  await activate(page.locator(`[data-hit="${HEAT}"]`), hasTouch);
  await expect(page.locator(`[data-control-id="${HEAT}"]`)).toHaveAttribute('data-state', 'off');
  await expect(chip(page, 'stall_heat_ground')).toHaveCount(0);
  await expect(chip(page, 'pitot_heat')).toHaveCount(1);
  await expect(chip(page, 'stall_heat')).toHaveCount(1);
});
