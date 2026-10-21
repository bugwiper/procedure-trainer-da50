# Phase 2: First Gradable Scenario - Context

**Gathered:** 2026-10-21
**Status:** Ready for planning

<domain>
## Phase Boundary

One real emergency, ENG OIL TEMP (AFM 03-08), runs end to end: the user starts a situation, reads a short briefing, the panel opens in the scenario's initial state with the annunciation and the red oil temperature, the user performs the procedure by operating controls in a silent exam mode, ends the run with "Procedure complete" and receives an objective PASS/FAIL debrief. Replaying the same recorded run gives identical verdicts. The scenario is a data file loaded only through the PackProvider/AccessPolicy seam and checked by a validate command.

**This first scenario is the blueprint for every later scenario.** Nothing about it may be hard-coded in application code; every requirement below is meant generally and must be anchored in the architecture (schema, engine, UI read the scenario data).

Requirements: SCN-01, SCN-02, SCN-03, SCN-04, SCN-05, SCN-07, SCN-08, PNL-03, SES-01, SES-03, SES-04, PLT-03, PLT-04.

**Not in this phase:** live instrument values and scripted reactions/escalation (Phase 3, SCN-06, PNL-04), the low-oil-pressure branch and further scenarios (Phase 3), training mode, hints, "Further actions" and retry/next (Phase 4), in-app loading of a user file and the authoring guide (Phase 4), offline PWA (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Scenario content: ENG OIL TEMP (blueprint)
- **D-01:** The first scenario is the AFM main case "Engine Oil Temperature High, OIL PRES within the green range" (AFM 03-08, issue 018). The branch "OIL PRES outside the green range" is a second scenario in Phase 3. The scenario file names AFM section and revision (SCN-07).
- **D-02:** Panel-operable steps are exactly two and **both are critical** (owner-confirmed): POWER reduced and COWL FLAP open. POWER target: **at least 10 percentage points below the initial value**; initial POWER 75 percent, so 65 percent or lower credits (the lever has a 5 percent grid). COWL FLAP target: OPEN (initial CLOSED). The two steps form an **unordered** group (the AFM and the pocket card list POWER first but do not require the order). Initial POWER 75 percent and COWL FLAP closed are owner-confirmed.
- **D-03:** Forbidden action: **POWER increased** above the initial value. No other forbidden actions in the first scenario. Severity classes (critical, standard, optional, forbidden) are scenario data; the first scenario uses critical for the two panel steps.
- **D-04:** Steps without a panel control appear (the pocket checklist card, `.input/oil-temp-checklist-card.jpg`: "Check oil pressure" as the first, deciding step; in the green branch "Increase airspeed", "Check oil temp in green range" and "if not returning to green range: land at nearest suitable airfield"; in Phase 2 the last condition is always true because the temperature value stays fixed) as **non-graded checklist lines** in the briefing/debrief, marked as not graded in v1. Their grading is Phase 4 (SES-05).
- **D-23:** The **scenario format has condition blocks now**: a step or group can be bound to a condition on an aircraft-state quantity (e.g. only when oil pressure is green). The first scenario uses the "OIL PRES green" block; the card's "If too low" branch (reduce power, open cowl flap, be prepared for loss of oil and engine failure and emergency landing) becomes a second scenario file in Phase 3 without a format change. The initial state decides which block applies. — **Reversibility:** costly — every later scenario depends on the condition vocabulary.
- **D-24:** The briefing names **AFM 03-08 ENG OIL TEMP, Issue 018** as the source (SCN-07). Step wording follows the pocket card and the AFM in short lines (at most 12 words); explanatory text is own wording. The pocket card is a private reference, not a cited source.
- **D-05:** Short AFM checklist step lines may be verbatim up to 12 words; all explanatory text is paraphrased (`docs/CONTENT-POLICY.md`, D-15 of Phase 1). WARNING/CAUTION/NOTE text is never copied.

### Annunciation and initial state
- **D-06:** The annunciation "ENG OIL TEMP" appears in the **PFD**: right side, about one third from the bottom, left of the altitude tape, **static red text in a black block**, no flashing. The owner can supply a reference image (to be placed in `.input/`).
- **D-07:** The initial state, which is also the trigger of the warning, has the **oil temperature on the PFD above 125 degrees C (red range)**, e.g. 128. In Phase 2 the value stays fixed during the run (it does not fall after POWER is reduced; live behaviour is Phase 3). The oil pressure indication is green.
- **D-08:** The scenario sets **named aircraft-state quantities** (e.g. `oil_temp_c: 128`, oil pressure green). Instruments and annunciation rules read these quantities; the message ENG OIL TEMP results from a rule (oil temperature above 125 degrees C) rather than being a literal in the scenario. This is the seam Phase 3 builds on (reactions, live values) without a format change. — **Reversibility:** costly — every later scenario and the engine/instrument binding depend on the quantity model.

### Grading
- **D-09:** Actions count by **resulting control state, not by clicks**. A step is credited if its target state **holds at "Procedure complete"**; toggling back and forth in between does not matter. For ordering, the time at which the target state was last entered counts.
- **D-10:** **PASS requires every critical step**; standard and optional steps are reported in the debrief only. A missed critical step is FAIL.
- **D-11:** A forbidden action is **shown in the debrief only** (with its time); it does not turn PASS into FAIL on its own. The schema may offer a per-action flag that makes a forbidden action fail the run (Claude's discretion), default off.
- **D-12:** **Order violations in an ordered group** are always shown in the debrief; they cause FAIL only for groups the scenario marks as order-critical. The first scenario uses an unordered group.
- **D-13:** Grading is a pure function of the recorded action log and the scenario, driven by the **virtual, pausable clock** (SCN-08, no real timers in the engine). Replaying a recorded run gives identical verdicts. Tests replay four recorded runs and expect: golden = PASS, do-nothing = FAIL, wrong-order (in a test group that is order-critical) = FAIL, forbidden action = reported. The log-level `retract` of the store (round 3) applies: a retracted event does not exist for grading.

### Flow and screens
- **D-14:** The app opens on the **panel as today**; a menu overlay on top offers **New situation (random)** and **Choose situation**. A **briefing** follows as an overlay over the panel: situation in short own words, source (AFM section, revision) and disclaimer (SCN-07), the non-graded checklist lines, a Start button. On start the panel is set to the scenario's initial state. Free panel use without a scenario stays possible.
- **D-15:** In the run (**exam mode, silent**): no hints, no checklist, no feedback. **"Procedure complete"** is a clear button in the **footer bar** outside the panel (not floating over controls), so it is not hit while panning.
- **D-16:** The **debrief** shows PASS/FAIL, a verdict per step (critical, standard, optional), order violations, harmful actions and the non-graded lines. **No action timeline** in v1 (verdicts only). Retry/next is Phase 4.
- **D-17:** **First-run training-aid acknowledgment (PLT-04):** shown once, remembered in the browser (storage access wrapped, the app works without it), shown again when the disclaimer text version changes. Each scenario briefing shows source, revision and disclaimer.
- **D-18:** Screens are app state (menu, briefing, running, debrief); no router (CLAUDE.md).

### Scenario data format and packs
- **D-19:** **Scenario files are written in TOON** (owner decision, "Nur TOON"). This changes the earlier stack decision "YAML". The decision stands with known risks to be resolved in research: parser maturity, **line-numbered errors still required** (SCN-01), editor support (no JSON-Schema autocomplete expected), how Zod validation maps error paths to lines. If research finds no viable parser or no way to report positions, **return to the owner before planning**. Requirements, ROADMAP, PROJECT.md and CLAUDE.md wording ("YAML") must be amended as part of this phase. — **Reversibility:** costly — every scenario file and the authoring guide are written in the chosen notation; changing it later means converting all packs.
- **D-20:** **Pack folder with manifest:** `scenarios/<pack>/pack` manifest (title, free flag, scenario count) plus one file per scenario. A **PackProvider** interface (list packs, load pack text) and an **AccessPolicy** (open in v1) are the only way the app reads scenarios (PLT-03). Metadata is available without loading the scenarios. Each pack is its own lazy build chunk. — **Reversibility:** costly — packs, entitlement and later paid-pack gating depend on the seam.
- **D-21:** **Validation:** a `validate` command checks every scenario file with **line-numbered errors** and against the **control registry** (every control id and state must exist, SCN-02), and the same check runs in Vitest and CI so a bad file fails the build. Loading a user file inside the app is Phase 4 (authoring guide).
- **D-22:** Scenarios are **data, never code**: no expression strings evaluated, conditions come from a small declarative vocabulary validated by the schema (consistent with the engine decision in CLAUDE.md).

### Claude's Discretion
- Exact schema field names and the condition vocabulary (comparisons against the initial value, state membership), as long as D-02, D-08 and D-09 are expressible.
- Shape of the pack manifest and the TOON-to-schema validation path.
- Visual details of the menu, briefing and debrief within the owner's panel rules (static labels, no pulsing, 44 px targets on touch).
- Whether a per-action flag lets a forbidden action fail the run (D-11).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` § Phase 2 — goal and the five success criteria (the YAML wording in criterion 5 is superseded by D-19)
- `.planning/REQUIREMENTS.md` — SCN-01..SCN-08, PNL-03, SES-01/03/04, PLT-03/04 (SCN-01 says YAML: superseded by D-19)
- `.planning/PROJECT.md` — key decisions (engine design, panel rules, gestures)

### Procedure source (private, view only)
- `.input/oil-temp-checklist-card.jpg` — owner's pocket checklist card "ENG OIL TEMP / OIL TEMPERATURE HIGH" (check oil pressure; branch too low / green; steps listed above). Private, never committed.
- `.input/DA50RG_AFM.pdf` § 03-08 ENG OIL TEMP (pp. 03-12/03-13, issue 018) and `.input/afm-notes.md` — procedure steps, oil temperature red range above 125 degrees C, CAS warning wording. Private, never committed or quoted beyond `docs/CONTENT-POLICY.md`.
- `docs/CONTENT-POLICY.md` — verbatim limit (12 words per checklist line), no WARNING/CAUTION/NOTE copying, scenario source and revision metadata.

### Engine and panel foundations (this repository)
- `CLAUDE.md` § Conventions, Architecture, Technology Stack (engine rationale: pure reducer, virtual clock, declarative conditions, scenario-lint cross-references; the YAML/Zod parts are superseded by D-19)
- `.planning/phases/01.1-panel-shape-controls-and-indicator-lights/01.1-OWNER-FINDINGS.md` and `-R2.md` — owner rules (static labels, no dynamic text, gesture contract)
- `.planning/todos/pending/2026-10-21-retract-consumed-events-phase3.md` — rule for retract and consumed events (relevant to the engine log)
- `.planning/phases/01.1-panel-shape-controls-and-indicator-lights/01.1-REVIEW-DISPOSITION.md` — open store-hardening warnings WR-01/02/07 (listeners, unique event ids, frozen events): they bite once grading attaches to the store
- `src/engine/store.ts`, `registry.ts`, `indicators.ts`; `src/aircraft/da50rg/panel.ts`, `indicators.ts`; `src/ui/bridge.ts`, `App.tsx`, `src/ui/panel/frames/PfdFrame.tsx`

No external ADRs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PanelStore` (event log, `deriveState`, `retract`, `markConsumed`, `onRetract`): the recorded action log for grading and replay already exists; grading reads it.
- Control registry with typed kinds and legal state ids: validation of scenario control references (SCN-02) and state targets reads it.
- Derived-indicator mechanism (`src/engine/indicators.ts`): the pattern for annunciation rules computed from state; extend toward aircraft quantities (D-08).
- `PfdFrame.tsx`: the PFD glass where the ENG OIL TEMP block and the oil temperature value go; the owner placement is in D-06.
- `App.tsx`, `bridge.ts`: app shell and store-to-signal glue; footer bar exists (About, rotate hint, Full panel button logic).
- `docs/CONTENT-POLICY.md` and the About dialog: base for the disclaimer text and its version.

### Established Patterns
- Data-driven registry and derived counts; reference tables in tests; static labels; art-fit and text-overlap gates (new PFD text must pass them).
- Pure engine, no timers or browser globals; UI drives ticks; `@hooks` e2e convention; `PW_PORT`.
- Pointer arbitration glue (`zoom.ts`) must not be disturbed by the new overlays (menu, briefing, debrief are DOM overlays above the SVG panel).

### Integration Points
- New engine module for scenario evaluation (pure, `src/engine`), a scenario loader/validator (Node CLI plus runtime) and a pack provider module, session state (menu, briefing, running, debrief) in `src/ui`, PFD annunciation block and oil temperature binding in `PfdFrame.tsx`.

</code_context>

<specifics>
## Specific Ideas

- The owner can provide a reference image for the PFD annunciation block (red text in a black block, right side about one third from the bottom, left of the altitude tape).
- Blueprint principle: scenarios are configurable data; the first scenario must not leave scenario-specific code behind.

</specifics>

<deferred>
## Deferred Ideas

- Second scenario variant "OIL PRES outside the green range" with the engine-failure preparation: Phase 3.
- Grading of the non-panel steps (airspeed, monitoring, landing decision) via "Further actions": Phase 4 (SES-05).
- In-app loading of a user scenario file with line-numbered errors, authoring guide: Phase 4 (CNT-02).
- Live oil temperature falling after POWER reduction, escalation if ignored: Phase 3 (SCN-06, PNL-04).
- Per-action option that lets a forbidden action fail the run: schema discretion, default off.
- Action timeline in the debrief: owner chose verdicts only for now.

### Reviewed Todos (not folded)
- `2026-10-21-retract-consumed-events-phase3.md`: engine-log rule for Phase 3 reactions; read as input, not in scope.
- `2026-10-21-deice-max-timer-engine.md`, `2026-10-21-breaker-effects-and-avionics-functions.md`: behaviours for the reaction phase.
- `2026-10-21-labels-and-bus-membership-revisit.md`: revisit when scenario content needs more controls.
- `2026-10-21-review-warnings-hardening.md`: store hardening (WR-01/02/07) should be considered before grading attaches listeners; planner decides whether to fold it.
- `2026-10-21-real-ipad-check.md`: device check, outside this phase's scope.

</deferred>

---

*Phase: 02-first-gradable-scenario*
*Context gathered: 2026-10-21*
