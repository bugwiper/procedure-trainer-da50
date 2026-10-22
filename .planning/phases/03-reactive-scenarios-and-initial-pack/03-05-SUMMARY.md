---
phase: 03-reactive-scenarios-and-initial-pack
plan: 05
subsystem: engine
tags: [outcomes, escalation, hold-timer, grading, replay, lint, debrief]
status: complete

requires:
  - phase: 03-reactive-scenarios-and-initial-pack
    provides: fixed-step simulation, oil temperature model, scenario parameters (plan 03-01); reactions and the Run over the store log (plan 03-04)
provides:
  - scenario `outcomes` (id, own-words text, closed-vocabulary predicate, hold_s 0..600, at most 4) in format 1
  - hold timers in stepSim: SimState.holds and SimState.outcome; a state with an outcome is final and simulate stops there
  - grade replays the same simulation up to completedAt; GradeResult.outcome and the first reason of kind 'outcome'; the log is graded only up to the outcome time
  - the session completes a run by itself when the step state carries an outcome (FAIL debrief)
  - the reason line "The failure escalated: TEXT." in the debrief
  - lint L13 (outcome predicates resolve, ids share the L4 namespace, an outcome that holds at the start is rejected)
  - the ENG OIL TEMP outcome engine_failure ("Engine failure from overheating", oil_temp_c at or above 140 for 15 s)
affects: [03-06, 03-07, 03-08, 03-09]

actuals:
  tokens: 13300
  tasks: 3
  commits: 3
plan_head_before: 9c71a207bb7b37d91bc960b579c18a78e742936a
plan_head_after: 648644d7d990d5caf37894726e357c478c2bdf6e

tech-stack:
  added: []
  patterns:
    - "An outcome is scenario data evaluated by the one stepper after the physics of each step; live run and replay share it, so the outcome time in the debrief equals a node replay"
    - "grade skips the simulation for a scenario without outcomes, so existing scenarios grade exactly as before"

key-files:
  created: []
  modified:
    - src/scenario/schema.ts
    - src/scenario/lint.ts
    - src/engine/sim.ts
    - src/engine/run.ts
    - src/engine/grading.ts
    - src/ui/session.ts
    - src/ui/debrief-text.ts
    - scenarios/engine/eng-oil-temp-green.toon
    - e2e/run-reaction.spec.ts
    - tests/session.test.ts
    - tests/scenario-lint.test.ts
    - tests/sim.test.ts
    - tests/grading.test.ts
    - tests/fixtures/recordings.json
    - tests/debrief-text.test.ts
    - tests/scenario-tracer.test.ts

key-decisions:
  - "Outcome predicates are evaluated over the new controls, the scenario baseline and the new quantities after the physics of a step; held time grows by STEP_MS while the predicate holds and the key is absent from SimState.holds when it does not"
  - "An outcome fires with t equal to the state time after the step; the live run's clock then equals the outcome time, so complete() records completedAt equal to it"
  - "grade grades the prefix of the log up to the first event after the outcome time; the outcome is the first reason, followed by the R8 reasons"
  - "ENG OIL TEMP: threshold 140 degrees C, hold 15 s; an ignored run fires at 42.6 s of run time, the golden actions never reach it"

patterns-established:
  - "New scenario sections default to empty so existing files stay valid in format 1"

requirements-completed: [SCN-06]

coverage:
  - id: D1
    description: "On the built app an ignored ENG OIL TEMP run ends by itself in a FAIL debrief whose first reason line names the engine failure outcome"
    requirement: "SCN-06"
    verification:
      - kind: e2e
        ref: "e2e/run-reaction.spec.ts#an ignored run escalates: the debrief opens by itself as FAIL and names the outcome (desktop-chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The live run escalates and completes itself as FAIL with the outcome first, the outcome time equal to the clock, and the reason line containing the outcome text"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/session.test.ts#an ignored run escalates (phase 03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hold timers fire after exactly hold_s steps, reset on interruption, first declared outcome wins, a final state is unchanged, and a Run equals simulate until the outcome"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/sim.test.ts#outcomes and hold timers (C-25, D-06)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Escalation and recovery are pinned: do-nothing-long fails with the reasons outcome then critical_missed 2, golden-long passes without an outcome, a late event is not credited, grade equals simulate, existing verdicts unchanged"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/grading.test.ts#golden recordings (Table R1)"
        status: pass
      - kind: unit
        ref: "tests/grading.test.ts#named outcomes (R10, D-06, C-26)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Lint L13 gives a line-numbered error for an outcome with an unresolved reference, a clashing id, a hold time above 600 s, more than 4 outcomes, or a predicate that holds at the start"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/scenario-lint.test.ts#L13: outcomes"
        status: pass
    human_judgment: false
  - id: D6
    description: "The threshold 140 degrees C and the 15 s hold of the engine failure outcome are plausible training values (instructor-review item, RESEARCH A4)"
    requirement: "SCN-06"
    human_judgment: true
    rationale: "Aircraft-behaviour values chosen by default for unattended execution; an instructor decides whether they are realistic"
---

# Phase 3 Plan 5: Named outcomes Summary

**Scenario-declared outcomes (id, text, predicate, hold time) that end an ignored emergency as FAIL: the oil temperature of ENG OIL TEMP passes 140 degrees C, holds for 15 s, the run completes itself at 42.6 s and the debrief reads "The failure escalated: Engine failure from overheating."**

## Performance

- **Duration:** about 20 min
- **Completed:** 2026-10-22
- **Tasks:** 3 (1 tracer, 2 auto/tdd)
- **Files modified:** 16

## Accomplishments

- Schema `outcomes` (at most 4, hold_s 0 to 600, default empty), hold timers in the shared stepper (`SimState.holds`, `SimState.outcome`), `Run.step` stops at an outcome.
- `grade` replays the same simulation as the live run; the debrief outcome and its time equal a node replay of the recorded log. The log is graded up to the outcome time and the outcome is the first FAIL reason (rule R10).
- The session completes the run by itself on an outcome (one completion function shared with the debrief button), the debrief names the failure, the missed steps stay in the outline.
- Lint L13 and golden fixtures `do-nothing-long` (outcome, FAIL) and `golden-long` (recovers, PASS, 600 s).

## Task Commits

1. **Task 1 (tracer): an ignored run escalates to a named outcome** - `9031e75` (feat)
2. **Task 2: lint L13** - `b371aed` (feat)
3. **Task 3: fixtures, hold-timer cases and the reason line** - `648644d` (test)

## Assumptions taken

- Threshold 140 degrees C and hold_s 15 (C-28 defaults): a do-nothing run reads 137 at 20 s (no outcome in the existing 20 s recordings), crosses 140 at about 27.6 s and fires at 42.6 s. Instructor-review item (RESEARCH A4).
- `grade` skips the simulation when the scenario declares no outcomes (equivalent result, no cost for the ordered-critical fixture and the test scenarios).
- The golden-long run (POWER p60 at 8 s, cowl flap open at 15 s) never escalates with the plan 01 model, so no change to physics.ts constants was needed (Table P1 untouched).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing tests assumed an ignored blueprint run never ends**
- **Found during:** Task 1 (full vitest run)
- **Issue:** the blueprint now carries an outcome, so tests/sim.test.ts physics and de-ice cases (runs of 120 s to 30 min with no actions) froze at 42.6 s, and the grading helper `run` used completedAt 99000, which escalates a do-nothing run.
- **Fix:** tests/sim.test.ts builds its general `setup` from the blueprint with `outcomes: []` (the outcome rules have their own describe block); the grading helper `run` uses completedAt 20000, the length of the existing recordings.
- **Files modified:** tests/sim.test.ts, tests/grading.test.ts
- **Commit:** 9031e75

**2. [Rule 3 - Blocking] A blueprint text swap became ambiguous**
- **Found during:** Task 1
- **Issue:** tests/scenario-tracer.test.ts swapped the text `quantity: oil_temp_c`, which now also occurs in the outcome.
- **Fix:** the swap includes the following `in[3]` line, so it still names exactly one place.
- **Files modified:** tests/scenario-tracer.test.ts
- **Commit:** 9031e75

**3. [Rule 2 - Missing] The L4 duplicate-id message named only group, step and forbidden ids**
- **Fix:** the message now reads "group, step, forbidden and outcome ids are unique" (the plan asks for outcome ids in the L4 namespace).
- **Files modified:** src/scenario/lint.ts
- **Commit:** b371aed

**Total deviations:** 3 auto-fixed (2 blocking test adaptations, 1 message update). **Impact:** none on the delivered behaviour.

## Notes

- `tests/fixtures/recordings.json` was rewritten with expanded JSON formatting (event objects on several lines); the content of the existing six recordings is unchanged.
- If a retract rebuilds a run after an event the simulation had applied and the replay then reaches an outcome earlier than the clock, `complete()` still records the clock time and grade reports the replay's outcome time (graded from the replay, as T-03-13 requires). With the retract window of a few hundred milliseconds against a 15 s hold this cannot occur for the shipped scenario.

## Known Stubs

None.

## Threat Flags

None. Outcomes reuse the closed Predicate union (T-03-12), hold_s and the list are capped by Zod (T-03-11), and grade calls the same simulate as the live run (T-03-13).

## Verification

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` pass; `npx vitest run`: 48 files, 2410 tests pass.
- `PW_PORT=4333 npx playwright test e2e/run-reaction.spec.ts e2e/scenario.spec.ts e2e/replay.spec.ts`: desktop-chromium 24 passed; phone-chromium 23 passed and 1 skipped (the desktop-only escalation case).

## Self-Check: PASSED

- Commits 9031e75, b371aed, 648644d exist on the phase branch.
- Acceptance greps: outcomes in the scenario file (1), 'outcome' in grading.ts (2), outcome in debrief-text.ts (2), outcomes in schema.ts (3), L13 in lint.ts (4), do-nothing-long in recordings.json (1), golden-long in grading.test.ts (3).
