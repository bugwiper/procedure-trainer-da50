---
created: 2026-10-28
title: Emergency landing (engine off / with engine) as a visualised continuation
area: scenarios
source: owner review of phase 5.1, T/O FIRE NO ABORT
---

In T/O FIRE NO ABORT and ELEC FIRE FLIGHT the aircraft is not shown flying or landing, yet the pilot must shut down engine, fuel and electrics. The checklist box "EMERGENCY LANDING (ENGINE OFF) (page 9)" is only a reference row. Owner: many scenarios will lead into an emergency landing with or without engine, so it needs its own visualisation and a transition into it.

Idea: a button ("conduct emergency landing") or an automatic transition after the critical rows (for example after ECS shut-off PULL) that jumps into an emergency-landing scenario. Needs a climb-out scene for the no-abort case (see PANEL-REVIEW item 10). Decide in the planning of a later phase (landing and flight scenes, Phase 6 or 7).

## Status (2026-10-29): planned for Phase 7

The owner confirmed (D-12) that the continuation belongs to Phase 7, where the landing decision (SES-05) defines the transition. Its prerequisite is delivered by Phase 6: scripted flight profiles for every situation, the live PFD with airspeed, altitude, vertical speed and attitude, and the engine-stopped glide regime. Still to do there: a landing scene, a session transition and a newly printed checklist (EMERGENCY LANDING, page 9). Note: after the engine stops right after lift-off in T/O FIRE NO ABORT the aircraft reaches the runway height within seconds and stays level, because no landing model exists.

## Status (2026-11-01): the decision is delivered, the landing stays open

Phase 7 plan 07-02 delivered the decision and the note: the pilot chooses the further flight conduct in the FURTHER ACTIONS modal (continue normally, precautionary landing, emergency landing), a scenario declares which one is right (`further.conduct`), the choice is recorded and graded, and when the last pick is the emergency landing the debrief says that the landing itself is not trained yet. Still open (owner decision D-12, not in Phase 7): the follow-on scenarios with and without engine power, the landing scene, a session transition from the choice into such a scenario and the newly printed checklist EMERGENCY LANDING (page 9).

## Status (2026-11-03): planned as Phase 9

Owner brief of 2026-11-03: the debrief of a situation whose final conduct is the emergency landing offers to continue into an emergency-landing situation, with and without engine power; a simple approach view of an off-airport field in the windscreen and on the PFD; the pre-landing checklist done on the panel and the sheet; no landing model. Planned as Phase 9 (`.planning/phases/09-emergency-landing-situations/`, decisions in `09-CONTEXT.md`, plans 09-01 to 09-03). Plans 09-01 and 09-02 (view, end at the field, follow-on, declarations, stopped engine) need no printed text; plan 09-03 (the two printed situations) waits for the owner: the booklet pages 9 and 10 are not in `.input/` (see the open question in `09-CONTEXT.md`). Move this file to `done/` when 09-03 is executed.
