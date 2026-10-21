import { expect, test } from '@playwright/test';

// PNL-10, D-05, T-01.1-04: the rendered panel carries the replacement brand marks and neither
// real brand name. Runs on every project and also against the live site (not @hooks).

const REAL_BRANDS = /garmin|diamond/i;

function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

test('rendered panel text carries GO-AROUND twice, DA50RG once, no airframe maker mark and no real brand', async ({
  page,
}) => {
  await page.goto('./');
  const panel = page.getByTestId('panel');
  await expect(panel).toBeVisible();

  const text = (await panel.textContent()) ?? '';
  expect(countOf(text, 'GO-AROUND')).toBe(2);
  expect(countOf(text, 'RUBIN')).toBe(0);
  expect(countOf(text, 'DA50RG')).toBe(1);
  expect(text).not.toMatch(REAL_BRANDS);
});

test('the panel contains no raster image element', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await expect(page.getByTestId('panel').locator('image')).toHaveCount(0);
});
