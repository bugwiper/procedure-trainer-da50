---
phase: 03-reactive-scenarios-and-initial-pack
plan: 02
subsystem: aircraft-physics
tags: [physics, quantities, mfd, gauges, electrical-bus, base-values, preact]

requires:
  - phase: 03-reactive-scenarios-and-initial-pack
    provides: fixed-step simulation (sim.ts), definePhysics, the oil temperature model, bridge.setQuantities (plan 03-01)
provides:
  - fourteen quantities (twelve MFD gauges plus the hidden alt2_amps and battery_pct) with unit, range, base and the AFM 02-05 bands, once, in src/aircraft/da50rg/quantities.ts
  - quantity field base (the cruise reading) and QuantitySet.baseValues, replacing idle and idleValues; band colour none; optional per-quantity scale
  - a model for every quantity (DA50RG_PHYSICS) anchored so that the base is the equilibrium, and the parameter alt1_output
  - the electrical bus (alternator 1 and 2, ESS BUS, ELECT. MASTER, battery, cb.alt1 and cb.alt2)
  - an MFD frame built only from quantityGauge, readouts at the gauge's resolution
affects: [03-04, 03-05, 03-06, 03-07, 03-08, 03-09]

actuals:
  tokens: 21100
  tasks: 3
  commits: 3
plan_head_before: 453c03d68be6185d2bd878722b913e2b16a2fbcf
plan_head_after: 9d74d6c714a6fa9651845006443b0407af3e3271

tech-stack:
  added: []
  patterns:
    - "Anchored models: every lag target is base + effect relative to the cruise load, so the registry defaults are the equilibrium (C-09)"
    - "Gauge ranges, bands and base live in the quantity data; the MFD frame holds no gauge number (T-03-04)"
    - "Per-quantity scale: a slow rate such as the fuel burn declares a finer rounding than the default 0.01"

key-files:
  created: []
  modified:
    - src/engine/quantities.ts
    - src/engine/predicates.ts
    - src/engine/sim.ts
    - src/ui/bridge.ts
    - src/ui/session.ts
    - src/aircraft/da50rg/quantities.ts
    - src/aircraft/da50rg/physics.ts
    - src/ui/panel/frames/MfdFrame.tsx
    - src/ui/panel/frames/ArcGauge.tsx
    - src/ui/panel/frames/BarGauge.tsx
    - tests/physics.test.ts
    - tests/avionics.test.ts
    - tests/scenario-tracer.test.ts
    - tests/predicates.test.ts
    - tests/bridge.test.ts
    - tests/session.test.ts
    - tests/sim.test.ts
    - e2e/run-reaction.spec.ts
    - e2e/scenario.spec.ts

key-decisions:
  - "Quantity base values are the cruise equilibrium: oil temp 91, RPM 2100, load 70, oil pressure 5, coolant 85, gearbox 75, fuel temp 20, fuel pressure 0.4, fuel 20 gal each, 28 V, 30 A (alt1), 10 A (alt2), battery 100"
  - "Every model target is written as base plus an effect relative to the registry-default POWER load (CRUISE_PERCENT), so C-09 holds by construction"
  - "Fuel quantities carry scale 100000 so the real 0.1 gal/min burn survives the per-step rounding"
  - "A dead bus targets one volt below the scale, so the clamp lands exactly on the 20 V minimum"
  - "The helper running() (ENGINE MASTER on) is the one place plan 08 extends with the FUEL selector"

patterns-established:
  - "baseOf(id), bandTop(quantity, band) and running/loadPercent/alt1Delivers/alt2Runs/mainBusSupplied helpers in src/aircraft/da50rg/physics.ts"
  - "Test reference table of gauges (label, quantity, decimals) in tests/avionics.test.ts, independent of src"

requirements-completed: [PNL-04]

coverage:
  - id: D1
    description: "During a run ENGINE MASTER off drops RPM, oil pressure, fuel pressure and Amps on the MFD engine page and the RPM gauge text follows"
    requirement: "PNL-04"
    verification:
      - kind: e2e
        ref: "e2e/run-reaction.spec.ts#switching ENGINE MASTER off drops RPM, oil and fuel pressure and Amps on the engine page (desktop-chromium, phone-chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "At the registry defaults every model's target equals the base, 600 steps leave every quantity except the fuel at its base, and no CAS rule fires at the base values"
    requirement: "PNL-04"
    verification:
      - kind: unit
        ref: "tests/physics.test.ts#DA50 RG models for every quantity (plan 03-02, Table P2, C-09)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every row of Table P2 holds as a relation between two simulations, including the electrical bus (alternators, ESS BUS, ELECT. MASTER, breakers, battery)"
    requirement: "PNL-04"
    verification:
      - kind: unit
        ref: "tests/physics.test.ts#engine speed, load and pressures / temperatures / fuel / electrical bus (D-10)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every MFD gauge reads a named quantity; its scale, band colours and proportions equal the quantity data and its readout prints at the gauge's resolution"
    requirement: "PNL-04"
    verification:
      - kind: unit
        ref: "tests/avionics.test.ts#MFD gauges read quantities (plan 03-02)"
        status: pass
      - kind: e2e
        ref: "e2e/scenario.spec.ts#the MFD oil gauges read the base values in the free panel and the live values in a run (desktop-chromium, phone-chromium)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The cruise base values, the physics constants (time constants, load effects, fuel burn and transfer, battery discharge) are plausible training-aid values"
    verification: []
    human_judgment: true
    rationale: "The numbers are an instructor-review item (RESEARCH A1, A3); only their directions and the equilibrium are tested, not their realism"

duration: 12min
completed: 2026-10-22
status: complete
---

# Phase 3 Plan 02: Engine-page gauges follow the simulation Summary

**Every one of the twelve MFD gauges now reads a simulated quantity with its AFM 02-05 bands from the quantity data, every quantity has a cruise base value that is the equilibrium of its model, and the electrical bus follows the alternators, ESS BUS, ELECT. MASTER and the battery.**

## Performance

- **Duration:** about 12 min (start 20:36 UTC, end 20:47 UTC, plus reading time)
- **Tasks:** 3 (1 tracer, 2 TDD)
- **Files modified:** 19 (none created)

## Accomplishments

- `QuantityDef.idle` became `base` (the reading at the registry defaults, in-flight cruise) and `idleValues()` became `baseValues()`; band colour `none` marks an unmarked scale range; an optional `scale` sets a quantity's rounding. The free panel, `initialQuantities`, the bridge reset and leave-run all start from the base values.
- `src/aircraft/da50rg/quantities.ts` holds the fourteen quantities of Table Q1 with the AFM 02-05 ranges and bands once. `MfdFrame.tsx` builds all twelve gauges with `quantityGauge(label, quantity, decimals)` and keeps no gauge number; the hand-written gauge constants are gone.
- `src/aircraft/da50rg/physics.ts` models every quantity: lags for RPM, load, oil pressure and temperature, coolant, gearbox, fuel temperature, fuel pressure, alternator currents and bus volts; rates for the two fuel tanks (burn proportional to load, FUEL TRANS transfer) and the battery. Every target is base plus an effect relative to the default POWER load, so the base is the equilibrium. New parameter `alt1_output` (0..1, normal 1).
- Electrical bus (D-10, C-13): alternator 1 delivers while running with ALTERNATOR 1 on, `cb.alt1` in, ELECT. MASTER on and `alt1_output` above 0; alternator 2 runs with ALTERNATOR 2 on, `cb.alt2` in and ELECT. MASTER on and feeds the main bus only with ESS BUS on; the battery drains in about 4 minutes without a supply and charges with one; ELECT. MASTER off reads 20 V.
- `ArcGauge` and `BarGauge` take an optional `decimals`; the readout prints with `toFixed` at the gauge's resolution (0 for RPM, Load, temperatures and Amps; 1 for the pressures, Volts and fuel quantities), `formatReading` unchanged without it.
- Tests: `tests/physics.test.ts` gained 27 cases (equilibrium, directions of every Table P2 row, the bus); `tests/avionics.test.ts` gained the gauge binding and readout cases from an independent reference table; e2e: ENGINE MASTER off during a run, and the free-panel base readings read from the data.

## Task Commits

1. **Task 1 (tracer): every MFD gauge reads a simulated quantity; ENGINE MASTER off drops RPM, pressures and Amps** - `1a60d99`
2. **Task 2: the base state is the equilibrium of every model and the Table P2 directions hold** - `04b6913`
3. **Task 3: readouts at the gauge's resolution; MFD binding and base values pinned** - `9d74d6c`

Tracer feedback gate: auto/end-of-phase mode, `<verify>` automated only; re-run end to end (typecheck, vitest, lint, format, validate, Playwright run-reaction on desktop-chromium and phone-chromium) and passed, so expansion continued.

## Verification

- `npx vitest run`: 47 files, 2314 tests pass. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` exit 0.
- `PW_PORT=4333 npx playwright test e2e/scenario.spec.ts e2e/run-reaction.spec.ts e2e/avionics.spec.ts --project=desktop-chromium --project=phone-chromium`: 76 passed. Also glass, replay, clock, ack, static-text, brand, art-fit and session-area: 80 passed, 8 skipped.
- Acceptance greps: `baseValues` in src/engine/quantities.ts 2, `quantityGauge(` in MfdFrame.tsx 13, `unit: '` in quantities.ts 14, `'none'` in src/engine/quantities.ts 2, `decimals` in MfdFrame.tsx 7, "offers the base values" 1.

## Assumptions taken (defaults C-08 to C-13)

- C-08 to C-13 taken as written. Bases are the Table Q1 proposals; the oil base is 91 (the P1-a cruise anchor).
- Constants chosen inside Table P2: time constants RPM 2 s, load 1 s, oil pressure 2 s, coolant 40 s, gearbox 60 s, fuel temperature 60 s, fuel pressure 1 s, alternator currents 1.5 s, bus volts 1 s. Load effects per percent of POWER away from cruise: RPM 20/3 (2300 rpm at POWER 100, inside green), oil pressure 0.01 bar, coolant 0.3 and gearbox 0.3 degrees, fuel temperature 0.15 degrees. Cowl flap open lowers the coolant target by 10 degrees. EMERG FUEL PUMP adds 0.3 bar. Fuel burn 0.1 gal/min at cruise, scaled with load; FUEL TRANS 1 gal/min. Alternator 2 gives 35 A with ESS BUS on. Battery 25 percent per minute down, 10 per minute up. On the battery alone the bus reads 22 + 4 x battery/100 volts. All are an instructor-review item (RESEARCH A1, A3).
- The fuel burn does not depend on the cowl flap or any other control; only the left tank burns (D-10 scope, as the plan table says).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The 0.01 rounding of plan 01 erased the fuel burn**
- **Found during:** Task 1 (model design)
- **Issue:** `stepSim` rounds every quantity to 0.01 after each 100 ms step. The required burn of about 0.1 gal/min ("not compressed") is 0.00017 gal per step, which rounds to zero every step, so the left tank would never decrease and the Task 2 relation "LH fuel decreases while running" could not hold in any model. Compressing the burn enough to survive the rounding would need about 6 gal/min, which empties a tank in 3 minutes.
- **Fix:** `QuantityDef` gained an optional `scale` (rounding to 1/scale, positive integer, default 100 = 0.01); `quantise(value, scale)` and `stepSim` use the quantity's own scale. Only the two fuel quantities declare one (100000); every other quantity rounds exactly as before, so no value of plans 01 and 04 to 08 changes. `defineQuantities` rejects a scale that is not a positive integer.
- **Files modified:** src/engine/quantities.ts, src/engine/sim.ts, src/aircraft/da50rg/quantities.ts, tests/sim.test.ts, tests/scenario-tracer.test.ts
- **Commit:** 1a60d99, 04b6913

**2. [Rule 1 - Bug] Plan 01 cases that assumed one parameter and an unmodelled pressure**
- **Found during:** Task 1
- **Issue:** `tests/sim.test.ts` pinned the normal parameters to `{ oil_cooling: 1 }` and used the oil pressure as the "quantity without a model" and "multiples of 0.01" cases; with `alt1_output` and a model for every quantity both became wrong.
- **Fix:** The parameter case reads `normalParameters()` from the data; the multiples case uses each quantity's scale; the unmodelled-quantity case builds an oil-only physics from the shipped oil model (`tests/sim.test.ts` was not in the plan's file list).
- **Files modified:** tests/sim.test.ts
- **Commit:** 1a60d99

**3. [Rule 1 - Bug] A lag toward the scale minimum stops short**
- **Found during:** Task 2
- **Issue:** The bus voltage with ELECT. MASTER off lags toward 20 V and stalls at 20.05 because the per-step change rounds to zero, so the dead bus did not read the scale minimum the plan names.
- **Fix:** The dead-bus target is one volt below the scale (`DEAD_BUS_UNDERSHOOT_V`); the clamp then lands exactly on 20.
- **Files modified:** src/aircraft/da50rg/physics.ts
- **Commit:** 04b6913

**4. [Rule 3 - Blocking] Alternator current time constant**
- **Found during:** Task 1 (e2e)
- **Issue:** The plan says "tau about 2 s" for the alternator current and the e2e needs Amps below 1 within 8 s; 2 s needs about 6.8 s from 30 A, too close to the limit.
- **Fix:** Tau 1.5 s (about 5.1 s to below 1 A).
- **Files modified:** src/aircraft/da50rg/physics.ts
- **Commit:** 1a60d99

**Total deviations:** 2 auto-fixed bugs (Rule 1), 2 blocking fixes (Rule 3). **Impact:** deviation 1 adds one optional field and one default argument to the engine; behaviour of all existing quantities is unchanged.

## Known Limitations (not stubs)

- The 0.01 rounding makes slow lags stop a small distance from the target (about 0.1 for the fast ones, 2 to 6 degrees for the slow thermal ones). The base equilibria are exact, and engine-off values read a fraction of the running value; tests use "below a quarter of the running value" rather than exact zero.
- A retract still does not rebuild the live quantities by replay (plan 04), and the free panel stays static (no simulation outside a run).
- Only the left tank burns fuel; the fuel selector arrives with plans 08 and 10.

## Known Stubs

None.

## Threat Flags

None. T-03-04 (two sources for gauge bands): bands now live only in `src/aircraft/da50rg/quantities.ts` and `tests/avionics.test.ts` compares every gauge to it. T-03-05 (false annunciations on the free panel): `tests/physics.test.ts` asserts no CAS rule fires at the base values. T-03-SC: no package installed.

## Self-Check: PASSED

- Modified files exist (checked with `[ -f ]`): src/aircraft/da50rg/physics.ts, src/aircraft/da50rg/quantities.ts, src/ui/panel/frames/MfdFrame.tsx, src/ui/panel/frames/ArcGauge.tsx, src/ui/panel/frames/BarGauge.tsx, tests/physics.test.ts, tests/avionics.test.ts, e2e/run-reaction.spec.ts.
- Commits `1a60d99`, `04b6913`, `9d74d6c` are ancestors of HEAD.
