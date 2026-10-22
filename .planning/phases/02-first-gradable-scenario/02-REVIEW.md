---
phase: 02-first-gradable-scenario
reviewed: 2026-10-22T00:00:00Z
depth: standard
files_reviewed: 52
files_reviewed_list:
  - .github/workflows/deploy.yml
  - .github/dependabot.yml
  - vite.config.ts
  - eslint.config.js
  - playwright.config.ts
  - package.json
  - scripts/validate-scenarios.mjs
  - scenarios/engine/pack.toon
  - scenarios/engine/eng-oil-temp-green.toon
  - src/scenario/schema.ts
  - src/scenario/parse.ts
  - src/scenario/toon-index.ts
  - src/scenario/lint.ts
  - src/scenario/packs.ts
  - src/scenario/packs-vite.ts
  - src/scenario/validate-all.ts
  - src/scenario/disclaimers.ts
  - src/engine/grading.ts
  - src/engine/predicates.ts
  - src/engine/store.ts
  - src/engine/clock.ts
  - src/engine/cas.ts
  - src/engine/quantities.ts
  - src/engine/env.ts
  - src/aircraft/da50rg/aircraft.ts
  - src/aircraft/da50rg/cas.ts
  - src/aircraft/da50rg/quantities.ts
  - src/aircraft/da50rg/panel.ts
  - src/aircraft/da50rg/plates.ts
  - src/ui/App.tsx
  - src/ui/ack.ts
  - src/ui/bridge.ts
  - src/ui/clock-driver.ts
  - src/ui/debrief-text.ts
  - src/ui/modals.ts
  - src/ui/outline.ts
  - src/ui/session.ts
  - src/ui/panel/Panel.tsx
  - src/ui/panel/PanelShell.tsx
  - src/ui/panel/zoom.ts
  - src/ui/panel/press-targets.ts
  - src/ui/panel/session-area.ts
  - src/ui/panel/frames/CasChips.tsx
  - src/ui/panel/frames/MfdFrame.tsx
  - src/ui/panel/frames/PfdFrame.tsx
  - src/ui/panel/frames/ScenarioAreaFrame.tsx
  - src/ui/panel/widgets/SessionButton.tsx
  - src/ui/screens/Ack.tsx
  - src/ui/screens/Briefing.tsx
  - src/ui/screens/ChecklistOutline.tsx
  - src/ui/screens/Confirm.tsx
  - src/ui/screens/Debrief.tsx
  - src/ui/screens/Modal.tsx
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-10-22
**Depth:** standard
**Files Reviewed:** 52 source files, plus spot checks of tests/ and e2e/ (workflow, validate-cli, packs, session, clock-driver specs)
**Status:** issues_found

## Summary

Scope was every source, script, workflow and test file changed since cffdbc1, minus planning, docs and lockfiles. The scenario pipeline (decode, schema, lint, grade) is well built. Untrusted scenario text is only ever rendered as Preact text children or `aria-label` values, so there is no XSS path. There is no `eval`, no `innerHTML` and no string-evaluated predicate. Scenario-keyed records go through `Object.hasOwn` or Map getters. I decoded a `__proto__` key and it stays an own property with no pollution. localStorage holds only the integer acknowledgment version, and every storage access is wrapped. Pack ids are only used as lookup keys, never joined into a filesystem path at runtime.

I found no blockers. Five warnings are real defects, confirmed against source or by running the code:

- A scenario with no applicable graded critical step PASSes a run that does nothing, and lint does not catch it.
- `npm run validate` crashes on an unusual directory entry.
- `npm run validate` echoes attacker-controlled text into CI logs.
- The clock driver does not do what its comment says on tab return.
- The Pages workflow's `configure-pages` step is likely missing permissions.

## Warnings

### WR-01: A scenario with no applicable graded critical step passes a run that does nothing, and lint accepts it

**File:** `src/scenario/lint.ts:178-219` (L5 check), `src/engine/grading.ts:223-238`
**Issue:** Lint rejects a step that is already satisfied at the start (L5). It never checks that the scenario has at least one graded step that applies at the start, or at least one critical one. `grade` returns PASS whenever `reasons` is empty. If every group sits in a branch that is `not_applicable` or `open` at the start (for example, the initial quantities select a different branch), the file validates. A pilot who presses Procedure complete immediately sees PASS. That breaks the core value ("accurate, objective feedback") and the do-nothing guarantee that GRADING.md documents. The same holds for a scenario whose only groups are `optional` or `standard`. An author editing the `initial` quantities of the blueprint (oil pressure 2.5 bar selects "If too low:", which has no nodes) produces such a file with no error from `npm run validate`.
**Fix:** Add a lint rule (L11) in `checkInitialState`, after the existing visit:
```ts
// L11: a run that does nothing must fail.
let gradedCritical = 0;
const count = (nodes: readonly ProcedureNode[], applies: boolean): void => {
  // same traversal as `visit`; for an applicable group add the number of critical steps
};
count(scenario.procedure, true);
if (gradedCritical === 0) {
  add(['procedure'], 'no critical step is graded in the initial state; a run that does nothing would pass');
}
```
Add a test in `tests/scenario-lint.test.ts` with a scenario whose only critical steps are behind a non-applicable branch.

### WR-02: `npm run validate` crashes with an uncaught exception on a directory entry named `*.toon`, and exits 1 instead of the documented 2

**File:** `scripts/validate-scenarios.mjs:21`, `:47`, `:73`
**Issue:** `readPack` takes every directory entry whose name ends in `.toon` and calls `readFile` on it. I created `root/demo/dir.toon/` and ran the script. It aborted with an unhandled `EISDIR` stack trace and exit code 1. The file header documents "exit code 1 when there is any problem, 2 when the command itself cannot run", but only the root `readdir` is guarded. Any read error (permission denied, EISDIR, broken symlink) also exits 1, so CI cannot tell a crash from a validation failure. `entries.filter((e) => e.isDirectory())` also silently skips a symlinked pack folder (`Dirent.isDirectory()` is false for symlinks), so that pack is never validated and the run still reports success.
**Fix:** Filter with `readdir(folder, { withFileTypes: true })` and `e.isFile() && e.name.endsWith('.toon')`. Wrap the whole body in `try/catch` that prints the message and returns 2. Use `stat` (or `isSymbolicLink()` plus `stat`) when listing pack folders so symlinked packs are validated or reported.
```js
process.exitCode = await main().catch((error) => {
  out(`validate failed: ${error instanceof Error ? error.message : String(error)}`);
  return 2;
});
```

### WR-03: Validation output echoes untrusted scenario text unescaped, so a scenario file can inject GitHub Actions workflow commands into CI logs

**File:** `src/scenario/validate-all.ts:34-38`, `src/scenario/parse.ts:46` (`unknown key "${key}"`), `src/scenario/lint.ts:84,90` (`unknown control "${id}"`), `scripts/validate-scenarios.mjs:60`
**Issue:** Messages interpolate author-controlled strings (object keys, control ids, state names) into the output line. TOON allows quoted keys with escapes. I ran the script on a file containing `"x\n::error::spoof": 1`. The output contained a line starting with `::error::spoof": unknown key "x`, and a line `::error::spoof"` on its own. CI runs `npm run validate` on `pull_request`, so a PR author controls these files. The token is read-only (`contents: read`, no checkout credentials), so the impact is log and annotation spoofing, `::stop-commands::` and `::add-mask::`, not code execution. Terminal escape sequences (ESC) pass through the same way on a developer machine.
**Fix:** Make `formatIssue` print messages with control characters escaped, for example `JSON.stringify` for the interpolated parts, or sanitise the whole line:
```ts
const safe = (s: string): string => s.replace(/[\u0000-\u001f\u007f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
export const formatIssue = (i: ValidationIssue): string => safe(`${i.file}:${i.line}:${i.col}: ${i.message}`);
```

### WR-04: The clock driver adds up to one second of run time on every tab return, contrary to its comment and its test

**File:** `src/ui/clock-driver.ts:41-48` (comment at lines 5-7), `tests/clock-driver.test.ts:86`
**Issue:** The comment claims "a pause adds nothing later because the last frame time is updated on every frame". That holds for an open modal, where frames keep running. It does not hold for a hidden tab: browsers stop firing `requestAnimationFrame` there, so `last` is stale. On the first frame after the tab is visible again, `hidden()` is false and `elapsed` is large. The code advances the clock by `min(elapsed, MAX_FRAME_STEP_MS)`, which is 1000 ms. The unit test fakes frames while `hidden` is true, so it never exercises the real browser behaviour and passes. Each tab switch inflates virtual time by up to 1 s. Time shows up in the harmful-action times of the debrief now, and in every timed reaction in Phase 3. SCN-08 requires deterministic time.
**Fix:** Listen for `visibilitychange` (injected as a dep, like `hidden`), or track hidden-to-visible transitions in `frame`. Skip the step on the first frame after a hidden or blocked period:
```ts
let wasPaused = false;
// in frame():
const paused = hidden() || blocked();
if (running && !paused && !wasPaused) { /* advance */ }
wasPaused = paused;
```
Extend the test so no frame is delivered while hidden and a large `now()` jump follows.

### WR-05: The `configure-pages` step in the `verify` job runs without `pages` permission and its output is unused

**File:** `.github/workflows/deploy.yml:35-37`, permissions at `:9-10`
**Issue:** The top-level token is `contents: read` only, and `tests/workflow.test.ts` enforces that `pages: write` exists only in the `deploy` job. `actions/configure-pages` queries the Pages API, which needs the `pages` permission. The step runs only on `main`, so PR runs never show a failure. The first push to `main` is likely to fail with "Resource not accessible by integration", and `deploy` is then skipped via `needs: [verify, e2e]`. I could not run the action here, so treat the failure as probable and not proven. Either way the step does nothing useful: `BASE_PATH` is computed from `github.event.repository.name` and none of the action's outputs (`base_path`, `base_url`) are used.
**Fix:** Delete the `configure-pages` step. `upload-pages-artifact` needs no extra permission, and `deploy-pages` already runs in the job that has `pages: write` and `id-token: write`. If it is kept, move it to the `deploy` job.

## Info

### IN-01: The deployed bundle is not the bundle the e2e suite tests

**File:** `.github/workflows/deploy.yml:28-31` and `:44-52`, `package.json` (`build:e2e`)
**Issue:** The Pages artifact comes from `npm run build` in `verify`. The Playwright job builds a separate `dist-e2e` with `VITE_TEST_HOOKS=1`. CLAUDE.md says the e2e specs "hit the production build". The hook-free build is never exercised in a browser, so a bug that depends on `import.meta.env.VITE_TEST_HOOKS` being absent would ship untested.
**Fix:** Add one hook-free smoke spec (load the page, accept the acknowledgment, start a run) that runs against the real build through `PW_BASE_URL` or a second preview. Or state the trade-off in the README.

### IN-02: Duplicate React/Preact keys in the debrief harmful-action list

**File:** `src/ui/screens/Debrief.tsx:69`
**Issue:** `key={entry.seq}` is the log position of the event that made a forbidden condition true. Two forbidden items can become true on the same event (for example two travel checks on one lever). They share a `seq`, so keys collide and Preact reconciles them incorrectly.
**Fix:** `key={`${String(entry.seq)}:${entry.id}`}`.

### IN-03: Locale-dependent sorting in packs, validate output and pack discovery

**File:** `src/scenario/packs.ts:60,94`, `src/scenario/validate-all.ts:141-144`, `scripts/validate-scenarios.mjs:48`
**Issue:** `localeCompare` without a fixed locale depends on the runtime ICU locale. Pack order (and with it the random pick and the choose-list order) and the "stable" sorted validation output can differ between machines. The doc comments promise stability.
**Fix:** Use a plain code-unit comparison: `(a, b) => (a < b ? -1 : a > b ? 1 : 0)`, or `localeCompare(b, 'en')` with a fixed locale.

### IN-04: Leftover fallback and a partially applied start

**File:** `src/scenario/packs.ts:96`, `src/ui/session.ts:161-171`
**Issue:**
- `name ?? ''` in `loadPack` is dead code. `match[2]` is always defined once the key matched `FILE_KEY`. It exists only to satisfy `noUncheckedIndexedAccess`.
- `start()` sets the time source, `scenario` and `clock` before calling `onRunStart()` and flipping the screen. If `onRunStart` ever throws (`zoomOut` is UI code), `startRun`'s catch resets only briefing and screen. The time source and clock signal stay set while the screen is `free`.

**Fix:** Destructure with a guard (`if (match?.[1] !== id || match[2] === undefined || match[2] === 'pack') return [];`). Call `onRunStart()` before mutating session state, or reset the time source, `scenario` and `clock` in the `startRun` catch.

### IN-05: Schema accepts meaningless or contradictory flags

**File:** `src/scenario/schema.ts:85`, `src/scenario/lint.ts`
**Issue:** `order_critical: true` on a group with `ordered: false` is accepted and silently ignored by grading, since violations only exist for ordered groups. An author who thinks they made a group order-critical gets no grade effect and no warning, which weakens the "typos fail loudly" principle of the strict schema.
**Fix:** Add a lint rule: `order_critical` requires `ordered: true`.

### IN-06: Fixed sleeps in the e2e suite

**File:** `e2e/clock.spec.ts:35-79`, `e2e/neutral.spec.ts:140,166,173`, `e2e/scenario.spec.ts:51,489`, `e2e/session-area.spec.ts:107`
**Issue:** `page.waitForTimeout` with 100 ms to 1500 ms is used to wait for the clock, for the 400 ms modal shield, and for tap windows. On slow CI runners (webkit, phone emulation) these are flake risks. Assertions on `window.__panelSession.now()` windows are the most exposed. The shield waits are tied to a product constant (`INPUT_SHIELD_MS`), which is acceptable, but the clock specs measure real time against a real rAF loop.
**Fix:** For the shield, wait for `[data-shield]` to detach with `expect(...).not.toHaveAttribute('data-shield')`. For the clock, poll with `expect.poll` on `now()` instead of sleeping.

---

_Reviewed: 2026-10-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
