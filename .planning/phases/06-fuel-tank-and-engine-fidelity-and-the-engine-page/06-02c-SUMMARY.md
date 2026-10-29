---
phase: 06-fuel-tank-and-engine-fidelity-and-the-engine-page
plan: 02c
subsystem: glass header
tags: [pfd, mfd, av-master, owner-decision]
requires: [06-02b]
provides: [second radio row follows AV MASTER]
key-files:
  created:
    - e2e/glass-header.spec.ts
  modified:
    - src/aircraft/da50rg/avionics.ts
    - src/ui/panel/frames/{MfdFrame,PfdFrame}.tsx
    - tests/avionics.test.ts
    - e2e/static-text.spec.ts
    - docs/{PANEL-LABELS,PANEL-REVIEW}.md
status: complete
---

# Phase 6 Plan 02c: the second radio row follows AV MASTER

Direct change (no PLAN file). Commit: `feat(panel): second radio row of the glass header follows AV MASTER`. Answers open question 15 of PANEL-REVIEW.md (owner decision 2026-10-29).

## What changed

1. `secondRadioRowLive(avMaster)` and `AV_MASTER_CONTROL` in `src/aircraft/da50rg/avionics.ts`: a pure derived flag of the one control (default on). No engine or scenario code touched.
2. `GlassHeader` (`MfdFrame.tsx`) takes `secondRowLive`. With AV MASTER off each second row (NAV 2 left, COM 2 right) is drawn as `UnreachableRow`: a yellow-grey box (`#5f5d2b`) with two crossing yellow lines (`#e3d12b`) over the extent of the two frequencies, instead of them. The small 2, the first row, frames and arrows stay; nothing else on the glass follows the switch.
3. The PFD and the MFD (both pages) use the same `GlassHeader` and the same `glassSecondRowLive(bridge)`, which reads the `sw.av_master` signal of the bridge. A unit test compares the two headers element by element (title aside) in both states.
4. G-0 exception recorded narrowly: PANEL-LABELS.md (rules table and the glass header row), PANEL-REVIEW.md (item 15 marked answered, glass header values row), and the comment of the static-text gate (the glass regions were already outside that gate, so no gate logic changed).

## Tests

- `tests/avionics.test.ts`: the flag, live look and off look on PFD, MFD map and MFD engine page (texts, box, crosses, band limits, arrows, frames, font sizes), PFD and MFD header identical.
- `e2e/glass-header.spec.ts` (desktop, phone, tablet chromium): toggles `sw.av_master` through the real pointer path and checks box and crosses appear and disappear on both displays, the first row and marks stay, the MFD page does not matter, the rest of the glass content is unchanged. Counts come from the display and row lists of the spec and the header itself.
- The electrical fire situation and the grading fixtures pass unchanged; `tests/fixtures/recordings.json` is not modified.

## Deviations from Plan

- **Flag reads the switch, not the bus.** The owner asked for AV MASTER; `electricalState().avionics` also needs a live bus, quantities and the engine state, which would make the row follow a dead bus (a glass-power behaviour the owner excluded). The flag reads `sw.av_master` alone and says so in its comment and in item 15. One-line change if the bus is wanted later.

## Verification

Cleared Vitest cache: 67 files, 3476 tests passed. `npm run validate`: 10 scenario files, 0 problems. typecheck, lint, format:check exit 0. Playwright desktop-, phone-, tablet-chromium (glass-header, glass, art-fit, static-text, layout, zoom, brand, avionics, engine-page, electrical-box, indicator, fire): 303 passed, 33 skipped (phone-only and touch-only skips as before), 0 failed.

## Known Stubs

None.

## Self-Check: PASSED
