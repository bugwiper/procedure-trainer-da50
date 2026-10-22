---
phase: 03-reactive-scenarios-and-initial-pack
plan: 08
subsystem: content-pack
tags: [scenario, engine-fire, fire-model, fuel-cut, cas, squawk, replay-tests, e2e]

requires:
  - phase: 03-reactive-scenarios-and-initial-pack
    provides: simulation, hidden quantities and parameters (03-01, 03-02), the transponder kp.squawk (03-03), named outcomes (03-05), the realistic level (03-06), the pack layout and blueprint gate over every scenario (03-07), the FUEL selector and the ECS SHUTOFF (03-10)
provides:
  - the scenario eng-fire-in-flight (ENGINE FIRE) in the engine pack, the third scenario of the initial pack, every panel step of AFM 03-33 graded
  - the hidden quantity fire_intensity, the parameter engine_fire and the fire model that heats the oil, coolant and gearbox
  - the fuel cut of the FUEL selector (OFF stops the engine like ENGINE MASTER OFF and cuts the EMERG FUEL PUMP)
  - the CAS warning OIL PRES on the red oil pressure bands
  - eight recordings and a synthetic ordered copy (tests/fixtures/scenarios/fire-ordered.toon) pinning golden, do-nothing, wrong-order and forbidden runs, recovery and escalation
affects: [03-09]

actuals:
  tokens: 12300
  tasks: 2
  commits: 2
plan_head_before: b289c8a5847bc527e2b0bcedb1fb85774606977c
plan_head_after: e75778f3b0373bd40c19d2ec6648dfe2c13b07de

tech-stack:
  added: []
  patterns:
    - "Group and step ids of a shipped scenario must not occur as substrings in src/engine, src/scenario or src/ui (the blueprint gate); single-word ids such as air or engine would, so each graded step sits in a group named grp_<what>"
    - "A hidden quantity with one unmarked band carries an effect that only shows in other readings (the fire shows as rising temperatures)"

key-files:
  created:
    - scenarios/engine/eng-fire-in-flight.toon
    - tests/fixtures/scenarios/fire-ordered.toon
  modified:
    - src/aircraft/da50rg/quantities.ts
    - src/aircraft/da50rg/physics.ts
    - src/aircraft/da50rg/cas.ts
    - scenarios/engine/pack.toon
    - e2e/pack.spec.ts
    - tests/fixtures/recordings.json
    - tests/grading.test.ts
    - tests/physics.test.ts
    - tests/cas.test.ts
    - tests/scenario-tracer.test.ts

key-decisions:
  - "Fire intensity lags (tau 30 s) toward the product of 100, engine_fire and a feed factor: 0.9 with the engine running, 1 with the pump on as well, 0.6 with the pump alone, 0 once the fuel is cut (C-44)"
  - "The running helper requires the FUEL selector not OFF, so the selector OFF stops the engine, the alternators and the oil pressure like ENGINE MASTER OFF; NORMAL and EMERGENCY feed alike"
  - "The fire heats oil by at most 30, coolant by 30 and gearbox by 40 degrees, so no ENG OIL TEMP warning appears from the fire alone (the onset shows as rising temperatures only, C-45)"
  - "OIL PRES is a warning on the bands low_red and high_red, placed after ENG OIL TEMP (C-46)"
  - "Outcome fire_spreads at fire_intensity 85 for 20 s; onset window 5 to 20 s (C-50)"
  - "Each graded step sits in its own unordered group (C-48); group ids carry a grp_ prefix for the blueprint gate"

patterns-established:
  - "A wrong-order replay on a scenario of unordered groups runs twice: the real file passes, a synthetic ordered copy fails (as in 03-07)"

requirements-completed: [CNT-01, PNL-07]

coverage:
  - id: D1
    description: "NEW SITUATION and CHOOSE SITUATION offer ENGINE FIRE, the third scenario of the initial pack; its golden run (squawk 7700, fresh air, ECS SHUTOFF pulled, ENGINE MASTER off, FUEL selector OFF, ELECT. MASTER off) grades PASS on the built app and the debrief marks the squawk step Done"
    requirement: "CNT-01"
    verification:
      - kind: e2e
        ref: "e2e/pack.spec.ts#CHOOSE SITUATION lists every shipped scenario / Engine Fire: the golden run with squawk 7700 grades PASS (desktop-chromium, phone-chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The scenario validates against the schema, the aircraft registry and the lint rules with an empty annunciation list; every panel step of AFM 03-33 is a critical step in checklist order and the squawk step is optional"
    requirement: "CNT-01"
    verification:
      - kind: unit
        ref: "npm run validate; tests/grading.test.ts#Engine Fire replays (plan 03-08, D-08, D-06, C-48)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fire grows when ignored and ends the run with fire_spreads, decays after ENGINE MASTER OFF or FUEL selector OFF, is fed by the EMERG FUEL PUMP unless the selector is OFF, and the engine temperatures rise with it without a CAS message"
    requirement: "CNT-01"
    verification:
      - kind: unit
        ref: "tests/physics.test.ts#engine fire (plan 03-08, C-44) / the fuel cut of the FUEL selector"
        status: pass
      - kind: unit
        ref: "tests/grading.test.ts#grades fire-do-nothing-long exactly / fire-golden-long exactly"
        status: pass
    human_judgment: false
  - id: D4
    description: "Golden, do-nothing, wrong-order and forbidden replays grade as listed in Table R3; the real groups are unordered and a synthetic ordered copy fails the same events with three order violations"
    requirement: "CNT-01"
    verification:
      - kind: unit
        ref: "tests/grading.test.ts#golden recordings (Table R1) fire-* cases"
        status: pass
    human_judgment: false
  - id: D5
    description: "OIL PRES is a warning that is off at the base values and on in both red oil pressure bands; no scenario fact or threshold leaks into src/engine, src/scenario or src/ui"
    requirement: "CNT-01"
    verification:
      - kind: unit
        ref: "tests/cas.test.ts#DA50 RG table: OIL PRES (plan 03-08, C-46); tests/blueprint.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Squawk 7700 is credited as an optional step (PNL-07, criterion 4) and only for that code"
    requirement: "PNL-07"
    verification:
      - kind: e2e
        ref: "e2e/pack.spec.ts#Engine Fire: the golden run with squawk 7700 grades PASS"
        status: pass
      - kind: unit
        ref: "tests/grading.test.ts#squawk 7700 is credited only for that code"
        status: pass
    human_judgment: false
  - id: D7
    description: "The fire constants (growth time, feed factors, heating), the 85 percent outcome threshold with its 20 s hold, the 5 to 20 s onset window, the forbidden list and the own-addition squawk step are plausible training-aid values"
    verification: []
    human_judgment: true
    rationale: "Instructor-review items (RESEARCH A1, A4, A8); tests pin the behaviour, not the realism of the numbers"

duration: 12min
completed: 2026-10-22
status: complete
---

# Phase 3 Plan 08: Engine Fire in flight Summary

**Engine Fire completes the initial pack: a hidden fire quantity that grows while fuel feeds it and ends an ignored run with fire_spreads, a fuel cut on the FUEL selector, an OIL PRES warning that the correct shutdown produces, and a scenario grading every panel step of AFM 03-33 (fresh air, ECS SHUTOFF, ENGINE MASTER, FUEL selector, ELECT. MASTER) plus an optional squawk 7700.**

## Performance

- **Duration:** about 12 min (start 22:04 UTC, end 22:15 UTC)
- **Tasks:** 2 (1 tracer, 1 TDD-style auto)
- **Files:** 2 created, 10 modified

## Accomplishments

- AFM 03-33 (issue 018, read from the private PDF into the scratchpad only) confirms Table F1: CIRCULATING AIR OFF / FRESH AIR, ECS shut-off PULL, select landing area, ENGINE MASTER OFF, FUEL valve OFF, ELECT. MASTER OFF, airspeed as required, emergency windows, emergency landing without engine power, doors open and evacuate. No difference found. The scenario carries facts and short checklist lines (none above 8 words); the briefing is in own words; no warning is reproduced.
- `fire_intensity` (hidden, 0 to 100, base 0, one unmarked band) and the parameter `engine_fire` (0 to 1, normal 0). The fire lags with tau 30 s toward 100 x engine_fire x feed; feed is 0.9 running, 1 running with the pump on, 0.6 with the pump alone and engine off, 0 with the FUEL selector OFF or (engine off, pump off). The fire adds up to 30 degrees to the oil, 30 to the coolant and 40 to the gearbox. With engine_fire 0 and the selector on NORMAL every plan 02 equilibrium still holds (the C-09 tests pass unchanged).
- The fuel cut: the `running` helper requires the FUEL selector not OFF, so OFF drops rpm, load, oil pressure, fuel pressure and Amps exactly like ENGINE MASTER OFF; the EMERG FUEL PUMP adds no pressure with the selector OFF. EMERGENCY reads like NORMAL for every quantity.
- OIL PRES (warning on the bands low_red and high_red of the oil pressure) sorts after ENG OIL TEMP and before the cautions; it is off at the base values.
- `scenarios/engine/eng-fire-in-flight.toon`: initial lv.env_circ recirc, fire_intensity 40 with slightly raised temperatures, no annunciation, six steps in six unordered groups (five critical, squawk_7700 optional at the end), forbidden emerg_fuel_pump_on (fails) and power_increased (reported only), outcome fire_spreads (85 for 20 s), onset 5 to 20 s. The manifest lists it as the second engine entry.
- Replay by simulation: ignored, the fire reaches the outcome inside the 600 s run; with the golden events it never escalates. The FUEL selector OFF alone also stops it.
- e2e: the golden run on the built app (squawk 7700 on the zoomed transponder, fresh air, ECS SHUTOFF pulled, ENGINE MASTER off, FUEL selector OFF by two right-half taps on the zoomed pedestal, ELECT. MASTER off) grades PASS and the squawk debrief row reads Done; no CAS chip shows at the start.

## Task Commits

1. **Task 1 (tracer): Engine Fire in flight with a hidden fire, the fuel cut, the OIL PRES warning and squawk 7700** - `a148865` (feat)
2. **Task 2: Engine Fire pinned by golden, do-nothing, wrong-order and forbidden replays, the fire model, the fuel cut and OIL PRES** - `e75778f` (test)

Tracer feedback gate: auto / end-of-phase mode, the tracer `<verify>` carries automated commands only; validate, the listed Vitest files and e2e/pack.spec.ts were re-run end to end and passed, so expansion continued.

## Verification

- `npx vitest run`: 48 files, 2501 tests pass. `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm run validate` (3 scenario files, 0 problems) exit 0.
- `PW_PORT=4333 npx playwright test --project=desktop-chromium --project=phone-chromium` (the whole suite, including pack, scenario, xpdr and fire-controls): 569 passed, 111 skipped (project-specific cases), 0 failed.
- Acceptance greps: eng-fire-in-flight in pack.toon 2; OIL PRES in cas.ts 1; fire_intensity in quantities.ts 2; kp.squawk, sw.fuel_valve and lv.ecs_shutoff in the scenario 1 each; fire-do-nothing-long in recordings.json 1; sw.fuel_valve in recordings.json 6; fire-ordered.toon exists.

## Assumptions taken (defaults C-43 to C-50)

- C-43 to C-50 taken as written. Concrete values: tau 30 s, feed 0.9 / 1 / 0.6 / 0, heating 30 / 30 / 40 degrees, initial intensity 40 with oil 103, coolant 97 and gearbox 91 degrees (the cruise equilibrium plus the share of the heating), outcome threshold 85 with hold 20 s, onset 5 to 20 s, forbidden EMERG FUEL PUMP ON (fails) and a POWER increase (reported). All are instructor-review items (RESEARCH A1, A4, A8).
- The scenario verified date is 2026-10-23 (the date of this check on the local clock).
- Group ids carry the prefix grp_ (grp_circ_air, grp_ecs_pull, grp_eng_master, grp_fuel_valve, grp_elect_master, grp_xpdr_code): see the first deviation.
- The pump alone (engine off, selector not OFF) keeps a fire at 60 percent, below the outcome threshold: a run that switches the pump on is failed by the forbidden item, not by the outcome.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Single-word group ids fail the blueprint gate**
- **Found during:** Task 1 (design, before writing the file)
- **Issue:** Table F1 names the groups air, ecs, engine, fuel, electrical and transponder. The gate of plan 07 forbids every step and group id as a substring in src/engine, src/scenario and src/ui; words such as air, engine and fuel occur there.
- **Fix:** Group ids are grp_circ_air, grp_ecs_pull, grp_eng_master, grp_fuel_valve, grp_elect_master and grp_xpdr_code. The checklist order and grading are as in Table F1.
- **Files modified:** scenarios/engine/eng-fire-in-flight.toon
- **Commit:** a148865

**2. [Rule 3 - Blocking] Two existing tests needed the new data**
- **Found during:** Task 1 verify
- **Issue:** The Table P1 helper of tests/physics.test.ts passed an empty quantity set, but the oil model now reads fire_intensity; tests/scenario-tracer.test.ts compares the engine pack listing with a literal list of one scenario.
- **Fix:** The helper passes the base values; the listing expectation gained the second entry.
- **Files modified:** tests/physics.test.ts, tests/scenario-tracer.test.ts
- **Commit:** a148865

**3. [Rule 2 - Missing critical] The pump has no fuel to push with the FUEL selector OFF**
- **Found during:** Task 1 (model design, C-44 "unless the FUEL selector is OFF")
- **Issue:** Left as it was, the EMERG FUEL PUMP would still show fuel pressure with the selector OFF while it no longer feeds the fire.
- **Fix:** The pump pressure is zero with the selector OFF (tested).
- **Files modified:** src/aircraft/da50rg/physics.ts
- **Commit:** a148865

### Plan notes

- Table R3 fire-forbidden: the events are listed in time order (squawk 2000, pump 3000, fresh air 4000 ...), so the pump has seq 1 and the first action is at 2000 ms.
- fire-wrong-order-ordered grades FAIL with three pairwise order violations (the three reversed pairs of the shut-down group) and one `order` reason; the plan lists only the reason.
- Every recording graded as listed in Table R3 on the first run; no expectation was changed to fit the result.

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical). **Impact:** none on scope.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. T-03-20: step lines are at most 8 words, the briefing and comments are own words, the AFM was read into the scratchpad only, tests/content-policy.test.ts passes. T-03-21: no control was added; the steps use only registry states of sw.fuel_valve and lv.ecs_shutoff, checked by lint. T-03-SC: no package installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-09 (documents and final gates) can describe the third scenario, the fire model and the OIL PRES rule; the instructor-review list gains: fire growth time and feed factors, outcome threshold 85 with hold 20 s, the onset window, the forbidden list (pump fails, more power reported) and the squawk 7700 step as an own addition.
- Open for the owner (listed, not blocking): the 225 degree OFF angle of the FUEL selector and the looks of the two controls (plan 03-10).

## Self-Check: PASSED

- Files exist (checked with `[ -f ]`): scenarios/engine/eng-fire-in-flight.toon, tests/fixtures/scenarios/fire-ordered.toon.
- Commits `a148865` and `e75778f` are ancestors of HEAD; `git rev-list --count` from the recorded plan base gives 2.
