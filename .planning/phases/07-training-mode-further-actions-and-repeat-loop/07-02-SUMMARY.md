---
phase: 07-training-mode-further-actions-and-repeat-loop
plan: 02
subsystem: engine, scenario, ui
tags: [further-actions, grading, lint, modal, debrief, scenario-format]

requires:
  - phase: 07-01
    provides: run view of the session pad with the reserved FURTHER rectangle, currentRecording, mode axis
provides:
  - "Fixed list of further actions and flight conduct options as aircraft data (AircraftEnv.further), defineFurther"
  - "Optional `further` scenario section (roles, conduct none or accept), lint L27 and L28, L20 solution with decisions"
  - "Recording.decisions, GradeResult.further, reasons further_missed, conduct, further_harmful (rules R16 to R19)"
  - "FURTHER ACTIONS pad button and multi-select modal (two-step groups), debrief section and emergency-landing note"
  - "Declarations of all ten shipped scenarios (D-13 table) and an independent hand-written table that pins them"
affects: [07-03]

actuals:
  tokens: 27600
  tasks: 3
  commits: 3
plan_head_before: 1f64ad447bd15f7e81c87f76fb1cc98034c9640c
plan_head_after: 96c51771701a412882cd606fc6aa8f5d08d41ab6

tech-stack:
  added: []
  patterns:
    - "A defined set in aircraft data (defineFurther, like defineScenes), read through AircraftEnv"
    - "A pure sub-grader (gradeFurther) called by grade, result key absent when there is nothing to say"
    - "Hand-written independent table in tests (shipped-further.test.ts) plus one expectation helper for the golden fixture"

key-files:
  created:
    - src/engine/further.ts
    - src/aircraft/da50rg/further.ts
    - src/ui/screens/FurtherActions.tsx
    - tests/further.test.ts
    - tests/shipped-further.test.ts
    - tests/further-support.ts
    - e2e/further.spec.ts
  modified:
    - src/engine/grading.ts
    - src/engine/env.ts
    - src/aircraft/da50rg/aircraft.ts
    - src/scenario/schema.ts
    - src/scenario/lint.ts
    - src/ui/session.ts
    - src/ui/App.tsx
    - src/ui/debrief-text.ts
    - src/ui/screens/Debrief.tsx
    - src/ui/screens/ChecklistOutline.tsx
    - src/ui/panel/frames/ScenarioAreaFrame.tsx
    - src/ui/stage.css
    - scenarios/*/*.toon
    - tests/fixtures/recordings.json
    - docs/GRADING.md
    - docs/PANEL-LABELS.md

key-decisions:
  - "Conduct status not_declared covers both `none` and a scenario without the section; `declared` (none, accept, null) tells them apart"
  - "A harmful or recommended action picked in a scenario that does not list it is shown as optional; picked actions without a section are shown, never graded"
  - "Debrief verdict words: Done, Missed, Recommended and not done, Not done (optional or harmful, not done), Harmful, Right, Wrong, Missing, Not graded"
  - "The further_missed line is singular for one action (1 required further action was missed.)"
  - "Tests that grade a shipped file with a built solution share tests/further-support.ts (solutionDecisions, PRECAUTION)"

requirements-completed: [SES-05]

duration: 95min
completed: 2026-11-01
status: complete
---

# Phase 7 Plan 02: Further actions Summary

**A run is graded on the calls and the flight decision as well as on the panel: a fixed list in aircraft data, an optional `further` section per scenario with roles and conduct (none on the ground), decisions logged with the run time, a multi-select FURTHER ACTIONS modal and a debrief section, and all ten shipped scenarios carry their declarations.**

## Accomplishments

- `src/engine/further.ts`: `defineFurther` (ids, groups, notes validated), `RecordedDecision`, `conductAccept`/`offersConduct` and `gradeFurther`, the pure grading of the decisions (single use of an action, last conduct pick wins, `none` never fails, decisions after the outcome time cut, unknown id throws). `grade` calls it and adds the reasons in the D-11 order: outcome, critical_missed, further_missed, conduct, order, forbidden, further_harmful. The result key `further` is absent without a section and without decisions, so such a result is JSON-identical to before.
- Aircraft data `src/aircraft/da50rg/further.ts` (six options, the group Inform ATC, the conduct title, the emergency-landing note, ground parameter `ground_roll`); `AircraftEnv.further`.
- Schema: strict optional `further` (`actions` of id, role, fails_run; `conduct` as `none` or `accept`). Lint L27 and L28 with file, line and column, L20 solution carries the required decisions and the first accepted conduct.
- Session: `decisions`, `decide`, `furtherOpen`, `openFurther`, `closeFurther` (running only, ignored before the Realistic onset); `currentRecording` carries the decisions; cleared wherever a run starts or ends. Works in Training and Exam.
- UI: FURTHER ACTIONS button in the run view (`session.further`), `FurtherActions.tsx` on the modal shell (main list, Inform ATC second step, conduct second step, Back, Close, Escape steps back, focus moves into the second step, run clock paused), Debrief section "Further actions" (rows with role and verdict words, picks in order, note), reason lines.
- Content: ENGINE FIRE, ELEC FIRE FLIGHT, T/O FIRE NO ABORT (MAYDAY required, passengers recommended, emergency landing), ENG OIL TEMP, ALTN 1 FAIL, ALTN 2 FAIL, ICING (all optional, precautionary landing), the three ground scenarios (MAYDAY recommended, `conduct: none`).
- Docs: `docs/GRADING.md` R16 to R19, the section "Further actions for authors (phase 7)" with one worked TOON example, golden recording note, "What goes in" sentence; `docs/PANEL-LABELS.md` row `session.further`; todo `2026-10-28-emergency-landing-scenarios.md` status.

## Task commits

| Task | Commit | Content |
| ---- | ------ | ------- |
| 1 Tracer | b58ecc9 | engine, schema, aircraft data, session, modal (both steps), debrief section, ENGINE FIRE declaration, fire-* recordings |
| 2 | ac7788e | lint L27, L28, L20 solution, lint tests, e2e (two conduct picks, Escape, ground) |
| 3 | 96c5177 | nine declarations, shipped table, golden fixture for the other two real files, solution-run tests, e2e PASS runs, GRADING.md, todo |

## Verification

- `rm -rf node_modules/.vitest-cache && npx vitest run`: 79 files, 3928 tests passed (07-01 ended at 77 files, 3840). New: `tests/further.test.ts` (26), `tests/shipped-further.test.ts` (31), L27/L28/L20 cases in `tests/scenario-lint.test.ts` (13), 10 session cases, 7 debrief-text cases, 2 blueprint literal lists.
- `npx tsc --noEmit`, `npm run typecheck`, `npx eslint .`, `npm run format:check`, `npm run validate` (10 files, 0 problems): clean.
- Playwright (PW_PORT=4394) on desktop-chromium, phone-chromium, phone-portrait: `further` (21), `pfd`, `session-area`, `checklist`, `training`, `pack`, `cues`, `windscreen`, `sound`, `altn2`, `fire`, `icing`, `scenario`, `variants`, `replay`, `neutral`, `clock` all pass (the last run of the batches: 161 + 184 passed, the skipped ones are by design); `run-reaction` including the 3-minute escalation case (desktop-chromium) passes; layout specs `static-text`, `zoom`, `layout`, `brand`, `sound`, `cues`, `windscreen`: 189 passed. The whole suite on all seven projects runs at the end of plan 07-03.
- Visual check (D-18): scratch spec on desktop-chromium and phone-portrait, screenshots of the modal (list, Inform ATC step, conduct step, list with picks) and the debrief section looked at. The modal fits both screens and reads; the debrief rows wrapped badly on the narrow phone at first (verdict under the role word), so a narrow-screen rule gives the label its own line. Scratch spec deleted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/modal.test.ts` calls `Debrief` directly**
- **Fix:** added `further: DA50RG_ENV.further` (the Debrief gets the aircraft set for its texts). **Commit:** b58ecc9

**2. [Rule 1 - Bug] Whole-table reformat of `docs/PANEL-LABELS.md`**
- **Found during:** task 3 (panel-labels test failed). I had run `prettier --write` on `docs/PANEL-LABELS.md` in task 1; `docs/` is outside the project's format scope and the write rewrote every table.
- **Fix:** restored the file from before the plan and re-added the single `session.further` row; the net change of the plan in that file is one line. The noisy diff stays visible in commit b58ecc9 and is undone in 96c5177. **Commit:** 96c5177

### Plan variations (no change against the decisions)

- **Task split:** the modal's two-step views (Inform ATC, conduct) and the full debrief rows, picks line and note landed in task 1 (the tracer) instead of task 2, because writing the flat list first and replacing it would have been churn. Task 2 therefore holds lint L27, L28, L20, their tests and the multi-pick e2e. Nothing was cut; task 3 was done in full.
- The L20 "required decision left out" case is covered by showing that the file with a required action passes lint (the built solution carries the decision, otherwise the lint would report "the solution does not pass") and that a recording without the decisions fails with `further_missed` and `conduct` (`tests/scenario-lint.test.ts`); `tests/variants.test.ts` got no new case, only the shared decisions in its solution helpers.
- `GradeResult.further.conduct.status` `not_declared` also covers `conduct: none`; `declared` distinguishes the three cases (plan F-04 listed the four statuses without that detail).
- Small additions: `tests/further-support.ts` (shared solution decisions), `pickFurther` helper in `e2e/support/session.ts`, a narrow-screen CSS rule for the debrief rows, one verdict word beyond the plan's list ("Not done", "Not graded"), singular wording for one missed required action.
- Existing tests that finish a shipped scenario had to learn the decisions (planned churn): e2e specs `altn2`, `fire`, `icing`, `pack`, `scenario`, `variants`, `replay`, `run-reaction` and the unit tests `altn2`, `fire-scenarios`, `scenario-tracer`, `variants`, `session`, `scenario-lint` (L26 Realistic case now says `conduct: none` for its ground copy). Expectations were extended (a `conduct` reason, the picks), never loosened.
- The fire-* recordings do not all pick the same: `fire-no-squawk` also briefs the passengers and `fire-wrong-order` picks PAN PAN, MAYDAY, precautionary and then emergency landing, to pin single use and the last-pick rule in the golden file.

## Known Stubs

None. The emergency landing itself is not trained; this is the recorded owner decision D-12 (the debrief says so, the todo carries the status), not a stub.

## Owner review points

- The D-13 table as declared in the ten files and in `tests/shipped-further.test.ts` (every role and accept list; ICING keeps both calls optional because the printed heading names no call).
- The last-pick rule for the conduct and the single-use rule for actions (no undo).
- The pause of the run clock while the modal is open.
- Wording of the debrief rows and the new reason lines; verdict words Done, Missed, Recommended and not done, Not done, Harmful, Right, Wrong, Missing, Not graded.
- The missing "either call" role (both calls are optional wherever a printed page says only "inform ATC").

## Threat Flags

None new. T-07-03 (strict schema, L27 and L28 check every id against the aircraft list, `grade` throws for an unknown decision id: case in `tests/further.test.ts`), T-07-04 (decisions after the outcome time are not graded, `decide` ignored outside a running run and before the onset) and T-07-05 (option texts come from aircraft data and render as text children; the cause of a variant is still named only in the debrief) are mitigated as planned.

## Self-Check: PASSED

Created files exist (`src/engine/further.ts`, `src/aircraft/da50rg/further.ts`, `src/ui/screens/FurtherActions.tsx`, `tests/further.test.ts`, `tests/shipped-further.test.ts`, `tests/further-support.ts`, `e2e/further.spec.ts`); commits b58ecc9, ac7788e and 96c5177 are on the branch; `.planning/config.json` and `.planning/state.json` are untouched by the plan commits; nothing is pushed.
