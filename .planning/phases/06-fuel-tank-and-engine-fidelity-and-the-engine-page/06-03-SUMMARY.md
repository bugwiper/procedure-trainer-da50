---
phase: 06-fuel-tank-and-engine-fidelity-and-the-engine-page
plan: 03
subsystem: PFD and flight profile
tags: [pfd, flight-profile, scenario-format, physics, horizon]
requires: [06-02, 06-02b, 06-02c]
provides: [scenario profile section, lint L25, flight regimes, live PFD horizon and tapes, VS box]
affects: [06-04, phase 7 emergency landing]
key-files:
  created:
    - tests/flight-profile.test.ts
    - tests/pfd-live.test.ts
    - e2e/pfd.spec.ts
  modified:
    - src/scenario/{schema,lint}.ts
    - src/engine/{sim,physics}.ts
    - src/aircraft/da50rg/{quantities,physics,avionics}.ts
    - src/ui/panel/frames/PfdFrame.tsx
    - scenarios/{engine,electrical,fire,icing}/*.toon (all ten files)
    - tests/{scenario-lint,sim,blueprint,avionics,fuel-model,fire-scenarios,scenario-tracer,session}.test.ts
    - e2e/glass.spec.ts
    - docs/{GRADING,PANEL-REVIEW}.md
status: complete
commits: 3
plan_head_before: 730df3ac0770051b598917517275895465317ee1
plan_head_after: ea0c599d1b0dae5d18a97dcba8e73353d9f45065
actuals:
  tokens: 30000
  tasks: 3
  commits: 3
metrics:
  completed: 2026-10-29
---

# Phase 6 Plan 03: live PFD with scripted flight profiles

A scenario scripts its flight in a new optional `profile` section (parameters in force from the first second, lint L25), and the PFD draws simulated airspeed, altitude, vertical speed, pitch and bank: a rolling horizon with a pitch ladder, sliding speed and altitude tapes and a VS readout. The free panel stays static (140 kt, 1400 ft, 0 fpm, level).

## What was built

- **Task 1 (tracer, 682cad8):** `profile` in the schema, `ParameterDef.profile`, `simSetup` layers normal, profile, parameters, onset parameters (no profile gives the identical old sets), lint L25, hidden quantities `altitude_ft` and `vertical_speed_fpm`, parameters `flight_vs_fpm` and `terrain_ft`, the flag on `oat_c` and `fuel_temp_delta_c`, lag and terrain-floored rate models, altitude tape and readout, VS box under the barometer box, T/O FIRE NO ABORT climbing from 1450 ft.
- **Task 2 (0f984fa):** regimes ground, powered and engine stopped, parameters `flight_speed_kt`, `flight_bank_deg`, `glide_speed_kt`, `glide_vs_fpm`, quantities `pitch_deg` and `bank_deg`, the airspeed as a 5 s lag (rate 50 on the ground keeps the follow-within-one-step), the horizon group (sky, ground, line, ladder to 30 degrees) shifted and rotated and clipped, roll pointer turning with it, and a profile and start altitude for every shipped scenario.
- **Task 3 (ea0c599):** GRADING.md "Flight profile for authors (phase 6)" and "Instructor review (phase 6, PFD)", PANEL-REVIEW.md items 16 to 23 (plus the two older mentions of `parameters` for the fuel delta now point to `profile`).

## Deviations from Plan

1. **[Rule 1 - Bug] Altitude and airspeed carry the fine scale 1e-4** (airspeed was in the plan, altitude was not): a climb of 500 fpm adds 0.8333 ft per step, which the default scale rounds to 0.83 and loses 2 ft a minute.
2. **[Rule 1 - Bug] Pitch is 0 when the aircraft is not airborne** (ground regime, or at the terrain and not climbing). The plan's formula gives 0.06 times 140 = +8.4 degrees for a parked aircraft (profile speed 0) in the Realistic run before the onset, which would nose the parked aircraft up and then drop it at the onset. Same cause as the 140 kt glitch the plan fixes.
3. **[Rule 3 - Blocking] `e2e/glass.spec.ts` zone check respects clip paths.** It measures `getBoundingClientRect`, which ignores a clip; the oversized sky and ground rects of the horizon would fail the content zone. The measured box is now cut to the clip rectangle of the nearest clipped ancestor.
4. Existing tests that pinned the exact start quantities of the blueprint (`scenario-tracer`, `scenario-lint` onset block, two cases of `session`) got `altitude_ft: 4500`; no expected speed was changed.
5. T/O FIRE NO ABORT with the engine stopped right after lift-off reaches the runway height within seconds (50 ft above the terrain, 300 fpm) and then stays level; there is no landing model. Noted for the owner (item 19).
6. The pitch uses the scripted vertical speed (target) and the current airspeed reading; the plan said "the airspeed" without choosing.

## Verification

Cleared Vitest cache: 69 files, 3557 passed. typecheck, lint, format:check exit 0; `npm run validate`: 10 scenario files, 0 problems. `tests/fixtures/recordings.json` unchanged. Playwright (desktop-, phone-, tablet-chromium; pfd, glass, art-fit, static-text, layout, zoom, brand, avionics, glass-header, engine-page, fire, icing, scenario, altn2, pack, variants, replay, cues, windscreen, run-reaction, fire-controls, smoke, session-area, fuel, inventory, electrical-box, gauge-alert, indicator): 623 passed, 37 skipped, 3 failed.

The 3 failures are one test on three projects, `e2e/scenario.spec.ts:591` "the MFD oil gauges read ... live values in a run". It expects a unit on the engine page (`/\d+ °C/`, `BAR`), which plan 06-02b removed ("no unit after any bar number"; the map strip assertions before it pass). Not caused by this plan and not touched here; logged in `deferred-items.md`.

## Known Stubs

None.

## Self-Check: PASSED

Created files exist, commits 682cad8, 0f984fa and ea0c599 are on the branch.
