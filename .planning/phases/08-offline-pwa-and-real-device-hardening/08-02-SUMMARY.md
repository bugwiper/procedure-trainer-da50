---
phase: 08-offline-pwa-and-real-device-hardening
plan: 02
subsystem: build, assets, e2e
tags: [pwa, manifest, icons, ios, installability, brand, playwright]
status: complete

requires:
  - phase: 08-01
    provides: the precache plugin that reads public/ (manifest and icons are precached without a change), e2e/support/pwa.ts helpers
provides:
  - "public/manifest.webmanifest: relative URLs only, standalone, icons 192 and 512 (any) and 512 (maskable)"
  - "scripts/make-icons.mjs and npm run icons: the single source of the five committed PNGs in public/icons/"
  - "index.html: manifest link, apple-touch-icon 180, PNG favicon (all through %BASE_URL%), iOS standalone metas, no viewport-fit"
  - "tests/pwa-static.test.ts (15 cases) and e2e/pwa-install.spec.ts (6 cases)"
affects: [08-03]

actuals:
  tokens: 7900
  tasks: 2
  commits: 3
plan_head_before: d48a875862210b581b76cd49c5ed092cd5a1bc52
plan_head_after: 40e486f995f36dbd52dc6773d79da077af97a7ed

key-files:
  created:
    - scripts/make-icons.mjs
    - public/manifest.webmanifest
    - public/icons/icon-192.png
    - public/icons/icon-512.png
    - public/icons/icon-512-maskable.png
    - public/icons/apple-touch-icon.png
    - public/icons/favicon-32.png
    - tests/pwa-static.test.ts
    - e2e/pwa-install.spec.ts
  modified:
    - index.html
    - package.json
    - docs/CONTENT-POLICY.md
    - e2e/support/pwa.ts
    - tests/shell.test.ts

key-decisions:
  - "Icon colours are read from the panel source: glass black #0b0d10 ground, bezel grey #8a9099 outline and GO-AROUND line, DA50RG in the nameplate legend colour #c9d0d8 (the plan's L-01 named #e6e9ed; the plan also says to read colours from PanelShell.tsx, which wins)"
  - "Text is fitted by measuring it in the page (getComputedTextLength), not by guessed font sizes"
  - "The favicon carries DA50 only (32 px cannot show DA50RG legibly); it is the same mark, not another one"
  - "The manifest and index.html carry no brand names; the generator's own brand-free state is gated by a static test"

requirements-completed: [PLT-02 (install half)]
---

# Phase 8 Plan 02: Manifest, icons, iOS tags and install specs Summary

The app now links a manifest with generated DA50RG / GO-AROUND icons under the base path; hand-written installability criteria pass on all seven Playwright projects, and manifest and icons answer from the cache with the network off.

## What was built

- **Generator (`scripts/make-icons.mjs`, `npm run icons`)**: renders an SVG page in the Playwright Chromium with the B612 bold woff2 inlined as a data URL (inside the throwaway page only, not in `src/`), fits the text by measuring it, takes one screenshot per size and writes five PNGs into `public/icons/`. For the maskable icon it reads every pixel back and fails the run if anything outside the central circle (80 percent of the side) is not the ground colour; it passed (0 stray pixels). Reads only the font file, writes only `public/icons/`.
- **The icons, looked at** (opened as images): glass-black ground; a rounded bezel outline in bezel grey with a thin darker inner rim; "DA50RG" large in light grey, centred slightly above the middle; "GO-AROUND" small, letter-spaced, in bezel grey beneath it. 192 and 512 (any): rounded-square ground with transparent corners, the bezel fills most of the width, text crisp and fully inside. 512 maskable: full-bleed ground, the whole art in a smaller bezel well inside the safe circle, nothing near the edges. Apple 180: full-bleed opaque, same art as the any icon with a slightly smaller bezel; readable at 180. Favicon 32: a bezel outline around the single word "DA50" in light letters on the dark tile; legible. No logo, swoosh, bird, wordmark shape, registration, maker name or RUBIN mark. File sizes: 7.7 kB, 22 kB, 14 kB, 5.4 kB, 1.1 kB.
- **Manifest**: `id`, `start_url`, `scope` all `./`; name "DA50 RG Procedure Trainer", short name "DA50 Trainer", own-words description, standalone, background and theme `#0b0d10`, three icons, no orientation lock, no shortcuts or screenshots.
- **index.html**: PNG favicon, apple-touch-icon (180), manifest link, all through `%BASE_URL%`; `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-title`, status bar style `black`; viewport and theme-color unchanged, no viewport-fit. Built twice and read: default base gives `/icons/...`, `/manifest.webmanifest`; `BASE_PATH=/procedure-trainer-da-50/` gives `/procedure-trainer-da-50/icons/...` and `/procedure-trainer-da-50/manifest.webmanifest`; manifest and icons appear in the precache list of `sw.js`.
- **Policy**: one paragraph in `docs/CONTENT-POLICY.md` section 7 (icons follow the panel artwork rule); heading order and checked words kept.

## Tests

- `tests/pwa-static.test.ts` (15 cases): manifest fields; every URL relative; any-purpose 192 and 512 by declared sizes; maskable is its own file and differs in bytes from the any 512; each icon is a PNG with the declared IHDR size and larger than 3 times a flat-colour PNG of that size; index tags through the base, iOS metas, apple icon 180 PNG, theme-color equal to the manifest, no viewport-fit; maker names and RUBIN absent in manifest, index.html and generator (the check is shown to bite); generator names DA50RG and GO-AROUND, never reads `.input` or a photo extension. Mutation check: `start_url` changed to `/` fails the relative-URL case (restored).
- `e2e/pwa-install.spec.ts` (6 cases, 42 runs over seven projects, 4 skipped by design): hand-written installability walk (status, media type, name, icons 192 and 512, PNG type, start_url, display, no related-application preference, secure context, start_url inside manifest scope and worker scope) plus start_url equal to the base URL; each icon fetched as a PNG of its declared size; CDP (Chromium projects only); iOS metas, theme colour, 180 apple icon and favicon from the live DOM; manifest, apple icon and icons answer 200 offline and are in the cache; all requests on one origin under the base, none failed, no console error. Mutation check: display `browser` fails the walk (restored).

### The CDP case (D-10 caveat)

`Page.getAppManifest` errors are a real check (a `start_url` on another origin fails the case). `Page.getInstallabilityErrors` in headless Chromium stays empty even for a manifest without a 512 icon, with the headless shell as well as with `channel: 'chromium'` in a persistent context (probe in this run; with a plain context `channel: 'chromium'` answers `in-incognito`). So the browser's installability verdict is not a usable criterion here; the title of the CDP case says so, and the hand-written walk is the criterion. The real install prompt stays an owner device check.

## Verification

| Gate | Result |
| --- | --- |
| `rm -rf node_modules/.vitest-cache && npx vitest run` (final) | 85 files, 4150 tests passed |
| `npm run typecheck`, `lint`, `format:check`, `validate` | clean; 10 scenario files, 0 problems |
| `pwa-install` + `pwa-offline`, seven projects, macOS, `PW_PORT=4403` | 117 passed, 9 skipped (CDP on the 4 WebKit projects, closed-server case on 5 non-desktop projects) |
| Same two specs in `mcr.microsoft.com/playwright:v1.64.1-noble` (git archive of HEAD, `npm ci`, `CI=1`, `--retries=0`; arm64 host) | 117 passed, 9 skipped |
| Task 2 gate: install, brand, about specs, four projects | 36 passed, 4 skipped |
| Spot check scenario, layout, smoke, about, brand, ack on desktop-chromium and phone-portrait | 56 passed, 2 skipped (not from this plan) |

About renders the content policy text; `tests/content-policy.test.ts`, `tests/docs-format.test.ts`, `tests/brand.test.ts` and `e2e/about.spec.ts` ran and passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/shell.test.ts` asserted the empty data: favicon the plan replaces**
- **Found during:** final full vitest run (1 failure of 4150)
- **Issue:** the test required `rel="icon" href="data:,"`; its intent is that nothing requests `/favicon.ico` at the host root.
- **Fix:** the test now requires a `%BASE_URL%icons/favicon-32.png` icon link and no root-absolute icon link.
- **Files modified:** tests/shell.test.ts
- **Commit:** 40e486f

### Plan details handled differently

- DA50RG colour is `#c9d0d8` (nameplate legend colour in `PanelShell.tsx`) instead of the plan's `#e6e9ed`.
- The CDP case is weaker than the plan hoped (see above); the plan's fallback applies.
- `pngSize` and `linkedManifest` helpers were added to `e2e/support/pwa.ts`; `tests/pwa-static.test.ts` carries its own small `pngSize` so the unit test does not import from `e2e/`.

## Auth gates

None.

## Known Stubs

None. The icon composition is a placeholder by decision (D-07); the owner may overwrite the PNGs, the tests check format and size only.

## Threat Flags

None beyond the plan's threat model: T-08-04 (maker name or mark) is gated by `tests/pwa-static.test.ts` and the policy paragraph; T-08-05 (generator input) by the static check that the script never names `.input` or a photo extension.

## Not verified here

- Install prompt, standalone launch, the look of the maskable icon under a real platform mask and the iOS home-screen icon on a device (device checklist, 08-03).
- Chromium's own installability verdict (see CDP caveat).
- CI Linux run on the owner's push (the Linux image run stands in for it).
- `.planning/STATE.md`, ROADMAP progress and `config.json`/`state.json` were not updated by this executor (instructions).

## Self-Check: PASSED

- Files present: scripts/make-icons.mjs, public/manifest.webmanifest, the five PNGs, tests/pwa-static.test.ts, e2e/pwa-install.spec.ts.
- Commits are ancestors of HEAD: 5361a8d, bc93d8b, 40e486f.
