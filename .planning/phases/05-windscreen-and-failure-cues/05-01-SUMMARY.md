---
phase: 05-windscreen-and-failure-cues
plan: 01
subsystem: ui
tags: [windscreen, extent, cues, scenes, lint-l22, flames]
requires:
  - phase: 03-physics
    provides: fire_intensity quantity and the Engine Fire simulation
provides:
  - the registry extent (the panel space grown upward by WINDSCREEN_H 440), full view, zoom, pinch and pan clamp to it
  - the cue table and CueSet (levels 0 to 1 from quantities, CUE_VISIBLE_LEVEL 0.1), bridge.cueLevels
  - the windscreen layer (canopy frame, strut, overhead strip, cowl, blade, three scenes) and the flames cue
  - the optional scenario field scene, SceneSet in aircraft data, lint L22, session.scene, the ?scene flag
affects: [05-02 smoke, ice and onset cues, 05-03 audio and cloud scene, Phase 5.1 scenes in scenarios]
status: complete
actuals:
  tokens: 17000
  tasks: 2
  commits: 2
plan_head_before: d34b66fbe92804a3873da218dd66521c1f68671e
plan_head_after: 7b11227c4d6f063bda348b4b84c8f7e4d911bf20
tech-stack:
  added: []
  patterns: [extent as the zoom space with the viewBox kept as the instrument space, cue layers by cue id over a level, scene record typed by the aircraft scene ids]
key-files:
  created: [src/engine/cues.ts, src/engine/scenes.ts, src/aircraft/da50rg/cues.ts, src/aircraft/da50rg/scenes.ts, src/ui/panel/windscreen/Windscreen.tsx, src/ui/panel/windscreen/frame.tsx, src/ui/panel/windscreen/scenes.tsx, src/ui/panel/windscreen/cue-layers.tsx, src/ui/panel/windscreen/geometry.ts, tests/cues.test.ts, tests/windscreen.test.ts, e2e/windscreen.spec.ts]
  modified: [src/engine/registry.ts, src/engine/env.ts, src/aircraft/da50rg/panel.ts, src/aircraft/da50rg/aircraft.ts, src/ui/panel/viewport.ts, src/ui/panel/zoom.ts, src/ui/panel/Panel.tsx, src/ui/bridge.ts, src/ui/session.ts, src/ui/App.tsx, src/ui/stage.css, src/scenario/schema.ts, src/scenario/lint.ts, scenarios/engine/*.toon, scenarios/electrical/*.toon, tests/layout-reference.ts, tests/layout.test.ts, tests/zoom.test.ts, tests/scenario-lint.test.ts, tests/session.test.ts, e2e/support/zoom.ts, README.md, docs/PANEL-REVIEW.md]
key-decisions:
  - "W-01 to W-09 of the plan stand (owner confirmed W-01, W-02 and the pilot side)."
  - "Flames stand right of the strut (x 1300), not on the cowl centre: the strut and the glare shield hide the centre."
requirements-completed: []
completed: 2026-10-27
---

# Phase 5 Plan 01: Windscreen foundation and the flames cue Summary

The panel space now grows upward by a windscreen (extent 2180 x 1740 from y -440, instrument space unchanged), the layer draws the canopy frame, strut, overhead strip, cowl, a blade at 11 o'clock and one of three scenes, and Engine Fire shows flames and smoke from `fire_intensity` on all three levels. A scenario names its scene in data (L22).

## What changed

- Task 1 (tracer, 8c2b7b9): extent in the registry, viewport and zoom; cue table and levels; bridge `cueLevels`; plain windscreen with cowl and flames; reference tables (`WINDSCREEN_REFERENCE`, `PANEL_EXTENT`, region `windscreen`), layout, zoom, README, PANEL-REVIEW and e2e helpers take the extent.
- Task 2 (7b11227): frame and scenes (`parked`, `takeoff_roll`, `cruise`), `scene` in schema and lint L22, `session.scene` (briefing, run, free-panel flag), the four shipped scenarios say `scene: cruise`.

## Checks

- Full vitest (56 files, 3039 tests, cache cleared), typecheck, lint, format:check, `npm run validate` (4 files) pass; `tests/fixtures/recordings.json` unchanged.
- Playwright, all four chromium projects (desktop, phone, tablet, phone-portrait), the whole suite: 1056 passed, 0 failed. The geometry and plan specs (windscreen, static-text, art-fit, brand, scenario, zoom, layout, session-area, smoke, press, neutral, avionics, fire-controls) also on desktop-webkit, phone-webkit and tablet-webkit: 912 passed, 0 failed.
- Full-view scale: desktop 0.398 (was 0.532), tablet 0.361 (0.433), phone landscape 0.181 (0.242), phone portrait 0.180 (unchanged, width-bound; the picture is taller).
- The panel svg element count in the budget test is 2264 of 2500.

## Deviations from Plan

- [Rule 3 - Blocking] `e2e/support/zoom.ts` `backgroundPoint`: the smallest region (`engine_controls`) has at best a 1.53 px clearance on the phone at the new full-view scale, below the 1.5 px grid-miss limit. The minimum clearance is now 1 px and the grid 0.25 px; the pick is still the point with the most clearance.
- Flames moved from the strut axis (x 1130) to x 1300 after a screenshot showed them hidden behind the strut; smoke drifts to the right.
- Reduced-motion CSS and the flicker live in `stage.css`; the panel-review sentence for the region count is the README one (34 regions).

## Known Stubs

None.

## Threat Flags

None. The `?scene` flag reads a known id only (anything else falls back to the default).

## Self-Check: PASSED

Files and both commits (8c2b7b9, 7b11227) exist.
