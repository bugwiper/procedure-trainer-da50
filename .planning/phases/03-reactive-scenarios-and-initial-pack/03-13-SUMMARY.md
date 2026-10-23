---
phase: 03-reactive-scenarios-and-initial-pack
plan: 13
subsystem: scenario
tags: [scenario-format, checklist, lint, toon, content, uat-gap]
status: complete

requires:
  - phase: 03-reactive-scenarios-and-initial-pack
    provides: plan 03-11 (Realistic setup in the onset block, L15), the three shipped scenarios and their golden recordings
provides:
  - Scenario format 1 (additive, optional) can describe a checklist as printed: number and action on line and step, a comment node kind (text, optional right-hand reference as action, optional boxed), marker (six names) on line, step, decision and both branch shapes, and a top-level checklist block (form table or outline, heading, message)
  - MAX_LINE_WORDS (20) for checklist text; forbidden and outcome texts keep 12 words
  - Lint L16 (consecutive numbering in document order, rows without a number are free) and L17 (table and outline forms kept apart)
  - ALTN 1 FAIL and Engine Fire as the printed numbered tables, ENG OIL TEMP as the printed outline with markers and the four display lines of the oil pressure too low branch
  - tests/checklist-reference.ts (the printed wording as an independent table, PRINTED) and tests/checklist-text.test.ts (an independent walker pins the shipped files to it)
affects: [03-14]

requirements-completed: [CNT-01]

actuals:
  tokens: 10400
  tasks: 3
  commits: 4
plan_head_before: 81bce7d85e12501bb2d93b6fed56e5c746c44c49
plan_head_after: 73ef3b14f3621c58e8fc0c5a745fa0845a6c763d

tech-stack:
  added: []
  patterns:
    - "Every graded step is a row of the checklist by construction: a step is a table row or an outline line, a non-panel row is a displayed `line`, a printed full-width row is a `comment` node; there is no second structure to link"
    - "The printed wording is pinned by an independent reference table in tests/ that no scenario file feeds; a text edit that drifts from the page fails the build"

key-files:
  created:
    - tests/checklist-reference.ts
    - tests/checklist-text.test.ts
  modified:
    - src/scenario/schema.ts
    - src/scenario/lint.ts
    - src/engine/grading.ts
    - src/ui/outline.ts
    - scenarios/electrical/elec-altn1-fail.toon
    - scenarios/engine/eng-fire-in-flight.toon
    - scenarios/engine/eng-oil-temp-green.toon
    - tests/scenario-parse.test.ts
    - tests/scenario-lint.test.ts
    - tests/scenario-tracer.test.ts
    - tests/outline.test.ts
    - tests/grading.test.ts
    - tests/toon-conformance.test.ts
    - e2e/scenario.spec.ts

key-decisions:
  - "A checklist is the procedure itself (C-72): rows are line and step nodes, so grading, the branch path scheme and tests/fixtures/recordings.json are untouched"
  - "L16 resumes counting after a higher number and keeps the expected number after a repeat, so a single slip is a single issue"
  - "A marker in the table form is reported at its own key as well as at a decision or branch node that is itself not allowed there"
  - "source of the three files names the checklist booklet (document DA50 C / RG Emergency Procedures checklist, issue Edition 4.1, 2022-10-05), verified 2026-10-23"

duration: 50 min
completed: 2026-10-23
---

# Phase 3 Plan 13: Checklists as printed, data half Summary

**Scenario format 1 gains optional number, action, comment rows, markers and a checklist block; lint L16 and L17 keep them consistent; ALTN 1 FAIL, Engine Fire and ENG OIL TEMP now carry the official wording word for word (two numbered tables and one marked outline), pinned by an independent reference table, with every graded step, id and golden recording unchanged.**

## Accomplishments

- **Task 1 (tracer), `e155e4d`:** schema additions (`MAX_LINE_WORDS`, `number`, `action`, the `comment` node, the `checklist` block), no-op `comment` cases in the lint walks and in `walkProcedure`, L16 and L17 (table half and outline half), ALTN 1 FAIL as the printed table (four numbered rows, the group `immediate` keeping its two steps with number, item text and action, two comment rows, heading and message), the reference table and the text test, parse and lint cases (number 0, 100 and 1.5 rejected at the key; comment with and without boxed; an unknown key in a comment; a bad form; 20 words accepted, 21 rejected; forbidden text keeps 12; L16 gap, repeat, late start, free unnumbered rows; L17 decision, branch, number, action, comment, each located by line and column). The tracer verify was green end to end (typecheck, targeted vitest, recordings unchanged, validate) before expansion.
- **Task 2 (TDD), `b412a4a`, `3931880`:** the reference entry was written first and seen failing (two cases red against the old lines), then Engine Fire became the printed table: rows 1 to 8, the five comment rows in their printed places (one boxed, with `(page 9)` as its right-hand reference), the squawk row last and unnumbered as the one row that is not printed. The follow-up commit removes an unused binding the lint rule flagged in the new test.
- **Task 3 (TDD), `73ef3b1`:** the marker cases were seen failing, then `marker` was added and L17's marker half; ENG OIL TEMP is the printed tree (arrow, diamond-arrow, diamond, double arrows, circle, square; 12 markers; the continuation line without one; the last line lower case as printed) and the too low branch shows its four printed lines without a step. The dependent expectations follow the data.

## The printed pages against the transcription

I opened the three private photos once (`.input/checklist-altn1-altn2.jpg` upper block, `.input/checklist-engine-fire.jpg`, `.input/oil-temp-checklist-card.jpg`) and compared line by line. Every heading, message tag, item, action, comment, branch label and marker agrees with the plan's transcription; no line differed, so the photo never had to overrule the plan. Points a reader might doubt, all checked against the page: "Circuit breaker" (singular) with "check IN" in lower case; "ECS shut-off" with a hyphen; "Electric master" (not ELECT.); the airspeed action reads `AS REQUIRED / CONSIDER HIGHER`; the windows action reads `OPEN as necessary` (lower case "as necessary"); the oil card's last line starts with a lower case l and the first branch's markers are the diamond with a long arrow (`diamond_arrow`) and a plain four-diamond (`diamond`). The ALTN 2 block on the same photo was not transcribed (no scenario). The only place I am not certain is how the printed four-diamond and diamond-arrow symbols map to the six marker names; the names were taken from the plan and are only labels for plan 14's drawing.

## Gates

| Gate | Result |
|------|--------|
| `npx vitest run` (whole suite) | 2635 passed in 51 files |
| `npm run typecheck`, `npm run lint`, `npm run format:check` | exit 0 |
| `npm run validate` | 3 scenario files checked, 0 problems |
| `git diff --exit-code tests/fixtures/recordings.json` (after every task) | exit 0, file unchanged |
| `PW_PORT=4333 npx playwright test e2e/pack.spec.ts --project=desktop-chromium --project=phone-chromium` (Task 2) | 6 passed |
| `PW_PORT=4333 npx playwright test e2e/scenario.spec.ts e2e/pack.spec.ts e2e/replay.spec.ts --project=desktop-chromium --project=phone-chromium` (Task 3) | 48 passed |
| acceptance greps | `MAX_LINE_WORDS` in schema.ts 3, `L16` in lint.ts 2, `form: table` ALTN 1 and Engine Fire 1 each, `kind: comment` ALTN 2 and Engine Fire 5, `squawk_7700` 1, `form: outline` 1, `marker: ` in the oil file 12, `land at nearest suitable airfield` 1, `PRINTED` in the reference 2 |

## Assumptions taken

- C-72 to C-79 of the plan as written.
- The comment node renders, until plan 14, as a plain line of its text in the briefing and debrief outline (see Deviations); the debrief marks it "Not graded" like every non-panel line.
- `action` values that read as booleans or are short words (`OFF`, `ON`) are quoted in TOON; the reference table is the judge of the parsed text.
- The source line shown in the briefing now reads "Source: AFM 03-08 ENG OIL TEMP, issue Edition 4.1, 2022-10-05" because the renderer joins the fields as before; plan 14 owns that display.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `src/ui/outline.ts` handles the new node kind**
- **Found during:** Task 1 (typecheck)
- **Issue:** the plan keeps the renderer for plan 14, but `buildOutline` switches exhaustively over the node kinds, so a `comment` node broke the type check.
- **Fix:** the `comment` case falls into the `line` case (the comment text prints as a line); no component, style or other renderer code was touched.
- **Files modified:** src/ui/outline.ts
- **Commit:** e155e4d

**2. [Rule 1 - Test assumed old shape] Two synthetic-copy assertions compared procedure length with the shipped file**
- **Found during:** Tasks 1 and 2 (full unit run)
- **Issue:** `tests/grading.test.ts` required the ordered fixture copies to have as many procedure nodes as the shipped Electrical and Engine Fire files; the shipped files now also carry comment rows.
- **Fix:** the assertions compare the graded step ids (Electrical) and the group count minus the two merged groups (Engine Fire).
- **Files modified:** tests/grading.test.ts
- **Commit:** e155e4d, b412a4a

**3. [Rule 1 - Test assumed old data] Tracer and conformance expectations**
- **Found during:** Tasks 1 and 3
- **Issue:** the 13-word case moved to the new 20-word bound; the blueprint's `issue` is now the booklet edition (the quoted-number behaviour stays pinned by its own conformance case).
- **Files modified:** tests/scenario-tracer.test.ts, tests/toon-conformance.test.ts
- **Commit:** e155e4d, 73ef3b1

**4. [Rule 1 - Lint] unused binding in the text test**
- **Found during:** Task 2 (lint, caught after the commit because my command chained the commit after the lint output)
- **Fix:** rebuilt the row without the destructured `own`; committed as `test(03-13)` right away. No code between the two commits was released.
- **Commit:** 3931880

**Total deviations:** 4 auto-fixed (1 blocking, 3 test expectations). **Impact:** none on graded behaviour; `tests/fixtures/recordings.json` is byte-identical.

## Known Stubs

None. (The squawk row of Engine Fire is the intentional, documented own-addition row of C-76.)

## Threat Flags

None. The only new surface is the optional fields of the scenario parser, covered by T-03-34 (numbers capped at 99, 20-word lines, strict objects, L16 and L17 locate every problem).

## Issues Encountered

- The project root pin guard was run in a condensed form (the same git-vs-git toplevel comparison of the supplied root with the actual root) before the first write and before every commit; it passed each time.
- Nothing was pushed; `.planning/config.json`, `.planning/state.json` and `.planning/milestone.lock` were left alone.

## Next Phase Readiness

Plan 03-14 can read `scenario.checklist` (form, heading, message), `number`, `action`, `marker` and `comment` nodes from the parsed scenario, replace the interim "comment prints as a line" rule of `buildOutline`, draw the six markers, and update the content policy (12-word limit, verbatim checklist text) and the convention text.

## Self-Check: PASSED

- Created files exist: tests/checklist-reference.ts, tests/checklist-text.test.ts.
- Commits exist on the branch: e155e4d, b412a4a, 3931880, 73ef3b1.
