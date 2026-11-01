import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { startScenario } from './support/session';
import { activate } from './support/zoom';

// SES-05 (phase 07, plan 07-02): the FURTHER ACTIONS button of the run view opens a multi-select
// modal; every pick is logged with the run time, graded as the scenario declares and shown in the
// debrief with the role and verdict words. Texts come from the aircraft data in node.

const FIRE_ROW = 'engine.eng-fire-in-flight';
type HookHost = { __panelSession?: { now(): number | null } };
const clockNow = (page: Page): Promise<number | null> =>
  page.evaluate(() => (globalThis as HookHost).__panelSession?.now() ?? null);

const FURTHER = '[data-session-hit="session.further"]';
const SET = DA50RG_ENV.further;
const textOf = (id: string): string => SET.option(id)?.text ?? id;

/** Opens the modal and waits until its input shield is over. */
async function openFurther(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.locator(FURTHER), hasTouch);
  await expect(page.getByTestId('further')).toBeVisible();
  await expect(page.getByTestId('further-modal')).not.toHaveAttribute('data-shield', 'on');
}

const row = (page: Page, id: string) => page.locator(`[data-further-id="${id}"]`);

async function finish(page: Page, hasTouch: boolean): Promise<void> {
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief')).toBeVisible();
}

test('@hooks the FURTHER ACTIONS button is in the run view and opens the modal, which pauses the run clock', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await expect(page.locator(FURTHER)).toHaveCount(0);
  await startScenario(page, hasTouch, FIRE_ROW);
  await expect(page.locator(FURTHER)).toHaveCount(1);
  await expect(
    page.getByLabel('Further actions: inform ATC, brief passengers, choose the flight conduct'),
  ).toHaveCount(1);
  await openFurther(page, hasTouch);
  await expect(page.getByRole('heading', { name: 'Further actions' })).toBeVisible();
  const held = await clockNow(page);
  await page.waitForTimeout(800);
  expect(await clockNow(page)).toBe(held);
  await activate(page.getByTestId('further-close'), hasTouch);
  await expect(page.getByTestId('further')).toHaveCount(0);
});

test('the MAYDAY pick is graded and shown: Done, and no missed-action reason', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  await openFurther(page, hasTouch);
  await activate(page.getByTestId('further-group-atc'), hasTouch);
  await activate(page.getByTestId('further-opt-atc_mayday'), hasTouch);
  await expect(page.getByTestId('further-opt-atc_mayday')).toHaveAttribute('data-done', 'true');
  await activate(page.getByTestId('further-back'), hasTouch);
  await expect(page.getByTestId('further-group-atc')).toHaveAttribute('data-done', 'true');
  await activate(page.getByTestId('further-close'), hasTouch);
  await finish(page, hasTouch);

  await expect(page.getByTestId('debrief-further-heading')).toBeVisible();
  const mayday = row(page, 'atc_mayday');
  await expect(mayday).toContainText(textOf('atc_mayday'));
  await expect(mayday).toHaveAttribute('data-verdict', 'Done');
  await expect(
    page.getByTestId('debrief-reason').filter({ hasText: /further action/ }),
  ).toHaveCount(0);
});

test('without the MAYDAY pick the debrief says Missed and gives the reason line', async ({
  page,
  hasTouch,
}) => {
  await page.goto('./');
  await startScenario(page, hasTouch, FIRE_ROW);
  await finish(page, hasTouch);
  await expect(page.getByTestId('debrief-result')).toHaveText('FAIL');
  await expect(row(page, 'atc_mayday')).toHaveAttribute('data-verdict', 'Missed');
  await expect(
    page.getByTestId('debrief-reason').filter({ hasText: /required further action/ }),
  ).toHaveCount(1);
  await expect(row(page, 'conduct')).toHaveAttribute('data-verdict', 'Missing');
  await expect(
    page.getByTestId('debrief-reason').filter({ hasText: 'The flight decision was missing.' }),
  ).toHaveCount(1);
});
