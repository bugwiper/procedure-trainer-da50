import { expect, test } from '@playwright/test';

test('panel stage loads at the base path', async ({ page, baseURL }) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  const base = new URL(baseURL);
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const badResponses: string[] = [];
  const assetStatuses: number[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.url()} ${req.failure()?.errorText ?? ''}`);
  });
  page.on('response', (res) => {
    const url = new URL(res.url());
    if (res.status() >= 400) badResponses.push(`${res.status()} ${res.url()}`);
    if (url.pathname.startsWith(`${base.pathname}assets/`)) assetStatuses.push(res.status());
  });

  // './' keeps navigation under the base path; a leading slash would escape it.
  await page.goto('./');

  expect(new URL(page.url()).pathname).toBe(base.pathname);

  const panel = page.getByTestId('panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('viewBox', '0 0 2000 1010');
  await expect(page.getByTestId('training-aid-notice')).toHaveText(
    'Training aid only, not the AFM',
  );

  expect(assetStatuses.length).toBeGreaterThan(0);
  expect(assetStatuses).toContain(200);

  const viewport = page.viewportSize();
  if (viewport === null) throw new Error('viewport missing');
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(metrics.innerWidth).toBe(viewport.width);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(badResponses).toEqual([]);
});
