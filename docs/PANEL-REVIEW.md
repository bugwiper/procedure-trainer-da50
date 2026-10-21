# Panel Review List (first render, owner check)

This is a training aid, not the AFM. The panel of phase 01.1 was drawn from private reference photos that are not part of this repository. Wherever the photos did not settle a label, position, colour, size, kind, state or default, the plans made an assumption. This document lists every such assumption by panel area so the owner can check the first render and correct what is wrong. It contains layout facts only: no photo, crop, trace or aircraft manual text. The document was brought up to date for the rebuilt panel (gap-closure plans 12 to 22) by plan 23; start the morning review at the section "Round 2: morning review" at the end, and read the label table in [PANEL-LABELS.md](PANEL-LABELS.md) next to it.

## How to correct an item

| What is wrong                                                  | Where to change it                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Position, hit size, region, states, default state, label       | the registry data files in `src/aircraft/da50rg/controls/` (file named in the last column of each row), and the matching reference row in `tests/layout-reference.ts` (centre x and y in the 2180 x 1300 panel space, positions left of x 1980 unchanged since phase 01.1, tolerance, `review` flag) |
| Colour, size, skin (rocker, bat, knob, lever and button shape) | the same data file (`skin`, `size`, `colour`, `ball` fields); the drawing itself is in `src/ui/panel/skins/` and `src/ui/panel/widgets/`                                                                                                        |
| Lamp position, colour, caption side                            | `src/aircraft/da50rg/indicators.ts` (region-local centre), plus the reference row in `tests/layout-reference.ts`                                                                                                                                |
| Shell art, placards, plate outlines, brand marks               | `src/ui/panel/PanelShell.tsx` (static art only; shared gradients in `src/ui/panel/Defs.tsx`)                                                                                                                                                    |
| Region box                                                     | `REGIONS` in `src/aircraft/da50rg/panel.ts`                                                                                                                                                                                                     |

A position change must stay inside the tolerance of its reference row or the layout test fails; move the reference row together with the control. The tolerance is 3 units for a confirmed position, 8 for an unconfirmed one and 12 for the de-ice panel. Rows with `review: true` in `tests/layout-reference.ts` are the ones this document must name; `tests/panel-review.test.ts` checks that.

## Photo key

Photos are named by short name only. They live in a private, git-ignored folder on the owner's machine and are never linked or shown here.

| Short | File name                                                            |
| ----- | -------------------------------------------------------------------- |
| P650  | IMG_0650.JPG (best frontal view, in flight)                          |
| P386  | IMG_0386.JPG (primary display and lower switch row close-up)         |
| P738  | IMG_0738.jpg (multi-function display engine page, bus panel text)    |
| P761  | IMG_7761.JPG (oblique view, lights, bus panel)                       |
| P807  | IMG_7807.JPG (oblique view, lights, centre stack)                    |
| DA62  | DA50_default_view_template.jpeg (owner's target look, a sister type) |
| COCK  | DA50_Cockpit.jpg (side view of panel and console)                    |
| PED   | center_lower_pedestal.jpg (lower row and console close-up)           |
| SIM   | DA50_virtual.jpg (simulator image: outline, far-left strip)          |

## Legend: the uncertain aspect

| Word     | Meaning                                                                                       |
| -------- | --------------------------------------------------------------------------------------------- |
| position | the centre of the control in the panel space may be off by up to the row tolerance            |
| kind     | whether the part is a rocker, bat, knob, button or lever at all                               |
| states   | the number or names of positions                                                              |
| default  | the in-flight starting state                                                                  |
| colour   | colour of the part                                                                            |
| size     | proportions of the part relative to its neighbours                                            |
| shape    | detail of the drawn skin (handle look, flutes, icons)                                         |
| function | what the control does in the aircraft; every control here is state only, nothing is simulated |

Coordinates below are global centres in the 2180 x 1300 space (the 180 units were added on the right only, so every position below is unchanged from phase 01.1), written x, y, with the tolerance in brackets.

## Glareshield (region `lights`)

Four exterior-light rockers in the hump above the displays, 48 units apart (UI-SPEC rows 1 to 4). All four use the same skin: rocker, size LIGHT (26 x 54 face), white, hit 36 x 70. The raised half is ON. No state text is printed; the position shows by the side perspective of the rocker only (G-0.1, G-0.4).

| Id                  | Placard  | Assumed kind and skin      | Assumed states and default                  | Centre (tol) | What is uncertain                                                                                                    | Photos                | File to change       |
| ------------------- | -------- | -------------------------- | ------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------- |
| `sw.light_landing`  | LANDING  | toggle, rocker LIGHT white | OFF, ON; default OFF                        | 1047, 90 (8) | position (the hump appears shifted right of the display-gap centre in left-seat photos, parallax suspected), default | P650, P761, P807, SIM | `controls/lights.ts` |
| `sw.light_taxi`     | TAXI     | same                       | OFF, ON; default OFF                        | 1095, 90 (8) | position, default                                                                                                    | same                  | `controls/lights.ts` |
| `sw.light_position` | POSITION | same                       | OFF, ON; default ON (assumed lit in cruise) | 1143, 90 (8) | position, default                                                                                                    | same                  | `controls/lights.ts` |
| `sw.light_strobe`   | STROBE   | same                       | OFF, ON; default ON (assumed lit in cruise) | 1191, 90 (8) | position, default                                                                                                    | same                  | `controls/lights.ts` |

## Centre stack (region `light_knobs`, reserved audio, standby and autopilot outlines)

Two dimmer knobs between the displays (UI-SPEC rows 5 and 6). Rotary, radius 20, hit 60 x 60, arc scale printed around the disc, pointer angles in degrees clockwise from 12 o'clock. Dimmer stops have no visual effect on the panel in this phase (state only).

| Id               | Placard          | Assumed kind and skin  | Assumed states and default                                 | Centre (tol)  | What is uncertain                                                                            | Photos                | File to change      |
| ---------------- | ---------------- | ---------------------- | ---------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------- | --------------------- | ------------------- |
| `sw.instr_light` | INSTRUMENT LIGHT | rotary r 20, arc scale | OFF, 25, 50, 75, MAX at -135, -67, 0, 67, 135; default OFF | 1047, 238 (8) | states (stop count and labels), default, position (same parallax doubt as the light rockers) | P650, P807, P761, SIM | `controls/knobs.ts` |
| `sw.flood_light` | FLOOD LIGHT      | rotary r 20, arc scale | same stops; default OFF                                    | 1126, 238 (8) | same                                                                                         | same                  | `controls/knobs.ts` |

Reserved, not controls: the centre-stack plate (x 880..1240, y 185..560) carries three plain outlines for the audio column (892, 300, 76 x 248), the standby instrument (982, 300, 156 x 140) and the autopilot column (1152, 300, 76 x 248). They are placeholders for the avionics work of phase 01.2; their sizes are guesses and they start at y 300 only so the dimmer knobs stay clear. File: `src/ui/panel/PanelShell.tsx`.

## Left strip: de-ice panel (regions `deice`, `deice_switches`)

The de-ice unit in the top far left: six controls and three lamps, rebuilt by plans 21 and 22 from the owner's description (UI-SPEC rows 7 to 13 are superseded, see "Superseded by the owner findings"). Tolerance 12 for every row. The owner's unit settled the names and kinds (U-08); what is still open is marked per row. The unit heading is a white outlined frame with the words DE ICE. The region was split in two (PD-02). Lamps and the ALTERNATE guard are drawn on one plate (x 80..260, y 205..470).

| Id                     | Placard                                                                        | Assumed kind and skin                                                   | Assumed states and default                                                                                                                           | Centre (tol)  | What is uncertain                                                                                                                                | Photos             | File to change        |
| ---------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | --------------------- |
| `btn.deice_max`        | MAX (above the button)                                                         | momentary-button, black-dome (black glossy dome, bezel r 17), inert     | RELEASED, PRESSED; default RELEASED                                                                                                                  | 111, 254 (12) | owner finding G-1; kind (button versus switch) and the 120 s run, which is deferred to the engine phase                                          | owner de-ice photo | `controls/deice.ts`   |
| `sw.deice_mode`        | none of its own; placards HIGH (above), NORM (left of the middle), OFF (below) | toggle, bat, three positions, nameless (hit 40 x 90)                    | OFF, NORM, HIGH from bottom to top; default OFF                                                                                                      | 120, 342 (12) | owner finding G-1; the handle positions and the placard places                                                                                   | owner de-ice photo | `controls/deice.ts`   |
| `lt.deice_max`         | none                                                                           | amber lamp r 15, no caption, right of the mode toggle (top of three)    | lit only while a MAX run is active and the mode is HIGH; the run (120 s) is engine behaviour, so the lamp never lights yet (flag `deice.max_active`) | 164, 256 (12) | owner finding G-1; lamp colour, size and place; the 120 s run is deferred to the engine phase (no engine clock here)                             | owner de-ice photo | `indicators.ts`       |
| `lt.deice_high`        | none                                                                           | amber lamp r 15, no caption, right of the mode toggle (middle of three) | lit when the mode is HIGH                                                                                                                            | 164, 298 (12) | owner finding G-1; lamp colour, size and place                                                                                                   | owner de-ice photo | `indicators.ts`       |
| `lt.deice_norm`        | none                                                                           | white lamp r 15, no caption, right of the mode toggle (bottom of three) | lit when the mode is NORM                                                                                                                            | 164, 340 (12) | owner finding G-1; lamp size and place                                                                                                           | owner de-ice photo | `indicators.ts`       |
| `sw.deice_alternate`   | ALTERNATE as nine stacked upright letters left of the guard | guarded-toggle: the normal bat toggle (hit 52 x 100) under a translucent red guard cover; the guard is the only red part | ON (down), OFF (up, the guarded position); default OFF | 232, 296 (12) | owner finding G-1 (D-08 amended: no red rocker); the only guarded switch; the cover look, the lifted flap above it and the letters | owner de-ice photo | `controls/deice.ts`   |
| `btn.deice_windshield` | WIND / SHIELD (two lines above the button) | momentary-button, black-dome (bezel r 17), inert; replaces the WIND SHIELD toggle | RELEASED, PRESSED; default RELEASED; no spray effect yet | 113, 425 (12) | owner finding G-1; kind (button versus switch) | owner de-ice photo | `controls/buttons.ts` |
| `sw.deice_ice_light`   | none of its own; placards ICE LIGHT (above), OFF (right of the middle), ANNUN- / TEST (below) | toggle, bat, three positions, nameless (hit 30 x 69); replaces the ANNUN TEST button | ANNUN TEST, OFF, ICE LIGHT from bottom to top; default OFF; no simulated effect yet | 171, 425 (12) | owner finding G-1; maintained or spring-return ANNUN-TEST position (Q-02) | owner de-ice photo | `controls/deice.ts`   |
| `sw.deice_pump` | none of its own; placards PUMP 2 (above), PUMP 1 (below) | toggle, bat, two positions, nameless (hit 30 x 69); replaces the PUMP 1 and PUMP 2 toggles | PUMP 1 (down), PUMP 2 (up); default PUMP 1 (Q-03) | 227, 425 (12) | owner finding G-1; the default pump | owner de-ice photo | `controls/deice.ts` |

Removed by plan 22: `btn.deice_annun_test` (the ANNUN TEST button) is now the ANNUN TEST position of the toggle `sw.deice_ice_light`; `sw.deice_windshield` became the button `btn.deice_windshield`; `sw.deice_pump1` and `sw.deice_pump2` became the one toggle `sw.deice_pump`.

The compact bat variant (PD-08) is gone: every bat now has the one size. The unit heading reads DE ICE in a white outlined frame (`PLATE_HEADINGS` in `plates.ts`).

## Left strip: engine (region `engine_controls`)

Only one row needs review here. FADEC, ALTERNATOR 1 and ALTERNATOR 2 are confirmed (the owner called the alternator switches accurate) and keep the bat look of phase 1, repainted with a chrome handle. The engine plate was enlarged upward (top 474) so the FADEC name lies on it (G-5); FADEC prints no position text (Q-09).

| Id               | Placard           | Assumed kind and skin                                  | Assumed states and default          | Centre (tol) | What is uncertain                                                                                         | Photos    | File to change        |
| ---------------- | ----------------- | ------------------------------------------------------ | ----------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------- | --------- | --------------------- |
| `btn.fadec_test` | TEST (FADEC TEST) | momentary-button, small-black (r 9 bezel), hit 60 x 60 | RELEASED, PRESSED; default RELEASED | 206, 506 (3) | shape (a small toggle-like part is visible in the photo, a push button is assumed), position is confirmed | P650, SIM | `controls/buttons.ts` |

## Lower switch row (region `switch_bank`)

Nine controls under the primary display, one row at y 664, 85 units apart or less. Three rows need review; the others are confirmed (EMERG FUEL PUMP rocker M white, ENGINE START chrome-round, ENGINE MASTER bat with ball tip, ESS BUS rocker M white by owner decision, ELECT. MASTER rocker L red with ears, AV MASTER rocker M white).

| Id                    | Placard          | Assumed kind and skin                              | Assumed states and default                  | Centre (tol) | What is uncertain                                                                                         | Photos         | File to change            |
| --------------------- | ---------------- | -------------------------------------------------- | ------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------- | -------------- | ------------------------- |
| `sw.prop_deice`       | PROP DE-ICE      | toggle, rocker M white                             | OFF, ON; default OFF                        | 114, 664 (3) | default state, white versus other colour; position confirmed                                              | P650, SIM, PED | `controls/switch-bank.ts` |
| `sw.fuel_trans`       | FUEL TRANS       | rotary r 16 (was a toggle in phase 1), hit 66 x 70 | OFF, ON at -60 and +60 degrees; default OFF | 189, 664 (3) | kind (round knob in the photos), pointer angles, there may be more than two positions; position confirmed | P650, SIM      | `controls/switch-bank.ts` |
| `sw.pitot_stall_heat` | PITOT/STALL HEAT | toggle, rocker W white (widest, 48 x 46)           | OFF, ON; default ON                         | 801, 664 (3) | default state, width ratio against the other rockers; existence and position confirmed                    | P650, P386     | `controls/switch-bank.ts` |

The ESS BUS NOT FOR NORMAL OPERATION placard (four Micro lines centred at x 521) sits between the ENGINE MASTER and ESS BUS rockers. The text-overlap gate (`e2e/art-fit.spec.ts`) reports no overlap with any rocker since the state text was removed; widen or move the placard if it looks cramped on a real screen (`src/aircraft/da50rg/placards.ts`).

## Landing gear block and LEVEL (regions `landing_gear`, `level`)

The gear lever (confirmed), the STALL TEST / GEAR TEST toggle, the LEVEL button and the four gear lamps. The block reads from the top: the bracket header LANDING GEAR, the speed line VLE / VLO = 162 KIAS directly under it, then the lamps and the toggle (G-2). The plate was raised to y 580 so the GEAR name and the lever lie on it. The lamps are derived from `lv.gear` and cannot be operated or graded (PD-07). GEAR TEST now lights all four lamps including the red UNSAFE lamp (U-06 resolved; Q-13).

| Id | Placard | Assumed kind and skin | Assumed states and default | Centre (tol) | What is uncertain | Photos | File to change |
| -- | ------- | --------------------- | -------------------------- | ------------ | ----------------- | ------ | -------------- |
| `btn.stall_gear_test` (UI-SPEC `sw.stall_gear_test`) | STALL TEST (left caption), GEAR TEST (right caption) | momentary-button, spring-bat (one three-position spring toggle), hit 56 x 30 | NEUTRAL, STALL TEST, GEAR TEST; default NEUTRAL; the held side follows where the pointer goes down | 872, 686 (8) | one three-position part versus two separate parts; the held GEAR TEST lights all four gear lamps (owner finding, Q-13); centre 7 units right of the UI-SPEC 865 so the caption clears the bracket (PD-04) | P386, PED, SIM | `controls/buttons.ts` |
| `btn.level` | LEVEL (and the NO SMOKING placard beside it) | momentary-button, blue-dome r 16, hit 44 x 44 | RELEASED, PRESSED; default RELEASED | 1099, 674 (3) | function (assumed autopilot level, inert here), colour of the cap; position confirmed; it lies fully on the gear plate, no seam crosses it | P650, P807, PED | `controls/buttons.ts` |
| `lt.gear_nose` | NOSE | green lamp r 7, bezel r 9 | lit when the gear is down, or during GEAR TEST | 916, 682 (8) | position, count and colour are confirmed, exact coordinates are not | P386, PED, SIM | `indicators.ts` |
| `lt.gear_left` | LEFT | green lamp r 7 | same | 894, 714 (8) | position | same | `indicators.ts` |
| `lt.gear_right` | RIGHT | green lamp r 7 | same | 936, 714 (8) | position | same | `indicators.ts` |
| `lt.gear_unsafe` | UNSAFE | red lamp r 7 | lit during GEAR TEST only; the in-transit flag arrives in phase 3 and also the emergency extension does not light it | 860, 714 (8) | position; the transition is not modelled | same | `indicators.ts` |

No state text is printed under the cluster any more (the earlier GEAR DOWN LOCKED / GEAR UP / GEAR UNSAFE readout was removed by plans 13 to 15, G-0.1). The gear lever (`lv.gear`, gear-knob skin, UP at the top, default UP) is confirmed and not listed for review; the name GEAR above the knob stays (Q-08).

## Flap block (region `flaps`)

The flap lever is confirmed (`lv.flaps`, flaps-block skin, UP, T/O, LDG, default UP). The three flap lamps are assumptions, and so is the position of the RUBIN mark. The flap plate was raised to y 608 (the top of the flap art, G-4); the seam to the gear plate at x 1150 is clear of LEVEL and of the RUBIN mark.

| Id            | Placard      | Assumed kind and skin         | Assumed states and default | Centre (tol)  | What is uncertain                                                    | Photos          | File to change  |
| ------------- | ------------ | ----------------------------- | -------------------------- | ------------- | -------------------------------------------------------------------- | --------------- | --------------- |
| `lt.flap_up`  | UP           | green lamp r 7, caption right | lit when flaps are UP      | 1278, 629 (8) | position; green is confirmed                                         | P650, P761, PED | `indicators.ts` |
| `lt.flap_to`  | T/O 133 KIAS | white lamp r 7, caption right | lit when flaps are T/O     | 1274, 660 (8) | position, lit colour (white assumed), the speed value in the caption | P650, PED       | `indicators.ts` |
| `lt.flap_ldg` | LDG 121 KIAS | white lamp r 7, caption right | lit when flaps are LDG     | 1263, 689 (8) | position, lit colour (white assumed), the speed value in the caption | P650, PED       | `indicators.ts` |

RUBIN mark: text only, centred at (1232, 625) at the left of the flap block, replacing the airframe maker's wordmark. Its position and the 0.3 em tracking are estimates (`src/ui/panel/PanelShell.tsx`). No FLAPS state readout is printed; the lamps and the lever show the position.

## Right panel and bus panel (region `right_panel`)

| Id       | Placard | Assumed kind and skin                                        | Assumed states and default                                                       | Centre (tol)  | What is uncertain                                                                                                           | Photos          | File to change            |
| -------- | ------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------- |
| `sw.elt` | ELT     | toggle, rocker S red (22 x 38), hit 34 x 78, three positions | RESET / TEST (bottom), ARMED (middle), ON (top); default ARMED, no spring return | 1776, 656 (3) | owner finding G-6; whether the middle position rests there (Q-01); size ratio against the other rockers; position confirmed | P650, PED, P807 | `controls/switch-bank.ts` |
| `lt.elt` | none    | red lamp r 4, no caption, left of the rocker                 | lit when the ELT is ON                                                           | 1752, 656 (8) | owner finding G-6; exact position and size                                                                                  | same            | `indicators.ts`           |

The three ELT position placards ON, ARMED and RESET / TEST stand to the right of the rocker (`src/aircraft/da50rg/placards.ts`).

The bus panel (x 1836..1980, right of the strip plate so the ELT placards stay visible) is drawn as three bracket outlines with the headings ESSENTIAL BUS, MAIN BUS and AVIONICS BUS only. The first circuit breaker (`cb.pitot`, phase 01.2) stands in the new region `cb_essential` on the widened panel, right of this old bus rectangle until the new bus plate is drawn; the section "Circuit breakers (region `cb_essential`)" below lists it.

## Circuit breakers (region `cb_essential`)

The first circuit breaker proves the new control kind (PNL-12). Pushed in is the default: a flush cap with its amp rating and no ring. One tap pulls it out: the cap rises up and to the left with a shadow and a white ring stands around the socket. A second tap pushes it back in. No IN or OUT word is printed (G-0.1); the words exist only as the accessible name. Later plans of phase 01.2 add the other breakers to this section.

| Id | Placard | Assumed kind and skin | Assumed states and default | Centre (tol) | What is uncertain | Photos | File to change |
| -- | ------- | --------------------- | -------------------------- | ------------ | ----------------- | ------ | -------------- |
| `cb.pitot` | PITOT, rating 20 on the cap | circuit-breaker, hit 28 x 28, group essential | in, out; default in | 1978, 305 (8) | the label wording and the rating; the position inside the grid (third column, second row of the essential bus); the pulled look is not photographed | P738, P761 | `controls/breakers.ts` |

## Under panel (regions `under_panel_left`, `under_panel_centre`, `under_panel_right`)

Three pull handles below the face plate. States are confirmed for all three; only the look of the left handle is open.

| Id              | Placard          | Assumed kind and skin                                                              | Assumed states and default   | Centre (tol) | What is uncertain                                                                | Photos         | File to change            |
| --------------- | ---------------- | ---------------------------------------------------------------------------------- | ---------------------------- | ------------ | -------------------------------------------------------------------------------- | -------------- | ------------------------- |
| `lv.alt_static` | ALTERNATE STATIC | detent-lever, pull-t (red mushroom T-knob with a white PULL placard), hit 44 x 110 | OPEN, CLOSED; default CLOSED | 51, 805 (3)  | shape (T-knob versus another handle), colour; states were confirmed by the owner | P650, PED, SIM | `controls/under-panel.ts` |

For orientation, confirmed: `lv.emerg_gear` (pull-tab, red, drag-only, default NORMAL, 907, 805) and `lv.alt_air` (pull-boot, black with white vertical text, default CLOSED, 1205, 805). The two-line EMERGENCY GEAR EXTENSION name sits about 2 units above its region top at the stowed position.

## Environmental control and pedestal (regions `env_control`, `env_circ`, `pedestal`)

The environmental-control plate sits above the pedestal plate. It was rebuilt in plan 20 and the pedestal in plan 19 from the owner's side-view photo (G-3; U-09 and U-10 resolved): four outlined boxes with pictograms and no words, the parking brake pulled up to set, the cowl flap as a small lever with two lamps. The steps and stops of the sliders are still assumptions. Regions `env_control` and `env_circ` carry the plate, `pedestal` the lower plate (PD-01).

| Id                 | Placard                                           | Assumed kind and skin                                                            | Assumed states and default                                                                                | Centre (tol)   | What is uncertain                                                                        | Photos                    | File to change         |
| ------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------- | ------------------------- | ---------------------- |
| `lv.env_direction` | DIRECTION                                         | detent-lever, env-slider, vertical, three icons                                  | FEET, FACE, DEFROST (DEFROST at the top); default FACE; pictograms only                                   | 1004, 828 (8)  | default, order of the icons; three stops are confirmed                                   | PED, COCK, SIM            | `controls/pedestal.ts` |
| `lv.env_temp`      | TEMPERATURE                                       | detent-lever, env-slider, vertical, five steps                                   | COLD, 25, 50, 75, WARM; default 50; only COLD and WARM are printed, a triangle pictogram left of the slot | 1100, 880 (8)  | a continuous slider is modelled as five steps, default                                   | PED, COCK, SIM            | `controls/pedestal.ts` |
| `sw.env_fan`       | FAN                                               | rotary r 14, three fan symbols small to large                                    | OFF, 1, 2, 3 at 180, 300, 360, 420 degrees; default OFF; only OFF is printed                              | 1020, 932 (8)  | stop count, angles, default                                                              | PED, SIM                  | `controls/knobs.ts`    |
| `lv.env_circ`      | CIRCULATING AIR                                   | detent-lever, env-slider, the only horizontal track                              | FRESH, RECIRC; default FRESH; pictograms only, region `env_circ`                                          | 1063, 1010 (8) | which end is fresh air and which is recirculation, icon meaning                          | PED, SIM                  | `controls/pedestal.ts` |
| `lv.parking_brake` | PARKING BRAKE (plate placard, two lines)          | detent-lever, parking-lever (small lever), nameless, no legends                  | OFF (bottom), SET (top, pulled up); default OFF                                                           | 1008, 1110 (8) | owner finding G-3; the exact look of the lever; position from the side-view photo        | PED, SIM, side view       | `controls/pedestal.ts` |
| `lv.power`         | THROTTLE (plate placard; the id stays `lv.power`) | detent-lever, power-grip, nameless, legends 0 %, 50 %, 100 %                     | 0 to 100 percent in 5 percent steps; default 70 percent                                                   | 1115, 1160 (8) | owner finding G-3; position from the side-view photo                                     | PED, COCK, SIM, side view | `controls/pedestal.ts` |
| `lv.cowl_flap`     | COWL FLAP (plate placard)                         | detent-lever, cowl-slider (small lever acting as a switch), nameless, no legends | CLOSED (bottom), OPEN (top); default CLOSED                                                               | 1058, 1218 (8) | owner finding G-3; position and size of the small lever; default is an assumption (U-04) | PED, SIM, side view       | `controls/pedestal.ts` |
| `lt.cowl_open`     | OPEN                                              | white lamp r 5, caption above                                                    | lit when the cowl flap is OPEN                                                                            | 1022, 1188 (8) | owner finding G-0.3; position, lit colour (white assumed)                                | side view                 | `indicators.ts`        |
| `lt.cowl_closed`   | CLOSED                                            | white lamp r 5, caption above                                                    | lit when the cowl flap is CLOSED                                                                          | 1022, 1248 (8) | owner finding G-0.3; position, lit colour (white assumed)                                | side view                 | `indicators.ts`        |

The pedestal (PARKING BRAKE, THROTTLE, COWL FLAP) sits on its own plate below the environmental control plate (plan 19); the placards and the cowl-flap lamp captions are static plate text (`src/aircraft/da50rg/placards.ts`). The default of the cowl flap is an assumption (U-04). The temperature slider prints only COLD and WARM beside a triangle pictogram; the fan prints only OFF.

## Shell and placards (static art, no region)

All static art lives in `src/ui/panel/PanelShell.tsx` and carries no handler; plates are data in `src/aircraft/da50rg/plates.ts` and placards are data in `src/aircraft/da50rg/placards.ts`. Outline coordinates are redrawn approximations of the photo silhouettes (U-12). The plate rectangles below are the ones the art-fit gate (`e2e/art-fit.spec.ts`) measures every control and caption against; the open list of that gate is empty, so every control, lamp and caption lies on its plate.

| Plate (id) | Rectangle x, y, w, h | Regions it carries |
| ---------- | -------------------- | ------------------ |
| Lights recess (`lights-recess`) | 940, 36, 360, 134 | `lights` |
| Centre stack (`centre-stack`) | 880, 185, 360, 375 | `light_knobs` |
| De-ice unit (`deice`) | 80, 205, 180, 265 | `deice`, `deice_switches` |
| Engine (`engine`) | 70, 474, 200, 141 | `engine_controls` |
| Switch row (`strip-switch-row`) | 40, 620, 796, 125 | `switch_bank` |
| Landing gear and LEVEL (`strip-gear`) | 836, 580, 314, 165 | `landing_gear`, `level` |
| Flaps and right panel (`strip-flaps`) | 1150, 608, 680, 137 | `flaps`, `right_panel` |
| Environmental control (`environmental`) | 962, 752, 201, 284 | `env_control`, `env_circ` |
| Pedestal (`pedestal`) | 962, 1046, 201, 242 | `pedestal` |

Other shell items:

| Item | Chosen value |
| ---- | ------------ |
| Face plate edge highlight and shadow | 1-unit strokes on the plate edge |
| Coaming stitch line | the hump path shifted 8 down |
| Console side walls | 14 wide at x 937..951 and 1174..1188 from y 763, stitching inset 8 |
| Centre-stack outlines | three plain outlines (see Centre stack) |
| LANDING GEAR bracket | line y 630 from 846 to 986, header baseline 640, speed line baseline 654 (`GEAR_BLOCK`) |
| DE ICE heading | white outlined frame x 118..182, y 209..225, text size 8 (`PLATE_HEADINGS`) |
| Environmental group boxes | DIRECTION, TEMPERATURE, FAN, CIRCULATING AIR (`ENV_BOXES`), plate title at (1062, 766) |
| ESS BUS NOT FOR NORMAL OPERATION placard | four Micro lines centred at x 521, baselines 650 to 671 |
| Bus panel brackets | plate x 1836..1980, brackets at x 1846; ESSENTIAL y 225..365, MAIN y 375..565, AVIONICS y 575..735 |
| Vent | centre (60, 700), r 28 with three inner rings |
| NO SMOKING placard | x 965..1029, y 725..739 |
| Fuel placard | x 1560..1700, y 640..700, five decorative bars, no real text |
| Nameplate | x 485..635, y 106..134, text DA50RG centred at (560, 125) |
| RUBIN | centre (1232, 625) |
| GO-AROUND | centred above each display bezel at region-local (w/2, -6) |

Seen in the build and resolved: the earlier remark that the NO SMOKING plate sat where the GEAR state text was drawn is obsolete (no state text exists any more); the ESS BUS placard no longer overlaps a rocker according to the text-overlap gate. One visible trade-off remains: the two-line EMERGENCY GEAR EXTENSION name starts at global y 741, so its first line straddles the lower face-plate edge at 745 (there is no room to place it fully below without covering the tab handle); the gate measures it inside its region. Contrast: the end placards on the raised half of the red rockers are white on `#e5323c`, about 4.4:1, just below 4.5:1.

## Glass areas (regions `pfd`, `mfd`)

| Item                         | What was done                                                                                                       | What is uncertain                                                                        | File to change                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Glass-digit snap (U-14)      | every glass font size was mapped to the declared scale 6, 8, 10, 14: 9 to 12 became 10, 13 to 22 became 14          | the large gauge readouts shrank from 20 and 22 to 14; the owner may ask for a fifth size | `src/ui/panel/frames/PfdFrame.tsx`, `MfdFrame.tsx`, `ArcGauge.tsx`, `BarGauge.tsx` |
| ENGINE softkey stroke (U-15) | `sw.mfd_page` (confirmed control) shows its selected state with a 2.5-unit white stroke instead of the earlier blue | the colour of the selected mark                                                          | `src/ui/panel/widgets/Toggle.tsx`                                                  |

## UI-SPEC unconfirmed items

The numbered list of the UI-SPEC, each with what the plans assumed.

| Item                                 | What the plans assumed and how to change it                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **U-01** ESS BUS colour              | RESOLVED 2026-10-20: white rocker, size M, by owner decision (photos over the earlier medium red); kept for the record. `colour: 'white'` on `sw.ess_bus` in `controls/switch-bank.ts`; no layout impact.                                                                                                                           |
| **U-02** Rocker size ratios          | ELT small (22 x 38), ESS BUS, AV MASTER, EMERG FUEL PUMP and PROP DE-ICE medium (28 x 46), ELECT. MASTER large (32 x 52 with ears), PITOT/STALL HEAT wide (48 x 46), light rockers 26 x 54. Proposals within about 10 percent. Change `size` in the data files; the proportions live in `src/ui/panel/skins/Rocker.tsx`. |
| **U-03** Unconfirmed positions       | the four light rockers and the dimmer knobs (parallax suspected), everything in the de-ice unit, the gear lamp and test toggle positions, the flap lamp positions, the ELT lamp, the cowl-flap lamps, and the environmental plate and its controls. Change the control position and its reference row together.                                                       |
| **U-04** Default states              | POSITION and STROBE on in cruise, LANDING and TAXI off; PROP DE-ICE off; EMERG FUEL PUMP off; FUEL TRANS off; PITOT/STALL HEAT on; FAN off; DIRECTION FACE; TEMPERATURE 50; cowl flap closed; ELT armed. Change `default` in the data file.                                                                                         |
| **U-05** FUEL TRANS                  | a round knob with OFF and ON at -60 and +60 degrees; the real knob may have more than two positions. `controls/switch-bank.ts`.                                                                                                                                                                                                     |
| **U-06** STALL TEST and GEAR TEST    | RESOLVED 2026-10-21: the owner confirmed the implementation; GEAR TEST now lights all four gear lamps (Q-13). One three-position spring toggle instead of two parts is kept. `controls/buttons.ts`, `indicators.ts`.                                                                                                                                                                               |
| **U-07** Flap lamp colour and UNSAFE | T/O and LDG lamps lit white; the red UNSAFE lamp is not lit during emergency gear extension, only `lv.gear` drives the lamps. `indicators.ts`.                                                                                                                                                                                      |
| **U-08** De-ice names and kinds      | RESOLVED 2026-10-21: superseded by the owner's unit (mode toggle HIGH / NORM / OFF, MAX button, WIND SHIELD button, ICE LIGHT / OFF / ANNUN-TEST toggle, one PUMP toggle, guarded ALTERNATE); see "Superseded by the owner findings". What is still unconfirmed: Q-02 and Q-03. `controls/deice.ts`.                                                              |
| **U-09** Environmental controls      | RESOLVED 2026-10-21: the owner answered the fresh and recirculation ends and the layout of the four boxes (plan 20). The step counts (three, five and two stops, fan with three speeds) stay as built. `controls/pedestal.ts`, `controls/knobs.ts`.                                                                                                                                                                              |
| **U-10** PARKING BRAKE               | RESOLVED 2026-10-21: the owner answered that the brake is set by pulling the lever up; it is a small lever with no legends. `controls/pedestal.ts`.                                                                                                                                                                                                                              |
| **U-11** LEVEL button                | assumed autopilot emergency level, inert here. `controls/buttons.ts`.                                                                                                                                                                                                                                                               |
| **U-12** Shell outline coordinates   | coaming, hump and plate edges are redrawn approximations of the photo silhouettes; see the Shell table. `src/ui/panel/PanelShell.tsx`.                                                                                                                                                                                              |
| **U-13** Open items                  | RESOLVED for the lamps 2026-10-21: the cowl-flap lamps `lt.cowl_open` and `lt.cowl_closed` and the ELT lamp `lt.elt` are now drawn. The rudder trim, the pedals adjustment and the left far panel strip stay undrawn; see "Open items not drawn".                                                                                                                                                                                                                                      |
| **U-14** Glass-digit snap            | large gauge readouts shrank to 14 (see Glass areas).                                                                                                                                                                                                                                                                                |
| **U-15** ENGINE softkey stroke       | the selected stroke changed from blue to white (see Glass areas).                                                                                                                                                                                                                                                                   |

## Open items not drawn

Listed from the UI-SPEC, not drawn as controls and not in the registry (D-10). The cowl-flap position lamps and the ELT status lamp, which were open here before, are drawn now (`lt.cowl_open`, `lt.cowl_closed`, `lt.elt`; U-13).

| Item                                                                  | Why open                                                                | Photo     |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------- |
| RUDDER TRIM rocker on the POWER handle                                | visible only in the simulator image; real location and kind unconfirmed | SIM       |
| RUDDER PEDALS ADJUSTMENT rocker at the far lower left                 | simulator image only                                                    | SIM       |
| Any control behind the left far panel strip below the vent            | not photographed                                                        | none      |

## Planner decisions

Decisions the plans took that go beyond the UI-SPEC. Each lists the reason and what it costs to undo.

| Decision                                                                                                                                                | Reason and cost of undoing                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PD-01** Pedestal split into `env_control` (top, 957, 750, 211 x 265) and `pedestal` (bottom, 957, 1015, 211 x 275)                                    | In one 540-tall region the 734 x 315 phone shows 0.56 px per unit and the POWER handle would reach only 34 px, below the 44 px guarantee. Undo: merge the two entries in `REGIONS` (`panel.ts`), move the local coordinates of the five controls, and accept that the tap-size test for POWER fails. |
| **PD-02** De-ice split into `deice` (MAX, mode toggle, lamps and ALTERNATE) and `deice_switches` (the lower row)                                                | One 190-tall region cannot give the four-position selector 44 px per detent on the phone. Undo: merge the regions and shift the local coordinates of five controls; the zoom tap-size test then fails for MODE.                                                                                      |
| **PD-03** The UI-SPEC id `sw.deice_mode` was registered as `lv.deice_mode` (superseded by plan 21: the mode selector is now the toggle `sw.deice_mode`) | The registry kind-prefix rule needs `lv.` for a detent lever. Undo: change the kind to a toggle or rotary, or relax the prefix rule; scenarios use `sw.deice_mode`.                                                                                                                                  |
| **PD-04** The UI-SPEC id `sw.stall_gear_test` is registered as `btn.stall_gear_test`, a three-state momentary part                                      | A spring-return part is a momentary control under the kind-prefix rule. It is also centred at x 872, 7 units right of the UI-SPEC 865 (tolerance 8), so the caption clears the bracket. Undo: rename the id (one entry plus the reference row).                                                      |
| **PD-05** FAN and TEMPERATURE moved within tolerance: FAN to (1032, 896), TEMPERATURE to (1096, 862) (superseded by plan 20: the environmental positions were rebuilt, FAN is now at 1020, 932 and TEMPERATURE at 1100, 880)                                                    | The 80 x 40 FAN footprint would otherwise overlap the DIRECTION and TEMPERATURE sliders. Undo: move the controls back to 1036, 888 and 1092, 862; the footprint no-overlap test then fails.                                                                                                          |
| **PD-06** Hit rects narrowed: `sw.fadec` 66 wide, the three under-panel levers 44 wide                                                                  | Each region keeps at least 7 units of free background so a tap on it still zooms. Undo: restore 74 and 60 and lose the free background (the clearance test fails).                                                                                                                                   |
| **PD-07** The thirteen lamps live outside the control registry (seven gear and flap lamps at the time, now also the ELT lamp, two cowl-flap lamps and three de-ice lamps)                                                                                             | A lamp has no hit rect, handler or event, so it cannot be operated, dispatched or graded; the store answers any `lt.` id with unknown. Undo: add an indicator kind to the registry and the store; costly because every invariant test then has to learn it.                                          |
| **PD-08** Compact bat variant for the four de-ice switches (superseded by plan 22: the variant is removed)                                                                                              | Their footprints are under 39 tall. The compact bat (throw 8, handle 4, ring r 6, Micro 6 name above, state text 8 inside) avoids overprinting the ANNUN TEST label. Undo: drop the variant in `src/ui/panel/skins/Bat.tsx` and enlarge the footprints, which needs room the neighbours do not have. |

Added by the lever plan, not part of the PD-01 to PD-08 list: lever names are drawn after the track art and above the highest handle position (never above the region top); skinned vertical levers print their detent legends to the right of the visible handle; the MODE state text sits left of its track; the pull handles have no entry plate. All in `src/ui/panel/widgets/DetentLever.tsx` and `src/ui/panel/skins/LeverHandles.tsx`.

## Superseded by the owner findings

Ids of the first render that the owner's de-ice unit made obsolete. They are removed from the registry; the tests check that they are gone (`tests/panel-labels.test.ts`). UI-SPEC rows 7 to 13 and U-08 refer to them and are kept only for the record.

| Removed id | Removed in | Replacement | What the owner changed |
| ---------- | ---------- | ----------- | ---------------------- |
| `lv.deice_mode` | plan 21 | `sw.deice_mode` | the four-position MAX / HIGH / NORM / OFF lever became a three-position toggle (OFF, NORM, HIGH) plus the separate button `btn.deice_max` and three lamps |
| `sw.deice_windshield` | plan 22 | `btn.deice_windshield` | the WIND SHIELD toggle is a momentary push button |
| `sw.deice_pump1` | plan 22 | `sw.deice_pump` | the two PUMP toggles are one two-way toggle (PUMP 2 up, PUMP 1 down) |
| `sw.deice_pump2` | plan 22 | `sw.deice_pump` | same |
| `btn.deice_annun_test` | plan 22 | the third position of `sw.deice_ice_light` | ANNUN TEST is the lower position of the ICE LIGHT toggle, not a button |

Net effect on the inventory: 42 controls before, 41 now (the lever, the WIND SHIELD toggle, the two PUMP toggles and the ANNUN TEST button are gone; the mode toggle, MAX, the WIND SHIELD button and the single PUMP toggle are new).

## Gap-closure decisions

Decisions of plans 12 to 22 that go beyond the owner findings. Each lists what it costs to undo.

| Decision | Reason and cost of undoing |
| -------- | -------------------------- |
| **GC-01** Three-position toggles live in the toggle kind (states may have three entries; only rocker and bat skins accept three; softkey and guarded toggles stay two-state) | The ELT, the mode toggle and the ICE LIGHT toggle needed a middle position without a new control kind. Undo: add a new kind to the registry, the store and every invariant test. |
| **GC-02** Plates are data (`plates.ts`) | The art-fit gate compares every control with its plate. Undo: move the rectangles back into `PanelShell.tsx` and give up the gate, or edit the data and the gate together. |
| **GC-03** Placards are data (`placards.ts`), positioned relative to a control id | A placard follows the control when it is moved. Undo: write them as shell text with absolute coordinates; every move then needs a second edit. |
| **GC-04** The `nameless` and `legends` options on controls | The environmental, pedestal and de-ice controls print nothing of their own; the plate prints the words or pictograms. Undo: drop the options and print the name again (the static-text gate then needs the names as static text). |
| **GC-05** The region `env_circ` was added (19 regions) | CIRCULATING AIR is the wide horizontal track across the bottom of the plate (region x 957, y 990, 211 x 50), split from `env_control` as in PD-01 and PD-02 so it zooms to full tap size on its own. Undo: merge it into `env_control`, move the local coordinates and re-check the tap-size gate. |
| **GC-06** ALTERNATE keeps the state order OFF (up, guarded position) then ON (down) | The owner wants an ordinary toggle under a red guard; the guard is the only red part. Undo: swap the two entries in `controls/deice.ts` and the reference row. |
| **GC-07** Colours of the de-ice lamps: top amber, middle amber, bottom white | Taken from the owner's description (amber for MAX and HIGH, white for NORM). Undo: change `colour` in `indicators.ts`. |
| **GC-08** The flag `deice.max_active` drives the MAX lamp; nothing sets it yet | The 120 s run needs an engine clock, which does not exist before the scenario phases. Undo is not needed: the engine phase sets the flag (todo `2026-10-21-deice-max-timer-engine.md`). |
| **GC-09** The compact bat variant is removed; every bat throws 14 | One look for all bats keeps the toggles readable (G-0.4). Undo: restore the variant in `skins/Bat.tsx` and enlarge the footprints. |
| **GC-10** Hit rects of the two lower de-ice toggles are 69 tall | At 66 the pinch-in tap size came to 43.2 px, below the 44 px guarantee. Undo: shrink to 66 and relax the tap-size gate. |
| **GC-11** The built-panel text gate skips text in the PFD and MFD glass unless it belongs to a control | Glass text is instrument data and changes with the MFD page. Undo: make the gate compare glass text per page. |
| **GC-12** GEAR TEST lights all four lamps whatever the lever says | Owner finding G-2 (amends U-06 and D-11). Undo: one derive function in `indicators.ts`. |

## Round 2: morning review

Nothing was published. This is the list of what to look at first. All of it is local on the phase branch; publishing is your step.

1. **Label table and its questions.** Open [PANEL-LABELS.md](PANEL-LABELS.md). It lists every static label and placard of every control and lamp. Questions Q-01 to Q-14 each carry the default taken (all fourteen defaults were taken, nothing blocks); a different answer is a data edit in the file named in the table row.
2. **The rebuilt areas.** After you publish, look at these on the live site: the de-ice unit (heading, MAX, mode toggle and three lamps, guarded ALTERNATE, the lower row), the landing gear block (heading, speed line, lamps, GEAR TEST lighting all four), the ELT (three positions, lamp, placards), the environmental control (four boxes, pictograms), the pedestal (parking brake pulled up, throttle, cowl flap with two lamps), the flap block (plate top, LEVEL and RUBIN clear of the seam), FADEC (plate top) and LEVEL (fully on the gear plate).
3. **Rockers readable at a glance (G-0.4).** The position shows by the side perspective only, with no ON or OFF text. Check this on a phone as well as on a desktop; if it is not clear enough the fix is in `skins/Rocker.tsx` and `skins/Bat.tsx`.
4. **Open list of the art-fit gate.** None remains: the lists `KNOWN_OPEN`, `TEXT_OVERLAP_KNOWN` and `FOOTPRINT_KNOWN_OPEN` are empty. One visible trade-off: the EMERGENCY GEAR EXTENSION name straddles the lower face-plate edge (see the Shell section).
5. **Areas without explicit approval.** You approved parts of the first render; areas 1, 2 and 4 to 12 of the first review list were reported with no other corrections (owner findings G-6), which is not an explicit approval. Area 12 (the phone behaviour) needs a real iPhone: zoom in by tapping a region background, a single tap on the background zooms out, the Full panel button, and tap sizes of small controls.
6. **Deferred behaviour (engine phase).** The 120 s MAX run (the flag `deice.max_active`), the ANNUN-TEST self-test, the WIND SHIELD spray, the ICE LIGHT effect, and the ELT lamp behaviour in RESET / TEST. Reason: no engine clock or reaction layer exists before the scenario phases, and these controls only record state here. Todo: `.planning/todos/pending/2026-10-21-deice-max-timer-engine.md`.
7. **Assumptions taken in plans 12 to 22.** The fourteen label defaults Q-01 to Q-14; the MFD softkey legend ENGINE (Q-10); the DIRECTION pictograms right of the slot; the fan symbol labels 1, 2, 3 stay as data but are not drawn; the temperature triangle 8 wide, 18 left of the slot; the mode toggle label `DE-ICE MODE` and lamp labels `DE-ICE MAX`, `DE-ICE HIGH`, `DE-ICE NORM` (aria only); the NORM placard baseline 349 and HIGH centred on the toggle; pump default PUMP 1, ANNUN-TEST maintained; registry label `DE-ICE PUMP`; the ALTERNATE guard cover as an inset block with three hatch bars; WIND SHIELD split into two lines at size 6; the cowl-flap lamps white and each lit in its own position; the ELT lamp lit in ON only; the throttle label THROTTLE with the id `lv.power`; placard line pitch 7 for size 6 and 10 for size 8; the flap region grown 5 units upward (the MFD softkey region ends at 608); the gear plate top at 580 drawn under the PFD bezels; the bus panel moved right to x 1836; the no-state-text rule applied to the glass only for control text.
8. **Publishing.** The phase branch holds the commits; no push, tag or pull request was made. Publishing is the owner's step.

## Phase 01.2: decisions and open items

Decisions of phase 01.2 (circuit breakers, display shapes, avionics units). Later plans of the phase append rows here.

| Decision | Reason and cost of undoing |
| -------- | -------------------------- |
| **P2-01** The panel space was widened from 2000 to 2180 by the owner (Q2-01 RESOLVED); the 180 units are only on the right, nothing left of x 1980 moved | Reason: the real breaker grid needs the real pitch of 36 units, about 260 units of width, and only about 144 units were free. Cost of undoing: redo the bus panel numbers and five spec literals (smoke viewBox, full-view string, pinch width, art-fit viewport, layout test), and the shell paths. Cost of keeping: about 8 percent smaller scale on tablet (0.433 against 0.472) and portrait phone (0.180 against 0.197); desktop and phone landscape are unchanged. |
| **P2-02** `MIN_VIEW_WIDTH` stays 200 | Every planned breaker hit side is at least 24 units; times the portrait pinch scale 1.965 that is 47 px, above the 44 px target, so the draft proposal to lower it to 100 is withdrawn. Cost of undoing: none, one constant. |
| **P2-03** The circuit-breaker pulled state shows a raised cap and a white ring and no IN or OUT text: the owner rule G-0.1 (static labels only) overrides the earlier wording of D-02, ROADMAP success criterion 1 and PNL-12 | Reason: nothing printed on the panel may change with a control state. IN and OUT exist only as the accessible state names. The ROADMAP criterion and PNL-12 were reworded to match. Cost of undoing: one skin function (`src/ui/panel/skins/Breaker.tsx`) and two wording lines (ROADMAP and REQUIREMENTS). |
