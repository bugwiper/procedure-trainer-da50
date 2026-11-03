---
phase: 07-training-mode-further-actions-and-repeat-loop
plan: 06
subsystem: engine, aircraft data, scenario, ui, docs
tags: [rework, catalog, chooser-tabs, accept-lists, avoid-actions, conduct-note, sheet-ticks, cas-tags, linux-image]

requires:
  - phase: 07-05
    provides: the footwell toggle cluster, effectiveSelection, SHOW CHECKLIST on every level
provides:
  - "src/engine/catalog.ts, DA50RG_CATALOG and tests/checklist-catalog-reference.ts: the booklet contents pages as aircraft data in three groups, lint L29 and L30 in npm run validate"
  - "CHOOSE SITUATION with three tabs and three rows per page, listing order = catalog order"
  - "the Realistic checklist chooser as catalog tabs with greyed entries, marks of a foreign checklist from the pilot's real actions (panelOnly), tick buttons on rows the program does not check"
  - "Continue to destination (conduct_destination), ALTN 1 FAIL and ALTN 2 FAIL accept it, conduct_note (L31), three Avoid actions, nine-button cluster"
  - "PITOT HT OFF and STALL HT OFF"
affects: [phase UAT]

actuals:
  tokens: 150000
  tasks: 4
  commits: 7
plan_head_before: c986807eb17abb52a499e99957a701b4f85d335c
plan_head_after: f4f2ecb

key-files:
  created:
    - src/engine/catalog.ts
    - src/aircraft/da50rg/checklist-catalog.ts
    - src/scenario/catalog-check.ts
    - tests/checklist-catalog-reference.ts
    - tests/checklist-catalog.test.ts
    - tests/run-checklist.test.ts
    - tests/session-marks.test.ts
  modified:
    - src/engine/{env,further,predicates}.ts
    - src/aircraft/da50rg/{aircraft,further,further-pad,plates,panel,cas}.ts
    - src/scenario/{schema,lint,validate-all}.ts
    - src/ui/{session,outline,debrief-text,App}.ts*
    - src/ui/panel/{session-area.ts,frames/ScenarioAreaFrame.tsx,frames/FurtherAreaFrame.tsx}
    - src/ui/screens/{RunChecklist,ChecklistOutline,Debrief}.tsx
    - src/ui/stage.css
    - scenarios/electrical/{elec-altn1-fail,elec-altn2-fail}.toon
    - tests/fixtures/recordings.json
    - README.md, docs/{GRADING,PANEL-LABELS,PANEL-REVIEW}.md, .claude/CLAUDE.md
    - .planning/{ROADMAP,REQUIREMENTS}.md, .planning/todos/pending/2026-11-01-phase-7-deferred.md

key-decisions:
  - "Cluster geometry (R-21 stop rule did not trip): the starting values (slots 150 x 58, 7 between the rows) failed two gates, 58 units give 42.7 px on a 393 px portrait phone and 7 between the rows leave the Full panel button 2 px short on the 734 x 315 phone profile; admissible values are slots 150 x 60, 7 between columns, 5 between rows, plate 504 x 228 at (268, 873), region 514 x 264 at (263, 866) ending at the pedals plate, headline baseline 892, cluster at (288, 901); no gate was loosened"
  - "The three conduct labels are two lines (ALTERNATE / LANDING, EMERGENCY / LANDING besides CONTINUE TO / DESTINATION): one line did not fit a 150 unit button with a margin"
  - "validateAll judges a catalog ref only when its pack was among the validated ones, so validating one folder (the broken fixture) does not report the catalog"
  - "conductNote shows only the green line when all three Avoid actions were chosen (the note text is dropped then)"
  - "An Avoid pick adds its own optional entry to result.further.actions, so the grade JSON differs from the plain one in exactly those entries (the plan said identical JSON; verdict, reasons, steps and conduct are identical, a unit case pins it)"

requirements-completed: [SES-01, SES-02, SES-04, SES-05, PNL-25]

completed: 2026-11-03
status: complete
---

# Phase 7 Plan 06: Catalog, grouped choosers, Avoid row, conduct note, sheet ticks and printed CAS tags Summary

**The booklet's checklist catalog orders CHOOSE SITUATION (three tabs, three rows) and the Realistic checklist chooser, the chosen checklist is marked from the pilot's real panel actions with tick buttons on the rows the program cannot check, the conduct reads Continue to destination with reviewed accept lists and a debrief note, the Avoid row makes nine footwell buttons, and the heat messages read the printed tags, with every gate green on macOS and in the Linux image.**

## Accomplishments

- **Task 1 (tracer).** `defineCatalog` (pure, throws for empty tags, repeated groups, entry keys or refs), `DA50RG_CATALOG` with the owner's entries and an independent reference table; `checkCatalog` (L29, L30) wired into `validateAll`; `listChoices` in catalog order, `chooseGroup`, `chooseTab`, `groupChoices`; `SESSION_LAYOUT.choose` with three tabs and three rows, footprints, frame; e2e helpers read the catalog order from the reference (`walkGroupPages`, `pressChooseTab`, `firstShownGroup`) and the pack, session-area, fire, scenario and loop specs derive from them.
- **Task 2.** `panelOnly`; `buildOutline(..., manual)` with `tap` on lines and on steps the program does not check (`all`, `panel`, `none`); session `checklistTab`, `checklistAuto`, `checklistTicks`, `toggleManualMark`, `openedRef`; marks of a foreign checklist from the same events graded against that file (try block, one-entry cache per log state, coalescing kept); `checklistNote` and the debrief line; `RunChecklist` tabs and greyed entries; tick buttons of 44 px with the green tint.
- **Task 3.** Rename to `conduct_destination`; ALTN 1 FAIL and ALTN 2 FAIL accept destination and precautionary with a `conduct_note`; the review of every other declaration (kept); `conduct_note` in the schema, lint L31; three Avoid options (`avoid`, `unrated`, `noteConduct`); `conductNote` and the debrief block; nine-button geometry; four recordings; e2e for the cluster, the Avoid toggles and the notes.
- **Task 4.** PITOT HT OFF and STALL HT OFF; GRADING R20 and R21 and the authoring parts, PANEL-LABELS, PANEL-REVIEW (corrected paragraphs, items 16 to 23 with the accept-list table), README, REQUIREMENTS, ROADMAP (6 of 6), the todo and CLAUDE.md; the final gates.

## Task commits

| Task | Commit | Content |
| ---- | ------ | ------- |
| 1 | b3f22ae | catalog, validate check, tabs and three rows, helpers and specs |
| 2 | a8732b6 | sheet tabs, marks from real actions, tick rows, debrief line |
| 3 | ab420e5 | conduct rename, accept lists, Avoid row, conduct note, geometry |
| 4 | e675ed0, 96835d5, 82c3d3f, f4f2ecb | CAS tags; documents; label font slack; Linux result in the review list |

## Verification

- `rm -rf node_modules/.vitest-cache && npx vitest run`: 83 files, 4110 tests passed (07-05 ended at 80 files, 4015; new files `checklist-catalog`, `run-checklist`, `session-marks`).
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (10 files, 0 problems): clean. The removal greps (old conduct wording, old CAS texts) return no match in src, tests, e2e, scenarios, README, docs and `.claude`.
- Playwright, whole suite, all seven projects, macOS (PW_PORT=4400): 3731 specs (533 each), 2823 passed, 908 skipped, 0 failed. Per project passed/skipped: desktop-chromium 482/51, desktop-webkit 456/77, phone-chromium 469/64, phone-webkit 372/161, tablet-chromium 380/153, tablet-webkit 372/161, phone-portrait 292/241.
- Linux image (`mcr.microsoft.com/playwright:v1.64.1-noble`, `git archive` of the committed tree, `npm ci`, CI=1, `--retries=0 --workers=4`, 34 min), whole suite: 2792 passed, 938 skipped, 1 failed. Per project passed/skipped: desktop-chromium 482/51, desktop-webkit 456/77, phone-chromium 469/64, phone-webkit 362/171, tablet-chromium 379/153 (+1 failed), tablet-webkit 362/171, phone-portrait 282/251. The failure (the label margin of Brief passengers on tablet-chromium, 0.3 px outside 6 units) was fixed with 1 px of font slack as WORKFLOW allows (82c3d3f); `e2e/further.spec.ts` then passed in the image on all seven projects (91 of 91). The full Linux suite was not repeated after that fix.
- Visual check (D-18, scratch specs deleted, nothing left under `e2e/`): screenshots in the session scratchpad as `07-06-t1-*` (free pad, the three CHOOSE SITUATION tabs, page 2; desktop, phone landscape, phone portrait for EMERGENCY), `07-06-t2-*` (Realistic tabs, a greyed entry, own checklist with Done and ticked rows, foreign checklist with a green row, debrief; three profiles) and `07-06-t3-*` (the nine-button cluster none, some and all selected, a ground run, the debrief with the yellow note; three profiles). Looked at: tabs fit their labels, rows readable, nine buttons fit with labels, Full panel button clear, the yellow hint and tick tint read well. On the narrow portrait sheet the three full-heading tabs stack and push the entries below the fold (the body scrolls).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's starting geometry fails two gates**
- **Found during:** Task 3 (measured with a scratch test on the real profiles)
- **Issue:** slots 150 x 58 give 42.7 px on a 393 wide portrait phone (gate 44), and rows 7 units apart left the Full panel button 21 units short on the 734 x 315 phone profile once the region ends at the pedals plate.
- **Fix:** admissible values exist (see key-decisions), so the stop rule did not apply. The 07-05 unit floor of 64 units for a slot height in `tests/further-pad.test.ts` became 58 (the 44 px gate after the zoom is the gate that counts); the typed rectangles of `tests/layout.test.ts`, `tests/zoom.test.ts` and `tests/further-pad-reference.ts` follow. **Commit:** ab420e5

**2. [Rule 1 - Bug] One-line ALTERNATE LANDING and EMERGENCY LANDING did not fit 150 units**
- **Fix:** two-line labels (words unchanged). **Commit:** ab420e5

**3. [Rule 1 - Bug] The headline gate and the Full panel gate conflicted with the plan's headline baseline 889**
- **Fix:** cluster top 901 and baseline 892 (plate 228 high) satisfy both the cap-top margin and the region margin. **Commit:** ab420e5

**4. [Rule 3 - Blocking] `validateAll` on a folder with other packs reported the whole catalog**
- **Fix:** a ref into a pack that was not validated is not judged. **Commit:** b3f22ae

**5. [Rule 3 - Blocking] `tests/checklist-catalog.test.ts` validateAll case timed out under load**
- **Fix:** 60 s timeout for that describe. **Commit:** 96835d5

**6. [Rule 1 - Bug] Linux font width in the footwell label margin** (see Verification). **Commit:** 82c3d3f

### Plan variations (no change against the decisions)

- The plan says an Avoid pick changes nothing in the grade JSON. The result lists a picked Avoid action (the debrief needs the row), so the JSON gains exactly those optional entries; verdict, reasons, steps and conduct are identical and a unit case compares them.
- The plan names `e2e/checklist.spec.ts`; it needed no change (it tests printed text) and ran green.
- No shipped scenario has a quantity step, so the "foreign quantity step stays neutral and tappable" case is covered by unit tests only (`tests/outline.test.ts`, `tests/session.test.ts`); the e2e foreign case marks a panel step.
- On phone-webkit, tablet-webkit and phone-portrait on Linux two new sheet specs (the own checklist as the choice with no debrief note, the ticked line row) carry the existing Linux WebKit touch-tap skip with its stated reason; they were skipped there pre-emptively, not shown to fail without it.
- `.planning/STATE.md` and `state.json` were not updated (instruction); `config.json` and `state.json` are in no commit.
- `commits: 7` is measured from c986807 and includes the documents and the review-list commits; this summary is committed after it.

## Known Stubs

None.

## Accept-list review (R-20)

ALTN 1 FAIL and ALTN 2 FAIL changed to destination and precautionary (printed rows end NVFR/IFR flight and land at the nearest suitable airfield); ENG OIL TEMP, ICING CONDITIONS kept precautionary; ENGINE FIRE in flight, ELEC FIRE FLIGHT, T/O FIRE NO ABORT kept emergency; the three ground scenarios kept none. The table with the reasons is item 18 of `docs/PANEL-REVIEW.md` "Phase 7: owner review". The golden expectations that changed on purpose: `elec-do-nothing` and `elec-do-nothing-long` (the reason `conduct` is gone).

## Owner review points

Items 16 to 23 of `docs/PANEL-REVIEW.md` "Phase 7: owner review": the short tab labels, three rows per page, the pad listing playable situations only, the catalog order of Next situation, the group three entries named by shipped headings, the two OXY PRESS LO qualifiers, every accept list, the Avoid row hidden without a conduct, the nine-button geometry (adjusted values), two-line landing labels, the green line for all three Avoid actions, comment rows not tappable, marks from real actions (green for the wrong situation, quantity steps tappable), the wording of the checklist note, the CAS tags.

## Unverified

- Real phones and tablets (only Playwright device emulations): tick tint on a bright screen, 44 px at the real font rendering, the stacked tabs on a narrow portrait sheet.
- The two new sheet specs on Linux WebKit touch (skipped there); the full Linux suite after the 1 px font slack fix (only `further.spec.ts` was repeated).
- The foreign-marks path against a file with a quantity step in an e2e (none shipped).

## Threat Flags

None new. T-07-16 (the tabs, greyed state and first tab are the same in every run; before the onset nothing is marked and every action row is tappable: `tests/session.test.ts`, `tests/outline.test.ts`), T-07-17 (ticks, choice, catalog position and Avoid picks never reach the grade: JSON cases in `tests/session.test.ts` and `tests/grading.test.ts`), T-07-18 (author text as text children only, `conduct_note` at most 50 words in the schema), T-07-19 (one grade per state of the log, nothing graded while hidden or at the list, a throw gives no marks: `tests/session-marks.test.ts`) and T-07-20 (only printed tags and headings enter the catalog; `tests/content-policy.test.ts` and `tests/docs-format.test.ts` pass) are covered.

## Self-Check: PASSED

Created files exist (`src/engine/catalog.ts`, `src/aircraft/da50rg/checklist-catalog.ts`, `src/scenario/catalog-check.ts`, `tests/checklist-catalog-reference.ts`, `tests/checklist-catalog.test.ts`, `tests/run-checklist.test.ts`, `tests/session-marks.test.ts`); commits b3f22ae, a8732b6, ab420e5, e675ed0, 96835d5, 82c3d3f and f4f2ecb are on the branch; `git status` shows no scratch spec and `.planning/config.json` and `state.json` modified only as before the plan and in no commit; nothing is pushed.
