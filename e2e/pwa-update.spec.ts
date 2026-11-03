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
import { UPDATE_BUTTON_LABEL, UPDATE_NOTICE_TEXT } from '../src/ui/pwa/update';
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
