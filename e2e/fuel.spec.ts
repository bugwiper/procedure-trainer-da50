import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG_QUANTITIES } from '../src/aircraft/da50rg/quantities';
import { quantityOf, startScenario } from './support/session';
import { activate } from './support/zoom';

// The fuel model on the built panel (Phase 6, plan 01): the FUEL TRANS pump ends in a white
// advisory chip on the PFD. The first case uses the preview flag of the free panel (it also runs
// against the live site); the second runs a shipped scenario and reads the e2e-only window hook,
// so its title carries @hooks. The numbers come from the quantity data in node, never typed in.

const ROW = 'engine.eng-oil-temp-green';
const PUMP = 'fuel_trans_active';
const LEFT = 'fuel_qty_lh_gal';
const RIGHT = 'fuel_qty_rh_gal';

const pumpFlag = DA50RG_QUANTITIES.get(PUMP);
if (pumpFlag === undefined) throw new Error(`no quantity ${PUMP}`);

const chips = (page: Page) => page.locator('[data-testid="cas-chip"]');
const fuelTransChip = (page: Page) =>
  page.locator('[data-testid="cas-chip"][data-cas-id="fuel_trans"]');

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('?q=fuel_trans_active:1 shows the white FUEL TRANS advisory and no other chip', async ({
  page,
}) => {
  await page.goto(`./?q=${PUMP}:${pumpFlag.max}`);
  await expect(page.getByTestId('panel')).toBeVisible();
  await expect(chips(page)).toHaveCount(1);
  await expect(fuelTransChip(page)).toHaveAttribute('data-level', 'advisory');
  await expect(fuelTransChip(page)).toHaveAttribute('aria-label', 'Advisory: FUEL TRANS');
});

test('the free panel shows no FUEL TRANS chip', async ({ page }) => {
  await expect(chips(page)).toHaveCount(0);
});

test('@hooks FUEL TRANS on in a run moves fuel to the left tank and shows the chip, off removes it', async ({
  page,
  hasTouch,
}) => {
  await startScenario(page, hasTouch, ROW, 'easy');
  const knob = page.locator('[data-control-id="sw.fuel_trans"]');
  const hit = page.locator('[data-hit="sw.fuel_trans"]');
  await expect(fuelTransChip(page)).toHaveCount(0);

  const gap = async (): Promise<number> =>
    (await quantityOf(page, LEFT)) - (await quantityOf(page, RIGHT));
  const before = await gap();

  await activate(hit, hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'on');
  await expect(fuelTransChip(page)).toBeVisible();
  await expect(fuelTransChip(page)).toHaveAttribute('data-level', 'advisory');
  // The left tank rises against the right one (the burn is smaller than the transfer).
  await expect.poll(gap, { timeout: 15_000 }).toBeGreaterThan(before + 0.02);

  await activate(hit, hasTouch);
  await expect(knob).toHaveAttribute('data-state', 'off');
  await expect(fuelTransChip(page)).toHaveCount(0);
});
