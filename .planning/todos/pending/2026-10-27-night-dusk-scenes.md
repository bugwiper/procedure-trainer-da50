---
created: 2026-10-27
title: Dusk and night scenes for the windscreen
area: panel
source: plan 05-03 (A-05), cut from phase 5
---

Cut from Phase 5: a dusk and a night scene need a panel lighting treatment (instrument and flood light, the glare on the glass, the dimmed art) as well as the windscreen art, so they are one piece of work, not a scene id. Reasons to do it: the NVFR checklists and the electrical failures at night read better with a dark cockpit.

## To decide when it is picked up

- The scene ids `dusk` and `night` in the aircraft scene list (`src/aircraft/da50rg/scenes.ts`) and the art in `src/ui/panel/windscreen/scenes.tsx` (lint L22 and the typed art record follow by themselves).
- How the panel dims: a lighting layer over the panel art driven by the scene and by the INSTRUMENT LIGHT and FLOOD LIGHT knobs, without changing any label (G-0: no text changes with state) and without hiding a control from the tap gates.
- Whether the lamps and the glass displays keep their brightness (they do on the real aircraft).
