---
phase: 03-reactive-scenarios-and-initial-pack
plan: 09
subsystem: documentation
tags: [grading-rules, instructor-review, owner-review, todos, final-gates, webkit]
status: complete

requires:
  - phase: 03-reactive-scenarios-and-initial-pack
    provides: simulation, reactions, outcomes, the realistic level, the transponder, the FUEL selector and ECS SHUTOFF, and the three scenarios (plans 03-01 to 03-08 and 03-10)
provides:
  - docs/GRADING.md with the phase 3 rules (levels and starting point, fixed 100 ms steps, R10 outcomes, R11 reaction time and level), the 23 golden recordings by scenario and the "Instructor review (phase 3, 2026-10-23)" list of ten items with the values actually chosen
  - .claude/CLAUDE.md architecture and conventions for sim, run, physics, the code-entry kind, the new aircraft data and the physics arithmetic rule
  - README "Running a situation" and the behaviour notes as built
  - docs/PANEL-REVIEW.md "Phase 3: owner review" (15 items, including the final gate results and the WebKit outcome); item 16 of phase 2 updated
  - todos: the MAX run marked done, the retract and consumed rule moved to done, the alternator breakers noted, a new free-panel simulation todo
affects: [phase-03-verification, phase-04]

actuals:
  tokens: 8800
  tasks: 3
  commits: 3
plan_head_before: c888c71979cbe239f64ba26279fa980a15ec440c
plan_head_after: cf9aa986abb66d86ec672eeb4a44f331bac26067

tech-stack:
  added: []
  patterns:
    - "The owner review list ends with the section of the newest phase; the review-gate test takes each section up to the next heading"

key-files:
  created:
    - .planning/todos/pending/2026-10-22-free-panel-simulation.md
    - .planning/todos/done/2026-10-21-retract-consumed-events-phase3.md
  modified:
    - docs/GRADING.md
    - .claude/CLAUDE.md
    - README.md
    - docs/PANEL-REVIEW.md
    - tests/panel-review.test.ts
    - .planning/todos/pending/2026-10-21-deice-max-timer-engine.md
    - .planning/todos/pending/2026-10-21-breaker-effects-and-avionics-functions.md

key-decisions:
  - "The instructor-review list of phase 3 is one place (GRADING.md) with ten items; the owner list (PANEL-REVIEW.md) points to it item by item instead of repeating the numbers"
  - "The WebKit failure of the load-error case is recorded, not fixed: WebKit is not a gate and the plan allows no code change except a fix a failing gate names"

requirements-completed: [SCN-06, PNL-04, PNL-07, CNT-01]

coverage:
  - id: D1
    description: "GRADING.md states the phase 3 rules (R10 outcomes, R11 reaction time and level, fixed 100 ms steps, the starting point per level) and lists every phase 3 instructor-review item with the chosen value"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/docs-format.test.ts, tests/content-policy.test.ts"
        status: pass
    human_judgment: true
    rationale: "Whether the documented values are right is the instructor's decision; only the format and the content policy are tested"
  - id: D2
    description: "CLAUDE.md, README and the owner review list describe the simulation, the three scenarios, the realistic level, the transponder, the FUEL selector, the ECS SHUTOFF and the MAX run as built; the README counts equal the reference tables"
    requirement: "PNL-07"
    verification:
      - kind: unit
        ref: "tests/panel-review.test.ts (phase 3 owner review, README counts)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The todos say what phase 3 closed (MAX run, retract and consumed rule, alternator breakers) and what stays open (ANNUN-TEST, WIND SHIELD, ICE LIGHT, ELT, the other breaker effects, a simulation on the free panel)"
    requirement: "CNT-01"
    verification: []
    human_judgment: true
    rationale: "Planning notes; there is no test for their wording"
  - id: D4
    description: "Every unit, type, lint, format, validate and build gate and the chromium e2e suite are green; one WebKit attempt is recorded"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "npx vitest run: 48 files, 2505 tests pass"
        status: pass
      - kind: e2e
        ref: "PW_PORT=4333 playwright desktop-chromium, phone-chromium, tablet-chromium: 761 passed, 259 skipped, 0 failed"
        status: pass
    human_judgment: false
  - id: D5
    description: "Owner end-of-phase check on a desktop, a real phone and a tablet: three scenarios on Easy and Realistic, an escalation read in the debrief, squawk 7700, ECS SHUTOFF and FUEL selector OFF, MAX on HIGH, judging the physics speed, the outcome wording, the transponder position and the looks of the new controls"
    verification: []
    human_judgment: true
    rationale: "Needs a human on real devices (plan human-check); listed as items 1 to 12 of PANEL-REVIEW.md 'Phase 3: owner review'; not faked here"

duration: 20min
completed: 2026-10-23
---

# Phase 3 Plan 09: Documents and the final gates Summary

**GRADING.md now holds the phase 3 grading rules (R10 outcomes, R11 reaction time, fixed 100 ms steps, the starting point per level) and one list of ten instructor-review items with the values the plans chose; CLAUDE.md, the README, the owner review list and the todos describe phase 3 as built, and every unit, type, lint, format, validate and build gate and the chromium e2e suite are green.**

## Performance

- **Duration:** about 20 min (documents about 8 min, gates about 12 min)
- **Tasks:** 3 (all documentation or gates; no tracer, as the plan states)
- **Files:** 2 created, 7 modified (9 changed in the three commits, 126 lines added)

## Accomplishments

- `docs/GRADING.md`: rule 1 names the levels (Easy and Medium start from the scenario's values; Realistic from the base values with a seeded, recorded onset), rule 4 states the 100 ms stepper and that steps stay control-only, new R10 (a named outcome ends the run as FAIL, first reason, later events not graded) and R11 (reaction time from the onset is display only; the level is never an input of `grade`). The golden-recordings section covers all 23 recordings by scenario. "Instructor review (phase 3, 2026-10-23)" lists ten items with the chosen values: physics constants and time scale, ALTN 1 FAIL persistence, the bus model, outcome names with thresholds and hold times, onset windows, forbidden lists, the unordered default of the new procedures, the optional squawk step, the Engine Fire steps on the FUEL selector and ECS SHUTOFF (225 degree OFF angle unverified), and the 120 s MAX run.
- `.claude/CLAUDE.md`: Architecture gains sim.ts, run.ts, physics.ts, the code-entry kind, the selector-bar skin, the fifteen quantities, the three CAS rules, the squawk, FUEL selector and ECS SHUTOFF controls, the step-based clock driver, the bridge flags and the realistic level, parameters, outcomes and onset with lints L12 to L14; the stale sentence on Phase 3 is replaced; counts follow the reference tables (95 controls, 33 regions); Conventions gain the physics arithmetic rule.
- `README.md`: three situations, moving gauges, named outcomes, Realistic (active, no briefing, debrief reveals the situation and the reaction time), the transponder, the MAX run in a run, the alternator breakers.
- `docs/PANEL-REVIEW.md`: "Phase 3: owner review" with 15 items (gauge speed, free-panel readings, the three outcome wordings, the realistic flow, the Engine Fire cue, the transponder, ALTN 1 FAIL persistence, forbidden lists, the FUEL selector and ECS SHUTOFF looks and the shortened cowl flap, the Engine Fire steps, the MAX run, procedure order, gate results, WebKit outcome, publishing). Phase 2 item 16 now says Realistic is active.
- Todos: MAX run marked done (plan 03-04, run-only), the retract rule moved to `done/` with a closing line, alternator breakers noted, and `2026-10-22-free-panel-simulation.md` written.

## Task Commits

1. **Task 1: grading rules, instructor review list, architecture notes** - `3c2ea21` (docs)
2. **Task 2: README, owner review list, todos** - `6d0b545` (docs)
3. **Task 3: final gate results and the WebKit attempt** - `cf9aa98` (docs)

## Verification

- `npx vitest run`: 48 files, 2505 tests pass.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (3 scenario files, 0 problems) and `npm run build` exit 0.
- `PW_PORT=4333 npx playwright test --project=desktop-chromium --project=phone-chromium --project=tablet-chromium`: 761 passed, 259 skipped, 0 failed (desktop 289, phone 280, tablet 192).
- WebKit, one attempt (`desktop-webkit`, `phone-webkit`, `tablet-webkit`): 637 passed, 381 skipped, 2 failed. Both failures are `e2e/scenario.spec.ts` "@hooks a pack that cannot be loaded shows the error; Try again retries the same request" on `desktop-webkit` and `phone-webkit`; they repeat when the case is run alone; `tablet-webkit` passed it and all chromium projects pass it. Not a gate, no change made. Likely cause (unconfirmed): since plan 07 the case aborts every pack chunk and NEW SITUATION picks among two packs, so the retry can meet a chunk whose first request failed, which WebKit may remember. If it is a real Safari behaviour, Try again after a lost connection needs a reload or a cache-busting chunk address; this is recorded in PANEL-REVIEW.md item 14.
- Acceptance: `grep -c R10 docs/GRADING.md` 1, `Instructor review (phase 3` 1, `sim.ts` and `run.ts` in CLAUDE.md 1 each, `Phase 3: owner review` 2 (heading and the pointer in item 16), `transponder` in README 3, `Results of the phase 3 final gates` 1; both todo files exist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The review-gate tests assumed the phase 2 section is the last section**
- **Found during:** Task 2 verify
- **Issue:** `tests/panel-review.test.ts` required `## Phase 2: owner review` to be the last heading and read the phase 2 section up to the end of the file, so appending the mandated "Phase 3: owner review" failed three cases (last section, no unfilled item, numbering).
- **Fix:** The last-section case now expects the Phase 3 heading last and the Phase 2 heading before it; the Phase 2 section is read up to the next heading; a `phase 3 owner review (plan 03-09)` block checks the new section (present, points to GRADING.md, no unfilled marker, no private path, numbered without a gap, names the two new control rows and the 225 degree angle). No assertion was loosened. The phrase "pending todo" in my first draft matched the unfilled-marker rule and was reworded.
- **Files modified:** tests/panel-review.test.ts
- **Commit:** 6d0b545

### Plan notes

- `.planning/STATE.md` is not edited by the three tasks; the close-out state tooling after this SUMMARY updates it, as in plans 01 to 08.
- `docs/PANEL-REVIEW.md` and `.claude/CLAUDE.md` were not Prettier-clean before this plan (format:check covers `src tests e2e scripts` only); they were not reformatted to keep the diff small.
- The path of the retract todo in `docs/PANEL-REVIEW.md` (Round 5 item 10) was updated to its new place in `todos/done/`.
- Item 3 of the phase 2 review already named the transponder and the ECS region (plans 03-03 and 03-10), so it needed no further edit.

**Total deviations:** 1 auto-fixed (Rule 3). **Impact:** test support only.

## Owner end-of-phase check (needs a human)

Not run, by design: the plan's `<human-check>` requires a desktop, a real phone and a tablet. It is listed as items 1 to 12 of `docs/PANEL-REVIEW.md`, "Phase 3: owner review" (the three scenarios on Easy and Realistic, one escalation read in the debrief, squawk 7700, ECS SHUTOFF and FUEL selector OFF in Engine Fire, MAX on HIGH during a run, and the judgement of physics speed, outcome wording, transponder position and the looks of the FUEL selector, ECS SHUTOFF and the moved cowl flap). Also open: the instructor review of the ten items in `docs/GRADING.md`.

## Known Stubs

None. No code was added; the documents describe what the earlier plans built.

## Threat Flags

None. T-03-22: documents hold facts and own words only; no AFM sentence, no photo and no path into the private input folder (`tests/content-policy.test.ts` and `tests/docs-format.test.ts` pass).

## Self-Check: PASSED

- Created files exist (checked with `[ -f ]`): `.planning/todos/pending/2026-10-22-free-panel-simulation.md`, `.planning/todos/done/2026-10-21-retract-consumed-events-phase3.md`.
- Commits `3c2ea21`, `6d0b545`, `cf9aa98` are ancestors of HEAD; `git rev-list --count` from the recorded plan base gives 3.
