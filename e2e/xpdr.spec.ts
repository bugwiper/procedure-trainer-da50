import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { activate, zoomIntoRegion } from './support/zoom';

// The simplified transponder (D-11, PNL-07): keys 0 to 7 and CLR in the pilot's legroom, the
// committed code is the state of kp.squawk. Mirror of the read-only window hook of the e2e build
// (src/ui/bridge.ts); declared here because the e2e project has no DOM lib.
interface PanelHook {
  events(): { id: string; value: string }[];
  state(): Record<string, string>;
}
type HookHost = { __panel?: PanelHook };

const SQUAWK = 'kp.squawk';

function key(page: Page, name: string): Locator {
  return page.locator(`[data-detent="${SQUAWK}:${name}"]`);
}

const readout = (page: Page): Locator => page.locator('[data-glass="readout"]');
const events = (page: Page) =>
  page.evaluate(() => (globalThis as HookHost).__panel?.events() ?? []);
const squawk = (page: Page) =>
  page.evaluate((id) => (globalThis as HookHost).__panel?.state()[id] ?? null, SQUAWK);
const viewBox = (page: Page) => page.getByTestId('panel').getAttribute('viewBox');

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});

test('@hooks the transponder rests on 1200 and shows it', async ({ page }) => {
  expect(await squawk(page)).toBe('1200');
  await expect(readout(page)).toHaveText('1200');
  await expect(page.locator(`[data-control-id="${SQUAWK}"]`)).toHaveAttribute('data-state', '1200');
});

test('@hooks four digit taps commit 7700 as one event, and no key tap zooms', async ({
  page,
  hasTouch,
}) => {
  await zoomIntoRegion(page, hasTouch, 'transponder');
  const zoomed = await viewBox(page);

  // The two 7 taps follow each other at once, without the pair wait: a key never pairs or zooms.
  await activate(key(page, '7'), hasTouch);
  await expect(readout(page)).toHaveText('7---');
  expect(await squawk(page), 'a partial entry never reaches the store').toBe('1200');
  expect(await events(page)).toHaveLength(0);

  await activate(key(page, '7'), hasTouch);
  await expect(readout(page)).toHaveText('77--');
  await activate(key(page, '0'), hasTouch);
  await expect(readout(page)).toHaveText('770-');
  expect(await events(page)).toHaveLength(0);
  await activate(key(page, '0'), hasTouch);

  await expect(readout(page)).toHaveText('7700');
  expect(await squawk(page)).toBe('7700');
  const log = await events(page);
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({ id: SQUAWK, value: '7700' });
  expect(await viewBox(page), 'key taps must not change the view').toBe(zoomed);
});

test('@hooks CLR empties a partial entry and a further key tap records nothing until four digits', async ({
  page,
  hasTouch,
}) => {
  await zoomIntoRegion(page, hasTouch, 'transponder');
  for (const name of ['7', '7', '0', '0']) await activate(key(page, name), hasTouch);
  await expect(readout(page)).toHaveText('7700');
  expect(await events(page)).toHaveLength(1);

  await activate(key(page, '1'), hasTouch);
  await expect(readout(page)).toHaveText('1---');
  await activate(key(page, 'clr'), hasTouch);
  // CLR leaves the committed code on the readout and records nothing.
  await expect(readout(page)).toHaveText('7700');
  expect(await squawk(page)).toBe('7700');
  expect(await events(page)).toHaveLength(1);

  // The cleared entry never completes: three more digits are still a partial entry.
  for (const name of ['2', '3', '4']) await activate(key(page, name), hasTouch);
  await expect(readout(page)).toHaveText('234-');
  expect(await squawk(page)).toBe('7700');
  expect(await events(page)).toHaveLength(1);
});

test('@hooks typing the committed code again records no second event', async ({
  page,
  hasTouch,
}) => {
  await zoomIntoRegion(page, hasTouch, 'transponder');
  for (const name of ['1', '2', '0', '0']) await activate(key(page, name), hasTouch);
  await expect(readout(page)).toHaveText('1200');
  expect(await events(page)).toHaveLength(0);
});
