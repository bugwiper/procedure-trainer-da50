---
created: 2026-10-20
title: Rework the de-ice panel to match the real unit (3-position toggles, MAX button, three lamps)
area: ui
source: 01.1-11 Task 4 owner first-render review, area 3 (owner correction on the live site)
---

The owner reviewed the live panel (commit 0265806, area 3 of docs/PANEL-REVIEW.md) and found the de-ice unit inaccurate. A better reference exists as the owner reference photo of the de-ice unit, saved privately at `.input/deice-panel-reference.jpg` (gitignored: never commit it, never link it from a tracked file, refer to it only by that description). The description below is the owner's, translated; the photo agrees with it. One detail from the photo: the heading reads "DE ICE" without a hyphen, while the owner and the current build write "DE-ICE". Check which spelling the placard uses before changing the heading text.

## What the real unit looks like (owner correction)

- Heading "DE-ICE" in a white outline frame (box).
- Under the red guard is a normal toggle. The guarded, normal position is UP; after lifting the guard it can be flipped DOWN. The word ALTERNATE stands beside it in vertical letters.
- Far left: a normal 3-position mini toggle (not a rocker, not a bat). Bottom = OFF (label below), middle = NORM (label left, vertically centred), top = HIGH (label above).
- Above it, a black push button labelled MAX (label above).
- Between the 3-position switch and MAX button on the left and the guarded ALTERNATE on the right are three indicator lamps stacked vertically: the top and the middle are amber/yellow, the bottom is white/clear.
  - Mode NORM: only the BOTTOM lamp is lit, white.
  - Mode HIGH: only the MIDDLE amber lamp is lit.
  - Pressing MAX, only while the switch is in HIGH: de-ice runs at MAX for 120 s and additionally lights the TOP amber lamp. Afterwards MAX mode switches itself off until MAX is pressed again.
- Bottom row, left: a black push button labelled WIND SHIELD (two lines, label above). Pressing it sprays the windscreen.
- Right of it: a 3-position toggle whose default is MIDDLE = OFF. UP = ICE LIGHT, DOWN = ANNUN-TEST (system self-test; its function comes later in the scenarios).
- Right of that: a 2-way toggle, UP = PUMP 2, DOWN = PUMP 1.

## Differences from the current build

| Now | Must become |
|---|---|
| MODE selector `lv.deice_mode` (gear-flaps.ts, UI-SPEC id sw.deice_mode): a detent lever/bat with stops OFF, NORM, HIGH, MAX | a 3-position mini toggle with OFF, NORM, HIGH (a new toggle/skin variant, for example a three-state toggle), plus a separate black push button MAX |
| three de-ice lamps do not exist | three new derived indicators (amber, amber, white) read from the mode and the MAX state; `IndicatorColour` in `src/engine/indicators.ts` has only green, red and white, so an amber colour must be added; widget `src/ui/panel/widgets/IndicatorLight.tsx` and the skins need the amber look |
| `sw.deice_ice_light` toggle and `btn.deice_annun_test` push button as separate controls | ONE 3-position toggle: UP ICE LIGHT, middle OFF (default), DOWN ANNUN-TEST |
| `sw.deice_pump1` and `sw.deice_pump2` as two toggles | ONE 2-way toggle: UP PUMP 2, DOWN PUMP 1 |
| `sw.deice_windshield`, registered as a latching toggle (kind `toggle`) | a black momentary push button (WIND SHIELD, two lines, label above; a spray, not a latching state). The owner said "stays a push button", but the registry kind is `toggle`, so this is a kind change to `momentary-button` |
| `sw.deice_alternate` rocker skin under the guard | a normal toggle under the red guard, guarded position UP, flipped DOWN after lifting the guard; vertical "ALTERNATE" letters beside it |
| unit heading plain | "DE-ICE" in a white outline frame |
| layout of the DE-ICE and DE-ICE SWITCHES regions | the layout of the photo (two blocks in one unit); the two regions may need merging or re-splitting (plan 01.1-05 split them for phone tap size, PD-02) |

The LEVEL push button (`btn.level`, blue, LEVEL region) needs a check against the photo: the photo of the de-ice unit shows no LEVEL button; to its right sit autopilot-style knobs (PUSH 1-2, HDG with PUSH HDG SYNC), which belong to the autopilot area of Phase 01.2. Confirm where LEVEL really sits and whether it relates to this unit or not; only record the result, do not move it without a reference.

## Behaviour that belongs to the engine or a scenario (may be deferred, but record it)

- The MAX run of 120 s (virtual clock, tick events, never a real timer) and its automatic end belong to the engine or scenario layer (Phase 3 reactions). For now the lamps may simply follow the states, with the TOP lamp driven by a MAX press only while the mode is HIGH.
- ANNUN-TEST function (lamp test) comes with scenarios.
- WIND SHIELD spray has no simulated effect yet.

## Affected ids and files (from the registry at commit 0265806)

Controls (src/aircraft/da50rg/controls/):
- `lv.deice_mode` (gear-flaps.ts; its note PD-03 explains the UI-SPEC id sw.deice_mode)
- `sw.deice_alternate`, `sw.deice_windshield`, `sw.deice_ice_light`, `sw.deice_pump2`, `sw.deice_pump1` (deice.ts)
- `btn.deice_annun_test` (buttons.ts)
- new: a MAX push button id, a combined ICE LIGHT / ANNUN-TEST toggle id, a combined PUMP toggle id, and three new lamp ids `lt.deice_*` (src/aircraft/da50rg/indicators.ts; src/engine/indicators.ts for the amber colour)
- `src/aircraft/da50rg/panel.ts` (regions `deice` and `deice_switches`, registry assembly), `src/engine/registry.ts` (skin and state vocabulary for a three-state toggle)

Skins and widgets: `src/ui/panel/skins/Rocker.tsx`, `Bat.tsx`, `PushButton.tsx`, `LeverHandles.tsx`, `src/ui/panel/widgets/IndicatorLight.tsx`, and the static shell art in `src/ui/panel/PanelShell.tsx` for the framed heading.

Tests and docs that name these ids and will need updating: `tests/layout-reference.ts` (the shared reference, 42 controls and 7 lamps; counts change), `tests/switch-skins.test.ts`, `tests/lever-skins.test.ts`, `tests/button-skins.test.ts`, `tests/detents.test.ts`, `tests/store.test.ts`, `tests/zoom.test.ts`, `tests/panel-review.test.ts`, `e2e/guard.spec.ts`, `e2e/inventory.spec.ts`, `e2e/layout.spec.ts`, `e2e/lever-skins.spec.ts`, `e2e/switch-skins.spec.ts`, and `docs/PANEL-REVIEW.md` (area 3 rows). The control count in README "Demo controls" and in the ROADMAP/plan text (42 controls, 7 lamps) will change.

Recommended route: a small inserted decimal phase or a follow-up plan after Phase 01.1 (not inside Phase 01.1, whose plan 11 forbids source changes), with the layout reference rows updated first (test-first), then the registry, then the skins.
