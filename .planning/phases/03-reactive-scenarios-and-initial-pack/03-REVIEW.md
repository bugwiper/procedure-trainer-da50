---
phase: 03-reactive-scenarios-and-initial-pack
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - eslint.config.js
  - scenarios/electrical/elec-altn1-fail.toon
  - scenarios/electrical/pack.toon
  - scenarios/engine/eng-fire-in-flight.toon
  - scenarios/engine/eng-oil-temp-green.toon
  - scenarios/engine/pack.toon
  - src/aircraft/da50rg/aircraft.ts
  - src/aircraft/da50rg/cas.ts
  - src/aircraft/da50rg/controls/knobs.ts
  - src/aircraft/da50rg/controls/pedestal.ts
  - src/aircraft/da50rg/controls/squawk.ts
  - src/aircraft/da50rg/controls/under-panel.ts
  - src/aircraft/da50rg/indicators.ts
  - src/aircraft/da50rg/panel.ts
  - src/aircraft/da50rg/physics.ts
  - src/aircraft/da50rg/placards.ts
  - src/aircraft/da50rg/plates.ts
  - src/aircraft/da50rg/quantities.ts
  - src/engine/env.ts
  - src/engine/grading.ts
  - src/engine/physics.ts
  - src/engine/predicates.ts
  - src/engine/quantities.ts
  - src/engine/registry.ts
  - src/engine/run.ts
  - src/engine/sim.ts
  - src/engine/store.ts
  - src/scenario/lint.ts
  - src/scenario/schema.ts
  - src/ui/App.tsx
  - src/ui/bridge.ts
  - src/ui/clock-driver.ts
  - src/ui/debrief-text.ts
  - src/ui/panel/ControlWidget.tsx
  - src/ui/panel/code-entry.ts
  - src/ui/panel/frames/ArcGauge.tsx
  - src/ui/panel/frames/BarGauge.tsx
  - src/ui/panel/frames/MfdFrame.tsx
  - src/ui/panel/skins/LeverHandles.tsx
  - src/ui/panel/viewport.ts
  - src/ui/panel/widgets/CodeEntry.tsx
  - src/ui/panel/widgets/DetentLever.tsx
  - src/ui/panel/widgets/Rotary.tsx
  - src/ui/screens/Debrief.tsx
  - src/ui/screens/LevelPick.tsx
  - src/ui/session.ts
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** standard
**Files Reviewed:** 46
**Status:** issues_found

## Summary

The engine, the physics, the three shipped scenarios and the session layer were read in full and the
interesting claims were checked by running the real engine (a throwaway Vitest probe in the
scratchpad, outside the repo; no source file was touched). The design is coherent: one stepper serves
the live run and the replay, the event timing rule is applied identically in `Run.step` and
`simulate`, the retract/rebuild path is consistent, and no scenario fact leaked into `src/engine`,
`src/scenario` or `src/ui` in the reviewed files. No purity-rule violation (`Math.random`, `**`,
`Math.pow`, timers) was found in the engine code.

The real problems are in what the engine does not model or guard:

- The level Realistic can be passed by doing the checklist before the failure starts (verified).
- The fixed 0.01 quantisation makes every slow lag model stall up to 3 degrees short of its target
  (verified), which makes the minimal correct answer of the oil temperature scenario unable to reach
  the green range.
- The rAF loop of the clock driver dies for good on one exception.

No structural (fallow) findings were supplied for this review.

## Critical Issues

### CR-01: Realistic level grades actions done before the failure begins (free PASS)

**File:** `src/engine/grading.ts:240-267` (replay and credit), `src/engine/grading.ts:314-320` (timing)
**Issue:** `grade()` replays the whole log from t 0 and credits a step whenever its `done`
predicate holds after the last event, whatever the event time. In a Realistic recording
(`recording.onset` set) nothing looks at `onset.at`. A pilot who simply performs the whole checklist
in the first seconds, before the onset, gets full credit for it, and because the fuel is cut before
the fire starts, the simulation never escalates, so there is no outcome either. Verified with the
real engine: `eng-fire-in-flight`, Realistic, onset at 20 s, events at t 100 to 500 ms
(circ air fresh, ECS pulled, ENGINE MASTER off, FUEL valve off, ELECT MASTER off), completedAt 60 s
returns `result: pass`, `reasons: []`, `timing.firstActionMs: null`. The debrief would show PASS and
the line "No action after the onset." together. The same works for `elec-altn1-fail` (ESS BUS on and
ALTERNATOR 1 off at t 0) and for the oil scenario (power down and cowl open at t 0). That defeats
the purpose of the level (reacting to a failure you cannot predict) and the core value (accurate,
objective feedback).
**Fix:** When `recording.onset` is present, a step must not be credited by state that was reached
before the onset. For example, in the replay loop, at the first event with `event.t >= onsetAt` (and
once more at the end if there is none) mark every tracked step that currently holds as `preempted`;
a preempted step is credited again only after its predicate has gone false and true again. Report a
preempted critical step as missed, or add a dedicated reason. Sketch:

```ts
const onsetAt = recording.onset?.at ?? 0;
let crossed = onsetAt === 0;
const preempted = new Set<string>();
const cross = () => {
  if (crossed) return;
  crossed = true;
  for (const e of tracked) if (e.entered !== null) { preempted.add(e.step.id); e.entered = null; }
};
events.forEach((event, index) => {
  if (event.t >= onsetAt) cross();
  /* ...apply the event... */
  for (const entry of tracked) {
    const holds = evaluatePredicate(entry.step.done, ctx, env);
    if (!holds) { entry.entered = null; preempted.delete(entry.step.id); }
    else if (!preempted.has(entry.step.id)) entry.entered ??= index;
  }
});
cross(); // a log that ends before the onset
```

Add a grading test for the pre-onset checklist case.

## Warnings

### WR-01: Lag models stall up to 3 degrees short of their target (0.01 quantisation vs slow time constants)

**File:** `src/engine/sim.ts:219-229` (affects every `lag` model in `src/aircraft/da50rg/physics.ts:317-339`)
**Issue:** After each 100 ms step the new value is rounded to 0.01. A lag step is
`(target - current) * STEP_MS / tauMs`; once that is below 0.005 the rounding returns the old value
and the quantity freezes. The frozen gap is `0.005 * tauMs / STEP_MS`: 3.0 degrees for the 60 s
models (oil temperature, gearbox, fuel temperature), 2.0 for coolant (40 s), 1.5 for the fire
intensity (30 s). Verified by running the engine:
- `eng-oil-temp-green` with POWER p65 and the cowl open (target 115.70) settles at 118.69 and stays
  there (never reaches 115.70).
- `eng-fire-in-flight` with ENGINE MASTER off: the oil temperature stops at 18.45 (target 15) and
  `fire_intensity` stops at 1.5 and never reaches 0 (target 0).
Every "returns to the cruise value" and every threshold within the gap of its target is unreachable,
and the free-panel "base is the equilibrium" anchor (C-09) is only exact because the base is the
starting point, not because the model converges. The fuel models avoid this with a finer `scale`,
the lag models do not.
**Fix:** Do not let the rounding swallow the step. Either give the slow lag quantities a finer
`scale` in `quantities.ts` (for example 100000 as for the fuel quantities, the gauges already format
to the gauge resolution), or keep the unrounded value in the sim state and quantise only for display
and predicates. Alternatively snap to the target when `Math.abs(target - current) < 1 / scale`. Add
a physics test that every lag model reaches its target within one quantum.

### WR-02: The minimal correct answer of the oil temperature scenario can never return to green

**File:** `scenarios/engine/eng-oil-temp-green.toon:42-70` (with `src/aircraft/da50rg/physics.ts:196-203`)
**Issue:** With `oil_cooling: 0.55`, the required steps are `reduce_power` (travel_rel `lte -10`,
that is p65 from p75) and `open_cowl_flap`. The oil temperature target is then
`15 + (20 + 80 * 0.65) / (0.55 * 1.3) = 115.70`, above the top of the green band (115). So a pilot
who does exactly what the checklist step asks (the minimum that satisfies `lte -10`) never sees the
oil temperature return to green, independent of WR-01 (which additionally parks it at 118.69).
The scenario text "Check oil temp in green range / If not returning to green range: land" is then
always the "not returning" case for the minimum answer, which contradicts the intended teaching
point. A pilot who reduces to p55 settles at 107.51 (green). Also note that doing nothing ends the
run in 42.6 s (outcome at oil temperature 140 held 15 s); verified.
**Fix:** Either tighten the numbers so the minimal correct answer lands in green with margin (for
example `delta: -20` in `reduce_power`, or `oil_cooling: 0.65`), or document that the branch is
intentionally reachable. Add a scenario-level test that the minimal checklist response settles
inside the band that the "returning to green" branch assumes.

### WR-03: One exception inside a step kills the frame loop for the rest of the page lifetime

**File:** `src/ui/clock-driver.ts:51-68`
**Issue:** `frame()` calls `run.step()` and only afterwards re-arms itself with
`handle = raf(frame)`. `run.step()` calls the step listeners, which call `completeRun()` ->
`grade()` (can throw: unknown recorded control, `the simulation fired unknown outcome`, a model
producing a non-finite value in `stepSim`, `markConsumed` RangeError). Any throw skips the `raf`
call, so the driver never runs again until a reload: the clock stops, no later run steps, and the UI
shows a frozen panel with no message.
**Fix:** Re-arm first, or guard the stepping:

```ts
const frame = (): void => {
  if (!detached) handle = raf(frame);
  try {
    /* ...existing body without the final raf... */
  } catch (error) {
    console.error(error); // or surface through the session as a load failure
  }
};
```

### WR-04: Start-decided branches are evaluated on `initial.quantities` even for a Realistic run

**File:** `src/engine/grading.ts:116-123` and `:174-177` (also `src/scenario/lint.ts:211-216`)
**Issue:** A Realistic run starts from the base quantities and ignores `initial.quantities`
(`session.ts:257-258`, `grading.ts:193-195`, lint L14 says so too), but `startContext` always uses
`initialQuantities(scenario, ...)`. Branches with `decided_at: start` that read a quantity (band or
quantity predicates, as the oil-pressure decision does) are therefore decided on values the
Realistic pilot never saw. Today it is harmless only because the shipped scenario sets
`oil_pressure_bar: 5`, which equals the base value. A scenario whose decision depends on an
`initial.quantities` override (for example "oil pressure too low") would grade the pilot against the
wrong branch, the briefing-time `branchStatuses` and the graded `walkProcedure` would agree with each
other but not with the run.
**Fix:** Make `startContext` take the same start quantities as the run: pass
`recording.onset !== null ? env.quantities.baseValues() : initialQuantities(...)` into `grade()` and
`branchStatuses()` (the briefing is not shown for Realistic, so only `grade` needs it). Better, add a
lint rule: a `decided_at: start` predicate that reads a quantity overridden in `initial.quantities`
is an error for a scenario that declares `onset`.

### WR-05: A live run is not bounded by MAX_RUN_MS, the replay is

**File:** `src/engine/sim.ts:283` (cap), `src/engine/run.ts:41-48` (rebuild), `src/ui/session.ts:227-242`
**Issue:** `simulate()` stops at `min(untilMs, MAX_RUN_MS)` (30 min), but `Run.step()` and the
clock driver have no such cap. After 30 minutes of a live run (the tab visible, no modal), two
things diverge from the live state: (1) `grade()` replays only the first 30 minutes, so an outcome
that fires later in the live run is not reproduced and the same log is graded as PASS/FAIL
differently from what the pilot saw, contradicting the "stepped live equals replay at every step"
guarantee in the file headers; (2) a retract after minute 30 rebuilds `this.sim` at t = 1 800 000
while the clock stands later, so event times (`clock.now()`) and `sim.t` are permanently offset and
new events are applied late.
**Fix:** End the run when `sim.t` reaches `MAX_RUN_MS` (treat it as completed, or fail with a
dedicated "run too long" reason) in `Run.step()` or the session's step listener; or make `simulate`
and `Run` share the cap and have the session call `completeRun()` there.

## Info

### IN-01: Determinism guard of ESLint is narrower than its message

**File:** `eslint.config.js:62-75`
**Issue:** The rule text says pure code "replays bit for bit in node and every browser", but only
`Math.random`, `Math.exp`, `Math.pow` and `**` are banned. `Math.sin/cos/tan/atan2/log/log2/log10/
hypot/cbrt/sinh/...` are equally implementation-defined across JS engines, and `new Date()` / `Date()`
(wall clock) is not restricted, only `Date.now`. `src/engine/rotary.ts` already uses `Math.atan2` and
`Math.hypot` (pointer geometry only, never graded, so no bug today), which shows the gap is not
detected. A future physics model that uses `Math.log` would silently break replay equality across
browsers.
**Fix:** Add the remaining transcendental `Math` members and `Date` constructor use
(`NewExpression[callee.name='Date']`) to `no-restricted-properties` / `no-restricted-syntax` for the
purity globs, with a local `eslint-disable` and a comment for the geometry in `rotary.ts`, or move
that file out of `src/engine`.

### IN-02: A reaction that is armed and cleared inside one step still consumes the event

**File:** `src/engine/sim.ts:178-199` and `src/engine/run.ts:76-81`
**Issue:** `fired` is filled in phase (1) when the event arms a reaction; phase (2) can end the
reaction in the same step if a later event of the same batch makes `clearsWhen` true (for example MAX
pressed and the mode moved off HIGH inside one 100 ms step). The reaction never ran, but its event is
reported in `fired`, so `Run.step` raises the consumed watermark and the player can no longer retract
the press. Very small window, no effect on grading.
**Fix:** Build `fired` after phase (2): keep only the event indexes whose reaction is still in
`kept`.

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
