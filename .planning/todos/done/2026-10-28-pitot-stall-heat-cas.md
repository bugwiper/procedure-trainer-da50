---
created: 2026-10-28
title: Pitot and stall heat CAS messages
area: aircraft
source: owner review of phase 5.1, ICING
---

Owner description of the real behaviour: whenever the PITOT/STALL HEAT switch is off (or the system is faulty), two independent yellow CAS messages show on the PFD: "PITOT HEAT" and "STALL HEAT". On the ground the stall heat would melt without cooling airflow, so after switching the heat on the STALL HEAT message appears again after a few seconds, because the system deactivates the stall heat temporarily; airborne it disappears.

To do: two CAS rules (one per message) on the switch state, plus the ground/air timing (needs the ground flag, `ground_roll` / flight state). Fits with the Phase 6 PFD work or earlier as a small fix; the ICING scenario row 3 (PITOT/STALL HEAT ON) should then clear both messages.
