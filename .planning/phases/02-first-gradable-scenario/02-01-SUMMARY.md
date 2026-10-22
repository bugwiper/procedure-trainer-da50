---
phase: 02-first-gradable-scenario
plan: 01
subsystem: scenario-format
tags: [toon, zod, scenario-schema, lint, quantities, da50rg]

requires:
  - phase: 01.1-panel
    provides: control registry (defineRegistry, legalStates) and the DA50 RG panel data
provides:
  - format-1 Zod scenario and manifest schema with inferred types
  - parseScenario and parseManifest returning ok or issues (decoder line, schema dot path, size cap)
  - lintScenario reference check against an AircraftEnv
  - named quantities with colour bands (defineQuantities) and the DA50 RG oil temperature and oil pressure data
  - AircraftEnv and DA50RG_ENV
  - disclaimer text and version as data
  - the ENG OIL TEMP blueprint scenario file
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08, 02-11, 02-13]

actuals:
  tokens: 9600
  tasks: 2
  commits: 2

plan_head_before: cffdbc192d4bc67c70304a6a3edbc847a10efa09
plan_head_after: eb711bbcb34b6ada5551f0c10cafd77cd6fe4c50

tech-stack:
  added: ["@toon-format/toon 4.4.0 (exact)", "zod 4.6.7 (exact)"]
  patterns:
    - "Zod 4 getter pattern for the recursive procedure tree (inference works without a hand-written type)"
    - "Author errors returned as ScenarioIssue values, programmer errors thrown"
    - "Engine-level definer (defineQuantities) with aircraft data supplied from src/aircraft"

key-files:
  created:
    - scenarios/engine/eng-oil-temp-green.toon
    - src/scenario/schema.ts
    - src/scenario/parse.ts
    - src/scenario/lint.ts
    - src/scenario/disclaimers.ts
    - src/engine/quantities.ts
    - src/engine/env.ts
    - src/aircraft/da50rg/quantities.ts
    - src/aircraft/da50rg/aircraft.ts
    - tests/scenario-tracer.test.ts
  modified:
    - package.json
    - package-lock.json
    - eslint.config.js
    - tests/panel-review.test.ts

key-decisions:
  - "Pinned @toon-format/toon 4.4.0 and zod 4.6.7 with --save-exact --ignore-scripts after the human legitimacy check; @toon-format/spec stays out"
  - "A value on a band bound belongs to the lower band (125 is high_yellow, 128 is high_red)"
  - "Zod issues become one ScenarioIssue each with the dot-joined path; unknown keys one issue per key; a root issue reads (root)"

patterns-established:
  - "Faulty-copy tests replace exactly one place of the real blueprint text (swap helper asserts the place occurs once)"

requirements-completed: [SCN-01, SCN-03, SCN-07]

coverage:
  - id: D1
    description: "The ENG OIL TEMP blueprint decodes with the pinned TOON parser and validates against the format-1 schema, including source metadata"
    requirement: SCN-01
    verification:
      - kind: unit
        ref: "tests/scenario-tracer.test.ts#the blueprint scenario decodes and validates with its metadata"
        status: pass
    human_judgment: false
  - id: D2
    description: "Initial controls and quantities are data, and the POWER step is relative to the baseline (travel_rel)"
    requirement: SCN-03
    verification:
      - kind: unit
        ref: "tests/scenario-tracer.test.ts#the blueprint scenario sets the initial controls and quantities"
        status: pass
    human_judgment: false
  - id: D3
    description: "Source metadata is mandatory and text limits are schema rules (title 18 characters, 12-word lines, 60-word situation, branch label ending in a colon)"
    requirement: SCN-07
    verification:
      - kind: unit
        ref: "tests/scenario-tracer.test.ts#parseScenario on author errors"
        status: pass
    human_judgment: false
  - id: D4
    description: "lintScenario resolves every control, state, quantity and band against the registry and quantity data, one issue per unresolved reference, none for the blueprint"
    requirement: SCN-01
    verification:
      - kind: unit
        ref: "tests/scenario-tracer.test.ts#lintScenario on faulty copies"
        status: pass
    human_judgment: false
  - id: D5
    description: "Wording of the blueprint step lines follows the private pocket card (own-words situation, no WARNING, CAUTION or NOTE text)"
    requirement: SCN-07
    verification: []
    human_judgment: true
    rationale: "Wording fidelity to the private card was compared by eye by the executor; no test can assert it"

duration: 12min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 01: Scenario format tracer Summary

**The ENG OIL TEMP blueprint scenario is a TOON file that decodes with the pinned parser, validates against a strict Zod format-1 schema (procedure tree of decision, branch, group and line with closed predicate unions) and resolves against the DA50 RG registry and new named oil quantities; every author error comes back as an issue.**

## Performance

- **Duration:** about 12 min after the package check was approved (the first run stopped at the blocking-human gate)
- **Tasks:** 2 of 2 (Task 1 was the package legitimacy checkpoint, approved by the owner through the coordinator; Task 2 the tracer)
- **Files:** 14 changed (10 created)

## Accomplishments

- Package legitimacy check passed; both packages installed at exact versions, scripts ignored, no range character in package.json or the lock root entry.
- `src/scenario/schema.ts`: Tables F1 to F4 as `z.strictObject` schemas, `z.discriminatedUnion` on `kind` and `check`, one `wordCount` helper, recursive `branches` and `nodes` through getters. The inferred types Scenario, ProcedureNode, BranchObject, Group, Step, Forbidden, Predicate and Manifest compile under the strict settings without a hand-written type.
- `src/scenario/parse.ts`: `parseScenario` and `parseManifest`; 262144-character cap before decoding; ToonDecodeError becomes one issue with its line and the message without the "Line N:" prefix.
- `src/scenario/lint.ts`: control, state, travel-on-lever, quantity and band references in done, trigger and when predicates plus initial controls and quantities; one issue per unresolved reference with its dot path; prototype keys never resolve.
- `src/engine/quantities.ts`, `src/aircraft/da50rg/quantities.ts`, `src/engine/env.ts`, `src/aircraft/da50rg/aircraft.ts`: quantity definer, Table F5 data, AircraftEnv and DA50RG_ENV.
- `src/scenario/disclaimers.ts`: the single source of the training-aid text, version 1.
- `scenarios/engine/eng-oil-temp-green.toon` per Table S1, and `tests/scenario-tracer.test.ts` (28 cases).
- Repaired the one red unit case at HEAD (panel-review opening assertion), as its own commit.

## Task Commits

1. Task 2 step 0: `a53603e` test(02-01): assert the current opening of the panel review document
2. Task 2: `eb711bb` feat(02-01): ENG OIL TEMP blueprint scenario with TOON parser, format-1 schema and reference lint

## Verification

- `npx vitest run tests/scenario-tracer.test.ts`: 28 passed
- `npx vitest run`: 26 files, 1843 tests passed
- `npm run typecheck`, `npm run lint`, `npm run format:check`: exit 0
- Acceptance greps: toon pin 1, zod pin 1, spec 0, `src/scenario` in eslint.config.js 2 (at least 1), `issue: "018"` 1, strictObject 19, blueprint file present.

## Assumptions taken

- The pack manifest file name uses the `.toon` extension (research recommendation A3); plan 02 writes the file.
- The blueprint line reads "Check oil temp in green range", the wording on the private pocket card, instead of "Check oil temperature in green range" in the Table S1 text. Verified date is 2026-10-22, the day the lines were compared with the card.
- `initial.controls` and `initial.quantities` default to an empty record, so a scenario that sets none of one kind may omit the key (Table F1 lists both without a default).
- The manifest `file` field uses the scenario id pattern (lowercase, digits, hyphens), which also rules out path separators and dots.
- `ScenarioIssue` and `ParseResult` live in `src/scenario/parse.ts`; lint.ts imports the type from there. A root-level schema issue has the path `(root)`.
- `BranchObject` and the standalone branch node repeat their four shared fields because a Zod getter cannot be spread; they share the label and decided_at schemas.
- The owner's approval of the package check reached me as a coordinator message relaying the owner's chat answer; I treated it as the continuation of the gate, after verifying exact versions, MIT licences, repositories and the absence of install scripts with `npm view`.
- The plan says STATE.md is not edited; the dispatch instruction directs the standard STATE and ROADMAP updates, which I followed.

## Deviations from Plan

None - plan executed exactly as written (apart from the assumptions above).

## Authentication Gates

None. The package legitimacy checkpoint (blocking-human) stopped the first run and was resolved by the owner's approval.

## Known Stubs

None.

## Threat Flags

None. No network endpoint, auth path or trust-boundary file access was added beyond the planned threat model (T-02-01 to T-02-04 and T-02-SC are mitigated as planned).

## Next Phase Readiness

Ready for plan 02 (pack seam, predicates, grading, virtual clock). The predicate shapes it evaluates are the `Predicate` type; the baseline travel rule (Math.round(pos * 1000) / 10) is documented in the plan and not implemented here.

## Self-Check: PASSED

All created files exist on disk; commits a53603e and eb711bb are ancestors of HEAD; the plan commit ledger measures 2 commits.
