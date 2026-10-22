---
status: testing
phase: 02-first-gradable-scenario
source: [02-VERIFICATION.md]
started: 2026-10-22T00:00:00Z
updated: 2026-10-22T12:00:00Z
---

## Current Test

number: 3
name: Instructor review of docs/GRADING.md and the scenario file
expected: |
  A DA50 instructor confirms rules R1-R9 and the severity, threshold and forbidden assignments as acceptable.
awaiting: user response (external reviewer)

## Tests

### 1. Real phone and tablet run-through
expected: All cards fit with the action row reachable; correct PASS for the golden run.
result: pass
note: Passed on macOS Safari and iPhone Safari (local preview). Android and tablet not tried.

### 2. UI-SPEC wording and alert text
expected: Dialogs, briefing, debrief, confirm and error text accepted against 02-UI-SPEC.md; the chip reads "ENG OIL TEMP" (the real CAS text) where the roadmap says "OIL TEMP HIGH".
result: pass
note: Wording accepted. Owner change requests (not gaps): (1) move the briefing source line to the very bottom; (2) difficulty levels easy, medium, realistic, so the checklist is not always shown in the briefing. Both go to the backlog / next phase decision.

### 3. Instructor review of docs/GRADING.md and the scenario file
expected: A DA50 instructor confirms rules R1-R9 and the severity, threshold and forbidden assignments as acceptable.
result: [pending]

## Summary

total: 3
passed: 2
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
