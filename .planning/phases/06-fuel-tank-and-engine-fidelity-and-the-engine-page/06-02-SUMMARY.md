---
phase: 06-fuel-tank-and-engine-fidelity-and-the-engine-page
plan: 02
subsystem: engine page and de-ice
tags: [mfd, layout-as-data, dual-gauge, de-ice, fluid-model]
requires: [06-01]
provides: [ENGINE_PAGE layout, DualGauge, BoxFrame, deiceEndurance, deice_qty_gal model, ANNUN TEST lamps]
affects: [06-03 PFD]
key-files:
  created:
    - src/aircraft/da50rg/engine-page.ts
    - src/aircraft/da50rg/deice-endurance.ts
    - src/ui/panel/frames/BoxFrame.tsx
    - tests/engine-page-reference.ts
    - tests/engine-page.test.ts
    - tests/deice-model.test.ts
    - e2e/engine-page.spec.ts
  modified:
    - src/ui/panel/frames/{MfdFrame,BarGauge}.tsx
    - src/ui/panel/frames/DualGauge.tsx (renamed from AmpsGauge.tsx)
    - src/aircraft/da50rg/{quantities,physics,indicators}.ts
    - src/aircraft/da50rg/controls/deice.ts
    - tests/{avionics,gauge-alert,indicators,physics,windscreen-physics}.test.ts
    - e2e/{electrical-box,gauge-alert,indicator}.spec.ts
    - docs/{PANEL-LABELS,PANEL-REVIEW,GRADING}.md
    - .planning/todos/pending/2026-10-21-deice-max-timer-engine.md
status: complete
commits: 3
plan_head_before: 79d1bf985e62ed20154345bb6f095fad3df741e4
plan_head_after: fbbc0a4c45e63815e9e78bacd08ff1a1d2d65cce
actuals:
  tokens: 60000
  tasks: 3
  commits: 3
metrics:
  completed: 2026-10-28
---

# Phase 6 Plan 02: Engine page and de-ice Summary

The MFD engine page has the three columns of the real page, drawn from layout data (`ENGINE_PAGE`), with a combined two-pointer Fuel Qty and Fuel Temp bar, the fuel box with calculator, static oxygen, rudder trim and service boxes, and a de-ice box whose quantity and Norm and High endurance follow a new fluid model (mode flows, 0.4 gal MAX run, 40 ml spray); ANNUN TEST lights the three de-ice lamps.

## What was built

- **Task 1 (tracer, 2737420):** `engine-page.ts` layout data, `DualGauge` (replaces `AmpsGauge`, marks and scale numerals, `data-dual-*`), `BoxFrame`, Oil Pres as a bar, arcs at radius 34, ENGINE heading removed; layout gates against the independent `tests/engine-page-reference.ts`; e2e for order, label table and live fuel.
- **Task 2 (9af7c0b):** Fuel Temp, Fuel Press, FFlow GPH, calculator, Rudder Trim, Oxygen, De-Ice with Endurance, Total Service; quantities `rudder_trim_pct`, `oxygen_psi`, `deice_qty_gal`, `service_hours`; `deiceEndurance`; PANEL-LABELS section; NaN guard in the frame.
- **Task 3 (fbbc0a4):** rate model on `deice_qty_gal` (NORM 3, HIGH 6 gal/h; MAX 0.4 gal in total over its 120 s in place of the HIGH flow; spray 40 ml over 10 s on top); `deiceLamps(mode, maxActive, annunTest)`; GRADING.md, PANEL-REVIEW.md items 7 to 12; de-ice todo updated (items 1 to 3 done, item 4 and the ELT note pending with reasons).

## Deviations from Plan

1. **[Rule 1 - Bug] Electrical box at y 36, boxes below shifted by 4** (oxygen 131, de-ice 187, service 289): its title cut into the top edge started at y 26.9, outside the glass zone (zone check in `e2e/glass.spec.ts`).
2. **[Rule 1 - Bug] Readout ids `endurance_norm` and `endurance_high`:** `deice_high` is a scenario fact id and tripped `tests/blueprint.test.ts`.
3. **[Rule 1 - Bug] FFlow e2e tolerance 1 gal/h, not 0.2:** the shipped ENG OIL TEMP scenario starts at POWER p75 (11.8 gph against the 11.23 cruise base); the 0.2 check passed only by sampling the first step. Plan conflict on the number, resolved in the test only.
4. **[Rule 3 - Blocking] `tests/physics.test.ts`:** the "one model per quantity" gate now exempts the three static display values (and asserts they keep their value).
5. **[Rule 3 - Blocking] Spray replay test in `tests/windscreen-physics.test.ts` got a 30 s timeout:** it takes 3.7 s alone and exceeded the 5 s default under full-suite load once.
6. **Replay test of the fluid model samples steps** (every step to step 300, then every 25th and around the end of the MAX run) instead of every step: a per-step replay over the 150 s log is quadratic.
7. Own additions: `data-box` replaces `data-electrical-box`; `BarGauge` prints the number alone when the unit is empty (PSI, US GAL); `Fuel pres` label is now `Fuel press`; the oil pressure e2e case says "bar" instead of "arc".

## Verification

Cleared Vitest cache: 67 files, 3460 tests passed. typecheck, lint, format:check exit 0; `npm run validate`: 10 scenario files, 0 problems. `tests/fixtures/recordings.json` unchanged. Playwright (desktop-chromium, phone-chromium, tablet-chromium; engine-page, electrical-box, indicator, glass, art-fit, static-text, layout, zoom, gauge-alert, inventory): 210 passed, 33 skipped (phone-only skips and hook specs, as before), 0 failed.

## Known Stubs

None. The static display values (oxygen, rudder trim, service hours) are intended and listed for owner review. ICE LIGHT effect and ELT lamp stay deferred (reasons in the de-ice todo).

## Self-Check: PASSED

Created files exist, commits 2737420, 9af7c0b and fbbc0a4 are on the branch.
