---
phase: 07-training-mode-further-actions-and-repeat-loop
plan: 04
subsystem: ui, docs
tags: [rework, checklist-sheet, live-marks, hint-box, leave, session-pad]

requires:
  - phase: 07-01
    provides: checklist sheet, session pad run view (reworked here)
  - phase: 07-03
    provides: retry, next situation, README guide
provides:
  - "no mode: the level card is the first card; briefing note briefing-note"
  - "outline mode 'live' and session.checklistMarks (grade of the partial recording, green Done marks on the CHECKLIST sheet)"
  - "Realistic CHOOSE CHECKLIST (list of all headings, chosen checklist, marks only for the own one) and debrief line Checklist used"
  - "HintBox (Realistic only: title and situation text of the file)"
  - "slim run view of the pad: checklist, hint, further (temporary), LEAVE; free-panel buttons 280 wide"
affects: [07-05]

actuals:
  tokens: 59600
  tasks: 3
  commits: 3
plan_head_before: 26afa41c63c72bfb7c6634fef5b0e7a7ef66972e
plan_head_after: bf633416d8c71160ceffe31a86267c6a7c49834b

tech-stack:
  added: []
  patterns:
    - "Display help that reads the grade (the sheet marks) is derived from grade of the partial recording and never stored"
    - "A refresh that can cost much (a replay of a 30 minute log) is synchronous until one call took longer than 30 ms, then trailing and coalesced"

key-files:
  created:
    - src/ui/screens/HintBox.tsx
    - e2e/run-help.spec.ts (renamed from e2e/training.spec.ts)
  deleted:
    - src/engine/hint.ts
    - src/ui/screens/HintLine.tsx
    - src/ui/screens/ModePick.tsx
    - tests/hint.test.ts
  modified:
    - src/ui/session.ts
    - src/ui/outline.ts
    - src/ui/App.tsx
    - src/ui/stage.css
    - src/ui/screens/{RunChecklist,ChecklistOutline,Briefing,Debrief}.tsx
    - src/ui/panel/session-area.ts
    - src/ui/panel/frames/ScenarioAreaFrame.tsx
    - tests/{session,outline,modal,session-run-view,zoom,readme-guide}.test.ts
    - e2e/support/session.ts
    - e2e/{checklist,clock,loop,scenario,session-area}.spec.ts
    - README.md
    - docs/GRADING.md
    - docs/PANEL-LABELS.md

key-decisions:
  - "The Realistic choice survives completeRun (the debrief names it) and is cleared by closeDebrief, Retry, Next, leave, fail and every start; every other help member is cleared at completion"
  - "The sheet may open before the onset on Realistic (the list names nothing); marks and HINT stay withheld until the onset"
  - "Live marks are refreshed at once while a grade is cheap and trailing (150 ms, coalesced) after one grade call took more than 30 ms (measured: 260 to 280 ms at 30 minutes on ALTN 2 FAIL and the icing situation)"
  - "LEAVE is 177 x 80 at local (228, 392): at 72 units it measured 43.2 px on Pixel 7 landscape"
  - "The Hide button of the sheet ignores a click for 400 ms (found by the e2e: on a portrait phone the click after the opening tap landed on Hide and closed the sheet again)"
  - "The hint box centres with left/right 0 and margin auto (not translateX), shrinks to 14 px on a landscape phone"

requirements-completed: [SES-02]

duration: 150min
completed: 2026-11-02
status: complete
---

# Phase 7 Plan 04: No mode, live checklist marks, Realistic checklist choice and hint box, slim pad Summary

**There is no mode any more: the level card is the first card, every run has a CHECKLIST sheet that marks the steps already done in green (the grade of the partial recording), Realistic chooses its checklist from all of them and asks the situation as a HINT box, and the pad in a run shows only what the run needs with LEAVE as the way out.**

## Accomplishments

- Removed everything on the R-01 and R-05 lists (Mode, MODES, texts, signals, `setMode`, `askHint`, `HintState`, `engine/hint.ts` with its tests, `ModePick`, `HintLine`, the mode props, lines and test ids, the e2e `pickMode`). The tree has no match for the plan's removal grep.
- `buildOutline(..., 'live', result)`: credited steps get verdict Done (tone done), others nothing, no tags, no order lines; step rows carry `sheet-step` instead of `debrief-row`, the Done row is tinted green.
- `session.checklistMarks`: one store subscription (user events and retracts), refreshed only while the sheet is shown on the own checklist and, on Realistic, after the onset.
- Realistic: `checklistView`, `checklistChoice`, `checklistList` (lazy load once per run through the pack seam, no `busy` or `loadFailure`, failure message and Try again inside the sheet, a generation counter drops a late result), `showChecklistList`, `chooseChecklist`, `retryChecklistList`, `hintShown`, `toggleHint`. Debrief prints `Checklist used: <heading>` or `none` (Realistic only).
- Pad: `SESSION_LAYOUT.run` is checklist, hint, further (temporary) and leave; main view 280 wide at x 80; NEW SITUATION, CHOOSE SITUATION and RESET are drawn on the free panel only.
- Texts: README (Running a situation, sections 6 and 7), GRADING.md (level paragraph, R16 sentence, retry and next), PANEL-LABELS.md (CHECKLIST and CHOOSE CHECKLIST share a row, HINT, new LEAVE row, free-panel only notes).

## Task commits

| Task | Commit  | Content |
| ---- | ------- | ------- |
| 1 Tracer | dbd9aef | no mode, live outline, checklist marks, RunChecklist, e2e helpers and specs |
| 2 | a09ab42 | Realistic list and choice, debrief line, HintBox, unit and e2e cases |
| 3 | bf63341 | slim pad, LEAVE, 280 wide buttons, layout tables, texts, hit size and LEAVE specs |

## Verification

- `rm -rf node_modules/.vitest-cache && npx vitest run`: 79 files, 3964 tests passed (07-03 ended at 80 files, 3958; `tests/hint.test.ts` is gone).
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (10 files, 0 problems): clean.
- Playwright (PW_PORT=4397): task checks on desktop-chromium and phone-chromium (`run-help`, `checklist`, `scenario`, `clock`, `loop`: 96 passed) and on phone-portrait (`run-help`, `checklist`, `loop`: 84 passed over three projects); layout-sensitive specs (`session-area`, `static-text`, `art-fit`, `layout`, `zoom`, `run-help`, `scenario`) on all seven projects in one run: 546 specs, 456 passed, 90 skipped by design, 0 failed.
- Grade-time measurement (S-02): `grade` of an empty recording at 30 minutes costs 10 to 33 ms on most shipped scenarios and 263 ms (ALTN 2 FAIL) and 279 ms (icing); the trailing coalescing is therefore built, with a unit case (fake timers, 28 minutes into ALTN 2 FAIL).
- Visual check (D-18): scratch specs (deleted, nothing under `e2e/` left over) on desktop-chromium, phone-chromium and phone-portrait: the sheet with and without green marks, the Realistic list, a chosen foreign checklist, the hint box, the debrief line, the free pad and the run view zoomed. Green reads on the dark sheet; the list looks alike; the pad rows read and nothing overlaps.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Hide button took the click of the tap that opened the sheet (portrait phone)**
- **Found during:** Task 3 (e2e on phone-portrait after the checklist button moved to the top row)
- **Issue:** the bottom sheet appears under the pad button; the synthetic click after `pointerup` landed on the sheet's Hide button and closed the sheet at once. A real touch would do the same.
- **Fix:** Hide ignores a click for `INPUT_SHIELD_MS` after the sheet appeared (the other sheet buttons are further down and unaffected). e2e waits 450 ms before tapping Hide right after opening. **Commit:** bf63341

**2. [Rule 1 - Bug] Hint box too narrow on a portrait phone, too tall on a landscape phone**
- **Found during:** Task 2 visual check
- **Issue:** `left: 50%` plus `translateX(-50%)` shrink-wraps to half the width (ten lines of text over the pad); on a landscape phone the box covered the instruments.
- **Fix:** `left/right 0` with `margin-inline: auto` and `width: max-content`; 14 px text and smaller padding when the viewport is lower than 500 px. **Commit:** a09ab42

**3. [Rule 1 - Bug] LEAVE at 64 and 72 units was under 44 px**
- **Found during:** Task 3 (`tests/zoom.test.ts`, then the e2e hit-size case: 43.2 px on Pixel 7 landscape)
- **Fix:** 177 x 80 at y 392 (starting value of R-06 was 64 high). **Commit:** bf63341

### Plan variations (no change against the decisions)

- The choice (`checklistChoice`) is kept through completion for the debrief (S-01 said every member is cleared at complete; the debrief line needs the choice) and cleared when the debrief closes.
- In task 1 the Realistic CHECKLIST press was interim shut until the onset; task 2 replaced it with the list (opens before the onset, R-03).
- `Debrief` got the prop `checklistUsed`; `RunChecklist` takes a `SheetBody` (a checklist or the list) and an optional `onBackToList`.
- `e2e/run-help.spec.ts` was written in task 1 (renamed from `training.spec.ts`), extended in tasks 2 and 3.
- No plan commit ledger file (protocol 0c) was written; `commits: 3` is measured from 26afa41 (HEAD before the first task commit).
- `docs/PANEL-REVIEW.md` "Phase 7: owner review" items 1 and 2 (mode order, pad rows) are now outdated; plan 07-05 rewrites that section (R-12) and was not touched here.

## Known Stubs

None. `SESSION_LAYOUT.run.further` and the FURTHER ACTIONS button and modal are the temporary part that plan 07-05 replaces.

## Owner review points

The mode-free briefing note; the Realistic list showing headings only; the sheet opening before the onset on Realistic; LEAVE as the only way out of a run; the narrower free-panel buttons; the empty HINT row on Easy and Medium (the temporary FURTHER ACTIONS row stays where it is); the hint box covers the top of the instruments on a landscape phone while shown.

## Unverified

- Linux WebKit (touch tap on the pad buttons, known class from 35e2eda): the run-help specs that tap CHECKLIST or HINT skip on Linux WebKit touch with a stated reason; the new LEAVE and hit-size specs are not skipped and were run on macOS only. The Linux image run is planned for the end of 07-05.
- The whole Playwright suite on all seven projects (only the changed and layout-sensitive specs were run, as the plan says; the whole suite runs once at the end of 07-05).

## Threat Flags

None new. T-07-08 (no marks, no hint before the onset, all headings alike), T-07-09 (text children only), T-07-10 (the list goes through `listChoices` and `openScenario`, a case with a denying policy and a pack opened after the policy changed) and T-07-11 (JSON-identical grade over choices and levels) are covered by cases in `tests/session.test.ts`.

## Self-Check: PASSED

Created files exist (`src/ui/screens/HintBox.tsx`, `e2e/run-help.spec.ts`); deleted files are gone; commits dbd9aef, a09ab42 and bf63341 are on the branch; `.planning/config.json` and `.planning/state.json` are not part of any commit; nothing is pushed.
