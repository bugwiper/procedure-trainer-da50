---
created: 2026-10-23
title: Checklist fidelity for ALTN 1 FAIL, ALTN 2 FAIL and Engine Fire
area: content
source: owner instructor review of phase 3 (checklists supplied as photos)
---

## Official checklists (summary, own words)

- **ALTN 1 FAIL:** circuit breaker check IN, alternator 1 OFF, essential bus ON, bus voltage MONITOR; then end NVFR/IFR flight, land at the nearest suitable airfield, leave icing conditions.
- **ALTN 2 FAIL:** circuit breaker check IN, alternator 2 OFF, bus voltage MONITOR; same closing lines.
- **Engine Fire in flight:** ECS circulating air FRESH AIR, ECS shut-off PULL, engine master OFF, fuel valve OFF, electric master OFF; then airspeed, front windows, emergency landing, doors after standstill.

## Gaps against the shipped content

- `elec-altn1-fail` has only alternator 1 OFF and essential bus ON as critical steps. Consider the circuit breaker check (`cb.alt1` exists) as an optional or critical step, and a bus voltage monitor note.
- ALTN 2 FAIL is not shipped: needs an ALT 2 caution rule and an alternator 2 failure parameter (see the physics fidelity todo for the bus model).
- Engine Fire: the five panel steps match; airspeed, windows and doors are not panel actions.

Roadmap (decided 2026-10-23): the ALTN 1 FAIL and ALTN 2 FAIL items belong to Phase 4, Electrical system fidelity.

The instructor review answers (items 2, 4, 5, 6, 8 accepted; 1, 9, 10 accepted for the beta, to tune during use) are recorded in `docs/GRADING.md`.
