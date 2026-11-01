---
created: 2026-11-01
title: Ideas deferred from phase 7 (training mode, further actions, repeat loop)
area: session
source: 07-CONTEXT.md (deferred), owner decisions of phase 7
---

Phase 7 delivered the Training mode with hint and checklist sheet, the graded further actions, Retry, Next situation and the README authoring guide. These ideas were left out on purpose; none is a bug. Pick them up in a later phase or the owner's UAT of phase 7.

- **An "either call" role** for the ATC call: where a printed page says only "inform ATC" (ICING CONDITIONS, and as an alternative for the fires) both calls are optional today. A role "one of the two is required" would change the schema, lint L27, `grade` (rules R16 to R19) and the shipped declarations. Listed as an open point in `docs/PANEL-REVIEW.md` "Phase 7: owner review", item 5.
- **Further actions that depend on the variant**: a role per cause (for example a MAYDAY that is required only in the shorted-alternator cause).
- **Time limits on decisions** (a call that must come within N seconds of the onset).
- **Hints that name further actions** and **checklist progress ticks in the sheet**.
- **Remembering the mode and the level** across reloads (today both are asked every time a situation is opened).
- **A hint count or a hint penalty**: the owner wants hints never to touch grading, so this stays out unless the owner changes the decision.
- **The emergency-landing follow-on scenarios** (with and without engine power), the landing scene, the session transition from the conduct choice and the newly printed checklist: recorded in `2026-10-28-emergency-landing-scenarios.md` (owner decision D-12).
- **A non-developer authoring tool**: the guide is a README section for developers only (owner decision D-15).
- **Retry with a new draw**: the seed rule is the one function `retrySeeds` in `src/ui/session.ts`; a rule that draws a new cause unless the run was Realistic is a change of that function and of its test.
