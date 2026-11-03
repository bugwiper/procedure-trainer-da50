# Phase 9: Emergency landing situations - Context

**Gathered:** 2026-11-03 (owner brief of the same day)
**Status:** Planned, not executed. Lean form per `.planning/WORKFLOW.md`: no research, no plan-checker, no discuss log. Plans 09-01 and 09-02 can run at once; plan 09-03 (the printed content) waits for one owner delivery, see "Open question".

<domain>
## Phase Boundary

A pilot who ends a situation with the flight conduct "Initiate emergency landing" can continue from the debrief into an emergency-landing situation: a simple view of the approach to an off-airport field (windscreen and PFD synthetic vision, the field growing with the descent), the pre-landing checklist of the booklet done on the panel (and ticked on the sheet where the panel has no control), graded like every situation. Two situations: without engine power and with engine power.

Out of scope: a landing model, a crash animation, a damage model, a field chosen by the user, several fields or terrain types, night and weather variants of the approach, the other printed landing checklists (gear up, defective tire, brakes: catalog todo), a precautionary-landing follow-on (the data model allows it, no scenario is planned), Realistic level for the landing situations (D-02).

</domain>

<decisions>
## Implementation Decisions

### Scope and order
- **D-01:** Three plans. 09-01 the approach view and the end at the field (scene, cue, windscreen, PFD, `finish`). 09-02 the continuation from the debrief, the declarations of a landing situation, the stopped engine as a profile, machinery documents and a machinery gate. 09-03 the two printed situations, the catalog entries, the follow-on declarations of the shipped fire scenarios, the e2e flow, the phase documents and the final gates (owner delivery first). 09-01 and 09-02 are tested with synthetic fixture scenarios under `tests/fixtures/scenarios/` (own words, marked as test fixtures, never listed by a pack, never under `scenarios/`).

### The follow-on (owner brief)
- **D-02:** The debrief offers the button "Continue with emergency landing" when the conduct selected at the end of the graded run is the emergency landing and the scenario declares a follow-on for it. The start is the normal start of a situation through the pack seam (the same path as Next situation): the panel starts at the baseline of the follow-on file, nothing is carried over from the previous run. The level is kept (the mode of the first brief was removed in Phase 7 R-01, so the level is the only thing to keep); the landing situations declare no onset, so a Realistic run shows the level card with Easy and Medium (planner decision, owner may veto: nothing begins on its own in a landing, the pilot has already decided; the existing rule "Realistic only where the file has an onset" applies unchanged). Each situation is graded on its own: the first run's result, recording and debrief are untouched by the offer and by what follows (a unit test compares the JSON of the result before and after). Retry in the follow-on repeats the follow-on; Back to panel leaves; no way back into the closed debrief. The button is offered after FAIL as well (the decision to land was made either way); it is not offered when the scenario names no follow-on.
- **D-03:** Data. Scenario file: the optional key `follow_on` inside `further`, a map from a conduct option id to `{ pack, scenario }` (format stays 1; today only `conduct_emergency` is used, the shape also fits a later precautionary follow-on). Aircraft data: the button text as `followOnLabel` of the conduct option (`further.ts`; the UI prints it, no text in `src/ui`). The old note "The emergency landing itself is not trained yet." (`debriefNote`) is shown only when no follow-on button is offered, so it stays true for a scenario without one. Lint L33 (per scenario): every key is a conduct option of the aircraft that the scenario lists in `accept` and the target ids match the id patterns. L34 (pack level, with L29 and L30 in `validate-all`): every target names a manifest entry of a checked pack and not the scenario itself. A target in a pack the access policy denies shows the existing load-failure card; the check stays out of the per-open lint (a paid pack needs no entry in the public data).
- **D-04 (planner reading, owner may veto):** Which source leads where. ENGINE FIRE IN FLIGHT and T/O FIRE NO ABORT (their printed lists switch the engine off) lead to the situation without engine power; ELEC FIRE FLIGHT (the engine keeps running, the printed list switches only the electrics off) leads to the situation with engine power. No other shipped scenario accepts the emergency landing (D-13 of Phase 7). The engine-failure checklists of the catalog todo (booklet p11 and p12) are not shipped; when they are, they lead to the situation without engine power by the same key.

### The approach view (owner brief)
- **D-05:** A new scene id `outlanding` in aircraft data (`SCENE_IDS`, art in `src/ui/panel/windscreen/scenes.tsx`, synthetic vision style in `SyntheticVision.tsx`, both typed by the id tuple). The ground is the cruise landscape (sky, hills, field patches in the shared palette) with one landing field: a stubble-coloured quadrilateral with darker furrow stripes toward the vanishing point and a hedge edge, straight ahead and slightly right of the strut so the cowl does not hide it. The field is part of the scene, the user does not choose it, one fixed field for the scene (a second field would be a second scene id). Same flat-vector rules as the other scenes: no text, no filter, no mask, no animation, perspective arithmetic with + - * / only.
- **D-06:** The field grows with the descent through a cue, not through new simulation state: the cue `field_near` reads `altitude_ft`, level 0 at the terrain height plus 1200 ft (`FIELD_SIGHT_FT`, instructor-review value) and level 1 at the terrain height (a falling cue, the cue machinery already supports `from` above `to`). The terrain height is the aircraft's normal `terrain_ft` (1400), exported as one constant that physics and the cue table both read; a scenario on the scene keeps that terrain (a test over every scenario on the scene checks it; a different terrain would need its own cue). No new quantity, so there is no start-frame glitch and no second number to keep consistent. One pure function `fieldGeometry(level)` (new file `src/ui/panel/windscreen/field.ts`, + - * / and clamping, monotone: the near and far edges and the widths grow with the level; at level 1 the near edge lies below the picture) is read by the windscreen art and the synthetic vision, so they cannot disagree. The numbers are tuned after looking at screenshots (the visual check of Phase 7 D-18: scratch spec, screenshots to the session scratchpad, never committed).
- **D-07:** The PFD reads the same cue level from `bridge.cueLevels` and passes it to `SyntheticVision` (new optional prop `fieldLevel`); the free panel keeps the default scene, so nothing changes there. Preview flags show the scene without a scenario: `?scene=outlanding&q=altitude_ft:<value>`.

### Profile, physics and the end
- **D-08:** Physics: no landing model. With engine power the existing powered regime carries a descending profile (`flight_speed_kt`, a negative `flight_vs_fpm`). Without engine power the engine must be stopped from the first second without being a checklist row: one new profile parameter `engine_stopped` (0 or 1, normal 0, `profile: true`; in force from the first second at every level) makes `running()` false in `physics.ts`, so the existing glide regime (`glide_speed_kt`, `glide_vs_fpm`) and the stopped-propeller cue apply, and the electrical and CAS behaviour of a stopped engine follows from the existing models (the scenario file lists the messages that lint L10 and L26 report). The aircraft stands level on the terrain when the descent ends (the documented rule of Phase 6), values are instructor-review values listed in `docs/PANEL-REVIEW.md`. A scenario without the parameter is unchanged (a test compares an existing run before and after).
- **D-09:** The end. A new optional scenario section `finish` with a predicate `when` and own-words `text` (at most 12 words, like an outcome): the run completes by itself, exactly as if the pilot had pressed Procedure complete, in the first step in which the predicate holds (the approach reaches the field: `altitude_ft` at most the terrain height). It is graded like a pressed Procedure complete at that time: `grade` and its result are unchanged (a recording's `completedAt` is the finish time; the golden fixtures stay byte-identical). The pilot may press Procedure complete earlier. Outcomes stay FAIL-only; there is no touchdown outcome, no crash, no damage: a pilot who did not prepare fails through the missed critical steps, a prepared pilot passes. A named outcome fires first when both come in one step. The debrief prints the `finish` text as one line when the run ended that way (session flag, display state like the level, cleared with the run). Lint L32: `finish.when` resolves like an outcome predicate, does not hold at the start, and a do-nothing run of the file reaches it within the 600 s bound of L26, so a situation cannot hang until the 30-minute cap. The run end is the same code path as an outcome and the cap in `sim.ts`, `run.ts` and `session.ts`.

### The checklist and the declarations
- **D-10:** Checklist text: the booklet edition 4.1 form with number marks, verbatim, typed from the owner's photographed pages (docs/CONTENT-POLICY.md section 2; the existing `kind: line` rows carry the printed text and action, steps carry the panel check). Panel steps (controls that exist): POWER lever, ENGINE MASTER, FUEL valve (FUEL selector), ELECT. MASTER, emergency fuel pump, doors (door release lever), emergency window, flaps, gear. Rows the panel has no control for (belts and harnesses, sun visors, the keypad) stay plain action lines without a `done`; the checklist sheet lets the user tick them (Phase 7 R-23). Which rows are graded, and how severe, is decided from the printed page in 09-03 and listed for the owner; a row whose desired state the panel cannot show stays a plain line.
- **D-11:** Declarations of both situations: `conduct: none` (the decision to land is made; the three conduct buttons and the Avoid row are absent), `atc_mayday` recommended, `atc_pan_pan` optional, `brief_passengers` recommended (as the brief says; none of them can fail a run). Lint L28 ("none exactly when on the ground") is extended by aircraft data: the aircraft lists the scenes that are themselves a landing (`landingScenes` in `further.ts`, today `outlanding`); `none` is required on the ground and on such a scene, and an airborne scenario on another scene still declares `accept`.
- **D-12:** Catalog: the entries stand in the group NON-ANNUNCIATED EMERGENCY PROCEDURES (id `emergency`, tab EMERGENCY) with the tags exactly as printed on their pages (the boxed reference printed in the fire checklists reads EMERGENCY LANDING (ENGINE OFF), page 9; the tag of the engine-power page is read from its page). Placement by printed page number: page 9 stands before the first shipped entry of the group (page 16), the engine-power page follows it; the executor confirms the page numbers from the photos. New pack `landing` (free), scenario ids `landing-engine-off` and `landing-engine-power`, manifest titles of at most 18 characters (planner: LANDING ENGINE OFF, LANDING WITH POWER; discretion). Lint L29 and L30 then require the catalog entries and the heading equality; `tests/checklist-catalog-reference.ts` is edited together with the data.
- **D-13:** Sources and metadata as in the other booklet scenarios (document, issue "Edition 4.1, 2022-10-05", section with the page numbers, verified date). Own additions to the printed text are marked in the header comment (CONTENT-POLICY section 2). Situation texts and the debrief line are own wording.
- **D-14 (rules inherited):** Counts derived, not literals; static labels (G-0); no scenario fact in `src/engine`, `src/scenario`, `src/ui` (`tests/blueprint.test.ts` gets the new scenario ids, titles and the follow-on label as forbidden literals; scene and cue ids are aircraft data and may appear in the UI as the existing ones do); physics arithmetic only + - * / and clamping; Conventional Commits with the plan id as scope; `.planning/config.json` and `state.json` untouched; nothing is pushed.
- **D-15 (gates):** After each task the targeted vitest and the touched Playwright specs on desktop-chromium and phone-chromium. End of 09-02: the machinery gate (cleared cache, whole vitest, typecheck, lint, format check, validate, the touched specs on two projects). End of 09-03 only: `rm -rf node_modules/.vitest-cache`, the whole vitest, typecheck, lint, format check, validate, the whole Playwright suite on all seven projects locally (delegated, result verified by the caller) and the changed specs in the Linux image `mcr.microsoft.com/playwright:v1.64.1-noble` from a `git archive` copy (docker may need `open -a Docker`; the WebKit touch-tap risk of Phase 7 R-13 applies to new buttons: skip exactly that case with a stated reason, never loosen an expectation).

### Claude's Discretion
Exact geometry numbers and colours of the field, the glide and descent values of the two situations, the wording of the situation texts, the `finish` text and the button label, the names of the new lint messages, the titles of the manifest entries (18 characters at most), the order of the new test cases.

</decisions>

## Open question for the owner (blocks plan 09-03 only)

**The booklet pages of the two printed checklists are not in `.input/`.** The photo set holds booklet pages 11 to 18 and 20 to 24. The printed boxed reference in the fire checklists says EMERGENCY LANDING (ENGINE OFF) is on **page 9**; the page of the landing with engine power (the planner assumes page 10) is not photographed either, and nothing in the pages looked at while planning (booklet pages 11, 12, 17, 21 and 23) or in the AFM shows that the booklet has a separate engine-power landing checklist at all (the AFM has only 03-41 "Emergency Landing with Engine Off", letter marks A to I, text and image of it are in `.input/`). Plan 09-03 is therefore gated. Please photograph booklet pages 9 and 10 (and any further page that holds a landing checklist, with the printed page number visible) as `.input/booklet-4.1-p09-*.jpg`, `.input/booklet-4.1-p10-*.jpg`, and say whether the booklet has an engine-power landing checklist. Answers:

- **A (default):** the pages are delivered; both files are typed from the booklet in the number-mark form.
- **B:** only the engine-off checklist is wanted now, from the AFM form 03-41 that is already in `.input/` (letter marks A to I, sub-heading "Before touchdown"; allowed by the 2026-10-27 decision for the letter marks, but the booklet is binding where it differs, so it is a stop-gap until page 9 arrives); the engine-power situation then waits for its page.
- **C:** the booklet has no engine-power checklist: Phase 9 ships the engine-off situation only, ELEC FIRE FLIGHT leads to it too, and the machinery for the second variant stays in place unused (the scene, `engine_stopped` and the follow-on map need no change).

No stand-in checklist text is ever shipped: until one of A, B or C is answered, `scenarios/landing/` does not exist and the machinery of 09-01 and 09-02 is exercised by the fixtures only.

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` (Phase 9), `.planning/REQUIREMENTS.md` (PNL-28, SCN-17, SES-09, CNT-06), `.planning/WORKFLOW.md`, `.claude/CLAUDE.md`
- `.planning/phases/07-training-mode-further-actions-and-repeat-loop/07-CONTEXT.md` (further actions D-06 to D-13, R-08 to R-10, R-15 to R-26, retry and next D-14)
- `.planning/todos/pending/2026-10-28-emergency-landing-scenarios.md` (origin), `2026-11-03-phase-7-uat-changes.md` (Avoid actions greyed under the emergency landing), `2026-10-28-booklet-4.1-catalog.md`
- `docs/GRADING.md` ("Scenes and cues for authors", "Further actions for authors", "Flight profile for authors", "Retry and next situation", rules R1 to R21), `docs/CONTENT-POLICY.md`, `docs/PANEL-REVIEW.md` (grep, then read the range), `README.md` ("Writing a scenario")
- Code: `src/aircraft/da50rg/scenes.ts`, `cues.ts`, `further.ts`, `physics.ts`, `quantities.ts`, `checklist-catalog.ts`; `src/engine/sim.ts`, `run.ts`, `further.ts`, `cues.ts`; `src/scenario/schema.ts`, `lint.ts`, `validate-all.ts`, `catalog-check.ts`; `src/ui/session.ts`, `debrief-text.ts`, `screens/Debrief.tsx`, `App.tsx`; `src/ui/panel/windscreen/scenes.tsx`, `frames/SyntheticVision.tsx`, `frames/PfdFrame.tsx`; the fixtures in `tests/fixtures/scenarios/`
- Private: `.input/booklet-4.1-p*.jpg` (the printed pages), `.input/checklist-emergency-landing-engine-off.png` and `.input/DA50RG_AFM.pdf` (AFM 03-41); never committed, never quoted beyond CONTENT-POLICY section 2

</canonical_refs>

<code_context>
## Existing Code Insights

- The scenes are a typed tuple (`SCENE_IDS`) with a typed art record in `windscreen/scenes.tsx` and a typed style record in `SyntheticVision.tsx`; a new id fails the typecheck until both exist. Cue levels reach the windscreen as the `cues` prop of a scene and reach the PFD through `bridge.cueLevels`.
- The physics already has the three regimes, the terrain floor of the altitude (`terrain_ft`, normal 1400, `floorOf: 'altitude_ft'`) and the rule that a glide ends level on the terrain; `running()` is the single place where "engine stopped" is decided.
- A run ends through `sim.ts` (named outcome), `run.ts` (`ended`) and the `onStep` handler of `session.ts` (outcome or the 30-minute cap calls `completeRun`); `grade` only needs `completedAt`.
- Next situation is `openBriefing(ref, true)` in `session.ts` (leaves the debrief, keeps the level, shows the level card where the file has no onset); the follow-on reuses it with a declared target instead of the next list entry.
- `conduct: none` is hidden by `offersConduct` everywhere (buttons, Avoid row, session ignore); only lint L28 ties it to the ground parameter.
- Existing e2e specs that loop over `shippedScenarios()` (loop, pack, pwa-offline, run-help, further, fire, scenario, pwa-update) see two more entries after 09-03; those with an onset-only or conduct assumption are checked there.

</code_context>

<deferred>
## Deferred Ideas

- A landing model (touchdown speed and rate, flare, a crash or damage verdict), a landing animation
- Fields of other kinds (short, sloping, wooded, wet), a field chosen by the situation's variant, wind
- A Realistic onset for the landing situations (for example the engine stopping while the pilot watches)
- A precautionary-landing follow-on (the follow-on map already allows it), the printed catalog pages for gear-up, defective tire and defective brakes landings
- Carrying the panel state of the first situation into the follow-on (the baseline of each file is used)
- A debrief that shows both situations together

</deferred>

## Source coverage audit

| Source | Item | Covered by |
|--------|------|------------|
| GOAL | the debrief continues into an emergency-landing situation | 09-02 task 1 (D-02, D-03), 09-03 task 2 (D-04) |
| GOAL | with and without engine power | 09-02 task 2 (D-08), 09-03 task 2 (D-10, D-12) |
| GOAL | a simple approach view in the windscreen and on the PFD, the field growing with the descent, not chosen by the user | 09-01 tasks 1 and 2 (D-05 to D-07) |
| GOAL | the preparation checklist done on the panel, non-panel rows tickable on the sheet | 09-03 task 2 (D-10) |
| GOAL | a defined end of the situation | 09-01 task 3 (D-09) |
| Brief | catalog entry and tags as printed | 09-03 task 2 (D-12) |
| Brief | level kept, each situation graded on its own | 09-02 task 1 (D-02) |
| Brief | declarations: conduct none, MAYDAY and passengers recommended | 09-02 task 2 (D-11) |
| Brief | tests with a fixture, docs, blueprint rule, CLAUDE.md sentence, final gates incl. the Linux image | 09-01 to 09-03 (D-14, D-15) |
| Brief | verbatim text only, open question for the owner | 09-03 task 1 (checkpoint), "Open question" above |
| REQ | PNL-28 | 09-01 |
| REQ | SCN-17 | 09-01 task 3, 09-02 task 2 |
| REQ | SES-09 | 09-02 task 1 |
| REQ | CNT-06 | 09-03 |
| RESEARCH | none (no research for this phase) | not applicable |
| Exclusions | landing model, crash, user-chosen field, Realistic onset, other landing checklists | Deferred; no plan adds them |

---

*Phase: 9-Emergency landing situations*
*Context gathered: 2026-11-03*
