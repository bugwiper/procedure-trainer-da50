---
phase: 09-emergency-landing-situations
plan: 02
subsystem: debrief follow-on, landing declarations, stopped engine, machinery documents
tags: [follow_on, L33, L34, landingScenes, engine_stopped, debrief-follow-on]
requires: ["09-01"]
provides:
  - "further.follow_on in the scenario format, lint L33 (per scenario) and the pack-level L34 (follow-on-check.ts, run by npm run validate)"
  - "aircraft data: followOn { label, title } on the conduct option emergency landing; landingScenes ['outlanding']"
  - "debrief button Emergency landing (data-testid debrief-follow-on) between Retry and Next situation; followOnOffer in debrief-text.ts; session.continueToFollowOn"
  - "lint L28 extended: conduct none exactly on the ground and on a landing scene"
  - "profile parameter engine_stopped (0 to 1): running() is false from the first second"
  - "synthetic fixtures landing-source, landing-fixture (with the landing further section) and landing-fixture-off"
  - "docs: GRADING.md rules R22 and R23 and the section Emergency landing situations for authors, README fragments, PANEL-REVIEW.md Phase 9 owner review, one CLAUDE.md sentence"
affects: [09-03]
tech-stack:
  added: []
  patterns:
    - "one pure function (followOnOffer) decides the button and the suppression of the old note"
    - "a pack-level check in its own module, fed by validate-all beside L29 and L30"
key-files:
  created:
    - src/scenario/follow-on-check.ts
    - tests/follow-on-check.test.ts
    - tests/fixtures/scenarios/landing-source.toon
    - tests/fixtures/scenarios/landing-fixture-off.toon
    - e2e/follow-on.spec.ts
  modified:
    - src/scenario/schema.ts
    - src/scenario/lint.ts
    - src/scenario/validate-all.ts
    - src/engine/further.ts
    - src/aircraft/da50rg/further.ts
    - src/aircraft/da50rg/physics.ts
    - src/ui/session.ts
    - src/ui/debrief-text.ts
    - src/ui/screens/Debrief.tsx
    - src/ui/App.tsx
    - tests/fixtures/scenarios/landing-fixture.toon
    - tests/further.test.ts
    - tests/scenario-lint.test.ts
    - tests/session.test.ts
    - tests/debrief-text.test.ts
    - tests/modal.test.ts
    - tests/physics.test.ts
    - tests/flight-profile.test.ts
    - tests/landing-approach.test.ts
    - tests/blueprint.test.ts
    - tests/panel-review.test.ts
    - e2e/approach.spec.ts
    - docs/GRADING.md
    - docs/PANEL-REVIEW.md
    - README.md
    - .claude/CLAUDE.md
decisions:
  - "The button text and title are aircraft data (followOn on the conduct option), the debrief prints them and names no scenario; the blueprint gate forbids both strings in application code."
  - "The session reads the offer from the file's own scenario signal (not a resolved variant) and the result, through the same followOnOffer the Debrief uses; continueToFollowOn is openBriefing(ref, true) behind loading, busy and the load-failure memory of Next situation, with its own busy key session.follow_on."
  - "L34 runs on the manifest entries of the checked packs (the same set as L29); a self reference is reported even when the pack was not checked, a target in an unchecked pack is not judged."
  - "landing-fixture-off starts with the engine already dead: rpm, load, oil pressure, fuel flow and fuel pressure 0 in initial.quantities and OIL PRES listed under annunciations (the lint shows it fires at the start; no late annunciation). The first frame is already a stopped engine."
  - "The e2e spec patches the engine pack chunk on the wire (page.route) to add a follow_on map to the shipped Engine Fire file, because no shipped file declares one before 09-03; the patch steps aside once a shipped file declares its own."
metrics:
  duration: "about 100 minutes"
  completed: 2026-11-03
status: complete
requirements-completed: [SES-09]
requirements-partial: [SCN-17]
commits: 4
plan_head_before: c984d3c7c82c7b371b8cc501d519c44c71098ba8
plan_head_after: 3907ba7
actuals:
  tokens: 60000
  tasks: 3
  commits: 4
---

# Phase 9 Plan 02: Follow-on from the debrief, landing declarations and the stopped engine Summary

A pilot who ends a situation on the emergency landing can continue from the debrief into the situation the scenario names, a landing situation declares no conduct, and a profile can stop the engine from the first second; all of it is proven on synthetic fixtures and no shipped content changed.

## What was built

**Task 1 (tracer), `f218066` and `6cb8088`.** `further.follow_on` (map from a conduct option id to `{ pack, scenario }`, ids checked by the schema patterns). Aircraft data: `followOn { label: 'Emergency landing', title: 'Continue with emergency landing' }` on `conduct_emergency`; `defineFurther` rejects it on an action or with an empty text. L33 per scenario (reported at `further.follow_on.<id>`): the key is a conduct the aircraft gives a button, `accept` lists it, the scenario does not say `conduct: none`. L34 in `src/scenario/follow-on-check.ts`, called from `validate-all.ts` beside L29 and L30 (self reference, missing manifest entry of a checked pack, unchecked pack not judged). `debrief-text.ts`: `followOnOffer(result, section, set)` and `furtherNote` (third optional argument) that is null when an offer exists. `Debrief.tsx` prints the secondary button with the label, the title as aria-label and tooltip, test id `debrief-follow-on`, between Retry and Next situation; `App.tsx` passes `session.continueToFollowOn`. `session.continueToFollowOn()` is `openBriefing(ref, true)` behind the debrief screen, busy guard and the load-failure memory (its Retry repeats the follow-on). Fixture `landing-source.toon`. `6cb8088` fixes `tests/modal.test.ts` (the actions array now holds an empty slot) and adds the button case.

**Task 2, `2a16e48`.** `landingScenes` in `FurtherDefinition` (optional, validated as ids and unique) and in aircraft data (`['outlanding']`); L28 requires `conduct: none` where the profile puts the aircraft on the ground or the scene is a landing scene, with a message that names the scene; the ground messages are unchanged. `physics.ts`: the profile parameter `engine_stopped` (0 to 1, normal 0), read only by `running()`. `landing-fixture` got the `further` section (MAYDAY recommended, PAN PAN PAN optional, brief passengers recommended, `conduct: none`; placed before the finish so the existing finish tests keep their WITHOUT cut); `landing-fixture-off` is the second fixture (table checklist, three panel steps, two plain lines, engine stopped, the first frame already dead). The blueprint gate also forbids the follow-on label and title in `src/engine`, `src/scenario`, `src/ui`.

**Task 3, `3907ba7`.** `docs/GRADING.md`: rules R22 (finish) and R23 (follow-on) in the rules list, a section "Emergency landing situations for authors (phase 9)", the scene and the cue `field_near` in "Scenes and cues for authors" (table row, the L22 sentence), the amended L28 and the new L33 and L34 lines, `engine_stopped` in the profile parameter list and the regime text, and a third button line in "Retry and next situation". `README.md`: `finish` and `follow_on` fragments, the landing-scene conduct rule. `docs/PANEL-REVIEW.md`: "Phase 9: owner review" (nine items: sight height 1200 ft, field geometry and palette as instructor-review values, the fixture descent values are not values, no Realistic landing, button label and title, the offer after FAIL, the L28 landing-scene rule, `engine_stopped`, the end at the field). `tests/panel-review.test.ts` now expects Phase 9 as the last section. `.claude/CLAUDE.md`: one "Since Phase 9" sentence.

## Verification

- `rm -rf node_modules/.vitest-cache && npx vitest run`: 90 files, 4339 tests, all passed (09-01 ended at 89 files and 4261 tests). `tests/fixtures/recordings.json` and every golden test untouched and green (a `engine_stopped` run with 0 equals a run without the parameter, tested).
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (10 scenario files, 0 problems): clean after the last source change.
- Playwright, local (`PW_PORT=4406`): the new and changed specs `follow-on` (5 cases) and `approach` (7 cases) on all seven projects, 84 of 84 passed. Machinery gate (approach, windscreen, pfd, art-fit, further, loop, session-area) on desktop-chromium and phone-chromium: 164 passed, 6 skipped (the existing project-specific skips). Spot check loop, further, scenario, layout, pack, run-help on desktop-chromium and phone-portrait: 119 passed, 1 skipped (existing).
- Linux image: see the section "Linux image" below (all green).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tests/modal.test.ts read the actions as a dense array**
- **Found during:** whole vitest after task 1 (the targeted list of the plan does not include it).
- **Issue:** the follow-on slot is `null` when no offer exists, which broke `children.map(child => child.props)`.
- **Fix:** filter the empty slot, plus a case for the button (order, label, aria-label, title, class, handler).
- **Files modified:** tests/modal.test.ts
- **Commit:** 6cb8088

**2. [Rule 3 - Blocking] tests/panel-review.test.ts pinned Phase 7 as the last section**
- **Found during:** task 3 (the plan names the file in its verify command, not in files_modified).
- **Fix:** Phase 9 is now the last section, the Phase 7 item tests stop at the next heading, and a Phase 9 describe checks numbering, "nothing was pushed", no private material and the named values.
- **Commit:** 3907ba7

**3. [Rule 2 - Missing critical] An end-to-end test of the button needs a follow_on that no shipped file has**
- **Issue:** the plan's task 2 says e2e needs no change, but the instruction for this run asks for e2e of the button, the kept level and the absent button. No shipped scenario declares a follow-on before 09-03 and `scenarios/landing/` must not exist.
- **Fix:** `e2e/follow-on.spec.ts` patches the text of the engine pack chunk on the wire (route `**/pack-engine-*.js`): it adds `follow_on` to the shipped Engine Fire file pointing at the Engine Oil Temperature file. The patch throws if the conduct line is not found and steps aside when the shipped file declares its own follow-on (the target is then read from the file). Nothing shipped changed.
- **Files modified:** e2e/follow-on.spec.ts (new)
- **Commit:** f218066

**4. [Plan detail] followOnLabel vs followOn { label, title }.** `09-CONTEXT.md` D-03 names `followOnLabel`; the plan (P-03) fixes `followOn: { label, title }`. The plan was followed.

**5. [Plan detail] Debrief takes `onFollowOn` as an optional prop**, like `endedByFinish`, so other callers of the component in tests need no change.

**6. [Plan detail] The decision on the stopped engine's first frame.** The plan left it open whether the initial block carries the dead-engine values or the engine spins down. The fixture sets `rpm`, `load_pct`, `oil_pressure_bar`, `fuel_flow_gph` and `fuel_pressure_bar` to 0 and lists `oil_pres` under `annunciations`: the lint (L10) reported the rule firing at the start, L26 found no late message. A spin-down start would list the late messages instead; the shipped situation of 09-03 may choose either.

Nothing else differs from the plan. `.planning/config.json` and `state.json` were not touched; nothing was pushed; `scenarios/landing/` does not exist; no printed checklist text was shipped.

## Known Stubs

None. The fixtures are synthetic by design and live under `tests/fixtures/` only.

## Threat Flags

None beyond the plan's register. T-09-03: the target is two ids checked by the schema patterns and opened only through `openScenario` (L33, L34). T-09-04: a denied pack shows the existing load-failure card and no file of the target is read (`tests/session.test.ts`, "access policy denies").

## Unverified / for the owner

- The look of the button in the debrief on a very narrow phone (the actions wrap onto two rows already; a fourth button was not looked at by eye, only exercised by the specs).
- The WebKit touch-tap risk of Phase 7 R-13 did not occur, locally or in the Linux image.
- The shipped Engine Fire file has no `follow_on` yet; with it the e2e spec switches from the wire patch to the shipped target (written for it, not exercised before 09-03).
- L34 is only run by `npm run validate` and its unit test, as D-03 asks; an unknown target at run time shows the load-failure card.
- Printed content items for the PANEL-REVIEW Phase 9 section come with 09-03.

## Linux image

`mcr.microsoft.com/playwright:v1.64.1-noble`, `git archive` of HEAD `3907ba7` into the session scratchpad, `npm ci`, `CI=1`, `--retries=0`: `follow-on` and `approach` on all seven projects, 84 of 84 passed, 0 failed, 0 skipped, 0 flaky (no WebKit touch-tap case had to be skipped). Spot check `loop`, `further`, `scenario`, `layout` on desktop-chromium and phone-portrait: 85 passed, 1 skipped (existing), 0 failed.

## Self-Check: PASSED

Created files exist (`src/scenario/follow-on-check.ts`, `tests/follow-on-check.test.ts`, `tests/fixtures/scenarios/landing-source.toon`, `tests/fixtures/scenarios/landing-fixture-off.toon`, `e2e/follow-on.spec.ts`) and the commits `f218066`, `6cb8088`, `2a16e48` and `3907ba7` are ancestors of HEAD. `scenarios/landing/` does not exist, `.planning/config.json` and `state.json` are untouched, no scratch file is in the tree.
