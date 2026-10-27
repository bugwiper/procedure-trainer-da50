---
phase: 05-windscreen-and-failure-cues
plan: 02
subsystem: simulation
tags: [cues, lint-l23, lint-l24, cabin-smoke, windscreen-ice, windshield-spray, prop-stopped, oil-streaks, preview-flags]
requires:
  - phase: 05-windscreen-and-failure-cues
    provides: cue table and levels, the windscreen layer, the scene field, the Engine Fire flames
provides:
  - scenario field onset.cues with lint L23 (declared cue shows within the bound in a do-nothing Realistic run, at both window ends) and L24 (an onset needs an annunciation or a cue)
  - hidden quantities smoke_density, ice_pilot, ice_copilot, oil_film; parameters smoke_source, ice_accretion, oil_leak; cues cabin_smoke, ice_pilot_side, ice_copilot_side, prop_stopped, oil_streaks
  - reaction windshield_spray (flag deice.windshield_spray, exported as WINDSHIELD_SPRAY_ACTIVE)
  - CabinSmoke overlay, Ice layer with the spray, stopped blade, OilStreaks layer
  - preview flags ?q=id:value,... and ?flags=name,... for the free panel
affects: [05-03 audio and cloud scene, Phase 5.1 scenarios that use smoke, ice or oil]
status: complete
actuals:
  tokens: 26000
  tasks: 3
  commits: 3
plan_head_before: dcb7debbf0020678d02aa8c16d5ed4d8c7a11413
plan_head_after: 18f42e75842dcf3753f2c09b0bf9351a8846494e
tech-stack:
  added: []
  patterns: [cue declared in scenario data and proven by a do-nothing simulation, effects as hidden quantities behind a parameter, fixed mulberry32 tables at module load for art, preview flags parsed by a pure module]
key-files:
  created: [src/ui/preview.ts, src/ui/panel/windscreen/CabinSmoke.tsx, src/ui/panel/windscreen/Ice.tsx, src/ui/panel/windscreen/OilStreaks.tsx, tests/windscreen-physics.test.ts, tests/preview.test.ts, tests/fixtures/scenarios/smoke-onset.toon, e2e/cues.spec.ts]
  modified: [src/scenario/schema.ts, src/scenario/lint.ts, src/aircraft/da50rg/quantities.ts, src/aircraft/da50rg/physics.ts, src/aircraft/da50rg/cues.ts, src/aircraft/da50rg/indicators.ts, src/ui/App.tsx, src/ui/panel/Panel.tsx, src/ui/panel/windscreen/Windscreen.tsx, src/ui/panel/windscreen/frame.tsx, src/ui/stage.css, scenarios/engine/eng-fire-in-flight.toon, tests/fixtures/scenarios/fire-ordered.toon, tests/cues.test.ts, tests/windscreen.test.ts, tests/scenario-lint.test.ts, tests/scenario-parse.test.ts, .claude/CLAUDE.md]
key-decisions:
  - "C-01 to C-07 of the plan stand; the owner answers of 2026-10-27 override C-04 and C-05 (no wipers, spray streaks run upward, pilot-side ice gone directly, warm air very slow)."
  - "Spray clear rate 6000 per minute (full clear in about 1 s) is the 'directly'; warm-air melt is 6 per minute (plan: 12)."
requirements-completed: [PNL-18, SCN-12]
completed: 2026-10-27
---

# Phase 5 Plan 02: Simulation-driven effects and the declared onset cue Summary

An onset now declares its visible cues in scenario data (`onset.cues`) and lint proves them with a do-nothing Realistic run; Engine Fire declares `flames`. Cabin smoke, windscreen ice with warm air and the WIND SHIELD spray, the stopped propeller and the oil streaks follow the simulation and can be looked at through preview flags.

## What changed

- Task 1 (tracer, 755a377): schema `onset.cues` (at most four ids), L23 (unknown or duplicate id, visible at the Realistic start, never visible, visible later than the bound at either window end) and L24, smoke from `smoke_density` behind `smoke_source` (lag 15 s, no ventilation effect), the `CabinSmoke` overlay (never takes a press, clipped to the panel space), `?q=` and `?flags=`. Fixture `smoke-onset.toon` under `tests/fixtures/scenarios` (no pack lists it).
- Task 2 (bd74112): `ice_pilot` and `ice_copilot` (+40 per minute times `ice_accretion`; warm air = DIRECTION defrost with TEMPERATURE t75 or warm, 6 per minute), reaction `windshield_spray` (10 s, any de-ice mode, a second press ignored): pilot (left) side clears within about a second and does not re-ice while the spray runs, the co-pilot side is untouched; `Ice` layer (veil, frost, crystals from a fixed table, upward streaks only on the pilot half while the flag is set). The deferred-note about the spray is removed from `physics.ts`, `indicators.ts` and `.claude/CLAUDE.md`.
- Task 3 (18f42e7), done, not cut: cue `prop_stopped` (rpm 600 down to 0; the blur wedge fades, a crisp blade shows, so ENGINE MASTER off is visible) and `oil_film` with `oil_leak` (+30 per minute while the engine runs, never decays) with the `OilStreaks` layer. No todo file was needed.

## Checks

- Full vitest (58 files, 3122 tests, cache cleared), typecheck, lint, format:check, `npm run validate` (4 files) pass; `tests/fixtures/recordings.json` unchanged.
- Playwright (cues, windscreen, scenario, static-text, art-fit, zoom, layout, session-area, breaker): desktop, phone, tablet, phone-portrait on chromium 337 passed, 0 failed; desktop-webkit and phone-webkit 167 passed, 0 failed.
- Panel svg element count on the free panel: 2274 of 2500 (was 2264, the ice defs); with every cue and the spray on at once 2321.

## Owner review

`?q=smoke_density:100`, `?q=ice_pilot:80,ice_copilot:80`, add `&flags=deice.windshield_spray` for the spray, `?q=rpm:0` (stopped propeller), `?q=oil_film:40`; combinable, for example `?q=smoke_density:100,fire_intensity:60`. All values are instructor-review values.

## Deviations from Plan

- Warm air melts 6 per minute, not 12, and the spray clears 6000 per minute (about 1 s) instead of 600: both follow the owner answers of 2026-10-27 (very slow melt, directly cleared).
- Spray streaks run upward over the pilot half (plan: down); there are no wipers.
- [Rule 1 - Bug] The new hidden quantities use a finer quantisation scale (1e-4): at the default 0.01 the smoke lag stalled at 99.26 instead of reaching 100.
- [Rule 3 - Blocking] Existing tests expected an onset without `cues` and an inner z-order without the ice layer; updated. `fire-ordered.toon` got `cues[1]: flames` so it still passes L24.
- The ice layer sits between the cowl and the flames (plan: between scene and frame); the flames stay readable over frost.

## Known Stubs

None. No shipped scenario uses smoke, ice or oil yet (Phase 5.1); only the preview flags and the fixture exercise them.

## Threat Flags

None. `?q=` and `?flags=` only accept known ids with in-range numbers and known flag names; anything else is ignored.

## Self-Check: PASSED

Files and the three commits (755a377, bd74112, 18f42e7) exist.
