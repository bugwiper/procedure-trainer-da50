---
phase: 07-training-mode-further-actions-and-repeat-loop
reviewed: 2026-11-01T00:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - src/engine/hint.ts
  - src/engine/further.ts
  - src/engine/grading.ts
  - src/engine/env.ts
  - src/aircraft/da50rg/further.ts
  - src/aircraft/da50rg/aircraft.ts
  - src/scenario/schema.ts
  - src/scenario/lint.ts
  - src/ui/session.ts
  - src/ui/App.tsx
  - src/ui/debrief-text.ts
  - src/ui/panel/session-area.ts
  - src/ui/panel/frames/ScenarioAreaFrame.tsx
  - src/ui/screens/Briefing.tsx
  - src/ui/screens/Debrief.tsx
  - src/ui/screens/FurtherActions.tsx
  - src/ui/screens/HintLine.tsx
  - src/ui/screens/ModePick.tsx
  - src/ui/screens/RunChecklist.tsx
  - scenarios/electrical/elec-altn1-fail.toon
  - scenarios/electrical/elec-altn2-fail.toon
  - scenarios/engine/eng-fire-in-flight.toon
  - scenarios/engine/eng-oil-temp-green.toon
  - scenarios/fire/elec-fire-flight.toon
  - scenarios/fire/elec-fire-ground.toon
  - scenarios/fire/eng-fire-ground.toon
  - scenarios/fire/takeoff-fire-abort.toon
  - scenarios/fire/takeoff-fire-no-abort.toon
  - scenarios/icing/icing-unintentional.toon
  - README.md
  - docs/GRADING.md
  - tests/further.test.ts
  - tests/hint.test.ts
  - tests/session.test.ts
  - tests/readme-guide.test.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-11-01
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

Phase 7 is in good shape. `npx vitest run` passes (80 files, 3958 tests), `tsc --noEmit` is clean, `eslint` on src/engine, src/scenario and src/ui is clean, and `npm run validate` reports 10 files with 0 problems.

I checked the following and found no defect:

- **Grading, multi-pick and last pick.** `gradeFurther` counts an action once. The conduct is graded by its last pick, and earlier picks stay visible. Decisions after the outcome time are dropped (`t <= outcomeAt`, consistent with R10), and an unknown id throws. The reason order matches D-11.
- **Conduct on the ground.** `conduct: none` gives status `not_declared`, which never fails. L28 ties `none` to `ground_roll > 0`. The three ground scenarios declare `none` and all flight scenarios declare `accept`. `decide()` rejects a conduct pick when `offersConduct` is false.
- **`grade` and mode or level.** Neither is an input of `grade`. `askHint` reads the mode only to gate the feature, and the hint is the grade of the partial recording, so it cannot disagree with the debrief.
- **Retry determinism.** `retrySeeds` reuses the recorded onset and variant seeds and draws no new rng. `start()` rebuilds the scenario from the file's own scenario, so a replay agrees.
- **Stale state across Retry, Next and Back.** `hint`, `checklistShown`, `runBranches`, `decisions` and `furtherOpen` are cleared in `start`, `toFreePanel`, `completeRun`, `closeDebrief` and `retry`.
- **Modal and clock.** The Further modal sits on the shared `Modal`, which holds a modal id, so `blocked` stops the clock driver.
- **README.** The worked example is parsed and linted by `tests/readme-guide.test.ts`. The quoted error position (`54:11`, `"opened"`) matches line 54 of the example block.

The findings below are a leak of the failure in Realistic, an unenforced owner rule, and minor wording and flow issues.

## Warnings

### WR-01: The CHECKLIST sheet reveals the failure before the onset on Realistic

**File:** `src/ui/session.ts:863`
**Issue:** `askHint` refuses to answer before the onset of a Realistic run, because a hint would give the failure away (T-07-02, D-04). `toggleChecklist` has no such guard. In Training on Realistic the pilot can open the sheet during the clean start. The sheet shows the printed heading and the message tag (for example ENGINE FIRE) plus all steps, which names the situation the Realistic level hides. D-03 says "available on every level", but the leak defeats the reason Realistic exists and contradicts D-04.
**Fix:** Either make `toggleChecklist` and the CHECKLIST button inert until `!beforeOnset()` (the helper exists), or have the sheet show nothing until the onset. If the owner wants the sheet before the onset, record it as a decision in PANEL-REVIEW.
```ts
toggleChecklist() {
  if (mode.peek() !== 'training' || screen.peek() !== 'running') return;
  if (beforeOnset()) return;
  checklistShown.value = !checklistShown.peek();
},
```

### WR-02: "Brief passengers is never required and never fails" is documented but not enforced

**File:** `src/scenario/lint.ts:744` (`checkFurther`), `src/aircraft/da50rg/further.ts:14`
**Issue:** D-08, GRADING R17 and the Phase 7 docs state that brief passengers is never `required` and never fails the run. Neither L27 nor the schema checks this. A scenario with `brief_passengers` as `required`, or `harmful` with `fails_run: true`, passes `npm run validate` and then fails real runs. Only the shipped files happen to comply. The engine and lint may not name ids, so the rule has to be aircraft data.
**Fix:** Add `rated?: false` (or `neverFails: true`) to `FurtherOption` in `src/engine/further.ts`. Set it on `brief_passengers` in `src/aircraft/da50rg/further.ts`. In L27, reject the roles `required` and `harmful` for such an option, and add a lint test. Alternatively, drop the claim from the docs.

## Info

### IN-01: A harmful further action without `fails_run` shows as red "Harmful" in a PASS

**File:** `src/ui/debrief-text.ts:142`
**Issue:** The verdict is "Harmful" with tone `critical` whenever `entry.done` is true, regardless of `failsRun`. The result can still be PASS, because `further_harmful` is only added with `fails_run`. This matches R17 ("shown and fails the run only when `fails_run: true`"). The red word next to a PASS may confuse the pilot, though.
**Fix:** Use tone `standard` when `!entry.failsRun`, or add a "does not fail the run" suffix. This is a UX decision.

### IN-02: The hint sentence "All required steps are done" can be wrong in the run's own terms

**File:** `src/ui/session.ts:107`, `src/ui/session.ts:852`
**Issue:** `nextOpenStep` looks at checklist steps only. A scenario with `accept` also fails when a required further action or the conduct is missing. The pilot who follows "All required steps are done. Press Procedure complete" can still get FAIL (`conduct` missing, or `further_missed`). The text is a fixed own-wording sentence.
**Fix:** Say "All checklist steps are done." and, when the section requires something, point to FURTHER ACTIONS. Compute that from `scenario.further`, not from ids.

### IN-03: The hint line is a snapshot and stays on screen after the pilot acts

**File:** `src/ui/session.ts:852`, `src/ui/App.tsx:282`
**Issue:** `hint` is set once per HINT press and stays until the next press or the end of the run. After the pilot performs the named step, the line still names it as the next open step. This is probably intended (H-04: a line that is shown on demand), but it is not documented, and a second press is needed.
**Fix:** Document it in README section 6, or clear `hint` when a user event is logged after it.

### IN-04: `nextSituation` can be overtaken by Back to panel, and a failed list load cannot be retried

**File:** `src/ui/session.ts:900` (`closeDebrief`), `src/ui/session.ts:942` (`nextSituation`)
**Issue:** Two issues share this path.
1. `nextSituation` awaits `listChoices` and `openScenario`, but `closeDebrief` and Retry are only guarded by `screen`, and only Retry checks `busy`. If the pilot presses Back to panel while the load runs, the screen goes to `free`. Then `openBriefing(…, true)` finishes and opens a briefing (or starts a Realistic run) that the pilot had already left.
2. When `listChoices` fails, `lastRequest` stays `null`. The error card's retry then only dismisses (`retryLoad` takes the `dismissFailure` branch), and the debrief stays underneath.

**Fix:** Make `closeDebrief` return when `busy.peek()`, or re-check `screen.peek() === 'debrief'` before `openBriefing`. In the failure branch set `lastRequest = { kind: 'list' }` or a `next` kind.

### IN-05: A recording with a decision before the Realistic onset is graded, not refused

**File:** `src/engine/further.ts:160`
**Issue:** R16 says a pick before the onset "is not possible". That holds only for the UI (`decide` and `openFurther` check `beforeOnset`). `gradeFurther` does not know the onset, so a hand-built or imported recording with an early decision is counted. This is harmless for live runs.
**Fix:** Note in R16 that the rule is a UI rule, or have `grade` drop decisions with `t < recording.onset.at`.

---

_Reviewed: 2026-11-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
