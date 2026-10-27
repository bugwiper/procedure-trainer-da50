---
phase: 04-electrical-system-fidelity
plan: 03
subsystem: ui
tags: [mfd, electrical, amps, volts, gauge-alert, docs]
requires:
  - phase: 04-electrical-system-fidelity
    provides: bus model, alt1_amps and alt2_amps currents, bus_volts, ALTN 2 FAIL scenario
provides:
  - AmpsGauge: the two-pointer Amps bar (pointer 1 above, pointer 2 below, alert look per pointer)
  - the ELECTRICAL box on the MFD engine page (Amps and Volts), fuel bars moved below it
  - phase 4 documents, requirements and todos (one pending todo left for Phase 6)
affects: [Phase 6 fuel, tank, engine and engine page]
status: complete
actuals:
  tokens: 30000
  tasks: 3
  commits: 3
plan_head_before: d00f198da31d94f89ff002fe69c0e4497d49dbc8
plan_head_after: f9be1e62be1530406e8d1e22dcf9854297df852a
tech-stack:
  added: []
  patterns: [presentational gauge from quantity data, worse-of-two tone for a shared label]
key-files:
  created: [src/ui/panel/frames/AmpsGauge.tsx, e2e/electrical-box.spec.ts, .planning/todos/done/2026-10-23-physics-fidelity-electrical.md]
  modified: [src/ui/panel/frames/MfdFrame.tsx, src/ui/panel/frames/gauge-alert.ts, tests/avionics.test.ts, tests/gauge-alert.test.ts, tests/panel-review.test.ts, docs/GRADING.md, docs/PANEL-REVIEW.md, README.md, .claude/CLAUDE.md, .planning/REQUIREMENTS.md]
key-decisions:
  - "Decisions E-18 to E-23 of the plan stand; the Engine Fire pump question is closed (owner confirmed E-11), so the owner review lists it as a thing to look at, not as open."
requirements-completed: [PNL-16]
completed: 2026-10-23
---

# Phase 4 Plan 03: Electrical box and phase-end documents Summary

The MFD engine page now draws one ELECTRICAL box with a two-pointer Amps bar (alternator 1 above the bar, alternator 2 below, readouts at the ends of the title row, label in the worse tone) and the Volts bar; every number comes from the quantity data and only the readouts move.

## What changed

- Task 1 (tracer, bb52acc): `AmpsGauge.tsx`, `worseTone` in `gauge-alert.ts`, the box in `MfdFrame.tsx` (the separate VOLTS and AMPS bars are gone from the right column, the map strip keeps its VOLTS), unit tests for every tone pair, bare readouts, one scale and the box placement.
- Task 2 (460b67e): `e2e/electrical-box.spec.ts`: ALTN 1 FAIL (0 and the additional loads, then 0 and the main load after ESS BUS on, Volts back to normal), ALTN 2 FAIL (load on pointer 1, pointer 2 at 0, Volts normal), static marks unchanged, box geometry inside the glass content area with the fuel bars below it.
- Task 3 (f9be1e6): GRADING.md phase 4 review (8 items) and the fixes to items 2, 3, 4, 9 of phase 3, PANEL-REVIEW.md "Phase 4: owner review" (8 items), README, CLAUDE.md, requirements SCN-11, PNL-16, CNT-04 complete, todos regrouped (electrical part and checklist fidelity in `done/`, Phase 5 parts in one pending todo).

## Checks

- Full vitest (54 files, 2945 tests), typecheck, lint, format:check and `npm run validate` (4 files) pass; `tests/fixtures/recordings.json` unchanged.
- Playwright, all three chromium projects: 849 passed, 261 skipped, 0 failed. The named specs (electrical-box, gauge-alert, glass, run-reaction, static-text) pass on desktop-chromium and phone-chromium.

## Deviations from Plan

- [Rule 1 - Doc] The plan asked the review list to call the Engine Fire pump yes/no "open until answered"; plan 01 records that the owner confirmed E-11, so item 4 says it was confirmed. Not a code change.
- `tests/panel-review.test.ts` follows the new last section (heading order test) and gets a short phase 4 block; the phase 3.1 block now stops at the next heading.
- The font sizes of the new texts in the SVG frames (8 and 10) follow the existing glass frames, not the stage.css list, which is for the HTML layer.

## Known Stubs

None.

## Self-Check: PASSED
