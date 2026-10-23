---
created: 2026-10-23
title: Fixes from the first live test (fuel selector, squawk default, fuel flow)
area: panel
source: owner instructor review and first live test of phase 3
---

## 1. FUEL selector turns only clockwise

In the real aircraft the fuel selector turns only clockwise, so NORMAL to OFF is not a direct counter-clockwise turn. The stop order, the travel and the tap halves of `sw.fuel_valve` (`src/aircraft/da50rg/controls/knobs.ts`) need to follow that. Check the AFM and the owner photos (`.input/`, private) for the real order of the positions first. Then either forbid counter-clockwise travel in the rotary kind or model the real stops. The Engine Fire scenario's FUEL step and its golden recordings must follow.

## 2. Default squawk is 7000

`kp.squawk` defaults to 1200 (`src/aircraft/da50rg/controls/squawk.ts`). The owner wants 7000. Touches `tests/xpdr.test.ts`, the label and review documents and the grading of the optional 7700 step.

## 3. Fuel flow in gph

The owner reads fuel flow in US gallons per hour (gph), as displayed and written in the AFM: about 10.1 gph at 60 % load and about 11.8 gph at 75 %. The model has `FUEL_BURN_CRUISE_PER_MIN = 0.1` gal/min (6 gph at cruise) in `src/aircraft/da50rg/physics.ts`, so it is too low. Express the burn in gph as a tunable data constant and fit both owner points. The owner will tune more values during the beta (all physics constants are data and parameters, not code paths).

## Resolved

Closed 2026-10-23. 1. `sw.fuel_valve` carries the new rotary option `oneWay: 'cw'` (NORMAL 0, EMERGENCY 90, OFF 225, clockwise order confirmed by the AFM schematic of the fuel valve): a right-half tap steps clockwise and OFF is followed by NORMAL, the left half does nothing, a drag is clamped at its start. Still for the owner: the OFF angle (the schematic puts OFF at the bottom, 180) and whether EMERGENCY to NORMAL may pass OFF (the AFM text says it does not; Q-15 in `docs/PANEL-LABELS.md`). 2. `kp.squawk` rests on 7000. 3. Fuel flow is a line in gph through the two owner points (`FUEL_FLOW_LOW_POINT`, `FUEL_FLOW_HIGH_POINT` in `physics.ts`); the MFD has no fuel flow readout yet.
