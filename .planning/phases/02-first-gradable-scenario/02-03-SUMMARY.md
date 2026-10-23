---
phase: 02-first-gradable-scenario
plan: 03
subsystem: documentation
tags: [toon, scenario-format, docs-gate, claude-md, stack]

requires:
  - phase: 02-first-gradable-scenario
    provides: pinned @toon-format/toon 4.4.0 and the TOON blueprint scenario (plan 01)
provides:
  - tests/docs-format.test.ts, a Vitest gate that keeps the earlier format word out of every living document
  - CLAUDE.md, research/STACK.md, PROJECT.md, ROADMAP.md, REQUIREMENTS.md, two pending todos and four research documents describing TOON
affects: [02-04, 02-05, 02-07, 02-13]

actuals:
  tokens: 32000
  tasks: 3
  commits: 3

plan_head_before: dae5a73586a953f73ab9961b3a669bc20db59605
plan_head_after: 978ea439e4c4c7bed65dec99269be037329c3998

tech-stack:
  added: []
  patterns:
    - 'Living-document gate: the old format word is assembled from letters at run time so the test file never contains it'
    - 'CLAUDE.md stack section and research/STACK.md are edited in step'

key-files:
  created:
    - tests/docs-format.test.ts
  modified:
    - .claude/CLAUDE.md
    - .planning/research/STACK.md
    - .planning/PROJECT.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
    - .planning/todos/pending/2026-10-21-review-warnings-hardening.md
    - .planning/todos/pending/2026-10-21-breaker-effects-and-avionics-functions.md

key-decisions:
  - 'Scenario files are TOON, parser @toon-format/toon 4.4.0 pinned exactly; schema errors get line and column from an own path-to-line index; authoring feedback is npm run validate plus the Vitest check, no editor schema support'

patterns-established:
  - 'TOON pitfalls recorded in the stack documents: exact pin and conformance test, strict decoding, quoted numeric-looking strings, full-line comments only, no tabular rows or root arrays, never format scenario files with the library encoder'

requirements-completed: [SCN-01]

coverage:
  - id: D1
    description: 'Every living document names TOON as the scenario format and carries no wording of the earlier format; CLAUDE.md and STACK.md name the exact parser pin 4.4.0'
    requirement: SCN-01
    verification:
      - kind: unit
        ref: 'tests/docs-format.test.ts#living documents name TOON as the scenario format'
        status: pass
    human_judgment: false
  - id: D2
    description: 'REQUIREMENTS.md SCN-01 reads Scenarios are TOON files validated against a schema, with line-numbered errors; roadmap criteria 2.5 and 4.4 say TOON'
    requirement: SCN-01
    verification:
      - kind: unit
        ref: 'tests/docs-format.test.ts#REQUIREMENTS.md SCN-01 says TOON files'
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 03: Living documents say TOON Summary

**CLAUDE.md, its stack source, the project, roadmap, requirement and todo documents and all four research documents now describe TOON (`@toon-format/toon` 4.4.0 pinned exactly) as the scenario format, and a Vitest gate keeps the earlier format word out of every one of them.**

## Performance

- **Duration:** about 8 min
- **Tasks:** 3 of 3 (Task 1 tracer, Tasks 2 and 3 auto)
- **Files:** 13 changed (1 created)

## Accomplishments

- `tests/docs-format.test.ts`: lists README.md, every file under docs/, CLAUDE.md, STACK.md, PROJECT.md, ROADMAP.md, REQUIREMENTS.md, the two pending todos and the four other research documents; asserts per document that a case-insensitive search for the old word finds nothing, that CLAUDE.md and STACK.md name TOON, `@toon-format/toon` and 4.4.0, and that the SCN-01 line says "TOON files". Shown red on the first run (14 failures), green after the rewrites.
- CLAUDE.md and research/STACK.md (kept in step, GSD markers untouched): parser row, Zod row, Prettier row, rationale section "TOON + validation" with the TOON pitfalls, authoring feedback (validate command and Vitest check, no editor schema support), loading strategy (manifests eager, scenario files lazy with `?raw`, one chunk per pack), alternatives, "What NOT to use", variant patterns, install line and sources. No other recommendation changed.
- PROJECT.md (Active item, extensibility line, Next line, Content format constraint, one new Key Decisions row for D-19), ROADMAP.md (phase 2 criterion 5, phase 4 criterion 4), REQUIREMENTS.md (SCN-01), STATE.md (the one blocker line, one changed line), both pending todos.
- ARCHITECTURE.md, PITFALLS.md, FEATURES.md, SUMMARY.md: every matching passage restated; format-specific pitfalls (boolean coercion, old parsers, plugins, anchors and aliases) replaced by their TOON counterparts; the two DSL code blocks in ARCHITECTURE.md are now `text` and `toon` fenced.

## Task Commits

1. Task 1 (tracer): `c1cfb47` docs(02-03): name TOON in CLAUDE.md and the stack source, gate the living documents
2. Task 2: `ef29296` docs(02-03): project, roadmap, requirement, state and todos say TOON
3. Task 3: `978ea43` docs(02-03): research documents describe TOON

## Verification

- `npx vitest run`: 30 files, 1920 tests passed (includes tests/panel-review.test.ts and tests/content-policy.test.ts)
- `npm run typecheck`, `npm run lint`, `npm run format:check`: exit 0
- Acceptance greps: toon count in CLAUDE.md 20 and in STACK.md 24 (baseline 0), `GSD:stack-start` in CLAUDE.md 1, old word count 0 in all four research files and in STATE.md, `Scenarios are TOON files` in REQUIREMENTS.md 1, `The scenario is a TOON file` in ROADMAP.md 1, `git show --stat HEAD -- .planning/STATE.md` after the Task 2 commit shows one changed line.
- Tracer gate (auto mode or end-of-phase with automated verify only): the tracer verify was run green before expansion.

## Assumptions taken

- The conformance corpus, `src/scenario/toon-index.ts` and `npm run validate` are named in the documents as the phase 2 design (plans 05 and 07 deliver them); the documents say so as plan facts, not as existing files.
- The research documents' DSL sketches stay sketches: the vocabulary block is fenced `text` (it is all comments), the action sketch is rewritten as TOON with array counts and nested blocks instead of inline objects, which TOON has no syntax for.
- ARCHITECTURE.md's "JSON Schema for editor autocompletion" statements became "optional documentation artifact", matching Table D1.
- STATE.md was edited by the one scoped line the plan prescribes and committed with Task 2, then updated again through the state handlers at close-out as the dispatch directed.
- Commit type `docs` for the document tasks (Task 1 also carries the test), as the plan's execution notes list.

## Deviations from Plan

None - plan executed exactly as written (apart from the assumptions above).

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. T-02-05 mitigated: format wording only, no procedure text added; the hygiene cases of tests/content-policy.test.ts and tests/panel-review.test.ts ran green. T-02-SC: no package installed.

## Next Phase Readiness

Plan 04 (store baseline and region count in README.md) can run: the docs gate reads README.md and only checks the old word. Plans 05 and 07 deliver the validate command, the path-to-line index and the conformance corpus that the stack documents now describe. Plan 13 should keep `tests/docs-format.test.ts` green when it writes the authoring documents.

## Self-Check: PASSED

tests/docs-format.test.ts exists; commits c1cfb47, ef29296 and 978ea43 are ancestors of HEAD; the plan commit ledger measures 3 commits.
