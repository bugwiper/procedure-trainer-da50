---
phase: 08-offline-pwa-and-real-device-hardening
plan: 03
subsystem: ui, worker, e2e, docs
tags: [pwa, update-flow, service-worker, about, device-checklist, playwright]
status: complete

requires:
  - phase: 08-01
    provides: the worker, the precache and the private static server (`e2e/support/pwa-server.ts`)
  - phase: 08-02
    provides: manifest, icons, the install specs
provides:
  - "src/ui/pwa/update.ts: the pure rules (notice only on the free screen, 30 minute check gap, one-shot reload gate) and the fixed strings"
  - "src/ui/pwa/register.ts: update state as a signal, applyUpdate, checkForUpdate, readOfflineVersion; reload only through the gate"
  - "src/ui/pwa/UpdateNotice.tsx: the static notice, mounted in the panel area on the free screen"
  - "scripts/pwa/sw.js: VERSION message, messages accepted only from a window client of the worker's scope"
  - "About: one static line `Offline: ready, version <id>` or `Offline: not available`"
  - "e2e/pwa-update.spec.ts (9 cases) and `deployNewVersion()` on the private server"
  - "docs/DEVICE-CHECKLIST.md with tests/device-checklist.test.ts"
affects: []

actuals:
  tokens: 82000
  tasks: 3
  commits: 4
plan_head_before: e0e6cac1230c3a9bc84f527f4c31ff18b4642bd6
plan_head_after: 879426621061a0664b9840f177b9c37fe3a4f1be

key-files:
  created:
    - src/ui/pwa/update.ts
    - src/ui/pwa/UpdateNotice.tsx
    - tests/pwa-update.test.ts
    - tests/device-checklist.test.ts
    - e2e/pwa-update.spec.ts
    - docs/DEVICE-CHECKLIST.md
  modified:
    - src/ui/pwa/register.ts
    - src/ui/App.tsx
    - src/ui/about/About.tsx
    - src/ui/stage.css
    - scripts/pwa/sw.js
    - tests/pwa-precache.test.ts
    - e2e/support/pwa-server.ts
    - e2e/support/pwa.ts
    - e2e/pwa-offline.spec.ts
    - README.md
    - .claude/CLAUDE.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/todos/pending/2026-10-21-real-ipad-check.md

key-decisions:
  - "The reload after a tap waits until the new worker has reached `activated` (statechange), not just controllerchange: WebKit left the new worker in `activating` for good in about half of the runs when the page was reloaded in the middle of the claim"
  - "The notice sits at the top centre over the windscreen, not at the bottom: on a landscape phone the bottom placement covered CHOOSE SITUATION; the top band has no controls, the Full panel button keeps its 120 px corners, and on screens up to 520 px it drops to 96 px below the rotate hint"
  - "The worker accepts SKIP_WAITING and VERSION only from a window client whose URL is inside its own scope (T-08-07), unit-tested in the fake scope"
  - "The 'new deploy' of the private server changes the build id in sw.js and adds a marker comment to index.html only, so the new worker's precache succeeds and the page can tell which version it came from"
  - "privateContext moved from e2e/pwa-offline.spec.ts into e2e/support/pwa.ts so both PWA specs share it"

requirements-completed: [PLT-02 (update half, device round pending)]
---

# Phase 8 Plan 03: Update flow, About version, device checklist and final gates Summary

A new deploy installs and waits; the free panel shows a static notice "A new version is ready." with one 44 px button, a tap reloads once into the new version, and nothing ever reloads or shows a notice during the chooser, a briefing, a run or a debrief; About names the active version; the owner has a short non-blocking device checklist.

## What was built

- **Pure rules (`update.ts`)**: `updateNoticeShown(kind, screen)` is true only for `free` with an update pending; `shouldCheckForUpdate(last, now)` with the 30 minute gap (checks at the boundary); `createReloadGate()` allows one reload, only after `ask()`. The fixed strings (`UPDATE_NOTICE_TEXT`, `UPDATE_BUTTON_LABEL`, `OFFLINE_READY_PREFIX`, `OFFLINE_UNAVAILABLE`, `offlineLine`) live here, and the checklist test quotes them.
- **Glue (`register.ts`)**: `updateAvailable` signal (`waiting` or `stale`); a worker already waiting at load, a worker that reaches `installed` while a controller exists, and a controller change nobody in this tab asked for (a second tab applied the update, state `stale`) all set it. `applyUpdate()` asks the gate, posts `SKIP_WAITING` to a waiting worker, or reloads at once for a stale tab; the only `location.reload()` of the file is behind `gate.take()`. `visibilitychange` triggers `registration.update()` when the gap rule allows. An `undefined` registration is tolerated. `readOfflineVersion()` asks the controller over a message channel (null without controller or after 1.5 s).
- **Notice (`UpdateNotice.tsx`, `stage.css`)**: `role="status"`, the sentence, one button (min 44 px), no animation, no timer, `pointer-events` only on the button.
- **Worker**: `VERSION` answered on the message port with the build id; unknown messages and anything not from a window client inside the scope are ignored.
- **About**: one static line, empty until the worker answers.
- **Private server**: `deployNewVersion()` returns `{ id, marker }`.
- **Documents**: `docs/DEVICE-CHECKLIST.md` (install on five platforms, offline, update, touch flow with the old iPad todo folded in, viewport and safe areas, expected differences, how to report; every item tied to a roadmap criterion), README section "Install and offline use" and `npm run icons`, the Phase 8 sentence and the Tests clause in `.claude/CLAUDE.md`, PLT-02 as built (device round pending), ROADMAP Phase 8 with three plans, 3/3 and "Executed, awaiting UAT" (phase checkbox left open), STATE position, the iPad todo points to the checklist.

## Tests

- `tests/pwa-update.test.ts` (30 cases): the notice rule over every `Screen` as a `Record<Screen, boolean>` (a new screen is a compile error), the check gap at the boundary, the reload gate (none without a request, one after one request, instances independent), the strings, and a static guard (one `location.reload(` call behind `gate.take()`, no `skipWaiting(`, one `SKIP_WAITING`).
- `tests/pwa-precache.test.ts`: the message cases now cover a window of the scope, no source, a worker source, a window outside the scope, malformed data, and the VERSION reply.
- `tests/device-checklist.test.ts` (6 cases): file exists, the four criteria listed and each closed by a checkbox item, every platform named, the notice and About strings of the code quoted, "blocks nothing", no private folder, maker or RUBIN mark.
- `e2e/pwa-update.spec.ts` (9 cases, 63 runs, all seven projects, 0 skipped):
  1. tracer: deploy, check, notice with the fixed text and a button of at least 44 px, no reload by itself, two caches while waiting, one tap, exactly one navigation, marker in the new page, only the new cache left, `workerStamp` equals the new id, then server closed and an offline reload still shows the new version
  2. a waiting worker alone never reloads, 2 s (`@local`)
  3. notice visible on the free panel and gone in the chooser (`@local`)
  4. an update found at the level card: no notice on the level card, briefing, run (the clock keeps advancing, Procedure complete works) or debrief; notice appears after Back to panel; zero navigations (`@local`)
  5. two tabs: both show the notice, one tap updates the first, the second keeps the notice, does not reload for 1.5 s, reloads exactly once on its own tap (`@local`)
  6. a plain reload after a deploy finds the new worker and shows the notice, still old content (`@local`)
  7. About shows `Offline: ready, version <id>` with the stamp of the served `sw.js` (also runs live)
  8. About shows the old id before and the new id after the update (`@local`)
  9. blocked default: About says not available, no notice
- Mutation check: letting the notice show on every screen fails cases 3 and 4 (restored).

## Verification

| Gate | Result |
| --- | --- |
| `npm run typecheck`, `lint`, `format:check`, `validate` | clean; 10 scenario files, 0 problems |
| `rm -rf node_modules/.vitest-cache && npx vitest run` | 87 files, 4188 tests passed |
| `BASE_PATH=/procedure-trainer-da-50/ vite build` read | `sw.js`, `manifest.webmanifest`, `icons/` (5 PNGs) in the output; index.html links `/procedure-trainer-da-50/icons/...` and `/procedure-trainer-da-50/manifest.webmanifest`; `sw.js` carries VERSION |
| Whole Playwright suite, seven projects, macOS, `PW_PORT=4404` | 3024 passed, 917 skipped, 0 failed, 22.9 min |
| Same suite in `mcr.microsoft.com/playwright:v1.64.1-noble` (git archive of HEAD 60695cb, `npm ci`, `CI=1`, `--retries=0`, `--workers=4`; arm64 host) | 2994 passed, 947 skipped, 0 failed, 0 flaky, 35.8 min |

Per project, local (passed / skipped): desktop-chromium 512 / 51, desktop-webkit 485 / 78, phone-chromium 498 / 65, phone-webkit 400 / 163, tablet-chromium 409 / 154, tablet-webkit 400 / 163, phone-portrait 320 / 243.

Per project, Linux image (passed / skipped): desktop-chromium 512 / 51, desktop-webkit 485 / 78, phone-chromium 498 / 65, phone-webkit 390 / 173, tablet-chromium 409 / 154, tablet-webkit 390 / 173, phone-portrait 310 / 253.

The 30 additional skips on Linux are the known Linux class, skipped by existing code with stated reasons: 24 cases of `e2e/run-help.spec.ts` (a touch tap on the CHECKLIST pad button is not delivered in Playwright WebKit on Linux) and 6 cases of `e2e/sound.spec.ts` (WebKit touch audio unlock), each on phone-webkit, tablet-webkit and phone-portrait. No new skip or tolerance was added by this plan.

PWA cases per project (identical locally and on Linux): `pwa-update` 9 cases on every project (63 runs, none skipped); `pwa-offline` 79 passed, 5 skipped (the closed-server case runs only on the two desktop projects); `pwa-install` 38 passed, 4 skipped (the CDP case on the four WebKit projects); `about` 9 passed, 5 skipped.

`.github/workflows/deploy.yml` needs no change (D-12): `verify` builds with `BASE_PATH` and uploads `dist` (now with `sw.js`, manifest and icons), `e2e` builds `dist-e2e` and runs every project.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WebKit left the new worker in "activating" when the page reloaded at controllerchange**
- **Found during:** Task 1, repeat run on desktop-webkit (about half of the runs hung in `navigator.serviceWorker.ready` after the reload; a diagnostic showed `activating/activating` for seconds)
- **Issue:** the reload happened in the middle of `clients.claim()`; the worker never finished activating, which would also stall fetch events such as a lazy pack chunk.
- **Fix:** the reload (and the stale notice) waits until the controller reaches `activated`.
- **Files modified:** src/ui/pwa/register.ts
- **Commit:** 8e3df94
- **Verified:** 24 of 24 runs on desktop-webkit and desktop-chromium after the fix, then the full suites.

**2. [Rule 1 - Bug] The bottom placement of the notice covered the session pad on phones**
- **Found during:** Task 2 (CHOOSE SITUATION could not be tapped on phone-chromium and phone-webkit while the notice showed)
- **Fix:** top centre over the windscreen, narrow screens lower (see key decisions); the `lifted` prop is gone. Looked at on phone-chromium (landscape) and phone-portrait (below the rotate hint).
- **Files modified:** src/ui/stage.css, src/ui/App.tsx, src/ui/pwa/UpdateNotice.tsx
- **Commit:** c08bc45

### Plan details handled differently

- The plan's placement text said "bottom edge"; it is Claude's discretion (L-04), moved to the top for the reason above.
- The worker's message check (own-scope window clients) required the existing fake-scope test to carry a source; the test was extended instead of weakened.
- `STATE.md` position was edited by hand as instructed (it was stale since Phase 6.1; only the position, status, last activity and stopped-at lines were touched). Its machine-managed frontmatter, `config.json` and `state.json` were not touched.
- Commit 8794266 (`test(07): give the slow Realistic checklist session cases 30 s on a loaded runner`) was made on this branch by someone else while this plan ran and is inside the measured `commits` count of 4 (three are this plan's, the fourth is that foreign commit; the summary commit follows and is not counted).

## Auth gates

None.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-08-06 (reload or activation during a run) is mitigated and proven by the cases above (no notice on any non-free screen, one reload only after a tap, a second tab never reloads by itself, the worker never skips waiting by itself). T-08-07 (messages to the worker) is mitigated by the own-scope window-client check and its unit cases. No package was added (T-08-SC).

## Not verified here

- Everything in `docs/DEVICE-CHECKLIST.md`: install prompt and standalone launch on real iOS, Android and desktop, the real airplane mode, safe-area insets, `100dvh` with collapsing bars, the real touch flow, and the update on an installed app.
- The visibility-triggered check (`visibilitychange`): the gap rule is unit-tested, the trigger itself is not simulated in a browser (plan).
- A worker that never reaches `activated` after a tap would leave the tap without effect (the app stays usable); not observed after the fix.
- CI Linux on the owner's push: the Linux image (Apple Silicon host, Linux arm64) stands in for it.
- Phase UAT and the code review of the phase follow the plans.

## Self-Check: PASSED

- Files present: src/ui/pwa/update.ts, src/ui/pwa/UpdateNotice.tsx, tests/pwa-update.test.ts, tests/device-checklist.test.ts, e2e/pwa-update.spec.ts, docs/DEVICE-CHECKLIST.md.
- Commits are ancestors of HEAD: 8e3df94, c08bc45, 60695cb.
