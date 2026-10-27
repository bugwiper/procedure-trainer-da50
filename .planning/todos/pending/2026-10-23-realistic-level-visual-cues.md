---
created: 2026-10-23
title: Visual cues for failures on the Realistic level (windscreen): what remains for Phase 5.1
area: panel
source: owner instructor review and first live test of phase 3; owner spec of 2026-10-27
---

Phase 5 is done: the windscreen, the scenes parked, take-off roll, cruise and cloud, the engine fire flames, cabin smoke, windscreen ice with warm air and the WIND SHIELD spray, the stopped propeller, oil streaks and the aural cues exist. The record of what was built and the original text are in [the done file](../done/2026-10-23-realistic-level-visual-cues-phase5.md). The night and dusk scenes are their own todo (`2026-10-27-night-dusk-scenes.md`).

## Left for Phase 5.1 (scenarios that use the cues, and new panel parts)

**Scenarios that need the printed checklists** (verbatim, edition 4.1, from the owner): engine fire on ground, electrical fire with smoke on ground, engine fire on takeoff (abort and no abort), engine fire in flight (exists), electrical fire in flight, unintentional flight into icing. They use the scenes, the smoke and the ice that Phase 5 built (the printed checklists differ per flight phase: in each the scenario names its scene).

**Electrical fire with smoke in the cabin** (on the ground and in flight): the smoke overlay exists (`smoke_density`, `smoke_source`); the scenarios and their checklists do not.

**Icing** (abnormal "Unintentional flight into icing conditions", supplement in .input/FIKI_AFM.pdf): the visual side exists; the scenario does not. Aerodynamic effects (speed loss from wing ice) come later with the physics.

**Runway speed from the ground speed.** The take-off roll scrolls at one constant speed (`--w-roll-period` in `src/ui/stage.css`); Phase 5.1 drives it from the ground speed.

**New panel parts the owner named for the takeoff-roll scenarios.**

- Two rudder pedals with toe brakes in the pilot's footwell, simulating the service brakes (not the parking brake).
- The transponder moves right into the co-pilot footwell beside the situation buttons (until it is integrated into the PFD).
- At the far left an outline of the small oval emergency window in the side pane that can be opened (the engine fire checklist item "emergency front windows ... open as necessary"; the owner will check the exact wording).

## Owner answers for Phase 5.1 (2026-10-27)

- "Ground Idle (GI)" in the printed checklists is just normal idle in the simulation; no separate lever position.
- "FUEL valve OFF (lift and turn)": OFF is the 180 degree position (as built); the lift is not modelled.
- Door and window are two separate controls. The red release lever is the control of the DOOR (the rows "Door open" and "Doors open" after standstill): locked, it lies in the door arm rest; open, it is pulled up (draw it like the parking brake, only longer and red). The oval emergency window in the side pane at the far left is a separate control for "Emergency Windows OPEN if required": in the simulation it is opened and closed by clicking it (a toggle).
- Icing: after the TKS spray the ice does not come back on the windscreen at first. In reality the effect lasts at least several minutes, and with the warm air flow by then at the latest the ice does not return. So after a spray the pilot side stays clear (for the rest of a run in a normal scenario length, or at least several minutes); this replaces the phase 5 behaviour that the pilot side re-ices while the parameter is above 0.

## Emergency Landing with Engine Off (owner, 2026-10-27)

The Engine Fire in Flight checklist refers to this one ("Carry out: EMERGENCY LANDING (ENGINE OFF)"). Screenshot in .input/checklist-emergency-landing-engine-off.png (private). Printed rows: A POWER lever Flight Idle (FI), B ENGINE MASTER OFF, C PFD/MFD control unit (keypad) (if installed) stowed, D FUEL valve OFF, E Airspeed, Landing Gear, Flaps as required; sub-heading Before touchdown: F Belts and Harnesses fasten, G Sun visors (if installed) locked in fully upward position, H Doors unlatch, I ELECT. MASTER OFF. The door is unlatched with the red release lever before a crash landing (owner), so the door rows of the fire scenarios carry over. For later: a follow-on checklist after Engine Fire in Flight and Engine Failure scenarios (Phase 7 further actions or a scenario of its own); a "Flight Idle (FI)" lever position would need the idle detents split (Ground Idle is just idle for now).
