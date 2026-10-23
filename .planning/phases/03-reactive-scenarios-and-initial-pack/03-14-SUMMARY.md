---
phase: 03-reactive-scenarios-and-initial-pack
plan: 14
subsystem: ui
tags: [checklist, briefing, debrief, outline, markers, content-policy, uat-gap]
status: complete

requires:
  - phase: 03-reactive-scenarios-and-initial-pack
    provides: plan 03-13 (scenario format with number, action, comment rows, markers and the checklist block; the three checklists as printed; tests/checklist-reference.ts)
provides:
  - The Easy briefing and the debrief render the printed table (number and item at the left, desired action at the right with a dotted leader, full-width comment rows, boxed row with its right-hand reference) and the marked outline (six SVG marker shapes), plus the heading band with the printed title and message tag
  - View model additions in src/ui/outline.ts (number, action, marker, comment items, checklistHead) with the existing item kinds, test ids and verdict logic unchanged
  - Content policy, convention, README and owner review follow the owner decision of 2026-10-23 (checklist text reproduced exactly as printed)
affects: [phase 3 verification, phase 3 owner review]

requirements-completed: [CNT-01]

actuals:
  tokens: 12000
  tasks: 3
  commits: 3
plan_head_before: 09269fbfd1ba978596fa0259be23b1b97a841e63
plan_head_after: 3da521e1f46b25d0570575b084d595c7fbc0c4a1

tech-stack:
  added: []
  patterns:
    - "One hook-free ChecklistOutline renders both printed forms; a `form` prop is passed down the list recursion, markers are inline SVG shapes drawn in the text colour in a fixed 24 px slot"
    - "View model keys (number, action, marker, boxed) exist only when the scenario declares them; the renderer decides nothing from scenario wording"
    - "The printed reference table of plan 13 is the oracle for unit and e2e cases; the rendered rows and markers are compared with it and no spec types a checklist word"

key-files:
  created:
    - e2e/checklist.spec.ts
  modified:
    - src/ui/outline.ts
    - src/ui/screens/ChecklistOutline.tsx
    - src/ui/screens/Briefing.tsx
    - src/ui/screens/Debrief.tsx
    - src/ui/stage.css
    - tests/outline.test.ts
    - tests/content-policy.test.ts
    - e2e/scenario.spec.ts
    - docs/CONTENT-POLICY.md
    - docs/PANEL-REVIEW.md
    - .claude/CLAUDE.md
    - README.md

key-decisions:
  - "Table form is one `li[data-kind]` per row with `.outline-number`, `.outline-text`, `.outline-leader` (aria-hidden), `.outline-action`; comment rows are `li[data-kind=comment]` (`data-boxed` when boxed) and carry no number, tag or verdict (not even Not graded)"
  - "Outline form: markers drawn as `svg.outline-marker[data-marker]` in a 24 px slot; an item without a marker gets `outline-nomarker` so its text lines up with marked siblings, but only when a sibling has a marker"
  - "On 480 px and below a table row is up to three lines: number and item, the action right-aligned on its own line (leader dropped), then in the debrief the tag at the left and the verdict at the right"
  - "The briefing source lines now read `Source: <document>, <issue>` and `<section>, checked <date>`, which suits the new source block (booklet name and edition, then the AFM section)"
  - "Policy: the subsection is `Verbatim checklist text`; photographs of printed checklists are named in section 3; section 5 gets the exception; section 6 puts the checklist text under the legal review"

duration: 35 min
completed: 2026-10-23
---

# Phase 3 Plan 14: Checklists as printed, display half Summary

**The Easy briefing and the debrief now show ALTN 1 FAIL and Engine Fire as the printed numbered tables (actions right-aligned with dotted leaders, full-width and boxed comment rows) and ENG OIL TEMP as the printed marked outline (six drawn marker shapes), under the printed heading and message tag, without sideways scrolling on a 375 px phone; the content policy, the convention, the README and the owner review state the verbatim checklist decision of 2026-10-23.**

## Accomplishments

- **Task 1 (tracer), `6610cf2`:** `buildOutline` keeps its signature and result; `OutlineLine` and `OutlineStep` gain optional `number`, `action`, `marker`, `OutlineDecision` and `OutlineBranch` gain `marker`, a new `comment` item (text, action, boxed, muted) and `checklistHead(scenario)` (form, heading, message). `ChecklistOutline` takes a `form` prop and renders the table rows; `ChecklistHeading` is the band (`checklist-heading`, `checklist-title`, `checklist-message`). Briefing and debrief take the form and the heading from the scenario; the source lines were re-ordered for the new source block. Unit cases compare the shipped ALTN 1 FAIL model and DOM shape with the PRINTED entry; the e2e case checks the heading, the four rows with their printed items and actions, each number at the list's left edge, each action at its right edge and both comment rows across the whole list (2 px slack), and no sideways scroll. The tracer verify (typecheck, targeted vitest, desktop and phone e2e of checklist and scenario specs) was green end to end before expansion. The debrief wiring and the outline-form renderer (markers) were already complete in this commit, so Task 2 added cases and one CSS pass rather than new components.
- **Task 2, `6d486ba`:** cases for marker drawing (briefing: markers of the shown items equal the printed markers; debrief: every printed marker, none for the continuation line, which carries `outline-nomarker`), aria-hidden shapes, no marker in the table form, the heading band, and the debrief table (graded rows keep `debrief-row`, tag, verdict and `data-verdict`; rows 1 and 4 say Not graded; comment rows say nothing). e2e: Engine Fire briefing (heading, no message tag, rows 1 to 8 in order, five comment rows, the boxed row framed with `(page 9)` at its right edge, the unnumbered squawk row last), ENG OIL TEMP briefing and debrief markers against the PRINTED reference, the debrief of a do-nothing ALTN 1 FAIL run, and a 375 px case for the Engine Fire briefing and debrief. I looked at screenshots at desktop width and at 375 px (a throwaway spec, removed) and reworked the narrow rule once: the first version let the verdict word wrap alone on the left, the final rule puts tag left and verdict right on their own line.
- **Task 3, `3da521e`:** `docs/CONTENT-POLICY.md` section 2 (b) and the subsection (now `Verbatim checklist text`) rewritten to the owner decision with its date, the 12-word limit and examples removed, section 3 names photographs of printed checklists, section 5 has the exception, section 6 puts the checklist text under the legal review, sections 1, 4 and 7 untouched. `tests/content-policy.test.ts`: heading renamed and one case asserts the date, `reproduced exactly as printed`, no word limit and the photo line. `.claude/CLAUDE.md` convention bullet replaced, README sentence follows the policy. `docs/PANEL-REVIEW.md`: Phase 2 item 6 reworded (keeps "step lines" and "content policy"), Phase 3 item 17 "Checklists as printed" appended with the defaults taken.

## Gates

| Gate | Result |
|------|--------|
| `npx vitest run tests/outline.test.ts tests/blueprint.test.ts tests/checklist-text.test.ts tests/debrief-text.test.ts tests/static-text.test.ts` | 89 passed |
| `npx vitest run tests/content-policy.test.ts tests/panel-review.test.ts tests/brand.test.ts tests/docs-format.test.ts` | 333 passed |
| `npx vitest run` (whole suite) | 2648 passed in 51 files |
| `npm run typecheck`, `npm run lint`, `npm run format:check` | exit 0 |
| `npm run validate` | 3 scenario files checked, 0 problems |
| `npm run build` | exit 0 |
| `git diff --exit-code tests/fixtures/recordings.json` | exit 0, unchanged |
| `PW_PORT=4333 npx playwright test e2e/checklist.spec.ts e2e/scenario.spec.ts e2e/pack.spec.ts --project=desktop-chromium --project=phone-chromium` | 56 passed |
| `PW_PORT=4333 npx playwright test --project=desktop-chromium --project=phone-chromium --project=tablet-chromium` (whole suite) | 792 passed, 261 skipped (project-specific cases), 0 failed |
| acceptance greps | `checklistHead` in outline.ts 1+, `outline-number` in stage.css 1+, `checklist-heading` in Briefing.tsx and Debrief.tsx 1+, `data-marker` in ChecklistOutline.tsx 1+, `data-boxed` in checklist.spec.ts 1+, `Verbatim checklist text` in the policy 1, `at most 12 words` 0, `reproduced exactly as printed` policy 3 and CLAUDE.md 1, `Checklists as printed` in PANEL-REVIEW 1 |

The owner check with the printed pages next to the trainer (desktop and a real phone) is a human check and is not done here; it is item 17 of "Phase 3: owner review".

## Assumptions taken

- C-80 to C-86 of the plan as written.
- A comment row is never graded and shows no "Not graded" text (the plan's debrief example lists Not graded for rows 1 and 4 only); a muted comment under a branch that does not apply is muted like its siblings.
- The briefing source lines now read `Source: <document>, <issue>` then `<section>, checked <date>` (the orchestrator's note: the old join read "AFM 03-08 ENG OIL TEMP, issue Edition 4.1, 2022-10-05"). `e2e/scenario.spec.ts` was changed to match; it still derives the text from the scenario file.
- In the review list the marker shapes are called rhombus, because `tests/panel-review.test.ts` rejects the brand word in that document.
- The graded-row order in the debrief table is number, item, dotted leader, action, then tag, then verdict (the todo says tag and verdict at the end of the row). Because the tag and verdict widths differ from "Not graded", the right edge of the action is not the same on every debrief row; in the briefing it always sits on the right edge.
- The "write cases first and watch them fail" step of Task 2 was not possible as such: the Task 1 tracer already contained the complete renderer (needed for Engine Fire and ENG OIL TEMP to display at all), so the Task 2 cases were written against finished code. They compare with the independent reference, so a drift fails them.
- `.planning/todos/pending/2026-10-23-checklist-verbatim-table.md` was not moved or edited (not in the plan's file list); the orchestrator or the verification step can close it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test expectation] Source line assertion of the briefing e2e case**
- **Found during:** Task 1
- **Issue:** `e2e/scenario.spec.ts` asserted the old join `Source: <section>, issue <issue>` and `<document>, checked <date>`, which the new source block (booklet document, edition) makes read badly (see plan 13 note).
- **Fix:** the display and the assertion now use `Source: <document>, <issue>` and `<section>, checked <date>`; both still read the scenario data.
- **Files modified:** src/ui/screens/Briefing.tsx, e2e/scenario.spec.ts
- **Commit:** 6610cf2

**2. [Rule 1 - Layout] Narrow-screen debrief row wrapped the verdict alone**
- **Found during:** Task 2 (screenshot at 375 px)
- **Issue:** with the first narrow rule the tag stayed next to the item and the verdict word wrapped by itself on the left.
- **Fix:** the narrow rule gives a row up to three lines: number and item, action right-aligned, tag at the left and verdict at the right.
- **Files modified:** src/ui/stage.css
- **Commit:** 6d486ba

**Total deviations:** 2 auto-fixed. **Impact:** none on grading; `tests/fixtures/recordings.json` is byte-identical.

## Known Stubs

None.

## Threat Flags

None. Every checklist string is rendered as a text child (the hostile-text case of `tests/outline.test.ts` runs unchanged and the raw-HTML gate stays); marker shapes are fixed SVG built from the marker name, never from text; no package was installed; the hygiene gate (no PDF, nothing under the private folder tracked) is green.

## Issues Encountered

- The supplied-root pin guard was run verbatim (extracted from the reference file) before the first write and before each commit; it passed each time.
- Nothing was pushed; `.planning/config.json`, `.planning/state.json` and `.planning/milestone.lock` were not committed by this plan; `.planning/STATE.md` is updated by the state tooling.

## Next Phase Readiness

The phase 3 checklist gap (UAT test 10) is closed in code, data and documents. What remains is the owner's comparison with the printed pages (item 17 of "Phase 3: owner review") and the phase verification.

## Self-Check: PASSED

- Created: e2e/checklist.spec.ts exists.
- Commits on the branch: 6610cf2, 6d486ba, 3da521e.
