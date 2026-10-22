---
phase: 02-first-gradable-scenario
plan: 05
subsystem: scenario-validation
tags: [validate-command, toon-index, lint, line-numbers, manifest-checks]

requires:
  - phase: 02-first-gradable-scenario
    provides: format-1 schema, parser, reference lint (plan 01); pack seam, predicates (plan 02)
provides:
  - indexToon and locate (path to line and column)
  - ScenarioIssue with required line and col; schema and decoder issues located
  - lint rules L4 to L8 and checkScenario, used by openScenario
  - validateAll, formatIssue (rule L9) and `npm run validate`
  - broken fixture pack tests/fixtures/broken/demo
affects: [02-06, 02-07, 02-08, 02-13]

actuals:
  tokens: 18500
  tasks: 2
  commits: 2

plan_head_before: dbd92aace430ddf793681cc6836d599fee074aff
plan_head_after: c36a026e13358699ee185c57e656c4c8c73effe4

tech-stack:
  added: []
  patterns:
    - "One check for app and command: checkScenario = parse, lint, locate; openScenario and validateAll both call it"
    - "Lint issues carry path segments, so dotted control ids (lv.power) locate exactly; the dot-joined path is display only"
    - "The CLI loads TypeScript through Vite ssrLoadModule and is the only code that reads files"

key-files:
  created:
    - src/scenario/toon-index.ts
    - src/scenario/validate-all.ts
    - scripts/validate-scenarios.mjs
    - tests/fixtures/broken/demo/pack.toon
    - tests/fixtures/broken/demo/bad-key.toon
    - tests/fixtures/broken/demo/bad-control.toon
    - tests/validate-cli.test.ts
    - tests/toon-index.test.ts
    - tests/scenario-parse.test.ts
    - tests/scenario-lint.test.ts
    - tests/scenario-text.ts
  modified:
    - src/scenario/parse.ts
    - src/scenario/lint.ts
    - src/scenario/packs.ts
    - package.json
    - tests/scenario-tracer.test.ts

key-decisions:
  - "lintScenario returns LintIssue (path plus segments); checkScenario turns them into located ScenarioIssue"
  - "L5 and L6 run only when no other rule fired, because evaluating a predicate needs every reference to resolve"
  - "L7 reports the first branch past the third level only; L8 reports the group, not the branch"
  - "validate exit codes: 0 clean, 1 problems, 2 root folder unreadable"

requirements-completed: [SCN-01, SCN-02]

coverage:
  - id: D1
    description: "npm run validate passes the shipped pack and reports a broken pack as file:line:col, exit 1"
    requirement: SCN-01
    verification:
      - kind: unit
        ref: tests/validate-cli.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: "Every decoded path of every shipped and fixture file has an exact index entry; parser errors carry line and column"
    requirement: SCN-01
    verification:
      - kind: unit
        ref: tests/toon-index.test.ts
        status: pass
      - kind: unit
        ref: tests/scenario-parse.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: "Lint rules L1 to L8 each reject their case at the exact line and column; the blueprint passes"
    requirement: SCN-02
    verification:
      - kind: unit
        ref: tests/scenario-lint.test.ts
        status: pass
    human_judgment: false

duration: 40 min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 05: Validate command with file:line:col Summary

**`npm run validate` checks every pack against the schema and the control registry and prints each problem as file:line:col, through a path-to-line TOON index and one shared checkScenario that the app also uses.**

## Performance

- Duration: about 40 min (interrupted once by a session limit and resumed)
- Tasks: 2 of 2, files: 16

## Accomplishments

- `indexToon` / `locate` (src/scenario/toon-index.ts): port of the tested RESEARCH prototype; exact entries for every decoded path of all shipped and fixture files (differential test).
- ScenarioIssue now has required `line` and `col`; schema issues are located at the key (unknown keys at the key itself), decoder issues keep the decoder line with column 1, the size-cap issue is 1:1.
- Lint rules L4 (duplicate group, step, forbidden ids), L5 (step already satisfied in the initial state), L6 (watched forbidden trigger already true), L7 (more than 3 branch levels), L8 (group under a run-decided branch) in lint.ts; `checkScenario(text, env)` is the single check, and `openScenario` calls it.
- `validateAll` / `formatIssue` with manifest rule L9 (missing or invalid manifest, entry without file, file without entry, id and title mismatch, repeated entry ids) and `scripts/validate-scenarios.mjs` (Vite `ssrLoadModule`, no new dependency). `npm run validate` prints "1 scenario files checked, 0 problems" for the shipped pack.
- Broken fixture pack and four test files pin the contract.

## Task Commits

1. Task 1 (tracer): `9ea8106` feat(02-05): validate command with file:line:col, path-to-line index, lint rules L4 to L8. The tracer gate was re-run (validate, validate-cli and tracer tests, typecheck) and passed before expansion.
2. Task 2: `c36a026` test(02-05): unit contract for path index, parser errors and lint rules L1 to L8

## Files Created/Modified

See frontmatter. `package.json` gained the `validate` script; `format` and `format:check` now cover `scripts`.

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

**1. [Rule 3 - Blocking] Lint issues carry path segments**
- **Found during:** Task 1
- **Issue:** the dot-joined issue path is ambiguous for control ids such as `lv.cowl_flap`, so a located lookup could not use it.
- **Fix:** `lintScenario` returns `LintIssue` with `segments` beside `path`; `path` strings are unchanged, so existing tests still hold.
- **Files modified:** src/scenario/lint.ts
- **Commit:** 9ea8106

**2. [Rule 1 - Bug] Existing tracer test expected an undefined line**
- **Found during:** Task 1
- **Issue:** tests/scenario-tracer.test.ts asserted `line` undefined for the size-cap issue; line is now required.
- **Fix:** it now asserts `{ line: 1, col: 1 }`.
- **Commit:** 9ea8106

**3. Added tests/scenario-text.ts** (shared helpers: minimal scenario, swap, lineOf, colOf, nested), not in the plan's file list.

**Total deviations:** 3 (1 blocking fix, 1 bug fix, 1 added helper file). **Impact:** none on scope.

## Assumptions taken

- Exit code 2 for an unreadable root folder (plan only specifies 0 and 1).
- Plan note "STATE.md is not edited" was overridden by the dispatch instruction to update STATE.md and ROADMAP.md as execute-plan directs.
- L5 treats a group as graded when all enclosing branches are decided at start and hold in the initial state, mirroring the grader.

## Issues Encountered

None. A session limit interrupted the run once; the working tree was intact and the run resumed.

## Known Stubs

None.

## Threat Flags

None. T-02-10 mitigated (L1 to L8 in checkScenario, shared by app and command).

## Next Phase Readiness

Ready for 02-06. Plan 07 adds `npm run validate` to CI before the build.

## Self-Check: PASSED

Files exist (toon-index.ts, validate-all.ts, validate-scenarios.mjs, fixtures, four test files); commits 9ea8106 and c36a026 are on the branch; acceptance greps (validate script 1, ssrLoadModule 2, checkScenario in packs.ts 4, "already satisfied" 1) pass; full vitest (1994 tests), typecheck, lint, format:check and `npm run validate` are green.
