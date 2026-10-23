---
created: 2026-10-23
title: Scenario variants (several causes behind one failure)
area: engine
source: owner UAT of phase 3, test 12
---

## The question

One failure message can have several causes with different correct actions, and the official checklist is written to cover all of them with its first steps. Example ALTN 1 FAIL ("Circuit breaker check IN" first):

1. The ALT 1 breaker has popped and the alternator is fine. Pushing it in fixes everything; the caution clears and no further step is needed.
2. The breaker is in and the alternator is dead. The pilot goes on to ALTERNATOR 1 OFF and ESS BUS ON (what shipped).
3. The alternator died and popped the breaker. Pushing it in pops it again (or it stays in and the alternator is still dead), then the pilot continues as in 2.
4. The breaker stays in after the push, the alternator is still dead: as 2.

## What exists today

- Scenario parameters (a scenario sets, for example, a degraded oil cooling or a dead alternator) and branches decided at the start (the oil pressure branch of ENG OIL TEMP, evaluated on the starting quantities).
- Reactions with timers and named outcomes; a seed for the onset on Realistic.

## What is missing

- **Variants in the scenario file:** a list of causes, each with its own starting state (control overrides such as `cb.alt1` pulled, plus parameters), a weight, and the steps it requires. The checklist shown stays the one official checklist; which of its steps are required depends on the variant (like the "if" lines in the printed checklist).
- **Variant choice:** drawn from the seed on Realistic (and probably also on Easy and Medium, without revealing the cause); recorded in the recording like the onset, so replay and debrief know it.
- **A breaker that re-trips:** a reaction "pushing the breaker in while the fault is present pops it again" (pure arithmetic, event-driven, in the sim).
- **Lint:** every variant is solvable with its required steps, a do-nothing run fails in every variant, steps of one variant are not harmful actions in another (for example pushing a breaker in is harmless, pulling it is not), and the realistic do-nothing run shows the message in every variant.
- **Debrief:** names the variant that was drawn ("The breaker had popped") after the run, not before.

## Placement

Decided 2026-10-23: the variant mechanism is its own phase, Phase 3.1 (inserted after Phase 3), and comes before the fidelity phases (Phase 4 electrical system, Phase 5 fuel and engine page), so new scenarios are written in the variant form from the start. The buses and the ALT 1 / ALT 2 model of Phase 4 make the causes fully real; Phase 3.1 builds the mechanism on the current model. The Phase 7 authoring guide must describe the variant format.

## Also in this phase: run robustness from the phase 3 code review

Owner decision 2026-10-23: both findings go into phase 3.1 (the phase touches run and replay anyway). Source: `.planning/phases/03-reactive-scenarios-and-initial-pack/03-REVIEW.md`.

- **WR-03 (`src/ui/clock-driver.ts`):** `frame()` schedules the next animation frame only after `run.step()`. A throw from a step listener (the grading in `completeRun`, a sim error, `markConsumed`) ends the frame loop until the page is reloaded and freezes the display. Fix: schedule the next frame first or catch the error, surface it (not silent), and keep the loop alive or stop the run cleanly; add a unit test with a throwing listener.
- **WR-05 (`src/engine/sim.ts`, `src/engine/run.ts`):** `simulate()` is capped at 30 minutes (`MAX_RUN_MS`) but a live run is not. After minute 30 the replay can differ from what the pilot saw, and a retract leaves `sim.t` and the clock offset for good. Fix: end the live run cleanly at the cap or apply the same cap to both, and add a test that live and replay agree at and after the cap, with and without a retract.

## Resolved

Phase 3.1 (2026-10-23, plans 03.1-01 to 03.1-03). Scenario variants (`variants`, `onset.controls`), the draw by seed on every level, the recorded variant, the cause line in the debrief, the re-tripping breaker (a trip in the aircraft's physics) and lint L18 to L21 are built; ALTN 1 FAIL ships four causes. WR-03 (a throwing step listener) and WR-05 (the 30-minute cap) are fixed with tests. The rules are R13 to R15 and "Variants for authors" in `docs/GRADING.md`. What remains: variants for ENG OIL TEMP and ENGINE FIRE are in `.planning/todos/pending/2026-10-23-variants-oil-temp-and-fire.md`.
