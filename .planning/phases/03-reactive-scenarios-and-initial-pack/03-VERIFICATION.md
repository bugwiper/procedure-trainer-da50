---
phase: 03-reactive-scenarios-and-initial-pack
verified: 2026-10-23T14:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-01-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-02-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-03-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-04-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-05-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-06-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-07-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-08-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-09-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-10-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-11-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-12-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-13-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-14-SUMMARY.md"
  - "scenarios/electrical/elec-altn1-fail.toon"
  - "scenarios/electrical/pack.toon"
  - "scenarios/engine/eng-fire-in-flight.toon"
  - "scenarios/engine/eng-oil-temp-green.toon"
  - "scenarios/engine/pack.toon"
  - "src/aircraft/da50rg/aircraft.ts"
  - "src/aircraft/da50rg/cas.ts"
  - "src/aircraft/da50rg/controls/knobs.ts"
  - "src/aircraft/da50rg/controls/squawk.ts"
  - "src/aircraft/da50rg/oil-temp-curve.ts"
  - "src/aircraft/da50rg/physics.ts"
  - "src/aircraft/da50rg/prop-curve.ts"
  - "src/aircraft/da50rg/quantities.ts"
  - "src/engine/curve.ts"
  - "src/engine/grading.ts"
  - "src/engine/physics.ts"
  - "src/engine/predicates.ts"
  - "src/engine/registry.ts"
  - "src/engine/rotary.ts"
  - "src/engine/run.ts"
  - "src/engine/sim.ts"
  - "src/engine/store.ts"
  - "src/scenario/lint.ts"
  - "src/scenario/schema.ts"
  - "src/ui/bridge.ts"
  - "src/ui/clock-driver.ts"
  - "src/ui/debrief-text.ts"
  - "src/ui/outline.ts"
  - "src/ui/panel/frames/ArcGauge.tsx"
  - "src/ui/panel/frames/BarGauge.tsx"
  - "src/ui/panel/frames/MfdFrame.tsx"
  - "src/ui/panel/frames/gauge-alert.ts"
  - "src/ui/panel/widgets/CodeEntry.tsx"
  - "src/ui/panel/widgets/Rotary.tsx"
  - "src/ui/screens/Briefing.tsx"
  - "src/ui/screens/ChecklistOutline.tsx"
  - "src/ui/screens/Debrief.tsx"
  - "src/ui/session.ts"
  - "src/ui/stage.css"
covered_digest: "v3:sha256:d92097c35de43d46833ad790f49acfbab2e3733cc56ac7e09c07ef764ced8814"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "CR-01: a Realistic run is graded only on actions at or after the onset (ba65bc0)"
    - "Human item 1 (owner check on real devices): done as the owner UAT 03-UAT.md, owner acceptance 2026-10-23"
    - "Human item 2 (instructor review of the phase 3 values): answered in docs/GRADING.md, Instructor answers (2026-10-23)"
  gaps_remaining: []
  regressions: []
known_issues:
  - id: WR-01
    severity: warning
    status: partly changed
    summary: "The oil temperature no longer stalls (it has its own scale of 1e-4, commit 039e81c). Other lag quantities on the default 0.01 scale still stall short of a target, for example the fire intensity stops at 1.5 and the oil temperature at 15.48 after ENGINE MASTER off in Engine Fire (probe). No success criterion or threshold depends on it."
  - id: WR-02
    severity: warning
    status: still open
    summary: "The minimal correct answer of ENG OIL TEMP (POWER p65, cowl flap open) now settles at 115.73 C after 10 minutes (probe), 0.7 C above the top of the green band (115). It no longer stalls at 118.69, but it does not reach green. POWER p55 with the cowl flap open settles at 104.5 C, in green."
  - id: WR-03
    severity: warning
    status: deferred to Phase 3.1
    summary: "One exception inside a step stops the frame loop (clock-driver.ts)"
  - id: WR-04
    severity: warning
    status: open
    summary: "Start-decided branches read initial.quantities even on Realistic (grading.ts)"
  - id: WR-05
    severity: warning
    status: deferred to Phase 3.1
    summary: "A live run is not bounded by MAX_RUN_MS but the replay is"
  - id: IN-01
    severity: info
    status: open
    summary: "ESLint determinism guard narrower than its message"
  - id: IN-02
    severity: info
    status: open
    summary: "A reaction armed and cleared in one step still consumes its event"
  - id: UAT-5
    severity: major
    status: deferred to Phase 6
    summary: "Engine Fire on Realistic has no recognisable cue (windscreen with fire and smoke); owner decision 2026-10-23"
  - id: WEBKIT
    severity: info
    status: known issue, not a gate
    summary: "PANEL-REVIEW item 14: one WebKit case fails"
---

# Phase 3: Reactive Scenarios and Initial Pack Verification Report

**Phase Goal:** Users can run all three initial emergencies (Oil Temp High, Electrical Failure, Engine Fire) and see each one react to what they do: gauges move, ignored failures escalate, handled failures recover.
**Verified:** 2026-10-23
**Status:** passed
**Re-verification:** Yes, after the first verification (human_needed), the review fix CR-01, the live-test fixes, the ENG OIL TEMP timing curve, gap closure plans 03-11 to 03-14 and the owner UAT

## Goal Achievement

Every roadmap success criterion is backed by code that exists, is wired from the UI to the engine, and is exercised by tests that I ran in this verification. The two human items of the first report are closed by the owner: the real-device check was done as the UAT (12 tests, 10 passed, 3 gaps; two resolved and accepted, the windscreen cue deferred to Phase 6 by owner decision), and the instructor review is answered in `docs/GRADING.md`. No human item remains.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: Engine gauges and displays move with the simulated state (oil temperature ramps up when the scenario starts and falls after the correct actions) | ✓ VERIFIED | Fixed-step stepper `stepSim` (`src/engine/sim.ts`) over `DA50RG_PHYSICS`; the oil temperature rises through `OIL_TEMP_RISE_RATE_CURVE` (`src/aircraft/da50rg/oil-temp-curve.ts`) and recovers on the plain lag (`oilTempRate` in `physics.ts`). The MFD gauges read `bridge.quantities`. Probe (own throwaway test, deleted): minimal correct answer falls from 128 to 115.73 C and the message clears; POWER p55 plus cowl open to 104.54 C; doing nothing reaches 140.87 C in 10 minutes. `tests/physics.test.ts` pins the Realistic timeline, the Easy outcome at 173 200 ms and recovery cases. `e2e/scenario.spec.ts` "the MFD oil gauges read the base values in the free panel and the live values in a run" passed on desktop-chromium. |
| 2 | SC1a: Realistic starts in the base state with no briefing; the onset comes on its own in a window; reaction time is measured from the onset | ✓ VERIFIED | `session.ts` draws a seed and places the onset inside `onset.window_s` (2 to 6 s in all three scenarios, lint L15 pins the speed); the run starts from the base quantities with the onset reading (`onset.quantities`, 114 C for ENG OIL TEMP); no briefing. `grade` measures `timing.firstActionMs` from the onset. CR-01 is fixed by test: `grading.ts` marks steps that hold at the onset as `preempted` (lines 262 to 312, rule R12) and credits them only after they go false and true again. `tests/grading.test.ts` cases at lines 973 to 1043 passed (14 onset cases, run by name): before the onset credits nothing, the same actions after it pass, undo and redo is credited, an action exactly at the onset counts, a log that ends before the onset credits nothing, Easy and Medium recordings stay byte-identical. `e2e/scenario.spec.ts:420` (Realistic, no briefing, onset inside its window, debrief reveals the scenario) passed. Owner UAT test 4 passed; gap of test 1 (speed) resolved and accepted. |
| 3 | SC2: An ignored scenario or a value past its red line escalates to a named outcome that appears in the debrief | ✓ VERIFIED | Outcomes are scenario data, evaluated in `stepSim` with a hold time; `Run.step` sets the outcome, `session.ts` completes the run, `grade` reports it as the first reason and `Debrief.tsx` shows it. Probe: a do-nothing run holds at 140.87 C after 10 minutes and the Easy outcome time is pinned at 173.2 s in `tests/sim.test.ts` and `docs/GRADING.md`. `*-do-nothing-long` recordings escalate and `*-golden-long` never do. Owner UAT test 3 passed (all three outcomes and their wording). `e2e/run-reaction.spec.ts` carries the real-time escalation case (4 minute timeout), not re-run here. |
| 4 | SC3: "New situation" offers Oil Temp High, Electrical Failure and Engine Fire, each with its own initial state, annunciations and procedure, and each passes golden, do-nothing, wrong-order and forbidden-action replay tests and registry validation | ✓ VERIFIED | `npm run validate`: "3 scenario files checked, 0 problems" (run). `npx vitest run`: 51 files, 2661 tests passed (run). `tests/fixtures/recordings.json` holds golden, do-nothing, forbidden and wrong-order recordings for every scenario (wrong-order on synthetic ordered copies, as the instructor decided: unordered in the shipped files, GRADING.md item 7 and UAT test 12). `e2e/pack.spec.ts` lists every shipped scenario and runs golden runs; passed. The checklists are now printed-form data (plans 03-13, 03-14: schema numbers, actions, comment rows, markers; lint L16 and L17), shown as a table or outline in briefing and debrief (`Briefing.tsx`, `ChecklistOutline.tsx`, `e2e/checklist.spec.ts` passed). Owner UAT tests 8 to 12 passed. |
| 5 | SC4: The user can enter a squawk code (e.g. 7700) in a simplified transponder and the entered code counts as graded panel state | ✓ VERIFIED | `kp.squawk` code-entry control (`controls/squawk.ts`, default 7000 since the live-test fix, keys 0 to 7 and CLR). `eng-fire-in-flight` has the optional step `squawk_7700` with `done: state kp.squawk is "7700"`. `tests/xpdr.test.ts` and the grading case "squawk 7700 is credited only for that code" in the suite; `e2e/xpdr.spec.ts` passed. Owner UAT test 6 passed. |

**Score:** 5/5 truths verified (0 present but behavior-unverified). Every state-transition truth (escalation, recovery, onset pre-emption, retract and rebuild) has a passing behavioral test.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/engine/sim.ts`, `run.ts`, `physics.ts` | Fixed-step stepper, live run, physics types | ✓ VERIFIED | Used by `grading.ts` and `session.ts` |
| `src/aircraft/da50rg/physics.ts`, `oil-temp-curve.ts`, `prop-curve.ts` | DA50 models, rise-rate curve, propeller curve | ✓ VERIFIED | Wired in `DA50RG_PHYSICS` (`oilTempRate`); tests in `tests/physics.test.ts` |
| `src/engine/grading.ts` | Replay grading, outcome, timing, onset pre-emption | ✓ VERIFIED | `preempted` flag in `StepVerdict` |
| `src/ui/panel/frames/gauge-alert.ts`, `BarGauge.tsx`, `ArcGauge.tsx` | Yellow and red label boxes, value boxes, pointers (plan 03-12) | ✓ VERIFIED | Wired in `MfdFrame`; `e2e/gauge-alert.spec.ts` passed |
| `src/ui/screens/Briefing.tsx`, `ChecklistOutline.tsx`, `Debrief.tsx`, `src/ui/outline.ts` | Checklist table and outline (plan 03-14) | ✓ VERIFIED | `e2e/checklist.spec.ts` passed |
| `src/aircraft/da50rg/controls/squawk.ts`, `widgets/CodeEntry.tsx` | Transponder | ✓ VERIFIED | Registered, gated by `xpdr` tests |
| `src/aircraft/da50rg/controls/knobs.ts`, `widgets/Rotary.tsx` | FUEL selector on a bounded arc | ✓ VERIFIED | Gated by `tests/rotary` cases and e2e; owner UAT test 9 |
| `scenarios/engine/*.toon`, `scenarios/electrical/*.toon` | Three scenarios, two manifests | ✓ VERIFIED | `npm run validate`: 0 problems |

`verify.artifacts` over the 14 plans: all pass except two patterns of plan 03-11 (`oil_temp_rate` in `physics.ts` and the oil scenario). That parameter was removed on purpose by commit 039e81c (rate curve instead); `tests/physics.test.ts:268` asserts it is gone and no source references it. Not a gap.

### Key Link Verification

`verify.key-links` over the 14 plans: all links verified (every plan N/N).

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `App.tsx` | `clock-driver.ts` | `attachClockDriver` | WIRED | |
| `Run.step` | bridge quantities | step listener in `session.start` | WIRED | |
| bridge quantities | MFD gauges | `bridge.quantities` in `MfdFrame` | WIRED | |
| step outcome | debrief | `completeRun`, `grade`, `Debrief.tsx` | WIRED | |
| `grade` | same stepper as the live run | `simulate`/`simSetup` | WIRED | |
| `kp.squawk` | graded step | `state` predicate | WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| MFD gauges | `quantities[g.quantity]` | `Run` simulation over the store log | Yes | ✓ FLOWING |
| CAS chip | `casRules.active(ctx)` | quantities plus controls | Yes | ✓ FLOWING |
| Debrief outcome and verdicts | `grade` result | replay of the recorded log | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full unit suite | `npx vitest run` | 51 files, 2661 tests passed | ✓ PASS |
| Scenario validation | `npm run validate` | 3 scenario files checked, 0 problems | ✓ PASS |
| Typecheck, lint, format | `npm run typecheck`, `npm run lint`, `npm run format:check` | no output of errors; "All matched files use Prettier code style!" | ✓ PASS |
| CR-01 fix | `vitest run tests/grading.test.ts -t onset` | 14 passed | ✓ PASS |
| Oil temperature recovery and escalation | throwaway probe (deleted, nothing left in the repo) | 115.73 C (p65 plus cowl), 104.54 C (p55 plus cowl), 140.87 C (nothing) after 10 min | ✓ PASS |
| E2E sample, desktop-chromium | `playwright test pack, xpdr, scenario, checklist, gauge-alert` | 35 passed | ✓ PASS |

The full e2e suite (792 passed per the agents) was not re-run.

### Probe Execution

SKIPPED: the phase declares no probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| SCN-06 | 03-01, 03-04 to 03-08, 03-11 | Reactions, escalation, named outcomes, Realistic | ✓ SATISFIED | Truths 1 to 4 |
| PNL-04 | 03-01, 03-02, 03-12 | Gauges and displays follow the simulated state | ✓ SATISFIED | Truth 1, e2e MFD case, gauge-alert spec |
| PNL-07 | 03-03 | Simplified transponder, squawk is graded state | ✓ SATISFIED | Truth 5 |
| CNT-01 | 03-07, 03-08, 03-13, 03-14 | Initial pack of the three emergencies | ✓ SATISFIED | Truth 4 |

No orphaned requirements found for Phase 3 in the plans' frontmatter.

### Anti-Patterns Found

Scan for TBD, FIXME and XXX over `src`, `scenarios`, `e2e`, `tests`, `scripts`, `docs`: only the regex of a documentation gate in `tests/panel-review.test.ts`. No debt markers in the files of this phase. No blockers.

### Review findings, state after this phase

CR-01 is fixed and confirmed by test. WR-01 changed for the oil temperature only (finer scale), see `known_issues`. WR-02 is still open in a smaller form: the minimal correct answer lands 0.7 C above the green band instead of 3.7 C. WR-03 and WR-05 go to Phase 3.1 (ROADMAP). WR-04, IN-01, IN-02 stay open. The disposition file `03-REVIEW-DISPOSITION.md` still lists every finding as `open` (including CR-01); it is stale and the owner may want to update it. None of these contradicts a success criterion as worded.

### Human Verification Required

None. The real-device check of PANEL-REVIEW and the instructor review were done by the owner (03-UAT.md, owner acceptance 2026-10-23; docs/GRADING.md, Instructor answers (2026-10-23)).

### Gaps Summary

No gaps. Deferred by owner decision and not counted: UAT test 5 (Engine Fire cue on Realistic, windscreen) to Phase 6; WR-03 and WR-05 to Phase 3.1. Known issues are listed in the frontmatter.

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_
