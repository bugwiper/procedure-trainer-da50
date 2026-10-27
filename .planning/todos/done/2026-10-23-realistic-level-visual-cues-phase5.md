---
created: 2026-10-23
closed: 2026-10-27
title: Visual cues for failures on the Realistic level (windscreen), the parts built in phase 5
area: panel
source: owner instructor review and first live test of phase 3; owner spec of 2026-10-27
---

Closed by Phase 5 (plans 05-01 to 05-03). The parts that wait for Phase 5.1 stay in `../pending/2026-10-23-realistic-level-visual-cues.md`.

## What was built

- **Windscreen.** The panel space grows upward by a windscreen (extent 2180 x 1740 from y -440); art only, its own zoom region, no text (PNL-17).
- **Scenes.** `parked`, `takeoff_roll` (the runway marks scroll toward the viewer, none under reduced motion), `cruise` (default) and `cloud` (IMC, for icing); a scenario names its scene in its file (`scene`, lint L22).
- **Engine fire.** Flames and smoke outside, from the `fire_intensity` quantity, on all three levels; the Realistic run shows them at the onset (lint L23, L24: a declared cue shows within the bound in a do-nothing run, and an onset needs an annunciation or a cue).
- **Easy and Medium.** They keep their briefing and show the cue too, from the start quantities.
- **Cabin smoke.** Smoke over the instrument panel, never blocks a press (`smoke_density`, parameter `smoke_source`).
- **Icing.** Windscreen ice per half; warm air melts it very slowly; the WIND SHIELD spray clears the pilot side only, within about a second (`ice_pilot`, `ice_copilot`, parameter `ice_accretion`).
- **Extras chosen.** Stopped propeller on engine failure, oil streaks (`oil_film`, parameter `oil_leak`), a cloud scene for icing, aural cues with Web Audio (caution bing, warning tone, engine drone from the rpm, off by default, PNL-19), a runway that moves while accelerating.

Owner spec text, answers and the review list: `docs/GRADING.md` (sections "Scenes and cues for authors (phase 5)" and "Instructor review (phase 5, 2026-10-27)"), `docs/PANEL-REVIEW.md` ("Phase 5: owner review").

## Original text

Engine Fire on Realistic cannot be solved: at the onset nothing visible happens and there is no briefing, so the pilot does not know what is expected. The CAS and the gauges give no cue for a fire.

## Owner idea

Extend the panel upward to show a windscreen (plain blue sky). Scenarios draw static cues there: fire and smoke for an engine fire, an iced windscreen later, and others. This also helps immersion. Alternative: a pop-up that states what the pilot would experience at that moment.

## To decide

- Decided 2026-10-23: this is Phase 5, Windscreen and failure cues (after Phase 3.1). The panel space (2180 x 1300) and the phone zoom regions change.
- G-0: the windscreen is art, not panel text; no label changes with state.
- Each scenario declares its onset cue in the scenario data (schema, lint, blueprint gate); a Realistic do-nothing run must show the cue (extends lint L14).
- Easy and Medium keep their briefing; decide whether they show the cue too.

## Owner spec for the windscreen phase (2026-10-27)

A cockpit-view picture from the owner shows the intended look (to be attached; ask again if missing). Written down from the owner's message:

**Scenes (flight phase shown through the windscreen).** The scenario declares the situation: parked in front of a hangar, accelerating on the runway (takeoff roll), cruise flight (sky above, simple landscape below; the default for most situations). Each is explained in the briefing text and also visible.

**Engine fire.** Flames and smoke in front of the windscreen, coming from the front, outside. Needed in several flight phases because the printed checklists differ: engine fire on the ground, engine fire on takeoff (if the takeoff can be aborted, if it cannot), engine fire in flight. The existing Engine Fire in flight scenario gets its cue first.

**Electrical fire with smoke in the cabin** (on the ground and in flight): smoke that partly hides the instrument panel, so the user sees the smoke is inside the cockpit, not outside like the engine fire.

**Icing** (abnormal "Unintentional flight into icing conditions", supplement in .input/FIKI_AFM.pdf): the windscreen freezes, ice crystals grow, vision turns milky. Warm air onto the windscreen (central pedestal control) removes the ice slowly. The WIND SHIELD button of the de-ice panel sprays TKS fluid on the pilot's side only, visibly, and the ice then disappears. Aerodynamic effects (speed loss from wing ice) come later with the physics; only the visualisation now. Wing de-ice (airframe) is what removes the later aerodynamic effects.

**New panel parts the owner named for the takeoff-roll scenarios.**

- Two rudder pedals with toe brakes in the pilot's footwell, simulating the service brakes (not the parking brake).
- The transponder moves right into the co-pilot footwell beside the situation buttons (until it is integrated into the PFD).
- At the far left an outline of the small oval emergency window in the side pane that can be opened (the engine fire checklist item "emergency front windows ... open as necessary"; the owner will check the exact wording).

**Needs from the owner later:** the printed checklists (verbatim, edition 4.1) for: engine fire on ground, electrical fire with smoke on ground, engine fire on takeoff abort and no abort, engine fire in flight (exists), electrical fire in flight, unintentional flight into icing.

**Ideas offered by Claude (owner to pick):** oil streaks on the windscreen (oil leak, loss of oil pressure), stopped propeller disc on engine failure, night and dusk scenes (NVFR checklists, electrical failures), cloud/IMC scene for icing, aural cues with Web Audio (caution chime, engine sound following rpm), a runway that moves while accelerating.
