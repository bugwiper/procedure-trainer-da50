---
phase: 03-reactive-scenarios-and-initial-pack
plan: 01
subsystem: engine
tags: [simulation, physics, fixed-step, clock-driver, scenario-parameters, lint, preact-signals]

requires:
  - phase: 02-first-gradable-scenario
    provides: named quantities, VirtualClock, PanelStore log, scenario schema and lint, MFD gauges bound to bridge.quantities
provides:
  - fixed 100 ms stepper (src/engine/sim.ts) shared by the live Run and every replay
  - generic physics types and definePhysics validation (src/engine/physics.ts)
  - Run: virtual clock plus incremental simulation over the store log (src/engine/run.ts)
  - DA50 oil temperature lag model and the oil_cooling parameter as aircraft data
  - scenario `parameters` with lint L12 (format stays 1)
  - step-based clock driver, session.run, bridge.setQuantities and the quantities test hook
  - e2e startScenario / quantityOf helpers and the run-reaction spec
affects: [03-02, 03-04, 03-05, 03-06, 03-07, 03-08, 03-09]

actuals:
  tokens: 19700
  tasks: 3
  commits: 3
plan_head_before: 279f3dbf943b7530f9a0d2ceac69c1981effaa30
plan_head_after: e17fa5491ea5dd08c7cae2cde83b916c26065ba9

tech-stack:
  added: []
  patterns:
    - "Pure fixed-step stepper: + - * / only, clamp then quantise to 0.01 after every step"
    - "One event timing rule for live and replay: events apply in log order at the first step boundary at or after their t, never sorted"
    - "Physics as aircraft data behind AircraftEnv.physics; scenarios only set named parameters"
    - "Clock driver converts frames into whole steps with a remainder carry"

key-files:
  created:
    - src/engine/physics.ts
    - src/engine/sim.ts
    - src/engine/run.ts
    - src/aircraft/da50rg/physics.ts
    - e2e/support/session.ts
    - e2e/run-reaction.spec.ts
    - tests/sim.test.ts
    - tests/physics.test.ts
  modified:
    - src/engine/env.ts
    - src/aircraft/da50rg/aircraft.ts
    - src/scenario/schema.ts
    - src/scenario/lint.ts
    - scenarios/engine/eng-oil-temp-green.toon
    - src/ui/bridge.ts
    - src/ui/clock-driver.ts
    - src/ui/session.ts
    - eslint.config.js
    - tests/clock-driver.test.ts
    - tests/scenario-lint.test.ts
    - tests/session.test.ts
    - tests/bridge.test.ts
    - e2e/scenario.spec.ts

key-decisions:
  - "STEP_MS 100 and MAX_RUN_MS 1 800 000 (C-01); simulate and the frame driver are bounded by them"
  - "Oil temperature target = 15 + (20 + 80 * load) / (oil_cooling * 1.3 if cowl open), lag tau 60 s; scenario oil_cooling 0.55"
  - "Event cursor takes a prefix of the remaining log (stops at the first event with t after the step start), identical in Run and simulate"
  - "initSim(setup, start) and simulate input carry the start quantities; SimSetup holds env, baseline, normal and faulted parameters and onsetAt"

patterns-established:
  - "Determinism gate in ESLint: Math.random, Math.exp, Math.pow and ** are errors in src/engine, src/aircraft, src/scenario"
  - "A run is a Run object on the session; the bridge only receives quantities through setQuantities"

requirements-completed: [SCN-06, PNL-04]

coverage:
  - id: D1
    description: "During an ENG OIL TEMP run the oil temperature reading rises while ignored and falls after POWER is reduced and the cowl flap opened, on the built app"
    requirement: "SCN-06"
    verification:
      - kind: e2e
        ref: "e2e/run-reaction.spec.ts#the oil temperature rises while ignored and falls after POWER down and the cowl flap open (desktop-chromium, phone-chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The run clock advances only in whole 100 ms steps and a live recording equals its replay at every step"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/sim.test.ts#a Run over a real store equals simulate at every step from 1 to 300"
        status: pass
      - kind: unit
        ref: "tests/clock-driver.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The oil temperature model is aircraft data; a scenario sets the oil_cooling parameter and lint L12 rejects unknown or out-of-range parameters"
    requirement: "PNL-04"
    verification:
      - kind: unit
        ref: "tests/physics.test.ts#DA50 oil temperature model (Table P1)"
        status: pass
      - kind: unit
        ref: "tests/scenario-lint.test.ts#L12: physics parameters"
        status: pass
      - kind: unit
        ref: "tests/blueprint.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Physics constants (time constant, heat curve, cowl factor, degraded cooling) are plausible training-aid values"
    verification: []
    human_judgment: true
    rationale: "The numbers are an instructor-review item (RESEARCH A1); only their relations (Table P1) are tested, not their realism"

duration: 14min
completed: 2026-10-22
status: complete
---

# Phase 3 Plan 01: Fixed-step simulation tracer Summary

**A pure 100 ms fixed-step simulation with the DA50 oil temperature as aircraft-data lag model, scenario `parameters` checked by lint L12, and a step-based clock driver: the ENG OIL TEMP needle now rises when ignored and falls after POWER down plus cowl flap open.**

## Performance

- **Duration:** about 14 min (22:00 to 22:14 local, estimated; the start time was not captured)
- **Tasks:** 3 (1 tracer, 2 TDD)
- **Files modified:** 22 (8 created)

## Accomplishments

- `src/engine/sim.ts`: `STEP_MS` 100, `MAX_RUN_MS` 1 800 000, `quantise`, `simSetup`, `initSim`, `stepSim` (returns `{ state, fired }`, `fired` empty until plan 04) and `simulate`. Arithmetic is `+ - * /` only; every quantity is clamped to its range and quantised to 0.01 after each step.
- `src/engine/physics.ts`: `definePhysics` with `PhysicsError` for malformed or duplicate parameter ids, non-finite or inverted ranges, an unknown or doubly modelled quantity and a lag `tauMs` below `STEP_MS`.
- `src/engine/run.ts`: `Run` owns the `VirtualClock`, the sim state and a log cursor; `step()` is a no-op while paused.
- `src/aircraft/da50rg/physics.ts`: `DA50RG_PHYSICS`, parameter `oil_cooling` (0.2..1, normal 1), `oil_temp_c` lag with tau 60 s. Target is `15 + (20 + 80 * load) / (oil_cooling * flap)` with flap 1.3 when open; 15 with the engine master off. Cruise anchor 91 (green); ignored case 160.45 (above the red range); handled case 98.9 (green); power-only 124.1 at p50 and 138.6 at p60; cowl-only 126.9.
- Scenario `parameters` (strict, keys match the id pattern, finite numbers, default empty); the blueprint sets `oil_cooling: 0.55`; lint L12 reports `unknown parameter "ID"` and `VALUE is outside MIN..MAX of parameter "ID"` at `parameters.ID`.
- `src/ui`: clock driver steps `run.step()` once per whole 100 ms with a remainder carry (a new run starts with an empty carry); `session.run`; `bridge.setQuantities` (no signal change for equal values) and the `quantities()` test hook.
- ESLint purity block now forbids `Math.random`, `Math.exp`, `Math.pow` and `**` (probe file confirmed all four are reported).
- Tests: `tests/sim.test.ts` (live Run equals `simulate` at every step 1..300, event timing, quantisation and range, parameters and onset, run cap), `tests/physics.test.ts`, L12 cases, the rewritten clock-driver test, a "run (phase 03)" session block and bridge cases. e2e: `run-reaction.spec.ts` plus tolerance-based MFD and chip cases in `scenario.spec.ts`.

## Task Commits

1. **Task 1 (tracer): the oil temperature reacts through a fixed-step simulation** - `d593b3b`
2. **Task 2: stepper, model and lint L12 pinned; purity rule** - `df2ba96`
3. **Task 3: the session's run pinned; scenario e2e with tolerance** - `e17fa54`

Tracer feedback gate: auto/end-of-phase mode, `<verify>` automated only; re-run end to end (typecheck, vitest, validate, Playwright run-reaction on desktop-chromium and phone-chromium) and passed, so expansion continued.

## Verification

- `npx vitest run`: 46 files, 2242 tests pass. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` exit 0.
- `PW_PORT=4333 npx playwright test e2e/run-reaction.spec.ts e2e/scenario.spec.ts e2e/replay.spec.ts e2e/clock.spec.ts --project=desktop-chromium --project=phone-chromium`: 50 passed.
- Acceptance greps: all counts at least 1 (STEP_MS 1, engine/sim in clock-driver 1, physics in env 3, oil_cooling in the blueprint 1, setQuantities 2, parameters in schema 3, L12 2, 'random' 1, "phase 03" 1, quantityOf 5).

## Assumptions taken (defaults C-01 to C-07)

- C-01 to C-07 taken as written. C-05: tau is 60 s (the top of the 20..60 s range) on purpose: with the degraded cooling the golden fall from 128 is about 0.5 degrees per second, so the CAS chip of the existing e2e cases survives several seconds after the golden taps (the cases "Keep going / Escape" and the chip case would otherwise race the falling value). It still meets Table P1 (rise at least 1 degree in 3 s: about 2.4; fall at least 1 degree in 3 s: about 1.5).
- A do-nothing run reaches roughly 137 degrees after 20 s (target 160.45, tau 60 s); plan 05 puts the escalation threshold between that and the 150 maximum.
- Physics constants are an instructor-review item (RESEARCH A1/A8); only their relations are tested.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retract after the simulation already applied an event**
- **Found during:** Task 1 (design of Run)
- **Issue:** A double-tap retract removes an event from the log after Run advanced its cursor past it; the sim controls would keep the retracted value and the next new event would be skipped by the stale cursor.
- **Fix:** `Run` subscribes to `store.onRetract`; for an event below the cursor it rebuilds the sim controls with `deriveState` from the remaining log and moves the cursor back. The plan assigned the full retract rebuild (including quantities) to plan 04; this is only the controls and cursor safety, tested in `tests/sim.test.ts`.
- **Files modified:** src/engine/run.ts, tests/sim.test.ts
- **Commit:** d593b3b, df2ba96

**2. [Rule 3 - Blocking] Test hook and extra files beyond the plan's list**
- **Issue:** The new bridge behaviour needed its own cases and the SVG gauge needs `textContent` (not `innerText`) in e2e.
- **Fix:** Added `setQuantities` cases to `tests/bridge.test.ts` (not in the plan's files list); the run-reaction spec reads the gauge via `textContent`.
- **Commit:** d593b3b, e17fa54

**3. [Plan note] STATE.md**
- The plan's execution notes say STATE.md is not edited by the plan's tasks. No task edited it; the orchestrator's close-out instruction (state tooling after this SUMMARY) is what updates STATE.md and ROADMAP.md.

**Total deviations:** 1 auto-fixed bug (Rule 1), 1 blocking addition (Rule 3), 1 note. **Impact:** none on scope; plan 04 keeps the quantity rebuild by replay.

## Known Limitations (not stubs)

- A retract now restores the controls, but the live quantities do not rebuild by replay; the grade replays the log, so for a few seconds after an undo the screen and a replay may differ. Plan 04 adds the full rebuild (RESEARCH Pitfall 2).
- The free panel shows static values (C-04); a free-panel simulation is a follow-up todo in plan 09.
- `stepSim` returns an always-empty `fired` list and `SimState.flags` stays empty until plan 04.

## Known Stubs

None.

## Threat Flags

None. `parameters` is the only new input from a scenario file; it is covered by the plan's T-03-02 (strict Zod keys, finite values, L12, Map-backed lookup, `Object.hasOwn` reads).

## Self-Check: PASSED

- Created files exist: src/engine/physics.ts, src/engine/sim.ts, src/engine/run.ts, src/aircraft/da50rg/physics.ts, e2e/support/session.ts, e2e/run-reaction.spec.ts, tests/sim.test.ts, tests/physics.test.ts (checked with `[ -f ]`).
- Commits `d593b3b`, `df2ba96`, `e17fa54` are ancestors of HEAD.
