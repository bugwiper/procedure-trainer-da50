---
phase: 01-deployed-playable-panel
plan: 09
subsystem: ui
tags: [preact, svg, viewbox, zoom, pinch, pointer-events, gesture-arbitration, playwright]
status: complete

requires:
  - phase: 01-deployed-playable-panel
    provides: "Registry, regions, VIEW_PROFILES and the widget tap targets (plan 03), Toggle and DetentLever widgets (plans 05, 06)"
provides:
  - "Region zoom on every device: tap or click a region's background and the root svg viewBox zooms to it"
  - "'Full panel' button, double tap or double click, and pinch out to zoom back out"
  - "Pinch (two background pointers) and pan (one background pointer while zoomed, mouse drag too)"
  - "Gesture arbitration: control pointers are never hijacked and view gestures never emit control events"
  - "Pure view geometry (fitScale, zoomRect, pinchRect, panRect, screenToView, targetSide)"
  - "Zoomed tap-size guarantee test over every region of DA50RG"
affects: [01-07 guarded switches and real-device check, 02 scenario UI]

plan_head_before: 78017cab0d522491c396435e487a536f06383e2d
plan_head_after: 4408f7bb4f6af52a906afec56873c661f24bb0c3
commits: 2
actuals:
  tokens: 10000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "viewBox attribute bound to a computed signal (viewBoxAttr), so a gesture updates the attribute without re-rendering the panel"
    - "Gesture layer attaches addEventListener listeners to the svg; widgets keep their own JSX handlers"
    - "Screen to viewBox conversion is computed from the viewRect signal and the svg client box (screenToView), not from getScreenCTM, so consecutive pointermoves never read a stale transform"
    - "Test background points are chosen by maximum clearance from every tap target"

key-files:
  created:
    - src/ui/panel/viewport.ts
    - src/ui/panel/zoom.ts
    - tests/zoom.test.ts
    - e2e/zoom.spec.ts
  modified:
    - src/ui/panel/Panel.tsx
    - src/ui/App.tsx
    - src/ui/stage.css

key-decisions:
  - "pinchRect keeps the current rect aspect and snaps to the full viewBox once the width or height reaches 98 percent, so pinching out of a tall region (pedestal) always ends at the whole panel"
  - "A tap that zooms in from the full view is not the first half of a double tap; only taps made while zoomed count, so a quick second tap does not zoom straight back out"
  - "The gesture layer captures background pointers on the svg so a mouse pan that leaves the svg still ends cleanly"
  - "No mouse-wheel zoom (click to zoom plus Full panel is the smallest mechanism, as planned)"

patterns-established:
  - "zoom.ts never imports the bridge and contains no actuate call (grep gate)"
  - "Control pointers are tracked from pointerdown (closest [data-hit], [data-detent]) to pointerup, pointercancel or lostpointercapture"

requirements-completed: [PNL-09, PNL-06, PNL-05]

duration: 40min
completed: 2026-10-20
---

# Phase 1 Plan 09: Region zoom Summary

**Region zoom by viewBox on all devices: tap or click the background of a region to zoom to it, pinch and pan on touch, Full panel or double tap to zoom out, with arbitration so view gestures never touch a control**

## Performance

- **Duration:** about 40 min
- **Tasks:** 2 (tracer plus gesture layer)
- **Files:** 4 created, 3 modified; nothing under src/aircraft touched

## Accomplishments

- Task 1 (tracer): `viewport.ts`, `zoom.ts` with the background tap path, viewBox bound to `viewBoxAttr` in `Panel.tsx`, the "Full panel" button in `App.tsx`. The tracer verification (typecheck, lint, zoom, toggle and lever specs, six projects) passed before expanding.
- Task 2: pinch, pan, double tap or double click zoom-out and the four arbitration rules in `zoom.ts`. The unit tests cover each geometry function, the per-region zoomed tap-size guarantee on the phone (734x315), tablet and desktop profiles, and the portrait pinch guarantee (200-unit view on 393x631).
- E2E: region tap and click (mouse and touch), desktop mouse flow, per-region full tap size and no overlap with the Full panel button, pinch and one-finger pan (CDP touch on phone-chromium), mouse pan, double tap or click, lever drag while zoomed (with a second finger landing mid-drag on phone-chromium), and the `@hooks` test that gestures leave events and states untouched.
- Final run: `npx playwright test --repeat-each=2` gave 318 passed, 102 skipped (project-specific skips), 0 failed; `npm test` 175 passed; typecheck, lint, prettier clean.

## Task Commits

1. Task 1: region zoom tracer - `a2485ec`
2. Task 2: pinch, pan, double-tap zoom-out and arbitration - `4408f7b`

## Deviations from Plan

### Auto-fixed Issues

None in application code.

### Plan interpretation notes

- `viewport.ts` was written complete in Task 1 (including `pinchRect`, `panRect` and the extra `screenToView` helper) because the tracer needs `screenToView` anyway; Task 2 only added `zoom.ts` gesture code and tests. The RED step for the pure geometry was therefore already green; the gesture e2e cases (pinch, pan, double tap) were confirmed failing before the gesture code was written (6 failures), then green.
- `screenToView` and `viewBoxAttr` are additional exports beyond the plan's interface list.
- Test helper note: the first background-point helper (first free grid cell) picked points on the region frame edge, which WebKit resolved to "outside the region" by sub-pixel rounding. The helper now samples the inner 80 percent of the frame and takes the point with the largest clearance from all tap targets (at least 1.5 px).

## Findings worth knowing

- On the smallest landscape phone the tiny under-panel regions (for example `under_panel_left`, 80x120 units) are nearly filled by their lever's tap targets at full-panel scale: the largest background clearance inside the frame is only about 1.5 px. A real user can still tap the frame's margin, but this is a narrow target to zoom into. Pinch zoom or a different region tap is the fallback; worth checking in the plan 07 real-device pass.
- The "Full panel" button (top right, 44 px) never covers a control in any zoomed region on the tested viewports (asserted in the per-region e2e test).
- WebKit cannot emulate pinch or touch drags in Playwright, so pinch, touch pan and the touch lever-drag arbitration are proven on phone-chromium only; the portrait pinch size is covered by the unit test. Real-device confirmation belongs to plan 07.

## Known Stubs

None.

## Threat Flags

None. T-01-22 (no bridge import and `grep -c actuate src/ui/panel/zoom.ts` prints 0; `@hooks` test asserts unchanged events and states), T-01-23 (control pointers ignore view gestures; lever-drag-while-zoomed tests for touch with a second finger and for mouse) and T-01-24 (Full panel button, double tap and pointercancel handling) are mitigated as planned. No packages were installed (T-01-SC).

## Self-Check: PASSED

- Files exist: src/ui/panel/viewport.ts, src/ui/panel/zoom.ts, tests/zoom.test.ts, e2e/zoom.spec.ts
- Commits found in history: a2485ec, 4408f7b
