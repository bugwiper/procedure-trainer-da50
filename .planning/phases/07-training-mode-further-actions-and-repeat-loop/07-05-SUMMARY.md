---
phase: 07-training-mode-further-actions-and-repeat-loop
plan: 05
subsystem: engine, ui, docs
tags: [rework, further-actions, toggle-buttons, footwell, effective-selection, linux-image]

requires:
  - phase: 07-02
    provides: the further actions as aircraft data, roles, conduct, grading rules R16 to R19
  - phase: 07-04
    provides: no mode, the slim run view of the pad with a temporary FURTHER ACTIONS button
provides:
  - "RecordedDecision.on and effectiveSelection (src/engine/further.ts): the state the presses leave, one helper for the grade, the session and the buttons"
  - "FURTHER_PAD, plate further-pad and region further_area: six footwell toggle buttons as aircraft data"
  - "session.toggleDecision and session.furtherSelection; no modal, no pad button, no clock pause"
  - "FurtherAreaFrame and the selected look of SessionButton"
  - "six toggle recordings in tests/fixtures/recordings.json"
affects: [phase UAT]

actuals:
  tokens: 39600
  tasks: 3
  commits: 4
plan_head_before: 36c91b265d0ce32c2708f30b2d32414a5e8dd2c4
plan_head_after: 4f37a8b

key-files:
  created:
    - src/aircraft/da50rg/further-pad.ts
    - src/ui/panel/frames/FurtherAreaFrame.tsx
    - tests/further-pad.test.ts
    - tests/further-pad-reference.ts
  deleted:
    - src/ui/screens/FurtherActions.tsx
  modified:
    - src/engine/further.ts
    - src/aircraft/da50rg/{further,plates,panel}.ts
    - src/ui/{session.ts,App.tsx}
    - src/ui/panel/{Panel,PanelShell,zoom,session-area}.ts*
    - src/ui/panel/frames/ScenarioAreaFrame.tsx
    - src/ui/panel/widgets/SessionButton.tsx
    - tests/{further,session,grading,debrief-text,layout,layout-reference,zoom,session-run-view,blueprint,panel-review}.test.ts
    - tests/fixtures/recordings.json
    - e2e/{further,session-area}.spec.ts
    - e2e/support/session.ts
    - README.md
    - docs/{GRADING,PANEL-LABELS,PANEL-REVIEW}.md
    - .planning/{ROADMAP,REQUIREMENTS}.md
    - .planning/todos/pending/2026-11-01-phase-7-deferred.md
    - .claude/CLAUDE.md

key-decisions:
  - "The zoom region further_area is larger than its plate (660 x 260 around a 640 x 210 plate with a 600 x 170 cluster): a run leaves only about 300 px of panel height on a landscape phone, and the Full panel corner must stay clear of the buttons while the buttons stay 44 px high on a portrait phone; a region 20 units around the cluster cannot satisfy both"
  - "Slots are 190 x 78 (R-07 started at 190 x 87): 78 units is the lowest height that gives 44 px on a 393 px wide portrait phone together with the room above the buttons on the landscape phone"
  - "The plate further-pad is drawn (default plate fill) so the free panel shows an empty plate; the session pad, the transponder and the pedals plates are geometry only"
  - "Groups and group titles of further.ts had no reader after the modal went and were removed with their cases; the conduct title stays (the debrief reads it)"
  - "An action selected and then cleared reads like one never selected (no row unless declared); a conduct selected and cleared keeps its picks line and shows Missing"

requirements-completed: [SES-05]

duration: 9h
completed: 2026-11-02
status: complete
---

# Phase 7 Plan 05: Six footwell toggle buttons instead of the Further actions modal Summary

**The calls and the landing decision are six static-label toggle buttons in the pilot footwell, recorded as presses with an optional `on` flag, graded by the state they are in when Procedure complete is pressed, with the modal, its pad button and its clock pause gone and every gate green on macOS and in the Linux image.**

## Accomplishments

- **Engine (S-01).** `RecordedDecision { t, id, on? }` (absent means on, only `false` switches off); `effectiveSelection(decisions, set)` returns `{ actions, conduct }` (an action is selected when its last entry is on; the conduct is replayed: an on entry selects, an off entry clears only the selected option). `gradeFurther` runs it on the counted decisions after the outcome cut; `picks` stays the history of the on entries of the conduct, `last` is the selection at the end. All pre-existing cases of `tests/further.test.ts` and the 23 old golden recordings pass untouched.
- **Aircraft data (S-02).** `label` on each `FurtherOption` (BRIEF PASSENGERS, MAYDAY, PAN PAN PAN, CONTINUE NORMALLY, ALTERNATE LANDING, EMERGENCY LANDING), `FURTHER_PAD`, the plate `further-pad`, the region `further_area`, with independent references (`tests/further-pad-reference.ts`, hand-typed rectangles in `tests/layout.test.ts` and `tests/zoom.test.ts`, `ALL_REGION_IDS` and `UNDER_PANEL_REGIONS`).
- **Session (S-03).** `toggleDecision(id)` and the computed `furtherSelection`; `decide`, `openFurther`, `closeFurther`, `furtherOpen`, the modal component and its mount are deleted; the clock driver no longer waits for decisions.
- **Buttons (S-04).** `SessionButton` has `selected` (tint, bright rim, `aria-pressed`, `data-selected`); `FurtherAreaFrame` draws the slots of `FURTHER_PAD` in a live run only, leaves the three conduct slots out when `offersConduct` is false, and names no option id (`tests/blueprint.test.ts` also forbids the six labels in `src/engine`, `src/scenario` and `src/ui`); `furtherFootprints` joins the Full panel corner chooser.
- **Debrief (S-05).** The existing rows already read the final selection; cases pin a cleared conduct (picks line, Missing, no note), a switched conduct and a cleared action.
- **Helpers (S-06).** `pickFurther` keeps its signature (presses each id once and expects it selected); `toggleFurther` presses once.
- **Documents (R-12).** GRADING R16 and R18 (the toggle rule, the final-state rule, the group that can be cleared, absent conduct buttons, the six new recordings), PANEL-LABELS (six rows), PANEL-REVIEW (new section "Further actions cluster", Session area paragraph corrected, "Phase 7: owner review" rewritten with 15 numbered items, the open owner points and the gate results), README, SES-02, SES-03, SES-05 and the Phase 7 criteria, roadmap (Wave 4, 5/5), the deferred-ideas todo, CLAUDE.md.

## Task commits

| Task | Commit  | Content |
| ---- | ------- | ------- |
| 1 Tracer | 6a5fbd2 | the toggle model, the footwell cluster, the session toggles, the deleted modal, specs and tables |
| 2 | d40b752 | six toggle recordings and the replay-based expectation helper, debrief wording cases, the footwell specs |
| 3 | de25935, 4f37a8b | documents, requirements, roadmap, todo, CLAUDE.md; the Linux result in the review list |

## Verification

- `rm -rf node_modules/.vitest-cache && npx vitest run`: 80 files, 4009 tests passed (07-04 ended at 79 files, 3964; `tests/further-pad.test.ts` is new).
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (10 files, 0 problems): clean.
- Playwright, whole suite on all seven projects (PW_PORT=4398): 3675 specs (525 each), 2770 passed, 905 skipped, 0 failed. Per project passed/skipped: desktop-chromium 474/51, desktop-webkit 448/77, phone-chromium 461/64, phone-webkit 364/161, tablet-chromium 372/153, tablet-webkit 364/161, phone-portrait 287/238.
- Linux image (`mcr.microsoft.com/playwright:v1.64.1-noble`, `git archive` copy of the committed tree in the session scratchpad, `npm ci`, CI=1, `--retries=0 --workers=4`), whole suite, all seven projects: 2746 passed, 929 skipped, 0 failed (30.7 min). Per project passed/skipped: desktop-chromium 474/51, desktop-webkit 448/77, phone-chromium 461/64, phone-webkit 356/169, tablet-chromium 372/153, tablet-webkit 356/169, phone-portrait 279/246. The 24 extra skips are the known Linux WebKit touch class that plan 07-04 and commit 35e2eda already skip with a stated reason (the CHECKLIST and HINT taps in `run-help.spec.ts`, two `sound.spec.ts` cases); no spec was added to that list and no expectation was changed. The new footwell specs passed in Linux WebKit with touch taps (phone-webkit, tablet-webkit, phone-portrait).
- Visual check (D-18, scratch spec deleted, nothing under `e2e/` left over): free panel with the empty plate, a run with none, one and several buttons selected, a ground run, on desktop-chromium, phone-chromium and phone-portrait. The cluster fits its plate, the labels fit their buttons, nothing overlaps the pedals or the pulls above, a selected button (blue face, bright rim) reads at a glance on the phone, and the Full panel button stays clear of the buttons.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Full panel button covered a footwell button on the landscape phone (found by the e2e hit and corner case)**
- **Found during:** Task 1 (screenshot review, then `e2e/further.spec.ts`)
- **Issue:** with the starting values of R-07 (region 600 x 190, slots 190 x 87) the zoomed view left 25 to 40 px above and below the buttons on a Pixel 7 landscape run (the panel is only 300 px high in a run, 332 on the free panel), less than the 52 px the Full panel button needs; unit tests with the 734 x 315 profile passed and hid it.
- **Fix:** the region is larger than the plate: 660 x 260 at (190, 868) around the plate (200, 893, 640 x 210) and the 600 x 170 cluster (slots 190 x 78, columns 30, 235, 440, rows 45 and 137 in the region). `tests/zoom.test.ts` now checks the real run heights of both landscape phones (863 x 300, 734 x 283) and three portrait phones; the layout test accepts the region around the plate. **Commit:** 6a5fbd2

**2. [Rule 2 - Missing critical] The plate was invisible**
- **Found during:** Task 1 screenshot review
- **Issue:** plates of trainer parts (session pad, pedals) are geometry only; an "empty plate on the free panel" showed nothing.
- **Fix:** `PanelShell` draws `further-pad` with the default plate fill next to the cabin plate. **Commit:** 6a5fbd2

**3. [Rule 3 - Blocking] `session-area.spec.ts` counted the footwell hit rectangles**
- **Issue:** `hitSizes` read every `[data-session-hit]` and listed `session.further`.
- **Fix:** it reads `session.*` only and the list lost `session.further`; the footwell has its own hit-size and corner case in `further.spec.ts`. **Commit:** 6a5fbd2

### Plan variations (no change against the decisions)

- The plan's removal grep (`session\.further` in src, tests and e2e) also matches the new member `session.furtherSelection`, which S-03 prescribes; the removed names (`openFurther`, `closeFurther`, `furtherOpen`, `FurtherActions`, `further-modal`) have no match.
- The old session method was called `decide`, not `pick`; it was replaced by `toggleDecision` and every caller in `tests/session.test.ts` was moved over (a repeated press of an action now toggles instead of being logged once; the cases were rewritten for it).
- Group titles and `group` of `further.ts` were removed with their three test cases (the plan allows it when no reader is left); the conduct title stays.
- `docs/PANEL-REVIEW.md` is not covered by `format:check` (and was not before); prettier was not run on `docs/`, and `README.md` was restored after a prettier run had reflowed an unrelated table.
- STATE.md and `.planning/state.json` were not updated (the instruction was to leave `state.json` and `config.json` untouched; plan 07-04 did not update STATE.md either); `.planning/config.json` and `state.json` are not part of any commit.
- `commits: 4` is measured from 36c91b2 and counts the task and document commits; this summary is committed after it.

## Known Stubs

None.

## Owner review points

Listed in `docs/PANEL-REVIEW.md` "Phase 7: owner review" (items 1 to 15). From this plan: the six labels (ALTERNATE LANDING is your wording), the footwell place and size, the empty plate on the free panel, the conduct buttons absent (not greyed) on the ground and without a flight decision, no clock pause for the decisions, the debrief wording for a conduct that was selected and then cleared. Carried over from 07-04: the empty HINT row on Easy and Medium leaves a gap between CHECKLIST and LEAVE, and the hint box covers the top of the instruments on a landscape phone.

## Unverified

- Real phones and tablets (only the Playwright device emulations were run): the tint of a selected button on a bright screen, the label fit at the real font rendering, the tap size of the six buttons.
- The debrief wording for a cleared conduct ("Picked: ..." with the verdict Missing) is a planner default.
- A press before the Realistic onset is ignored without any sign; a pilot may think the button is dead for the first seconds (by design, T-07-13).

## Threat Flags

None new. T-07-12 (an unknown id still throws, also with the off flag; only `false` switches off; the old recordings are pinned by the unchanged golden fixture and a flag-written-out comparison), T-07-13 (buttons drawn alike, a press before the onset ignored; case in `tests/session.test.ts` and the Realistic e2e) and T-07-15 (no photo or private path in the documents; `tests/content-policy.test.ts`, `tests/docs-format.test.ts` pass) are covered.

## Self-Check: PASSED

Created files exist (`src/aircraft/da50rg/further-pad.ts`, `src/ui/panel/frames/FurtherAreaFrame.tsx`, `tests/further-pad.test.ts`, `tests/further-pad-reference.ts`); `src/ui/screens/FurtherActions.tsx` is gone; commits 6a5fbd2, d40b752, de25935 and 4f37a8b are on the branch; `git status` shows no scratch spec and `.planning/config.json` and `state.json` modified only as before the plan and in no commit; nothing is pushed.
