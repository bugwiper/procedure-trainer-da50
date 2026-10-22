---
phase: 03-reactive-scenarios-and-initial-pack
plan: 07
subsystem: content-pack
tags: [scenario, electrical, cas, alternator, replay-tests, blueprint-gate, e2e]

requires:
  - phase: 03-reactive-scenarios-and-initial-pack
    provides: the electrical bus model and the alt1_output parameter (03-02), named outcomes and hold timers (03-05), the realistic level and lint L14 (03-06)
provides:
  - the electrical pack (manifest title Electrical, free) with the scenario elec-altn1-fail (ALTN 1 FAIL), checked against AFM 03A-02 issue 018
  - the CAS caution rule altn_1_fail (Amps of alternator 1 at most 2.5)
  - seven replay recordings and a synthetic ordered copy (tests/fixtures/scenarios/elec-ordered.toon) pinning golden, do-nothing, wrong-order and forbidden runs, recovery and escalation
  - shippedScenarios() (e2e/support/session.ts): rows, titles and files read from the shipped manifests in node
  - a blueprint gate over every shipped scenario file (ids, controls, parameters, outcome ids, CAS texts and thresholds)
affects: [03-08, 03-09]

actuals:
  tokens: 10600
  tasks: 3
  commits: 3
plan_head_before: 429e1edfeae0b9cf82eaafcdec66f8b6e7331a00
plan_head_after: 3c6a0cc60871961c057a37cc22738b474c0e35de

tech-stack:
  added: []
  patterns:
    - "A pack is a folder under scenarios/ with a pack.toon; e2e and the blueprint gate discover packs and scenarios by walking the folder, never by literals"
    - "A wrong-order replay on a scenario with an unordered group runs twice: the real file passes, a synthetic ordered and order-critical copy in tests/fixtures/scenarios fails (C-39)"
    - "Specs that need a specific scenario open it through CHOOSE SITUATION (row key pack.scenario); NEW SITUATION is random among the shipped scenarios"

key-files:
  created:
    - scenarios/electrical/pack.toon
    - scenarios/electrical/elec-altn1-fail.toon
    - e2e/pack.spec.ts
    - tests/fixtures/scenarios/elec-ordered.toon
  modified:
    - src/aircraft/da50rg/cas.ts
    - e2e/support/session.ts
    - e2e/scenario.spec.ts
    - e2e/replay.spec.ts
    - e2e/session-area.spec.ts
    - tests/blueprint.test.ts
    - tests/cas.test.ts
    - tests/grading.test.ts
    - tests/fixtures/recordings.json

key-decisions:
  - "Pack electrical holds elec-altn1-fail; ENG OIL TEMP stays in engine (C-37)"
  - "ALTN 1 FAIL fires while alt1_amps is at most 2.5 and stays after ALTERNATOR 1 is switched OFF, because the failed state is the current quantity (C-38)"
  - "The real group is unordered (C-39); order is pinned on a synthetic ordered copy"
  - "Forbidden: ALTERNATOR 2 OFF and ELECT. MASTER OFF, both failing the run (C-40)"
  - "Outcome main_bus_lost: bus_volts at most 22.5 for 10 s, onset window 5 to 20 s (C-41); an ignored run ends at 226.3 s of run time"
  - "The load-error e2e case aborts every pack chunk (**/pack-*) so the random pick of NEW SITUATION cannot reach a scenario (C-42)"

patterns-established:
  - "The blueprint gate walks scenarios/ for every .toon except pack.toon and derives its literal lists from the union of all files"

requirements-completed: [CNT-01]

coverage:
  - id: D1
    description: "CHOOSE SITUATION lists every shipped scenario (Electrical Failure next to ENG OIL TEMP) and the Electrical Failure golden run (ALTERNATOR 1 OFF, ESS BUS ON) shows the ALTN 1 FAIL caution at the start and grades PASS on the built app"
    requirement: "CNT-01"
    verification:
      - kind: e2e
        ref: "e2e/pack.spec.ts#CHOOSE SITUATION lists every shipped scenario / ALTN 1 FAIL: the golden run grades PASS (desktop-chromium, phone-chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Electrical Failure scenario validates against the schema, the aircraft registry and the lint rules; ALTN 1 FAIL is a caution that is off at the base values, on at 0 A and after ALTERNATOR 1 OFF, and sorts after warnings"
    requirement: "CNT-01"
    verification:
      - kind: unit
        ref: "npm run validate; tests/cas.test.ts#DA50 RG table: ALTN 1 FAIL (plan 03-07, C-38)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Golden, do-nothing, wrong-order and forbidden replays grade as expected; handled it never escalates in 600 s, ignored it ends with main_bus_lost"
    requirement: "CNT-01"
    verification:
      - kind: unit
        ref: "tests/grading.test.ts#golden recordings (Table R1) and Electrical Failure replays (plan 03-07, D-08, D-06, C-39)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The blueprint gate derives its forbidden literals and thresholds from every shipped scenario file; the e2e suite no longer depends on the random pick of NEW SITUATION or on literal row counts"
    requirement: "CNT-01"
    verification:
      - kind: unit
        ref: "tests/blueprint.test.ts#derives the literals from every shipped scenario file"
        status: pass
      - kind: e2e
        ref: "e2e/scenario.spec.ts, e2e/replay.spec.ts, e2e/session-area.spec.ts, e2e/clock.spec.ts (desktop-chromium, phone-chromium; the NEW SITUATION cases repeated six times)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The procedure facts, the 2.5 A caution threshold, the 22.5 V outcome threshold, the 10 s hold time, the 5 to 20 s onset window and the forbidden list are plausible training-aid values"
    verification: []
    human_judgment: true
    rationale: "These are instructor-review items (RESEARCH A2, A4, A8); tests pin the behaviour, not the realism of the numbers"

duration: 12min
completed: 2026-10-22
status: complete
---

# Phase 3 Plan 07: Electrical Failure (ALTN 1 FAIL) Summary

**Electrical Failure ships as a second blueprint scenario in a new `electrical` pack: a rule-derived ALTN 1 FAIL caution, a procedure with ALTERNATOR 1 OFF and ESSENTIAL BUS ON as critical steps, a main-bus outcome that ends an ignored run, replay tests for golden, do-nothing, wrong-order and forbidden runs, and a blueprint gate that now walks every shipped scenario file.**

## Performance

- **Duration:** about 12 min (start 21:48 UTC, end 22:00 UTC)
- **Tasks:** 3 (1 tracer, 1 auto, 1 TDD-style auto)
- **Files:** 4 created, 9 modified

## Accomplishments

- AFM 03A-02 (issue 018, read from the private PDF into the scratchpad only) confirms Table E1: breakers checked, ALTERNATOR 1 OFF, ESSENTIAL BUS ON, bus voltage monitored, terminate and land at the next suitable airfield. No difference found. The scenario file carries facts and short checklist lines (none above 10 words); the briefing is in own words; no AFM note or caution is reproduced.
- `scenarios/electrical/elec-altn1-fail.toon`: initial quantities alt1_amps 0, bus_volts 25.9, battery_pct 98 (the battery-alone values of the plan 02 model); parameter alt1_output 0; one unordered group of two critical steps; two forbidden items; outcome main_bus_lost (bus_volts at most 22.5 for 10 s); onset window 5 to 20 s. It passes the schema and lints L5, L6, L10 to L14.
- Physics check by replay: with the failure from the start an ignored run reaches main_bus_lost at 226.3 s of run time (battery drain at 25 percent per minute); ESS BUS on restores the bus through alternator 2 and the run never escalates in 600 s.
- `altn_1_fail` in the DA50 RG CAS table (caution) reads only the Amps of alternator 1, so it also holds after ALTERNATOR 1 is switched OFF.
- `e2e/support/session.ts` gained `shippedScenarios()`; `e2e/pack.spec.ts` lists every shipped row and runs the Electrical Failure golden path on the built app. Every other spec that needs ENG OIL TEMP now opens it through CHOOSE SITUATION; counts and titles come from the manifests.
- `tests/blueprint.test.ts` walks `scenarios/` for every scenario file except manifests, checks each, and builds scenario id, step and group id, forbidden id, outcome id, control id (steps, triggers, outcomes), parameter id, CAS id and message, and the CAS plus outcome thresholds from the union. A probe (a comment with `main_bus_lost 22.5` in `src/engine`) failed the gate as intended and was reverted.

## Task Commits

1. **Task 1 (tracer): the ALTN 1 FAIL pack, caution rule and golden run on the built app** - `2a8fc2a` (feat)
2. **Task 2: deterministic e2e scenario choice and the blueprint gate over every scenario** - `d919fcf` (test)
3. **Task 3: Electrical Failure replays and the CAS rule pinned** - `3c6a0cc` (test)

Tracer feedback gate: auto / end-of-phase mode, the tracer `<verify>` carries automated commands only; validate, the listed Vitest files and e2e/pack.spec.ts were re-run end to end and passed, so expansion continued.

## Verification

- `npx vitest run`: 48 files, 2463 tests pass. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (2 scenario files, 0 problems) exit 0.
- `PW_PORT=4333 npx playwright test e2e/pack.spec.ts e2e/scenario.spec.ts e2e/replay.spec.ts e2e/session-area.spec.ts e2e/clock.spec.ts e2e/run-reaction.spec.ts --project=desktop-chromium --project=phone-chromium`: 73 passed, 1 skipped (the desktop-only escalation case on phone).
- The whole e2e suite on the two chromium projects: 567 passed, 111 skipped.
- Acceptance greps: `ALTN 1 FAIL` in cas.ts 1; `alt1_output` in the scenario 1; `every shipped scenario` in blueprint.test.ts 2; `shippedScenarios` in session-area.spec.ts 2; `elec-do-nothing-long` in recordings.json 1; elec-ordered.toon exists.

## Assumptions taken (defaults C-37 to C-42)

- C-37 to C-42 taken as written: threshold 2.5 A, outcome threshold 22.5 V with hold 10 s, onset window 5 to 20 s, forbidden ALTERNATOR 2 OFF and ELECT. MASTER OFF. All are instructor-review items (RESEARCH A2, A4, A8).
- Initial bus values: battery 98 percent and 25.9 V, the battery-alone reading of the plan 02 model a few seconds after the failure.
- The ESS BUS hint of the AFM note (alternator 2 then feeds the main bus) is modelled only as far as plan 02 does; the loss of the RACC system stays out of scope (D-10).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The CAS test helper had no Amps value**
- **Found during:** Task 1
- **Issue:** The new rule reads `alt1_amps`; `at()` in `tests/cas.test.ts` built contexts with the oil quantities only, so the existing ENG OIL TEMP table case threw "quantity has no value".
- **Fix:** `at()` takes an optional Amps value that defaults to the base read from the quantity data.
- **Files modified:** tests/cas.test.ts
- **Commit:** 2a8fc2a

**2. [Rule 3 - Blocking] The load-error case aborted only the engine pack chunk**
- **Found during:** Task 2
- **Issue:** `e2e/scenario.spec.ts` aborted `**/pack-engine*` and tapped NEW SITUATION; with a random pick among two packs the electrical chunk would load and the case would be flaky.
- **Fix:** the case aborts every pack chunk (`**/pack-*`).
- **Files modified:** e2e/scenario.spec.ts
- **Commit:** d919fcf

**3. [Rule 2 - Missing critical] Gate coverage for outcomes and parameters**
- **Found during:** Task 2
- **Issue:** the plan lists outcome predicate values as thresholds; the outcome ids, the controls read by outcome predicates and the parameter ids (alt1_output) were also scenario facts that could leak into application code.
- **Fix:** the gate also derives outcome ids, outcome control ids and parameter ids.
- **Files modified:** tests/blueprint.test.ts
- **Commit:** d919fcf

### Plan notes

- `ShippedScenario` also carries the manifest `file` so the NEW SITUATION case can read the picked scenario's initial controls in node. e2e/clock.spec.ts stays unchanged as planned (it passes with any scenario).
- The planned ALTN 1 FAIL golden run, the four replay kinds and the gate matched the first run; no recording needed a changed expectation.

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical). **Impact:** test support only; no change to engine behaviour.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. T-03-18: step lines are at most 10 words, the briefing and comments are own words, the AFM was read into the scratchpad only. T-03-19: the blueprint gate walks every shipped scenario. T-03-SC: no package installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 08 (Engine Fire) can add a third pack folder or scenario file; the gate, `shippedScenarios()` and the chooser tests pick it up without edits, but the choose view holds at most `SESSION_LAYOUT.choose.maxRows` rows (guarded by tests/session.test.ts).
- Instructor review of the numbers in D5 is still open.

## Self-Check: PASSED

- Created files exist (checked with `[ -f ]`): scenarios/electrical/pack.toon, scenarios/electrical/elec-altn1-fail.toon, e2e/pack.spec.ts, tests/fixtures/scenarios/elec-ordered.toon.
- Commits `2a8fc2a`, `d919fcf`, `3c6a0cc` are ancestors of HEAD.
