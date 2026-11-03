// The offline worker of the trainer (PLT-02). The build (scripts/pwa/plugin.ts) replaces the two
// lines below by the build id and the precache list and emits the result as sw.js at the base root.
// It precaches every file of the build, answers them cache-first and touches nothing else.
const BUILD_ID = 'dev'; // @build-id
const PRECACHE = []; // @precache

const CACHE_PREFIX = 'da50-precache-';
const CACHE_NAME = CACHE_PREFIX + BUILD_ID;

/** Absolute URL of a list entry or of the scope root, resolved against the scope. */
const inScope = (path) => new URL(path, self.registration.scope).href;
let hrefs = null;
const precachedHrefs = () => (hrefs ??= new Set(PRECACHE.map(inScope)));

async function install() {
  // Every file is fetched past the HTTP cache (Pages sends max-age=600) and must answer ok and
  // unredirected; one failure fails the install as a whole, so the old worker stays in charge.
  const responses = await Promise.all(
    PRECACHE.map(async (path) => {
      const href = inScope(path);
      const response = await fetch(new Request(href, { cache: 'reload' }));
      if (!response.ok || response.redirected) {
        throw new Error(`precache of ${href} failed (${response.status})`);
      }
      return [href, response];
    }),
  );
  const cache = await caches.open(CACHE_NAME);
  try {
    await Promise.all(responses.map(([href, response]) => cache.put(href, response)));
  } catch (error) {
    await caches.delete(CACHE_NAME);
    throw error;
  }
}

async function activate() {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)),
  );
  await self.clients.claim();
}

/** The cached answer for a URL, or the network when the cache has lost it. */
async function cached(request, href) {
  const hit = await caches.match(href, { cacheName: CACHE_NAME });
  return hit ?? fetch(request);
}

self.addEventListener('install', (event) => {
  event.waitUntil(install());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(activate());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // Only the shell: the scope root or its index.html, whatever the query string or hash.
    const shell = inScope('index.html');
    const root = inScope('./');
    const bare = url.origin + url.pathname;
    if (bare === root || bare === shell) event.respondWith(cached(request, shell));
    return;
  }
  url.hash = '';
  if (precachedHrefs().has(url.href)) event.respondWith(cached(request, url.href));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting();
});
