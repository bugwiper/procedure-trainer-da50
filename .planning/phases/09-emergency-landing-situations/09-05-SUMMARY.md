---
phase: 09-emergency-landing-situations
plan: 05
subsystem: follow-on offer, carried panel, confirm step, door and window rows, two-line choose tabs
tags: [follow_on, carry, Recording.carry, confirm, L35, doors, windows, choose-tabs]
requires: ["09-01", "09-02", "09-03", "09-04"]
provides:
  - "the debrief offers the follow-on whenever the scenario declares one (after PASS or FAIL, whatever conduct was selected), the note of the emergency landing only without a declared follow-on (R-13)"
  - "carryOf (src/engine/carry.ts), Recording.carry, baselineOf and simSetup with a carry; grade, the simulation and the replay start from it; the session captures it at all four ends of a run, the follow-on start lays it over the file's initial controls, Retry keeps it (R-14)"
  - "the step key confirm: true with lint L35 (L5 skips it, L11 does not count it); LANDING ENGINE OFF starts with the transfer pump off and no FUEL TRANS message, row 11 is a confirm step (R-10, R-11)"
  - "ENGINE FIRE IN FLIGHT rows 7 and 8 are optional panel steps on the emergency window and the door; a hand-typed table and a scan keep every door and window row of the shipped files a panel step (R-12)"
  - "the choose tabs read Annunciated / WARNINGS, Annunciated / CAUTIONS and Non-annunciated / EMERGENCIES in two static lines at label size 10 (R-17)"
affects: []
tech-stack:
  added: []
  patterns:
    - "a recorded start panel (full record of every control, momentary at rest) as run data beside the onset, the variant and the draw"
    - "an authoring-only step key whose semantics are those of an existing grading rule"
key-files:
  created:
    - src/engine/carry.ts
    - tests/carry.test.ts
    - tests/confirm-step.test.ts
    - tests/shipped-doors.test.ts
    - tests/session-button.test.ts
  modified:
    - src/engine/predicates.ts
    - src/engine/sim.ts
    - src/engine/grading.ts
    - src/engine/catalog.ts
    - src/engine/further.ts
    - src/aircraft/da50rg/further.ts
    - src/aircraft/da50rg/checklist-catalog.ts
    - src/scenario/schema.ts
    - src/scenario/lint.ts
    - src/ui/session.ts
    - src/ui/debrief-text.ts
    - src/ui/App.tsx
    - src/ui/screens/Briefing.tsx
    - src/ui/screens/Debrief.tsx
    - src/ui/panel/session-area.ts
    - src/ui/panel/widgets/SessionButton.tsx
    - src/ui/panel/frames/ScenarioAreaFrame.tsx
    - scenarios/landing/landing-engine-off.toon
    - scenarios/landing/ditching.toon
    - scenarios/engine/eng-fire-in-flight.toon
    - tests/fixtures/scenarios/fire-ordered.toon
    - docs/GRADING.md
    - docs/PANEL-REVIEW.md
    - docs/PANEL-LABELS.md
    - README.md
    - .claude/CLAUDE.md
decisions:
  - "The carried panel is rule R25 and the confirm step rule R26 in GRADING.md: R24 is the Realistic landing rule that plan 09-04 added, so the plan's R24 and R25 shift by one."
  - "followOnTargets(section, set) and followOnOffer(section, set, realistic) take no result any more: PASS, FAIL and the conduct cannot be an input of the offer."
  - "A failed load of a follow-on keeps the carry in its retry request (lastRequest.left), so retryLoad does not silently start from the file's own baseline."
  - "The tab label size is 10, the largest size in use on the panel (14, 10, 8, 6) that leaves 6 units on each side of the 15 character line Non-annunciated by the glyph rule."
metrics:
  duration: "one session"
  completed: 2026-11-04
status: complete
requirements-completed: [SES-09, CNT-06]
commits: 6
plan_head_before: 23337132a2d69bfd6d95bdece7ce404dc18e8836
plan_head_after: 454e6d2149574d3696876e1dc550b4397c555c35
actuals:
  tokens: 120000
  tasks: 3
  commits: 6
---

# Phase 9 Plan 05: The carried panel, the offer without the conduct, the confirm step Summary

After ENGINE FIRE IN FLIGHT with the fuel valve forgotten the debrief offers the landing whatever conduct was picked and the landing starts with the panel the fire run left (fuel selector still at NORMAL, its row open, the rows the pilot did already marked and credited); LANDING ENGINE OFF chosen from the chooser starts with the transfer pump off, no FUEL TRANS message and row 11 as a confirm step; ENGINE FIRE IN FLIGHT credits the emergency window and the door; the three choose tabs read in two static lines.

`commits: 6` is the measured count from `plan_head_before` to `plan_head_after`: my five (`56abf12`, `7a5e2b2`, `1b3b239`, `da7bcfd`, `454e6d2`) plus the coordinator's `b6e2dd9` made during the outage; the closing documents commit follows this file.

## What was built

**Task 1, the tracer (`56abf12`).** `followOnTargets` and `followOnOffer` read the declaration only (R-13); `furtherNote` shows the note only without a declared follow-on. `src/engine/carry.ts`: `carryOf(registry, state)` returns a frozen full record of every control (a momentary button at its rest state, a RangeError naming a control the state map lacks). `baselineOf(scenario, registry, carry?)` lays the carry over the initial controls (PredicateError for an unknown control or an illegal state); `SimOptions.carry`, `Recording.carry`, `startContext`, `replaySim` and `branchStatuses` start from it, the body of `grade` is unchanged. `session.ts` captures the carry in `completeRun` (all four ends) into a closure variable that `runFollowOn` reads before `openBriefing` resets the panel, hands it through `Briefed.carry` and `begin` to `start`, which lays it over `used.initial.controls` for `bridge.reset`, `simSetup` and `runBranches`; `retrySeeds` and `retry()` keep it; `foreignRecording` copies it; `toFreePanel` and `failRun` clear it; the new `carry` signal and the e2e hook `carry()` expose it. The briefing prints one own-words line for a carried start. Tests: `tests/carry.test.ts` (22 cases: capture, baseline, grade, replay agreement of a stepped run against `simulate` at every step, the dead engine under a carried engine master ON, the lint boundary) and the follow-on describe of `tests/session.test.ts`. e2e: the ENGINE FIRE flow with the forgotten fuel valve on desktop-chromium and phone-portrait.

**Task 2 (`7a5e2b2`).** `confirm: true` in the step schema; `checkInitialState` skips L5 and L11 for a confirm step that holds, reports L35 at the `confirm` key for one that does not, and `checkConfirmSteps` reports L35 for any confirm step in a scenario with an onset; the variant solution builder leaves confirm steps out. `landing-engine-off.toon`: no `sw.fuel_trans` and no `fuel_trans_active` at the start, OIL PRES alone under `annunciations`, row 11 `confirm: true`, the header comment rewritten. `ditching.toon`: "with the gear extended" removed. `eng-fire-in-flight.toon`: rows 7 and 8 are the optional steps `windows_open` and `doors_open` in the groups `grp_windows` and `grp_doors`. `tests/confirm-step.test.ts` (16 cases), `tests/shipped-doors.test.ts` (25 cases: the hand-typed table of the eleven rows, the scan of every shipped file, credit by a recording, the live sheet marks), the Engine Fire goldens in `tests/grading.test.ts` expect two more uncredited optional entries plus one new golden with the window and the door opened; `tests/fixtures/recordings.json` is byte-identical.

**Task 3 (`1b3b239`, `da7bcfd`).** The `tab` of the three catalog groups is two lines; `defineCatalog` rejects an empty line or a third line; `SessionButton` has an optional `labelSize` (default 14, so every other button is unchanged) and a baseline and line step that scale with it; `SESSION_LAYOUT.choose.tabLabelSize` is 10. Documents: GRADING.md (R23 rewritten, R25 the carried panel, R26 the confirm step, the authoring section, the Engine Fire page), PANEL-REVIEW.md (items 6, 11, 13, 14, 16 and 21 rewritten, items 26 to 33 new), PANEL-LABELS.md, README (the follow-on sentence, a `confirm` paragraph with a fragment, the tab names), CLAUDE.md, REQUIREMENTS (SES-09, CNT-06), ROADMAP (5/5, Executed, awaiting UAT, the phase not ticked), STATE.

## Deviations from Plan

**1. [Plan detail, P-01] Where the code differed from the plan's picture of 09-04.** (a) `followOnTargets` and `followOnOffer` took the graded `result` as their first argument; they now take `(section, set[, realistic])`, so the callers in `session.ts`, `Debrief.tsx` and two tests changed. (b) The highest item of the Phase 9 review list was 25, not 18, so the new items are 26 to 32 (the results item is 33). (c) The ditching text did say "with the gear extended" (removed). (d) The e2e support names (`followOnButton`, `forceFollowOn`, `startRealistic`) were as the plan expected; `landing.spec.ts` already found the landing by id.

**2. [Plan detail] Rule numbers.** GRADING.md R24 already existed (09-04: Realistic for a landing situation), so the carried panel is R25 and the confirm step R26. The plan, CONTEXT R-16, ROADMAP and REQUIREMENTS speak of R23 to R25; only GRADING.md and the review items use the shifted numbers.

**3. [Plan detail] Eleven rows, not ten.** The sweep of the shipped files finds eleven rows that name a door or the emergency window (nine already panel steps, two plain lines that became steps). The plan counted ten; the table of `tests/shipped-doors.test.ts` and PANEL-REVIEW item 30 say eleven.

**4. [Rule 2, missing behaviour] The retry of a failed follow-on load kept no carry.** `openBriefing(ref, true)` resets the panel first, so a failed load and `retryLoad` would have started the follow-on from the file's own baseline. `lastRequest` of kind `chosen` now carries `left`, `runChosen(ref, key, left)` passes it on; one session test covers it.

**5. [Rule 2] The sheet of a foreign checklist on a carried start.** `App.tsx` computed the branch statuses of a foreign checklist without the carry; it now passes `session.carry.value`.

**6. [Plan detail] Test fixtures.** `tests/fixtures/scenarios/fire-ordered.toon`, the ordered copy of Engine Fire that the golden `fire-wrong-order-ordered` grades, got the same two optional steps (its two plain lines became steps), otherwise the golden could not expect the shared `fireSteps` list. `fire-ordered` is not a shipped file; `recordings.json` is untouched.

**7. [Plan detail] Specs the plan listed that needed no change.** `e2e/fire.spec.ts` and `e2e/checklist.spec.ts` compare the printed table (steps and lines alike) and the optional rows of T/O FIRE NO ABORT; they passed unchanged, so no expectation was added there. The new ENGINE FIRE window and door flow is in `e2e/landing.spec.ts`.

**8. [Plan detail] Realistic carry case.** The landing-source fixture has neither an onset nor a landing scene, so Realistic is not offered there; the Realistic carry case in `tests/session.test.ts` uses the existing `realisticDebrief` helper (the oil temperature source with an onset and two landing fixtures as targets).

**9. [Process, found by the gates] `e2e/pack.spec.ts` read the tab label.** The plan said no spec reads the label; this one did (`toContainText(group.tab)`), and the DOM text of two tspans is "AnnunciatedWARNINGS". The first whole local run had two failures (desktop-chromium and desktop-webkit, this case); the spec now checks each line in its own tspan (`da7bcfd`).

**10. [Process] Two races of my own making.** (a) Editing `landing-engine-off.toon` while the Task 1 Playwright run was loading spec files gave four failures ("landing/landing-engine-off does not parse" at spec load); the four cases passed on rerun (8 of 8 on two projects). (b) A second `playwright test` on port 4410 during the whole local run rebuilt `dist-e2e` under the running preview; no failure other than the pack.spec case showed.

**11. [Plan detail] The blueprint plant.** The first draft of a comment in `session-area.ts` contained the literal "Non-annunciated"; `tests/blueprint.test.ts` failed with exactly that hit, which is the "plant one literal and see it fail" check of the plan; the comment was reworded.

**12. [Plan detail] SessionButton at the default size.** The component keeps a press signal, so `tests/session-button.test.ts` replaces `useSignal` by a plain cell (`vi.mock`) and expands the component; it checks size 14, baseline 5 below the middle and `dy` of -9 and 18 for two lines, the same numbers as before.

Existing expectations changed on purpose: `tests/session.test.ts` (the offer case now says whatever conduct and includes a PASS; the Realistic draw case expects the carried power lever p75 of the source, not the landing file's p60; `retrySeeds` returns four records); `tests/debrief-text.test.ts` (the follow-on describe rewritten for the new signatures: another conduct, no conduct, FAIL and a conduct-none result all offer); `tests/grading.test.ts` (FIRE_GROUPS and the severity list gain `windows_open` and `doors_open`); `e2e/follow-on.spec.ts` (the case "no button for another conduct" now expects the buttons); `e2e/landing.spec.ts` (the case "a run that did not pick the emergency landing shows no button" now expects them; the ENGINE FIRE flow expects the engine master off in the landing because it is carried; `prepareLanding` acts only where a control is not in the printed state); `e2e/pack.spec.ts` (two lines per tab); `tests/panel-labels.test.ts`, `tests/blueprint.test.ts` and `tests/checklist-catalog-reference.ts` (two-line labels).

## Verification

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (12 scenario files, 0 problems): clean. `rm -rf node_modules/.vitest-cache && npx vitest run`: 97 files, 4541 tests, all passed (09-04 ended at 93 files and 4456 tests; `tests/carry.test.ts`, `tests/confirm-step.test.ts`, `tests/shipped-doors.test.ts` and `tests/session-button.test.ts` are new). `BASE_PATH=/procedure-trainer-da-50/ npm run build`: `pack-landing-*.js` is in `dist/assets` and in the `sw.js` precache list (`tests/pwa-precache.test.ts` passes). `tests/fixtures/recordings.json` is byte-identical to HEAD of 09-04; `.planning/config.json` and `state.json` are untouched; nothing was pushed.
- Playwright, local, whole suite on all seven projects (`PW_PORT=4409`, tree `1b3b239`): 3309 passed, 917 skipped, 2 failed. Per project passed: desktop-chromium 552, desktop-webkit 525, phone-chromium 539, phone-webkit 441, tablet-chromium 450, tablet-webkit 441, phone-portrait 361. The 2 failures are `e2e/pack.spec.ts:30` on desktop-chromium and desktop-webkit (the spec read the one-line tab text, deviation 9); the other five projects ran the fixed spec. After the fix `pack.spec.ts` and `session-area.spec.ts` on all seven projects: 119 passed, 0 failed (so desktop-chromium and desktop-webkit are one case higher). The Linux failure classes were rerun locally too (altn2, checklist, electrical-box, run-help, scenario, clock, fire, switch-skins, toggle, variants, windscreen on desktop-webkit, phone-chromium, phone-webkit, tablet-webkit): 477 passed, 7 skipped, 0 failed.
- Playwright, Linux image `mcr.microsoft.com/playwright:v1.64.1-noble` (`git archive` of `da7bcfd` into the session scratchpad, `npm ci`, `CI=1`, `--retries=0 --workers=4`, whole suite): 3260 passed, 947 skipped, 21 failed, 1.3 hours (09-04: 47 minutes, 0 failed). Per project passed: desktop-chromium 553, desktop-webkit 521, phone-chromium 534, phone-webkit 427, tablet-chromium 450, tablet-webkit 424, phone-portrait 351. The 21 failures: 16 `expect(getByTestId('level-pick')).toBeVisible()` timeouts of 5 s after choosing a scenario (13 of them ALTN 2 FAIL cases in altn2, checklist and electrical-box, plus run-help Realistic on desktop-webkit and phone-chromium, scenario LEAVE on desktop-webkit and clock on tablet-webkit; the error text is `Error: element(s) not found`, and the error context shows the level card on screen a moment later), 4 on phone-webkit (`page.goto` or a whole test over the 30 s timeout: switch-skins, toggle, variants, windscreen) and 1 `Test timeout of 30000ms exceeded` waiting for the smoke to clear (fire.spec.ts:124 desktop-webkit). Cause: starved host (load average 37 to 41, the Docker VM above 500 percent CPU, the endpoint scanner at 70 percent), which made the run twice as slow as 09-04's. None touches a file this plan changed except through the shared start path, none is a touch-tap case. Rerun of exactly the 21 in the same image with `--last-failed --workers=2`: 21 passed in 1.2 minutes (ALTN 2 cases in 4 to 5 s instead of 10 s). Not skipped, nothing loosened. The 30 more skips than on macOS are the Phase 7 WebKit touch skips of `run-help` and `sound`, as in 09-04.
- Screenshots (a scratch spec, deleted before any commit, in the session scratchpad `shots/`): `09-05-debrief-follow-on-buttons.png` (the FAIL debrief of ENGINE FIRE IN FLIGHT with Retry, Emergency landing, Ditching, Next situation, Back to panel; rows 7 and 8 are optional steps), `09-05-briefing-carried-panel.png` (the landing briefing with the line "The panel is as the previous situation left it."), `09-05-sheet-confirm-row.png` (the checklist sheet of the landing chosen from the chooser: row 11 marked Done in green at the first frame) and `09-05-choose-tabs.png` (the three two-line tabs). Looked at on desktop chromium at 1400 x 900 only.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-09-13: `baselineOf` throws for an unknown control or an illegal state of a carry (unit cases), `bridge.reset` validates every baseline entry again. T-09-14: the carry is a field of the recording, a stepped run equals `simulate` at every step from a carried start, Retry repeats it from the recording. T-09-15: L35 requires a confirm step to hold at the start, L11 does not count it, a scenario with an onset refuses it (three tests, one of them a file whose only critical step is a confirm step). T-09-17: the page photo of booklet page 12 was read only to confirm that the printed restart list switches the emergency fuel pump on; no photo content, path or quote is in a plan, document, test or commit.

## Unverified / for the owner

- The tab text at size 10 was judged on desktop chromium screenshots and by geometry gates on every project (inside the face, centred, 44 px hit box), not on a real phone.
- The first seconds of a carried start show the models settling the control-derived quantities (volts, amps, fuel flow) toward the carried controls: by design (R-14 d), but not looked at over time with a carried transfer pump ON.
- A carried start can be passed by doing nothing more (documented, PANEL-REVIEW item 27); the owner may want a different rule.
- The confirm key name and the green mark from the first frame, the 10 pt tab size and the "keep it so" semantics are planner choices (items 27, 28, 32).
- No test runs a real WebKit touch tap on the new debrief buttons on Linux beyond the existing cases; the Phase 7 touch skips of `run-help` and `sound` apply as before.

## Self-Check: PASSED

Created files exist (`src/engine/carry.ts`, `tests/carry.test.ts`, `tests/confirm-step.test.ts`, `tests/shipped-doors.test.ts`, `tests/session-button.test.ts`); commits `56abf12`, `7a5e2b2`, `1b3b239`, `da7bcfd` and `454e6d2` are ancestors of HEAD; no scratch spec is in the tree (`e2e/zz-scratch-shots.spec.ts` deleted before any commit); `.planning/config.json`, `state.json` and `.claude/launch.json` are untouched and uncommitted; nothing was pushed. Commit `b6e2dd9` (a 30 s timeout of the session test, not mine, made during the outage) was not Prettier formatted and failed `format:check`; `454e6d2` formats it, changing no test.
