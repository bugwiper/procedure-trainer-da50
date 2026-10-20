# Panel Label Table (static placard text, owner review)

This is a training aid, not the AFM. This document lists, for every switch, lever, knob, button and lamp of the finished panel, the static text that is printed on or beside it: the assumed name placard and the position placards. It holds placard words only: no photo, crop, trace or aircraft manual text. The owner reviews it in the morning; nothing waits for that review. The following plans build the panel with the labels written here, and a different answer is a data edit in the file named in the last column of each row.

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
| Plate text and plate placards | `src/ui/panel/PanelShell.tsx` and, once plan 18 lands, `src/aircraft/da50rg/placards.ts` |

Ids marked "planned, plan NN" do not exist yet and are created by the plan with that number. Ids marked "changed" keep their name and change meaning in that plan.

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

Scope: the two dimmer knobs between the displays.

## Engine strip

Scope: FADEC, FADEC TEST and the two alternator switches at the left edge.

## Switch row

Scope: the nine controls under the primary display, ENGINE START, the ESS BUS plate placard.

## MFD softkey

Scope: the softkey under the multi-function display.

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

Scope: the flap lever and the three flap lamps.

## ELT

Scope: the ELT rocker and its lamp.

## Under panel

Scope: the three pull handles below the face plate.

## Environmental control

Scope: the plate and its four controls.

## Pedestal

Scope: parking brake, throttle lever, cowl flap and its lamps.

## De-ice

Scope: the de-ice unit at the top far left.
