---
phase: 07-training-mode-further-actions-and-repeat-loop
plan: 01
subsystem: ui
tags: [training-mode, hint, checklist-sheet, session, preact-signals]

requires:
  - phase: 06.1
    provides: session machine, level card, checklist outline, session pad
provides:
  - "Training or Exam on its own card before the level (session.mode, modePicked)"
  - "nextOpenStep: the first open critical or standard step of grade(partial recording), stored wording"
  - "HINT and CHECKLIST buttons in the run view of the session pad (Training only), hint line, non-modal checklist sheet"
  - "Mode named in the briefing (Training note) and the debrief (Mode line)"
affects: [07-02, 07-03]

actuals:
  tokens: 17000
  tasks: 3
  commits: 3
plan_head_before: 8803add2a8a09cd9b2810e56e0647604b451c215
plan_head_after: 26708a09a1131fb1664ab3b6ada11cb925a96b4e

tech-stack:
  added: []
  patterns:
    - "Display-state axis next to the level: signal in the session, own modal card, never an input of grade"
    - "Hint = grade of the partial recording (one extracted currentRecording shared with completeRun)"

key-files:
  created:
    - src/engine/hint.ts
    - src/ui/screens/ModePick.tsx
    - src/ui/screens/HintLine.tsx
    - src/ui/screens/RunChecklist.tsx
    - tests/hint.test.ts
    - tests/session-run-view.test.ts
    - e2e/training.spec.ts
  modified:
    - src/ui/session.ts
    - src/ui/App.tsx
    - src/ui/stage.css
    - src/ui/panel/session-area.ts
    - src/ui/panel/frames/ScenarioAreaFrame.tsx
    - src/ui/screens/Briefing.tsx
    - src/ui/screens/Debrief.tsx
    - tests/session.test.ts
    - tests/zoom.test.ts
    - tests/modal.test.ts
    - e2e/support/session.ts
    - e2e/checklist.spec.ts
    - e2e/clock.spec.ts
    - e2e/scenario.spec.ts
    - e2e/session-area.spec.ts
    - docs/GRADING.md
    - docs/PANEL-LABELS.md

key-decisions:
  - "Run view rectangles as in H-03 without change (rows of 80 at y 20, 116, 212, 308; half width 177); the screenshots read well, the FURTHER row is reserved in the layout data and not drawn"
  - "The hint line keeps its words until the next HINT press (no auto refresh after a step is done)"
  - "On a narrow portrait phone the checklist sheet is a bottom sheet (40 per cent of the panel area height) and covers the pad; its own Hide button is the way back"
  - "TRAINING_NOTE lives in session.ts (not the .tsx) so e2e specs can import the exact sentence"

requirements-completed: [SES-02]

duration: 25min
completed: 2026-11-01
status: complete
---

# Phase 7 Plan 01: Training mode axis, hint and checklist sheet Summary

**Training or Exam is its own card before the level; in Training a HINT button names the next open checklist step in the printed wording (the grade of the partial recording, so it can never disagree with the debrief) and a CHECKLIST button shows the briefing-form outline in a non-modal sheet; Exam stays silent and grading cannot tell the difference.**

## Accomplishments

- `src/engine/hint.ts`: `nextOpenStep(scenario, env, recording)` calls `grade`, takes the first step with severity critical or standard that is not credited (declared order, only applicable steps, R12 honoured) and returns its stored `number`, `text`, `action`. Pure, no state.
- Session: `Mode`, `MODES`, `MODE_NAMES`, `MODE_HINTS`, `TRAINING_NOTE`, `HINT_NONE_TEXT`; signals `mode` (default exam), `modePicked`, `hint`, `checklistShown`, `runBranches`; methods `setMode` (briefing, before the level), `askHint` (Training, running, not before a Realistic onset), `toggleChecklist` (Training, running, every level). `currentRecording()` is shared by `completeRun` and `askHint`. All cleared when the run ends (complete, leave, fail, close debrief).
- UI: `ModePick` card (same shape as the level card) mounted before `LevelPick`; `HintLine` (role status, `pointer-events: none`, over the windscreen); `RunChecklist` sheet (heading, message, briefing outline with the branches decided at the start, Hide button, Escape, scrolls, inside the panel area so the footer is never covered); run view of the session pad (`SESSION_LAYOUT.run`, in `sessionFootprints`) with CHECKLIST (pressed rim while shown) and HINT in Training only.
- Briefing names Training (`briefing-training`) or keeps the Exam note (`briefing-exam`); Debrief has `debrief-mode`.
- `docs/GRADING.md` states that mode and hints never reach `grade`; `docs/PANEL-LABELS.md` lists `session.checklist` and `session.hint`.
- e2e helpers: `chooseScenario` waits for `mode-pick`, new `pickMode`, `startScenario` and `startRealistic` take a mode (default exam); the direct level-card taps in checklist, scenario, clock and session-area specs go through `pickMode`.

## Verification

- `rm -rf node_modules/.vitest-cache && npx vitest run`: 77 files, 3840 tests passed. New: `tests/hint.test.ts` (10), `tests/session-run-view.test.ts` (5), 25 new cases in `tests/session.test.ts` (mode, hint, sheet, grade independence), the zoom reference table extended by the six run rectangles.
- `npx tsc --noEmit`, `npm run typecheck`, `npx eslint .`, `npm run format:check`, `npm run validate` (10 files, 0 problems): clean.
- Playwright (PW_PORT=4393): `training`, `scenario`, `checklist`, `clock`, `session-area` on desktop-chromium, phone-chromium, phone-portrait: 167 passed, 1 skipped. Layout specs (`static-text`, `session-area`, `zoom`, `layout`) on desktop-chromium, phone-chromium, phone-portrait, tablet-chromium (123 passed) and on the three webkit projects (118 passed, with `training`).
- Visual check (D-18): scratch spec on desktop-chromium, phone-chromium and phone-portrait, screenshots of the run view (Training and Exam), the hint line and the sheet looked at; the pad reads, nothing overlaps, the hint line sits over the windscreen and covers no control, the sheet scrolls and leaves the footer free. Scratch specs deleted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tests/modal.test.ts calls `Debrief` directly**
- **Found during:** Task 3 (typecheck after adding the required `mode` prop)
- **Fix:** added `mode: 'exam'` to that call. **Commit:** 26708a0

### Plan variations (no behaviour change against the decisions)

- New file `src/ui/screens/HintLine.tsx` (not in the plan's file list): the hint line as a small pure component instead of inline markup in `App.tsx`.
- `TRAINING_NOTE` is exported from `session.ts` rather than the briefing component.
- The grade-independence unit case covers the four combinations of mode (training, exam) and level (easy, medium) through the session. Realistic starts with a random onset and cannot be compared on one recording; `grade` takes only the recording, so the property holds by construction there (the existing Realistic cases and the onset case of the hint tests cover the path).
- The e2e sheet test covers the narrow portrait phone, where the bottom sheet covers the pad: it uses the sheet's own Hide button there instead of the CHECKLIST button (as H-04 anticipates).

## Known Stubs

None. The FURTHER ACTIONS rectangle `SESSION_LAYOUT.run.further` is reserved layout data and is drawn from plan 07-02 (as planned).

## Owner review points

- Card order (mode before level) and the Training and Exam card wording.
- The run view of the pad (two half-width rows) and that the FURTHER row is empty until 07-02.
- Hint rule: optional steps are never named; the line keeps its text until the next press.
- Hint line placement over the windscreen; sheet docked left (bottom on a narrow portrait phone, where it covers the pad).

## Threat Flags

None. T-07-01 (scenario text rendered as text children only) and T-07-02 (no hint before the Realistic onset, test in `tests/session.test.ts`) are mitigated as planned.

## Self-Check: PASSED

Files created exist; commits c6f87ee, e065365, 26708a0 are on the branch.
