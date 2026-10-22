---
phase: 03-reactive-scenarios-and-initial-pack
plan: 06
subsystem: engine
tags: [realistic-level, onset, seeded-prng, reaction-time, lint, debrief]
status: complete

requires:
  - phase: 03-reactive-scenarios-and-initial-pack
    provides: simSetup with onsetAt, fixed-step simulation (plan 03-01); named outcomes and grade replay (plan 03-05)
provides:
  - scenario `onset` (window_s, a pair of seconds from 1 to 120, first at most second), optional, format stays 1
  - mulberry32 and onsetFromSeed in the engine (integer arithmetic only, no randomness in src/engine)
  - the level Realistic: chosen on the level card it starts the run at once, no briefing, from the base quantities, the failure begins at the seeded onset
  - Recording.onset (at, seed) and the session signals `onset` and `recording`; grade replays from the base values and switches the parameters at the onset
  - GradeResult.timing (onsetAt, firstActionMs), shown for Realistic only as "First action N s after the onset." or "No action after the onset."
  - the debrief names the scenario in every level (meta line debrief-scenario)
  - lint L14 (a realistic do-nothing run starts clean and shows every listed annunciation)
affects: [03-07, 03-08, 03-09]

actuals:
  tokens: 14700
  tasks: 3
  commits: 3
plan_head_before: 7dbe0eccea5f1be178ef8df7e1b3ad528eb736a9
plan_head_after: f307acf158f1f7f8cfe857b46f80b1b3a2f87acb

tech-stack:
  added: []
  patterns:
    - "The UI draws the seed with its injected rng and records it; the engine turns a seed into an onset time with integer and basic arithmetic, so a realistic run replays from its recording"
    - "The level is never an input of grade: the recorded onset is the only run data that differs"

key-files:
  created: []
  modified:
    - src/engine/sim.ts
    - src/engine/grading.ts
    - src/scenario/schema.ts
    - src/scenario/lint.ts
    - src/ui/session.ts
    - src/ui/App.tsx
    - src/ui/screens/LevelPick.tsx
    - src/ui/screens/Debrief.tsx
    - src/ui/debrief-text.ts
    - scenarios/engine/eng-oil-temp-green.toon
    - e2e/support/session.ts
    - e2e/scenario.spec.ts
    - tests/grading.test.ts
    - tests/debrief-text.test.ts
    - tests/sim.test.ts
    - tests/session.test.ts
    - tests/scenario-lint.test.ts

key-decisions:
  - "Realistic is offered only for a scenario that declares an onset; the Realistic button is inactive otherwise and setLevel('realistic') does nothing there"
  - "A realistic start uses the registry defaults plus initial.controls and the base quantities; the scenario's initial.quantities apply to Easy and Medium only"
  - "The seed is floor(rng() times 4294967296); the onset is STEP_MS times round((lo + u times (hi - lo)) times 1000 / STEP_MS) with u the first mulberry32 value"
  - "Recording.onset is absent for Easy and Medium (not null), so their recordings and golden fixtures are unchanged; grade accepts both absent and null"
  - "firstActionMs is measured over the graded events (those up to an outcome), from the onset; an event before the onset is graded but does not set it"

patterns-established:
  - "New scenario sections are optional or default to empty so existing files stay valid in format 1"

requirements-completed: [SCN-06]

coverage:
  - id: D1
    description: "On the built app Realistic starts the run at once with no briefing and nothing naming the scenario, records an onset on a step boundary inside the window, and the debrief reveals the scenario, names the level Realistic and shows the time line"
    requirement: "SCN-06"
    verification:
      - kind: e2e
        ref: "e2e/scenario.spec.ts#Realistic starts without a briefing, names nothing, the failure comes inside its window and the debrief reveals the scenario (desktop-chromium, phone-chromium)"
        status: pass
      - kind: e2e
        ref: "e2e/scenario.spec.ts#Level question: Easy, Medium and Realistic come before any briefing (desktop-chromium, phone-chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The seeded onset is repeatable, lies inside the window on a step boundary, no faulted parameter acts before it, and ENG OIL TEMP appears after it"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/sim.test.ts#seeded onset (D-05, C-32)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The session starts Realistic at once from the base values, draws the seed from the injected rng, records onset and recording, ignores Realistic for a scenario without an onset, and a realistic run replays identically to the simulation"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/session.test.ts#realistic level (phase 03, D-05)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The reaction time is measured from the onset over the graded events, is display only, the level never appears in the result, and every golden recording grades as before plus its timing"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/grading.test.ts#reaction time from the onset (D-05, C-33, C-34)"
        status: pass
      - kind: unit
        ref: "tests/grading.test.ts#golden recordings (Table R1)"
        status: pass
      - kind: unit
        ref: "tests/debrief-text.test.ts#timingLine (D-05, C-34)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Lint L14 gives a line-numbered error for a message active at the realistic start, an outcome holding there, a listed annunciation that a realistic do-nothing run never shows, and an onset window outside 1 to 120 s or reversed"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/scenario-lint.test.ts#L14: the realistic level starts clean and shows what the scenario lists (D-05)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The ENG OIL TEMP onset window of 5 to 20 s is a plausible training value (instructor-review item)"
    requirement: "SCN-06"
    human_judgment: true
    rationale: "A pacing value chosen by default for unattended execution (ROADMAP 1a 'after a few seconds'); an instructor decides whether it is right"
---

# Phase 3 Plan 6: Realistic level Summary

**The level Realistic: one tap on the level card starts ENG OIL TEMP at once in the base state with no briefing, the oil temperature fault begins at a seeded random second inside a 5 to 20 s window, the debrief reveals the scenario and prints how long after the onset the first action came.**

## Performance

- **Completed:** 2026-10-22
- **Tasks:** 3 (1 tracer, 2 auto/tdd)
- **Files modified:** 17

## Accomplishments

- Schema `onset` (window_s), `mulberry32` and `onsetFromSeed`; the blueprint declares 5 to 20 s.
- The session starts Realistic from the base quantities, draws the seed with its injected rng, and keeps the onset (`onset`) and the graded recording (`recording`); `grade` replays from the base values and switches the parameters at the recorded onset, so a realistic run replays identically.
- The level card offers Easy, Medium and Realistic (Realistic inactive for a scenario without an onset); the debrief shows a scenario line in every level and, for Realistic, the time line.
- `GradeResult.timing` (display only; no limit, SES-V2-02 stays v2).
- Lint L14 and the schema bounds of the window.

## Task Commits

1. **Task 1 (tracer): Realistic starts without a briefing, seeded onset, debrief reveals the scenario** - `0de2475` (feat)
2. **Task 2: reaction time from the onset in the result and the realistic debrief** - `41c17ac` (feat)
3. **Task 3: lint L14 and the onset rules pinned in simulation and session tests** - `f307acf` (feat)

## Assumptions taken

- ENG OIL TEMP onset window 5 to 20 s (C-36), an instructor-review item.
- A realistic start uses `initial.controls` (p75, cowl flap closed) with the base quantities, as C-31 says. With the normal cooling, the oil temperature then drifts slowly toward its equilibrium at p75 (about 0.5 degrees C in the first 10 s, in the green) before the onset; no message appears. The base value of the quantity (91) is the equilibrium at the registry default POWER, not at p75; Table P1 was left untouched.
- `simSetup` takes an options object (`{ onsetAt }`), as plan 01 built it; the plan text wrote `simSetup(env, scenario, onsetAt)` loosely.
- Recording.onset is omitted (not null) for Easy and Medium so their recordings keep their exact shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test assumption] Base oil temperature is not the equilibrium at the scenario controls**
- **Found during:** Task 3 (sim test "before the onset no faulted parameter acts")
- **Issue:** the draft assertion that the oil temperature stays at the base value 91 before the onset failed: at p75 the normal-cooling equilibrium is slightly higher (see Assumptions taken).
- **Fix:** the test asserts no CAS message at any step up to the onset and the temperature in the green (below 115), which is what the plan's behavior list states.
- **Files modified:** tests/sim.test.ts
- **Commit:** f307acf

**Total deviations:** 1 auto-fixed (test assumption). **Impact:** none on the delivered behaviour.

## Notes

- The e2e Realistic case takes the golden taps right after the start (before the earliest onset of 5 s), so its time line reads "No action after the onset."; the wording with a value is pinned in `tests/debrief-text.test.ts` and `tests/grading.test.ts`.
- Docs (`docs/GRADING.md`) are not touched here; plan 03-09 owns the documents.
- `.planning/STATE.md` was updated by the GSD state tooling after the SUMMARY, as in the earlier plans of the phase (the dispatch asks for it; the plan prohibition meant no hand edits).

## Known Stubs

None.

## Threat Flags

None. The window is capped by Zod at 120 s and the L14 loop at the window cap plus 600 s, below MAX_RUN_MS (T-03-16); grade receives no level, only the recorded onset (T-03-14); no briefing text is rendered and the e2e case asserts nothing names the scenario while the run is young (T-03-15).

## Verification

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` pass; `npx vitest run`: 48 files, 2441 tests pass.
- `PW_PORT=4333 npx playwright test e2e/scenario.spec.ts e2e/replay.spec.ts e2e/run-reaction.spec.ts --project=desktop-chromium --project=phone-chromium`: 49 passed, 1 skipped (the desktop-only escalation case on phone).

## Self-Check: PASSED

- Commits 0de2475, 41c17ac, f307acf exist on the phase branch.
- Acceptance greps: 'realistic' in session.ts (4), mulberry32 in sim.ts (4), onset in the blueprint (1), debrief-scenario in Debrief.tsx (1), firstActionMs in grading.ts (3), debrief-timing in Debrief.tsx (1), L14 in lint.ts (3), mulberry32 in tests/sim.test.ts (6).
