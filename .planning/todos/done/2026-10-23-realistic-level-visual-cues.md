---
created: 2026-10-23
title: Visual cues for failures on the Realistic level (windscreen): what remained for Phase 5.1 (done)
area: panel
source: owner instructor review and first live test of phase 3; owner spec of 2026-10-27
---

Phase 5 is done: the windscreen, the scenes parked, take-off roll, cruise and cloud, the engine fire flames, cabin smoke, windscreen ice with warm air and the WIND SHIELD spray, the stopped propeller, oil streaks and the aural cues exist. The record of what was built and the original text are in [the done file](../done/2026-10-23-realistic-level-visual-cues-phase5.md). The night and dusk scenes are their own todo (`2026-10-27-night-dusk-scenes.md`).

## Left for Phase 5.1 (all built in phase 5.1, closed 2026-10-27)

- [x] The six situations with their printed checklists (edition 4.1, AFM form): engine fire on ground, electrical fire with smoke on ground, smoke and fire during take-off (abort and no abort), electrical fire in flight, unintentional flight into icing; engine fire in flight existed (booklet page, unchanged; the differences are in `docs/GRADING.md`).
- [x] Electrical fire with smoke in the cabin on the ground and in flight, with the smoke clearing under the right actions.
- [x] Unintentional flight into icing: the scenario on the cloud scene; the icing area ends after 3 minutes. Aerodynamic effects of ice stay with the physics phase (see `2026-10-27-phase-5.1-cuts.md`).
- [x] The take-off roll scrolls at a rate that follows the ground speed.
- [x] New panel parts: toe brakes in the pilot's footwell (one latching control drawn as two pedals), the transponder beside the session buttons, the oval emergency window (above the door lock lever in the left strip, not in the side pane).

## Owner answers for Phase 5.1 (2026-10-27, all applied)

- "Ground Idle (GI)" in the printed checklists is just normal idle in the simulation; no separate lever position.
- "FUEL valve OFF (lift and turn)": OFF is the 180 degree position (as built); the lift is not modelled.
- Door and window are two separate controls. The red release lever is the control of the DOOR (the rows "Door open" and "Doors open" after standstill): locked, it lies in the door arm rest; open, it is pulled up (draw it like the parking brake, only longer and red). The oval emergency window in the side pane at the far left is a separate control for "Emergency Windows OPEN if required": in the simulation it is opened and closed by clicking it (a toggle).
- Icing: after the TKS spray the ice does not come back on the windscreen at first. In reality the effect lasts at least several minutes, and with the warm air flow by then at the latest the ice does not return. So after a spray the pilot side stays clear (for the rest of a run in a normal scenario length, or at least several minutes); this replaces the phase 5 behaviour that the pilot side re-ices while the parameter is above 0.

## Emergency Landing with Engine Off (owner, 2026-10-27)

The Engine Fire in Flight checklist refers to this one ("Carry out: EMERGENCY LANDING (ENGINE OFF)"). Screenshot in .input/checklist-emergency-landing-engine-off.png (private). Printed rows: A POWER lever Flight Idle (FI), B ENGINE MASTER OFF, C PFD/MFD control unit (keypad) (if installed) stowed, D FUEL valve OFF, E Airspeed, Landing Gear, Flaps as required; sub-heading Before touchdown: F Belts and Harnesses fasten, G Sun visors (if installed) locked in fully upward position, H Doors unlatch, I ELECT. MASTER OFF. The door is unlatched with the red release lever before a crash landing (owner), so the door rows of the fire scenarios carry over. For later: a follow-on checklist after Engine Fire in Flight and Engine Failure scenarios (Phase 7 further actions or a scenario of its own); a "Flight Idle (FI)" lever position would need the idle detents split (Ground Idle is just idle for now).
