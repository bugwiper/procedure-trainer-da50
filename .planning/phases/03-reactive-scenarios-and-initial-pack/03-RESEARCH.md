# Phase 3: Reactive Scenarios and Initial Pack - Research

**Researched:** 2026-10-22
**Domain:** Pure-TypeScript deterministic simulation (fixed-step physics, onset, escalation) layered on an existing store/grading/scenario engine; two new AFM-derived scenarios; a simplified transponder control
**Confidence:** MEDIUM-HIGH (in-repo architecture and AFM procedure facts verified by reading source; physics constants, ALTN 1 FAIL CAS behaviour and three control positions are assumptions needing owner or instructor confirmation)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Reaction model and physics
- **D-01:** Live values come from a **small per-quantity physics model** (e.g. oil temperature rises with power, falls with cowl flap open), not from authored ramps or timelines. Scenarios set parameters, initial quantities and onset; recovery is part of the model, not separate scenario data. The model is generic aircraft behaviour (lives with the aircraft, `src/aircraft/da50rg`), never a scenario fact (`tests/blueprint.test.ts` still applies). Extends D-08 of Phase 2 (named quantities) without a format change.
- **D-02:** The virtual clock advances in **fixed steps** (e.g. 100 ms) independent of frame rate, so replays and golden tests are identical. No timers in the engine.
- **D-03:** Retract/consumed rule: a reaction **consumes an event (`markConsumed`) only when it fires**. An armed but unfired reaction leaves the event retractable and the reaction layer cancels what a removed event armed via `onRetract`. Tests per reaction kind: after firing, `retract` returns `consumed`.
- **D-04:** The de-ice **MAX 120 s run** is built now (it exercises the clock/flag path: `deice.max_active`, lamp `lt.deice_max`, clears on leaving HIGH). ANNUN-TEST, WIND SHIELD spray, ICE LIGHT effect and ELT lamp behaviour stay deferred.

#### Realistic level, escalation, verdicts
- **D-05:** Realistic level: run starts in the base panel state with **no briefing text and nothing else shown**; onset after a **random delay inside a scenario-defined window, drawn from a seed recorded in the run** so replays are identical. Reaction time is measured from onset. The scenario is revealed in the debrief. Easy/medium levels (phase 2.1) are unchanged.
- **D-06:** An unhandled failure that passes its red line triggers a **named outcome (e.g. engine failure) that ends the run as FAIL**; the debrief names the outcome and the missed steps. No follow-on checklists in this phase.
- **D-07:** Verdicts stay **PASS/FAIL**. "Pass with recommendation" remains deferred (todo kept).

#### Initial pack content
- **D-08:** Pack = Oil Temp High (green branch, exists), **Electrical Failure (ALTN 1 FAIL)** and **Engine Fire in flight**. The OIL PRES low branch stays deferred. Each scenario passes golden, do-nothing, wrong-order and forbidden-action replay tests plus registry validation.
- **D-09:** **Electrical Failure is a blueprint scenario like Oil Temp High**: before writing it, the researcher must research the official checklist (AFM section and revision, pocket card in `.input/`) and the scenario is validated against it. The goal is baseline functionality across all phases first; a bigger scenario set comes later. Content limits per `docs/CONTENT-POLICY.md` (short verbatim step lines up to 12 words, paraphrased explanation).
- **D-10:** Breaker/bus effects are wired **only as far as the scenarios need** (quantities and lamps they use); the rest of the breaker-effects todo stays deferred.

#### Squawk transponder and instruments
- **D-11:** A **simplified transponder sits in the pilot's footroom/legroom** with digit keys 0-7 and a display of the current code. It is temporary and will be replaced later by transponder functionality in the Garmin PFD (a later, not yet created phase). Fidelity of position is therefore not a concern. The entered 4-digit code is panel state, matched like any other step's target state (e.g. 7700). Keep it minimal (CLR/ENT-style behaviour only as needed).
- **D-12:** **All engine-page gauges** respond to the simulated state (not only the quantities the three scenarios use); the physics model must cover them.

### Claude's Discretion
Fixed step size, physics constants and gauge ramp feel; schema field names for onset window, outcomes and physics parameters; transponder key layout details; exact bus/breaker subset for the electrical scenario.

### Deferred Ideas (OUT OF SCOPE)
- OIL PRES low branch of Oil Temp High; "pass with recommendation" verdict; ANNUN-TEST/WIND SHIELD/ICE LIGHT/ELT behaviours; full breaker bus model; transponder in the Garmin PFD (future phase); follow-on checklists after an escalation outcome.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCN-06 | Scripted reactions: timers, ramps, triggers on user actions, escalation to named outcomes | Section "Simulation architecture": pure `stepSim` (onset timer, MAX 120 s timer, physics ramps, event-triggered flags, `outcomes` with hold timers), one replay path shared by live run and `grade` |
| PNL-04 | Engine gauges and displays respond to simulated aircraft state | 12 engine-page gauges mapped to 12 named quantities (table "Quantity and physics coverage"); bridge feeds `quantities` and `flags` signals from the run each fixed step |
| PNL-07 | Simplified transponder lets the user enter a squawk code | New `code-entry` control kind, state = committed 4-digit code, graded by the existing `state` predicate (section "Transponder") |
| CNT-01 | Initial pack contains Oil Temp High, Electrical Failure, Engine Fire | Section "AFM source research" gives both procedures as structured facts; the registry gaps (FUEL valve, ECS shut-off) are called out; scenario skeletons and test matrix per scenario |
</phase_requirements>

## Summary

Phase 3 turns the Phase 2 engine from "static quantities, control-only grading" into a deterministic run: a pure `stepSim` function advances named quantities, flags and timers in fixed 100 ms steps from the control state and the control events, `grade` replays the same function to find an escalation outcome, and the live UI run uses the identical code path. Everything the roadmap asks for follows from that: gauge ramps (physics), the realistic level (seeded onset time), escalation to a named FAIL outcome (outcome rules with a hold timer), the MAX 120 s run (event-triggered flag with a timer). The existing seams are already shaped for this (named quantities, `markConsumed`/`onRetract`, `IndicatorInputs.flags`, `VirtualClock`, tick-driven clock driver); what is missing is the stepper, the schema fields, the sim-fed bridge signals and a handful of aircraft data additions. No new npm package is needed. [VERIFIED: package.json read this session]

Three findings change the plan scope and must reach the planner and owner early. (1) **The registry has no FUEL valve, no ECS shut-off and no emergency-window control**, and the AFM Engine Fire in Flight procedure uses the first two; their real position is not visible in any `.input/` photo (the AFM says the fuel valve is "in the personnel compartment centre console, behind the trim wheel"). Layout fidelity is the project's core value, so those two controls need an owner-confirmed position or the scenario must grade only the controls that exist. (2) **Quantities today are idle (engine-off) values on the free panel** (oil pressure 0, amps 0); any new CAS rule over amps or pressure would light chips on the free panel unless the free-panel and realistic-start values become the physics "base" (cruise equilibrium). (3) **A 4-digit code cannot be graded with the current predicate vocabulary and control kinds**: momentary buttons rest back to `released`, rotary knobs allow at most 5 stops, and `Predicate` has no conjunction, so the transponder needs a new control kind whose state is the whole code.

The determinism design rule that everything else depends on: **sim state is a pure function of (scenario, seed-derived onset time, event log, time)**. The live run never keeps path-dependent state that a retract could invalidate: on `onRetract` the run is rebuilt by replaying the remaining log, and `grade` calls the same `simulate` function. Float arithmetic in the stepper must use only `+ - * /` (no `Math.exp`/`pow`) and quantise after each step, otherwise V8 (browser) and node replays can disagree in the last bit and a threshold could trip one step apart.

**Primary recommendation:** Build `src/engine/sim.ts` (pure `stepSim` plus `simulate`) and `src/engine/physics.ts` (generic types and `definePhysics`) first, with the DA50 constants in `src/aircraft/da50rg/physics.ts`; extend the scenario schema additively (`parameters`, `onset`, `outcomes`, format stays 1); make `grade` return an `outcome` and a `timing` block through the same `simulate`; only then touch the bridge, clock driver, session and UI; write the two new scenarios last, each with the four replay tests.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fixed-step stepping, onset time from seed, timers, outcomes | `src/engine` (pure) | - | CLAUDE.md: engine has no clock, no timers, no `Math.random`; deterministic replay needed by `grade` |
| Physics constants (time constants, equilibrium formulas, parameter vocabulary) | `src/aircraft/da50rg` | `src/engine/physics.ts` (generic types, validation) | D-01: generic aircraft behaviour lives with the aircraft; `tests/blueprint.test.ts` forbids scenario facts in src/engine, src/scenario, src/ui |
| Scenario parameters, onset window, outcomes (thresholds, hold times) | `scenarios/` (TOON data) | `src/scenario/schema.ts` + `lint.ts` (validation) | Scenario facts are data; lint checks references against the aircraft |
| Seed generation (randomness) and real-time-to-step conversion | `src/ui` (`session.ts`, `clock-driver.ts`) | - | Existing rule: UI owns rng and real time; engine only consumes seed and whole steps |
| Gauge needle values, CAS chips, lamps from flags | `src/ui` (bridge signals, frames) | `src/engine` (`cas.ts`, `indicators.ts` evaluate) | Bridge already derives CAS and lamps reactively from signals |
| Outcome and reaction time in the verdict | `src/engine/grading.ts` | `src/ui/debrief-text.ts` (copy) | Grading stays pure replay; the debrief only formats |
| Transponder state and grading | `src/engine/registry.ts` (new kind) + store | `src/ui/panel/widgets` (keys, UI-local entry buffer) | State lives in the store, never in the DOM |
| Realistic level flow (no briefing) | `src/ui/session.ts` + `screens/LevelPick.tsx` | - | Session machine owns screens; level is never an input of `grade` (onset time is run data, not level) |

## Standard Stack

### Core
No new dependency. All work is plain TypeScript on the pinned stack. [VERIFIED: /Users/pascalbetz/projects/procedure-trainer-da-50/package.json]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 6.0.3 (pinned) | engine, schema, UI | project stack |
| zod | 4.6.7 (pinned) | schema additions (`parameters`, `onset`, `outcomes`) | project stack, `z.strictObject` |
| @toon-format/toon | 4.4.0 (pinned) | scenario files | project stack |
| preact + @preact/signals | 11.0.1 / 2.11.3 | gauge, lamp, CAS reactivity | project stack |
| vitest | 5.0.5 | engine, replay, schema, lint tests (node env) | project stack; baseline 44 files, 2192 tests pass in 2.8 s [VERIFIED: `npx vitest run` this session] |
| @playwright/test | 1.64.1 | e2e of realistic flow, transponder, gauge response | project stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled seeded PRNG (mulberry32, ~6 lines) | a PRNG npm package | A dependency for six lines of integer maths is not justified; keep it in `src/engine/sim.ts` with a known-answer test |
| `Math.exp` first-order lag | linear lag `q += (target - q) * k` with `k = dt/tau` | Exp is not guaranteed bit-identical across engines; the linear form uses only IEEE-754 basic ops and is deterministic everywhere |
| XState / reaction scripting library | pure `stepSim` | Already decided in STACK.md (XState rejected) |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase, so the legitimacy gate has nothing to check. **Packages removed due to SLOP verdict:** none. **Packages flagged SUS:** none. [VERIFIED: package.json read; plan must not add dependencies]

## Architecture Patterns

### System Architecture Diagram

```
 real frames (rAF)
      |
      v
 clock-driver.ts  --(accumulate ms, emit WHOLE 100 ms steps, keep remainder)-->  Run.advance(steps)
      ^                                                                              |
      | paused: hidden tab / modal                                                   | per step:
                                                                                     v
 user tap ---> bridge.actuate ---> PanelStore.dispatch (event t = clock.now(), a multiple of 100)
                                       |  subscribe                |  onRetract
                                       v                           v
                              Run.queue(event)             Run.rebuild()  (replay log -> same state as if never done)
                                       |
              +------------------------+--------------------------+
              v                                                   
        stepSim(state, eventsAtThisStep, controls)   -- pure, src/engine/sim.ts
          1 apply events: one-shot reactions (MAX press -> flag+timer) -> markConsumed(seq) when fired
          2 onset: when t >= onsetAt, scenario parameters switch from "normal" to "faulted"
          3 physics: each quantity q += (target(controls, params, flags, q-others) - q) * k ; quantise
          4 flags/timers: deice.max_active countdown; clears if sw.deice_mode leaves HIGH
          5 outcomes: predicate holds for hold_s -> outcome = {id, text, t}
              |
              v
     state { t, quantities, flags, outcome, onsetAt }
        |                    |                               |
        v                    v                               v
 bridge.quantities     bridge.flags signal            outcome != null -> session.complete()
 (gauges, CAS)         (lt.deice_max lamp)                         |
                                                                   v
                       grade(scenario, env, recording{events, completedAt, onsetAt, seed})
                          = same simulate() replay + existing control grading
                          -> GradeResult{ ..., outcome, timing } -> Debrief
```

Entry points: user taps (events), rAF frames (time), the briefing/level card (level, seed). Decision points: onset reached, hold timers, outcome. External boundaries: none (static site).

### Recommended Project Structure
```
src/engine/
├── physics.ts        # generic: PhysicsSpec types, definePhysics (validates ids, ranges, parameter vocabulary)
├── sim.ts            # STEP_MS, SimState, initSim, stepSim, simulate, onsetFromSeed (mulberry32)
├── run.ts            # Run: VirtualClock + SimState + event queue + rebuild on retract + markConsumed (pure, no DOM)
├── grading.ts        # grade(): calls simulate(); adds outcome + timing to GradeResult
src/aircraft/da50rg/
├── physics.ts        # DA50 constants: equilibrium/tau per quantity, parameter vocabulary (oil_cooling, alt1_output, engine_fire)
├── quantities.ts     # grows from 2 to 12 visible quantities (+ hidden fire_intensity)
├── cas.ts            # + ALTN 1 FAIL (caution), OIL PRES (warning) as the scenarios need
├── controls/xpdr.ts  # transponder code-entry control (+ fuel valve, ECS shut-off if confirmed)
src/scenario/
├── schema.ts         # + parameters, onset, outcomes (all optional with defaults, format stays 1)
├── lint.ts           # + L12.. (parameters known, outcome predicates resolve, window sane, hold bounded)
scenarios/
├── engine/eng-oil-temp-green.toon   # gains parameters, onset, outcomes
├── engine/eng-fire-in-flight.toon   # new
├── electrical/elec-altn1-fail.toon  # new pack folder (one chunk per pack) or same pack: planner choice
src/ui/
├── bridge.ts         # quantities + flags become sim-fed signals; reset(controls, quantities, flags)
├── clock-driver.ts   # accumulator, whole steps only
├── session.ts        # Level gains 'realistic'; seed; outcome-driven complete(); run object
├── screens/LevelPick.tsx, Debrief.tsx, debrief-text.ts  # enable Realistic, outcome line, reaction time
```

### Pattern 1: Pure fixed-step simulation with replay as the only source of truth
**What:** `stepSim(state, input) -> state` is pure. `simulate(env, scenario, {events, onsetAt, untilMs})` loops it. The live `Run` calls `stepSim` incrementally; `grade` and `Run.rebuild` call `simulate`. A golden test asserts incremental stepping equals `simulate` at every step.
**When to use:** all quantity, flag, timer and outcome behaviour.
**Event timing rule (define once, test once):** an event with `t` is applied before the step that starts at the first step boundary `T >= t` (events with `t` exactly on a boundary apply at that boundary). Live events always have `t` that is a multiple of `STEP_MS` because the clock only advances in whole steps; recordings with arbitrary `t` (the Phase 2 fixtures use 8000, 15000 ...) therefore replay without change.
**Example (shape only, not final code):**
```typescript
// Source: this research; project conventions from src/engine/clock.ts and src/engine/store.ts
export const STEP_MS = 100;

export interface SimState {
  readonly t: number; // ms, multiple of STEP_MS
  readonly quantities: Readonly<Record<string, number>>;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly timers: Readonly<Record<string, number>>; // remaining ms of one-shot timers, e.g. deice.max_active
  readonly holds: Readonly<Record<string, number>>;  // ms each outcome predicate has held
  readonly outcome: { readonly id: string; readonly t: number } | null;
}

/** Linear lag, deterministic: only + - * /, quantised so replays cannot drift by one ulp. */
export function lag(current: number, target: number, tauMs: number): number {
  const next = current + ((target - current) * STEP_MS) / tauMs;
  return Math.round(next * 100) / 100;
}
```

### Pattern 2: Onset from a recorded seed
**What:** The UI draws `seed = Math.floor(rng() * 2 ** 32)` once at run start; the engine derives `onsetAt = STEP_MS * Math.round((min + u * (max - min)) * 1000 / STEP_MS)` with `u` from a mulberry32 stream of the seed. `Recording` carries both `seed` and the derived `onsetAt` (grade needs `onsetAt`; the seed is provenance and lets a test re-derive it). Easy and medium: `onsetAt = 0` (the failure is present at the start, exactly as in Phase 2). Level itself is never passed to `grade`. [ASSUMED: field names are discretion]

### Pattern 3: Rebuild on retract, markConsumed on fire (D-03 made concrete)
**What:** A latching control tap that is retracted by the double-tap gesture must leave no trace in the live physics. Because the live state is path dependent, `Run` subscribes to `store.onRetract` and re-derives its state with `simulate` over the remaining log up to the current clock time. A one-shot reaction that has fired (the MAX press sets the flag and starts the 120 s timer) calls `store.markConsumed(seq)` for that event, so `retract` then refuses it with `consumed` (the store semantics are verified: `retract` checks `seq <= this.consumed` before `not-last`). [VERIFIED: src/engine/store.ts:147-185, read this session]
**Per-reaction-kind test:** dispatch the event, advance one step so the reaction fires, then `store.retract(seq)` must return `{ ok: false, reason: 'consumed' }`; for an armed but unfired reaction the retract must succeed and the rebuilt state must equal the state of a run that never had the event.
**Note:** continuous physics dependence on a control (power lever to oil temperature) is not a one-shot "reaction"; it needs no watermark because the rebuild removes the event's effect completely.

### Pattern 4: Quantities and flags as the only coupling to the UI
**What:** `bridge.quantities` (already a signal) and a new `bridge.flags` signal are overwritten from the run after each advance (only when a value changed, to avoid re-rendering 12 gauges on a no-op step). The existing `cas` computed reads `quantities.value`; lamps read `flags` (today a constant `{}` at bridge.ts:126). [VERIFIED: src/ui/bridge.ts:98-140]

### Anti-Patterns to Avoid
- **Calling `setTimeout`/`Date.now`/`Math.random` anywhere in `src/engine`:** breaks D-02 and the ESLint boundary.
- **Advancing the clock by raw frame deltas:** the current `clock-driver.ts` advances by arbitrary milliseconds clamped to 1000 ms; physics steps would then depend on frame rate. Use an accumulator and emit whole steps. [VERIFIED: src/ui/clock-driver.ts:41-50]
- **Scenario facts in application code:** physics parameter ids that belong to one scenario (e.g. `oil_cooling`) are aircraft vocabulary and may live in `src/aircraft`, but outcome thresholds, hold times, onset windows and step ids may not appear in `src/engine`, `src/scenario` or `src/ui`; extend `tests/blueprint.test.ts` to derive its literals from every shipped scenario, not only `eng-oil-temp-green.toon`. [VERIFIED: tests/blueprint.test.ts:13-17 reads a single blueprint file]
- **Computing quantity predicates in `grade` from the starting values only:** that is the Phase 2 behaviour (GRADING.md rule 4); with live quantities the replay must use the simulated value at each event time, or steps must stay control-only (see Pitfall 3).
- **A second implementation of the physics for the debrief:** grade and the live run must share `simulate`.

## Simulation design details (planner reference)

### Quantity and physics coverage (D-12: all 12 engine-page gauges)

The Engine page and map strip draw these gauges (specs in `MfdFrame.tsx`; today only the first two oil quantities are bound, the other ten use a fixed `value`). [VERIFIED: src/ui/panel/frames/MfdFrame.tsx:182-376]

| Gauge | Named quantity (proposed id) | Drivers in the model | Notes |
|-------|------------------------------|----------------------|-------|
| RPM | `rpm` | `sw.engine_master`, fuel valve (if present), `lv.power` | engine off gives 0; no prop lever exists |
| Load | `load_pct` | `lv.power` (travel percent), engine running | |
| Oil pres | `oil_pressure_bar` (exists) | engine running, rpm, scenario parameter (later OIL PRES branch deferred) | engine off gives 0 and falls into the red band |
| Oil temp | `oil_temp_c` (exists) | load, `lv.cowl_flap`, parameter `oil_cooling` (scenario fault), fire | main escalation quantity of the blueprint |
| Coolant temp | `coolant_temp_c` | load, cowl flap, fire | |
| Gearbox temp | `gearbox_temp_c` | load, fire | |
| Fuel temp | `fuel_temp_c` | slow drift toward ambient | constant is acceptable |
| Fuel pres | `fuel_pressure_bar` | engine running, fuel valve | |
| Volts | `bus_volts` | alternator outputs, `sw.ess_bus`, `sw.elect_master`, parameter `alt1_output` | |
| Amps | `alt1_amps` (+ `alt2_amps` hidden or second reading) | alternator healthy and switch ON | the gauge shows one reading; which alternator it shows is an open question |
| Fuel qty LH / RH | `fuel_qty_lh`, `fuel_qty_rh` | burn rate from load; `sw.fuel_trans` | linear burn, deterministic |
| (hidden) | `fire_intensity` | parameter `engine_fire`, engine master and fuel valve state | no gauge; used by the Engine Fire outcome predicate so the closed predicate vocabulary does not need a `flag` check |

All ids above are proposals (Claude's discretion). Each needs `min`, `max`, `idle`, `unit` and bands in `quantities.ts`; band numbers for the visible gauges are the AFM 02-05 markings already summarised in the private `.input/afm-notes.md` and already coded as literals in `MfdFrame.tsx`; the planner should move them into `DA50RG_QUANTITIES` (the existing `quantityGauge` helper reads them) so the numbers have one source. [VERIFIED: src/aircraft/da50rg/quantities.ts and MfdFrame.tsx read this session]

**Model shape:** every quantity is `q <- lag(q, target, tau)`; `target` is a small pure function of control state, parameters and flags (for example oil temperature target = base + slope * load - cooling_credit * cowl_open, then scaled by the `oil_cooling` parameter). Physics time constants are compressed (tens of seconds) so a scenario resolves in one to three minutes of run time; the real engine is slower. This is a training-aid choice and should be written into the documents. [ASSUMED: constants]

**Free panel and realistic start use the base state, not idle.** Add `base: settle(registry defaults)` to the physics (the equilibrium of the model at the default controls) and use it for the free panel, for the realistic level start and as the starting point of every run that has no `initial.quantities` entry for a quantity. Reason: quantity `idle` is engine-off (oil pressure 0, amps 0), and Phase 3 CAS rules over pressure and amps would light chips on the panel when no run is active. Consequence for the planner: existing tests that read idle values (`tests/bridge.test.ts:98,124`, `tests/session.test.ts:524`, `tests/predicates.test.ts:63`, `tests/avionics.test.ts:57`) must be updated deliberately. [VERIFIED: grep of tests this session]

### Scenario schema additions (additive, format stays 1)

All fields optional with defaults so Phase 2 files stay valid and `z.strictObject` still catches typos. Field names are discretion; this is the recommended shape:

```
parameters:            # named aircraft parameters the scenario sets (values validated against env.physics ranges)
  oil_cooling: 0.4
onset:                 # used by the realistic level only; easy and medium run with onset at t = 0
  window_s[2]: 5, 20
outcomes[1]:
  - id: engine_failure
    text: Engine failure from overheating     # own words, shown in the debrief
    when:                                     # a normal Predicate over quantities (and controls)
      check: quantity
      quantity: oil_temp_c
      op: gte
      value: 140
    hold_s: 15
```

- `Predicate` is reused unchanged; the closed vocabulary (`state`, `state_in`, `travel`, `travel_rel`, `quantity`, `band`) needs no extension if fire is a hidden quantity. [VERIFIED: src/scenario/schema.ts:39-69]
- Bounds in Zod: `window_s` `[min >= 0, max >= min, max <= a cap]`, `hold_s <= a cap`, `parameters` a record of finite numbers; lint checks each parameter id against `env.physics` and the range. Cap all times so a hostile or sloppy file cannot make `simulate` loop for hours (see Security).
- `source`, `disclaimer` and the `briefing.situation` field stay mandatory. For the realistic level `briefing` is simply not shown.
- **Do not freeze the schema for external authors yet** (STATE.md blocker): CNT-02 is Phase 4, after all three scenarios exist.

### Grading changes (pure, deterministic)

- `Recording` gains optional `onsetAt` (ms, default 0) and `seed`; `grade` still never sees the level. [VERIFIED: GRADING.md states the level is not an input; src/engine/grading.ts:20-25 `Recording` shape]
- `grade` runs `simulate` up to `min(completedAt, outcome time)`. If an outcome fired before `completedAt`, the result is `fail`, `reasons` gets `{ kind: 'outcome', id }` (a new member of the `Reason` union, so `debrief-text.ts` `reasonLine` must handle it; TypeScript exhaustiveness will flag it), and `GradeResult.outcome = { id, text, t }`. Events after the outcome time are ignored (live, the run ends at the outcome, so there are none).
- Steps stay control-only in Phase 3. The instructor said end-state design with physics belongs to Phase 4 (GRADING.md "Instructor review" item 1), so no quantity-based step is added; `decided_at: run` branches stay open and ungraded.
- `GradeResult.timing = { onsetAt, firstActionMs }` where `firstActionMs = t(first recorded event) - onsetAt` (null with no event), and each `StepVerdict` may carry `enteredT` (virtual time of the credited entry, so the debrief can show "n s after onset"). Show timing in the debrief for the realistic level only; no time-limited steps (`within_s` is SES-V2-02, v2). The GRADING.md note that "the limit and its reference point belong with Phase 3" is answered by: no limits in Phase 3, reference point = onset, recorded for display. [CITED: docs/GRADING.md "Instructor review" item 5; .planning/REQUIREMENTS.md SES-V2-02]
- Existing golden fixtures: `completedAt` values and the "JSON-identical result" gates change shape because `GradeResult` grows (`outcome: null`, `timing`). Plan an explicit fixture update task; keep the six Phase 2 recordings passing their original verdicts.

### Session and UI changes

- `Level` gains `'realistic'`; `LevelPick` enables its button (it is `disabled` today; `e2e/scenario.spec.ts:335` asserts `toBeDisabled()` and must be rewritten). Realistic skips the briefing: after the level card the run starts directly, `briefing` text is never shown, and while running nothing may name the scenario (grep the running screen for `scenario.title` use; `App.tsx:105` reads the scenario signal). The debrief already always shows the checklist and names the level, so it reveals the scenario. [VERIFIED: src/ui/screens/LevelPick.tsx, src/ui/App.tsx grep]
- The realistic start state: registry defaults plus `initial.controls` (the situation's configuration, for example cruise power), quantities = physics base, onset at `onsetAt`. Reason: `grade` computes `travel_rel` baselines from `baselineOf(scenario)` = defaults + `initial.controls`; if the realistic panel started from bare defaults the relative steps and the `power_increased` trigger would be measured from a different power than the pilot saw. See Open Question 1.
- `session.start` currently calls `bridge.reset(initial.controls, initial.quantities)` and creates a `VirtualClock`; it becomes: create `Run` (clock + sim) with level-dependent initial quantities and `onsetAt`, hand the bridge the controls, then drive `Run`. `session.complete()` must also be callable by the run when an outcome fires (the run ends, `runClock.pause()`, debrief opens; the debrief modal's input shield already prevents stray panel input).
- `clock-driver.ts` keeps its contract (hidden tab, open modal, MAX_FRAME_STEP clamp) but advances through an accumulator; its fake-clock unit test pattern (`tests/clock-driver.test.ts`) stays valid.
- Add a CSS transition (or nothing) for needle smoothness: gauges receive a new value every 100 ms; `ArcGauge` sets `transform` directly (line 92) so a short linear transition is optional polish (discretion). [VERIFIED: src/ui/panel/frames/ArcGauge.tsx:92]

### De-ice MAX run (D-04)

`btn.deice_max` is a momentary button with states `released`/`pressed`; the press produces a `pressed` event then a `released` event. [VERIFIED: src/aircraft/da50rg/controls/deice.ts:39-50] The sim must trigger on the **event** (a 100 ms poll of state could miss a press-release pair inside one step). Rule (from the todo, read this session): a `pressed` event while `sw.deice_mode` is `high` sets `deice.max_active` and a 120 000 ms timer; the flag clears at timer end or the moment the mode leaves `high`; a later press starts again. Whether a press during an active run restarts it is not specified [ASSUMED: ignored while active]. The lamp `lt.deice_max` already reads the flag and the mode (`indicators.ts`: lit only when flag and mode high; a press alone lights nothing). [VERIFIED: src/aircraft/da50rg/indicators.ts:205-243] Test: press at step k, lamp lit at k+1 through 120 s, dark after; leave HIGH clears at once; after firing `retract` of the press event gives `consumed`.

### Transponder (PNL-07, D-11)

- **Why a new kind:** a momentary key returns to its rest state, so its resulting state cannot carry a digit; `rotary` accepts 2 to 5 stops (`checkRotary`, see registry.ts:~200 doc and the "2 to 5 stops" comment) and has no 4-digit capacity; `Predicate` has no conjunction, so four separate digit controls would need four steps. [VERIFIED: src/engine/registry.ts:154-201 read; momentary semantics in registry.ts:154-160]
- **Recommended:** a `code-entry` control kind (id prefix `sw.` or a new `kp.` prefix; `KIND_PREFIX` must get an entry or the registry check throws) whose store state is the **committed** 4-digit code string from the alphabet `0-7` (4096 legal states, enumerated once for `legalStates`), default `1200`. The widget keeps the partially typed digits in UI-local state (the rotary and lever widgets already keep uncommitted gesture state out of the store) and dispatches once when the fourth digit is entered; a CLR key clears the buffer; a re-entered identical code is `unchanged` (no event). A step is then `{check: state, control: <id>, is: "7700"}` with no predicate change. [ASSUMED: kind name and entry model]
- Keys 0-7 plus CLR are `momentary`-like press targets inside the widget (act on release, 44 px footprint rule at zoom, no zoom on press, per the gesture contract); the display shows the buffer while typing, else the committed code. Display text changing with state is allowed here because it is a glass-style readout of a value, not a switch state word; confirm against owner rule G-0.1 (no state text on switches). [ASSUMED: needs owner nod]
- **Location:** pilot's footroom/legroom (D-11). A new region is needed (the existing `under_panel_left` region is 80 x 120 and holds `lv.alt_static`). The no-overlap, art-fit, tap-size and region gates will cover it; add the control to `tests/layout-reference.ts`, `docs/PANEL-LABELS.md` and `docs/PANEL-REVIEW.md` in the same plan (counts are derived, never literals).
- Which scenario grades it: AFM checklists do not contain a squawk step. Add one **optional** step `squawk_7700` (own wording) to the Engine Fire scenario only; baseline `1200` keeps lint L5 happy (step not satisfied at start). [ASSUMED]

### CAS rules needed (derived, never set)

- Existing: `eng_oil_temp` (warning, `oil_temp_c > 125`).
- `altn_1_fail` (caution, text `ALTN 1 FAIL`, within the 12-character `CAS_TEXT_PATTERN`): the AFM lists ALTN 1 FAIL as a yellow caution cause "engine alternator 1 has failed", and the pocket card in `.input/` shows it in yellow with "AND ALTN 2 FAIL" as the separate double-failure case. [VERIFIED: AFM 03A-01 table and the card image read this session, both private] Rule over a quantity such as `alt1_amps lte` a small value while `sw.alternator_1` is on or off? Whether the message stays after the pilot switches ALTERNATOR 1 OFF is not documented in the AFM text read; recommended: the message persists while the alternator is failed (the failure is a model parameter `alt1_output = 0`, exposed as a quantity), independent of the switch. [ASSUMED] The CAS engine reads only controls and quantities (`CasRuleSpec.when: Predicate`), so the failed state must be a quantity.
- `oil_pres` (warning, `OIL PRES`, outside 2.0 to 7.5 bar) is needed because ENGINE MASTER OFF in the fire scenario drops oil pressure into the red band; it is the natural consequence and keeps the chip logic honest. D-10 says wire only what scenarios need; this one is needed by the fire scenario's own correct action. [ASSUMED]
- `MAX_CAS_CHIPS = 6` and the L10 lint (annunciations list equals the rules firing at start) stay as they are. Engine Fire has **no CAS message** in the AFM table read (no fire annunciation exists); its `annunciations` list is empty and the cue is the briefing text (easy, medium) or the instrument changes (realistic). [VERIFIED: grep of the extracted AFM for fire-related CAS entries showed none]

## AFM source research (D-09)

Source: private `.input/DA50RG_AFM.pdf`, header "AFM DA 50 C, Doc No. 9.01.01-E, Issue 018, 01-Apr-2025" (matches the revision recorded in `docs/CONTENT-POLICY.md` section 4 and the blueprint `source:` block). The PDF is git-ignored and was read via `pdftotext` into the session scratchpad only. The facts below are control names, target states and order (allowed as structured data by CONTENT-POLICY 2(a)); no WARNING, CAUTION or NOTE text is copied. [VERIFIED: pdftotext of .input/DA50RG_AFM.pdf this session]

### Electrical Failure: ALTN 1 FAIL (AFM 03A-02, special operation, abnormal procedures)

Cause per the AFM: engine alternator 1 has failed (caution message ALTN 1 FAIL). Steps in AFM order:
A. Circuit breakers: check all pressed in.
B. ALTERNATOR 1 switch: OFF.
C. ESSENTIAL BUS (the ESS BUS rocker): ON.
D. Bus voltage: monitor.
E. NVFR or IFR operation: terminate, land on the next suitable airfield.

System facts that make the physics defensible (AFM 07-33): alternator 1 feeds the main bus; alternator 2 is not connected to the main bus in normal operation and connects to it when the ESSENTIAL BUS is switched ON (the 03A-02 note says alternator 2 then supplies main and essential bus and charges the battery; equipment tied to alternator 2 such as the air-condition system loses power). Each alternator output passes a current sensor that feeds the Amps indication. [VERIFIED: AFM 07-33 and 03A-02 read this session]

Related but different procedures (do not confuse): 03-06 ALTN 1/2 FAIL (both failed, emergency), 03-28 Complete failure of the electrical system, 03-05 ALTN 1/2 AMPS (output above 70 A). D-08 names "Electrical Failure (ALTN 1 FAIL)" so 03A-02 is the blueprint source; `source.section` should read e.g. `AFM 03A-02 ALTN 1 FAIL`.

**Mapping to registry controls (all exist):** `sw.alternator_1` (default `on`), `sw.ess_bus` (default `off`), `sw.alternator_2`, `sw.elect_master`, `cb.alt1`, `cb.alt2`, `cb.ess_tie`, `cb.main_tie`, `cb.batt` (51 `cb.*` breakers exist). [VERIFIED: registry source files read; control ids in switch-bank.ts and engine.ts]

**Recommended scenario skeleton (subject to instructor review):**
- `initial`: controls at defaults; quantities with `alt1_amps` 0 and `bus_volts` slightly below the battery-supported level; `annunciations: [altn_1_fail]`.
- Graded steps: `alt1_off` (critical, `sw.alternator_1` is `off`), `ess_bus_on` (critical, `sw.ess_bus` is `on`). Group unordered by default (AFM lists B before C; whether the order matters physically is a question for the instructor; mark `ordered`/`order_critical` only if the instructor says so, see Open Question 4).
- Step A (breaker check) is already satisfied at start, so lint L5 forbids it as a graded step; keep it as a `line`. If the scenario cause is a tripped `cb.alt1` instead, "reset" would be graded; the AFM text read does not describe a breaker-trip cause, so keep the alternator failure internal.
- Lines (ungraded): monitor bus voltage; terminate NVFR or IFR and land on the next suitable airfield.
- Forbidden candidates (instructor to confirm, each `fails_run` or report-only): `sw.alternator_2` to `off` (leaves the aircraft with no alternator), `sw.elect_master` to `off` (removes battery power).
- Escalation (outcome, scenario data): ignoring the failure leaves the main bus on the battery; bus voltage decays below the red band and after a hold time the outcome names total loss of main-bus power. The real battery endurance is about half an hour per the AFM 03-06 warning for the double failure; the sim compresses it. [ASSUMED: outcome name, threshold, hold]

### Engine Fire in Flight (AFM 03-33)

Steps in AFM order, as target states:
A. CIRCULATING AIR: OFF / FRESH AIR (registry: `lv.env_circ`, details below).
B. ECS shut-off: PULL.
C. Select an appropriate emergency landing area (non-panel).
D. ENGINE MASTER: OFF (`sw.engine_master`, default `on`).
E. FUEL valve: OFF.
F. ELECT. MASTER: OFF (`sw.elect_master`, default `on`).
G. Airspeed: as required if possible; a faster airspeed may help put the fire out (non-panel).
H. Emergency windows: open if required.
I. Perform an emergency landing without engine power (the procedure refers to 03-41).
After the aeroplane has stopped: J. doors open, K. evacuate immediately (non-panel; outside a flying panel trainer).
Also in the AFM: the AFM ECS description (section 07, pages 07-36/37) says the ECS shut-off valve knob isolates the cabin at the main bulkhead and the recirculating valve must stay in FRESH air with the FAN off. [VERIFIED: AFM 03-33, the ECS description and 07-30 read this session]

**Registry gaps (blocking for a faithful scenario):**
| AFM item | Registry today | Finding |
|----------|----------------|---------|
| ENGINE MASTER OFF | `sw.engine_master` exists | usable |
| ELECT. MASTER OFF | `sw.elect_master` exists | usable |
| CIRCULATING AIR FRESH | `lv.env_circ` exists, states `fresh`/`recirc`, **default `fresh`** | a step "set fresh" is already satisfied at start; lint L5 rejects it. Author `initial.controls: lv.env_circ: recirc` so the step is meaningful |
| FAN | `sw.env_fan` exists (knob with stops, "off" present) | AFM says FAN off with the shut-off pulled; optional |
| FUEL valve (3 positions NORMAL, EMERGENCY, OFF, handle must be lifted to change) | **no control** | AFM 07-30: handle is in the centre console behind the trim wheel; position not visible in any `.input/` photo seen this session |
| ECS shut-off (pull knob) | **no control** | location not found in the photos or panel-label tables; the AFM says it seals the cabin at the main bulkhead |
| Emergency windows | **no control** | the step is conditional ("if required"); keep as an ungraded line |

[VERIFIED: grep of src/aircraft/da50rg/controls/*.ts and docs/PANEL-LABELS.md found no fuel-valve, ECS or window control; photos `center_lower_pedestal.jpg` and `DA50_virtual.jpg` viewed this session show neither]

**Recommendation:** add `lv.fuel_valve` (detent lever: `normal`, `emergency`, `off`; drag or marker taps; a "lift to change" nuance can be a plain lever for now) and `lv.ecs_shutoff` (two detents `in`, `pulled`, existing `pull-t`/`pull-boot` skin) as registry data, **placed by an owner decision** (layout fidelity is the core value and photo-derived positions are the project rule; list them in `docs/PANEL-LABELS.md` as "assumed position, to confirm" and give the owner the short list in chat). Fallback if the owner cannot supply positions in time: Engine Fire grades only ENGINE MASTER, ELECT. MASTER and CIRCULATING AIR, with the fuel valve and ECS shut-off as ungraded lines; this is a documented MVP simplification, not a silent one.

**Recommended skeleton:**
- `briefing.situation`: own-words description of smoke and flames from the engine bay in cruise. `annunciations: []`. `initial.controls`: `lv.env_circ: recirc`.
- Graded steps (critical unless the instructor says otherwise): `circ_air_fresh`, `ecs_pulled` (if the control exists), `engine_master_off`, `fuel_off` (if the control exists), `elect_master_off`; optional: `squawk_7700`.
- Order: AFM lists engine master before fuel before electrical master; a physical reason for ordering exists (shutting the electrical master first can lose the ECU before the fuel is cut). Whether the group is `ordered` and `order_critical` is an instructor question (Open Question 4); the wrong-order replay test needs one ordered group in at least the scenario that declares it (the Phase 2 pattern uses a synthetic `ordered-critical.toon` fixture; do the same for the new scenarios if they are unordered).
- Forbidden candidates: `lv.power` increased is not in the AFM but is a sensible harmful action; `lv.cowl_flap` and `sw.fuel_trans`/`sw.emerg_fuel_pump` ON (feeds the fire) [ASSUMED, instructor review]. Keep the forbidden list short and instructor-approved.
- Escalation outcome: `fire_intensity` at or above a high value for a hold time, named in the debrief (for example "fire spreads"). ENGINE MASTER OFF plus FUEL valve OFF decays it (physics), so a correct run also shows recovery on the gauges before the pilot declares completion. [ASSUMED: names, thresholds]
- No CAS message exists for fire; the realistic level therefore needs an onset cue that is not a CAS chip. The physics supplies one (oil and coolant temperature spike, oil pressure change); whether an additional short own-words onset notice is allowed against D-05 "nothing else shown" is Open Question 2.

### Oil Temp High (exists)
`scenarios/engine/eng-oil-temp-green.toon` stays the blueprint: AFM 03-08, branch on OIL PRES, green branch graded (reduce power at least 10 percent of travel, open cowl flap), forbidden `power_increased` with `fails_run: true`. It gains `parameters` (degraded oil cooling), `onset` and one `outcomes` entry. [VERIFIED: scenarios/engine/eng-oil-temp-green.toon read]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scenario file validation of new fields | ad-hoc checks | existing Zod `z.strictObject` + `lint.ts` rules + `checkScenario` (one check for app and `npm run validate`) | typos and bad references already fail with line:col |
| Referencing quantities, bands, controls from a scenario | string expressions | existing `Predicate` union and `evaluatePredicate` | closed vocabulary; no `eval`; the Engine Fire outcome uses a hidden quantity instead of extending the vocabulary |
| Derived CAS chips and lamps | setting messages from scenario or sim code | `defineCasRules` rules over quantities and controls; `evaluateIndicator` with flags | L10 already guarantees scenario and rules agree |
| Retract handling for reactions | timers cancelled by hand | `PanelStore.retract`/`markConsumed`/`onRetract` plus rebuild by replay | semantics already tested; replay makes cancellation trivial |
| Time | `setTimeout`, `performance.now` in the engine | `VirtualClock` advanced by whole steps from the UI | SCN-08, D-02 |
| Randomness in grade | `Math.random` | seed recorded in the run + mulberry32 in the engine | determinism of replays |
| Gauge geometry and bands | new gauge code | `ArcGauge`/`BarGauge` and `quantityGauge(label, quantity)` | already bound to quantities |

**Key insight:** the cost of this phase is not new infrastructure but keeping one deterministic code path. Every shortcut that gives the live UI its own state or its own arithmetic breaks replay identity and the golden tests.

## Common Pitfalls

### Pitfall 1: Float drift between browser and node replays
**What goes wrong:** the live run and `grade` disagree about the step at which a threshold is crossed, so the outcome time differs by one step or the verdict flips.
**Why it happens:** `Math.exp`, `Math.pow` and friends are not specified to be bit-identical across JS engines; accumulated differences cross a threshold in different steps.
**How to avoid:** use only `+ - * /`, precompute `k = STEP_MS / tau`, quantise to 0.01 after each step, compare against thresholds with `>=`; a golden test runs the same recording through `simulate` and through incremental `stepSim` and compares the full trace; keep outcome thresholds away from natural equilibria so a 0.01 difference cannot matter.
**Warning signs:** a golden trace test that passes in node but an e2e replay that grades differently.

### Pitfall 2: Retract after the sim already used the event
**What goes wrong:** a double-tap retract removes a latching event from the log while the live quantities already moved toward the new target; the grade (replay of the log) and the screen disagree.
**How to avoid:** `Run` rebuilds by replay on `onRetract` (Pattern 3); `markConsumed` only for fired one-shots; test both directions.

### Pitfall 3: Quantity predicates in steps with live quantities
**What goes wrong:** a step such as "oil temp back in green" depends on the replay time of evaluation, making the verdict sensitive to completion time; GRADING.md rule 4 says quantities do not change during a run.
**How to avoid:** keep steps control-only in Phase 3 (instructor: Phase 4), update GRADING.md rule 4 to say that quantities are simulated for outcomes only, and keep `decided_at: run` branches ungraded.

### Pitfall 4: Free-panel idle values light CAS chips
**What goes wrong:** a new `altn_1_fail` or `oil_pres` rule fires on the free panel because idle `alt1_amps` and `oil_pressure_bar` are 0.
**How to avoid:** free panel and realistic start use the physics base; migrate the tests listed above.

### Pitfall 5: Lint L5 and L10/L11 versus the realistic level
**What goes wrong:** lint evaluates the failure state (`initial.quantities`), the realistic run starts from base; an author expects them to be the same.
**How to avoid:** document that `initial.quantities` is the state **at the start of easy and medium runs** and the reference of branch decisions at start; realistic runs start from base and reach that state through the onset ramp. A new lint rule should warn if the physics settled state under the scenario `parameters` is not in the same CAS-firing class as `initial.quantities` (the onset would then never produce the annunciation the file claims).

### Pitfall 6: A do-nothing run must fail on every level, including realistic
**What goes wrong:** a realistic run where the pilot waits and completes before `onsetAt` never sees the failure. Critical steps stay graded from the start (R3), so do-nothing still fails by missing steps, but the **outcome** has not fired; that is fine, and the debrief must still list the missed steps.
**How to avoid:** the do-nothing test per scenario asserts FAIL by `critical_missed`, and a separate test with a long `completedAt` asserts the outcome time.

### Pitfall 7: The 4096-state transponder in generic registry code
**What goes wrong:** `legalStates` and `checkDistinctStates` allocate and scan 4096 ids per call; widgets or tests that call `legalStates` in a loop get slow; the test hook `window.__panel.legal()` serialises all of them.
**How to avoid:** memoise the enumeration per control, special-case the `code-entry` kind in the hook, and keep `dispatch` validation by a cheap pattern check.

### Pitfall 8: Content policy and the AFM
**What goes wrong:** copying AFM wording (notes, warnings) into scenario `briefing`, outline text or this research.
**How to avoid:** step lines at most 12 words, own words for every explanation; `source` carries document, issue, section, verified date; `tests/content-policy.test.ts` already gates it. The AFM and photos in `.input/` stay private; this document contains facts only. [VERIFIED: docs/CONTENT-POLICY.md read]

### Pitfall 9: Blueprint gate covers only one scenario
**What goes wrong:** the two new scenarios' ids and thresholds can leak into `src/` without the gate noticing.
**How to avoid:** generalise `tests/blueprint.test.ts` to derive literals from every file under `scenarios/`, including the new outcome ids and thresholds, and keep `src/aircraft` and `scenarios/` as the only allowed homes.

### Pitfall 10: More than four scenarios in the chooser
The choose view lists at most four rows (`maxRows` 4 in `session-area.ts`). Three scenarios fit; note for Phase 4. [VERIFIED: src/ui/panel/session-area.ts:25-47]

## Code Examples

### Event timing rule in the replay loop (shape)
```typescript
// Source: this research. Applies events at the first step boundary at or after their time.
export function simulate(env, scenario, input: { events: readonly RecordedEvent[]; onsetAt: number; untilMs: number }) {
  let state = initSim(env, scenario, input.onsetAt);
  const controls = baselineOf(scenario, env.registry); // existing helper, src/engine/predicates.ts
  let next = 0;
  while (state.t < Math.min(input.untilMs, MAX_RUN_MS) && state.outcome === null) {
    const due: RecordedEvent[] = [];
    while (next < input.events.length && (input.events[next]?.t ?? Infinity) <= state.t) {
      const event = input.events[next++];
      if (event !== undefined) { controls[event.id] = event.value; due.push(event); }
    }
    state = stepSim(env, scenario, state, controls, due);
  }
  return state;
}
```

### Seeded onset (mulberry32, known-answer test required)
```typescript
// Source: public-domain mulberry32; implementation kept in src/engine/sim.ts
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```
[ASSUMED: algorithm from training knowledge; verify with a fixed-seed known-answer test, not against the internet]

### Clock driver accumulator (shape)
```typescript
// Source: this research; extends src/ui/clock-driver.ts frame()
let carry = 0;
// inside frame(), when running and not paused:
carry += Math.min(Math.max(elapsed, 0), MAX_FRAME_STEP_MS);
const steps = Math.floor(carry / STEP_MS);
carry -= steps * STEP_MS;
for (let i = 0; i < steps; i += 1) run.step(); // run advances its VirtualClock by STEP_MS each time
```
Reset `carry` to 0 when a run starts, so the first event time is a multiple of `STEP_MS`.

## State of the Art

| Old Approach (Phase 2) | Current Approach (Phase 3) | Impact |
|------------------------|----------------------------|--------|
| Quantities fixed per run, set at `reset` | Quantities simulated by `stepSim`, fed to the bridge each step | gauges move, CAS chips appear and clear |
| Grade reads controls only | Grade also derives an outcome and timing from the same replay | FAIL by escalation, reaction time |
| Level = display state (easy, medium) | plus `realistic` (no briefing, seeded onset) | `Level` type, session flow, LevelPick, e2e spec change |
| `flags` constant `{}` in the bridge | flags signal from the run | MAX lamp works; gear transit remains deferred |
| `retract` guarded by an unused watermark | watermark raised when a one-shot reaction fires; rebuild on retract | D-03 |

**Deprecated within this repo:** the comment "no reaction exists yet" in `store.ts` (markConsumed seam), the "Plausible engine-off idle reading (D-11); live values arrive with PNL-04" comment in `MfdFrame.tsx`, GRADING.md rule 4 sentence "quantities do not change during a run in this version", and `session.ts`'s statement that Realistic is "shown but not yet available".

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Physics constants (time constants, equilibrium slopes, compressed time scale) | Simulation design | Gauges feel wrong or scenarios resolve too fast/slow; tunable data, low structural risk |
| A2 | ALTN 1 FAIL message persists while the alternator is failed, also after ALTERNATOR 1 is switched OFF | CAS rules | Chip clears too early or too late vs the real aircraft; instructor must confirm |
| A3 | With alternator 1 failed and ESS BUS off, the main bus is battery-supported and bus voltage decays; ESS BUS ON restores via alternator 2 | AFM source research | Model deviates from the real schematic (the figure was not readable in the text extraction) |
| A4 | Outcome names, thresholds and hold times for the three scenarios | scenario skeletons | Debrief wording and escalation timing need instructor review |
| A5 | New control kind named `code-entry`, commit-on-fourth-digit entry model, default code `1200` | Transponder | Naming only; entry model could differ from what the owner imagines |
| A6 | A readout of the entered code on the transponder does not violate owner rule G-0.1 | Transponder | Owner may require a static look; low cost to change |
| A7 | Fuel valve and ECS shut-off controls are added with an owner-confirmed position | AFM source research | If positions cannot be confirmed the fire scenario grades fewer panel steps |
| A8 | Forbidden candidates for Electrical and Fire scenarios | scenario skeletons | Instructor may disagree; start with the smallest list |
| A9 | Whether a MAX press while active restarts the 120 s run | De-ice MAX | Edge behaviour only |
| A10 | mulberry32 implementation text | Code examples | Caught by the known-answer test written with the code |
| A11 | Realistic start applies `initial.controls` as well as registry defaults | Session and UI | Mismatch with D-05 reading; see Open Question 1 |

## Open Questions

1. **What exactly is "base panel state" at the start of a realistic run?**
   - Known: D-05 says base panel state, nothing else shown; grade measures `travel_rel` and forbidden triggers from `defaults + initial.controls`.
   - Unclear: whether the scenario's `initial.controls` (e.g. power 75 percent) are part of the invisible base.
   - Recommendation: apply `initial.controls` at start in all levels (documented), keep them non-revealing, and have lint warn if a realistic-eligible scenario sets a control whose state itself announces the failure.
2. **Onset cue for scenarios with no CAS message (Engine Fire).**
   - Known: the AFM table has no fire annunciation; D-05 forbids briefing text.
   - Unclear: whether a transient own-words notice at onset is acceptable.
   - Recommendation: rely on the instrument spike first; ask the owner whether an optional `onset.cue` line is allowed for realistic runs.
3. **Positions of the FUEL valve and the ECS shut-off knob** (see registry gaps). Needs an owner decision or the fallback grading.
4. **Order and forbidden items for the two new scenarios** need the DA50 instructor (the owner is the instructor per 02.1-OWNER-INPUT.md); until then default unordered with a short forbidden list.
5. **Which alternator does the single Amps gauge show?** The MFD has one Amps gauge; the AFM has ALTN 1 and ALTN 2 AMPS messages. Recommendation: two quantities, the gauge shows alternator 1 (the main-bus alternator), alternator 2 is hidden.
6. **Gear transit timing flag** (`gear.in_transit`, requirement text of PNL-14 mentions Phase 3) is not listed in D-04; recommended: leave deferred and say so in the plan.
7. **Pack layout:** put Engine Fire in the `engine` pack and Electrical in a new `electrical` pack, or all three in one pack? Either works with the per-pack chunk glob; recommend `engine` (oil temp, fire) plus `electrical` so pack titles stay meaningful.
8. **GRADING.md and CLAUDE.md wording** must be updated (quantities simulated; level still not an input; outcome rule R10, timing). Include in the documents plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, vitest | yes | v26.12.0 (engines field allows `>=26`) | - |
| npm packages | all | yes | pinned in package.json; `node_modules` present | - |
| Vitest | unit tests | yes | 5.0.5, 44 files / 2192 tests pass | - |
| Playwright browsers | e2e | assumed installed (project ran e2e in earlier phases) [ASSUMED: not probed this session] | 1.64.1 | run chromium projects only |
| pdftotext | reading the private AFM | yes | /opt/homebrew/bin/pdftotext | read PDF pages with the Read tool |
| `.input/` private sources | AFM, photos | yes, git-ignored (`git check-ignore .input` confirmed) | - | - |

No external service, no network dependency; no blocking missing dependency.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json`. [VERIFIED: config read this session]

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.5 (node environment) for engine, schema, lint, replay; Playwright 1.64.1 for flows |
| Config file | `vite.config.ts` (vitest key), `playwright.config.ts` |
| Quick run command | `npx vitest run tests/sim.test.ts tests/grading.test.ts tests/scenario-lint.test.ts` (file names for the new tests are proposals) |
| Full suite command | `npm run typecheck && npm run lint && npx vitest run && npm run validate` (then `npm run build:e2e` and `npx playwright test --project=desktop-chromium` for flows; full 3-project and WebKit only at the end of a round per the owner's working style) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCN-06 | `stepSim` is deterministic: incremental stepping equals `simulate` at every step; same seed gives same onset; known-answer PRNG | unit | `npx vitest run tests/sim.test.ts` | Wave 0 |
| SCN-06 | Onset: no quantity change from the fault before `onsetAt`; realistic start equals base state | unit | same | Wave 0 |
| SCN-06 | Outcome fires after `hold_s` and only if the predicate holds continuously; the debrief reason and `GradeResult.outcome` | unit | `npx vitest run tests/grading.test.ts` | extend |
| SCN-06 | Retract rules: armed unfired reaction cancelled by retract (state equals a run without the event); after firing `retract` gives `consumed` | unit | `npx vitest run tests/run.test.ts` | Wave 0 |
| SCN-06 | De-ice MAX: flag for 120 s, lamp via bridge flags, clears on leaving HIGH, press alone lights nothing | unit | `npx vitest run tests/run.test.ts tests/indicators.test.ts` | Wave 0 / extend |
| SCN-06 | Fixed-step driver: whole steps only, remainder carried, hidden tab and modal pause | unit | `npx vitest run tests/clock-driver.test.ts` | extend |
| PNL-04 | Every engine-page gauge is bound to a named quantity and follows `bridge.quantities`; band colours come from quantity data | unit | `npx vitest run tests/avionics.test.ts tests/bridge.test.ts` | extend |
| PNL-04 | Oil temperature ramps up after start and falls after power reduction plus cowl flap open (physics regression with numbers from the aircraft data, not literals in tests: derive from the model) | unit | `npx vitest run tests/physics.test.ts` | Wave 0 |
| PNL-04 | Gauge needle moves on the real build during a run | e2e | `npx playwright test e2e/run-reaction.spec.ts --project=desktop-chromium` | Wave 0 |
| PNL-07 | Transponder: 4 digits commit one event; CLR; `1200` default; step `state is 7700` credited; layout gates (region, tap size, no overlap) | unit + e2e | `npx vitest run tests/xpdr.test.ts tests/layout.test.ts` ; `npx playwright test e2e/xpdr.spec.ts` | Wave 0 |
| CNT-01 | Each of the three scenarios: `npm run validate` clean; golden PASS, do-nothing FAIL, wrong-order FAIL, forbidden FAIL replays; outcome case for do-nothing with long `completedAt` | unit | `npx vitest run tests/grading.test.ts tests/packs.test.ts` ; `npm run validate` | extend |
| CNT-01 | Pack lists three scenarios; NEW SITUATION and CHOOSE SITUATION reach each; blueprint gate covers all scenarios | unit + e2e | `npx vitest run tests/blueprint.test.ts tests/packs.test.ts` ; `npx playwright test e2e/scenario.spec.ts` | extend |
| (criterion 1a) | Realistic level: no briefing, onset within the window, reaction time from onset, scenario revealed in debrief | e2e + unit | `npx playwright test e2e/scenario.spec.ts` (rewrite the disabled-Realistic case); `npx vitest run tests/session.test.ts` | extend |

### Sampling Rate
- **Per task commit:** `npm run typecheck` plus the one or two affected vitest files (owner prefers targeted tests).
- **Per wave merge:** `npx vitest run` and `npm run validate`, plus the affected Playwright specs on `desktop-chromium`.
- **Phase gate:** typecheck, lint, format check, full Vitest, `npm run validate`, production build, chromium projects (desktop, phone, tablet), one WebKit attempt, live-conditions rehearsal as in earlier phases; full suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/sim.test.ts` — determinism, onset, outcomes, mulberry32 known answer, incremental equals replay
- [ ] `tests/run.test.ts` — Run with store: retract rebuild, `markConsumed`, MAX run
- [ ] `tests/physics.test.ts` — definePhysics validation, base state, per-quantity response directions
- [ ] `tests/xpdr.test.ts` — code-entry control, entry buffer logic, registry, layout reference rows
- [ ] `e2e/run-reaction.spec.ts`, `e2e/xpdr.spec.ts` — flows on the production build (`@hooks` tagged where they read `window.__panel`); the `__panelSession` hook may need `quantities()` and `outcome()` accessors
- [ ] Fixtures: new recordings per scenario in `tests/fixtures/recordings.json` and a synthetic ordered-critical copy per new scenario if the real file is unordered
- [ ] Update: `tests/bridge.test.ts`, `tests/session.test.ts`, `tests/predicates.test.ts`, `tests/avionics.test.ts` (idle to base), `tests/blueprint.test.ts` (all scenarios), `e2e/scenario.spec.ts:335` (Realistic enabled)

## Security Domain

> `security_enforcement` is true, ASVS level 1. The owner prefers MVP first and no unsolicited security audits; this section only records the applicable controls. [VERIFIED: config read; MEMORY.md mvp-first-defer-audits]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | static site, no accounts |
| V3 Session Management | no | none |
| V4 Access Control | no (PackProvider/AccessPolicy seam unchanged, open in v1) | existing seam |
| V5 Input Validation | yes | Zod `z.strictObject` for the new scenario fields; lint cross-references; numeric caps |
| V6 Cryptography | no | none (seed is not security-relevant; PRNG is for reproducibility) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Scenario file with huge `hold_s`, window or `parameters` making `simulate` loop for hours (denial of service in the browser) | Denial of service | Zod max bounds, `MAX_RUN_MS` cap inside `simulate`, lint rules |
| Prototype keys (`__proto__`, `constructor`) in `parameters` records or outcome ids | Tampering | read records only with `Object.hasOwn` as `predicates.ts` already does; `z.record` keys validated by ID pattern |
| Expression strings in scenario files | Elevation of privilege | none added; `Predicate` stays closed, no `eval` |
| Committing AFM text or photos | Information disclosure (copyright) | CONTENT-POLICY gates; `.input/` git-ignored (confirmed); `tests/content-policy.test.ts` |
| Recording with unknown control id or foreign scenario | Tampering | `grade` already throws; `simulate` must too |

## Sources

### Primary (HIGH confidence, read this session)
- `/Users/pascalbetz/projects/procedure-trainer-da-50/src/engine/{store,clock,quantities,cas,predicates,grading,env,indicators,registry}.ts` - existing seams, store retract semantics, grade rules
- `/Users/pascalbetz/projects/procedure-trainer-da-50/src/scenario/{schema,lint,packs-vite}.ts`, `scenarios/engine/*.toon` - format 1, lint rules L4-L11, blueprint
- `/Users/pascalbetz/projects/procedure-trainer-da-50/src/ui/{session,bridge,clock-driver,App}.ts*`, `screens/{LevelPick,Debrief}.tsx`, `debrief-text.ts`, `panel/frames/{MfdFrame,CasChips,ArcGauge}.tsx` - UI integration points
- `/Users/pascalbetz/projects/procedure-trainer-da-50/src/aircraft/da50rg/**` - controls, quantities, CAS, indicators, regions
- `/Users/pascalbetz/projects/procedure-trainer-da-50/docs/{GRADING,CONTENT-POLICY,PANEL-LABELS}.md`, `.planning/todos/pending/*.md`, `.planning/phases/03-*/03-CONTEXT.md`, `02.1-OWNER-INPUT.md`
- `.input/DA50RG_AFM.pdf` (private, AFM DA 50 C, Doc 9.01.01-E, Issue 018, 01-Apr-2025): sections 03A-02, 03-33, 03-06, 03-28, 03-05, 03-04/03A-01 CAS tables, 07-33 electrical, 07-30 fuel valve, ECS shut-off description; `.input/cas-warnings-table-card.jpg`, `.input/center_lower_pedestal.jpg`, `.input/DA50_virtual.jpg` (private)
- `npx vitest run` result: 44 files, 2192 tests passed

### Secondary (MEDIUM confidence)
- `.input/afm-notes.md` (private summary of the AFM engine markings and procedure pointers)

### Tertiary (LOW confidence)
- Training knowledge for mulberry32 and floating-point portability remarks (to be pinned by tests, not trusted)

No web research was needed: the phase uses no new library and no external API. The `research-plan` seam was not used for that reason.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no change, verified from package.json
- Architecture (sim, replay, retract, bridge integration): HIGH on constraints (read the code), MEDIUM on exact module split (discretion)
- AFM procedures: HIGH for ALTN 1 FAIL and Engine Fire step lists (read from the AFM); MEDIUM for the electrical schematic effects (figure not readable in text extraction)
- Physics constants, CAS persistence, outcome thresholds, forbidden lists: LOW (assumptions, instructor review)
- Pitfalls: HIGH for those grounded in code (clock driver, idle values, one-blueprint gate, predicate vocabulary), MEDIUM for float portability

**Research date:** 2026-10-22
**Valid until:** 2026-11-21 (stable in-repo domain; re-check if Phase 2.x code changes before planning)

## Project Constraints (from CLAUDE.md)

- Engine (`src/engine`) is pure TypeScript: no DOM, no framework, no clock, no timers, no `Math.random`; ticks come from the UI with an injected clock (ESLint boundary).
- No scenario fact (id, step, control id of a step, CAS message or threshold) may appear in `src/engine`, `src/scenario` or `src/ui`; `tests/blueprint.test.ts` derives the list from the shipped scenario. Physics constants belong in `src/aircraft/da50rg`.
- Counts are derived from independent reference tables in `tests/`, never literals; new controls need rows in `tests/layout-reference.ts`, `docs/PANEL-LABELS.md`, `docs/PANEL-REVIEW.md`.
- Data-driven registry: a control is data with a `kind` and a skin; widgets, hit footprints, labels and tests read the registry; control state lives in the store, never in the DOM.
- Owner rules (G-0): static labels only (state shows by position or lamp), lamps only where the original has one, parts stay inside their plates; unknown real labels go to the owner as a short list.
- Brand rule: panel reads GO-AROUND, no maker names, no RUBIN mark; DA50RG kept.
- No real photos or AFM text committed; `.input/` is private and git-ignored; content limits in `docs/CONTENT-POLICY.md` (step lines at most 12 words, paraphrase explanations).
- Gesture contract (PNL-15): controls act on release, single tap never zooms, double tap on a latching control zooms and retracts the first actuation, momentary buttons commit after 100 ms and never zoom, drag controls start at 4 px; the transponder keys must follow it.
- Tests: Vitest in node environment for pure cases, Playwright specs hit the production build; specs reading `window.__panel` carry `@hooks`; `PW_PORT` for parallel worktrees.
- Scenario files: TOON format 1, hand-written (library encoder drops comments), `npm run validate` prints `file:line:col: message`; CI and unit tests load every shipped file.
- Pins: TypeScript 6.0.x, `@toon-format/toon` 4.4.0 exact, zod 4.6.7; no new dependency without the legitimacy gate.
- Git: phase branches `gsd/phase-NN-slug`; Conventional Commits with plan id as scope; nothing is pushed by agents.
- GSD workflow: repo edits go through a GSD command; owner working style is token-lean (targeted tests, full suites at round end; publish only after explicit yes).
