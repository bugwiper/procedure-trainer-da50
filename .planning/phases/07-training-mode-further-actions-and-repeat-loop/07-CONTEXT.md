# Phase 7: Training Mode, Further Actions and Repeat Loop - Context

**Gathered:** 2026-11-01
**Status:** Ready for execution (three plans, lean form per `.planning/WORKFLOW.md`; no research, no plan-checker, no discuss log)

<domain>
## Phase Boundary

The learning loop. A pilot can run a situation in Training mode (checklist on demand, hints), make the non-panel decisions of the situation (inform ATC, brief passengers, further flight conduct) that are graded with the panel actions, retry the same situation or move to the next one from the debrief, and a developer can add a scenario by following the README. Out of scope: the emergency-landing follow-on scenario and landing scene (todo, D-12), any new panel physics, new scenario packs, tooling for non-developers.

</domain>

<decisions>
## Implementation Decisions

### Scope and order
- **D-01:** Plan order: 07-01 training mode axis, checklist toggle and hint (tracer: the hint); 07-02 further actions (schema, lint, grading, modal, debrief, shipped declarations, grading docs); 07-03 retry and next situation from the debrief, README authoring guide, phase-end documents and final gates. SES-02 is 07-01, SES-05 is 07-02, SES-06 and CNT-02 are 07-03.

### Training mode (SES-02)
- **D-02 (owner):** Training/Exam is its own axis, independent of the level (Easy, Medium, Realistic), chosen on its own card like the level. It is display state of the session (`session.mode`, `session.modePicked`), never an input of `grade` (like the level, GRADING.md "What goes in"). Default value `exam` (the behaviour before Phase 7), so the unit paths that never pick a mode are unchanged. The debrief names it ("Mode: Training|Exam"). Card order is mode, then level, then briefing or run (planner: mode first because Realistic starts the run at the level pick; owner may veto).
- **D-03 (owner):** Training: the scenario checklist can be shown or hidden during the run (the `ChecklistOutline` in its briefing form, in a non-modal sheet: the run clock keeps running and the panel stays operable; available on every level, also Medium and Realistic) and a Hint button. Exam: silent, none of that (no buttons are drawn and the session methods do nothing).
- **D-04 (owner):** A hint names the next open checklist step in the printed wording (row mark, text, action), derived from scenario data, no new text per scenario. Rule (planner): `grade` on the current partial recording (pure), the first graded step in declared order with severity critical or standard that is not credited; optional steps are never named; with none open one fixed sentence. A hint never touches grading, a hint count is not kept. On Realistic nothing is given before the onset (the hint would give the failure away).
- **D-05 (planner, owner may veto):** While a run is live the session area (region `scenario_area`) shows a run view: FURTHER ACTIONS (07-02), CHECKLIST and HINT side by side (Training only), NEW SITUATION and CHOOSE SITUATION side by side, RESET. The ids `session.new`, `session.choose`, `session.reset` and their leave-run confirm stay, only the rectangles change (`SESSION_LAYOUT.run`, with an independent hand-written reference). Labels are static (G-0); the shown checklist is marked by the pressed rim, not by text. The hint line is a non-modal strip that takes no press (`pointer-events: none`). Fallback if the owner dislikes the pad: the same buttons in the footer next to Procedure complete.

### Further actions (SES-05)
- **D-06 (owner):** A fixed global list in aircraft data (`src/aircraft/da50rg/further.ts`, read through `AircraftEnv.further`; the UI and lint read it, no id or text is hard-coded elsewhere). (1) Inform ATC, then the second selection: MAYDAY (121.5 or current frequency) or PAN PAN PAN (advise ATC); (2) Brief passengers (if time permits); (3) Choose further flight conduct: Continue flight normally, Initiate precautionary (alternate) landing, Initiate emergency landing. Removed: set squawk, secure cabin, monitor oil, position report, repeat checklist. Option ids: `atc_mayday`, `atc_pan_pan`, `brief_passengers`, `conduct_continue`, `conduct_precautionary`, `conduct_emergency`.
- **D-07 (owner, 2026-11-01):** Multi-select. Any combination of further actions in one run; the modal and the recording allow it. Every pick is one logged decision `{ t, id }` (run clock time, order chosen) in the recording field `decisions`, beside the store log (which stays for controls). An action picked twice is logged once. The conduct may be picked again (escalation); the last conduct pick counts, earlier picks are shown in the debrief. No retract. The modal pauses the run clock like every modal. A pick before the Realistic onset is ignored.
- **D-08 (owner):** Per option a scenario declares a role: `required`, `recommended`, `optional` or `harmful` (an option not listed is `optional`). Required and missing: fails like a missed critical step. Recommended: shown in the debrief, never changes the verdict. Harmful: shown, fails the run only with `fails_run: true` (as the forbidden items). Brief passengers is never `required` and never fails: `optional` (informative) in alternate-landing situations, `recommended` in emergency-landing situations. The model has no "either call" role; where a printed page says only "inform ATC" both calls stay `optional` (open point for the owner, D-13).
- **D-09 (owner, 2026-11-01):** The flight conduct is declared explicitly: `conduct: none` or `conduct` with `accept` (the correct option ids). With `accept` it is required: no pick, or a last pick outside `accept`, FAILS the run (reason `conduct`, status missing or wrong). With `none` no conduct decision exists in that scenario: the modal does not offer it and its absence never fails. Lint: a scenario on the ground (the aircraft's ground parameter, `env.further.groundParameter`, above 0 in the profile; ground scenarios) must declare `none`; any other scenario that has a `further` section must declare `accept`; `accept` must not list every option.
- **D-10:** Format 1 stays valid: `further` is an optional section. A scenario without it grades no further action, the modal offers ATC and passengers unrated and no conduct, and its grade result is JSON-identical to before (the result key is absent). A recording without `decisions` means none made. Every shipped scenario declares `further` (a unit test, not a lint rule). The do-nothing rule L11 stays; the L20 solution run of variants now also makes the required decisions.
- **D-11:** Verdict reasons, in this order: outcome, critical_missed, further_missed (count of required options not picked), conduct, order, forbidden, further_harmful. Decisions after an outcome time are not graded (like events). Rules R16 to R19 go into `docs/GRADING.md` (07-02).
- **D-12 (owner):** The emergency-landing follow-on scenario (with or without engine power, landing scene, newly printed checklist) is not in this phase. The choice is recorded and graded; when the last conduct pick is the emergency landing the debrief shows one note (text in aircraft data) that the landing itself is not trained yet; the todo `2026-10-28-emergency-landing-scenarios.md` gets the status.
- **D-13 (planner defaults, owner corrects; listed in `docs/PANEL-REVIEW.md` "Phase 7: owner review", 07-03):** Roles fail only where the printed page or an owner decision requires it; conduct is safety-conservative.

| Scenario | atc_mayday | atc_pan_pan | brief_passengers | conduct |
|----------|------------|-------------|------------------|---------|
| ENG OIL TEMP, ALTN 1 FAIL, ALTN 2 FAIL | optional | optional | optional | accept precautionary |
| ICING CONDITIONS (printed heading says inform ATC) | optional | optional | optional | accept precautionary |
| ENGINE FIRE (flight), ELEC FIRE FLIGHT, T/O FIRE NO ABORT | required | optional | recommended | accept emergency |
| ENGINE FIRE GROUND, ELEC FIRE GROUND, T/O FIRE ABORT | recommended | optional | optional | none |

### Retry and next (SES-06)
- **D-14 (owner left open, planner decision, owner may veto):** Retry (debrief) starts the same scenario from a clean initial state (panel at the scenario baseline, quantities reset, new clock, empty log and decisions) at the same level and mode, with the same variant (cause) and, on Realistic, the same onset time, so a better result comes from the pilot, not from the draw. The seeds come from the graded recording; one function decides it, so a "new seed" rule is a one-line change. Next situation (debrief) opens the next scenario in listing order (all allowed packs, manifest order, wrapping), keeps mode and level (Realistic only if the next scenario declares an onset, else the level card is shown) and goes to its briefing (Easy, Medium) or starts it (Realistic). NEW SITUATION stays the random pick. Both buttons are ignored while a load runs.

### Authoring guide (CNT-02)
- **D-15 (owner):** A README.md section only, developer to developer, no non-developer tooling: how to add a scenario TOON file (pack manifest, file, ids), validate it with `npm run validate`, play it (`npm run dev`, CHOOSE SITUATION). It covers the variant format, scene and cues, the flight profile, the `further` section and how the training hints are derived. One worked example is a real fenced TOON block that `tests/readme-guide.test.ts` parses and lints against the aircraft, so it cannot go stale. The ROADMAP success criterion 4 is read that way (a developer, not a non-developer).

### Rules inherited and checks
- **D-16:** Counts are derived, not literals; static labels (G-0); brand rule; physics arithmetic rule in pure engine and aircraft code; no scenario fact in `src/engine`, `src/scenario`, `src/ui` (`tests/blueprint.test.ts` gets the further option ids as forbidden literals); checklist text verbatim, never reworded (the hint and the sheet print the stored text); Conventional Commits with the plan id as scope; nothing is pushed.
- **D-17 (gates):** After each task the targeted vitest and the touched Playwright specs on desktop-chromium and phone-chromium. At the end of 07-03 only: `rm -rf node_modules/.vitest-cache`, the whole vitest, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate`, and Playwright on all seven projects (delegated to a subagent, result verified by the caller). Layout changes (the run view) run static-text, layout, zoom and session-area specs on all projects. `.planning/config.json` and `state.json` are not touched.
- **D-18 (visual check):** Look at the result, do not trust numbers: scratch Playwright spec (never committed, deleted before the commit, desktop-chromium and phone-chromium only), screenshots to the session scratchpad (outside the repo), for the run view, the checklist sheet, the hint line, the Further actions modal and the debrief.

### Claude's Discretion
- Exact rectangles of the run view, the sheet size and placement, the wording of the fixed UI sentences (hint when nothing is open, mode card hints, debrief reason lines, the emergency-landing note), the exact shape of `GradeResult.further`, the order of lint messages. Choices are documented in the task summaries.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` (Phase 7), `.planning/REQUIREMENTS.md` (SES-02, SES-05, SES-06, CNT-02), `.planning/WORKFLOW.md`, `.claude/CLAUDE.md`
- `docs/GRADING.md` (rules R1 to R15, "Variants for authors", "Scenes and cues for authors", "Flight profile for authors": the README guide lifts these), `docs/CONTENT-POLICY.md`, `docs/PANEL-LABELS.md` (static session labels), `docs/PANEL-REVIEW.md` (large: grep, then read the range)
- `.planning/phases/06.1-pfd-fidelity-synthetic-vision-translucent-tapes-vertical-spe/06.1-03-PLAN.md`: style of a phase-end task
- `.planning/todos/pending/2026-10-28-emergency-landing-scenarios.md`

</canonical_refs>

<code_context>
## Existing Code Insights

- `src/ui/session.ts`: screen machine free, choosing, briefing, running, debrief; `level`, `levelPicked`, `setLevel`, `start(opened, realistic)` draws the onset and variant seeds, `completeRun` builds the recording from `bridge.store.events()` (source user) plus onset and variant; `closeDebrief`, `toFreePanel`.
- `src/engine/grading.ts`: `Recording { scenarioId, completedAt, onset?, variant?, events }`, `grade` (pure replay), `GradeResult`, `Reason` union; `src/ui/debrief-text.ts` (`reasonLines`) turns reasons into lines.
- `src/ui/screens/`: `LevelPick`, `Briefing`, `Debrief`, `ChecklistOutline` (+ `src/ui/outline.ts` `buildOutline`, `checklistHead`), `Modal` (holds its id so the clock driver pauses; 400 ms input shield).
- `src/ui/panel/session-area.ts` (`SESSION_LAYOUT`, `sessionFootprints`) and `frames/ScenarioAreaFrame.tsx` (main and choose views, `SessionButton`).
- `src/scenario/schema.ts` (strict Zod, every new section optional), `src/scenario/lint.ts` (L1 to L26, `checkVariantRuns` builds the L20 solution run), `src/engine/env.ts` (`AircraftEnv`, one field per aircraft data set: cues, scenes, ...).
- e2e helpers `e2e/support/session.ts` (`chooseScenario` waits for `level-pick`, `startScenario`, `startRealistic`); about a dozen specs click `level-pick-easy` directly.
- Golden grading: `tests/grading.test.ts` loads the real files `eng-oil-temp-green`, `elec-altn1-fail`, `eng-fire-in-flight` and compares full results with `tests/fixtures/recordings.json` (23 recordings). Declaring `further` in those files changes their results; 07-02 task 3 edits the fixture and the expectations on purpose and documents it.

</code_context>

<deferred>
## Deferred Ideas

- The emergency-landing follow-on scenarios (with and without engine), the landing scene and its checklist (todo)
- An "either call" role for the ATC call; further actions that depend on the variant; time limits on decisions; hints that name further actions; checklist progress ticks in the sheet; remembering mode and level across reloads
- A hint count or a hint penalty (the owner wants hints never to touch grading)
- A non-developer authoring tool

</deferred>

## Requirements text changes (07-03 writes them)

- **SES-05** (replaces the old text): A "Further actions" modal offers a fixed list of non-panel actions (inform ATC with MAYDAY or PAN PAN PAN, brief passengers, further flight conduct), any combination in one run; a scenario declares which are required, recommended, optional or harmful and which flight conduct is correct (or none, on the ground); the picks are recorded and graded and shown in the debrief
- ROADMAP Phase 7 success criteria 2 and 4 are reworded to match D-06 to D-09 and D-15.

## Source coverage audit

| Source | Item | Covered by |
|--------|------|------------|
| GOAL | learn with checklist and hints | 07-01 (D-02 to D-05) |
| GOAL | non-panel decisions, MAYDAY and the landing choice | 07-02 (D-06 to D-13) |
| GOAL | retry or move on from the debrief | 07-03 task 1 (D-14) |
| GOAL | authors add scenarios by a guide covering variants, cues, fidelity | 07-03 task 2 (D-15) |
| REQ | SES-02 | 07-01 |
| REQ | SES-05 | 07-02 (text change in 07-03 task 3) |
| REQ | SES-06 | 07-03 task 1 |
| REQ | CNT-02 | 07-03 task 2 |
| RESEARCH | none (no research for this phase) | not applicable |
| CONTEXT | D-01 to D-18 | the plan named on each line; D-16 to D-18 in all three plans |
| Owner exclusions | emergency-landing follow-on, non-developer tooling, hint penalty | Deferred; no plan adds them |

---

*Phase: 7-Training Mode, Further Actions and Repeat Loop*
*Context gathered: 2026-11-01*
