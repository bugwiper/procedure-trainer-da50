---
phase: 03-reactive-scenarios-and-initial-pack
plan: 04
subsystem: engine
tags: [simulation, reactions, timers, retract, consumed-watermark, deice, flags, preact-signals]

requires:
  - phase: 03-reactive-scenarios-and-initial-pack
    provides: fixed-step stepper, Run over the store log, definePhysics, bridge.setQuantities (plan 03-01); models for every quantity (plan 03-02)
provides:
  - one-shot event-armed reactions with timers as aircraft data (ReactionSpec, definePhysics validation) and their step order in stepSim (C-20)
  - SimState.timers and SimState.flags derived from the active reactions; stepSim returns the indexes of the due events that started a reaction
  - Run raises the store's consumed watermark when a reaction fires (C-21) and rebuilds by replay when an applied event is retracted (C-22)
  - the de-ice MAX reaction (btn.deice_max pressed while sw.deice_mode is high, 120 s, cleared on leaving high)
  - bridge.flags signal and bridge.setFlags, fed by every run step; the debrief close and the reset clear it (C-23)
affects: [03-05, 03-06, 03-07, 03-08, 03-09]

actuals:
  tokens: 15400
  tasks: 3
  commits: 3
plan_head_before: 466dcf179cf74d1ca7ec16cbb26f996ead4da873
plan_head_after: c7363d15642b0a75620da8a42517fcc140357238

tech-stack:
  added: []
  patterns:
    - "A reaction is data (id, arming control and state, condition, flag, duration, clear condition) behind the Physics interface; sim.ts knows no reaction fact"
    - "Reactions fire on the event in log order, not on a state poll, so a press and release inside one step still start the run"
    - "A retract of an applied event rebuilds the run with simulate over the remaining log; the cursor follows the log length"

key-files:
  created:
    - tests/run.test.ts
  modified:
    - src/engine/physics.ts
    - src/engine/sim.ts
    - src/engine/run.ts
    - src/engine/store.ts
    - src/aircraft/da50rg/physics.ts
    - src/aircraft/da50rg/indicators.ts
    - src/ui/bridge.ts
    - src/ui/session.ts
    - e2e/run-reaction.spec.ts
    - tests/sim.test.ts
    - tests/physics.test.ts
    - tests/bridge.test.ts
    - tests/session.test.ts
    - tests/indicators.test.ts

key-decisions:
  - "A reaction is in force for exactly its duration counted from the step that applied the arming event: models see the flag for N = duration / STEP_MS steps; the published state shows the flag on for N - 1 states and off at press-step start + duration"
  - "SimState.flags holds only the flags of active reactions (true); an inactive flag is absent, so equal states compare equal and the bridge compares keys and values"
  - "A fired reaction consumes the newest arming event of the step (and with it every older one); a clearing event (leaving HIGH) is not consumed and can be retracted, after which the replay lights the lamp again"
  - "The retract rebuild notifies the step listeners, so the bridge, flags and quantities follow at once"

patterns-established:
  - "Flag names are dotted lower-case ids (FLAG_PATTERN in src/engine/physics.ts); reaction ids use the quantity-id pattern"
  - "Mutation check of the new tests: dropping markConsumed, the early return in the retract listener, the rebuild, the countdown boundary, the clear step and the debrief flag clear each fail at least one case"

requirements-completed: [SCN-06]

coverage:
  - id: D1
    description: "During a run, pressing MAX with the de-ice mode on HIGH lights the top amber lamp, leaving HIGH puts it out, and a press on NORM lights nothing, on the built app"
    requirement: "SCN-06"
    verification:
      - kind: e2e
        ref: "e2e/run-reaction.spec.ts#MAX on HIGH lights the top lamp during a run, leaving HIGH puts it out, MAX on NORM lights nothing (desktop-chromium, phone-chromium)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The MAX run is on for exactly its 120 s duration, clears when HIGH is left, does not restart while active, starts a new run after it ended, and a press and release inside one step still start it"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/sim.test.ts#the de-ice MAX reaction (C-20)"
        status: pass
      - kind: unit
        ref: "tests/physics.test.ts#definePhysics reactions (plan 03-04, C-20)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A fired reaction makes its event consumed (retract refused), an unfired retract causes no rebuild and arms nothing, and a retract of an applied event leaves a state equal to a run that never had it"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/run.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "The bridge carries the run's flags to the lamps and the debrief close, the reset and leaving a run clear them"
    requirement: "SCN-06"
    verification:
      - kind: unit
        ref: "tests/bridge.test.ts#bridge setFlags (plan 03-04, C-23)"
        status: pass
      - kind: unit
        ref: "tests/session.test.ts#run (phase 03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The 120 s length of the MAX run and its lamp behaviour match the real aircraft"
    verification: []
    human_judgment: true
    rationale: "The 120 s and the lamp rule come from the owner's finding G-1, not from a measurement; only the engine behaviour is tested"

duration: 12min
completed: 2026-10-22
status: complete
---

# Phase 3 Plan 04: Reactions, consumed events and the de-ice MAX run Summary

**Event-armed one-shot reactions with timers in the fixed-step simulation, a run that consumes the event a reaction used and rebuilds by replay when an applied event is retracted, and the de-ice MAX 120 s run with its lamp, all behind the Physics interface.**

## Performance

- **Duration:** about 12 min (start about 21:04 UTC, end 21:16 UTC; the start time was estimated from the first command)
- **Tasks:** 3 (1 tracer, 2 TDD)
- **Files modified:** 15 (1 created)

## Accomplishments

- `src/engine/physics.ts`: `ReactionSpec`, `PhysicsSpec.reactions`, `Physics.reactions` and `FLAG_PATTERN`; `definePhysics` rejects a duplicate or malformed reaction id, an unknown arming control, a state that is not legal for it, a malformed flag name and a duration that is not finite or lies outside STEP_MS to MAX_RUN_MS.
- `src/engine/sim.ts`: `SimState.timers`, flags derived from the active reactions, and `stepSim` in the order of C-20 (events apply one by one and arm reactions, clear conditions end reactions, models read the flags, timers count down). `fired` lists the due events that started a reaction.
- `src/engine/run.ts`: after each step the run calls `store.markConsumed` with the seq of the newest event that started a reaction (C-21); `store.onRetract` rebuilds the state with `simulate` over the remaining log up to the current time, moves the cursor to the log length and notifies the step listeners (C-22). An event the simulation has not applied yet (seq at or above the cursor) causes nothing.
- `src/aircraft/da50rg/physics.ts`: reaction `deice_max` (btn.deice_max pressed, sw.deice_mode high, flag `DEICE_MAX_ACTIVE`, 120 000 ms, cleared when the mode is not high). ANNUN-TEST, the WIND SHIELD spray, the ICE LIGHT effect and the ELT lamp stay deferred (D-04), as does the gear transit flag.
- `src/ui/bridge.ts`: `flags` signal and `setFlags` (replaces only on a change); the lamp computeds read it; the reset empties it. `src/ui/session.ts`: each run step also calls `bridge.setFlags(state.flags)`; `closeDebrief` clears the flags (C-23); `leaveRun` empties them through the reset. `src/ui` never calls `markConsumed`.
- Docs: `store.ts` retract and `markConsumed` comments now state that the run raises the watermark; the stale "nothing sets it" comment on `DEICE_MAX_ACTIVE` is replaced.
- Tests: `tests/run.test.ts` (11 cases: continuous dependence, listeners, reused seq, unfired retract, consumed refusal per kind, release retract, cleared-then-retracted, step equals simulate for a recording with a MAX press and a retract); 11 reaction cases in `tests/sim.test.ts`; 8 validation cases in `tests/physics.test.ts`; 5 flag cases in `tests/bridge.test.ts`; 4 in `tests/session.test.ts`; e2e case in `e2e/run-reaction.spec.ts` for both projects.

## Task Commits

1. **Task 1 (tracer): MAX pressed on HIGH lights the top de-ice lamp for 120 s of run time** - `41692b1`
2. **Task 2: a retract rebuilds the run by replay and a fired reaction makes its event consumed** - `1ff9739`
3. **Task 3: the MAX run's timing, clearing and validation pinned by unit tests** - `c7363d1`

Tracer feedback gate: auto/end-of-phase mode, `<verify>` automated only; re-run end to end (typecheck, vitest, lint, format, Playwright run-reaction on desktop-chromium and phone-chromium) and passed, so expansion continued.

## Verification

- `npx vitest run`: 48 files, 2385 tests pass. `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` exit 0.
- `PW_PORT=4333 npx playwright test e2e/run-reaction.spec.ts e2e/replay.spec.ts --project=desktop-chromium --project=phone-chromium`: 10 passed. Also button, indicator, scenario, clock and inventory specs on both projects: 94 passed, 8 skipped.
- Acceptance greps: `store.markConsumed(` in run.ts 1, `DEICE_MAX_ACTIVE` in da50rg/physics.ts 2, `setFlags` in bridge.ts 2, `store.onRetract(` in run.ts 1, `consumed` in tests/run.test.ts 10, `deice` in tests/sim.test.ts 4.
- Mutation check of the new tests: removing `markConsumed`, the early return of the retract listener, the replay rebuild, the `>` at the timer boundary, the clear step or the debrief flag clear makes at least one case fail each; the sources were restored.

## Assumptions taken (defaults C-20 to C-23)

- C-20 to C-23 taken as written. One reading: the countdown (step 4) also applies to a timer started in the same step, so the models see the flag for exactly `durationMs / STEP_MS` steps and the published state is off at the press step's start plus the duration.
- The release of MAX is a separate momentary event; with the mode left on HIGH it neither clears nor restarts the run. A second press while active is ignored (RESEARCH A9).
- Free panel: no reaction runs (C-04), so the top lamp stays dark there; the free-panel simulation is a follow-up todo for plan 09.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The retract rebuild landed in the Task 1 commit**
- **Found during:** Task 1
- **Issue:** The consume call, the new step contract and the rebuild all live in `src/engine/run.ts`; the plan 03-01 listener (controls only) could not coexist with `SimState.timers` and flags, and the tracer's end-to-end check needed a state that stays equal to its replay.
- **Fix:** The Task 2 production change (`store.onRetract` rebuild with `simulate`) was written together with Task 1 and committed in `41692b1`; Task 2 added `tests/run.test.ts` and the store doc comments. The tests were therefore green at once; they were checked for bite by mutation (see Verification) instead of a visible RED commit.
- **Files modified:** src/engine/run.ts
- **Commit:** 41692b1

**2. [Rule 3 - Blocking] Files beyond the plan's list**
- **Issue:** The doc comment on `DEICE_MAX_ACTIVE` in `src/aircraft/da50rg/indicators.ts` said nothing sets the flag, and a title in `tests/indicators.test.ts` said "never set in this phase".
- **Fix:** Both updated to describe the reaction; behaviour unchanged.
- **Files modified:** src/aircraft/da50rg/indicators.ts, tests/indicators.test.ts
- **Commit:** 41692b1, c7363d1

**Total deviations:** 2 blocking-scope notes (Rule 3), no bugs. **Impact:** none on behaviour; commit boundaries differ slightly from the task text.

## Known Limitations (not stubs)

- `rebuild` replays through `simulate`, which is capped at MAX_RUN_MS (30 min); a retract after that time would rebuild a shorter state. The clock driver and lint already bound runs to the same cap.
- The simulation does not run on the free panel, so a lit MAX lamp ends with the run (closeDebrief) rather than by its own timer there.
- A reaction fires on its arming event only; the grading record still reads the log, and plan 05 adds named outcomes on top.

## Known Stubs

None.

## Threat Flags

None. T-03-09 (retract of an event a reaction used) is mitigated by `markConsumed` in the run and the consumed refusal tests; T-03-10 (live state against the graded log) by the replay rebuild and the equality tests; T-03-SC: no package installed.

## Self-Check: PASSED

- Created and modified files exist (checked with `[ -f ]`): tests/run.test.ts, src/engine/physics.ts, src/engine/sim.ts, src/engine/run.ts, src/aircraft/da50rg/physics.ts, src/ui/bridge.ts, src/ui/session.ts, e2e/run-reaction.spec.ts.
- Commits `41692b1`, `1ff9739`, `c7363d1` are ancestors of HEAD.
