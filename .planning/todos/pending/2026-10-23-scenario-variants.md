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

This fits next to the physics fidelity phase (the buses and the ALT 1 / ALT 2 model make the causes real) and should come before more scenarios are added, so new scenarios are written in the variant form from the start. Both go together in one phase after the base work, or the variant mechanism comes first as its own small phase.
