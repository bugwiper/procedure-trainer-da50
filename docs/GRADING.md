# Grading rules

This document says in plain words how a finished run is turned into PASS or FAIL. It is written for the project owner and for the DA50 instructor who reviews the rules before the trainer is shown to other pilots. The trainer is a training aid and does not replace the approved Airplane Flight Manual or an instructor.

The code is `src/engine/grading.ts` (the function `grade`) and `src/engine/predicates.ts` (the condition checks). The scenario files are TOON text files under `scenarios/`, validated against format 1 (`src/scenario/schema.ts`). The golden replays that pin these rules are in `tests/grading.test.ts`.

## What goes in and what comes out

`grade` receives three things: the scenario file as read by the parser, the aircraft (its controls and named quantities), and the recording of the run. The recording is the list of control actions the pilot performed, in the order they happened, each with the time it happened, the control and the new position. Nothing else is read: no clock, no random number, no screen state. The same inputs always give the same result, down to the last character of its JSON text.

The result holds the verdict (`pass` or `fail`), the reasons for a fail, one entry per graded step, the status of every branch of the checklist, the order violations and the harmful actions.

The level chosen before the briefing (Easy or Medium; Realistic is shown but not yet available) is not an input of `grade`: every level grades the same. The level only changes what the briefing shows and what the debrief names.

## The rules

1. **Starting point.** The run starts from the baseline: every control at its normal in-flight position, then the positions that the scenario file sets. Quantities (for example oil temperature) start at the values the scenario sets. The starting point is not an action of the pilot and is not in the recording.
2. **Branches are decided at the start.** A checklist branch such as "If in green range:" applies when its condition holds at the starting point. A branch that does not hold is not applicable. A branch marked as decided during the run is open. A branch inside a branch that is not applicable is not applicable, and a branch inside an open branch is open.
3. **Only applicable steps are graded.** A step counts only when every branch around it applies. Steps in a branch that is not applicable or open are never graded in this version, and they are not missed. A step outside any branch is always graded. A forbidden action is watched only when it has no condition of its own, or when its condition holds at the starting point.
4. **Replay.** The recorded actions are applied one after the other in the order of the log. The time stamp is never used to sort them, so two actions with the same time keep their log order. After every action, every graded step and every watched forbidden action is checked again with the quantity values of the starting point (quantities do not change during a run in this version).
5. **Steps and harmful actions.** A step becomes entered at the action after which its target holds, and the entry is cleared when a later action makes the target false again. A forbidden action is recorded every time it goes from not true to true after an action, with the time and the position in the log of that action, even if the pilot reverts it later. Several entries for one item are listed one after the other. The debrief lists a harmful action by its text; the time stays in the result for the replay but is not shown.
6. **Credit.** A step is credited when its target holds after the last action, that is at the moment the pilot declares the procedure complete. A switch that was moved to the right position and moved back is not credited. A target relative to the baseline, such as "power reduced by at least 10 percent of travel", is measured from the starting position: from 75 percent, 65 percent counts and 70 percent does not.
7. **Order.** In a group marked as ordered, take the credited steps in the order in which the file declares them. For every pair where the earlier declared step was last entered after the later declared step, one order violation is recorded. A single swap is therefore one violation. Steps that were not credited produce no violation, because they are already missed. A group that is not ordered never produces one.
8. **Verdict.** The run is PASS when every graded critical step is credited, when no harmful action belongs to an item marked as failing the run, and when no order violation belongs to a group marked as order-critical. Otherwise it is FAIL. The reasons are listed in a fixed order: the number of missed critical steps, then one entry for each order-critical group with a violation, then one entry for each item marked as failing the run that was triggered. Standard and optional steps, harmful actions of items that do not fail the run, and order violations of groups that are not order-critical are reported but do not change the verdict.
9. **Determinism.** Every list in the result follows the declared order of the scenario file, depth first, never the order of keys of an object. A recording for another scenario, or one that names a control the aircraft does not have, is a programming error and is refused with an exception, not graded.

Further notes:

- A step that is already true at the starting point would be credited by a run that does nothing. The file check of the validation command rejects such a step (lint rule L5). It also rejects a file in which no critical step is graded at the start (lint rule L11). So a run that does nothing always fails in a shipped scenario.
- A tap that was taken back with the double tap gesture is removed from the log before grading, so retracted actions do not exist for the grader.

## Golden recordings

The file `tests/fixtures/recordings.json` holds six recordings. The scenario `eng-oil-temp-green` is the blueprint; `ordered-critical` is a synthetic copy in which the group is ordered and order-critical (`tests/fixtures/scenarios/ordered-critical.toon`).

| Name               | Scenario           | What the pilot does (time in ms)                                                  | Expected                                                                                                         |
| ------------------ | ------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| golden             | eng-oil-temp-green | 8000 power to 60; 15000 cowl flap open                                            | PASS, no reasons, no harmful action                                                                              |
| do-nothing         | eng-oil-temp-green | nothing                                                                           | FAIL, two critical steps missed                                                                                  |
| forbidden          | eng-oil-temp-green | 5000 power to 80; 9000 power to 60; 14000 cowl flap open                          | FAIL, reason: the harmful action "power increased" fails the run; one harmful action at 5000 ms (log position 0) |
| forbidden-reverted | eng-oil-temp-green | 4000 power 80; 6000 power 75; 9000 power 85; 12000 power 60; 15000 cowl flap open | FAIL, the same reason once; two harmful actions (log positions 0 and 2): reverting does not erase the first one  |
| toggle-back        | eng-oil-temp-green | 6000 power to 60; 9000 cowl flap open; 12000 cowl flap closed again               | FAIL, the cowl flap step is not credited, one critical step missed                                               |
| wrong-order        | ordered-critical   | 6000 cowl flap open; 9000 power to 60                                             | FAIL, one order violation (power should come before cowl flap), reason: order                                    |

Further cases in the tests: power at 65 percent credits the power step and 70 percent does not; power reduced and then raised again to the baseline is not credited; the same scenario with the item not marked as failing the run grades the `forbidden` recording PASS and only reports the action; an order violation in a group that is not order-critical is listed but keeps the PASS; steps in a branch that does not apply are not graded; a forbidden item whose condition does not hold at the start is never reported.

## Instructor review (phase 2 UAT, 2026-10-22)

The DA50 instructor reviewed the first gradable scenario. The answers to the four open questions and to the question of times are recorded here.

1. **Holds at completion.** The end state at completion is kept for now: a step is credited only if its target is still true when the pilot declares the procedure complete. Which end states are acceptable depends on the scenario (an action that helped but leaves a different end state can be fine). Scenario-specific acceptable end states are designed with the physics in Phase 4.
2. **Harmful actions.** They are defined per scenario. In ENG OIL TEMP, increasing power fails the run (`fails_run: true` on the item "power increased").
3. **Order.** The default stays "order does not matter". A group can be marked ordered and order-critical where the real procedure needs it, for example a later emergency gear extension (pull the handle, then the gear lever down). Nothing changes in the engine.
4. **Branches decided during the run.** They come in a later phase, as planned.
5. **Times.** There is no timing pressure in ENG OIL TEMP, and the debrief shows no time on a harmful action. Optional time limits per step ("reduce power within 20 s") stay possible for time-critical scenarios; the limit and its reference point (run start or onset) belong with Phase 3.
6. **Pass with recommendation.** A third verdict was proposed (PASS when everything critical is fine but something was not perfect). The owner said it may come later; name and wording are not decided. It is recorded, not built: see [the pending todo](../.planning/todos/pending/2026-10-22-pass-with-recommendation.md).
