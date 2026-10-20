---
phase: 01-deployed-playable-panel
plan: 05
subsystem: panel
tags: [levers, detents, pointer-events, drag-and-snap, svg, playwright, safety]
requires:
  - phase: 01-03
    provides: registry (DetentLeverDef), PanelStore, bridge, ControlWidget, layout gate, empty lever regions
provides:
  - Pure detent geometry (snapToDetent, projectToTrack, detentOffset) with RangeError on non-finite input
  - DetentLever widget: drag along a track and snap on release, tap markers, marker subsets, drag-only variant
  - Seven levers at their real positions: POWER, COWL FLAP, GEAR, FLAPS, ALTERNATE STATIC, EMERGENCY GEAR EXTENSION, ALTERNATE AIR
  - EMERGENCY GEAR EXTENSION that cannot be moved by a tap (PNL-06)
affects: [01-06, 01-07, 01-08, 01-09]
tech-stack:
  added: []
  patterns:
    - Transient drag position in a UI-local signal; only the snapped detent reaches the store
    - Screen to lever-local mapping through the lever group's getScreenCTM inverse (correct under any viewBox or region translate)
    - Drag-only safety variant is a data flag plus the absence of marker targets, not a separate widget
key-files:
  created:
    - src/engine/detents.ts
    - src/aircraft/da50rg/controls/pedestal.ts
    - src/aircraft/da50rg/controls/gear-flaps.ts
    - src/aircraft/da50rg/controls/under-panel.ts
    - src/ui/panel/widgets/DetentLever.tsx
    - tests/detents.test.ts
    - e2e/lever.spec.ts
  modified:
    - src/aircraft/da50rg/panel.ts
    - src/ui/panel/ControlWidget.tsx
key-decisions:
  - "POWER keeps every 5 % step as a snap position but only 0, 50 and 100 % get tap markers (planner choice, data only)"
  - "EMERGENCY GEAR EXTENSION protection is dragOnly: no marker targets, handle taps are no-ops (under 4 CSS px), a release past the track midpoint is the only way to move it"
  - "The grab offset between pointer and handle centre is kept during a drag, so the handle does not jump under the finger"
  - "A detent label beside the track is hidden while the knob covers it; the state text already names that detent"
requirements-completed: [PNL-01, PNL-02, PNL-06, PNL-08]
duration: 25min
completed: 2026-10-20
status: complete
commits: 5
plan_head_before: 931ae93b295d2214c55c62c42cfa46d6e11ec9ee
plan_head_after: cdc40694ef3041feb85c12cdade94d8c6b651da1
actuals:
  tokens: 9200
  tasks: 3
  commits: 5
---

# Phase 1 Plan 05: Levers Summary

All seven DA50 RG levers are operable by mouse or finger at their real positions, with drag-and-snap, tap markers and a drag-only EMERGENCY GEAR EXTENSION that no stray tap can move.

## Tasks

| Task | Name | Commits | Notes |
| ---- | ---- | ------- | ----- |
| 1 | Tracer: POWER by drag-and-snap and marker tap | 8d717fc | typecheck, lint, layout gate, 17 passed / 13 skipped e2e |
| 2 | Detent math test-first; COWL FLAP, GEAR, FLAPS | 039ec0c (RED), ed6974e (GREEN) | 29 passed / 13 skipped e2e; vitest 75 passed |
| 3 | Under-panel levers, drag-only EMERGENCY GEAR EXTENSION | 5c56a74 (RED), cdc4069 (GREEN) | 50 passed / 22 skipped lever e2e; full suite 86 passed / 22 skipped |

## What was built

- `src/engine/detents.ts`: `snapToDetent` (nearest detent, earlier one on an exact tie, clamps by construction, RangeError for NaN or infinite input), `projectToTrack` (clamped 0..1 for both axes), `detentOffset` (exact inverse). Pure, passes the ESLint purity boundary.
- `DetentLever`: primary pointer only, `setPointerCapture`, client point mapped with the group's `getScreenCTM().inverse()`. The drag position lives in a UI-local signal. Release with under 4 CSS px of travel, `pointercancel` and `lostpointercapture` actuate nothing; a real release dispatches `snapToDetent` once and the store answers `unchanged` for the starting detent, so no event is logged. Marker targets (`data-detent="controlId:detentId"`) sit beneath the handle and actuate on a pointerup within 10 CSS px. No `onClick` anywhere (grep prints 0). Touch scrolling relies on `touch-action: none` on the root svg from plan 01.
- Data: `lv.power` (21 detents, 5 % steps, markers p0/p50/p100, default p70) and `lv.cowl_flap` in the pedestal; `lv.gear` (region landing_gear) and `lv.flaps` (region flaps) in the front panel; `lv.alt_static`, `lv.emerg_gear` (dragOnly), `lv.alt_air` in their own under-panel regions. In-flight defaults: GEAR UP, FLAPS UP, COWL FLAP CLOSED, ALTERNATE STATIC and AIR CLOSED, EMERGENCY GEAR EXTENSION NORMAL. No propeller, mixture or ground-idle gate exists (grep backstop clean).
- The EMERGENCY GEAR EXTENSION handle is red with a PULL placard; its labels and state text (NORMAL, EMERGENCY) carry the state, not colour alone.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run format:check`: clean.
- `npm test`: 84 passed, 10 skipped (the remaining skips are layout rows for controls that arrive in plan 07). The lever relations (PITOT/STALL HEAT left of gear, gear left of FLAPS, FLAPS below the MFD right of centre, POWER above COWL FLAP, the three under-panel relations) and all seven reference positions now run and pass.
- `npx playwright test` against the e2e build: 86 passed, 22 skipped across the six projects. Mouse-drag tests run in the two desktop projects, the CDP touch drags run in phone-chromium only; WebKit touch projects skip drags with a note (WebKit cannot emulate touch drags, real-device check in plan 07).
- Screenshot of the built panel checked: levers sit in their regions, labels do not overflow region frames.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Detent label hidden under the knob**
- **Found during:** Task 3, visual check of a screenshot of the built panel
- **Issue:** The label of the current detent was drawn beside the track right under the knob, so it read "OSED" and "RMAL".
- **Fix:** Labels whose detent lies within half a knob (plus 3 units) of the handle are not drawn; the state text already names that detent.
- **Files modified:** src/ui/panel/widgets/DetentLever.tsx
- **Commit:** cdc4069

**2. [Process note] RED commits are module-level failures**
- The RED test commits fail because a module is missing (`gear-flaps`, `under-panel`) so the whole file errors, rather than individual assertions failing. For the RangeError rule, the tracer deliberately shipped `snapToDetent` without the finite check so Task 2 had a genuine behavioural GREEN step; both RED commits precede their GREEN commits in history.

## Notes for later plans

- At a non-marker POWER position the handle square can cover the edge of a marker target (for example the handle at 70 % reaches the p50 target's centre line); taps there hit the handle and do nothing, by the plan's DOM contract. Plan 09's zoomed views give room.
- Vertical labels and placards are sized with `textLength` against the region width; a horizontal lever (not used in phase 1) would need its own label placement.

## Known Stubs

None.

## Threat Flags

None. T-01-13 (only committed detents reach the store; hook test counts events), T-01-14 (pointercancel and lostpointercapture clear the drag) and T-01-21 (dragOnly, no tap targets, no-event hook test) are implemented and covered by e2e.

## Self-Check: PASSED

- All created files exist; commits 8d717fc, 039ec0c, ed6974e, 5c56a74 and cdc4069 are in the branch history.
- No STATE.md or ROADMAP.md changes.
