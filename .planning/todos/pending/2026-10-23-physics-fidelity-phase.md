---
created: 2026-10-23
title: Physics fidelity phase (electrical buses, combined gauges)
area: engine
source: owner instructor review of phase 3 with type-rating wiring diagrams
---

The owner wants a dedicated phase after the base work: two alternator ammeters combined in one gauge, two fuel tanks with one combined gauge, special essential bus behaviour, and the electrical findings below.

Roadmap (decided 2026-10-23): this is split into Phase 4, Electrical system fidelity (the electrical findings, the bus model, the combined amps gauge, the ALTN 2 FAIL scenario; together with `2026-10-23-checklist-fidelity.md`), and Phase 5, Fuel, tank and engine fidelity and the engine page (two tanks and a combined gauge, fuel flow, fuel calculator, oil pressure, oxygen, de-ice quantity, rudder trim, the real engine page layout). Both come after Phase 3.1 (scenario variants).

## Electrical findings (from the type-rating wiring diagrams, own words)

Five diagrams: normal operations, alternator 1 fail, alternator 2 fail, essential bus ON, both alternators fail.

- **Normal:** alternator 1 feeds the main bus through its relay and a 60 A breaker. Alternator 2 does not feed the main bus; it supplies the air conditioning (RACC), where fitted. The bus tie relay joins the essential and the main bus. The battery feeds the essential bus through its breaker. ELECT. MASTER switches the battery bus from the main battery and the hot bus. The avionics bus hangs on the main bus through AV MASTER. ECU A and the main fuel pump are on the essential bus, ECU B and the emergency fuel pump on the main bus. The alternator 1 excitation battery with buffer protection backs the supply of ECU A and the main pump.
- **Alternator 1 fail:** the bus tie relay opens, the essential bus stays on the battery, the additional loads are shed. ESS BUS ON is the pilot action that brings alternator 2 onto the main bus (see below).
- **Alternator 2 fail:** the bus tie relay stays closed and alternator 1 carries both buses; only the air conditioning (additional loads) is lost.
- **ESS BUS ON (confirmed by the AFM, power generation section, own words):** switching it on connects alternator 2 to the main bus through the alternator 2 relay, the tie relay and a 60 A breaker, and disconnects it from the air conditioning. Each alternator has its own current sensor behind the ammeter. If the main battery fails, the field of alternator 1 is energised by two small sealed lead-acid batteries in series under the passenger seats (1.3 Ah), the field of alternator 2 by two larger ones (7.2 Ah). Each alternator control unit regulates the output voltage and raises the caution ALTN 1 FAIL or ALTN 2 FAIL on the PFD for over- or undervoltage and other internal fault levels (so the caution comes from the control unit, not from the current alone).
- **Both alternators fail:** the bus tie relay is open and the main bus is dead, so ECU B, the emergency fuel pump and the additional loads are lost. The essential bus alone runs on the battery. ECU A and the main pump stay alive through the excitation battery's buffer protection. ESS BUS ON applies.

## Consequences for the model

- Model the buses (main, essential, battery, hot, avionics) and the bus tie relay as state; derive consumers from bus power.
- Shed the additional loads on any alternator failure.
- The emergency fuel pump depends on the main bus (matters for the Engine Fire forbidden item).
- The ESS BUS switch must be gradable; ELECT. MASTER OFF kills the battery bus.
- The shipped model already matches the AFM for alternator 2: it feeds the main bus only with ESS BUS on. The caution rule uses the alternator 1 current (<= 2.5 A) instead of the control unit's voltage and fault logic; review when the bus model is built.
- Today only `alt1_output`, the alternator 2 current and the battery are modeled, and the main bus loss outcome is a voltage threshold.
- Gauges: one ammeter gauge with two needles, one fuel gauge with two tanks (the MFD and quantity data change).

## Engine page layout (owner photo of the real page, 2026-10-23)

The real engine page, from the owner's full-page photo (private, `.input/mfd-engine-page-full.webp`): arc gauges Load % and RPM; bars Oil Pres, Oil Temp, Coolant Temp, Gearbox Temp; Rudder Trim; a Fuel box with a combined left and right quantity bar, Fuel Temp (both tanks), Fuel Press, FFlow GPH and a Fuel Calculator (gallons remain, gallons used, endurance, range); Electrical with a combined Amps bar (both alternators) and Volts; Oxygen PSI; De-Ice US gal with endurance; Total Service hours. The fuel and electrical combined gauges and the new quantities (fuel flow, fuel calculator, oxygen, de-ice quantity, rudder trim, total service) belong to this phase. Only the alert styling (yellow and red label boxes and pointers) is pulled forward into the phase 3 gap closure.
