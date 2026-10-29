---
created: 2026-10-28
title: Pitot and stall heat CAS messages
area: aircraft
source: owner review of phase 5.1, ICING
---

Owner description of the real behaviour: whenever the PITOT/STALL HEAT switch is off (or the system is faulty), two independent yellow CAS messages show on the PFD: "PITOT HEAT" and "STALL HEAT". On the ground the stall heat would melt without cooling airflow, so after switching the heat on the STALL HEAT message appears again after a few seconds, because the system deactivates the stall heat temporarily; airborne it disappears.

To do: two CAS rules (one per message) on the switch state, plus the ground/air timing (needs the ground flag, `ground_roll` / flight state). Fits with the Phase 6 PFD work or earlier as a small fix; the ICING scenario row 3 (PITOT/STALL HEAT ON) should then clear both messages.

## Status: DONE in phase 6 (plan 06-04, 2026-10-29)

Rules `pitot_heat`, `stall_heat` and `stall_heat_ground` in `src/aircraft/da50rg/cas.ts`; the ground cut-out is the hidden quantity `stall_heat_timer_s` (5 s, `STALL_HEAT_CUTOUT_S`). The icing situation starts with the heat off as its single variant `heat_off`; the ground situations show STALL HEAT 5 s into the run (owner confirmed, D-12). Rules and values: `docs/GRADING.md`, section "Pitot and stall heat (phase 6)". Not built: a heat fault input and the electrical dependence of the heat (breaker-effects todo).
