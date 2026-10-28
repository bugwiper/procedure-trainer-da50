# Phase 6: Fuel, tank and engine fidelity and the engine page - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Phase Boundary

The fuel system and the engine page follow the real aircraft: two tanks with one combined gauge, fuel flow, fuel calculator, oil pressure behaviour, oxygen, de-ice quantity, rudder trim, the real engine page layout, and a PFD that is live inside situations. No free-panel simulation (owner decision 2026-10-27); simulation stays situation-based. No new fuel scenarios in this phase (models and displays only).

</domain>

<decisions>
## Implementation Decisions

### Scope and order
- **D-01:** Plan order is Fuel model and quantities, then Engine page layout, then PFD live (about three plans, lean workflow per `.planning/WORKFLOW.md`).
- **D-02:** The alternator test (normal procedures, ESS BUS on and off) is NOT in Phase 6; it needs the owner's printed pages and is deferred.
- **D-03:** Folded todos: De-ice MAX timer (`2026-10-21-deice-max-timer-engine.md`: 120 s MAX run, ANNUN-TEST, WIND SHIELD spray, ICE LIGHT effect) and the emergency landing / pitot and stall heat CAS items (`2026-10-28-emergency-landing-scenarios.md`, `2026-10-28-pitot-stall-heat-cas.md`). The planner may put them in a fourth plan or split them out if they swell the phase; the Fuel to Engine page to PFD order stays first.

### Fuel model
- **D-04:** Per-tank consumption plus fuel flow: the tank chosen with the FUEL selector drains, flow derives from the simulated engine state, and the fuel calculator (gallons remain, gallons used, endurance, range) derives from both. Deterministic, `+ - * /` only (physics arithmetic rule).
- **D-05:** No new fuel scenarios (imbalance, low fuel pressure, leak, empty tank) in Phase 6; they follow later on top of the model.

### Engine page
- **D-06:** All boxes at the positions of the owner photo of the real page: Load % and RPM arcs; Oil Pres, Oil Temp, Coolant Temp, Gearbox Temp bars; Rudder Trim; Fuel box (combined left/right bar, Fuel Temp, Fuel Press, FFlow GPH, calculator); Oxygen PSI; De-Ice US gal with endurance; Total Service. Labels follow the owner rules (G-0, `docs/PANEL-LABELS.md`).
- **D-07:** Live from the simulation: fuel (quantity, flow, calculator) and oil pressure, oil temperature, coolant, gearbox. Oxygen, de-ice quantity, rudder trim and total service are static display values unless the folded de-ice work drives the de-ice quantity.

### PFD live
- **D-08:** Airspeed in flight, altitude, attitude and vertical speed come from simulated quantities (heading not included). The 140 kt static value goes away in situations; the free panel stays static.
- **D-09:** The flight profile is scripted per scenario (climb, descent, level), not an aerodynamic model; stays deterministic and replayable.

### Claude's Discretion
- Exact consumption rates, tank capacities and calculator formulas within the DA50 RG data the owner supplies.
- Plan split of the folded todos (D-03).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/ROADMAP.md` (Phase 6 section) and `.planning/WORKFLOW.md`: goal and lean rules
- `.planning/todos/pending/2026-10-23-physics-fidelity-phase.md`: source todo, engine page layout list
- `.planning/todos/pending/2026-10-22-free-panel-simulation.md`: context only, feature excluded
- `.planning/todos/pending/2026-10-21-deice-max-timer-engine.md`: folded
- `.planning/todos/pending/2026-10-28-emergency-landing-scenarios.md`, `2026-10-28-pitot-stall-heat-cas.md`: folded
- `.planning/todos/pending/2026-10-28-fuel-valve-first-run-freeze.md`: watch item for the fuel selector

### Project rules
- `.claude/CLAUDE.md`: owner rules (G-0), physics arithmetic, registry conventions, no scenario facts in engine/ui
- `docs/GRADING.md`, `docs/CONTENT-POLICY.md`, `docs/PANEL-LABELS.md`, `docs/PANEL-REVIEW.md`
- Private: `.input/mfd-engine-page-full.webp` (layout reference, not to be quoted in documents)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/aircraft/da50rg/quantities.ts`, `physics.ts`, `electrical.ts`: quantity table, models, bus model (Phase 4 pattern for a new subsystem)
- `src/engine/physics.ts`, `sim.ts`, `run.ts`: generic model types, 100 ms stepper
- MFD Electrical box and `AmpsGauge` as the template for new engine-page boxes
- FUEL selector `sw.fuel_valve` in `controls/knobs.ts`, fuel cut already in physics

### Established Patterns
- Quantities are data with ranges and colour bands; the engine holds no aircraft facts
- Cues and displays read simulated quantities through the bridge `quantities` signal

### Integration Points
- The PFD frame in `src/ui/panel/frames/` and the bridge `quantities` signal
- `tests/blueprint.test.ts` guards that no scenario facts leak into engine/ui

</code_context>

<specifics>
## Specific Ideas

Layout 1:1 from the owner photo of the real engine page.

</specifics>

<deferred>
## Deferred Ideas

- Alternator test as a normal-procedure situation (needs printed pages)
- Fuel scenarios (imbalance, low pressure, leak, empty tank)
- Heading on the PFD
- Dusk and night scenes (`2026-10-27-night-dusk-scenes.md`), real iPad check, breaker effects: not reviewed for this phase

</deferred>

---

*Phase: 6-Fuel, tank and engine fidelity and the engine page*
*Context gathered: 2026-10-28*
