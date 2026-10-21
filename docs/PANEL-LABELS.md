# Panel Label Table (static placard text, owner review)

This is a training aid, not the AFM. This document lists, for every switch, lever, knob, button and lamp of the finished panel, the static text that is printed on or beside it: the assumed name placard and the position placards. It holds placard words only: no photo, crop, trace or aircraft manual text. The owner reviews it in the morning; nothing waits for that review. The panel is built with the labels written here, and a different answer is a data edit in the file named in the last column of each row.

## Rules in force

| Rule | Meaning |
|------|---------|
| G-0.1 | No dynamic text: nothing printed on the panel changes with a control state. A placard names a position, never the current state. |
| G-0.2 | Static real-aircraft labels only; every label that is not known for sure is listed here so it can be corrected. |
| G-0.3 | A lamp exists only where the original has one. |

## Basis of an assumption

| Basis | Meaning |
|-------|---------|
| existing | the label is on the panel today and the owner did not object to it |
| owner finding | the label is what the owner wrote in the first-render review |
| assumption | the planner chose it; the owner is asked to confirm it |

## Where to correct

| What is wrong | Where to change it |
|---------------|--------------------|
| Name placard of a control | the `label` field in `src/aircraft/da50rg/controls/*.ts` |
| Lever and knob legends | the detent or stop labels in the same files |
| Lamp captions | `src/aircraft/da50rg/indicators.ts` |
| Plate text and plate placards | `src/ui/panel/PanelShell.tsx` and `src/aircraft/da50rg/placards.ts` |

Ids marked "new in plan NN" were created by the plan with that number. Ids marked "since plan NN" kept their name and changed meaning in that plan. Ids that were removed are listed under "Superseded by the owner findings". Every id named here exists in the registry or the lamp set, except the removed ones.

## Glareshield

Four exterior-light rockers in the hump above the displays, under the plate heading LIGHTS. No ON or OFF stands on or beside a rocker; the position shows by perspective only.

| Id | Static label(s) | Position placards | Basis | File to edit |
|----|-----------------|-------------------|-------|--------------|
| `sw.light_landing` | LANDING | none | existing, owner finding | `controls/lights.ts` |
| `sw.light_taxi` | TAXI | none | existing, owner finding | `controls/lights.ts` |
| `sw.light_position` | POSITION | none | existing, owner finding | `controls/lights.ts` |
| `sw.light_strobe` | STROBE | none | existing, owner finding | `controls/lights.ts` |
| plate text | heading LIGHTS (plate) | none | existing, owner finding | `src/ui/panel/PanelShell.tsx` |

## Centre stack

Two dimmer knobs between the displays. The marks around each knob are static scale marks.

| Id | Static label(s) | Position placards | Basis | File to edit |
|----|-----------------|-------------------|-------|--------------|
| `sw.instr_light` | INSTRUMENT LIGHT; scale marks OFF, 25, 50, 75, MAX around the knob | the scale marks | existing, assumption (scale numbers, Q-07) | `controls/knobs.ts` |
| `sw.flood_light` | FLOOD LIGHT; scale marks OFF, 25, 50, 75, MAX around the knob | the scale marks | existing, assumption (scale numbers, Q-07) | `controls/knobs.ts` |

## Engine strip

FADEC, its test button and the two alternator switches at the left edge. The real FADEC switch positions are not known, so no position text is printed (Q-09).

| Id | Static label(s) | Position placards | Basis | File to edit |
|----|-----------------|-------------------|-------|--------------|
| `sw.fadec` | FADEC | none (real AUTO / B placards unknown, Q-09) | existing, assumption | `controls/engine.ts` |
| `btn.fadec_test` | FADEC TEST | none | existing | `controls/buttons.ts` |
| `sw.alternator_1` | ALTERNATOR 1 | none | existing | `controls/engine.ts` |
| `sw.alternator_2` | ALTERNATOR 2 | none | existing | `controls/engine.ts` |

## Switch row

The row of controls under the primary display, left to right, with the ESS BUS plate placard. No ON or OFF stands beside a rocker (Q-06).

| Id | Static label(s) | Position placards | Basis | File to edit |
|----|-----------------|-------------------|-------|--------------|
| `sw.prop_deice` | PROP DE-ICE | none | existing | `controls/switch-bank.ts` |
| `sw.fuel_trans` | FUEL TRANS; scale marks OFF, ON | the two scale marks (Q-07) | existing | `controls/switch-bank.ts` |
| `sw.emerg_fuel_pump` | EMERG FUEL PUMP | none | existing | `controls/switch-bank.ts` |
| `btn.engine_start` | ENGINE START | none | existing | `controls/buttons.ts` |
| `sw.engine_master` | ENGINE MASTER | none | existing | `controls/switch-bank.ts` |
| `sw.ess_bus` | ESS BUS; plate placard ESS BUS NOT FOR NORMAL OPERATION | the plate placard | existing | `controls/switch-bank.ts`, `src/ui/panel/PanelShell.tsx` |
| `sw.elect_master` | ELECT. MASTER | none | existing | `controls/switch-bank.ts` |
| `sw.av_master` | AV MASTER | none | existing | `controls/switch-bank.ts` |
| `sw.pitot_stall_heat` | PITOT/STALL HEAT | none | existing | `controls/switch-bank.ts` |

## MFD softkey

One softkey under the multi-function display. The earlier name MFD PAGE and the words MAP and ENGINE are dropped; only the key legend is printed (Q-10).

| Id | Static label(s) | Position placards | Basis | File to edit |
|----|-----------------|-------------------|-------|--------------|
| `sw.mfd_page` | ENGINE (key legend; replaces MFD PAGE plus the words MAP and ENGINE) | none | assumption | `controls/mfd.ts` |

## Landing gear and LEVEL

The gear lever, the STALL TEST / GEAR TEST part, the four gear lamps and the LEVEL button. Plate order from the top: the bracket header LANDING GEAR, directly under it the speed line VLE / VLO = 162 KIAS, then the lamps.

| Id | Static label(s) | Position placards | Basis | File to edit |
|----|-----------------|-------------------|-------|--------------|
| `lv.gear` | GEAR | UP (top), DOWN (bottom), beside the lever | existing | `controls/gear-flaps.ts` |
| `btn.stall_gear_test` | STALL TEST (left caption), GEAR TEST (right caption) | the two captions | existing, owner finding (implementation correct) | `controls/buttons.ts` |
| `lt.gear_nose` | NOSE | none | existing | `indicators.ts` |
| `lt.gear_left` | LEFT | none | existing | `indicators.ts` |
| `lt.gear_right` | RIGHT | none | existing | `indicators.ts` |
| `lt.gear_unsafe` | UNSAFE | none | existing | `indicators.ts` |
| plate text | LANDING GEAR (bracket header), VLE / VLO = 162 KIAS directly under it | none | owner finding | `src/ui/panel/PanelShell.tsx` |
| `btn.level` | LEVEL; plate placard NO SMOKING | none | existing | `controls/buttons.ts` |

## Flaps

The flap lever with its three lamps.

| Id | Static label(s) | Position placards | Basis | File to edit |
|----|-----------------|-------------------|-------|--------------|
| `lv.flaps` | FLAPS | UP, T/O, LDG beside the lever | existing | `controls/gear-flaps.ts` |
| `lt.flap_up` | UP | none | existing | `indicators.ts` |
| `lt.flap_to` | T/O 133 KIAS | none | existing | `indicators.ts` |
| `lt.flap_ldg` | LDG 121 KIAS | none | existing | `indicators.ts` |

## ELT

The ELT rocker has three positions; the placards stand beside the rocker and name positions (Q-01). The small red lamp left of the rocker is lit in ON only (Q-11).

| Id | Static label(s) | Position placards | Basis | File to edit |
|----|-----------------|-------------------|-------|--------------|
| `sw.elt` (three positions since plan 18) | ELT | ON (top), ARMED (middle), RESET / TEST (bottom) beside the rocker | owner finding | `controls/switch-bank.ts`, `src/aircraft/da50rg/placards.ts` |
| `lt.elt` (new in plan 18) | none; small red lamp left of the rocker | none | owner finding | `indicators.ts` |

## Under panel

The three pull handles below the face plate. PULL is printed on the handle; the position names stand beside it.

| Id | Static label(s) | Position placards | Basis | File to edit |
|----|-----------------|-------------------|-------|--------------|
| `lv.alt_static` | ALTERNATE STATIC; PULL on the knob | OPEN, CLOSED | existing | `controls/under-panel.ts` |
| `lv.emerg_gear` | EMERGENCY GEAR EXTENSION; PULL on the tab | EMERGENCY, NORMAL | existing | `controls/under-panel.ts` |
| `lv.alt_air` | ALTERNATE AIR (vertical on the pad) | OPEN, CLOSED | existing | `controls/under-panel.ts` |

## Environmental control

The plate sits above the throttle. Its four controls carry a box title each and pictograms instead of words (owner finding). Q-05 asks whether the remaining names are real.

| Id | Static label(s) | Position placards | Basis | File to edit |
|----|-----------------|-------------------|-------|--------------|
| plate title | ENVIRONMENTAL CONTROL | none | existing, owner finding | `src/ui/panel/PanelShell.tsx` |
| `lv.env_direction` | DIRECTION (box title); pictograms defrost, face, feet, no words (replaces the words DEFROST, FACE, FEET) | none | owner finding | `controls/pedestal.ts` |
| `lv.env_temp` | TEMPERATURE (box title); long thin triangle pictogram, wide end up (replaces the scale 25, 50, 75) | WARM (top), COLD (bottom) only; no scale | owner finding | `controls/pedestal.ts` |
| `sw.env_fan` | FAN (box title); three fan symbols small to large from upper left to upper right, no dots, no numbers | OFF at the bottom | owner finding | `controls/knobs.ts` |
| `lv.env_circ` | CIRCULATING AIR (box title); fresh-air pictogram (rectangle, inward arrow) left, recirculation pictogram (rectangle, circling arrow) right; no words (replaces the words FRESH, RECIRC) | none | owner finding | `controls/pedestal.ts` |

## Pedestal

Parking brake, throttle and cowl flap. The throttle plate says THROTTLE although the id stays `lv.power` (Q-04). The cowl-flap lamps are lit by the lever position, each in its own position (Q-12).

| Id | Static label(s) | Position placards | Basis | File to edit |
|----|-----------------|-------------------|-------|--------------|
| `lv.parking_brake` | PARKING BRAKE | none; the lever pulled up sets the brake | owner finding | `controls/pedestal.ts` |
| `lv.power` | THROTTLE (as on the plate in the owner photo; the id stays `lv.power`; replaces POWER); MAX at the forward end | the legends 0 %, 50 %, 100 % (Q-05) | existing, assumption | `controls/pedestal.ts` |
| `lv.cowl_flap` | COWL FLAP | none (the lever legends CLOSED and OPEN move to the two lamps) | owner finding | `controls/pedestal.ts` |
| `lt.cowl_open` (new in plan 19) | OPEN beside a white lamp | none | owner finding | `indicators.ts` |
| `lt.cowl_closed` (new in plan 19) | CLOSED beside a white lamp | none | owner finding | `indicators.ts` |

## De-ice

The de-ice unit at the top far left, as the owner described it. It was rebuilt by plans 21 and 22; the heading is a white outlined frame with the words DE ICE, no hyphen. The lamps are top amber, middle amber, bottom white. The top MAX lamp stays unlit until the engine phase adds the 120 s timer (Q-14); the todo is `.planning/todos/pending/2026-10-21-deice-max-timer-engine.md`.

| Id | Static label(s) | Position placards | Basis | File to edit |
|----|-----------------|-------------------|-------|--------------|
| plate heading | DE ICE in a white outlined frame (no hyphen) | none | owner finding | `src/ui/panel/PanelShell.tsx` |
| `sw.deice_mode` (new in plan 21; replaces `lv.deice_mode`) | none of its own | HIGH (above), NORM (left of the middle), OFF (below) | owner finding | `controls/deice.ts` |
| `btn.deice_max` (new in plan 21) | MAX (above the button) | none | owner finding | `controls/deice.ts` |
| `lt.deice_max` (new in plan 21) | none (top lamp, amber) | none | owner finding | `indicators.ts` |
| `lt.deice_high` (new in plan 21) | none (middle lamp, amber) | none | owner finding | `indicators.ts` |
| `lt.deice_norm` (new in plan 21) | none (bottom lamp, white) | none | owner finding | `indicators.ts` |
| `sw.deice_alternate` (normal toggle look since plan 22) | ALTERNATE as stacked upright letters beside the red guard | none | owner finding | `controls/deice.ts` |
| `btn.deice_windshield` (new in plan 22; replaces `sw.deice_windshield`) | WIND / SHIELD, two lines above the button | none | owner finding | `controls/deice.ts` |
| `sw.deice_ice_light` (three positions since plan 22) | none of its own | ICE LIGHT (above), OFF (right of the middle), ANNUN- / TEST (two lines, below); Q-02 | owner finding | `controls/deice.ts` |
| `sw.deice_pump` (new in plan 22; replaces `sw.deice_pump1` and `sw.deice_pump2`) | none of its own | PUMP 2 (above), PUMP 1 (below); Q-03 | owner finding | `controls/deice.ts` |

## Superseded by the owner findings

These ids existed in the first render and were removed by the plan named; the labels they carried (MODE, WIND SHIELD, PUMP 1, PUMP 2, ANNUN TEST) move to the placards of the new ids above.

| Id | Removed in | Replaced by | Basis | File to edit |
|----|------------|-------------|-------|--------------|
| `lv.deice_mode` | plan 21 | `sw.deice_mode` | owner finding | `controls/gear-flaps.ts` |
| `sw.deice_windshield` | plan 22 | `btn.deice_windshield` | owner finding | `controls/deice.ts` |
| `sw.deice_pump1` | plan 22 | `sw.deice_pump` | owner finding | `controls/deice.ts` |
| `sw.deice_pump2` | plan 22 | `sw.deice_pump` | owner finding | `controls/deice.ts` |
| `btn.deice_annun_test` | plan 22 | the third position of `sw.deice_ice_light` | owner finding | `controls/buttons.ts` |

## Questions for the owner

Each question states the default the plans take. The questions do not block anything: the plans build with the defaults, and a different answer is a data edit in the file named above.

- **Q-01** Does the ELT RESET / TEST position spring back to ARMED? Default taken: No, a maintained 3-position switch.
- **Q-02** Does the ANNUN-TEST position of the ICE LIGHT toggle spring back to OFF? Default taken: No, a maintained 3-position switch.
- **Q-03** Which PUMP position is the normal one at start? Default taken: PUMP 1 (down).
- **Q-04** The plate says THROTTLE; the owner wrote "THROTTLE (POWER)". Which text is printed? Default taken: THROTTLE.
- **Q-05** Are the placards 0 %, 50 %, 100 % beside the throttle lever and the names OPEN / CLOSED beside the pull handles real? Default taken: kept as built.
- **Q-06** Should a text placard stand beside rockers at all? Default taken: No text, perspective only.
- **Q-07** Are the dimmer scale numbers 25, 50, 75 and the FUEL TRANS marks OFF, ON real? Default taken: kept as built.
- **Q-08** The photo shows no name GEAR above the gear knob; keep it? Default taken: kept (the owner did not object).
- **Q-09** FADEC: does the real switch print AUTO and B beside its positions? Default taken: no text.
- **Q-10** What is the MFD softkey legend text? Default taken: ENGINE.
- **Q-11** ELT lamp: lit when the ELT is ON only? Default taken: lit in ON only, red.
- **Q-12** Cowl-flap lamps: lit by the lever position, each lit in its own position? Default taken: yes.
- **Q-13** Does GEAR TEST light all four gear lamps including the red UNSAFE lamp? Default taken: yes, all four.
- **Q-14** The de-ice MAX top lamp stays unlit until the engine phase adds the 120 s timer (flag only). Accept? Default taken: yes, recorded as deferred.
