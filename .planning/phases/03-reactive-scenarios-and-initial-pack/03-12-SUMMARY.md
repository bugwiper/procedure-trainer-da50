---
phase: 03-reactive-scenarios-and-initial-pack
plan: 12
subsystem: ui
tags: [mfd, gauges, alert-styling, bands, uat-gap, svg]
status: complete

requires:
  - phase: 03-reactive-scenarios-and-initial-pack
    provides: plan 03-02 quantity data with colour bands and the MFD gauges that read them, plan 03-11 Realistic start readings
provides:
  - gauge-alert.ts, the one place for the glass palette, the band colour of a live reading (toneOf), the tone to style mapping (gaugeAlertStyle) and the box width estimate (textBoxWidth)
  - BarGauge and ArcGauge with an optional tone prop (box behind label and value, text and pointer in the tone's colours; green and none draw the tree exactly as before)
  - the MFD map strip and engine page restyling by the live band: red boxes with white text and a red pointer, yellow boxes with dark text and a yellow pointer
  - owner review item 16 of "Phase 3: owner review" (MFD alert styling)
affects: [03-13, 03-14, physics-fidelity-phase]

requirements-completed: [PNL-04]

actuals:
  tokens: 8100
  tasks: 3
  commits: 4
plan_head_before: de5a574eeeb571b555df2549a38bcda1ad4d7367
plan_head_after: 4e54dad8d6d37bdf6007933466657c82b1e4c4db

tech-stack:
  added: []
  patterns:
    - "Gauge components draw only what they are told: the tone is derived once in MfdFrame from the quantity data (QuantitySet.bandOf through toneOf), the style is a pure table, the tone prop defaults to green so the base readings render an identical tree"
    - "Boxes are sized from a per-character width table calibrated once in the browser (getBBox), not measured at render time"

key-files:
  created:
    - src/ui/panel/frames/gauge-alert.ts
    - tests/gauge-alert.test.ts
    - e2e/gauge-alert.spec.ts
  modified:
    - src/ui/panel/frames/BarGauge.tsx
    - src/ui/panel/frames/ArcGauge.tsx
    - src/ui/panel/frames/MfdFrame.tsx
    - docs/PANEL-REVIEW.md

key-decisions:
  - "The band rule exists once: toneOf asks the QuantitySet's own bandOf (a value on a bound belongs to the lower band) and reads the colour of that band from the quantity data; no second implementation (C-67)"
  - "Green and an unmarked range ('none') are the plain look; a gauge in green adds nothing to the rendered tree, so every existing avionics and static-text test passes unedited (C-66, C-68)"
  - "The arc gauges follow the same rule as the bars, an assumption (no photo shows an arc outside green) listed for the owner as review item 16 (C-70)"
  - "GREEN, YELLOW, RED and the dark glass colour moved into gauge-alert.ts with unchanged values; MfdFrame keeps its exported SCREEN_FILL (C-71)"

duration: 25 min
completed: 2026-10-23
---

# Phase 3 Plan 12: MFD gauge alert styling Summary

**The MFD gauges restyle by the band their live value is in: a yellow reading gets yellow boxes behind label and value, dark text and a yellow pointer; a red reading gets red boxes, white text and a red pointer; green is drawn exactly as before. Bars and arcs share one rule, the band rule is the quantity data's own, and no text changes with the tone.**

## Accomplishments

- **Task 1 (tracer):** `gauge-alert.ts` (palette, `toneOf`, `gaugeAlertStyle`, `textBoxWidth`), `BarGauge` with the `tone` prop (`data-alert` on the gauge group, `data-alert-box` = `label` or `value` on each box), `MfdFrame` passing the tone of every bar gauge on the map strip and the engine page. On the built app the Easy ENG OIL TEMP oil temperature (128) starts red-boxed and turns yellow-boxed after POWER to the 50 percent detent and the cowl flap open; an untouched green gauge (Oil pres) has no mark. Commit `7d96134`.
- **Task 2 (TDD):** cases written first and seen failing (`05b1d8e`), then `ArcGauge` with the same tone rule (label box centred above the arc, readout box centred under the hub, the needle in the band colour, the unit line plain) and `MfdFrame` passing the tone of RPM, Load and Oil pres. On the built app ENGINE MASTER off turns the Oil pres arc red (red boxes, white text, red needle) while the RPM arc, spinning down to 0 rpm, stays plain. Commit `3855eee`.
- **Task 3:** owner review item 16 "MFD alert styling" with what to look at and the defaults taken, and every gate run once (below). Commit `4e54dad`.

## Calibration of the box widths (C-69)

Measured once in Chromium with `getBBox` at font size 100 per character: the label face is the placard font B612 bold (advance per capital between 0.36 em for I and 1.01 em for W, digits 0.71, space 0.41, letter spacing of 0.06 em included); the readout face B612 Mono has 0.71 em for every character. `textBoxWidth(text, fontSize, mono)` sums those advances and adds 3 percent slack. Check over the worst-case label and every min, max, base and 3-digit reading of all twelve gauges: measured width / estimate between 0.94 and 0.97, never above 1.

Worst-case pair (estimated label + estimated value of the widest readings, units included), against the gauge width:

| Gauge | Label | Value | Pair + full padding | Fits 130 (map strip) | Fits 219.5 (engine page) |
|-------|------:|------:|--------------------:|:--------------------:|:------------------------:|
| Oil temp | 53.4 | 43.9 | 109.2 | yes | yes |
| Coolant temp | 87.8 | 43.9 | 143.6 | no (texts alone 131.7) | yes |
| Gearbox temp | 86.9 | 43.9 | 142.8 | no (texts alone 130.8) | yes |
| Fuel temp | 61.7 | 43.9 | 117.6 | yes | yes |
| Fuel pres | 58.6 | 58.5 | 129.1 | barely | yes |
| Fuel qty LH | 72.3 | 58.5 | 142.8 | no (texts alone 130.8) | yes |
| Fuel qty RH | 73.3 | 58.5 | 143.8 | engine page only | yes |
| Volts | 35.6 | 43.9 | 91.5 | yes | yes |
| Amps | 30.3 | 29.3 | 71.5 | engine page only | yes |

Only the strip is tight: COOLANT TEMP, GEARBOX TEMP and FUEL QTY LH with their widest readings (3 digits or 8 characters) exceed the 130 units by the estimate (the measured widths for COOLANT TEMP with a 3-digit reading are 127.3 and for FUEL QTY LH with 30.0 GAL 126.9, so the plain texts themselves nearly touch). With the readings a run actually shows (for example `85 °C`, `20.0 GAL`) the padding shrinks (see Deviations) and the boxes stay apart; at the widest readings the two same-coloured boxes touch or overlap by 1 to 2 units. No font was shrunk and no text shortened.

## Gates

| Gate | Result |
|------|--------|
| `npx vitest run tests/gauge-alert.test.ts tests/avionics.test.ts tests/static-text.test.ts` | 180 passed |
| `npx vitest run` (whole suite) | 2607 passed in 50 files |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run validate` | 3 scenario files checked, 0 problems |
| `PW_PORT=4333 npx playwright test e2e/gauge-alert.spec.ts e2e/avionics.spec.ts e2e/glass.spec.ts e2e/static-text.spec.ts e2e/run-reaction.spec.ts --project=desktop-chromium --project=phone-chromium` | 92 passed, 4 skipped (project-specific cases), 0 failed |
| `tests/content-policy.test.ts`, `tests/panel-review.test.ts`, `tests/docs-format.test.ts` | pass (inside the whole suite) |
| acceptance greps | `gaugeAlertStyle` in gauge-alert.ts 1; `data-alert` in BarGauge.tsx 3 and in ArcGauge.tsx 3; `gauge-alert` in MfdFrame.tsx 1; `toneOf(` in MfdFrame.tsx 4; `MFD alert styling` in PANEL-REVIEW.md 1 |

A look at screenshots of the built desktop app (map strip red, engine page red, ENGINE MASTER off) confirmed the boxes, text and pointers; the screenshots were temporary and are not committed. The owner photo comparison is the human-check of Task 3 and stays with the owner (item 16).

## Assumptions taken

- C-66 to C-71 of the plan as written; the arc gauges follow the bars' rule although no photo shows an arc outside green (C-70, review item 16).
- The owner photos were not opened in this unattended run: the plan's "what the photos show" section was taken as the fact base. Nothing from the private folder was read into or written to the repository.
- White text on the red fill has a contrast of about 3.7 to 1; kept as in the photos and stated in review item 16.
- The `none` tone (unmarked scale range, for example fuel above the usable capacity) is the plain look.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `textBoxWidth` takes an optional third argument**
- **Found during:** Task 1 (calibration)
- **Issue:** the plan names `textBoxWidth(text, fontSize)`, but the two faces differ: the mono readout has 0.71 em for every character and the placard label 0.36 to 1.01 em, so one per-character rule was 6 to 12 percent too wide on labels or too narrow on readouts.
- **Fix:** `textBoxWidth(text, fontSize, mono = false)`; the two-argument call is the label estimate.
- **Files modified:** src/ui/panel/frames/gauge-alert.ts, BarGauge.tsx, ArcGauge.tsx
- **Commit:** 7d96134, 3855eee

**2. [Rule 1 - Bug] Box padding is continuous, not 3 or 2**
- **Found during:** Task 2 (worst-case table above)
- **Issue:** with the fixed rule "3, or 2 if the pair would not fit" the label and value boxes of COOLANT TEMP with a normal reading still touched on the 130 wide strip.
- **Fix:** `pad = max(0, min(3, (w - labelW - valueW - 1) / 2))`: 3 where the pair fits, shrinking to 2 or less on the strip, so the boxes stay apart while the estimated texts fit. A unit case covers the 3 and the shrunk case.
- **Files modified:** src/ui/panel/frames/BarGauge.tsx, src/ui/panel/frames/gauge-alert.ts (the unused tight constant is gone), tests/gauge-alert.test.ts
- **Commit:** 3855eee

**3. [Rule 1 - Bug in the plan's e2e wording] The RPM arc is not waited down to 0**
- **Found during:** Task 2 (e2e)
- **Issue:** the engine spins down slowly (68 rpm still after 10 s), so "RPM reads 0 within 10 s" fails although the arc is correctly plain.
- **Fix:** the case waits until the RPM readout is below 300 (at most 15 s), then asserts no `data-alert` and no box on the RPM arc.
- **Files modified:** e2e/gauge-alert.spec.ts
- **Commit:** 3855eee

**4. [Process] The RED commit leaves `tsc` failing at that commit**
- The Task 2 RED commit (`05b1d8e`) passes the not yet existing `tone` prop to `ArcGauge`; vitest does not type-check, the next commit (`3855eee`) restores typecheck. No hooks exist in the repository.

**5. [Process] STATE.md and ROADMAP.md**
- The plan's prohibition says STATE.md is not edited; the dispatch and the executor protocol require the GSD state tooling to update STATE.md and ROADMAP.md after the SUMMARY. Only the tooling wrote them; nothing was hand-edited.

**Total deviations:** 3 auto-fixed (1 blocking, 2 bug), 2 process notes. **Impact:** none on scope; the layout of the engine page, quantities and texts are unchanged.

## Known Stubs

None. No placeholder text or empty data flows to the UI in the new files.

## Threat Flags

None: drawing only, no new endpoint, auth path, file access or schema change.

## Issues Encountered

None open. The widest strip readings (COOLANT TEMP, GEARBOX TEMP, FUEL QTY LH) can make the two boxes touch by 1 to 2 units; reported above and in review item 16 as a layout question for the physics fidelity phase.

## Next Phase Readiness

Ready for 03-13. The owner decides in review item 16 whether the arc gauges keep the rule and compares the red and yellow looks with the photos of the real engine page.

## Self-Check: PASSED

- FOUND: src/ui/panel/frames/gauge-alert.ts, tests/gauge-alert.test.ts, e2e/gauge-alert.spec.ts
- FOUND commits 7d96134, 05b1d8e, 3855eee, 4e54dad on the phase branch (4 commits since plan_head_before)
- All plan acceptance criteria and gates above pass
