# Phase 3: Reactive Scenarios and Initial Pack - Context

**Gathered:** 2026-10-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can run all three initial emergencies (Oil Temp High, Electrical Failure, Engine Fire) and see each react to what they do: gauges move, ignored failures escalate to a named outcome, handled failures recover. Includes the "realistic" level (delayed onset), the simplified squawk transponder (PNL-07), engine gauges driven by simulated state (PNL-04), scripted reactions (SCN-06) and the initial pack (CNT-01). Requirements: SCN-06, PNL-04, PNL-07, CNT-01.

</domain>

<decisions>
## Implementation Decisions

### Reaction model and physics
- **D-01:** Live values come from a **small per-quantity physics model** (e.g. oil temperature rises with power, falls with cowl flap open), not from authored ramps or timelines. Scenarios set parameters, initial quantities and onset; recovery is part of the model, not separate scenario data. The model is generic aircraft behaviour (lives with the aircraft, `src/aircraft/da50rg`), never a scenario fact (`tests/blueprint.test.ts` still applies). Extends D-08 of Phase 2 (named quantities) without a format change.
- **D-02:** The virtual clock advances in **fixed steps** (e.g. 100 ms) independent of frame rate, so replays and golden tests are identical. No timers in the engine.
- **D-03:** Retract/consumed rule: a reaction **consumes an event (`markConsumed`) only when it fires**. An armed but unfired reaction leaves the event retractable and the reaction layer cancels what a removed event armed via `onRetract`. Tests per reaction kind: after firing, `retract` returns `consumed`.
- **D-04:** The de-ice **MAX 120 s run** is built now (it exercises the clock/flag path: `deice.max_active`, lamp `lt.deice_max`, clears on leaving HIGH). ANNUN-TEST, WIND SHIELD spray, ICE LIGHT effect and ELT lamp behaviour stay deferred.

### Realistic level, escalation, verdicts
- **D-05:** Realistic level: run starts in the base panel state with **no briefing text and nothing else shown**; onset after a **random delay inside a scenario-defined window, drawn from a seed recorded in the run** so replays are identical. Reaction time is measured from onset. The scenario is revealed in the debrief. Easy/medium levels (phase 2.1) are unchanged.
- **D-06:** An unhandled failure that passes its red line triggers a **named outcome (e.g. engine failure) that ends the run as FAIL**; the debrief names the outcome and the missed steps. No follow-on checklists in this phase.
- **D-07:** Verdicts stay **PASS/FAIL**. "Pass with recommendation" remains deferred (todo kept).

### Initial pack content
- **D-08:** Pack = Oil Temp High (green branch, exists), **Electrical Failure (ALTN 1 FAIL)** and **Engine Fire in flight**. The OIL PRES low branch stays deferred. Each scenario passes golden, do-nothing, wrong-order and forbidden-action replay tests plus registry validation.
- **D-09:** **Electrical Failure is a blueprint scenario like Oil Temp High**: before writing it, the researcher must research the official checklist (AFM section and revision, pocket card in `.input/`) and the scenario is validated against it. The goal is baseline functionality across all phases first; a bigger scenario set comes later. Content limits per `docs/CONTENT-POLICY.md` (short verbatim step lines up to 12 words, paraphrased explanation).
- **D-10:** Breaker/bus effects are wired **only as far as the scenarios need** (quantities and lamps they use); the rest of the breaker-effects todo stays deferred.

### Squawk transponder and instruments
- **D-11:** A **simplified transponder sits in the pilot's footroom/legroom** with digit keys 0-7 and a display of the current code. It is temporary and will be replaced later by transponder functionality in the Garmin PFD (a later, not yet created phase). Fidelity of position is therefore not a concern. The entered 4-digit code is panel state, matched like any other step's target state (e.g. 7700). Keep it minimal (CLR/ENT-style behaviour only as needed).
- **D-12:** **All engine-page gauges** respond to the simulated state (not only the quantities the three scenarios use); the physics model must cover them.

### Claude's Discretion
- Fixed step size, physics constants and gauge ramp feel; schema field names for onset window, outcomes and physics parameters; transponder key layout details; exact bus/breaker subset for the electrical scenario.

### Folded Todos
- De-ice MAX timer (partial, D-04) and retract/consumed rule (D-03): `.planning/todos/pending/2026-10-21-deice-max-timer-engine.md`, `.planning/todos/pending/2026-10-21-retract-consumed-events-phase3.md`.
- Breaker effects (partial, D-10): `.planning/todos/pending/2026-10-21-breaker-effects-and-avionics-functions.md`.

### Reviewed Todos (not folded)
- `2026-10-22-pass-with-recommendation.md`, `2026-10-21-real-ipad-check.md`, `2026-10-21-labels-and-bus-membership-revisit.md` (revisit if scenarios touch labels/bus membership), `2026-10-21-review-warnings-hardening.md`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project
- `.planning/ROADMAP.md` (Phase 3) and `.planning/REQUIREMENTS.md` (SCN-06, PNL-04, PNL-07, CNT-01)
- `.planning/phases/02-first-gradable-scenario/02-CONTEXT.md` — D-08 quantities seam, D-09..D-13 grading, D-19..D-23 format/packs
- `.planning/phases/02.1-briefing-difficulty-levels-easy-and-medium-source-line-at-th/02.1-OWNER-INPUT.md` — levels
- `docs/GRADING.md`, `docs/CONTENT-POLICY.md`, `docs/PANEL-LABELS.md`
- `.claude/CLAUDE.md` — engine rules (no timers, no scenario facts in src), gesture contract

### Todos
- `.planning/todos/pending/2026-10-21-retract-consumed-events-phase3.md`
- `.planning/todos/pending/2026-10-21-deice-max-timer-engine.md`
- `.planning/todos/pending/2026-10-21-breaker-effects-and-avionics-functions.md`

### Private sources
- `.input/` (AFM, pocket cards, FIKI supplement; git-ignored, never committed)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/engine/clock.ts`, `quantities.ts`, `cas.ts`, `predicates.ts`, `grading.ts`, `store.ts` (markConsumed, onRetract)
- `src/aircraft/da50rg/quantities.ts`, `cas.ts`, `aircraft.ts`, `indicators.ts`
- `src/ui/clock-driver.ts`, `session.ts`, `session-area.ts`, `screens/`
- `scenarios/oil-temp pack` (`eng-oil-temp-green.toon`, `pack.toon`) as blueprint

### Established Patterns
- Data-driven registry; state in store never DOM; scenarios are data validated by Zod with line-numbered errors.

### Integration Points
- Physics model feeds `quantities`; CAS rules derive chips; session layer adds onset/seed; schema gains onset window and outcomes.

</code_context>

<specifics>
## Specific Ideas

- Electrical Failure and Engine Fire follow the Oil Temp High pattern (blueprint, researched against the official checklist).

</specifics>

<deferred>
## Deferred Ideas

- OIL PRES low branch of Oil Temp High; "pass with recommendation" verdict; ANNUN-TEST/WIND SHIELD/ICE LIGHT/ELT behaviours; full breaker bus model; transponder in the Garmin PFD (future phase); follow-on checklists after an escalation outcome.

</deferred>

---

*Phase: 03-reactive-scenarios-and-initial-pack*
*Context gathered: 2026-10-22*
