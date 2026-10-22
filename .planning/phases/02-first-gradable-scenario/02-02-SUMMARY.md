---
phase: 02-first-gradable-scenario
plan: 02
subsystem: scenario-grading
tags: [pack-seam, access-policy, predicates, grading, virtual-clock, golden-replays]

requires:
  - phase: 02-first-gradable-scenario
    provides: format-1 schema, parser, reference lint, AircraftEnv, the ENG OIL TEMP blueprint (plan 01)
provides:
  - PackProvider and AccessPolicy seam (createPackProvider, openScenario, OPEN_ACCESS) and the VITE_PACKS provider
  - engine pack manifest scenarios/engine/pack.toon
  - predicate evaluator with baseline-relative travel (evaluatePredicate, travelPercent, baselineOf, initialQuantities)
  - pure grade() and branchStatuses() over a recorded action log
  - VirtualClock
  - golden recordings, an order-critical fixture and docs/GRADING.md for the instructor review
affects: [02-03, 02-05, 02-06, 02-07, 02-08, 02-09, 02-11, 02-13]

actuals:
  tokens: 17200
  tasks: 2
  commits: 2

plan_head_before: 8eaa515ef9b38918288d5cfef60a934708d2f84f
plan_head_after: 8da4c1771107f4e25647f139729de9efc78bd36a

tech-stack:
  added: []
  patterns:
    - "Scenario access only through PackProvider plus AccessPolicy; one glob file (packs-vite.ts)"
    - "Grading as a pure replay in log order, output in declared scenario order, JSON-identical on repeat"
    - "Author errors returned as OpenResult reasons, programmer errors thrown (PredicateError, unknown recorded control)"

key-files:
  created:
    - scenarios/engine/pack.toon
    - src/scenario/packs.ts
    - src/scenario/packs-vite.ts
    - src/engine/predicates.ts
    - src/engine/grading.ts
    - src/engine/clock.ts
    - tests/grading.test.ts
    - tests/predicates.test.ts
    - tests/clock.test.ts
    - tests/fixtures/recordings.json
    - tests/fixtures/scenarios/ordered-critical.toon
    - docs/GRADING.md
  modified:
    - tests/scenario-tracer.test.ts

key-decisions:
  - "A policy that throws or rejects denies (fail closed); an unreadable manifest in listPacks becomes load-failed with an issue at (manifest)"
  - "Steps inside a branch that does not apply or is open are left out of GradeResult.steps instead of listed as ungraded"
  - "A recording naming a control the aircraft lacks is a programmer error and throws"

patterns-established:
  - "Faulty-copy tests replace one place of the real scenario text (swap helper) for grading cases too"
  - "Fake pack providers with counting loaders assert that listing and denial never load scenario text"

requirements-completed: [SCN-04, SCN-05, SCN-08, PLT-03]

coverage:
  - id: D1
    description: "The blueprint is listed from the manifest and opened only through the PackProvider and AccessPolicy seam; denied, missing, load-failed and invalid come back as reasons and a denied pack calls no loader"
    requirement: PLT-03
    verification:
      - kind: unit
        ref: "tests/scenario-tracer.test.ts#the pack seam"
        status: pass
    human_judgment: false
  - id: D2
    description: "grade() is a pure function of scenario and log: golden pass, do-nothing fail, wrong order fail, harmful entries on entry even when reverted, toggle-back not credited, fails_run and order_critical honoured, JSON-identical repeats"
    requirement: SCN-04
    verification:
      - kind: unit
        ref: "tests/grading.test.ts#golden recordings (Table R1)"
        status: pass
      - kind: unit
        ref: "tests/grading.test.ts#determinism (R9)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Steps are matched on resulting state relative to the scenario baseline (p65 credits, p70 does not from p75) and branch statuses come from the engine (not_applicable, applies, open)"
    requirement: SCN-05
    verification:
      - kind: unit
        ref: "tests/grading.test.ts#step targets relative to the baseline (D-02, D-09)"
        status: pass
      - kind: unit
        ref: "tests/grading.test.ts#branch applicability (D-23, D-25)"
        status: pass
      - kind: unit
        ref: "tests/predicates.test.ts#every Table F3 check has a true and a false case"
        status: pass
    human_judgment: false
  - id: D4
    description: "VirtualClock advances only by explicit calls, ignores advances while paused and rejects negative or non-finite steps"
    requirement: SCN-08
    verification:
      - kind: unit
        ref: "tests/clock.test.ts#VirtualClock (SCN-08)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The grading semantics (holds at completion, entry detection of harmful actions, pairwise order strictness) suit real DA50 training practice"
    requirement: SCN-04
    verification: []
    human_judgment: true
    rationale: "docs/GRADING.md lists them under 'Open for review with a DA50 instructor'; only the instructor review can confirm them"

duration: 11min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 02: Pack seam, grading and virtual clock Summary

**ENG OIL TEMP is listed and opened only through a PackProvider and AccessPolicy seam and graded PASS or FAIL by a pure replay function (baseline-relative steps, harmful entries on entry, ordered groups, fails_run and order_critical), with a virtual clock and a plain-words grading document for the instructor review.**

## Performance

- **Duration:** about 11 min
- **Tasks:** 2 of 2 (Task 1 tracer, Task 2 test-first semantics)
- **Files:** 13 changed (12 created)

## Accomplishments

- `src/scenario/packs.ts` and `packs-vite.ts`: Table P1. `listPacks` parses manifests and never calls a loader; `openScenario` runs policy, manifest entry, `loadPack`, file by entry, parse, lint, id check, and returns `denied`, `missing`, `load-failed` or `invalid` with issues. `packs-vite.ts` holds the only scenario `import.meta.glob`.
- `scenarios/engine/pack.toon`: manifest of the engine pack with the one entry `eng-oil-temp-green`.
- `src/engine/predicates.ts`: every Table F3 check, travel percent `Math.round(pos * 1000) / 10`, `baselineOf`, `initialQuantities`; lookups through the registry and quantity set and `Object.hasOwn` (T-02-28).
- `src/engine/grading.ts`: rules R1 to R9 as a pure replay; `branchStatuses`, `grade`, and the types of Table G1.
- `src/engine/clock.ts`: `VirtualClock` (now, advance, pause, resume, paused).
- Tests: seam cases with counting fake loaders, six golden recordings with full-object equality, order-critical fixture, F3 true/false cases, all 21 POWER detents, clock cases. docs/GRADING.md with the rules, fixture table and the open review items.

## Task Commits

1. Task 1 (tracer): `e773de4` feat(02-02): open and grade ENG OIL TEMP through the pack seam
2. Task 2: `8da4c17` feat(02-02): grading semantics with golden replays, virtual clock and GRADING.md

Task 2 was run test-first inside one commit as the plan prescribes (one commit per task): the new tests were run before the implementation and failed on 7 grading cases and the missing clock module, then passed after the harmful, order and clock code.

## Verification

- `npx vitest run`: 29 files, 1901 tests passed
- `npm run typecheck`, `npm run lint`, `npm run format:check`: exit 0
- Acceptance greps: `import.meta.glob` in packs-vite.ts 2, `eng-oil-temp-green` in pack.toon 2, `lintScenario` in packs.ts 2, `forbidden-reverted` in recordings.json 1, `class VirtualClock` 1, `Open for review with a DA50 instructor` 1.

## Assumptions taken

- A policy that throws or rejects is treated as denied (fail closed).
- A manifest that cannot be read or fails validation inside `openScenario` is reported as `load-failed` with an issue at `(manifest)`; `listPacks` itself rejects with an Error naming the manifest path, as Table P1 says.
- A manifest entry whose file is not in the pack, and a pack unknown to the provider, are reported as `missing`.
- A scenario file whose id differs from its manifest entry id is `invalid` with an issue at `id`.
- Steps under a branch that is not applicable or open are omitted from `GradeResult.steps` (they are never graded); their branch status is still listed in `branches`.
- The ordered-critical fixture keeps only the green branch with the group and the line "Increase airspeed", and keeps the forbidden item `power_increased`; its title is ORDERED FIXTURE.
- Commit type `feat` for both tasks because each adds production modules; the tests ride in the same commit.
- Executed sequentially on the phase branch; STATE.md and ROADMAP.md updated through the state handlers as the dispatch directed (the plan text says STATE.md is not edited, same as plan 01).

## Deviations from Plan

None - plan executed exactly as written (apart from the assumptions above).

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. T-02-28 (own-key lookups), T-02-29 (policy before any loader, zero loader calls on denial, tested) and T-02-30 (pure grade, JSON-identity tests) are mitigated as planned; no package was installed (T-02-SC).

## Next Phase Readiness

Plan 03 (documents) can run: docs/GRADING.md names only TOON as the scenario format. Plans 05 (validate command, step-true-at-start lint L4 to L9), 06 (session machine calls `openScenario` with `VITE_PACKS` and `grade`) and 09 (clock driver) build on these modules. The instructor review of the grading semantics (STATE blocker for phase 2) is still open and is listed at the end of docs/GRADING.md.

## Self-Check: PASSED

All created files exist on disk; commits e773de4 and 8da4c17 are ancestors of HEAD; the plan commit ledger measures 2 commits.
