---
created: 2026-10-23
title: Physics fidelity phase 6 (fuel, tank, engine and the real engine page layout)
area: engine
source: owner instructor review of phase 3 with type-rating wiring diagrams; the source todo of Phase 6
---

The electrical part of this todo is done in Phase 4 (bus model, two-pointer Amps bar, Volts, ALTN 2 FAIL); see [the done todo](../done/2026-10-23-physics-fidelity-electrical.md). This file is the source todo of Phase 6, Fuel, tank and engine fidelity and the engine page: two fuel tanks with one combined gauge, fuel flow, fuel calculator, oil pressure, oxygen, de-ice quantity, rudder trim and the real engine page layout. The free-panel simulation (`2026-10-22-free-panel-simulation.md`) belongs there too, since the free panel shows only fixed base readings.

Gauges still open: one fuel gauge with two tanks (the MFD and quantity data change). The Electrical box of the real page is built (Phase 4).

## Engine page layout (owner photo of the real page, 2026-10-23)

The real engine page, from the owner's full-page photo (private, `.input/mfd-engine-page-full.webp`): arc gauges Load % and RPM; bars Oil Pres, Oil Temp, Coolant Temp, Gearbox Temp; Rudder Trim; a Fuel box with a combined left and right quantity bar, Fuel Temp (both tanks), Fuel Press, FFlow GPH and a Fuel Calculator (gallons remain, gallons used, endurance, range); Oxygen PSI; De-Ice US gal with endurance; Total Service hours. (The Electrical box with the Amps bar for both alternators and Volts is built in Phase 4.) The fuel combined gauge and the new quantities (fuel flow, fuel calculator, oxygen, de-ice quantity, rudder trim, total service) belong to this phase. Only the alert styling (yellow and red label boxes and pointers) is pulled forward into the phase 3 gap closure.

## Status: DONE in phase 6 (plans 06-01 to 06-04, 2026-10-29)

Two tanks and the combined gauge, fuel flow and the calculator (06-01, 06-02), the real engine page layout, oxygen, rudder trim, de-ice quantity (06-02), the live PFD (06-03), the oil pressure behaviour (06-04, `oil-pressure-curve.ts`). Documented in `docs/GRADING.md`, sections "Fuel model", "Engine page and de-ice fluid", "Flight profile for authors", "Pitot and stall heat" and "Oil pressure" (phase 6). The free-panel simulation stays excluded (`2026-10-22-free-panel-simulation.md`). Not built on purpose: the alternator test (needs the owner's printed pages) and the fuel scenarios.
