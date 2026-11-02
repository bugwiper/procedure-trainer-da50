import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DA50RG_ENV } from '../src/aircraft/da50rg/aircraft';
import { furtherButton, pickFurther, startScenario, toggleFurther } from './support/session';
import { activate, sessionButtonCoverage, zoomIntoRegion } from './support/zoom';

// SES-05 (phase 07, plans 07-02 and 07-05): six toggle buttons in the pilot footwell; every press is
// recorded with the run time and the on flag, the state at the end is graded with the panel actions
// when Procedure complete is pressed and shown in the debrief with the role and verdict words. Texts
// come from the aircraft data in node.

const FIRE_ROW = 'engine.eng-fire-in-flight';
const SET = DA50RG_ENV.further;
const textOf = (id: string): string => SET.option(id)?.text ?? id;
const [MAYDAY] = SET.ids('action');
if (MAYDAY === undefined) throw new Error('the aircraft lists no action');

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
