import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  cachedUrls,
  cacheNames,
  collectRequests,
  diskHash,
  fetchFromPage,
  privateContext,
  precacheUrls,
  registrationOf,
  shippedPackFolders,
  waitForControl,
  walkOutput,
  workerStamp,
} from './support/pwa';
import { startPrivateServer } from './support/pwa-server';
import { shippedScenarios, startScenario } from './support/session';
import { activate } from './support/zoom';

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

/** The scope-relative URL list resolved against a base, the way the worker resolves it. */
const resolved = (paths: readonly string[], base: string): string[] =>
  paths.map((path) => new URL(path, base).href).sort();

test('the cache holds exactly the list and every listed URL answers 200 with the network off', async ({
  page,
  context,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await waitForControl(page);
  const paths = await precacheUrls(page, baseURL);
  expect(paths.length).toBeGreaterThan(0);
  expect(paths).toContain('index.html');
  // The cache is filled by the install, before the worker is active.
  expect((await cachedUrls(page)).sort()).toEqual(resolved(paths, baseURL));
  const stamp = await workerStamp(page, baseURL);
  expect(await cacheNames(page)).toEqual([`da50-precache-${stamp.id}`]);

  await context.setOffline(true);
  const answers = await fetchFromPage(page, baseURL, paths);
  expect(answers.map((answer) => answer.path)).toEqual(paths);
  for (const answer of answers) expect(answer.status, answer.path).toBe(200);
});

test('a navigation with any query string still shows the shell offline, other navigations do not', async ({
  page,
  context,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  await page.goto('./');
  await waitForControl(page);
  await context.setOffline(true);
  await page.goto('./?scene=smoke&q=oil_temp_c%3D120');
  await expect(page.getByTestId('panel')).toBeVisible();
  await page.goto('./index.html?flags=x#top');
  await expect(page.getByTestId('panel')).toBeVisible();
  // Not the shell, not a precached file: the worker leaves it to the network, which is off.
  await expect(page.goto('./not-a-page/')).rejects.toThrow();
});

test('the list equals the built files and covers every pack chunk and font @local', async ({
  page,
  context,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  await page.goto('./');
  await waitForControl(page);
  const paths = await precacheUrls(page, baseURL);
  const built = walkOutput();
  expect(paths).toEqual(built);
  expect(new Set(paths).size).toBe(paths.length);

  const packs = shippedPackFolders();
  expect(packs.length).toBeGreaterThan(0);
  for (const pack of packs) {
    expect(
      paths.filter((path) => new RegExp(`^assets/pack-${pack}-[^/]+\\.js$`).test(path)),
      `chunk of the pack ${pack}`,
    ).toHaveLength(1);
  }
  const fonts = (list: readonly string[]) =>
    list.filter((path) => /\.(woff2?|ttf|otf)$/.test(path));
  expect(fonts(built).length).toBeGreaterThan(0);
  expect(fonts(paths)).toEqual(fonts(built));

  // What the cache serves is what the build wrote, byte for byte.
  await context.setOffline(true);
  const answers = await fetchFromPage(page, baseURL, paths);
  for (const answer of answers) expect(answer.hash, answer.path).toBe(diskHash(answer.path));
});

test('one missing file fails the install as a whole and leaves no cache @local', async ({
  browser,
  baseURL,
  viewport,
  userAgent,
  hasTouch,
  isMobile,
  deviceScaleFactor,
}) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  const server = await startPrivateServer(new URL(baseURL).pathname);
  const context = await privateContext(browser, server.origin, {
    viewport,
    userAgent,
    hasTouch,
    isMobile,
    deviceScaleFactor,
  });
  try {
    const missing = walkOutput().find((path) => path.startsWith('assets/pack-'));
    if (missing === undefined) throw new Error('the build has no pack chunk');
    server.removeFile(missing);
    const page = await context.newPage();
    await page.goto(server.baseURL);
    await expect(page.getByTestId('panel')).toBeVisible();
    // The install asked for the missing file ...
    await expect.poll(() => server.hits(missing, 404)).toBeGreaterThan(0);
    // ... and failed: no worker is left, none controls the page, no cache of the new id remains.
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration === undefined
            ? 'none'
            : [registration.installing, registration.waiting, registration.active]
                .map((w) => w?.state ?? '-')
                .join(',');
        }),
      )
      .toMatch(/^(none|-,-,-|redundant,-,-)$/);
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
    expect(await cacheNames(page)).toEqual([]);
  } finally {
    await context.close();
    await server.close();
  }
});

/**
 * Starts the scenario of `row` at the easy level, presses Procedure complete, waits for the debrief
 * and leaves it with Back to panel. Resolves when the free panel is back.
 */
async function runToDebrief(page: Page, hasTouch: boolean, row: string): Promise<void> {
  await startScenario(page, hasTouch, row, 'easy');
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
  await expect(page.getByTestId('debrief-modal')).not.toHaveAttribute('data-shield', 'on');
  await activate(page.getByTestId('debrief-back'), hasTouch);
  await expect(page.getByTestId('debrief-modal')).toBeHidden();
}

/** One online load, the worker in control and the cache complete; then the network goes off. */
async function installThenGoOffline(page: Page, baseURL: string): Promise<void> {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await waitForControl(page);
  const paths = await precacheUrls(page, baseURL);
  expect((await cachedUrls(page)).sort()).toEqual(resolved(paths, baseURL));
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByTestId('panel')).toBeVisible();
}

test('every shipped scenario runs from start to debrief with the network off', async ({
  page,
  hasTouch,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  const scenarios = shippedScenarios();
  expect(scenarios.length).toBeGreaterThan(0);
  test.setTimeout(60_000 + scenarios.length * 20_000);
  const log = collectRequests(page);
  await installThenGoOffline(page, baseURL);
  let runs = 0;
  for (const entry of scenarios) {
    await runToDebrief(page, hasTouch, entry.row);
    runs += 1;
  }
  expect(runs).toBe(scenarios.length);
  expect(log.outside(baseURL)).toEqual([]);
  expect(log.failed).toEqual([]);
  expect(log.consoleErrors).toEqual([]);
});

// One scenario of each pack, so a failure names the pack whose lazy chunk the cache did not serve.
for (const pack of [...new Set(shippedScenarios().map((entry) => entry.pack))]) {
  test(`the lazy chunk of the pack "${pack}" is served offline`, async ({
    page,
    hasTouch,
    baseURL,
  }) => {
    if (baseURL === undefined) throw new Error('baseURL missing');
    const entry = shippedScenarios().find((candidate) => candidate.pack === pack);
    if (entry === undefined) throw new Error(`no scenario in the pack ${pack}`);
    const log = collectRequests(page);
    await installThenGoOffline(page, baseURL);
    await startScenario(page, hasTouch, entry.row, 'easy');
    expect(log.outside(baseURL)).toEqual([]);
    expect(log.failed).toEqual([]);
    expect(log.consoleErrors).toEqual([]);
  });
}

test('with the server really closed a scenario still runs to the debrief @local', async ({
  browser,
  baseURL,
  viewport,
  userAgent,
  hasTouch,
  isMobile,
  deviceScaleFactor,
}, testInfo) => {
  test.skip(
    !['desktop-chromium', 'desktop-webkit'].includes(testInfo.project.name),
    'the closed-server case runs on the two desktop projects',
  );
  if (baseURL === undefined) throw new Error('baseURL missing');
  const server = await startPrivateServer(new URL(baseURL).pathname);
  const context = await privateContext(browser, server.origin, {
    viewport,
    userAgent,
    hasTouch,
    isMobile,
    deviceScaleFactor,
  });
  try {
    const page = await context.newPage();
    const log = collectRequests(page, context);
    await page.goto(server.baseURL);
    await expect(page.getByTestId('panel')).toBeVisible();
    await waitForControl(page);
    const paths = await precacheUrls(page, server.baseURL);
    expect((await cachedUrls(page)).sort()).toEqual(resolved(paths, server.baseURL));
    await server.close();
    const before = log.urls.length;
    await page.reload();
    await expect(page.getByTestId('panel')).toBeVisible();
    const first = shippedScenarios()[0];
    if (first === undefined) throw new Error('no shipped scenario');
    await runToDebrief(page, hasTouch, first.row);
    // The server is gone: a missed file would have failed, and every request stays on its origin.
    expect(log.urls.slice(before).filter((url) => !url.startsWith(server.baseURL))).toEqual([]);
    expect(log.failed).toEqual([]);
  } finally {
    await context.close();
    await server.close();
  }
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
