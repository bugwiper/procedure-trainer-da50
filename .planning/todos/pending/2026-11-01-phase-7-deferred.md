---
created: 2026-11-01
updated: 2026-11-02
title: Ideas deferred from phase 7 (checklist sheet, further actions, repeat loop)
area: session
source: 07-CONTEXT.md (deferred and R-14), owner decisions of phase 7
---

Phase 7 delivered the checklist sheet with live marks, the Realistic checklist choice and hint box, the further actions as six footwell toggle buttons that are graded with the panel actions, Retry, Next situation and the README authoring guide (reworked after the owner walkthrough of 2026-11-02, plans 07-04 and 07-05). These ideas were left out on purpose; none is a bug. Pick them up in a later phase or the owner's UAT of phase 7.

- **An "either call" role** for the ATC call: where a printed page says only "inform ATC" (ICING CONDITIONS, and as an alternative for the fires) both calls are optional today. A role "one of the two is required" would change the schema, lint L27, `grade` (rules R16 to R19) and the shipped declarations. Listed as an open point in `docs/PANEL-REVIEW.md` "Phase 7: owner review".
- **Further actions that depend on the variant**: a role per cause (for example a MAYDAY that is required only in the shorted-alternator cause).
- **Time limits on decisions** (a call that must come within N seconds of the onset).
- **Progress marks for further actions in the sheet** (a mark for MAYDAY or the conduct next to the checklist steps) and **green marks for a foreign checklist that matches by content** (today a checklist chosen on Realistic is marked only when it is the situation's own).
- **A checklist choice that affects the verdict**: the owner decided no; the choice is named in the debrief only.
- **A debrief timeline of the selections** (when each button was switched on or off; the recording already holds every press with its run time and flag).
- **The footwell buttons visible and inert on the free panel** (today the plate is drawn empty there and the buttons appear in a run).
- **Remembering the level** across reloads (today it is asked every time a situation is opened).
- **A hint count or a hint penalty**: the owner wants hints never to touch grading, so this stays out unless the owner changes the decision.
- **The emergency-landing follow-on scenarios** (with and without engine power), the landing scene, the session transition from the conduct choice and the newly printed checklist: recorded in `2026-10-28-emergency-landing-scenarios.md` (owner decision D-12).
- **A non-developer authoring tool**: the guide is a README section for developers only (owner decision D-15).
- **Retry with a new draw**: the seed rule is the one function `retrySeeds` in `src/ui/session.ts`; a rule that draws a new cause unless the run was Realistic is a change of that function and of its test.
- **Review info items left as is (07-REVIEW IN-01, IN-05)**: IN-01 a harmful further action without `fails_run` shows as a red "Harmful" next to a PASS (`src/ui/debrief-text.ts`; a UX call: standard tone or a "does not fail the run" suffix). IN-05 `gradeFurther` does not know the onset, so a hand-built recording with a decision before the Realistic onset is counted (a press before the onset is ignored by the session; `grade` could drop decisions with `t < onset.at`). IN-02 and IN-03 are gone with the old hint engine.
- **Deferred in plan 07-06 (R-26)**: greyed entries and links for the non-annunciated procedures that are printed but not shipped (needs the exact headings from the contents pages); the situation chooser on the pad listing the greyed catalog entries; scenarios for the catalog entries that are greyed (the warnings and cautions of the contents pages); an "either call" role; ticks of the sheet that survive a reload; a debrief line that lists the ticks.
