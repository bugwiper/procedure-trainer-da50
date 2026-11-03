# Phase 8: Offline PWA and Real-Device Hardening - Context

**Gathered:** 2026-11-03
**Status:** Planned in lean form per `.planning/WORKFLOW.md` (no research, no discuss log, no plan-checker); decisions below are planner defaults, the owner may veto any of them; plans 08-01 to 08-03

<domain>
## Phase Boundary

PLT-02: "App installs as a PWA and works offline." The trainer installs from desktop Chrome/Edge, Android Chrome and iOS/iPadOS Safari, launches standalone, runs every situation with the network off, and takes a new deploy without a blank screen or stale-asset errors, all under the GitHub Pages base path `/procedure-trainer-da-50/`. The owner works remote and has no device at hand: everything that can be proven here is proven by Playwright; the rest is a short owner device checklist (`docs/DEVICE-CHECKLIST.md`), not a blocking criterion.

Out of scope: push, background sync, runtime caching of anything the build did not emit, caching of paid or encrypted packs (they never enter the public bundle; the `EntitlementProvider` and `PackRepository` seam stays untouched), an in-app install button (`beforeinstallprompt` UI), an offline banner, app shortcuts, store screenshots in the manifest, an orientation lock, and the deferred WebKit retry of a failed chunk import (todo `2026-10-21-review-warnings-hardening.md`; with a precached chunk it cannot happen offline).

</domain>

<decisions>
## Implementation Decisions

### Tool and worker
- **D-01 (planner, owner may veto):** A small hand-written service worker, stamped at build time by a ~100-line in-repo Vite plugin (`scripts/pwa/`), not `vite-plugin-pwa` and not Workbox. Reason: `vite-plugin-pwa` 2.0.0 (the "later phase" entry of `research/STACK.md`) is only a wrapper; the work is done by `workbox-build` 7.4.1, which pulls `@babel/core`, `@babel/preset-env`, `rollup`, `terser`, `ajv`, `glob` and about twenty `workbox-*` packages into a project whose tech-stack table pins every dependency and whose Dependabot and CI surface we keep small; Vite 8 runs on Rolldown, so a plugin that depends on Rollup internals is a compatibility risk we would own anyway. Our need is one precache list, cache-first for those files, one waiting-worker flow: about 100 lines we can read, test and replay. No new npm package in this phase.
- **D-02:** The worker is `sw.js` at the base root (`<base>sw.js`), scope = the base (the default, no `Service-Worker-Allowed` header), registered with `import.meta.env.BASE_URL` and `updateViaCache: 'none'`, in production builds only (`import.meta.env.PROD`), never in `vite dev`. All entries of the precache list are relative to the scope and resolved in the worker with `registration.scope`, so the build stays host-agnostic (PLT-01) and the manifest needs no base path. Registration errors and an `undefined` registration are swallowed (see Pitfalls); the app never depends on the worker.
- **D-03:** Precache = every file the build emits (`index.html`, all JS chunks including every `pack-*` chunk, the CSS, all font files) plus every file of `public/` (manifest, icons), minus source maps and `sw.js`. No runtime caching: cache-first for precached same-origin GET requests; a navigation inside the scope gets the cached `index.html` regardless of the query string (the `?scene=`, `?q=`, `?flags=` preview flags keep working); everything else goes to the network untouched. Install fetches with `cache: 'reload'` (Pages sends `max-age=600`, an old HTTP-cached `index.html` must not mix with new chunks) and fails as a whole if one file fails, so the old worker stays.
- **D-04:** Version = build hash: first 12 hex of SHA-256 over the sorted pairs (path, SHA-256 of content) of every precached file. Cache name `da50-precache-<id>`; the id and the list are written into `sw.js`, so any change in any precached file makes `sw.js` byte-different, which is the browser's update trigger. Activate deletes every other `da50-precache-*` cache and claims the open clients. The previous cache is not kept; a second tab left open on the old page can hit a lazy pack chunk of the old hash and gets the existing "pack cannot be loaded" message (D-05 shows that tab the reload notice as well).

### Update flow
- **D-05 (owner brief):** A new worker installs and waits; it never calls `skipWaiting` by itself. The page shows a calm notice (static label, no animation, no timer, no sound, `role="status"`, one button of at least 44 px) only while the screen is the free panel (not choosing, briefing, running or debrief). The tap sends `SKIP_WAITING`; the page reloads once on `controllerchange`, only in the tab whose user tapped. A tab that sees `controllerchange` without a tap (another tab applied the update) shows the same notice and reloads on its own tap, never by itself. Update checks: the browser's own check at navigation plus `registration.update()` when the tab turns visible at least 30 minutes after the last check (an installed app resumes without a navigation).

### Manifest, icons, iOS
- **D-06:** `public/manifest.webmanifest`, all URLs relative (`start_url` and `scope` `./`, `id` `./`), `display: standalone`, `name` "DA50 RG Procedure Trainer", `short_name` "DA50 Trainer", `background_color` and `theme_color` `#0b0d10` (same as the `theme-color` meta and the stage background), icons 192 and 512 (`any`) and 512 `maskable`, no orientation lock (the portrait rotate hint stays the way to say "landscape is better"), no screenshots, no shortcuts.
- **D-07:** Icons are generated by `scripts/make-icons.mjs` (`npm run icons`) with the Playwright Chromium that is already a dev dependency: own vector art made only of marks that stand on the panel (the DA50RG type name, the GO-AROUND mark, the panel's bezel grey and glass black), the B612 bold face from `@fontsource`. The PNGs (`public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-touch-icon.png` at 180, `favicon-32.png`) are committed; CI never regenerates them. Brand rule holds: no maker name, no RUBIN mark, no logo, swoosh, bird, wordmark shape or registration (content policy section 7). The composition is a placeholder the owner may replace by overwriting the PNGs.
- **D-08:** iOS: `apple-touch-icon` (opaque, full bleed), `apple-mobile-web-app-capable` and `mobile-web-app-capable` yes, `apple-mobile-web-app-title`, status bar style `black`. No `viewport-fit=cover`: Safari then keeps the page inside the safe area, so the panel cannot slide under the notch or the home indicator; the real insets stay a device-checklist item. The `data:,` favicon of `index.html` is replaced by the PNG.

### Tests
- **D-09:** `playwright.config.ts` gets `serviceWorkers: 'block'` as the default, so the 40-odd existing specs stay deterministic (a page route does not see requests a worker answers); the PWA specs opt in with `test.use({ serviceWorkers: 'allow' })`. The PWA specs need no `@hooks`, so they also run against the live site (`PW_BASE_URL`); specs that need the private static server carry `@local` in the title and are excluded in live mode like `@hooks`. The update flow is tested against a private node static server that serves a temp copy of `dist-e2e` under the base path and "ships a new version" by changing the copy's `sw.js` (build id) and a marker in `index.html`; the same server is closed to prove the network is really gone.
- **D-10:** PWA specs run on all seven projects. A real engine gap found by the first run (WebKit on the Linux runner) is handled by a feature probe in the spec with the reason in the title and in the SUMMARY, never by skipping a whole project; the CDP installability check is Chromium only.
- **D-11 (owner brief):** Items that need a real device (install on iPhone, iPad, Android and desktop, airplane mode, safe-area insets, `100dvh` with the browser bars, touch flow, the old todo "real iPad check") go into `docs/DEVICE-CHECKLIST.md` in own words, as the last task; they are not blocking.
- **D-12:** The CI workflow needs no change: `verify` builds with `BASE_PATH` and uploads `dist` (now with `sw.js`, the manifest and the icons), `e2e` builds `dist-e2e` and runs every project.
- **D-13 (planner, owner may veto):** The About dialog gets one static line, "Offline: ready, version <id>" (or "Offline: not available"), read from the active worker over a message, so the owner can tell on a device which deploy is installed and whether the cache is complete. It is not on the panel (G-0 untouched).
- **D-14 (gates):** After each task the targeted vitest and the touched PWA specs on desktop-chromium, phone-chromium and desktop-webkit, run with `PW_PORT` set so the build is fresh. At the end of 08-03 only: `rm -rf node_modules/.vitest-cache`, the whole vitest, typecheck, lint, format:check, validate and Playwright on all seven projects (delegated to a subagent, result verified by the caller). `.planning/config.json` and `state.json` are not touched; nothing is pushed.

### Claude's Discretion
- Placement and wording of the update notice (bottom edge of the panel area, no layout shift, clear of the Full panel button), the icon composition details, the exact marker mechanism of the worker template, the name of the exported helpers, the wording of the checklist items.

</decisions>

<pitfalls>
## Pitfalls (verified by a probe on 2026-11-03 where marked)

- **Playwright `serviceWorkers: 'block'`: `navigator.serviceWorker.register()` resolves with `undefined`, not a registration** (verified on Chromium and WebKit, Playwright 1.64.1, macOS). The registration code must treat that as "no worker" and must not read `.scope` or `.addEventListener` of it.
- **Offline with a worker works in both engines** (verified on macOS): after the worker controls the page, `context.setOffline(true)` plus a reload is served from the cache with zero hits on the server; an uncached `fetch` fails. Wait for `navigator.serviceWorker.controller` before going offline (the first load is controlled only after `clients.claim()`).
- A page route (`page.route`) does not see requests a worker answers, hence the default block (D-09). `context.serviceWorkers()` is Chromium only.
- `setOffline` alone does not prove "no network": the worker answers from the cache and the network never comes into play for cached files, but a missed file would still fetch successfully in a normal online run. The private-server specs close the server, and every spec asserts that all requests stay under the base path and the origin.
- WebKit on Linux (the CI runner): the probe ran on macOS only. Service worker support, offline reload and update on the Linux build are confirmed by the first CI run of 08-01; Playwright's WebKit never shows install UI or reads the manifest, so installability is proven on Chromium only and on iOS by the device checklist.
- Worker scope: a worker under `/procedure-trainer-da-50/sw.js` controls only URLs below that path; the Pages redirect from the no-slash URL leaves the scope, which is harmless (the redirect target is inside).
- GitHub Pages sends `Cache-Control: max-age=600`: browsers bypass the HTTP cache for the worker script itself; the precache install uses `cache: 'reload'` for the rest (D-03).
- iOS home-screen apps have their own storage: the first-run acknowledgment and the Sound choice start fresh after "Add to Home Screen"; that is expected and goes into the checklist.
- A repeated `reload()` loop: the page reloads only after its own `SKIP_WAITING` request, once.

</pitfalls>

<success_criteria_check>
## ROADMAP success criteria against the plans

| # | Criterion | Automated here | Owner device checklist |
|---|-----------|----------------|------------------------|
| 1 | Install from iOS/iPadOS Safari, Android Chrome, desktop Chrome/Edge; launches standalone | 08-02: manifest fields, icons (decoded size), iOS tags, start_url inside the worker scope under the base, Chromium `getInstallabilityErrors` empty | install on each device, standalone launch, icon looks right |
| 2 | After one online load, airplane mode: start, play, finish, debrief every scenario | 08-01: every precached file answered from the cache offline, every shipped scenario started and completed to the debrief with the network off (and, on Chromium and WebKit, with the private server closed) | the same with the real airplane mode, relaunch from the home screen |
| 3 | New deploy without blank screen or stale-asset errors, assets under the base path | 08-01 and 08-03: all requests under the base, waiting worker, notice only on the free panel, reload on tap, caches swapped, no change during a run, second tab | update on an installed app |
| 4 | Full flow by touch on a real iPhone, iPad and Android phone | the emulated touch projects (phone, tablet, portrait) run the whole suite and the offline flow | the touch flow, safe area, `100dvh`, the old iPad todo |

Criteria 1 and 4 can only be closed by the owner's device round; the phase is "executed, awaiting device round" until then, like earlier phases await UAT.

</success_criteria_check>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` PLT-02; `.planning/ROADMAP.md` Phase 8; `.planning/research/STACK.md` (vite-plugin-pwa entry, superseded by D-01).
- `vite.config.ts` (base from `BASE_PATH`, one chunk per pack), `index.html`, `.github/workflows/deploy.yml`, `playwright.config.ts` (projects, `PW_PORT`, `PW_BASE_URL`, accepted-ack storage state), `e2e/support/session.ts` (`shippedScenarios`, `startScenario`), `src/ui/ack.ts` (`ACK_STORAGE_KEY`, `ACK_VERSION`).
- `docs/CONTENT-POLICY.md` section 7 (brand rule for artwork), `tests/brand.test.ts`, `.planning/todos/pending/2026-10-21-real-ipad-check.md` (folded into the checklist).

</canonical_refs>
