---
created: 2026-10-23
title: Visual cues for failures on the Realistic level (windscreen)
area: panel
source: owner instructor review and first live test of phase 3
---

Engine Fire on Realistic cannot be solved: at the onset nothing visible happens and there is no briefing, so the pilot does not know what is expected. The CAS and the gauges give no cue for a fire.

## Owner idea

Extend the panel upward to show a windscreen (plain blue sky). Scenarios draw static cues there: fire and smoke for an engine fire, an iced windscreen later, and others. This also helps immersion. Alternative: a pop-up that states what the pilot would experience at that moment.

## To decide

- Decided 2026-10-23: this is Phase 5, Windscreen and failure cues (after Phase 3.1). The panel space (2180 x 1300) and the phone zoom regions change.
- G-0: the windscreen is art, not panel text; no label changes with state.
- Each scenario declares its onset cue in the scenario data (schema, lint, blueprint gate); a Realistic do-nothing run must show the cue (extends lint L14).
- Easy and Medium keep their briefing; decide whether they show the cue too.
