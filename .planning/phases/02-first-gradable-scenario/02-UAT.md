---
status: testing
phase: 02-first-gradable-scenario
source: [02-VERIFICATION.md]
started: 2026-10-22T00:00:00Z
updated: 2026-10-22T12:00:00Z
---

## Current Test

number: 2
name: UI-SPEC wording and alert text
expected: |
  Dialogs, briefing, debrief, confirm and error text accepted against 02-UI-SPEC.md; the chip reads "ENG OIL TEMP" (the real CAS text) where the roadmap says "OIL TEMP HIGH".
awaiting: user response

## Tests

### 1. Real phone and tablet run-through
expected: All cards fit with the action row reachable; correct PASS for the golden run.
result: pass
note: Passed on macOS Safari and iPhone Safari (local preview). Android and tablet not tried.

### 2. UI-SPEC wording and alert text
expected: Dialogs, briefing, debrief, confirm and error text accepted against 02-UI-SPEC.md; the chip reads "ENG OIL TEMP" (the real CAS text) where the roadmap says "OIL TEMP HIGH".
result: [pending]

### 3. Instructor review of docs/GRADING.md and the scenario file
expected: A DA50 instructor confirms rules R1-R9 and the severity, threshold and forbidden assignments as acceptable.
result: [pending]

## Summary

total: 3
passed: 1
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
