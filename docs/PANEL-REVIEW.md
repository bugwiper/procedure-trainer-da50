# Panel Review List (first render, owner check)

This is a training aid, not the AFM. The panel of phase 01.1 was drawn from private reference photos that are not part of this repository. Wherever the photos did not settle a label, position, colour, size, kind, state or default, the plans made an assumption. This document lists every such assumption by panel area so the owner can check the first render and correct what is wrong. It contains layout facts only: no photo, crop, trace or aircraft manual text.

## How to correct an item

| What is wrong | Where to change it |
|---------------|--------------------|
| Position, hit size, region, states, default state, label | the registry data files in `src/aircraft/da50rg/controls/` (file named in the last column of each row), and the matching reference row in `tests/layout-reference.ts` (centre x and y in the 2000 x 1300 panel space, tolerance, `review` flag) |
| Colour, size, skin (rocker, bat, knob, lever and button shape) | the same data file (`skin`, `size`, `colour`, `ball` fields); the drawing itself is in `src/ui/panel/skins/` and `src/ui/panel/widgets/` |
| Lamp position, colour, caption side | `src/aircraft/da50rg/indicators.ts` (region-local centre), plus the reference row in `tests/layout-reference.ts` |
| Shell art, placards, plate outlines, brand marks | `src/ui/panel/PanelShell.tsx` (static art only; shared gradients in `src/ui/panel/Defs.tsx`) |
| Region box | `REGIONS` in `src/aircraft/da50rg/panel.ts` |

A position change must stay inside the tolerance of its reference row or the layout test fails; move the reference row together with the control. The tolerance is 3 units for a confirmed position, 8 for an unconfirmed one and 12 for the de-ice panel. Rows with `review: true` in `tests/layout-reference.ts` are the ones this document must name; `tests/panel-review.test.ts` checks that.

## Photo key

Photos are named by short name only. They live in a private, git-ignored folder on the owner's machine and are never linked or shown here.

| Short | File name |
|-------|-----------|
| P650 | IMG_0650.JPG (best frontal view, in flight) |
| P386 | IMG_0386.JPG (primary display and lower switch row close-up) |
| P738 | IMG_0738.jpg (multi-function display engine page, bus panel text) |
| P761 | IMG_7761.JPG (oblique view, lights, bus panel) |
| P807 | IMG_7807.JPG (oblique view, lights, centre stack) |
| DA62 | DA50_default_view_template.jpeg (owner's target look, a sister type) |
| COCK | DA50_Cockpit.jpg (side view of panel and console) |
| PED | center_lower_pedestal.jpg (lower row and console close-up) |
| SIM | DA50_virtual.jpg (simulator image: outline, far-left strip) |

## Legend: the uncertain aspect

| Word | Meaning |
|------|---------|
| position | the centre of the control in the panel space may be off by up to the row tolerance |
| kind | whether the part is a rocker, bat, knob, button or lever at all |
| states | the number or names of positions |
| default | the in-flight starting state |
| colour | colour of the part |
| size | proportions of the part relative to its neighbours |
| shape | detail of the drawn skin (handle look, flutes, icons) |
| function | what the control does in the aircraft; every control here is state only, nothing is simulated |

Coordinates below are global centres in the 2000 x 1300 space, written x, y, with the tolerance in brackets.

## Glareshield (region `lights`)

Four exterior-light rockers in the hump above the displays, 48 units apart (UI-SPEC rows 1 to 4). All four use the same skin: rocker, size LIGHT (26 x 54 face), white, hit 36 x 70. Pressed upper half is ON. State text is size 8 under the bezel.

| Id | Placard | Assumed kind and skin | Assumed states and default | Centre (tol) | What is uncertain | Photos | File to change |
|----|---------|-----------------------|----------------------------|--------------|-------------------|--------|----------------|
| `sw.light_landing` | LANDING | toggle, rocker LIGHT white | OFF, ON; default OFF | 1047, 90 (8) | position (the hump appears shifted right of the display-gap centre in left-seat photos, parallax suspected), default | P650, P761, P807, SIM | `controls/lights.ts` |
| `sw.light_taxi` | TAXI | same | OFF, ON; default OFF | 1095, 90 (8) | position, default | same | `controls/lights.ts` |
| `sw.light_position` | POSITION | same | OFF, ON; default ON (assumed lit in cruise) | 1143, 90 (8) | position, default | same | `controls/lights.ts` |
| `sw.light_strobe` | STROBE | same | OFF, ON; default ON (assumed lit in cruise) | 1191, 90 (8) | position, default | same | `controls/lights.ts` |

## Centre stack (regions `light_knobs`, reserved audio, standby and autopilot outlines)

_To be completed._

## Left strip: de-ice panel (regions `deice`, `deice_switches`)

_To be completed._

## Left strip: engine (region `engine_controls`)

_To be completed._

## Lower switch row (region `switch_bank`)

_To be completed._

## Landing gear block and LEVEL (regions `landing_gear`, `level`)

_To be completed._

## Flap block (region `flaps`)

_To be completed._

## Right panel and bus panel (region `right_panel`)

_To be completed._

## Under panel (regions `under_panel_left`, `under_panel_centre`, `under_panel_right`)

_To be completed._

## Environmental control and pedestal (regions `env_control`, `pedestal`)

_To be completed._

## Shell and placards (static art, no region)

_To be completed._

## Glass areas (regions `pfd`, `mfd`)

_To be completed._
