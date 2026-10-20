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

## Centre stack (region `light_knobs`, reserved audio, standby and autopilot outlines)

Two dimmer knobs between the displays (UI-SPEC rows 5 and 6). Rotary, radius 20, hit 60 x 60, arc scale printed around the disc, pointer angles in degrees clockwise from 12 o'clock. Dimmer stops have no visual effect on the panel in this phase (state only).

| Id | Placard | Assumed kind and skin | Assumed states and default | Centre (tol) | What is uncertain | Photos | File to change |
|----|---------|-----------------------|----------------------------|--------------|-------------------|--------|----------------|
| `sw.instr_light` | INSTRUMENT LIGHT | rotary r 20, arc scale | OFF, 25, 50, 75, MAX at -135, -67, 0, 67, 135; default OFF | 1047, 238 (8) | states (stop count and labels), default, position (same parallax doubt as the light rockers) | P650, P807, P761, SIM | `controls/knobs.ts` |
| `sw.flood_light` | FLOOD LIGHT | rotary r 20, arc scale | same stops; default OFF | 1126, 238 (8) | same | same | `controls/knobs.ts` |

Reserved, not controls: the centre-stack plate (x 880..1240, y 185..560) carries three plain outlines for the audio column (892, 300, 76 x 248), the standby instrument (982, 300, 156 x 140) and the autopilot column (1152, 300, 76 x 248). They are placeholders for the avionics work of phase 01.2; their sizes are guesses and they start at y 300 only so the dimmer knobs stay clear. File: `src/ui/panel/PanelShell.tsx`.

## Left strip: de-ice panel (regions `deice`, `deice_switches`)

Nine controls in the top far left (UI-SPEC rows 7 to 13). Tolerance 12 for every row except the confirmed ALTERNATE switch. The state names and kinds were read from a small placard and should be checked against the supplement for the ice-protection system before any scenario uses them. The region was split in two (PD-02).

| Id | Placard | Assumed kind and skin | Assumed states and default | Centre (tol) | What is uncertain | Photos | File to change |
|----|---------|-----------------------|----------------------------|--------------|-------------------|--------|----------------|
| `lv.deice_mode` (UI-SPEC `sw.deice_mode`) | MODE (placard MAX / HIGH / NORM / OFF) | detent-lever, bat-small (small chrome bat, vertical track 67.5, hit 30 x 90) | OFF, NORM, HIGH, MAX (MAX at the top); default OFF | 129, 345 (12) | kind (selector versus switch), state names and count, shape of the bat, the id differs from the UI-SPEC (PD-03) | P650, SIM | `controls/gear-flaps.ts` |
| `sw.deice_alternate` | ALTERNATE | guarded-toggle, rocker M red under a translucent red cover | OFF, ON; default OFF | 203, 342 (12) | confirmed by the owner (listed for orientation): the only guarded switch; guard art and the two-line GUARD placard right of the cover are new | P650, SIM | `controls/deice.ts` |
| `sw.deice_windshield` | WIND SHIELD | toggle, compact bat | OFF, ON; default OFF | 129, 410 (12) | kind (bat versus rocker), states | P650, SIM | `controls/deice.ts` |
| `sw.deice_ice_light` | ICE LIGHT | toggle, compact bat | OFF, ON; default OFF | 176, 410 (12) | kind, states | P650, SIM | `controls/deice.ts` |
| `sw.deice_pump2` | PUMP 2 | toggle, compact bat | OFF, ON; default OFF | 222, 410 (12) | kind, states, order of the pumps | P650, SIM | `controls/deice.ts` |
| `btn.deice_annun_test` | ANNUN TEST | momentary-button, small-black (r 9 bezel), inert | RELEASED, PRESSED; default RELEASED | 150, 447 (12) | kind (button versus spring toggle), function (inert here), label drawn on one Micro line | P650, SIM | `controls/buttons.ts` |
| `sw.deice_pump1` | PUMP 1 | toggle, compact bat | OFF, ON; default OFF | 205, 447 (12) | kind, states | P650, SIM | `controls/deice.ts` |

Compact bat variant (PD-08): throw 8, handle width 4, bezel ring r 6, name in Micro 6 just above the footprint, state text 8 inside the footprint under the ring, no lamp dot. Seen in the build: the PUMP 1 name comes within about 1 unit of the PUMP 2 state text, and WIND SHIELD sits close to the MODE OFF position. Check both on the first render.

## Left strip: engine (region `engine_controls`)

Only one row needs review here. FADEC, ALTERNATOR 1 and ALTERNATOR 2 are confirmed (the owner called the alternator switches accurate) and keep the bat look of phase 1, repainted with a chrome handle.

| Id | Placard | Assumed kind and skin | Assumed states and default | Centre (tol) | What is uncertain | Photos | File to change |
|----|---------|-----------------------|----------------------------|--------------|-------------------|--------|----------------|
| `btn.fadec_test` | TEST (FADEC TEST) | momentary-button, small-black (r 9 bezel), hit 60 x 60 | RELEASED, PRESSED; default RELEASED | 206, 506 (3) | shape (a small toggle-like part is visible in the photo, a push button is assumed), position is confirmed | P650, SIM | `controls/buttons.ts` |

## Lower switch row (region `switch_bank`)

Nine controls under the primary display, one row at y 664, 85 units apart or less. Three rows need review; the others are confirmed (EMERG FUEL PUMP rocker M white, ENGINE START chrome-round, ENGINE MASTER bat with ball tip, ESS BUS rocker M white by owner decision, ELECT. MASTER rocker L red with ears, AV MASTER rocker M white).

| Id | Placard | Assumed kind and skin | Assumed states and default | Centre (tol) | What is uncertain | Photos | File to change |
|----|---------|-----------------------|----------------------------|--------------|-------------------|--------|----------------|
| `sw.prop_deice` | PROP DE-ICE | toggle, rocker M white | OFF, ON; default OFF | 114, 664 (3) | default state, white versus other colour; position confirmed | P650, SIM, PED | `controls/switch-bank.ts` |
| `sw.fuel_trans` | FUEL TRANS | rotary r 16 (was a toggle in phase 1), hit 66 x 70 | OFF, ON at -60 and +60 degrees; default OFF | 189, 664 (3) | kind (round knob in the photos), pointer angles, there may be more than two positions; position confirmed | P650, SIM | `controls/switch-bank.ts` |
| `sw.pitot_stall_heat` | PITOT/STALL HEAT | toggle, rocker W white (widest, 48 x 46) | OFF, ON; default ON | 801, 664 (3) | default state, width ratio against the other rockers; existence and position confirmed | P650, P386 | `controls/switch-bank.ts` |

The ESS BUS NOT FOR NORMAL OPERATION placard (four Micro lines centred at x 521) sits close to the visible parts of the ENGINE MASTER and ESS BUS rockers; widen or move it if it collides in the first render (`src/ui/panel/PanelShell.tsx`).

## Landing gear block and LEVEL (regions `landing_gear`, `level`)

The gear lever (confirmed), the STALL/GEAR TEST part, the LEVEL button and the four gear lamps. The lamps are derived from `lv.gear` and cannot be operated or graded (PD-07).

| Id | Placard | Assumed kind and skin | Assumed states and default | Centre (tol) | What is uncertain | Photos | File to change |
|----|---------|-----------------------|----------------------------|--------------|-------------------|--------|----------------|
| `btn.stall_gear_test` (UI-SPEC `sw.stall_gear_test`) | STALL TEST / GEAR TEST | momentary-button, spring-bat (one three-position spring toggle, horizontal throw 10), hit 56 x 30 | NEUTRAL, STALL TEST, GEAR TEST; default NEUTRAL; the held side follows where the pointer goes down | 872, 649 (8) | one three-position part versus two separate parts, function (GEAR TEST does not light the lamps here), centre moved 7 units right of the UI-SPEC 865 so the caption clears the bracket (PD-04) | P386, PED, SIM | `controls/buttons.ts` |
| `btn.level` | LEVEL | momentary-button, blue-dome r 16, hit 44 x 44, state text 8 | RELEASED, PRESSED; default RELEASED | 1099, 674 (3) | function (assumed autopilot level, inert here), colour of the cap; position confirmed | P650, P807, PED | `controls/buttons.ts` |
| `lt.gear_nose` | NOSE | green lamp r 7, bezel r 9 | lit when the gear is down | 916, 660 (8) | position, count and colour are confirmed, exact coordinates are not | P386, PED, SIM | `indicators.ts` |
| `lt.gear_left` | LEFT | green lamp r 7 | lit when the gear is down | 894, 689 (8) | position | same | `indicators.ts` |
| `lt.gear_right` | RIGHT | green lamp r 7 | lit when the gear is down | 936, 690 (8) | position | same | `indicators.ts` |
| `lt.gear_unsafe` | UNSAFE | red lamp r 7 | lit only while the gear is in transit or disagrees; never lit in this phase | 860, 688 (8) | position; transition is not modelled, the in-transit flag arrives in phase 3; also not lit during emergency extension | same | `indicators.ts` |

Readout text under the cluster (GEAR DOWN LOCKED, GEAR UP, GEAR UNSAFE) is original to this trainer. Gear lever (`lv.gear`, gear-knob skin, UP at the top, default UP) is confirmed and not listed for review.

## Flap block (region `flaps`)

The flap lever is confirmed (`lv.flaps`, flaps-block skin, UP, T/O, LDG, default UP). The three flap lamps are assumptions, and so is the position of the RUBIN mark.

| Id | Placard | Assumed kind and skin | Assumed states and default | Centre (tol) | What is uncertain | Photos | File to change |
|----|---------|-----------------------|----------------------------|--------------|-------------------|--------|----------------|
| `lt.flap_up` | UP | green lamp r 7, caption right | lit when flaps are UP | 1278, 629 (8) | position; green is confirmed | P650, P761, PED | `indicators.ts` |
| `lt.flap_to` | T/O 133 KIAS | white lamp r 7, caption right | lit when flaps are T/O | 1274, 660 (8) | position, lit colour (white assumed), the speed value in the caption | P650, PED | `indicators.ts` |
| `lt.flap_ldg` | LDG 121 KIAS | white lamp r 7, caption right | lit when flaps are LDG | 1263, 689 (8) | position, lit colour (white assumed), the speed value in the caption | P650, PED | `indicators.ts` |

RUBIN mark: text only, centred at (1232, 625) at the left of the flap block, replacing the airframe maker's wordmark. Its position and the 0.3 em tracking are estimates (`src/ui/panel/PanelShell.tsx`). The readout FLAPS UP / FLAPS T/O / FLAPS LDG sits under the lamps.

## Right panel and bus panel (region `right_panel`)

| Id | Placard | Assumed kind and skin | Assumed states and default | Centre (tol) | What is uncertain | Photos | File to change |
|----|---------|-----------------------|----------------------------|--------------|-------------------|--------|----------------|
| `sw.elt` | ELT | toggle, rocker S red (22 x 38), hit 34 x 78, three positions | RESET / TEST (bottom), ARMED (middle), ON (top); default ARMED, no spring return | 1776, 656 (3) | owner finding G-6; whether the middle position rests there (Q-01); size ratio against the other rockers; position confirmed | P650, PED, P807 | `controls/switch-bank.ts` |
| `lt.elt` | none | red lamp r 4, no caption, left of the rocker | lit when the ELT is ON | 1752, 656 (8) | owner finding G-6; exact position and size | same | `indicators.ts` |

The three ELT position placards ON, ARMED and RESET / TEST stand to the right of the rocker (`src/aircraft/da50rg/placards.ts`).

The bus panel (x 1836..1980, right of the strip plate so the ELT placards stay visible) is drawn as three bracket outlines with the headings ESSENTIAL BUS, MAIN BUS and AVIONICS BUS only. No circuit-breaker shapes exist yet (phase 01.2).

## Under panel (regions `under_panel_left`, `under_panel_centre`, `under_panel_right`)

Three pull handles below the face plate. States are confirmed for all three; only the look of the left handle is open.

| Id | Placard | Assumed kind and skin | Assumed states and default | Centre (tol) | What is uncertain | Photos | File to change |
|----|---------|-----------------------|----------------------------|--------------|-------------------|--------|----------------|
| `lv.alt_static` | ALTERNATE STATIC | detent-lever, pull-t (red mushroom T-knob with a white PULL placard), hit 44 x 110 | OPEN, CLOSED; default CLOSED | 51, 805 (3) | shape (T-knob versus another handle), colour; states were confirmed by the owner | P650, PED, SIM | `controls/under-panel.ts` |

For orientation, confirmed: `lv.emerg_gear` (pull-tab, red, drag-only, default NORMAL, 907, 805) and `lv.alt_air` (pull-boot, black with white vertical text, default CLOSED, 1205, 805). The two-line EMERGENCY GEAR EXTENSION name sits about 2 units above its region top at the stowed position.

## Environmental control and pedestal (regions `env_control`, `env_circ`, `pedestal`)

The environmental-control plate sits above the POWER lever. Its sliders, the fan knob and the parking brake were read from one close-up and the simulator image, so most of this area is assumed. The plate is compressed from the real aspect (about 0.52) to fit. The region was split in two (PD-01).

| Id | Placard | Assumed kind and skin | Assumed states and default | Centre (tol) | What is uncertain | Photos | File to change |
|----|---------|-----------------------|----------------------------|--------------|-------------------|--------|----------------|
| `lv.env_direction` | DIRECTION | detent-lever, env-slider, vertical, three icons | FEET, FACE, DEFROST (DEFROST at the top); default FACE; pictograms only | 1004, 828 (8) | default, order of the icons; three stops are confirmed | PED, COCK, SIM | `controls/pedestal.ts` |
| `lv.env_temp` | TEMPERATURE | detent-lever, env-slider, vertical, five steps | COLD, 25, 50, 75, WARM; default 50; only COLD and WARM are printed, a triangle pictogram left of the slot | 1100, 880 (8) | a continuous slider is modelled as five steps, default | PED, COCK, SIM | `controls/pedestal.ts` |
| `sw.env_fan` | FAN | rotary r 14, three fan symbols small to large | OFF, 1, 2, 3 at 180, 300, 360, 420 degrees; default OFF; only OFF is printed | 1020, 932 (8) | stop count, angles, default | PED, SIM | `controls/knobs.ts` |
| `lv.env_circ` | CIRCULATING AIR | detent-lever, env-slider, the only horizontal track | FRESH, RECIRC; default FRESH; pictograms only, region `env_circ` | 1063, 1010 (8) | which end is fresh air and which is recirculation, icon meaning | PED, SIM | `controls/pedestal.ts` |
| `lv.parking_brake` | PARKING BRAKE (plate placard, two lines) | detent-lever, parking-lever (small lever), nameless, no legends | OFF (bottom), SET (top, pulled up); default OFF | 1008, 1110 (8) | owner finding G-3; the exact look of the lever; position from the side-view photo | PED, SIM, side view | `controls/pedestal.ts` |
| `lv.power` | THROTTLE (plate placard; the id stays `lv.power`) | detent-lever, power-grip, nameless, legends 0 %, 50 %, 100 % | 0 to 100 percent in 5 percent steps; default 70 percent | 1115, 1160 (8) | owner finding G-3; position from the side-view photo | PED, COCK, SIM, side view | `controls/pedestal.ts` |
| `lv.cowl_flap` | COWL FLAP (plate placard) | detent-lever, cowl-slider (small lever acting as a switch), nameless, no legends | CLOSED (bottom), OPEN (top); default CLOSED | 1058, 1218 (8) | owner finding G-3; position and size of the small lever; default is an assumption (U-04) | PED, SIM, side view | `controls/pedestal.ts` |
| `lt.cowl_open` | OPEN | white lamp r 5, caption above | lit when the cowl flap is OPEN | 1022, 1188 (8) | owner finding G-0.3; position, lit colour (white assumed) | side view | `indicators.ts` |
| `lt.cowl_closed` | CLOSED | white lamp r 5, caption above | lit when the cowl flap is CLOSED | 1022, 1248 (8) | owner finding G-0.3; position, lit colour (white assumed) | side view | `indicators.ts` |

The pedestal (PARKING BRAKE, THROTTLE, COWL FLAP) sits on its own plate below the environmental control plate (plan 19); the placards and the cowl-flap lamp captions are static plate text. The default of the cowl flap is an assumption (U-04).

The environmental plate was rebuilt in plan 01.1-20 from the owner's side-view photo: four outlined boxes (DIRECTION, TEMPERATURE, FAN, CIRCULATING AIR), no state text, no scale numbers.

## Shell and placards (static art, no region)

All static art lives in `src/ui/panel/PanelShell.tsx` and carries no handler. Outline coordinates are redrawn approximations of the photo silhouettes (U-12). Values chosen by the plan, each picked so that it covers no control:

| Item | Chosen value |
|------|--------------|
| Face plate edge highlight and shadow | 1-unit strokes on the plate edge |
| Coaming stitch line | the hump path shifted 8 down |
| Console side walls | 14 wide at x 937..951 and 1174..1188 from y 763, stitching inset 8 |
| Environmental plate | x 962..1163, y 764..1014, rx 18, heading at (1062, 782) |
| Lights recess | x 940..1300, y 36..170, LIGHTS heading at (1120, 56) |
| Centre-stack plate and outlines | 880..1240 x 185..560 with three outlines (see Centre stack) |
| Switch-strip seam | plates meet at x 1100 (LEVEL sits on the seam) |
| LANDING GEAR bracket | line y 630 from 846 to 986, header at (916, 640), speed line at (916, 733) |
| ESS BUS NOT FOR NORMAL OPERATION placard | four Micro lines centred at x 521, baselines 650 to 671 |
| Bus panel brackets | x 1846..1970; ESSENTIAL y 225..365, MAIN y 375..565, AVIONICS y 575..735 |
| Left-strip plates | de-ice x 70..270, y 265..470; engine x 70..270, y 485..615 |
| Vent | centre (60, 700), r 28 with three inner rings |
| NO SMOKING placard | x 965..1029, y 725..739 |
| Fuel placard | x 1560..1700, y 640..700, five decorative bars, no real text |
| Nameplate | x 485..635, y 106..134, text DA50RG centred at (560, 125) |
| RUBIN | centre (1232, 625) |
| GO-AROUND | centred above each display bezel at region-local (w/2, -6) |

Overlaps seen in the build and not fixed, to check in the first render: the NO SMOKING plate is where the GEAR state text is drawn under the lever; the ESS BUS placard is close to the ENGINE MASTER and ESS BUS rockers. Contrast: the end placards on the raised half of the red rockers are white on `#e5323c`, about 4.4:1, just below 4.5:1; the state text under the rocker carries full contrast.

## Glass areas (regions `pfd`, `mfd`)

| Item | What was done | What is uncertain | File to change |
|------|---------------|-------------------|----------------|
| Glass-digit snap (U-14) | every glass font size was mapped to the declared scale 6, 8, 10, 14: 9 to 12 became 10, 13 to 22 became 14 | the large gauge readouts shrank from 20 and 22 to 14; the owner may ask for a fifth size | `src/ui/panel/frames/PfdFrame.tsx`, `MfdFrame.tsx`, `ArcGauge.tsx`, `BarGauge.tsx` |
| ENGINE softkey stroke (U-15) | `sw.mfd_page` (confirmed control) shows its selected state with a 2.5-unit white stroke instead of the earlier blue | the colour of the selected mark | `src/ui/panel/widgets/Toggle.tsx` |

## UI-SPEC unconfirmed items

The numbered list of the UI-SPEC, each with what the plans assumed.

| Item | What the plans assumed and how to change it |
|------|---------------------------------------------|
| **U-01** ESS BUS colour | RESOLVED 2026-10-20: white rocker, size M, by owner decision (photos over the earlier medium red); kept for the record. `colour: 'white'` on `sw.ess_bus` in `controls/switch-bank.ts`; no layout impact. |
| **U-02** Rocker size ratios | ELT small (22 x 38), ESS BUS, AV MASTER, EMERG FUEL PUMP, PROP DE-ICE and ALTERNATE medium (28 x 46), ELECT. MASTER large (32 x 52 with ears), PITOT/STALL HEAT wide (48 x 46), light rockers 26 x 54. Proposals within about 10 percent. Change `size` in the data files; the proportions live in `src/ui/panel/skins/Rocker.tsx`. |
| **U-03** Unconfirmed positions | the four light rockers and the dimmer knobs (parallax suspected), everything in the de-ice panel, the gear lamp and test toggle positions, the flap lamp positions, and the environmental plate and its controls. Change the control position and its reference row together. |
| **U-04** Default states | POSITION and STROBE on in cruise, LANDING and TAXI off; PROP DE-ICE off; EMERG FUEL PUMP off; FUEL TRANS off; PITOT/STALL HEAT on; FAN off; DIRECTION FACE; TEMPERATURE 50; cowl flap closed; ELT armed. Change `default` in the data file. |
| **U-05** FUEL TRANS | a round knob with OFF and ON at -60 and +60 degrees; the real knob may have more than two positions. `controls/switch-bank.ts`. |
| **U-06** STALL TEST and GEAR TEST | one three-position spring toggle instead of two parts; GEAR TEST changes only its own state and does not light the gear lamps. `controls/buttons.ts`. |
| **U-07** Flap lamp colour and UNSAFE | T/O and LDG lamps lit white; the red UNSAFE lamp is not lit during emergency gear extension, only `lv.gear` drives the lamps. `indicators.ts`. |
| **U-08** De-ice names and kinds | MAX / HIGH / NORM / OFF selector, WIND SHIELD, ICE LIGHT, PUMP 1, PUMP 2 and ANNUN TEST as read from the photos; to be verified against the ice-protection supplement before scenarios use them. `controls/deice.ts`, `controls/gear-flaps.ts`, `controls/buttons.ts`. |
| **U-09** Environmental controls | step counts (three, five and two stops, fan with three speeds) and which end of CIRCULATING AIR is fresh. `controls/pedestal.ts`, `controls/knobs.ts`. |
| **U-10** PARKING BRAKE | a black latch lever with SET and OFF; how the real one is actuated is unknown. `controls/pedestal.ts`. |
| **U-11** LEVEL button | assumed autopilot emergency level, inert here. `controls/buttons.ts`. |
| **U-12** Shell outline coordinates | coaming, hump and plate edges are redrawn approximations of the photo silhouettes; see the Shell table. `src/ui/panel/PanelShell.tsx`. |
| **U-13** Open items | rudder trim, pedals adjustment and the status lamps are not drawn; see "Open items not drawn". |
| **U-14** Glass-digit snap | large gauge readouts shrank to 14 (see Glass areas). |
| **U-15** ENGINE softkey stroke | the selected stroke changed from blue to white (see Glass areas). |

## Open items not drawn

Listed from the UI-SPEC, not drawn as controls and not in the registry (D-10).

| Item | Why open | Photo |
|------|----------|-------|
| RUDDER TRIM rocker on the POWER handle | visible only in the simulator image; real location and kind unconfirmed | SIM |
| RUDDER PEDALS ADJUSTMENT rocker at the far lower left | simulator image only | SIM |
| Cowl-flap position lamps and ELT status lamp near the console and ELT | small round lamps are visible, meaning unconfirmed | PED, P650 |
| Any control behind the left far panel strip below the vent | not photographed | none |

## Planner decisions

Decisions the plans took that go beyond the UI-SPEC. Each lists the reason and what it costs to undo.

| Decision | Reason and cost of undoing |
|----------|----------------------------|
| **PD-01** Pedestal split into `env_control` (top, 957, 750, 211 x 265) and `pedestal` (bottom, 957, 1015, 211 x 275) | In one 540-tall region the 734 x 315 phone shows 0.56 px per unit and the POWER handle would reach only 34 px, below the 44 px guarantee. Undo: merge the two entries in `REGIONS` (`panel.ts`), move the local coordinates of the five controls, and accept that the tap-size test for POWER fails. |
| **PD-02** De-ice split into `deice` (mode selector and ALTERNATE) and `deice_switches` (the switch rows) | One 190-tall region cannot give the four-position selector 44 px per detent on the phone. Undo: merge the regions and shift the local coordinates of five controls; the zoom tap-size test then fails for MODE. |
| **PD-03** The UI-SPEC id `sw.deice_mode` is registered as `lv.deice_mode` | The registry kind-prefix rule needs `lv.` for a detent lever. Undo: change the kind to a toggle or rotary, or relax the prefix rule; scenarios must use `lv.deice_mode`. |
| **PD-04** The UI-SPEC id `sw.stall_gear_test` is registered as `btn.stall_gear_test`, a three-state momentary part | A spring-return part is a momentary control under the kind-prefix rule. It is also centred at x 872, 7 units right of the UI-SPEC 865 (tolerance 8), so the caption clears the bracket. Undo: rename the id (one entry plus the reference row). |
| **PD-05** FAN and TEMPERATURE moved within tolerance: FAN to (1032, 896), TEMPERATURE to (1096, 862) | The 80 x 40 FAN footprint would otherwise overlap the DIRECTION and TEMPERATURE sliders. Undo: move the controls back to 1036, 888 and 1092, 862; the footprint no-overlap test then fails. |
| **PD-06** Hit rects narrowed: `sw.fadec` 66 wide, the three under-panel levers 44 wide | Each region keeps at least 7 units of free background so a tap on it still zooms. Undo: restore 74 and 60 and lose the free background (the clearance test fails). |
| **PD-07** The seven lamps live outside the control registry | A lamp has no hit rect, handler or event, so it cannot be operated, dispatched or graded; the store answers any `lt.` id with unknown. Undo: add an indicator kind to the registry and the store; costly because every invariant test then has to learn it. |
| **PD-08** Compact bat variant for the four de-ice switches | Their footprints are under 39 tall. The compact bat (throw 8, handle 4, ring r 6, Micro 6 name above, state text 8 inside) avoids overprinting the ANNUN TEST label. Undo: drop the variant in `src/ui/panel/skins/Bat.tsx` and enlarge the footprints, which needs room the neighbours do not have. |

Added by the lever plan, not part of the PD-01 to PD-08 list: lever names are drawn after the track art and above the highest handle position (never above the region top); skinned vertical levers print their detent legends to the right of the visible handle; the MODE state text sits left of its track; the pull handles have no entry plate. All in `src/ui/panel/widgets/DetentLever.tsx` and `src/ui/panel/skins/LeverHandles.tsx`.
