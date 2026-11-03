# Phase 7 UAT: changes noted by the owner (2026-11-03), implement together with the walkthrough findings

1. Footwell cluster: the three flight conduct buttons (Continue to destination, Alternate landing, Emergency landing) are separated from the other options by a line, so it is clear they belong together (static art on the plate, listed in PANEL-LABELS/PANEL-REVIEW if it carries text; none needed for a plain line).
2. With the conduct "Emergency landing" selected, the Avoid actions Avoid NVFR and Avoid icing are greyed out and not pressable (a forced landing cannot avoid them, the situation is as it is); Avoid IMC stays available (while gliding down with a dead engine the pilot can still avoid clouds). The greyed state follows the selection, never any text change (G-0). Open question for the walkthrough: do picks made before switching to Emergency landing stay recorded (probably: grey out, ignore for the note, keep log) or are they cleared.

## Status (2026-11-03)

- Item 1 done: a thin divider line (`FURTHER_DIVIDER`, plain line, no text) under the conduct row; gap 7 units (11 and 8 failed the Full panel gate of the phone profile), cluster 464 x 192, plate 504 x 230.
- Item 2 done: `blockedByConduct` on Avoid NVFR and Avoid icing (aircraft data), `isBlocked` in `src/engine/further.ts`; greyed button (dimmed, `aria-disabled`, press logs nothing). Open question answered with the default: earlier picks stay in the log and the selection (shown dimmed), the debrief ignores them under the emergency landing and they are live again after switching back; the grade is unchanged. Documented for the owner in `docs/PANEL-REVIEW.md` items 6 and 20, `docs/GRADING.md` R21.
- Nothing left in this file once the owner confirms both in the walkthrough; move it to `done/` then.
