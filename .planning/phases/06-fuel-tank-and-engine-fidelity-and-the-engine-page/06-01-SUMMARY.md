---
phase: 06-fuel-tank-and-engine-fidelity-and-the-engine-page
plan: 01
subsystem: fuel model
tags: [physics, fuel, cas, advisory, calculator]
requires: []
provides: [fuel tank topology, FUEL TRANS advisory, fuel temperatures, fuelCalculator]
affects: [06-02 engine page]
key-files:
  created:
    - src/aircraft/da50rg/fuel-calculator.ts
    - tests/fuel-model.test.ts
    - tests/fuel-calculator.test.ts
    - e2e/fuel.spec.ts
  modified:
    - src/engine/cas.ts
    - src/aircraft/da50rg/{quantities,physics,cas}.ts
    - src/ui/panel/frames/{CasChips,MfdFrame}.tsx
    - docs/{GRADING,PANEL-REVIEW}.md
status: complete
commits: 3
plan_head_before: e4667305c5244a47882491d750b1079aa21f997b
plan_head_after: 8154b626a2c6b7f6733c5445b6762f17d0956a61
actuals:
  tokens: 23000
  tasks: 3
  commits: 3
metrics:
  completed: 2026-10-28
---

# Phase 6 Plan 01: Fuel model Summary

Two 26 gal tanks drawn by the FUEL selector with supply, burn and return flow into the left tank, the FUEL TRANS pump at 60 gal/h with a white advisory chip, fuel temperatures from the parameters `oat_c` and `fuel_temp_delta_c`, fuel flow, gallons used and a pure calculator, all with `+ - * /` only.

## What was built

- **Task 1 (tracer, ce06d67):** CAS level `advisory` (white, after cautions, no tone), tank range 0 to 26 with one shared band table, hidden `fuel_trans_active` (one step behind the transfer rate), rule `fuel_trans` as a band check. The transfer runs while the knob is on, the right tank is above 0 and the left below 26.
- **Task 2 (6cd22b2):** selector picks the tank, return into the left tank while it has room, starvation of an empty drawn tank (engine stops, comes back at once on the other tank), `fuel_flow_gph`, `fuel_used_gal`, `fuel_temp_lh_c` and `fuel_temp_rh_c` (lag 60 s, clamped to -25 and +60), parameters `oat_c` and `fuel_temp_delta_c`; `AMBIENT_C` is gone. A live run equals its replay at every step.
- **Task 3 (8154b62):** `fuelCalculator` and `formatEndurance`; GRADING.md section "Fuel model (phase 6)", PANEL-REVIEW.md section "Phase 6: owner review" (6 items).

## Deviations from Plan

1. **[Rule 1 - Bug] Fuel temperature quantities carry a finer scale (1e-6).** A 60 s lag step of a degree-sized gap is below 0.005, which the default scale rounds away; the temperature would stall up to 3 degrees short of the target (an OAT of -5 would not settle at 3 and 0). Files: `quantities.ts`.
2. **[Rule 3 - Blocking] The `fuel_flow_gph` target is quantised to the reading's resolution.** The plan base 11.23 is not the exact line value (11.2333); the existing C-09 anchor test needs target equal to base. The stepper quantises the result anyway, so the displayed value is unchanged. File: `physics.ts`.
3. **[Rule 3 - Blocking] `tests/panel-review.test.ts` pinned Phase 5.1 as the last section of PANEL-REVIEW.md;** it now pins Phase 6 as last.
4. **Existing tests adjusted for the new parameters and ids:** the Table P1 helper passes the normal parameters (now including `oat_c`), "EMERGENCY reads like NORMAL" now excludes the two tanks, C-09 skips `fuel_used_gal`.
5. `FUEL_SUPPLY_GPH`, `FUEL_TEMP_LH_OFFSET_C` and `FUEL_TRANSFER_PER_MIN` are exported from `physics.ts` so the tests compute expectations from them.

## Verification

Cleared Vitest cache: 65 files, 3404 tests passed. typecheck, lint, format:check exit 0; `npm run validate`: 10 scenario files, 0 problems. `tests/fixtures/recordings.json` unchanged. Playwright (desktop-chromium and phone-chromium: fuel, glass, electrical-box, gauge-alert, run-reaction): 50 passed, 4 skipped, 0 failed.

## Known Stubs

None. Not built on purpose: leak, relight, refuelling and the RST Fuel softkey.

## Self-Check: PASSED

Created files exist, commits ce06d67, 6cd22b2 and 8154b62 are on the branch.
