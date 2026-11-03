import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  cachedUrls,
  collectRequests,
  linkedManifest,
  pngSize,
  registrationOf,
  waitForControl,
} from './support/pwa';
import type { LinkedManifest } from './support/pwa';

// PLT-02, ROADMAP criteria 1 and 3 (the install half): the page links a manifest that satisfies the
// installability criteria under the base path. Workers are opt-in (D-09). No case needs the e2e
// window hook, so the file also runs against the live site. Playwright's WebKit never reads a
// manifest or shows install UI, so the browser's own verdict is asked on Chromium only (D-10); on
// every project the criteria are walked by hand from the linked document.
test.use({ serviceWorkers: 'allow' });

interface ManifestIcon {
  src?: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

/** The `WxH` sizes an icon declares, as numbers (a square icon declares one pair). */
const declaredSizes = (icon: ManifestIcon): { width: number; height: number }[] =>
  (icon.sizes ?? '')
    .split(/\s+/)
    .filter((token) => /^\d+x\d+$/.test(token))
    .map((token) => {
      const [width, height] = token.split('x').map(Number);
      return { width: width ?? 0, height: height ?? 0 };
    });

const hasIconOf = (icons: readonly ManifestIcon[], side: number): boolean =>
  icons.some((icon) => declaredSizes(icon).some((s) => s.width === side && s.height === side));

/** The installability criteria of Chromium, written down by hand and independent of the build. */
async function walkCriteria(page: Page, manifest: LinkedManifest): Promise<string[]> {
  const problems: string[] = [];
  const data = manifest.json;
  if (manifest.status !== 200) problems.push(`manifest status ${manifest.status}`);
  if (!/json/i.test(manifest.contentType)) problems.push(`media type ${manifest.contentType}`);
  const name = data['name'] ?? data['short_name'];
  if (typeof name !== 'string' || name === '') problems.push('no name or short_name');
  const icons = (data['icons'] ?? []) as ManifestIcon[];
  if (!hasIconOf(icons, 192)) problems.push('no icon of 192x192');
  if (!hasIconOf(icons, 512)) problems.push('no icon of 512x512');
  if (icons.some((icon) => icon.type !== undefined && icon.type !== 'image/png')) {
    problems.push('an icon is not declared as PNG');
  }
  const startUrl = data['start_url'];
  if (typeof startUrl !== 'string' || startUrl === '') problems.push('no start_url');
  if (!['standalone', 'fullscreen', 'minimal-ui'].includes(String(data['display']))) {
    problems.push(`display ${String(data['display'])}`);
  }
  if (data['prefer_related_applications'] === true) problems.push('prefers related applications');
  if (!(await page.evaluate(() => window.isSecureContext))) problems.push('not a secure context');

  // start_url inside the manifest scope and inside the scope of the registered worker.
  if (typeof startUrl === 'string') {
    const start = new URL(startUrl, manifest.url).href;
    const declaredScope = data['scope'];
    const scope = new URL(typeof declaredScope === 'string' ? declaredScope : '.', manifest.url)
      .href;
    if (!start.startsWith(scope)) problems.push(`start_url ${start} is outside the scope ${scope}`);
    const registration = await registrationOf(page);
    if (registration === null) problems.push('no registered worker');
    else if (!start.startsWith(registration.scope)) {
      problems.push(`start_url ${start} is outside the worker scope ${registration.scope}`);
    }
  }
  return problems;
}

test('the linked manifest passes the hand-written installability criteria', async ({
  page,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await waitForControl(page);
  const manifest = await linkedManifest(page);
  expect(manifest.url.startsWith(baseURL)).toBe(true);
  expect(await walkCriteria(page, manifest)).toEqual([]);
  // The installed app starts at the base path, so its assets resolve below it (criterion 3).
  const start = new URL(String(manifest.json['start_url']), manifest.url);
  expect(start.href).toBe(baseURL);
});

test('every manifest icon is a PNG of its declared size', async ({ page }) => {
  await page.goto('./');
  const manifest = await linkedManifest(page);
  const icons = (manifest.json['icons'] ?? []) as ManifestIcon[];
  expect(icons.length).toBeGreaterThanOrEqual(3);
  for (const icon of icons) {
    expect(icon.src).toBeDefined();
    const response = await page.request.get(new URL(icon.src ?? '', manifest.url).href);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()['content-type'], icon.src).toContain('image/png');
    const size = pngSize(await response.body());
    expect(size, `${icon.src} is a PNG`).not.toBeNull();
    expect(declaredSizes(icon), icon.src).toContainEqual(size);
  }
});

// Probe, Playwright 1.64.1: Page.getAppManifest reports parse and origin errors (a start_url on
// another origin fails this case), but Page.getInstallabilityErrors stays empty in headless
// Chromium even for a manifest without a 512 icon, so only the first answer can fail here and the
// hand-written walk above is the installability check.
test('Chromium reports no manifest error and no installability error (CDP, Chromium only; the installability answer is weak in headless, the hand-written walk is the criterion)', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'CDP exists on Chromium only; the criteria walk covers the rest',
  );
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await waitForControl(page);
  const session = await context.newCDPSession(page);
  const app = (await session.send('Page.getAppManifest')) as {
    url?: string;
    errors: { message: string }[];
  };
  expect(app.errors.map((error) => error.message)).toEqual([]);
  expect(app.url).toBeTruthy();
  const verdict = (await session.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: { errorId: string }[];
  };
  expect(verdict.installabilityErrors.map((error) => error.errorId)).toEqual([]);
});

/** `<meta name=... content=...>` of the live DOM, or null. */
const metaContent = (page: Page, name: string): Promise<string | null> =>
  page.evaluate(
    (key) => document.querySelector(`meta[name="${key}"]`)?.getAttribute('content') ?? null,
    name,
  );

test('the built page carries the iOS tags, a 180 apple icon and the manifest theme colour', async ({
  page,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  await page.goto('./');
  const manifest = await linkedManifest(page);

  expect(await metaContent(page, 'apple-mobile-web-app-capable')).toBe('yes');
  expect(await metaContent(page, 'mobile-web-app-capable')).toBe('yes');
  expect(await metaContent(page, 'apple-mobile-web-app-title')).toBe(manifest.json['short_name']);
  expect(await metaContent(page, 'apple-mobile-web-app-status-bar-style')).toBe('black');
  expect(await metaContent(page, 'theme-color')).toBe(manifest.json['theme_color']);
  // Safari keeps the page inside the safe area only when the viewport does not ask for the cover.
  expect(await metaContent(page, 'viewport')).not.toMatch(/viewport-fit/i);

  const apple = await page.evaluate(
    () => document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.href ?? '',
  );
  expect(apple.startsWith(baseURL)).toBe(true);
  const response = await page.request.get(apple);
  expect(response.status()).toBe(200);
  expect(pngSize(await response.body())).toEqual({ width: 180, height: 180 });

  // The favicon is a PNG under the base, no longer an empty data URL.
  const favicon = await page.evaluate(
    () => document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href ?? '',
  );
  expect(favicon.startsWith(baseURL)).toBe(true);
  expect((await page.request.get(favicon)).status()).toBe(200);
});

test('the manifest and every icon answer 200 from the cache with the network off', async ({
  page,
  context,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await waitForControl(page);
  const manifest = await linkedManifest(page);
  const icons = (manifest.json['icons'] ?? []) as ManifestIcon[];
  const apple = await page.evaluate(
    () => document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.href ?? '',
  );
  const urls = [
    manifest.url,
    apple,
    ...icons.map((icon) => new URL(icon.src ?? '', manifest.url).href),
  ];

  await context.setOffline(true);
  const answers = await page.evaluate(async (list) => {
    const out: { url: string; status: number; bytes: number }[] = [];
    for (const url of list) {
      const response = await fetch(url);
      out.push({ url, status: response.status, bytes: (await response.arrayBuffer()).byteLength });
    }
    return out;
  }, urls);
  for (const answer of answers) {
    expect(answer.status, answer.url).toBe(200);
    expect(answer.bytes, answer.url).toBeGreaterThan(0);
  }
  // And the cache holds them under the scope, which is what answered.
  const cached = await cachedUrls(page);
  for (const url of urls) expect(cached, url).toContain(url);
});

test('every request of the install checks stays on one origin under the base path', async ({
  page,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error('baseURL missing');
  const log = collectRequests(page);
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
  await waitForControl(page);
  const manifest = await linkedManifest(page);
  const icons = (manifest.json['icons'] ?? []) as ManifestIcon[];
  for (const icon of icons) await page.request.get(new URL(icon.src ?? '', manifest.url).href);
  await page.reload();
  await expect(page.getByTestId('panel')).toBeVisible();

  expect(log.urls.length).toBeGreaterThan(0);
  expect(log.outside(baseURL)).toEqual([]);
  expect(log.failed).toEqual([]);
  expect(log.consoleErrors).toEqual([]);
});
