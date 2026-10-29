---
phase: 06-fuel-tank-and-engine-fidelity-and-the-engine-page
plan: 02b
subsystem: engine page and glass header
tags: [mfd, owner-review, rework]
requires: [06-02]
provides: [pointer shape, centred labels, radio row]
key-files:
  created:
    - src/ui/panel/frames/pointer.ts
  modified:
    - src/ui/panel/frames/{ArcGauge,BarGauge,DualGauge,BoxFrame,MfdFrame}.tsx
    - src/aircraft/da50rg/engine-page.ts
    - src/ui/stage.css
    - tests/{engine-page-reference,engine-page,gauge-alert,avionics}.ts
    - e2e/engine-page.spec.ts
    - docs/{PANEL-LABELS,PANEL-REVIEW}.md
status: complete
---

# Phase 6 Plan 02b: engine page rework after the owner's comparison with the real display

Direct rework (no PLAN file). Commit: `fix(panel): engine page and radio row after the comparison with the real display`.

## What changed

1. Arc captions: `LOAD %` and `RPM` stand under the arcs, the bare number under them (the caption follows the arc ends, so it clears any radius).
2. Type: the engine page content is set in the regular cut (`stage.css`, only under `mfd-engine-page`); placards and legends stay bold.
3. No unit after any bar number (Oil Pres, Oil Temp, Coolant, Gearbox, Fuel Press, and Volts as in the photo; Fuel Temp already had none; Total Service keeps HRS).
4. Bar labels (engine page only, the Map strip keeps its left label) and all box titles (sub-boxes too) are centred; the number stays at the right.
5. Fuel Qty numbers are whole (`decimals: 0`); the pointer still moves with every fraction.
6. Pointers: one shared shape (`pointer.ts`), an arrow with a rectangle, 11 wide, tip 3 units into the bar, thin glass-colour outline; L/R and 1/2 in 6 pt black type inside the rectangle; the rudder trim pointer uses the same shape.
7. De-Ice Endurance rows are spread evenly over the box (`evenBaseline`).
8. Header (PFD and MFD): stacked N A V and C O M with a small 1 and 2 beside the rows, turquoise swap arrows on both sides, thin turquoise frames round the standby frequencies (outer ones), RX removed.

## Deviations from Plan

- **Volts** also lost its unit (owner list did not name it; the photo shows `24.1`).
- **Avionics master not linked** (owner instruction for the conflict case): `sw.av_master` exists and `electricalState().avionics` is derived from it, but no glass reads it; the displays are inert and always lit, and the second row would appear and vanish with a control state. Both rows stay static with frequencies. Open question 15 in PANEL-REVIEW.md.
- The Map strip shares `BarGauge`, so it got the new pointer shape (label placement and units unchanged).
- Arc readout font 14 became 10 (caption and number the same size, as in the photo).
- `e2e/engine-page.spec.ts` reads the pointer position, not the whole number, to see tank transfer.

## Verification

Cleared Vitest cache: 67 files, 3468 tests passed. typecheck, lint, format:check exit 0; `npm run validate`: 10 scenario files, 0 problems. Playwright (desktop-, phone-, tablet-chromium; engine-page, glass, art-fit, static-text, layout, zoom, brand, avionics, electrical-box, gauge-alert, fuel, indicator, inventory): 279 passed, 33 skipped (phone-only skips as before), 0 failed.

## Known Stubs

None.

## Self-Check: PASSED
