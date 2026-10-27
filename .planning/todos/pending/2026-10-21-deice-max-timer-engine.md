---
created: 2026-10-21
title: De-ice behaviour for the engine phase (120 s MAX run, ANNUN-TEST self-test, WIND SHIELD spray, ICE LIGHT effect)
area: engine
source: 01.1-21 and 01.1-22 (de-ice unit rebuild), owner findings G-1 in 01.1-OWNER-FINDINGS.md, plan 01.1-23
---

The de-ice unit is rebuilt in phase 01.1 as a panel: every control moves and is recorded, the three lamps follow the mode toggle. The behaviour below was deliberately not built there. Reason for the deferral: no engine clock and no reaction layer exist before the scenario phases, and the engine rule in CLAUDE.md forbids real timers in the engine or the UI (tick events with an injected clock only). A timer built into the panel phase would be thrown away.

## To build in the engine phase (items 1 and 3 done, items 2 and 4 and the ELT note stay open)

1. **120 s MAX run. DONE in phase 3 (plan 03-04), run-only.** Pressing `btn.deice_max` while `sw.deice_mode` is HIGH starts the reaction `deice_max` in the fixed-step simulation: the flag `DEICE_MAX_ACTIVE` is set for 120 s of the run's virtual clock and the top amber lamp `lt.deice_max` is lit; leaving HIGH clears it at once; a press alone on NORM lights nothing (T-01.1-42). It works only during a scenario run: on the free panel nothing is simulated, so the lamp stays dark there (see `2026-10-22-free-panel-simulation.md`). The 120 s itself is from the owner's finding G-1, not a measurement (instructor-review item 10 in `docs/GRADING.md`).
2. **ANNUN-TEST self-test.** The lower position of `sw.deice_ice_light` is the lamp test of the system. Which lamps it lights is not known; define it with the scenarios.
3. **WIND SHIELD spray. DONE in phase 5 (plan 05-02), run-only.** Pressing `btn.deice_windshield` starts the reaction `windshield_spray` (flag `WINDSHIELD_SPRAY_ACTIVE`, 10 s of run time, any de-ice mode, a second press during it is ignored): the pilot half of the windscreen clears within about a second and does not re-ice while it runs, the co-pilot half is untouched. The values are instructor-review values in `docs/GRADING.md` (phase 5 review). On the free panel `?flags=deice.windshield_spray` shows it.
4. **ICE LIGHT effect.** The upper position of `sw.deice_ice_light` has no effect yet.

Also deferred in the same engine phase: the ELT lamp behaviour in RESET / TEST (today `lt.elt` is lit in ON only).

## Open question

- Q-02 of `docs/PANEL-LABELS.md`: does the ANNUN-TEST position spring back to OFF? Default taken: no, a maintained 3-position switch. If it springs back, the control becomes a spring-return toggle in `controls/deice.ts`.
