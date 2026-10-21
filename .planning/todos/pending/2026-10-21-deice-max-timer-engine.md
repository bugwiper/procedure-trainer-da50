---
created: 2026-10-21
title: De-ice behaviour for the engine phase (120 s MAX run, ANNUN-TEST self-test, WIND SHIELD spray, ICE LIGHT effect)
area: engine
source: 01.1-21 and 01.1-22 (de-ice unit rebuild), owner findings G-1 in 01.1-OWNER-FINDINGS.md, plan 01.1-23
---

The de-ice unit is rebuilt in phase 01.1 as a panel: every control moves and is recorded, the three lamps follow the mode toggle. The behaviour below was deliberately not built there. Reason for the deferral: no engine clock and no reaction layer exist before the scenario phases, and the engine rule in CLAUDE.md forbids real timers in the engine or the UI (tick events with an injected clock only). A timer built into the panel phase would be thrown away.

## To build in the engine phase

1. **120 s MAX run.** Pressing `btn.deice_max` while `sw.deice_mode` is HIGH sets the flag `deice.max_active` for 120 s of the engine's virtual clock (tick events, never `setTimeout`). While the flag is set the top amber lamp `lt.deice_max` is lit. After 120 s the flag clears and MAX is ignored until the button is pressed again. Leaving HIGH clears the flag at once. The lamp logic is already derived from the flag (`src/aircraft/da50rg/indicators.ts`); nothing sets it yet, so the top lamp never lights. A press alone must light nothing (T-01.1-42): the lamps read the mode toggle and the flag, never the button.
2. **ANNUN-TEST self-test.** The lower position of `sw.deice_ice_light` is the lamp test of the system. Which lamps it lights is not known; define it with the scenarios.
3. **WIND SHIELD spray.** `btn.deice_windshield` is a momentary button with no effect; the spray (and any scenario that needs it) comes with the engine.
4. **ICE LIGHT effect.** The upper position of `sw.deice_ice_light` has no effect yet.

Also deferred in the same engine phase: the ELT lamp behaviour in RESET / TEST (today `lt.elt` is lit in ON only).

## Open question

- Q-02 of `docs/PANEL-LABELS.md`: does the ANNUN-TEST position spring back to OFF? Default taken: no, a maintained 3-position switch. If it springs back, the control becomes a spring-return toggle in `controls/deice.ts`.
