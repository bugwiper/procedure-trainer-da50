---
created: 2026-10-22
title: Simulation on the free panel (outside scenario runs)
area: engine
source: 03-01 C-04 and 03-04 C-23 (plan 03-09 closes the phase 3 notes)
---

In phase 3 the simulation and the de-ice MAX run exist only during a scenario run. On the free panel (no run) the gauges show the fixed base values (the cruise readings), no model runs, no reaction fires and a lit lamp ends with the run (`closeDebrief` clears the flags). This was a deliberate scope decision (C-04): a run owns the virtual clock, the log cursor and the seed.

## To build if a free-panel simulation is wanted

1. **A clock on the free screen.** The clock driver is started by a run. A free-panel simulation needs a clock that runs while no scenario is active, pauses in a hidden tab or an open modal like the run clock, and stops cleanly when a run starts.
2. **A bounded rebuild on retract.** The rebuild by replay (`simulate` over the remaining log) is capped at the maximum run length (30 minutes of run time). A free panel has no natural end, so either the log is cut at a bound or the state is checkpointed periodically.
3. **A rule for the end state after a debrief.** Closing the debrief keeps the end state of the panel (U-10). With a free-panel simulation the quantities after a run must either continue from the end state of the run or fall back to the base values; decide which, and what happens to a lit MAX lamp and to the flags.
4. **Grading is unaffected.** The free panel is not graded; the level is never an input of `grade`.

## Placement (2026-10-23)

Owner decision: this goes into Phase 6 (fuel, tank and engine fidelity and the engine page), because the free panel then needs the whole simulated engine page. Reason from the owner's alternator test in the normal checklist: ESS BUS on makes alternator 2 Amps rise and alternator 1 Amps fall, ESS BUS off the reverse; today this shows only inside a scenario run.

## Decision (2026-10-27)

Not built. A general simulation on the free panel is too complex for its gain (no scene, no speed, no scenario context, own clock and hand-over). Replaced by situation-based simulation: normal procedures such as the alternator test of the normal checklist become situations of their own (scene parked or cruise, engine running, no failure), run like scenarios and graded against the printed normal checklist. The RESET button keeps returning to the static initial state.
