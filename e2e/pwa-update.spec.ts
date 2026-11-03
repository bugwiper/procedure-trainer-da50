import { expect, test as base } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import {
  cacheNames,
  collectRequests,
  privateContext,
  waitForControl,
  workerStamp,
} from './support/pwa';
import { startPrivateServer } from './support/pwa-server';
import type { PrivateServer } from './support/pwa-server';
import {
  OFFLINE_READY_PREFIX,
  OFFLINE_UNAVAILABLE,
  UPDATE_BUTTON_LABEL,
  UPDATE_NOTICE_TEXT,
} from '../src/ui/pwa/update';
import { chooseScenario, shippedScenarios } from './support/session';
import { activate } from './support/zoom';

// PLT-02, ROADMAP criterion 3 and D-05: a new deploy installs and waits, the free panel shows a
// calm notice, one tap reloads into the new version once. The new version is shipped by a private
// server that serves a temp copy of the e2e build (e2e/support/pwa-server.ts), so these cases need
// the build output on disk and carry @local in the title.

interface Site {
  readonly server: PrivateServer;
  readonly context: BrowserContext;
  readonly hasTouch: boolean;
  /** Opens a page on the private site and waits until its worker controls it. */
  open(): Promise<Page>;
}

const test = base.extend<{ site: Site }>({
  site: async (
    { browser, baseURL, viewport, userAgent, hasTouch, isMobile, deviceScaleFactor },
    use,
  ) => {
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
      await use({
        server,
        context,
        hasTouch,
        open: async () => {
          const page = await context.newPage();
          await page.goto(server.baseURL);
          await expect(page.getByTestId('panel')).toBeVisible();
          await waitForControl(page);
          return page;
        },
      });
    } finally {
      await context.close();
      await server.close();
    }
  },
});

/** Sets a window variable that a reload would drop, to prove a page did not reload. */
async function markPage(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.assign(window, { stayedLoaded: true });
  });
}

const stayedLoaded = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { stayedLoaded?: boolean }).stayedLoaded === true);

/** Asks the browser for a newer worker script, the way the page's own check does. */
async function checkNow(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });
}

/** Counts the main-frame navigations from now on (a reload counts one). */
function countNavigations(page: Page): { readonly count: () => number } {
  let navigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations += 1;
  });
  return { count: () => navigations };
}

/** Whether the page's HTML carries the marker comment of a deployment. */
const hasMarker = (page: Page, marker: string): Promise<boolean> =>
  page.evaluate((text) => document.documentElement.outerHTML.includes(text), marker);

test('a new deploy waits, the free panel shows a calm notice and one tap reloads into it @local', async ({
  site,
}) => {
  const { server, context, hasTouch } = site;
  const page = await site.open();
  const log = collectRequests(page, context);
  const before = await workerStamp(page, server.baseURL);
  expect(await cacheNames(page)).toEqual([`da50-precache-${before.id}`]);
  await markPage(page);
  const navigations = countNavigations(page);

  const next = server.deployNewVersion();
  expect(next.id).not.toBe(before.id);
  await checkNow(page);

  // The notice: the fixed sentence and one button, as a status; the page did not reload by itself.
  const notice = page.getByTestId('update-notice');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute('role', 'status');
  await expect(notice).toContainText(UPDATE_NOTICE_TEXT);
  await expect(notice.getByRole('button')).toHaveText(UPDATE_BUTTON_LABEL);
  await expect(notice.getByRole('button')).toHaveCount(1);
  const button = await page.getByTestId('update-apply').boundingBox();
  expect(button?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(await stayedLoaded(page)).toBe(true);
  expect(navigations.count()).toBe(0);
  // The new worker installed and waits: both caches exist, the old worker still controls the page.
  expect((await cacheNames(page)).sort()).toEqual(
    [`da50-precache-${before.id}`, `da50-precache-${next.id}`].sort(),
  );

  // One tap: one reload into the new version.
  await Promise.all([
    page.waitForEvent('load'),
    activate(page.getByTestId('update-apply'), hasTouch),
  ]);
  await expect(page.getByTestId('panel')).toBeVisible();
  await waitForControl(page);
  expect(await stayedLoaded(page)).toBe(false);
  expect(await hasMarker(page, next.marker)).toBe(true);
  await expect(page.getByTestId('update-notice')).toHaveCount(0);
  await expect.poll(() => cacheNames(page)).toEqual([`da50-precache-${next.id}`]);
  expect((await workerStamp(page, server.baseURL)).id).toBe(next.id);
  await page.waitForTimeout(500);
  expect(navigations.count()).toBe(1);

  // The new version works with the network really gone.
  await server.close();
  await page.reload();
  await expect(page.getByTestId('panel')).toBeVisible();
  expect(await hasMarker(page, next.marker)).toBe(true);
  expect(log.outside(server.baseURL)).toEqual([]);
});

// Workers are blocked by default (D-09); the cases on the main preview server opt in. The cases that
// use the `site` fixture bring their own context, which allows workers.
test.use({ serviceWorkers: 'allow' });

// The notice is a calm, static element: the same on every project, never in the way of a run.
const noticeOf = (page: Page) => page.getByTestId('update-notice');

/** The screen the app is on, from the e2e window hook (these cases need the e2e build anyway). */
const screenOf = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => window.__panelSession?.screen());

/** Waits until the registration has a worker that installed and waits (a deploy was found). */
async function expectWaitingWorker(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state ?? 'none',
      ),
    )
    .toBe('installed');
}

function firstScenario() {
  const first = shippedScenarios()[0];
  if (first === undefined) throw new Error('no shipped scenario');
  return first;
}

test('a waiting worker alone never reloads the page, however long it waits @local', async ({
  site,
}) => {
  const page = await site.open();
  await markPage(page);
  const navigations = countNavigations(page);
  site.server.deployNewVersion();
  await checkNow(page);
  await expect(noticeOf(page)).toBeVisible();
  await page.waitForTimeout(2000);
  expect(await stayedLoaded(page)).toBe(true);
  expect(navigations.count()).toBe(0);
  await expect(noticeOf(page)).toBeVisible();
});

test('the notice is there on the free panel and gone in the chooser @local', async ({ site }) => {
  const { server, hasTouch } = site;
  const page = await site.open();
  await markPage(page);
  const navigations = countNavigations(page);
  server.deployNewVersion();
  await checkNow(page);
  await expect(noticeOf(page)).toBeVisible();

  await activate(page.locator('[data-session-hit="session.choose"]'), hasTouch);
  await expect.poll(() => screenOf(page)).toBe('choosing');
  await expect(noticeOf(page)).toHaveCount(0);
  expect(await stayedLoaded(page)).toBe(true);
  expect(navigations.count()).toBe(0);
});

test('an update found during the level card, the briefing, the run and the debrief waits until the free panel @local', async ({
  site,
}) => {
  test.setTimeout(90_000);
  const { server, hasTouch } = site;
  const page = await site.open();
  await markPage(page);
  const navigations = countNavigations(page);
  const log = collectRequests(page, site.context);

  // The level card (screen "briefing"): the deploy is found while the user is deciding.
  await chooseScenario(page, hasTouch, firstScenario().row);
  expect(await screenOf(page)).toBe('briefing');
  server.deployNewVersion();
  await checkNow(page);
  await expectWaitingWorker(page);
  await expect(noticeOf(page)).toHaveCount(0);

  // The briefing card.
  await page.waitForTimeout(450);
  await activate(page.getByTestId('level-pick-easy'), hasTouch);
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(noticeOf(page)).toHaveCount(0);

  // The run: the clock keeps going, nothing reloads, Procedure complete still works.
  await activate(page.getByTestId('briefing-start'), hasTouch);
  await expect(page.getByTestId('procedure-complete')).toBeVisible();
  expect(await screenOf(page)).toBe('running');
  const started = await page.evaluate(() => window.__panelSession?.now() ?? 0);
  await expect
    .poll(() => page.evaluate(() => window.__panelSession?.now() ?? 0))
    .toBeGreaterThan(started);
  await expect(noticeOf(page)).toHaveCount(0);
  expect(await stayedLoaded(page)).toBe(true);

  // The debrief.
  await activate(page.getByTestId('procedure-complete'), hasTouch);
  await expect(page.getByTestId('debrief-result')).toBeVisible();
  expect(await screenOf(page)).toBe('debrief');
  await expect(noticeOf(page)).toHaveCount(0);

  // Back on the free panel the notice appears; the page never reloaded on the way.
  await expect(page.getByTestId('debrief-modal')).not.toHaveAttribute('data-shield', 'on');
  await activate(page.getByTestId('debrief-back'), hasTouch);
  expect(await screenOf(page)).toBe('free');
  await expect(noticeOf(page)).toBeVisible();
  await expect(noticeOf(page)).toContainText(UPDATE_NOTICE_TEXT);
  expect(await stayedLoaded(page)).toBe(true);
  expect(navigations.count()).toBe(0);
  expect(log.consoleErrors).toEqual([]);
});

test('with two tabs one tap updates one tab, the other shows the notice and reloads only on its own tap @local', async ({
  site,
}) => {
  const { server, hasTouch } = site;
  const first = await site.open();
  const second = await site.open();
  await markPage(first);
  await markPage(second);
  const firstNavigations = countNavigations(first);
  const secondNavigations = countNavigations(second);
  const next = server.deployNewVersion();
  await checkNow(first);
  await expect(noticeOf(first)).toBeVisible();
  await expect(noticeOf(second)).toBeVisible();

  await Promise.all([
    first.waitForEvent('load'),
    activate(first.getByTestId('update-apply'), hasTouch),
  ]);
  await expect(first.getByTestId('panel')).toBeVisible();
  expect(await hasMarker(first, next.marker)).toBe(true);

  // The second tab saw the controller change: it keeps the notice and does not reload by itself.
  await expect(noticeOf(second)).toBeVisible();
  await second.waitForTimeout(1500);
  expect(await stayedLoaded(second)).toBe(true);
  expect(secondNavigations.count()).toBe(0);
  expect(await hasMarker(second, next.marker)).toBe(false);

  // Its own tap reloads it, once.
  await Promise.all([
    second.waitForEvent('load'),
    activate(second.getByTestId('update-apply'), hasTouch),
  ]);
  await expect(second.getByTestId('panel')).toBeVisible();
  expect(await stayedLoaded(second)).toBe(false);
  expect(await hasMarker(second, next.marker)).toBe(true);
  await expect(noticeOf(second)).toHaveCount(0);
  await second.waitForTimeout(500);
  expect(secondNavigations.count()).toBe(1);
  expect(firstNavigations.count()).toBe(1);
  await expect.poll(() => cacheNames(first)).toEqual([`da50-precache-${next.id}`]);
});

test('a plain reload after a deploy finds the new worker and shows the notice @local', async ({
  site,
}) => {
  const page = await site.open();
  const next = site.server.deployNewVersion();
  await page.reload();
  await expect(page.getByTestId('panel')).toBeVisible();
  await expect(noticeOf(page)).toBeVisible();
  // Still the old version in front of the user: the new one waits.
  expect(await hasMarker(page, next.marker)).toBe(false);
});

test('About names the version of the worker that controls the page', async ({
  page,
  hasTouch,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await waitForControl(page);
  const stamp = await workerStamp(page, baseURL);
  await activate(page.getByTestId('about-open'), hasTouch);
  await expect(page.getByTestId('about-offline')).toHaveText(`${OFFLINE_READY_PREFIX}${stamp.id}`);
});

test('About shows the new version after the update @local', async ({ site }) => {
  const { server, hasTouch } = site;
  const page = await site.open();
  const before = await workerStamp(page, server.baseURL);
  await activate(page.getByTestId('about-open'), hasTouch);
  await expect(page.getByTestId('about-offline')).toHaveText(`${OFFLINE_READY_PREFIX}${before.id}`);
  await activate(page.getByTestId('about-close'), hasTouch);

  const next = server.deployNewVersion();
  await checkNow(page);
  await expect(noticeOf(page)).toBeVisible();
  // The old worker still controls the page until the tap.
  await activate(page.getByTestId('about-open'), hasTouch);
  await expect(page.getByTestId('about-offline')).toHaveText(`${OFFLINE_READY_PREFIX}${before.id}`);
  await activate(page.getByTestId('about-close'), hasTouch);

  await Promise.all([
    page.waitForEvent('load'),
    activate(noticeOf(page).getByRole('button'), hasTouch),
  ]);
  await expect(page.getByTestId('panel')).toBeVisible();
  await waitForControl(page);
  await activate(page.getByTestId('about-open'), hasTouch);
  await expect(page.getByTestId('about-offline')).toHaveText(`${OFFLINE_READY_PREFIX}${next.id}`);
  expect(next.id).not.toBe(before.id);
});

test.describe('with the worker blocked (the config default)', () => {
  test.use({ serviceWorkers: 'block' });

  test('About says offline is not available and no notice shows', async ({ page, hasTouch }) => {
    await page.goto('./');
    await expect(page.getByTestId('panel')).toBeVisible();
    await activate(page.getByTestId('about-open'), hasTouch);
    await expect(page.getByTestId('about-offline')).toHaveText(OFFLINE_UNAVAILABLE);
    await expect(noticeOf(page)).toHaveCount(0);
  });
});
