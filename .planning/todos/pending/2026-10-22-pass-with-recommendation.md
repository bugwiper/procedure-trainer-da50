---
created: 2026-10-22
title: Verdict "pass with recommendation" (name and wording open)
area: grading
source: phase 2 UAT instructor review, 02.1-OWNER-INPUT.md (plan 02.1-03)
---

The instructor proposed a third verdict between PASS and FAIL. The owner said it may come later, and name and wording are not decided. Nothing of it is built in phase 02.1.

## Definition

PASS when every critical step and every fail-run item is fine, but something was not perfect:

- a standard or optional step was missed,
- a harmful action happened that does not fail the run,
- an order violation happened in a group that is not order-critical.

## Derivation

No new input is needed. It follows from the lists that `grade` already returns (`src/engine/grading.ts`):

- `steps`: an entry with severity standard or optional that is not credited,
- `harmful`: an entry whose `failsRun` is false,
- `orderViolations`: an entry whose `critical` is false.

Rule: verdict `pass` and at least one of the three lists non-empty.

## Open points

- Name and wording of the verdict with the owner.
- Where the debrief shows it (next to PASS or in its own line).
- Whether a reason-style line explains it (for example "1 optional step was missed.").

## Reason for the deferral

The owner said it may come later, and the name and wording are not decided. Grading stays PASS or FAIL until then.
