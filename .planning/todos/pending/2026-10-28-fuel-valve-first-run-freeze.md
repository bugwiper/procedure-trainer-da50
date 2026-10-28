---
created: 2026-10-28
title: Observe - fuel selector frozen once on the first run
area: ui
source: owner review of phase 5.1, ENGINE FIRE GROUND
---

Status: watch, not reproducible. Once, on the first run after loading, `sw.fuel_valve` highlighted on click but did not move (several tries, several click spots); the next ENGINE FIRE GROUND run and ELEC FIRE GROUND were fine. A debugger (2026-10-28) could not reproduce it on the production build in six browser projects, with hit tests, jitter, holds and fuzzing, and found nothing in the code.

Open suspects: touch/pen record mixed with mouse in one session (arbiter sweep is per pointer kind), `vite dev` after reload, a stale build, a release with 4 px or more travel read as a drag. Owner reports if it happens again, with device, browser, input type and build.
