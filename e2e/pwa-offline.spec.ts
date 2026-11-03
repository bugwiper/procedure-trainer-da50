import { expect, test } from '@playwright/test';
import { collectRequests, registrationOf, waitForControl } from './support/pwa';

// PLT-02, ROADMAP criterion 2: after one online load the worker controls the page and the app
// runs with the network off. The default config blocks workers (D-09); this file opts in. None of
// the cases below needs the e2e window hook, so they also run against the live site.
test.use({ serviceWorkers: 'allow' });

test('after one online load a reload with the network off shows the panel', async ({
  page,
  context,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  const log = collectRequests(page);
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await waitForControl(page);

  const registration = await registrationOf(page);
  expect(registration).not.toBeNull();
  expect(registration?.scope).toBe(baseURL);
  expect(registration?.script).toBe(new URL('sw.js', baseURL).href);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('panel')).toBeVisible();
  await expect(page.getByTestId('training-aid-notice')).toBeVisible();

  expect(log.outside(baseURL)).toEqual([]);
  expect(log.consoleErrors).toEqual([]);
});

test.describe('with the worker blocked (the config default)', () => {
  test.use({ serviceWorkers: 'block' });

  test('registering resolves with no registration and the app starts without an error', async ({
    page,
    baseURL,
  }) => {
    if (baseURL === undefined) throw new Error('baseURL missing');
    const log = collectRequests(page);
    await page.goto('./');
    await expect(page.getByTestId('panel')).toBeVisible();
    const registered = await page.evaluate(
      async (script) => (await navigator.serviceWorker.register(script)) as unknown,
      new URL('sw.js', baseURL).href,
    );
    expect(registered).toBeUndefined();
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
    expect(log.consoleErrors).toEqual([]);
  });
});
