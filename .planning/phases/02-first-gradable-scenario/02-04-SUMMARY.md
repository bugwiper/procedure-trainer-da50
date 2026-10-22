---
phase: 02-first-gradable-scenario
plan: 04
subsystem: panel-state
tags: [store-baseline, reset, frozen-events, bridge-quantities, time-source, session-plate]

requires:
  - phase: 02-first-gradable-scenario
    provides: QuantitySet, AircraftEnv, DA50RG_QUANTITIES (plan 01)
provides:
  - PanelStore.reset, onReset, baseline(); deriveState with a baseline; retract from the baseline
  - frozen events and a fresh events() array (WR-07)
  - bridge.reset, bridge.quantities, bridge.setTimeSource, BridgeAircraft
  - plate session-pad, region scenario_area (31 regions) and SESSION_LAYOUT
affects: [02-06, 02-08, 02-09, 02-10, 02-11, 02-12]

actuals:
  tokens: 6900
  tasks: 2
  commits: 2

plan_head_before: 572df73c33f239514b06b55b8782123819437cb2
plan_head_after: f2263c19343513704b53c984d1d84459427a0eea

tech-stack:
  added: []
  patterns:
    - "A scenario baseline is stored beside the log and never dispatched; every rebuild is registry defaults, then baseline, then events"
    - "Region-local layout data for a UI area lives in a pure module (session-area.ts), widgets come later"

key-files:
  created:
    - src/ui/panel/session-area.ts
  modified:
    - src/engine/store.ts
    - src/ui/bridge.ts
    - tests/store.test.ts
    - tests/bridge.test.ts
    - src/aircraft/da50rg/panel.ts
    - src/aircraft/da50rg/plates.ts
    - src/ui/panel/PanelShell.tsx
    - tests/layout-reference.ts
    - tests/layout.test.ts
    - tests/panel-review.test.ts
    - README.md
    - docs/PANEL-REVIEW.md

key-decisions:
  - "A baseline is validated in full before anything changes; an unknown id or illegal state throws RangeError naming the id"
  - "bridge.reset refreshes every control signal in an onReset listener, so derived lamps follow without a special case"
  - "The session area is the one real-geometry exception: trainer content in the co-pilot legroom, no registry controls"

requirements-completed: [SCN-03, SES-01]

coverage:
  - id: D1
    description: "A scenario baseline reaches every control signal and derived lamp without an event, quantities are idle values overlaid with the given ones, and a retract rebuilds from the baseline (POWER stays p75)"
    requirement: SCN-03
    verification:
      - kind: unit
        ref: "tests/bridge.test.ts#bridge reset"
        status: pass
      - kind: unit
        ref: "tests/store.test.ts#baseline and reset"
        status: pass
    human_judgment: false
  - id: D2
    description: "Recorded events are frozen at creation and events() returns a new array; the time source stamps events with a virtual clock and null restores performance.now"
    requirement: SCN-03
    verification:
      - kind: unit
        ref: "tests/store.test.ts#frozen events (WR-07)"
        status: pass
      - kind: unit
        ref: "tests/bridge.test.ts#bridge time source"
        status: pass
    human_judgment: false
  - id: D3
    description: "The session plate and region sit in the co-pilot legroom with the UI-SPEC rectangles; layout, art-fit, static-text, zoom, neutral and inventory gates stay green on desktop and phone"
    requirement: SES-01
    verification:
      - kind: unit
        ref: "tests/layout.test.ts#avionics unit regions and plates (plan 06)"
        status: pass
      - kind: e2e
        ref: "e2e/layout.spec.ts, art-fit, static-text, zoom, neutral, inventory on desktop-chromium and phone-chromium (84 passed, 10 skipped)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Where the session area sits and how it reads next to the panel"
    requirement: SES-01
    verification: []
    human_judgment: true
    rationale: "The region is invisible geometry on a dark plate until plan 06 draws the buttons; placement is the UI-SPEC rectangle, the look is judged with the buttons"

duration: 5min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 04: Baseline reset, bridge quantities and the session plate Summary

**The store applies a scenario baseline without a single event and keeps it through retracts, the bridge carries quantities and an injectable time source, and the session plate with its region scenario_area and SESSION_LAYOUT sits in the co-pilot legroom.**

## Performance

- **Duration:** about 5 min
- **Tasks:** 2 of 2 (Task 1 tracer, Task 2 auto)
- **Files:** 13 changed (1 created)

## Accomplishments

- `src/engine/store.ts`: `deriveState(registry, events, baseline = {})`; `reset` validates every entry against the registry, then sets the baseline, empties the log, drops the consumed watermark to -1, rebuilds the state and calls the reset listeners (no event, no dispatch listener); `onReset`, `baseline()` (frozen copy); `retract` rebuilds from the baseline; every event frozen at creation, `events()` a new array.
- `src/ui/bridge.ts`: `createPanelBridge(registry, indicators?, aircraft?)`, `bridge.quantities` (idle values at start, empty without an aircraft), `bridge.reset(controls, quantities?)`, `bridge.setTimeSource(now | null)`. The test hook is unchanged.
- Plate `session-pad` and region `scenario_area` (SESSION, 820 x 480 at 1300, 780) in the legroom, fill `#101215` in PLATE_FILLS; `src/ui/panel/session-area.ts` with `SESSION_LAYOUT` (main and choose views, label rule) and a small `labelBaseline` helper.
- Gates: `scenario_area` added to `ALL_REGION_IDS`, plate count 14 with a `session-pad` carrier check, the "widening is right-only" case allows the session area, README count 31 regions, the panel-review README case now derives its counts from the reference tables.

## Task Commits

1. Task 1 (tracer): `431e2fd` feat(02-04): scenario baseline, reset, quantities and time source in store and bridge
2. Task 2: `f2263c1` feat(02-04): session plate and region scenario_area in the co-pilot legroom

Task 1 was run test-first: the new store and bridge cases failed (14 failures) before the members existed, then passed. The tracer verify (store and bridge cases, full vitest, typecheck) was green before Task 2 started.

## Verification

- `npx vitest run`: 30 files, 1935 tests passed
- `npm run typecheck`, `npm run lint`, `npm run format:check`: exit 0
- `PW_PORT=4324 npx playwright test e2e/layout.spec.ts e2e/art-fit.spec.ts e2e/static-text.spec.ts e2e/zoom.spec.ts e2e/neutral.spec.ts e2e/inventory.spec.ts --project=desktop-chromium --project=phone-chromium`: 84 passed, 10 skipped (project-specific skips), 0 failed
- Acceptance greps: `onReset` in store.ts 1, `setTimeSource` in bridge.ts 2, `Object.freeze` in store.ts 4, `scenario_area` in panel.ts 1, `session-pad` in plates.ts 1, `in 31 regions` in README.md 1, `SESSION_LAYOUT` in session-area.ts 3.

## Assumptions taken

- `reset` with an unknown id or an illegal state names the id in the RangeError text; the bridge passes the error through unchanged.
- `bridge.reset` with no quantities argument returns the quantities to idle (not to the previous values).
- `labelBaseline` was added to session-area.ts as a pure helper for the label rule; the data stays the contract.
- The free slot of the main view is given as the rectangle y 300..440 (h 140).
- Executed sequentially on the phase branch; STATE.md and ROADMAP.md updated through the state handlers as the dispatch directed (the plan text says STATE.md is not edited).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] panel-review gates needed the new region named and a literal derived**
- **Found during:** Task 2
- **Issue:** `tests/panel-review.test.ts` requires every id in `ALL_REGION_IDS` to appear in backticks in `docs/PANEL-REVIEW.md`, and one case held the literal "in 30 regions".
- **Fix:** Added a short "Session area (region `scenario_area`, phase 02)" section to `docs/PANEL-REVIEW.md`; the README case now builds its sentence from the reference tables like the neighbouring case.
- **Files modified:** docs/PANEL-REVIEW.md, tests/panel-review.test.ts
- **Commit:** f2263c1

**2. [Rule 3 - Blocking] plate-count gate**
- **Found during:** Task 2
- **Issue:** `tests/layout.test.ts` asserted exactly 13 plates.
- **Fix:** 14 plates and a carrier assertion for `session-pad`.
- **Files modified:** tests/layout.test.ts
- **Commit:** f2263c1

**Total deviations:** 2 auto-fixed (both Rule 3, test gates and the review document that follow the tables). **Impact:** none on scope; docs/PANEL-REVIEW.md is outside the plan's file list.

## Authentication Gates

None.

## Known Stubs

None. The region scenario_area is deliberately empty geometry until plan 06 draws the buttons from SESSION_LAYOUT (stated in the plan).

## Threat Flags

None. T-02-06 (retract after a baseline) and T-02-07 (mutable events) are mitigated and tested; no package was installed (T-02-SC).

## Next Phase Readiness

Plan 06 can call `bridge.reset` with the scenario baseline and quantities, drive event times through `bridge.setTimeSource` with the virtual clock, and draw the session buttons from `SESSION_LAYOUT` inside `scenario_area`. Plan 08 binds the MFD gauges to `bridge.quantities`.

## Self-Check: PASSED

`src/ui/panel/session-area.ts` exists; commits 431e2fd and f2263c1 are ancestors of HEAD; the plan commit ledger measures 2 commits.
