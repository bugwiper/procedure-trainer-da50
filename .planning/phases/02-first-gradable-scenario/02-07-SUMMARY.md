---
phase: 02-first-gradable-scenario
plan: 07
subsystem: ci-build-seam
tags: [ci, validate, code-splitting, pack-seam, toon-conformance, dependabot]

requires:
  - phase: 02-first-gradable-scenario
    provides: pack seam, packs-vite glob owner (plan 02), npm run validate (plan 05)
provides:
  - CI verify job runs npm run validate after npm test and before npm run build
  - one lazy pack-<pack> chunk per pack (rolldownOptions codeSplitting group)
  - tests/packs.test.ts seam gate (one glob owner, no .toon import in src/ui, lazy listing, deny without load)
  - tests/toon-conformance.test.ts decoder corpus (Table C1)
  - Dependabot ignores @toon-format/toon and zod majors
affects: [02-08, 02-09, 02-10, 02-13]

actuals:
  tokens: 3250
  tasks: 2
  commits: 2

plan_head_before: f857e8e976909d93107cec85bdd4cfd57ada369d
plan_head_after: 3059f9129309795c1aa0326bb7e2301633710d08

tech-stack:
  added: []
  patterns:
    - "Per-pack chunking by a codeSplitting group whose name function maps /scenarios/<pack>/<name>.toon (not pack.toon) to pack-<pack>"
    - "Seam gate as a Vitest source scan instead of an ESLint rule"

key-files:
  created:
    - tests/packs.test.ts
    - tests/toon-conformance.test.ts
  modified:
    - .github/workflows/deploy.yml
    - .github/dependabot.yml
    - vite.config.ts
    - tests/workflow.test.ts
    - tests/build-base.test.ts

key-decisions:
  - "TOON upgrades are deliberate: Dependabot ignores every @toon-format/toon update and the conformance corpus must pass first"
  - "zod major updates are ignored by Dependabot and taken deliberately"

requirements-completed: [SCN-01, SCN-02, PLT-03]

coverage:
  - id: D1
    description: "A bad scenario file fails CI before the build: the verify job runs npm run validate after npm test and before npm run build"
    requirement: SCN-02
    verification:
      - kind: unit
        ref: "tests/workflow.test.ts#runs npm run validate in the verify job after the tests and before the build"
        status: pass
    human_judgment: false
  - id: D2
    description: "The production build emits one pack-engine chunk holding the scenario text (step id reduce_power) and no other chunk holds it"
    requirement: PLT-03
    verification:
      - kind: unit
        ref: "tests/build-base.test.ts#the build emits one pack-engine chunk with the scenario text and no other chunk has it"
        status: pass
    human_judgment: false
  - id: D3
    description: "Only src/scenario/packs-vite.ts globs scenarios, src/ui imports no .toon file, listing loads no scenario, loadPack touches only its folder, a denying policy loads nothing"
    requirement: PLT-03
    verification:
      - kind: unit
        ref: "tests/packs.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The decoder behaviour hand-written files rely on is pinned and Dependabot never proposes a TOON upgrade"
    requirement: SCN-01
    verification:
      - kind: unit
        ref: "tests/toon-conformance.test.ts"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 07: CI validate step, per-pack chunk, seam gate and TOON conformance Summary

**CI now validates every scenario file before the build, the production build puts each pack's scenario text into its own lazy `pack-<pack>` chunk behind the single glob owner, and a decoder conformance corpus plus a Dependabot ignore keep a TOON upgrade from silently changing how hand-written files decode.**

## Performance

- **Duration:** about 5 min
- **Tasks:** 2 of 2 (Task 1 tracer, Task 2 test-first)
- **Files:** 7 changed (2 created)

## Accomplishments

- `.github/workflows/deploy.yml`: `npm run validate` between `npm test` and `npm run build` in the verify job; `tests/workflow.test.ts` asserts the order. The existing SHA-pin and permission cases are untouched.
- `vite.config.ts`: `build.rolldownOptions.output.codeSplitting.groups` with one group (`debugName: 'packs'`) mapping scenario files to `pack-<pack>`; manifests stay in the entry chunk. `npm run build` prints `pack-engine-*.js` (2.5 kB) next to the entry chunk, no deprecation warning.
- `tests/build-base.test.ts`: exactly one asset starting with `pack-engine` contains the blueprint step id `reduce_power`, no other JavaScript asset does.
- `tests/packs.test.ts` (new): source scan for the single `import.meta.glob` owner and for `.toon` imports under `src/ui`; counting fake loaders prove that listing loads nothing, `loadPack` calls only its own folder, an unknown pack loads nothing, OPEN_ACCESS allows all, and a denying policy returns `denied` without a load.
- `tests/toon-conformance.test.ts` (new): Table C1 against `@toon-format/toon` 4.4.0 plus a pass over every non-broken `.toon` file in `scenarios/` and `tests/fixtures/scenarios/`.
- `.github/dependabot.yml`: ignores `@toon-format/toon` entirely and `zod` majors; the TypeScript rule is kept.

## Task Commits

1. Task 1 (tracer): `9c43d19` ci(02-07): validate before the build, one lazy chunk per pack, seam gate
2. Task 2: `3059f91` test(02-07): pin the TOON decoder behaviour and stop automatic TOON upgrades

## Decoder facts recorded (Table C1)

- `nodes[0]:` decodes to `{ nodes: [] }` on 4.4.0, no error. The schema accepts both the empty list and an omitted `nodes` (default empty), so authors may write either.
- All other rows decode as listed: `"018"` stays a string, `no`/`off` stay strings, `lv.power` stays one key, `-10`/`128` are numbers, `true` is boolean, `in[2]: a,b` is an array, full-line comments are ignored, `a: b # c` keeps `b # c`.

## Verification

- `npx vitest run`: 37 files, 2040 tests passed
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`: exit 0
- Acceptance greps: `npm run validate` in deploy.yml 1, `codeSplitting` in vite.config.ts 1, `toon` in dependabot.yml 2
- No e2e spec run (the plan has none); `npm run validate` itself was not rerun here (plan 05's tests cover it and the full suite passed)

## Assumptions taken

- The conformance test calls `decode(text)` with default options, exactly as `src/scenario/parse.ts` does.
- The dependabot comment lines are English prose in the YAML; `.github` is outside `format:check`.
- The extra corpus pass over repository scenario files only asserts "decodes without error" (the schema tests own the content).

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. T-02-11 (second glob bypassing the policy) is gated by tests/packs.test.ts, T-02-13 (TOON spec drift) by the exact pin, the Dependabot ignore and the corpus; no package was installed (T-02-SC).

## Next Phase Readiness

Ready for plan 08. The chunking in `vite.config.ts` is read by the e2e builds of plans 08 to 10 and produces a correct build.

## Self-Check: PASSED

- Created files exist: tests/packs.test.ts, tests/toon-conformance.test.ts
- Commits 9c43d19 and 3059f91 are ancestors of HEAD
