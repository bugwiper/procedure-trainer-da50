---
phase: 02-first-gradable-scenario
plan: 10
subsystem: ui-panel-zoom
tags: [zoom, session-area, footprints, layout-gates, playwright]

requires:
  - phase: 02-first-gradable-scenario
    provides: session plate, region scenario_area and SESSION_LAYOUT (plan 04), session buttons and gesture class action (plan 06)
provides:
  - sessionFootprints (global rectangles of both session views) feeding the Full panel corner chooser
  - shared e2e helper that measures the real footer height and reports session buttons under the Full panel button
  - e2e/session-area.spec.ts and unit gates for plate, region, tap size, corner and the empty pilot legroom
affects: [02-11, 02-12, 02-13]

actuals:
  tokens: 6500
  tasks: 2
  commits: 2

plan_head_before: 703859ff51566f6577b284feb2af9da7619aa059
plan_head_after: a4d7e25032a7dc985beaf061c1fa5c3af28aad6a

tech-stack:
  added: []
  patterns:
    - "Non-registry tap targets join controlFootprints in the corner chooser through a pure footprint function"
    - "Layout gates carry typed-in reference rectangles and a closed exception list"

key-files:
  created:
    - e2e/session-area.spec.ts
  modified:
    - src/ui/panel/session-area.ts
    - src/ui/panel/zoom.ts
    - e2e/support/zoom.ts
    - tests/zoom.test.ts
    - tests/layout.test.ts

key-decisions:
  - "Session buttons are x 35, w 750 (was x 20, w 780), still centred at local x 410: with a 20 unit margin no Full panel corner is free on the desktop profile"
  - "The corner chooser sees the footprints of both views (a conservative superset); the free slot is not a button and is left out"

requirements-completed: [SES-01]

coverage:
  - id: D1
    description: "Zoomed into scenario_area, the Full panel button box intersects no session button and no control on desktop, tablet and phone chromium"
    requirement: SES-01
    verification:
      - kind: e2e
        ref: "e2e/session-area.spec.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "A double click or double tap on NEW SITUATION leaves the full view and records no event; a double tap on the area background zooms in"
    requirement: SES-01
    verification:
      - kind: e2e
        ref: "e2e/session-area.spec.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every session target is at least 44 px high and wide when zoomed, and the chosen Full panel corner overlaps no session footprint, on the phone, tablet and desktop profiles"
    requirement: SES-01
    verification:
      - kind: unit
        ref: "tests/zoom.test.ts#session area zoom (plan 02-10)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Plate session-pad and region scenario_area have the Table Z1 rectangles with 20 unit margins, overlap nothing, and the pilot legroom holds no plate and only the two named under-panel regions"
    requirement: SES-01
    verification:
      - kind: unit
        ref: "tests/layout.test.ts#session plate, region and pilot legroom (plan 02-10)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 10: Session area safe at every zoom level Summary

**The session area now joins the Full panel corner choice through `sessionFootprints`, the buttons are narrowed so the desktop zoom leaves a free corner, a double press on a session button never zooms, and layout and zoom gates pin the plate, the region, the 44 px targets and the empty pilot legroom.**

## Performance

- **Duration:** about 15 min
- **Tasks:** 2 (tracer, then one auto task)
- **Files:** 6 changed (1 created)

## Accomplishments

- `sessionFootprints(regionBounds)` in `src/ui/panel/session-area.ts` returns the global rectangles of NEW SITUATION, CHOOSE SITUATION, the close button and the four choose rows; `attachZoomGestures` adds them to `controlFootprints` when the registry has the region `scenario_area`.
- `backgroundPoint` in `e2e/support/zoom.ts` measures the footer height (28 px at rest, 52 px in a session) instead of the literal; `sessionButtonCoverage` is the sibling of `buttonCoverage` for `[data-session-hit]`.
- `e2e/session-area.spec.ts` (three chromium projects): Full panel button clear of session buttons and controls after zooming into the area; double tap on the area background zooms; `@hooks` double press on NEW SITUATION keeps the full view and an empty event log.
- `tests/zoom.test.ts`: `sessionFootprints` against typed reference rectangles; per profile the zoomed targets are at least 44 px and the chosen corner has zero overlap with the session footprints.
- `tests/layout.test.ts`: plate rectangle and carried region, region 20 units inside the plate, no overlap with other regions or plates, pilot legroom (x 20 to 930, y 760 to 1290) free of plates and of regions except `under_panel_left` and `under_panel_centre`.

## Task Commits

1. Task 1 (tracer): `d9daab8` feat(02-10): Full panel corner avoids the session buttons; helper measures the footer
2. Task 2: `a4d7e25` test(02-10): pin session plate, region, tap sizes, corner and the empty pilot legroom

## Assumptions taken

- The U-13 pilot-legroom rectangle (x 20 to 930, y 760 to 1290) overlaps the top of the under-panel strip; the closed exception list names `under_panel_left` and `under_panel_centre` (both existed before phase 2). Owner to confirm that this is the intended reading of U-13.
- The e2e case "double press on NEW SITUATION while zoomed into the area" was dropped: pressing NEW SITUATION starts a run and a run resets the view to the full panel (UI-SPEC), so a changed view there proves nothing about the double tap. The full-view case carries the contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] No Full panel corner was free of session buttons on the desktop profile**
- **Found during:** Task 2 (the new corner gate)
- **Issue:** At the desktop profile (1280 x 692) the zoomed area view leaves 58.7 px of letterbox on each side, the Full panel button is 112 px wide, and the 20 unit button margin is only 28 px; the top corners hit NEW SITUATION and the close button, the bottom corners hit the fourth choose row. The plan's truth (never covered, every profile) was therefore false with the UI-SPEC button rectangles x 20, w 780.
- **Fix:** Session buttons are x 35, w 750 (symmetric, label anchor 410 unchanged). The right edge 785 clears a top or bottom right button by 0.7 units and the left edge 35 clears the bottom left button by 0.7 units, so every corner is free horizontally on desktop. Heights, rows, plate and region are unchanged; tablet and phone already had free corners.
- **Files modified:** src/ui/panel/session-area.ts
- **Verification:** `npx vitest run` (2102 passed), the three-project chromium run of session-area, zoom, neutral, scenario, art-fit and static-text specs (103 passed).
- **Commit:** a4d7e25

**Total deviations:** 1 auto-fixed (Rule 1, data rectangle narrowed by 30 units). **Impact:** the session buttons are 30 units narrower than the UI-SPEC text (780 to 750); the owner may want the UI-SPEC table updated. No control, plate or region moved.

## Authentication Gates

None.

## Known Stubs

None. CHOOSE SITUATION and the choose view are drawn by plan 12; their footprints are already reserved here.

## Threat Flags

None. T-02-19 is mitigated as planned (footprints in the chooser, a unit case per profile, an e2e hit-box check on three chromium projects); no package was installed (T-02-SC).

## Next Phase Readiness

Plan 12 draws CHOOSE SITUATION and the choose list at the `SESSION_LAYOUT` rectangles; their footprints already count for the Full panel button and their zoomed height is already gated at 44 px. Plan 11 and 13 can rely on `sessionButtonCoverage` when they add buttons in the area.

## Self-Check: PASSED

e2e/session-area.spec.ts exists; commits d9daab8 and a4d7e25 are ancestors of HEAD; the plan commit ledger measures 2 commits; `grep -c sessionFootprints src/ui/panel/zoom.ts` is 2, `grep -c "clientHeight - 28" e2e/support/zoom.ts` is 0, `grep -c session-pad tests/layout.test.ts` is 6, `grep -c scenario_area tests/zoom.test.ts` is 1; vitest, typecheck, lint and format:check exit 0.
