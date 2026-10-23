---
created: 2026-10-23
title: ENG OIL TEMP timing (owner acceptance of the Realistic speed gap)
area: engine
source: owner UAT retest of plan 03-11, 2026-10-23
---

## Owner findings

The Realistic run behaves as described, with these timing corrections:

1. **Time to yellow after the onset is right** (about 1 s).
2. **Time in yellow should be longer.** The pilot first looks at the other parameters and thinks about what could raise the temperature. Time from yellow to red: about **20 s** after the onset (today red comes about 6 s after the onset).
3. **After red the temperature must rise much more slowly**, because the pilot needs time to get the checklist out, and real oil temperature does not rise that fast. Time from the start of red to the end of the scenario by overheat (named outcome `engine_failure`, 140 degrees held 15 s): about **3 minutes**.
4. **Medium** is right in feel, but an ignored run takes 42.6 s to the end; it should take about **3 minutes** to the end by overheat (Easy shares the do-nothing behaviour of Medium).

## Interpretation to implement (data, not code paths)

- The oil temperature needs a rate that depends on the current value (fast below the red band, slow in and above it), for example a rate curve over the quantity (src/engine/curve.ts exists, only + - * /), instead of one lag constant. Keep fixed 100 ms steps and replay equals live.
- Realistic: start just below yellow as now; yellow about 1 s after the onset, red about 20 s after the onset, outcome about 180 s after red began.
- Easy and Medium: from the base state with the scenario's degraded cooling, do-nothing run ends by overheat at about 180 s from the start; the yellow and red crossings come at plausible times in between.
- A correct handling (POWER down, cowl flap open) must still bring the oil temperature back down and clear the message in reasonable time; the golden recovery recordings keep passing.
- The do-nothing outcome times in the recordings change (42.6 s today); that is expected for Easy and Medium, update the pinned values and the golden fixtures with the reason, and record the new values in docs/GRADING.md (instructor review item 1 and 4).
- Lint L15 (message within 12 s of the onset at both window ends) must follow the new 20 s: the message-within bound for ENG OIL TEMP moves (scenario-level or per scenario value), not the other two scenarios.

## Done (2026-10-23)

Implemented as a rate curve over the oil temperature (`src/aircraft/da50rg/oil-temp-curve.ts`), a finer scale for the oil temperature reading, the plain lag kept for a falling temperature, and the lint L15 bound per scenario (`onset.message_within_s`, 22 for ENG OIL TEMP). Measured: Realistic yellow 0.8 to 1.2 s and red with the message 19.6 to 20.1 s after the onset, the outcome 186.6 s after the start of red; Easy and Medium outcome at 173.2 s. The aircraft parameter `oil_temp_rate` is gone. The golden recordings carry no outcome time and did not change. Values and the measured timeline are in `docs/GRADING.md`, instructor review of phase 3, items 1, 4 and 5.
