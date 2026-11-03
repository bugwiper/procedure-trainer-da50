---
phase: 09-emergency-landing-situations
plan: 01
subsystem: windscreen, synthetic vision, simulation end, scenario lint
tags: [outlanding, field_near, finish, L32, fieldGeometry]
requires: []
provides:
  - "scene outlanding and cue field_near (aircraft data), TERRAIN_HEIGHT_FT and FIELD_SIGHT_FT"
  - "fieldGeometry and fieldPolygons (src/ui/panel/windscreen/field.ts): the one growth law of the landing field"
  - "windscreen art OutlandingScene and synthetic vision art kind outlanding with fieldLevel"
  - "scenario section finish { when, text }, SimState.finish, simEnded, session.endedByFinish, debrief line debrief-finish, lint L32"
  - "tests/fixtures/scenarios/landing-fixture.toon (synthetic, never shipped)"
affects: [09-02, 09-03]
tech-stack:
  added: []
  patterns:
    - "one pure geometry function read by two renderers, each projecting with its own helper"
    - "the end of a run through the same code path as an outcome (sim, run, session)"
key-files:
  created:
    - src/ui/panel/windscreen/field.ts
    - tests/fixtures/scenarios/landing-fixture.toon
    - tests/field-geometry.test.ts
    - tests/landing-approach.test.ts
    - e2e/approach.spec.ts
  modified:
    - src/aircraft/da50rg/scenes.ts
    - src/aircraft/da50rg/cues.ts
    - src/aircraft/da50rg/quantities.ts
    - src/aircraft/da50rg/physics.ts
    - src/ui/panel/windscreen/scenes.tsx
    - src/ui/panel/frames/SyntheticVision.tsx
    - src/ui/panel/frames/PfdFrame.tsx
    - src/scenario/schema.ts
    - src/scenario/lint.ts
    - src/engine/sim.ts
    - src/engine/run.ts
    - src/ui/session.ts
    - src/ui/debrief-text.ts
    - src/ui/screens/Debrief.tsx
    - src/ui/App.tsx
    - README.md
decisions:
  - "The growth law is a perspective law on an eased level: distance falls linearly with u = l * (2 - l), a row is 1 / distance. A straight level kept the field a sliver until the last quarter of the descent (seen in the screenshots)."
  - "The field is wholly right of the strut's vanishing line at every level (centre 0.45, half width 0.40, in units of the half picture width per unit of row), so the strut and the cowl do not hide the speck."
  - "finish is evaluated after the outcomes and only when none fired in the step; a state with a finish is final exactly like one with an outcome (simEnded)."
  - "endedByFinish is cleared inside endRun, which every start, retry, close and free-panel reset calls; it is set before completeRun and so outlives the run help cleanup until the debrief closes."
metrics:
  duration: "about 45 minutes"
  completed: 2026-11-03
status: complete
requirements-completed: [PNL-28]
requirements-partial: [SCN-17]
commits: 4
plan_head_before: bf2c47e276b62e1de68f6b32fe028346191715f2
plan_head_after: 31ea20c48acd69f5b139a9efe2dcd78951c4fdd1
actuals:
  tokens: 25000
  tasks: 3
  commits: 4
---

# Phase 9 Plan 01: The approach view and the end at the field Summary

The approach to an off-airport field exists in the windscreen and on the PFD synthetic vision, driven by one cue (`field_near`, read from `altitude_ft`) and one geometry function, and a situation can end by itself at the field through a new optional `finish` section with an unchanged grade function.

## What was built

**Task 1 (tracer), `095a9d0`.** Scene id `outlanding`; `TERRAIN_HEIGHT_FT` (1400) exported next to the altitude base and read by the altitude base, the `terrain_ft` parameter and the cue table; cue `field_near` (`altitude_ft`, from terrain plus `FIELD_SIGHT_FT` 1200 to terrain, a falling cue). `field.ts`: `fieldGeometry(level)` (near and far row, centre and half width, + - * / and clamping only), `fieldPolygons(level)` (outer hedge outline, stubble, three furrows as corners in (lateral, row) space) and `FIELD_PALETTE`. The windscreen scene reuses the cruise sky, hills, ground and patches (extracted into `Landscape` and `HorizonHaze`, the cruise markup is identical) and draws the field with `data-part="field"`. Synthetic fixture `landing-fixture.toon` (powered regime, 80 kt, minus 700 fpm, start 2200 ft). Tests: `field-geometry` (9), `landing-approach`, `cues` rows, `e2e/approach.spec.ts`.

**Task 2, `9ec5ab3`.** `SyntheticVision` gets the art kind `outlanding` and the optional prop `fieldLevel` (default 0), projecting `fieldPolygons` with its own rows (a row is a fraction of `reach`) and lateral unit `FIELD_HALF_VIEW` (1500). `PfdFrame` passes `bridge.cueLevels['field_near']`. `tests/svt.test.ts`: style, art only for its scene, palette, growth at 0.2, 0.6 and 1, both projections invert to `fieldPolygons` (the two renderers read one function), no text, filter, mask or animation, other scenes unchanged by a level. The fake bridges of five PFD tests got `cueLevels`.

**Task 3, `31ea20c`.** `Finish` strict object (`when`, `text` 1 to 12 words) and optional `finish` on the scenario. `sim.ts`: `SimState.finish`, `SimSetup.finish`, `simEnded`; the finish is evaluated after the outcomes in step 5, only when no outcome fired in that step; `stepSim` returns an ended state unchanged and `simulate` stops. `run.ts`: `ended` includes the finish. `session.ts`: the step handler completes the run on a finish or the cap, `endedByFinish` signal (display state, cleared in `endRun`); `debrief-text.ts` `finishLine`; `Debrief.tsx` prints `debrief-finish`; `App.tsx` passes the flag. Lint L32: the predicate resolves (reported at `finish.when`), does not hold at the Easy and Medium start or the Realistic start, and a do-nothing run reaches it within the 600 s bound of L26 (message names the bound). The two do-nothing loops of the lint (L14 and L26) now stop on `simEnded`, otherwise a finished state would not advance. Grade untouched: `grading.ts` needed no change (a test proves the grade of a finished run equals the grade of the same file without finish and the same recording; a session test proves it equals a pressed Procedure complete at that time).

## Commits

The three plan commits are `095a9d0`, `9ec5ab3` and `31ea20c`. The measured count of 4 in the frontmatter (`git rev-list --count plan_head_before..HEAD`) includes `e6c8108` (`test(e2e): mark the two all-regions zoom loops slow for loaded CI runners`), a commit by someone else that landed on the branch between my task 2 and task 3 commits; it is not part of this plan.

## Verification

- `rm -rf node_modules/.vitest-cache && npx vitest run`: 89 files, 4261 tests, all passed (run after the last source change).
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (10 scenario files, 0 problems): all clean.
- `tests/fixtures/recordings.json` and every golden test untouched and green.
- Playwright, local (`PW_PORT=4405`): `e2e/approach.spec.ts` on all seven projects, 42 of 42 passed. Spot check on desktop-chromium and phone-portrait: windscreen, pfd, scenario, layout, loop, run-help, cues specs, 182 passed, 2 skipped (existing skips). Task gates on desktop-chromium and phone-chromium: approach, windscreen, pfd, art-fit all green.
- Linux image `mcr.microsoft.com/playwright:v1.64.1-noble` (git archive of HEAD `31ea20c`, `npm ci`, `CI=1`, `--retries=0`): `approach`, `windscreen`, `pfd`, `layout`, `art-fit` and `scenario` specs on all seven projects: 463 passed, 41 skipped (the existing project-specific skips of `art-fit`, `pfd` and `scenario`; no `approach` or `windscreen` case skipped), 0 failed, 0 flaky. HEAD included the foreign commit `e6c8108`.
- Visual check (scratch spec, deleted, never committed): screenshots in the session scratchpad `09-01-<project>-<far|mid|near>-<page|windscreen|pfd>.png` for desktop-chromium and phone-chromium. The windscreen field is a speck at the sight height, a field with furrows right of the strut at half the height and a large field filling the right foreground at the terrain; the PFD shows the same growth in its lower right.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The README list of scenes and cues is tested against the aircraft**
- **Found during:** Task 3 (whole vitest)
- **Issue:** `tests/readme-guide.test.ts` compares the "Scenes" and "Cues" bullet lists of the README guide with the aircraft data; the new id and cue made it fail. The plan leaves the docs sentence to 09-02.
- **Fix:** only the two list lines of the README guide now name `outlanding` and `field_near`. The prose of `docs/GRADING.md` ("Scenes and cues for authors", the L22 sentence), the finish authoring notes and `docs/PANEL-REVIEW.md` are left to 09-02 as planned.
- **Files modified:** README.md
- **Commit:** 31ea20c

**2. [Rule 3 - Blocking] A test that every cue has art**
- **Found during:** Task 3 (whole vitest)
- **Issue:** `tests/windscreen.test.ts` "every cue of the aircraft table has art" draws every cue; `field_near` was not drawn by cruise, roll or smoke.
- **Fix:** the landing-field group carries `data-cue="field_near"` and `data-level`; the test also renders the `outlanding` scene. (Edited `scenes.tsx` and `windscreen.test.ts`, neither change is in the plan's list for task 3.)
- **Commit:** 31ea20c

**3. [Rule 3 - Blocking] Fake bridges of the PFD tests lacked `cueLevels`**
- **Found during:** Task 2
- **Issue:** `PfdFrame` now reads `bridge.cueLevels`; five test files build a fake bridge without it.
- **Fix:** `cueLevels: { value: {} }` added to the fake bridges of `avionics`, `qnh`, `pfd-layout`, `pfd-live` and `svt` tests.
- **Commit:** 9ec5ab3

**4. Optional prop instead of required.** `Debrief` takes `endedByFinish` as an optional prop (default false) so the other callers of the component in tests (`modal.test.ts`) need no change; `App.tsx` always passes it.

**5. Distance law eased (art value).** The first, straight law left the field invisible at half the descent; the shipped law eases the level (`u = l * (2 - l)`). This stays inside P-01 (numbers are art values tuned from screenshots).

Nothing else differs from the plan. `.planning/config.json` and `state.json` were not touched; no ROADMAP, STATE or REQUIREMENTS edit was made (the plan names none); nothing was pushed.

## Known Stubs

None. The fixture is synthetic by design and lives under `tests/fixtures/` only.

## Unverified / for the owner

- The look of the field (colours, hedge, furrows, size at each height) rests on desktop and phone-landscape screenshots of the free panel with preview flags; the owner review of the approach view comes with 09-03. The geometry numbers (`NEAR_DISTANCE`, `FAR_DISTANCE`, `HALF_WIDTH`, `CENTRE`, `FIELD_SIGHT_FT`) are instructor-review values and belong in `docs/PANEL-REVIEW.md` (09-02).
- SCN-17 is only partly covered here (the `finish` machinery); the declarations of a landing situation come with 09-02.
- A `finish` on a scenario with variants goes through L19 per variant like the other start checks; there is no dedicated test for that combination.
- The L26 loops stop at a finish, so a message that would only appear after the finish is not checked (the run is over by then).

## Threat Flags

None. The `finish` predicate goes through the same predicate vocabulary and resolution as an outcome (T-09-01 mitigated by L32); the preview flags are unchanged parsers (T-09-02 accepted as planned).

## Self-Check: PASSED

All created files exist (`field.ts`, the fixture, `field-geometry.test.ts`, `landing-approach.test.ts`, `approach.spec.ts`) and the commits `095a9d0`, `9ec5ab3` and `31ea20c` are ancestors of HEAD. No scratch spec is left in `e2e/`.
