---
phase: 01-deployed-playable-panel
plan: 08
subsystem: engine
tags: [registry, store, vitest, tdd, guard-interlock]
requires:
  - phase: 01-03
    provides: defineRegistry, PanelStore, DA50RG tracer registry
provides:
  - Registry invariant suite (tests/registry.test.ts) covering every control kind
  - Store contract suite incl. "guard interlock" describe block (tests/store.test.ts)
  - Remaining defineRegistry invariants (kind prefix, state counts, detent order and range, momentary rest, marker rules)
affects: [01-05, 01-07]
tech-stack:
  added: []
  patterns: [inline fixture registries for engine tests, RED commit before GREEN commit]
key-files:
  created: [tests/registry.test.ts, tests/store.test.ts]
  modified: [src/engine/registry.ts]
key-decisions:
  - "Derived guards use the sw. prefix (they are a part of a switch); toggle and guarded-toggle share sw."
  - "No store.ts change was needed: every rejection path and the interlock already behaved as specified"
requirements-completed: [PNL-02, PNL-06]
status: complete
duration: ~15 min
completed: 2026-10-20
commits: 4
plan_head_before: 0d0bd38
plan_head_after: a10fc6423226f75d7ba16740a0a65dfe490c8340
actuals:
  tokens: 9000
  tasks: 2
  commits: 4
---

# Phase 1 Plan 08: Registry and store invariant tests Summary

**Test-first pinning of the PNL-02 registry contract and the PNL-06 guard interlock, with seven new defineRegistry invariant checks, no public API change.**

## Accomplishments

- Task 1 (tracer): "guard interlock" describe block (6 cases) mirrors the D-07b de-ice ALTERNATE switch; blocked attempts append no event, guard stays open after the switch moves, closing the guard keeps the switch, `isBlocked` mirrors guard state. Kind-prefix rule (sw./lv./btn.) added to `defineRegistry` after a committed failing test.
- Task 2: full registry invariant suite (duplicate ids, id pattern, unknown region, default legality, duplicate states, fewer than two states or detents, detent range, equal and decreasing positions, momentary rest state, marker rules, guard derivation and collision, declaration ordering, empty region and empty registry) and store contract suite (defaults, seq from 0, unknown/illegal-state/unchanged rejections with no event or notification, subscribe/unsubscribe, RangeError for NaN, Infinity, -1).

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 RED | 64aec79 | guard interlock suite and failing kind-prefix test |
| 1 GREEN | 9cfefae | kind prefix check in defineRegistry |
| 2 RED | 29181b9 | failing registry invariants and store contract suite |
| 2 GREEN | a10fc64 | remaining registry invariants |

## Deviations from Plan

- The plan expected the guard-id collision case to fail first; it already passed because the existing duplicate-id check catches it in either declaration order. The test is kept as a pin; no code needed.
- During Task 2 the GREEN implementation was written before the RED commit; it was set aside (copied out of the tree, file restored) so the failing tests were committed first. History order is correct.
- `src/engine/store.ts` unchanged (plan listed it as possibly modified).

## Verification

`npm run typecheck`, `npm run lint`, `prettier --check`, `npm test` (97 passed, 27 skipped pre-existing) and `npx vitest run tests/store.test.ts -t guard` (6 passed) all green.

## Known Stubs

None.

## Self-Check: PASSED

Files tests/registry.test.ts, tests/store.test.ts and commits 64aec79, 9cfefae, 29181b9, a10fc64 exist on the branch.
