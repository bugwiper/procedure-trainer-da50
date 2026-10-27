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
