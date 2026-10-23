---
phase: 03-reactive-scenarios-and-initial-pack
verified: 2026-10-23T03:45:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-01-PLAN.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-01-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-02-PLAN.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-02-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-03-PLAN.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-03-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-04-PLAN.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-04-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-05-PLAN.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-05-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-06-PLAN.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-06-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-07-PLAN.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-07-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-08-PLAN.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-08-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-09-PLAN.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-09-SUMMARY.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-10-PLAN.md"
  - ".planning/phases/03-reactive-scenarios-and-initial-pack/03-10-SUMMARY.md"
  - "scenarios/electrical/elec-altn1-fail.toon"
  - "scenarios/electrical/pack.toon"
  - "scenarios/engine/eng-fire-in-flight.toon"
  - "scenarios/engine/eng-oil-temp-green.toon"
  - "scenarios/engine/pack.toon"
  - "src/aircraft/da50rg/aircraft.ts"
  - "src/aircraft/da50rg/cas.ts"
  - "src/aircraft/da50rg/controls/squawk.ts"
  - "src/aircraft/da50rg/physics.ts"
  - "src/aircraft/da50rg/quantities.ts"
  - "src/engine/grading.ts"
  - "src/engine/physics.ts"
  - "src/engine/run.ts"
  - "src/engine/sim.ts"
  - "src/engine/store.ts"
  - "src/scenario/lint.ts"
  - "src/scenario/schema.ts"
  - "src/ui/bridge.ts"
  - "src/ui/clock-driver.ts"
  - "src/ui/panel/widgets/CodeEntry.tsx"
  - "src/ui/screens/Debrief.tsx"
  - "src/ui/session.ts"
covered_digest: "v3:sha256:98c6a323dc5f2735d7ef8b9c619e7cf1ff2511c75807e0b4f3f12705e6f3e8c9"
behavior_unverified: 0
overrides_applied: 0
known_issues:
  - id: CR-01
    severity: warning
    summary: "Realistic level: a checklist done before the onset is graded PASS (verified by probe and visible in the shipped e2e)"
  - id: WR-01
    severity: warning
    summary: "0.01 quantisation stalls slow lag models up to 3 degrees short of target (verified by probe)"
  - id: WR-02
    severity: warning
    summary: "Minimal correct answer of ENG OIL TEMP settles at 118.69 C, above the green band (verified by probe)"
  - id: WR-03
    severity: warning
    summary: "One exception inside a step stops the frame loop for the page lifetime (confirmed by reading clock-driver.ts)"
  - id: WR-04
    severity: warning
    summary: "Start-decided branches read initial.quantities even on Realistic (confirmed by reading grading.ts)"
  - id: WR-05
    severity: warning
    summary: "A live run is not bounded by MAX_RUN_MS but the replay is (confirmed by reading run.ts and sim.ts)"
  - id: IN-01
    severity: info
    summary: "ESLint determinism guard narrower than its message"
  - id: IN-02
    severity: info
    summary: "A reaction armed and cleared in one step still consumes its event"
human_verification:
  - test: "Owner end-of-phase check on a real desktop, a real phone and a tablet (docs/PANEL-REVIEW.md, 'Phase 3: owner review', items 1 to 12). Run each of the three situations on Easy and on Realistic; watch the gauges move and recover after the correct actions; let one run escalate and read the outcome in the debrief; enter 7700 on the transponder; in Engine Fire pull the ECS SHUTOFF and turn the FUEL selector to OFF; press MAX with the de-ice mode on HIGH during a run."
    expected: "Gauges move at an acceptable speed and recover after the correct actions; the escalation opens the debrief as FAIL naming the outcome; the transponder keys are usable at phone zoom; the new controls (FUEL selector, ECS SHUTOFF, shortened cowl flap) read as intended; Realistic gives a recognisable cue for each failure (Engine Fire has no PFD message, only rising temperatures)."
    why_human: "Plan 03-09 declares this as a human-check task. Physics speed, wording, touch sizes and the look of controls on real devices cannot be judged by grep or unit tests. The summary also records WebKit as unverified (one case fails, not a gate)."
  - test: "Instructor review of the phase 3 values (docs/GRADING.md, 'Instructor review (phase 3, 2026-10-23)', ten items): physics constants and time scale, outcome thresholds and hold times, onset windows, forbidden lists, order of the new procedures."
    expected: "The instructor accepts or edits the default values; a change is a data edit in scenarios/ or src/aircraft/da50rg/physics.ts."
    why_human: "Every value was chosen by default while the phase was built without the instructor. Tests pin directions and relations, not realism. Not a roadmap success criterion, but it gates showing the trainer to other pilots."
---

# Phase 3: Reactive Scenarios and Initial Pack Verification Report

**Phase Goal:** Users can run all three initial emergencies (Oil Temp High, Electrical Failure, Engine Fire) and see each one react to what they do: gauges move, ignored failures escalate, handled failures recover.
**Verified:** 2026-10-23
**Status:** human_needed
**Re-verification:** No, initial verification

## Goal Achievement

All five roadmap success criteria are backed by code that exists, is wired from the UI to the engine, and is exercised by tests that pass. Nothing is FAILED. The status is `human_needed` because plan 03-09 declares an owner check on real devices (a `<human-check>` block), and because the phase values were never reviewed by the instructor. The advisory review has one critical and five warning findings. All of them are confirmed to be real. None contradicts the literal wording of a success criterion. CR-01 undermines the intent of the Realistic level, so it is the first item to decide on before the Realistic level is shown to other pilots.

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | SC1: Engine gauges and displays move with the simulated state (oil temperature ramps up when the scenario starts and falls after the correct actions) | ✓ VERIFIED | Fixed-step stepper `stepSim` (`src/engine/sim.ts:171`) runs the lag and rate models of `DA50RG_PHYSICS` (`src/aircraft/da50rg/physics.ts:306`, 15 models). `Run.step` is driven by `attachClockDriver` (`src/ui/App.tsx:39`). The session step listener calls `bridge.setQuantities(state.quantities)` (`src/ui/session.ts:262`), and all twelve MFD gauges read `bridge.quantities` (`src/ui/panel/frames/MfdFrame.tsx:233-388`, no literal gauge numbers). Probe: realistic oil temperature 91.5 at 5 s, 111.4 at 30 s, 130.6 at 60 s. Ignored ENG OIL TEMP ends at t=42600 ms with `engine_failure`. With the correct actions it falls to 118.69 C, below the 125 C CAS limit, so the message clears. Tests: `tests/sim.test.ts`, `tests/physics.test.ts`, `e2e/run-reaction.spec.ts` ("rises while ignored and falls after POWER down and the cowl flap open", "MFD oil gauges read ... live values in a run"). Caveat: WR-01 and WR-02 (known issues) |
| 2 | SC1a: Realistic level starts in the base state with no briefing; the onset comes on its own inside a window; reaction time is measured from the onset | ✓ VERIFIED (with known issue CR-01) | `session.ts:249-278`: a seed is drawn, `onsetFromSeed` places the onset inside `scenario.onset.window_s` on a step boundary, the run starts from base quantities (`startQuantities = {}`) with `onsetAt`, no briefing (`briefing.value = null`). `physics` switches from normal to faulted parameters at `onsetAt` (`sim.ts:205`). `grade` records `timing.firstActionMs` from the onset (`grading.ts:314-320`). Tests: `tests/grading.test.ts` "reaction time from the onset" (7 cases), `e2e/scenario.spec.ts:417` (no briefing, onset inside the window, debrief reveals the scenario). Lint L14 covers do-nothing visibility. Weakness: the checklist done before the onset is graded PASS (CR-01, see Known Issues) |
| 3 | SC2: An ignored scenario or a value past its red line escalates to a named outcome that appears in the debrief | ✓ VERIFIED | Outcomes are scenario data (`outcomes[1]` in all three files) evaluated in `stepSim` step (5) with a hold time. `Run.step` sets the outcome, the session step listener calls `completeRun()` (`session.ts:266`), and `grade` reports `reasons[0] = {kind:'outcome'}` with the text. Probe: oil do-nothing outcome at 42.6 s. Tests: `tests/grading.test.ts` "named outcomes" and the per-scenario replays (`*-do-nothing-long` escalates on a step boundary, `*-golden-long` never escalates). `e2e/run-reaction.spec.ts:139` waits for the debrief to open by itself as FAIL with the outcome text as the first reason (desktop-chromium) |
| 4 | SC3: "New situation" offers Oil Temp High, Electrical Failure and Engine Fire, each with its own initial state, annunciations and procedure, each passing golden, do-nothing, wrong-order and forbidden-action replay tests and registry validation | ✓ VERIFIED | Packs `engine` (2 scenarios) and `electrical` (1) are globbed by `packs-vite.ts` and listed by `listPacks`. `npm run validate`: "3 scenario files checked, 0 problems" (run by the verifier). `tests/fixtures/recordings.json` holds golden, do-nothing, forbidden and wrong-order recordings for each scenario (oil: `golden`, `do-nothing`, `forbidden`, `wrong-order`; electrical: `elec-golden`, `elec-do-nothing`, `elec-forbidden`, `elec-wrong-order(-ordered)`; fire: `fire-golden`, `fire-do-nothing`, `fire-forbidden`, `fire-wrong-order(-ordered)`) plus `*-long` escalation variants. `checkScenario` runs on each (and on the ordered copies). `e2e/pack.spec.ts` lists every shipped scenario and runs the ALTN 1 FAIL and Engine Fire golden runs. Each scenario has its own `initial`, `annunciations` and `procedure`. Note: the shipped scenarios use unordered groups, so the wrong-order tests run on the synthetic ordered copies (fixtures `elec-ordered`, `fire-ordered`). This is a declared instructor decision (GRADING.md item 7) |
| 5 | SC4: The user can enter a squawk code (e.g. 7700) in a simplified transponder and the entered code counts as graded panel state | ✓ VERIFIED | `kp.squawk` `code-entry` control in the registry (`controls/squawk.ts`, keys 0-7 and CLR, default 1200). The committed code is the control state in the store log. `eng-fire-in-flight` has an optional step `squawk_7700` with `done: state kp.squawk is "7700"`. Tests: `tests/xpdr.test.ts`, `tests/grading.test.ts` "squawk 7700 is credited only for that code" (7600 not credited, 7700 credited), `e2e/xpdr.spec.ts` (four taps commit 7700 as one event, CLR, no zoom on key taps) |

**Score:** 5/5 truths verified (0 present but behavior-unverified). The state-transition and cancellation invariants (escalation, recovery, retract and rebuild, timers) all have passing behavioral tests, not just presence.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/engine/sim.ts` | Fixed-step stepper, reactions, outcomes | ✓ VERIFIED | 295 lines, substantive, used by `run.ts` and `grading.ts` |
| `src/engine/run.ts` | Live run over the store log, retract rebuild | ✓ VERIFIED | Wired in `session.ts:260` |
| `src/engine/physics.ts`, `src/aircraft/da50rg/physics.ts` | Physics types, DA50 models | ✓ VERIFIED | 190 and 358 lines; models anchored to base values |
| `src/engine/grading.ts` | Replay grading with outcome and timing | ✓ VERIFIED | Wired in `session.completeRun` |
| `src/ui/clock-driver.ts` | Frames to whole steps | ✓ VERIFIED (WR-03) | Attached in `App.tsx:39` |
| `scenarios/engine/*.toon`, `scenarios/electrical/*.toon` | Three scenarios and two manifests | ✓ VERIFIED | Validate: 0 problems |
| `src/aircraft/da50rg/controls/squawk.ts`, `widgets/CodeEntry.tsx` | Transponder | ✓ VERIFIED | Registered and gated by tests and e2e |
| `src/aircraft/da50rg/cas.ts`, `quantities.ts` | Rule-derived messages, bands | ✓ VERIFIED | ENG OIL TEMP, OIL PRES, ALTN 1 FAIL |
| `docs/GRADING.md`, `docs/PANEL-REVIEW.md` | Rules and owner list | ✓ VERIFIED | Phase 3 sections present and gated by `tests/panel-review.test.ts` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `App.tsx` | `clock-driver.ts` | `attachClockDriver` with raf, now, hidden, blocked | WIRED | `App.tsx:39` |
| `clock-driver.ts` | `Run.step` | `session.run` signal | WIRED | `clock-driver.ts:63` |
| `Run` | bridge quantities, flags | `onStep` listener in `session.start` | WIRED | `session.ts:261-267` |
| bridge quantities | MFD gauges | `bridge.quantities.value` read in `MfdFrame` | WIRED | `MfdFrame.tsx:265` |
| step outcome | debrief | `completeRun` then `grade` then `Debrief.tsx` | WIRED | `session.ts:266`, e2e escalation test |
| `grade` | same stepper as the live run | `simulate`/`simSetup` | WIRED | `grading.ts:193` |
| `kp.squawk` | graded step | `state` predicate in the scenario | WIRED | fire scenario, grading test |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| MFD engine and map gauges | `quantities[g.quantity]` | `Run` simulation over the store log | Yes (models read controls, parameters, flags) | ✓ FLOWING |
| CAS chip | `casRules.active(ctx)` | `quantities.value` plus controls | Yes (clears at 118.69 C, below 125) | ✓ FLOWING |
| Debrief outcome line | `result.outcome` | `findOutcome` replay | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full unit suite | `npx vitest run` | 48 files, 2505 tests passed | ✓ PASS |
| Every shipped scenario validates | `npm run validate` | 3 scenario files checked, 0 problems | ✓ PASS |
| Oil do-nothing escalates | verifier probe (scratchpad, outside the repo) | `engine_failure` at t=42600 | ✓ PASS |
| Oil minimal correct answer (p65 and cowl open) | verifier probe | settles at 118.69, no outcome | ✓ PASS (see WR-02) |
| Realistic oil ramp | verifier probe | 91.5 / 92 / 111.4 / 130.6 at 5/10/30/60 s with onset 10 s | ✓ PASS |
| Fire checklist done before the onset | verifier probe | `pass`, reasons `[]`, `firstActionMs: null` | ⚠️ confirms CR-01 |

I did not re-run typecheck, lint, build or the e2e suite. I rely on the orchestrator's report for those (typecheck, lint, format:check, build exit 0; Chromium e2e 761 passed, 0 failed; one WebKit case fails and is documented in PANEL-REVIEW item 14).

### Probe Execution

SKIPPED: no `scripts/*/tests/probe-*.sh` exists and no plan declares a probe.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| SCN-06 | 03-01, 03-04, 03-05, 03-06, 03-09 | Scripted reactions: timers, ramps, triggers on user actions, escalation to named outcomes | ✓ SATISFIED | Lag and rate models (ramps), `deice_max` reaction with a 120 s timer triggered by a control event, named outcomes with hold time, onset timing |
| PNL-04 | 03-01, 03-02, 03-09 | Engine gauges and displays respond to simulated aircraft state | ✓ SATISFIED | SC1 evidence above |
| PNL-07 | 03-03, 03-08, 03-09 | Simplified transponder lets the user enter a squawk code | ✓ SATISFIED | SC4 evidence above |
| CNT-01 | 03-07, 03-08, 03-09, 03-10 | Initial pack has Oil Temp High, Electrical Failure, Engine Fire | ✓ SATISFIED | Three validated scenarios in two packs |

All four IDs from the plan frontmatter appear in REQUIREMENTS.md (marked `[x]` and `Complete` in the traceability table). REQUIREMENTS.md maps no other ID to Phase 3, so there are no orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (87 files changed since the phase start) | - | `TBD`, `FIXME`, `XXX` markers | none | grep found no marker in source, scenarios or docs. The only hits are the regexes inside `tests/panel-review.test.ts` that forbid such words |
| `src/ui/clock-driver.ts` | 51-68 | Re-arm of `raf` after `run.step()` | ⚠️ Warning | WR-03: one exception freezes the frame loop |
| `src/engine/grading.ts` | 240-267 | No use of the onset when crediting steps | ⚠️ Warning | CR-01 |
| `src/engine/sim.ts` | 219-229 | Rounding swallows small lag steps | ⚠️ Warning | WR-01 |

### Known Issues (advisory review, all open in 03-REVIEW-DISPOSITION.md)

I read the code for each finding. CR-01, WR-01 and WR-02 I also reproduced with the real engine. No finding contradicts the literal text of a success criterion, so none is a gap. They are listed in decreasing weight for the owner's decision.

- **CR-01 (critical in the review; I rate it a warning against the criteria).** On Realistic, `grade` credits a step when its predicate holds after the last event, whatever the event time. Doing the whole checklist before the onset gives PASS with no reasons, and the debrief says "No action after the onset." Reproduced for ENGINE FIRE (five panel steps at 0.1 to 0.5 s, onset at 20 s). The shipped e2e `scenario.spec.ts:417` does exactly this (its golden taps come before the onset) and only asserts the timing line, so the test suite depends on the loophole. SC1a is satisfied word for word (base start, no briefing, onset on its own, reaction time from the onset). The purpose of the level, and the core value of accurate feedback, is not. Recommended before the Realistic level is shown to other pilots: close it as proposed in 03-REVIEW.md and change the e2e to act after the onset. The unit test at `tests/grading.test.ts:962` ("the event before the onset is still graded") would have to change as well.
- **WR-01.** Slow lag models freeze up to 3 degrees short of the target (reproduced: 118.69 for a target of 115.70). It also hides the intended return to cruise values. Fix by a finer `scale` or by snapping within one quantum.
- **WR-02.** The minimal answer of ENG OIL TEMP (power p65 and cowl open) never reaches the green band (reproduced: 118.69, target 115.70). The CAS message still clears (limit 125), so "handled failures recover" holds for SC1. The checklist branch "If not returning to green range: land" is always taken for the minimum answer. Scenario numbers are an instructor item.
- **WR-03.** An exception in a step listener (`completeRun` calls `grade`, which can throw) stops the animation loop for good. Confirmed by reading. Cheap fix: re-arm first, then guard.
- **WR-04.** On Realistic, branches decided at start read `initial.quantities`, which the run ignores. Harmless today (the shipped value equals the base value).
- **WR-05.** The live run has no 30-minute cap, the replay does. Only matters for runs over 30 minutes.
- **IN-01, IN-02.** Determinism lint wider than its message; a reaction armed and cleared in one step consumes its event. No effect on grading.

Documentation nit (not a finding of the review): `docs/PANEL-REVIEW.md` item 1 says "the time scale is real, not compressed", while `src/aircraft/da50rg/physics.ts` says the time constants are compressed. One of the two is wrong.

### Human Verification Required

#### 1. Owner end-of-phase check on real devices

**Test:** Follow docs/PANEL-REVIEW.md "Phase 3: owner review", items 1 to 12, on a desktop, a real phone and a tablet. Run each of the three situations on Easy and on Realistic. Let one escalate. Enter 7700. In Engine Fire pull the ECS SHUTOFF and turn the FUEL selector OFF. Press MAX with the de-ice mode on HIGH during a run. Include the Engine Fire realistic cue (item 5) and, if possible, one Safari run (WebKit case, item 14).
**Expected:** Gauges move and recover at an acceptable speed; escalation opens the debrief as FAIL with the outcome wording; transponder keys are usable; the FUEL selector, ECS SHUTOFF and moved cowl flap look as intended.
**Why human:** Declared as a `<human-check>` in plan 03-09. Feel, speed, wording and looks on real touch devices.

#### 2. Instructor review of the phase 3 values

**Test:** Walk the ten items of docs/GRADING.md "Instructor review (phase 3, 2026-10-23)".
**Expected:** The instructor accepts or edits the physics constants, thresholds, hold times, onset windows, forbidden lists and procedure order.
**Why human:** All values are defaults chosen without the instructor. Not a success criterion; it gates showing the trainer to others.

### Gaps Summary

No gaps. Every success criterion is implemented, wired from the UI through the engine and covered by passing tests. The phase waits on the owner's device check and the instructor review, and the owner should decide about CR-01 (and, cheaply, WR-03 and WR-01/WR-02) before the Realistic level is treated as finished.

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_
