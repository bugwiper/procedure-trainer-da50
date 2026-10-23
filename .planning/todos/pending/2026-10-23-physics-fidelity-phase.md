---
created: 2026-10-23
title: Physics fidelity phase (electrical buses, combined gauges)
area: engine
source: owner instructor review of phase 3 with type-rating wiring diagrams
---

The owner wants a dedicated phase after the base work: two alternator ammeters combined in one gauge, two fuel tanks with one combined gauge, special essential bus behaviour, and the electrical findings below.

## Electrical findings (from the type-rating wiring diagrams, own words)

Five diagrams: normal operations, alternator 1 fail, alternator 2 fail, essential bus ON, both alternators fail.

- **Normal:** both alternators feed the main bus through their breakers (ALT 1, ALT 2). The bus tie relay joins the essential and the main bus. The battery feeds the essential bus through its breaker. ELECT. MASTER switches the battery bus from the main battery and the hot bus. The avionics bus hangs on the main bus through AV MASTER. ECU A and the main fuel pump are on the essential bus, ECU B and the emergency fuel pump on the main bus. The alternator 1 excitation battery with buffer protection backs the supply of ECU A and the main pump. The additional electrical loads (RACC) hang on alternator 2.
- **Alternator 1 fail:** the bus tie relay opens, the essential bus stays on the battery, the main bus is fed by alternator 2, the additional loads are shed. ESS BUS ON is the pilot action that connects the essential supply.
- **Alternator 2 fail:** the bus tie relay stays closed, alternator 1 carries both buses, the additional loads are shed.
- **ESS BUS ON:** the bus tie relay is open, the additional loads are shed, and the essential bus is supplied through the ESS BUS switch path. The exact path in the photo is not fully clear; confirm with the owner.
- **Both alternators fail:** the bus tie relay is open and the main bus is dead, so ECU B, the emergency fuel pump and the additional loads are lost. The essential bus alone runs on the battery. ECU A and the main pump stay alive through the excitation battery's buffer protection. ESS BUS ON applies.

## Consequences for the model

- Model the buses (main, essential, battery, hot, avionics) and the bus tie relay as state; derive consumers from bus power.
- Shed the additional loads on any alternator failure.
- The emergency fuel pump depends on the main bus (matters for the Engine Fire forbidden item).
- The ESS BUS switch must be gradable; ELECT. MASTER OFF kills the battery bus.
- Today only `alt1_output`, the alternator 2 current and the battery are modeled, and the main bus loss outcome is a voltage threshold.
- Gauges: one ammeter gauge with two needles, one fuel gauge with two tanks (the MFD and quantity data change).
