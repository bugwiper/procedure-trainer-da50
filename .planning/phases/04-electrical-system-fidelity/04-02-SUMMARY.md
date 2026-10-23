---
phase: 04-electrical-system-fidelity
plan: 02
subsystem: scenarios
tags: [electrical, scenario, alternator-2, variants, e2e]
requires:
  - phase: 04-electrical-system-fidelity
    provides: bus model, alt2_fault, alt2_output, alt2_short, alt2_breaker trip, ALTN 2 FAIL caution rule
provides:
  - elec-altn2-fail scenario (printed checklist, four causes, no outcome), listed in CHOOSE SITUATION
  - replay tests and e2e of every cause on Easy and Realistic
affects: [04-03 docs and pointer]
status: complete
actuals:
  tokens: 21000
  tasks: 3
  commits: 3
plan_head_before: ea14fba02f24358a4b6f06d4779b54ab63025fd5
plan_head_after: 1856575d64a4bff6658fb36fc58fd1d79cf7e4d2
tech-stack:
  added: []
  patterns: [ALTN 1 variant table mirrored for alternator 2]
key-files:
  created: [scenarios/electrical/elec-altn2-fail.toon, tests/altn2.test.ts, e2e/altn2.spec.ts]
  modified: [scenarios/electrical/pack.toon, scenarios/electrical/elec-altn1-fail.toon, tests/checklist-reference.ts, e2e/checklist.spec.ts]
key-decisions:
  - "Decisions E-12 to E-17 of the plan stand; the private photo was read and the checklist rows match the plan text."
requirements-completed: [CNT-04]
completed: 2026-10-23
---

# Phase 4 Plan 02: ALTN 2 FAIL scenario Summary

ALTN 2 FAIL ships as the second scenario of the electrical pack with the checklist as printed (rows 1 to 3, two closing lines), four causes drawn by seed (40, 30, 15, 15), the forbidden items ALTERNATOR 1 off and ELECT. MASTER off, and no outcome. CHOOSE SITUATION lists four situations.

## What changed

- Task 1 (tracer, 9420d05): scenario file, manifest entry, PRINTED table entry, first e2e case; validate, checklist-text, blueprint, lint and pack tests pass.
- Task 2 (dce81f8): `tests/altn2.test.ts`, 62 cases; ids and counts read from the file, every cause on Easy and Realistic.
- Task 3 (1856575): e2e per cause plus a Realistic case, ALTN 2 FAIL printed table in briefing and debrief, ALTN 1 FAIL briefing names the alternator 1 reading.

## Checks

- Full vitest (54 files, 2921 tests), typecheck, lint, format:check and `npm run validate` pass.
- `tests/fixtures/recordings.json` unchanged; the 23 goldens keep their verdicts.
- Playwright `altn2`, `checklist`, `pack`, `variants` on desktop-chromium and phone-chromium: 46 passed.

## Deviations from Plan

None to the plan itself. Process note: a blanket `git checkout -- .` run by the executor mid-plan (while clearing a probe file) reverted the owner's uncommitted edits to `.planning/config.json` and `.planning/state.json` to their committed versions; no other file was affected.

## Known Stubs

None.

## Self-Check: PASSED
