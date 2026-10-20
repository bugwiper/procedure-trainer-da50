---
phase: 01-deployed-playable-panel
plan: 01
subsystem: infra
tags: [vite, preact, typescript, playwright, eslint, github-pages]
requires: []
provides:
  - Exact-pinned toolchain and npm scripts (dev, build, typecheck, lint, test, format, build:e2e, preview:e2e, e2e)
  - BASE_PATH-only Vite base (host-agnostic, validated)
  - Panel stage shell (App) with training-aid footer
  - Six-project Playwright subpath smoke harness with PW_BASE_URL override
  - ESLint purity boundary for src/engine and src/aircraft
affects: [01-02, 01-03, 01-04, 01-06, 01-07]
tech-stack:
  added:
    [preact 11.0.1, '@preact/signals 2.11.3', vite 8.3.4, typescript 6.0.3, vitest 5.0.5, '@playwright/test 1.64.1', eslint 10.13.0, typescript-eslint 8.71.2, prettier 3.9.10]
  patterns:
    - Solution-style tsconfig (app vs node projects, node types scoped to node project)
    - Subpath e2e build (dist-e2e) previewed with the same base
key-files:
  created:
    - package.json
    - package-lock.json
    - tsconfig.json
    - tsconfig.app.json
    - tsconfig.node.json
    - vite.config.ts
    - index.html
    - src/main.tsx
    - src/ui/App.tsx
    - src/ui/stage.css
    - playwright.config.ts
    - e2e/smoke.spec.ts
    - tests/shell.test.ts
    - eslint.config.js
  modified:
    - .gitignore
key-decisions:
  - 'Dependency legitimacy (T-01-SC): user approved all 14 pinned packages; installed with bare exact versions'
  - 'Added tests/shell.test.ts so npm test and prettier over tests/ do not fail on an empty directory'
requirements-completed: [PLT-01, PNL-05]
duration: 25min
completed: 2026-10-20
status: complete
commits: 2
plan_head_before: e0678d246a64a76862472a45b8ce0370d6ec246d
plan_head_after: 48f1f84cfebe687eed114496236d1de790a538b8
actuals:
  tokens: 17000
  tasks: 3
  commits: 2
---

# Phase 1 Plan 01: Toolchain and subpath tracer Summary

Pinned Vite 8 / Preact 11 / TS 6.0.3 stack with a BASE_PATH-only subpath production build that renders the panel stage and training-aid footer in Chromium and WebKit on desktop, tablet and phone emulation, plus an ESLint gate keeping `src/engine` and `src/aircraft` framework-free.

## Tasks

| Task | Name | Commit | Notes |
| ---- | ---- | ------ | ----- |
| 1 | Dependency legitimacy review | none | Checkpoint resolved by the user ("Approve all 14") in the orchestrator chat |
| 2 | Tracer: subpath build renders panel stage | f4b25d1 | Smoke passes in all six projects |
| 3 | Lint and format gates, purity boundary | 48f1f84 | Probe file triggered all three restricted-* rules, then removed |

## Verification

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` all exit 0.
- `npx playwright test e2e/smoke.spec.ts`: 6 passed (desktop-chromium, desktop-webkit, phone-chromium, phone-webkit, tablet-webkit, phone-portrait).
- Pin check printed `pins ok` (14 deps, exact versions equal to lockfile, no install script other than fsevents).
- `BASE_PATH=bad npx vite build` exits 1 with "BASE_PATH must start and end with /".
- Boundary probe produced no-restricted-imports, no-restricted-globals and no-restricted-properties errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added tests/shell.test.ts**
- **Found during:** Task 2 (running `npm run format`)
- **Issue:** `prettier --write src tests e2e` exits 2 with "No files matching the pattern: tests" because no tests directory exists yet, which would also make `format:check` (required green in Task 3) fail. `vitest run` also fails with no test files by design (no passWithNoTests).
- **Fix:** Added a small hygiene test asserting the exact viewport meta, absence of `viewport-fit`, and the `data:` favicon in index.html.
- **Files modified:** tests/shell.test.ts
- **Commit:** f4b25d1

The plan's `printf`-based boundary probe command was run as separate steps (write probe file, run eslint, remove file) to fit the sandbox command checks; the outcome is identical.

## Known Stubs

None. The panel background rect is the intended placeholder shell for plan 03, which replaces it with registry-driven regions.

## Threat Flags

None.

## Self-Check: PASSED

- All listed files exist; commits f4b25d1 and 48f1f84 are in the branch history.
- No STATE.md or ROADMAP.md changes.
