---
phase: 03-reactive-scenarios-and-initial-pack
plan: 11
subsystem: engine
tags: [realistic-level, onset, physics-rate, lint, scenario-schema, uat-gap]

requires:
  - phase: 03-reactive-scenarios-and-initial-pack
    provides: plan 03-06 Realistic level (onset block, seeded onset, Recording.onset, L14), plan 03-01 sim and lag models
provides:
  - onset.quantities and onset.parameters in the scenario schema (the Realistic setup, additive, format stays 1)
  - an optional rate on lag models (LagModel.rate) and the aircraft parameter oil_temp_rate (1 to 10, normal 1)
  - realisticQuantities, the one start function of the session, grade and lint
  - lint L15 (REALISTIC_SHOW_WITHIN_MS = 12 000) plus L12 and L14 on the new setup
  - the Realistic ENG OIL TEMP run starting at 114 C, onset window 2 to 6 s in all three scenarios
affects: [03-12, 03-13, 03-14]

actuals:
  tokens: 21000
  tasks: 3
  commits: 3
plan_head_before: 113eeeebf37b6311f923a4fb89c0cfcf74d60ca8
plan_head_after: bcef0c066ce373f59d0f89269e0e61ec73c0c3d8

tech-stack:
  added: []
  patterns:
    - "A lag model may declare a rate (multiplier of the step length); a model without one keeps the exact step expression, so a new speed-up cannot move an existing trajectory"
    - "A level-specific setup is scenario data laid over the aircraft values and selected by the presence of the run datum (Recording.onset), never by a level flag"

key-files:
  created: []
  modified:
    - src/scenario/schema.ts
    - src/engine/physics.ts
    - src/engine/sim.ts
    - src/engine/predicates.ts
    - src/engine/grading.ts
    - src/aircraft/da50rg/physics.ts
    - src/ui/session.ts
    - src/scenario/lint.ts
    - scenarios/engine/eng-oil-temp-green.toon
    - scenarios/electrical/elec-altn1-fail.toon
    - scenarios/engine/eng-fire-in-flight.toon
    - tests/physics.test.ts
    - tests/sim.test.ts
    - tests/grading.test.ts
    - tests/session.test.ts
    - tests/scenario-parse.test.ts
    - tests/scenario-lint.test.ts
    - tests/blueprint.test.ts
    - e2e/run-reaction.spec.ts
    - docs/GRADING.md
    - docs/PANEL-REVIEW.md

key-decisions:
  - "The Realistic setup lives in the existing onset block: quantities (replace initial.quantities on that level) and parameters (laid over the top-level parameters from the onset); both default to empty and are read only when an onset time is given (C-58, C-59)"
  - "The oil temperature rises and recovers faster through the aircraft parameter oil_temp_rate (3 on Realistic, effective time constant 20 s), not through a stronger cooling fault, so the recovery stays reachable and the target is unchanged (C-60)"
  - "realisticQuantities is the single definition of the Realistic start; the session, grade and lint call it, so live run, replay and lint cannot drift (C-61)"
  - "L15 bound 12 s: the owner's 'about 10 s' with a 2 s margin; both window ends are simulated (C-64)"
  - "WR-01 (0.01 rounding) is not changed: the lag at rate 3 stalls 1 degree short of a target instead of 3 (C-65)"

patterns-established:
  - "Instructor-review values of a level sit in the scenario file with an own-words comment naming them as such"

requirements-completed: [SCN-06]

coverage:
  - id: D1
    description: "On Realistic the ENG OIL TEMP failure begins 2 to 6 s after the start, the oil temperature starts at 114 (just below the yellow band), is in yellow within 3 s of the onset and in red with the ENG OIL TEMP message within 10 s of it"
    requirement: "SCN-06"
    verification:
      - kind: e2e
        ref: "e2e/run-reaction.spec.ts#@hooks Realistic ENG OIL TEMP shows yellow within 3 s and red with the message within 10 s of the onset (desktop-chromium, phone-chromium)"
        status: pass
      - kind: unit
        ref: "tests/sim.test.ts#the Realistic setup (plan 03-11, C-58 to C-61, C-65) the timeline at the lower and the upper end of the window"
        status: pass
    human_judgment: false
  - id: D2
    description: "Easy and Medium are unchanged: the start 128, the 60 s time constant, the outcome 42.6 s after a do-nothing start; golden recordings byte-identical"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/sim.test.ts#the Realistic setup a do-nothing Easy run ends in the named outcome at 42600 ms"
        status: pass
      - kind: command
        ref: "git diff --exit-code tests/fixtures/recordings.json"
        status: pass
      - kind: unit
        ref: "tests/physics.test.ts#the rate of a lag model a rate of 1 follows the same trajectory, bit for bit"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live run and replay agree at every step on the Realistic start, and grade replays a recording with an onset from the same start function"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/sim.test.ts#a live Run over a store equals simulate at every step for 40 s of a Realistic start"
        status: pass
      - kind: unit
        ref: "tests/grading.test.ts#a Realistic do-nothing recording has the outcome time of simulate from the Realistic start"
        status: pass
      - kind: unit
        ref: "tests/session.test.ts#realistic level starts in the Realistic setup"
        status: pass
    human_judgment: false
  - id: D4
    description: "Lint guards the level for all three scenarios: L12 on onset.parameters and onset.quantities, L14 from the Realistic start, L15 speed (12 s) and the start-decided branch guard"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/scenario-lint.test.ts#the Realistic setup: L12 on the onset block, L14 on its start, L15 speed and guard (plan 03-11)"
        status: pass
      - kind: command
        ref: "npm run validate"
        status: pass
    human_judgment: false
  - id: D5
    description: "The values chosen (window 2 to 6 s, start 114, rate 3, bound 12 s) feel right to the owner on a live Realistic run"
    verification: []
    human_judgment: true
    rationale: "The values are instructor-review items (C-62); the tests pin the owner's stated limits (yellow within 3 s, red with the message within 10 s), not the feel of the run"

duration: 24min
completed: 2026-10-23
status: complete
---

# Phase 3 Plan 11: Realistic speed Summary

**On Realistic the ENG OIL TEMP failure now begins 2 to 6 s after the start from a reading just below the yellow band (114 C) and runs three times faster (aircraft parameter oil_temp_rate, set by the scenario's onset block), so yellow comes within about a second and red with the ENG OIL TEMP message within about six seconds of the onset; Easy and Medium are bit-for-bit unchanged.**

## Performance

- **Duration:** 24 min
- **Tasks:** 3 (1 tracer, 2 TDD-style)
- **Files modified:** 21 (0 created)

## Accomplishments

- Schema: the `onset` block gains `quantities` and `parameters` (both default empty). `simSetup` folds `onset.parameters` into the faulted parameters only when an onset time is given; the lag model of the sim takes an optional `rate` that multiplies the step length (a model without one keeps the old expression, so no existing trajectory moved). The aircraft declares `oil_temp_rate` (1 to 10, normal 1) and the oil temperature lag reads it.
- `realisticQuantities(scenario, quantities)` is the one definition of the Realistic start; the session (start quantities and the bridge reset), `grade` (replay of a recording with an onset) and lint L14 call it.
- ENG OIL TEMP: window 2 to 6 s, `onset.quantities.oil_temp_c: 114`, `onset.parameters.oil_temp_rate: 3`. Measured by the same arithmetic: yellow 0.7 s (onset 2 s) to 1.2 s (onset 6 s) after the onset, red with the message 5.7 to 6.2 s after it, the named outcome 31.6 to 32.1 s after it. The other two scenarios got the window 2 to 6 s and no other change.
- Lint: L12 checks `onset.parameters` and `onset.quantities`; L14 starts from `realisticQuantities`; L15 requires every listed annunciation within `REALISTIC_SHOW_WITHIN_MS` (12 000 ms) of the onset at both window ends and rejects a start-decided branch that reads a quantity the onset block sets (guard for WR-04, which stays open). All three shipped scenarios pass.
- Documents: GRADING.md rule 1, items 1 and 5, and PANEL-REVIEW.md "Phase 3: owner review" items 1 and 4 now state the values and the true wording (the time constants are compressed; the old sentence "not compressed" is gone).

## Task Commits

1. **Task 1 (tracer): Realistic ENG OIL TEMP starts just below yellow and shows the message within 10 s** - `f4746c3`
2. **Task 2: the rate, the Realistic setup and the speed pinned in unit tests** - `3c4f16a`
3. **Task 3: L15, L12/L14 on the new setup, the window of the other two scenarios, the documents** - `bcef0c0`

`plan_head_before` is the parent of the first task commit. The commit ledger written at the start of the run holds `d2a0d3b`; two unrelated docs commits (`99aa8c2`, `113eeee`, the 03-13 source note and a todo) landed on the branch before the first task commit, so the ledger range counts 5 and the plan's own count is 3.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A third existing unit case encoded the old physics parameter list**
- **Found during:** Task 1
- **Issue:** `tests/sim.test.ts` "a quantity without a model never changes" builds a one-model aircraft with only the `oil_cooling` parameter; the oil lag now reads `oil_temp_rate`, so the case threw.
- **Fix:** the case takes the aircraft's own parameter list (`DA50RG_ENV.physics.parameters`); intent unchanged.
- **Files modified:** tests/sim.test.ts
- **Commit:** f4746c3

**2. [Rule 1 - Bug in the plan's expectation] "Within one quantum" cannot hold for rate 2 against rate 1 over double the steps**
- **Found during:** Task 2
- **Issue:** every step rounds to 0.01 (WR-01) and the slow run rounds twice as often; the two differ by up to 0.08 degrees on a rise of 50, so the behaviour line "within one quantum" fails on rounding alone.
- **Fix:** the case allows 0.25 degrees (a fraction of a degree on a rise of 50) and says why; the bit-for-bit case for rate 1 against no rate is exact.
- **Files modified:** tests/physics.test.ts
- **Commit:** 3c4f16a

**3. [Rule 1 - Test follows changed data] Two L14 cases encoded the old Realistic start**
- **Found during:** Task 3
- **Issue:** the case "an outcome that holds at the realistic start" used `lte 100`, true at the old start (91) and false at the new one (114); the "message already active" case expected the path `initial.controls`, but with onset quantities in the blueprint the finding now points at `onset.quantities`.
- **Fix:** the outcome case uses `lte 120` (below the initial 128, above the Realistic start 114); the message case expects `onset.quantities`, and a new case keeps `initial.controls` for a scenario without onset quantities. L14 reports a start message at `onset.quantities` when the onset block sets quantities, else at `initial.controls` as before.
- **Files modified:** tests/scenario-lint.test.ts, src/scenario/lint.ts
- **Commit:** bcef0c0

**Total deviations:** 3 auto-fixed (1 blocking, 2 test or expectation corrections). **Impact:** none on behaviour; no scope added.

## Assumptions taken

- C-62 values (window 2 to 6 s, start 114, rate 3) are instructor-review items; the lint bound of 12 s is the owner's "about 10 s" with a 2 s margin.
- The plan's execution notes say STATE.md is not edited; the dispatch for this run asked for STATE.md and ROADMAP.md updates through the GSD state tooling, which was done as the last step (tooling only, no hand edit).
- L15 guard covers branches (standalone and in decisions) decided at the start, as specified; the `when` of a forbidden item is decided on the initial state too and is not covered (outside the plan, WR-04 stays open).

## Known Stubs

None.

## Threat Flags

None. The new surface is scenario data read by the existing sim; T-03-25 to T-03-28 are mitigated as planned (onset block read only with an onset time, golden recordings unchanged, rate range and sim guard, one start function, live-equals-replay case).

## Verification

- `npx vitest run`: 49 files, 2569 tests passed
- `git diff --exit-code tests/fixtures/recordings.json`: unchanged
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (3 files, 0 problems): exit 0
- `PW_PORT=4333 npx playwright test e2e/run-reaction.spec.ts e2e/scenario.spec.ts e2e/pack.spec.ts e2e/replay.spec.ts --project=desktop-chromium --project=phone-chromium`: 57 passed, 1 skipped (the long escalation case runs on desktop only)
- Acceptance greps: oil_temp_rate in physics.ts 4, realisticQuantities in predicates.ts 1, `readonly rate?` 1, `oil_temp_c: 114` 1, `window_s[2]: 2,6` 1 in each of the three scenarios, REALISTIC_SHOW_WITHIN_MS 5, L15 6, oil_temp_rate in GRADING.md 2, 42600 pin in sim.test.ts 1, `onset?.parameters` in blueprint.test.ts 2

## Self-Check: PASSED

- Files: src/engine/predicates.ts (realisticQuantities), src/aircraft/da50rg/physics.ts (oil_temp_rate), src/scenario/lint.ts (REALISTIC_SHOW_WITHIN_MS), scenarios/engine/eng-oil-temp-green.toon, e2e/run-reaction.spec.ts found
- Commits: f4746c3, 3c4f16a, bcef0c0 are ancestors of HEAD
