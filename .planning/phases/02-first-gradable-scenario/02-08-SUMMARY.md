---
phase: 02-first-gradable-scenario
plan: 08
subsystem: annunciations
tags: [cas, pfd, mfd, quantities, lint, preact-signals]

requires:
  - phase: 02-first-gradable-scenario
    provides: quantities and bridge reset (plan 04), lint L4 to L9 (plan 05), session and e2e start helper (plan 06)
provides:
  - CAS rule engine (defineCasRules, active, CasError, MAX_CAS_CHIPS) and the DA50 RG rule table with ENG OIL TEMP
  - AircraftEnv.cas and a read-only bridge.cas signal derived from quantities and control states
  - static CAS chip group on the PFD (CasChips, casChipSlots)
  - MFD OIL TEMP and OIL PRES gauges bound to the quantities, bands built from DA50RG_QUANTITIES
  - lint rule L10 (annunciations equal the rules that fire in the initial state, at most 6)
  - predicateProblems in src/engine/predicates.ts as the single reference check
affects: [02-09, 02-10, 02-13, phase-03-live-values]

actuals:
  tokens: 11600
  tasks: 2
  commits: 2

plan_head_before: 330ec1b330fb4ebfeddb678de1a3e31950ed1ecc
plan_head_after: 8c830e5f10fc74e9e165cb8368b46f65959aafc5

tech-stack:
  added: []
  patterns:
    - "Annunciations are rule data over quantities and controls; the chip is derived, never set by a scenario"
    - "Gauge specs built from quantity data (quantityGauge) so band numbers have one source"
    - "predicateProblems: one reference check shared by scenario lint and the CAS table"

key-files:
  created:
    - src/engine/cas.ts
    - src/aircraft/da50rg/cas.ts
    - src/ui/panel/frames/CasChips.tsx
    - tests/cas.test.ts
  modified:
    - src/engine/env.ts
    - src/engine/predicates.ts
    - src/aircraft/da50rg/aircraft.ts
    - src/ui/bridge.ts
    - src/ui/panel/frames/PfdFrame.tsx
    - src/ui/panel/frames/MfdFrame.tsx
    - src/scenario/lint.ts
    - tests/scenario-lint.test.ts
    - tests/bridge.test.ts
    - tests/avionics.test.ts
    - e2e/scenario.spec.ts

key-decisions:
  - "CasRuleSet exposes controlsRead so the bridge supplies exactly the control states a rule reads; a reset counter signal re-evaluates rules that read the baseline"
  - "PredicateEnv (registry and quantities) is the evaluation environment of predicates and CAS rules, so a rule table can be defined before AircraftEnv exists"
  - "BridgeAircraft.cas is optional, so a bridge without a rule table has no active chip and existing callers compile unchanged"

requirements-completed: [PNL-03, SCN-03]

coverage:
  - id: D1
    description: "The red ENG OIL TEMP chip appears on the PFD (right of centre, inside the region) when the scenario starts, is absent in the free panel and stays after the debrief"
    requirement: PNL-03
    verification:
      - kind: e2e
        ref: "e2e/scenario.spec.ts#@hooks the ENG OIL TEMP chip shows during the run and stays after the debrief"
        status: pass
    human_judgment: false
  - id: D2
    description: "Message, level and trigger come from the aircraft rule table; rule definition rejects malformed rules; ordering and the 125 / 125.1 threshold hold"
    requirement: PNL-03
    verification:
      - kind: unit
        ref: "tests/cas.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Up to 6 chips stack two per row from row 0 upward, right slot first"
    requirement: PNL-03
    verification:
      - kind: unit
        ref: "tests/cas.test.ts#casChipSlots"
        status: pass
    human_judgment: false
  - id: D4
    description: "MFD OIL TEMP and OIL PRES read 128 °C and 5 bar during the run and 15 °C and 0 bar in the free panel, on the Map strip and the Engine page"
    requirement: PNL-03
    verification:
      - kind: e2e
        ref: "e2e/scenario.spec.ts#@hooks the MFD oil gauges read the scenario values and the idle values in the free panel"
        status: pass
    human_judgment: false
  - id: D5
    description: "Validation rejects an unknown CAS id, a missing or extra annunciation and more than 6 active messages; the blueprint passes"
    requirement: SCN-03
    verification:
      - kind: unit
        ref: "tests/scenario-lint.test.ts#L10: annunciations equal the rules that fire at the start"
        status: pass
      - kind: other
        ref: "npm run validate"
        status: pass
    human_judgment: false
  - id: D6
    description: "The chip looks like the real CAS area (position, size, contrast) next to the owner's reference image"
    verification: []
    human_judgment: true
    rationale: "Chip geometry follows the UI-SPEC table; U-09 says to recheck it against the owner's reference image, which no test can judge"

duration: 25min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 08: CAS chip and bound MFD gauges Summary

**A rule table of the aircraft turns the scenario's oil temperature into the red ENG OIL TEMP chip on the PFD, the MFD oil gauges read the scenario quantities with bands taken from the quantity data, and lint L10 rejects annunciations that differ from the rules that fire.**

## Performance

- **Duration:** about 25 min
- **Tasks:** 2 (tracer, then TDD task)
- **Files:** 15 changed (4 created)

## Accomplishments

- `src/engine/cas.ts`: `defineCasRules(specs, env)` validates id, text (1 to 12 upper case characters), level and predicate references (CasError names the rule); `active(ctx, env)` returns warnings first, then cautions, each in table order. `src/aircraft/da50rg/cas.ts` holds the one rule: ENG OIL TEMP, warning, oil temperature above 125 degrees C.
- `AircraftEnv` gained `cas`; `createPanelBridge` derives a read-only `cas` signal from the quantities signal, the signals of the controls the rules read and the store baseline (re-evaluated on reset).
- `CasChips` draws the Table K2 chip group (black block, red or yellow bold size 10 text, no border, no animation, no live region) in the PFD glass content; `casChipSlots` is a pure function pinned for 6 and 7 chips.
- `MfdFrame`: OIL TEMP and OIL PRES specs are built by `quantityGauge` from `DA50RG_QUANTITIES` (range, unit, idle, bands with the colour names mapped to the existing constants); the numeric band literals of those two gauges are gone. Readings follow `bridge.quantities` on the Map strip and the Engine page.
- Lint L10: unknown CAS id located at its list item, listed-but-not-firing and duplicate entries located at the item, firing-but-not-listed and more than 6 active located at the `annunciations` key.
- `predicateProblems` moved into `src/engine/predicates.ts`; scenario lint calls it (one implementation). Predicate functions now take `PredicateEnv` (registry and quantities).

## Task Commits

1. Task 1 (tracer): `c3c54c9` feat(02-08): rule-derived ENG OIL TEMP chip on the PFD
2. Task 2: `8c830e5` feat(02-08): MFD oil gauges read the quantities, lint L10 checks annunciations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Frame test fake bridge lacked the new signals**
- **Found during:** Task 1
- **Issue:** `tests/avionics.test.ts` calls `PfdFrame` and `MfdFrame` with a fake bridge that only had `registry` and `stateOf`; `bridge.cas.value` threw.
- **Fix:** the fake bridge gained `quantities` (idle values) and `cas` (empty); the PFD test-id expectation now includes the always-present `cas-chips` group (empty in the free panel).
- **Files modified:** tests/avionics.test.ts
- **Commit:** c3c54c9

**2. [Plan text, no code impact] "Fix every test or module that builds an AircraftEnv by hand"**
- No test or module builds an `AircraftEnv` by hand (all use `DA50RG_ENV`), so no env fixture change was needed. `BridgeAircraft.cas` is optional so the existing `{ quantities }` bridge tests compile unchanged.

**Total deviations:** 1 auto-fixed (1 blocking test fixture). **Impact:** none on scope.

## Assumptions taken

- The gauge reading format is unchanged: 5 bar reads "5" (integer readings stay whole in `formatReading`), so the e2e case checks "5 BAR" rather than "5.0".
- The empty `cas-chips` group is always in the PFD DOM; it holds no chip in the free panel (`cas-chip` count 0).
- Dated path strings in lint issues use the dotted form (`annunciations.1`) already used by L1 to L9.

## Issues Encountered

None.

## Verification

- `npx vitest run`: 38 files, 2064 tests passed
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (1 scenario file, 0 problems): pass
- `PW_PORT=4328 npx playwright test e2e/scenario.spec.ts e2e/art-fit.spec.ts e2e/static-text.spec.ts e2e/glass.spec.ts --project=desktop-chromium --project=phone-chromium`: 58 passed, 8 skipped (the project-level skips present before this plan)
- Acceptance greps: `ENG OIL TEMP` in src/aircraft/da50rg/cas.ts (1), `CasChips` in PfdFrame (2 lines), `font-size={10}` in CasChips (1), `DA50RG_QUANTITIES` in MfdFrame, tests/cas.test.ts exists. No CAS text or threshold outside src/aircraft/da50rg/cas.ts (grep of src/ui, src/engine, src/scenario).

## Known Stubs

None.

## Threat Flags

None. T-02-14 (annunciation spoofing) is mitigated by the rule-derived chip, the absence of a chip field in the schema and L10; T-02-15 by rendering CAS text as a text child of validated upper-case rule text.

## Next Phase Readiness

Ready for 02-09. Phase 3 can feed live quantity values through `bridge.quantities` and the chip and gauges follow.

## Self-Check: PASSED

- Created files exist: src/engine/cas.ts, src/aircraft/da50rg/cas.ts, src/ui/panel/frames/CasChips.tsx, tests/cas.test.ts
- Commits c3c54c9 and 8c830e5 are ancestors of HEAD
