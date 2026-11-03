---
phase: 08-offline-pwa-and-real-device-hardening
plan: 01
subsystem: build, ui, e2e
tags: [pwa, service-worker, offline, precache, vite-plugin, playwright]
status: complete

requires:
  - phase: 07
    provides: the finished learning loop (the offline specs run its start-to-debrief flow)
provides:
  - "scripts/pwa: pure precache list and build id (precache.ts), the worker template (sw.js), the build-only Vite plugin (plugin.ts) that emits sw.js at the output root"
  - "src/ui/pwa/register.ts: production-only registration under import.meta.env.BASE_URL, swallows refusals and a blocked worker; called after the first render"
  - "playwright.config: serviceWorkers 'block' as the default (D-09), @local excluded in live mode"
  - "e2e/pwa-offline.spec.ts, e2e/support/pwa.ts, e2e/support/pwa-server.ts (private static server, reused by 08-03), tests/pwa-precache.test.ts"
affects: [08-02, 08-03]

actuals:
  tokens: 12500
  tasks: 3
  commits: 3
plan_head_before: df04127200b00ee7b5443b0539d73d73afbc3622
plan_head_after: 2eb673b8f13f0b52028572eff0f6d37d090b052f

key-files:
  created:
    - scripts/pwa/precache.ts
    - scripts/pwa/plugin.ts
    - scripts/pwa/sw.js
    - src/ui/pwa/register.ts
    - e2e/pwa-offline.spec.ts
    - e2e/support/pwa.ts
    - e2e/support/pwa-server.ts
    - tests/pwa-precache.test.ts
  modified:
    - vite.config.ts
    - tsconfig.node.json
    - eslint.config.js
    - src/main.tsx
    - playwright.config.ts

key-decisions:
  - "Cache is written only after every file was fetched ok and unredirected (fetch all, then open and put), so a failed install never leaves a half-filled cache of the new id; a put failure deletes the cache"
  - "Imports inside vite.config.ts and scripts/pwa carry the .ts extension (tsconfig.node.json gets allowImportingTsExtensions): Vite 8's native config loader warns on extensionless imports"
  - "The precache list excludes dotfiles as well as maps and sw.js (a .DS_Store in public/ would otherwise be published); the spec's independent walk applies the same rule"
  - "The worker's routing is also unit-tested in a fake scope (node:vm), not only through the browser"

requirements-completed: [PLT-02 (offline half)]
---

# Phase 8 Plan 01: Offline worker, precache and offline specs Summary

A hand-written service worker, stamped at build time by a ~60-line in-repo Vite plugin, precaches the whole build (index.html, every JS chunk including each pack chunk, the CSS, all fonts, plus public/ once it exists) and answers it cache-first under the base path; Playwright proves that every shipped scenario runs from start to debrief with the network off on all seven projects.

## What was built

- **Precache and id (`scripts/pwa/precache.ts`)**: `precacheEntries(bundle, publicFiles)` (sorted, one entry per path, bundle wins, no maps, no `sw.js`, no dotfiles, separators normalised), `buildId` (first 12 hex of SHA-256 over the sorted path and content-hash pairs), `renderWorker` (replaces the two marker lines, throws unless each marker occurs exactly once).
- **Worker (`scripts/pwa/sw.js`)**: install fetches every entry with `cache: 'reload'`, fails as a whole on a non-ok or redirected answer; activate deletes every other `da50-precache-*` cache and claims clients; fetch answers only same-origin GET: precached URLs (exact href, query string must match) cache-first, navigations to the scope root or its `index.html` with the cached shell whatever the query or hash, everything else untouched; `SKIP_WAITING` message calls `skipWaiting` (never by itself); nothing is cached after install.
- **Plugin (`scripts/pwa/plugin.ts`)**: `apply: 'build'`, `generateBundle` order post, reads `config.publicDir` (absent allowed), emits asset `sw.js`. Registered in `vite.config.ts`; `scripts/pwa/**/*.ts` is in `tsconfig.node.json`; `eslint.config.js` has a block giving only `scripts/pwa/sw.js` the worker globals.
- **Registration (`src/ui/pwa/register.ts`)**: PROD only, `serviceWorker` in navigator, scope and URL from `BASE_URL`, `updateViaCache: 'none'`, errors and an `undefined` registration swallowed; called from `src/main.tsx` after the render.
- **Playwright**: default `serviceWorkers: 'block'`; `grepInvert` is `/@hooks|@local/` in live mode.

## Tests

- `tests/pwa-precache.test.ts`: 15 cases (list content and order, exclusions, id stable and sensitive to one byte, an added, removed or renamed file; rendered worker parses with `node:vm`, holds id and every entry, leaves no marker; routing of the worker in a fake scope: precached GET answered, other URL, query variant, POST, cross-origin untouched, shell navigation with any query, other navigations untouched, skipWaiting only on the message; one `.put(` in the source, no eval).
- `e2e/pwa-offline.spec.ts` (12 distinct cases, 84 test runs over seven projects incl. pack tests, 5 skipped by design):
  1. offline reload shows the panel; scope equals the base URL, script directly under it; no request outside origin and base, no console error
  2. cache holds exactly the list (resolved against the scope) under `da50-precache-<id>`; every listed URL answers 200 offline from inside the page
  3. navigation with a query string and `index.html?flags=x#top` shows the shell offline; `./not-a-page/` is left to the (off) network and rejects
  4. `@local`: the list equals an independent walk of `dist-e2e`; one `pack-<name>` chunk per pack folder with a scenario file (from the file system); font files equal; cached bytes equal disk bytes (SHA-256)
  5. `@local`: private server with one pack chunk removed: the install asked for it (404 counted), no registration or worker is left, no controller, no cache
  6. full flow: every entry of `shippedScenarios()` started (easy), Procedure complete, debrief, Back to panel, network off after one online install; run count equals the list length; all requests under the base, none failed, no console error
  7. one test per pack (engine, electrical, fire, icing; derived) so a failure names the pack
  8. `@local` desktop-chromium and desktop-webkit: private server closed after install, reload, one scenario to the debrief
  9. blocked default: `register()` resolves with `undefined`, no controller, no console error (Pitfall verified first-hand on Playwright 1.64.1, Chromium and WebKit; L-03 needed no adaptation)
- Mutation check: replacing the install's ok check by `false` makes case 5 fail (restored).

## Verification

| Gate | Result |
| --- | --- |
| `rm -rf node_modules/.vitest-cache && npx vitest run` | 84 files, 4135 tests passed |
| `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` | clean; 10 scenario files, 0 problems |
| `e2e/pwa-offline.spec.ts`, seven projects, macOS, `PW_PORT=4402` | 79 passed, 5 skipped (the closed-server case on the five non-desktop projects, by design) |
| Same spec in `mcr.microsoft.com/playwright:v1.64.1-noble` (git archive of HEAD, `npm ci`, `CI=1`, `--retries=0`) | 79 passed, 5 skipped, WebKit included; no feature probe or skip needed |
| Existing suite spot check (scenario, loop, further, session-area, layout, smoke) on desktop-chromium and phone-portrait | 113 passed, 1 skipped (not from this plan) |

Which project ran which case: cases 1 to 3, 6, 7, 9 and `@local` 4 and 5 ran on all seven projects (desktop, phone, tablet on Chromium and WebKit, phone-portrait); case 8 ran on desktop-chromium and desktop-webkit and is skipped on the other five (plan: two desktop projects). The CI Linux result on the owner's push is expected to match the Linux image result; the image ran on the host's architecture (Apple Silicon, Linux arm64), not x64.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extensionless imports in the Vite config warn under the native config loader**
- **Found during:** Task 1 build
- **Issue:** `import ... from './scripts/pwa/plugin'` (and `./precache`) printed a "unsupported by configLoader native" warning on every build.
- **Fix:** `.ts` extensions on those three imports and `allowImportingTsExtensions` in `tsconfig.node.json` (`noEmit` is already on).
- **Files modified:** vite.config.ts, scripts/pwa/plugin.ts, tsconfig.node.json
- **Commit:** 43e17d8

**2. [Rule 1 - Bug] `waitForControl` returned too early**
- **Found during:** Task 1 first run
- **Issue:** `page.waitForFunction` with an async predicate treated the returned promise as truthy, so the helper returned before a worker was active (script URL read as empty).
- **Fix:** the helper waits on `navigator.serviceWorker.ready` and the worker's `activated` state in one `evaluate`, then polls the synchronous `controller !== null`.
- **Commit:** 43e17d8

### Plan details handled differently

- The install writes to the cache only after all fetches succeeded (stronger than the plan's "fail as a whole").
- The dotfile exclusion in the precache list was added by me (not in the plan) for the future `public/` directory; it is covered by a unit test.
- The worker routing got a unit test in a fake scope in addition to the e2e cases.
- The `@local` closed-server case is the only one that is skipped inside a test body (`test.skip` on the project name); no project is skipped as a whole and no engine gap needed a probe.

Known side effect: `vite build` for any output (also `dist-e2e`) now emits `sw.js`; the e2e build serves it, but registration happens only in specs that opt in.

## Auth gates

None.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (T-08-01 to T-08-03 are mitigated by the unit and e2e cases above: only precached same-origin GET and the exact shell navigation answered, nothing cached after install, list from the build output and `public/` only with an independent walk comparing it).

## Not verified here

- Install prompt, standalone launch and real airplane mode on a device (08-02 and the device checklist).
- CI Linux result on the owner's push (the Linux image run stands in for it).
- The update flow with a waiting worker (08-03; `startPrivateServer` has `replaceText` for it).
- `.planning/STATE.md`, ROADMAP progress and `config.json`/`state.json` were not updated by this executor (instructions: never touch `config.json` and `state.json`; the orchestrator owns the phase bookkeeping).

## Self-Check: PASSED

- Files present: scripts/pwa/precache.ts, plugin.ts, sw.js; src/ui/pwa/register.ts; e2e/pwa-offline.spec.ts; e2e/support/pwa.ts; e2e/support/pwa-server.ts; tests/pwa-precache.test.ts.
- Commits are ancestors of HEAD: 43e17d8, 15730bc, 2eb673b.
