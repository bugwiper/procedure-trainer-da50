---
created: 2026-10-20
title: Tag e2e/rotary.spec.ts "a mouse move under 4 px acts as a tap" with @hooks
area: tests
source: 01.1-11 Task 3 live Playwright run (deviation, deferred)
---

Found during the live verification of commit 0265806 against https://bugwiper.github.io/procedure-trainer-da50/: `[desktop-chromium] e2e/rotary.spec.ts:257 "a mouse move under 4 px acts as a tap"` fails on the live site, deterministically (193 passed, 43 skipped, 1 failed across desktop-chromium, phone-chromium and phone-webkit).

Cause: the test ends with `expect(await eventCount(page)).toBe(1)`, which reads the test-only `window.__panel` event hook that only the e2e build contains; on the live build `eventCount` returns -1. The user-visible assertion before it (INSTRUMENT LIGHT reaches `s25`) passes, so the site is correct. The other hook-reading specs in the file carry `@hooks` in their title and are excluded in live mode by `grepInvert: /@hooks/` in `playwright.config.ts`; this one does not.

Fix: add `@hooks` to the test title (one word, test-only). Locally the test passes either way. Not fixed in plan 01.1-11, because that plan forbids changes and the owner confirmed an exact SHA; the owner did not answer whether to fix it, so it stays an open follow-up.

## Resolved

Closed 2026-10-21 by plan 01.1-23 Task 1: the test title now starts with @hooks; the live-mode rehearsal (production bundle, @hooks specs excluded) passes on both chromium projects.
