---
created: 2026-10-23
title: Physics fidelity, electrical part (buses, bus tie relay, two alternator currents)
area: engine
source: owner instructor review of phase 3 with type-rating wiring diagrams; closed by Phase 4
---

The electrical findings of the physics fidelity todo, as plan 04-01 decided them (E-01 to E-11 in `.planning/phases/04-electrical-system-fidelity/04-01-PLAN.md`; the model is `src/aircraft/da50rg/electrical.ts`). Done in Phase 4. The fuel, tank, engine and engine-page-layout parts stay in `.planning/todos/pending/2026-10-23-physics-fidelity-phase.md` for Phase 6.

## Findings as modelled

- **Buses.** Main, essential, battery, hot and avionic bus, derived from the control states, the breakers and the battery charge; consumers (ECU A and B, main and emergency pump, the additional loads, avionics) are derived from the bus they hang on.
- **Bus tie relay.** It follows the ESS BUS switch, not an alternator failure: de-energised (ESS BUS off) its main-to-essential contact is closed whatever the alternators do, so with ESS BUS off the battery reaches the main bus through it; energised (ESS BUS on) that contact opens and alternator 2 joins the main bus. The older lines of this todo, "alternator 1 fail: the tie relay opens" and "both fail: the tie relay is open", were read from diagrams that already had ESS BUS on.
- **Alternator 2 fail:** alternator 1 carries both buses through the closed tie relay; only the additional loads are lost.
- **ESS BUS on:** alternator 2 carries the main bus and sheds the additional loads; the two currents share the main load (15 and 15 with both online, an instructor-review value).
- **Cautions.** ALTN 1 FAIL and ALTN 2 FAIL come from the alternator control unit fault (output low, short, breaker out or switch off), not from a current threshold.
- **Emergency fuel pump** hangs on the main bus; with ELECT. MASTER on and ESS BUS off the battery feeds it through the closed tie.
- **Gauge.** One Amps bar with a pointer for each alternator and a Volts bar (the essential bus) in one Electrical box on the MFD engine page.

## Left open

The free panel shows fixed base readings; the free-panel simulation is in `.planning/todos/pending/2026-10-22-free-panel-simulation.md` (Phase 6).
