---
phase: 09-emergency-landing-situations
plan: 04
subsystem: weighted follow-on, seeded Realistic draw, Realistic landing start, printed ditching situation, sea scene
tags: [follow_on, followOnFromSeed, offersRealistic, ditching, water_near, pack-landing]
requires: ["09-01", "09-02", "09-03"]
provides:
  - "follow_on as a list of one to four { pack, scenario, weight } targets (L33: no target twice, weight total above 0; L34 per list item)"
  - "followOnFromSeed (src/engine/follow-on.ts), Recording.followOn { seed, from }, Retry keeps it"
  - "offersRealistic: a landing situation starts at once on Realistic from its initial block, with no onset"
  - "DITCHING (booklet page 10) as a situation of its own in the pack landing, catalog tag DITCHING after page 9"
  - "scene ditching, cue water_near, waterGeometry shared by the windscreen and the PFD synthetic vision"
  - "ENGINE FIRE IN FLIGHT and T/O FIRE NO ABORT lead into the engine-off landing (2) and the ditching (1)"
affects: [09-05]
tech-stack:
  added: []
  patterns:
    - "a pure integer weighted draw on mulberry32 whose seed is recorded with the run and ignored by grade"
    - "one neutral art level (artLevel) that the PFD frame fills from the cue of the scene"
key-files:
  created:
    - src/engine/follow-on.ts
    - src/ui/panel/windscreen/water.ts
    - scenarios/landing/ditching.toon
    - tests/follow-on-draw.test.ts
    - tests/water-geometry.test.ts
  modified:
    - src/scenario/schema.ts
    - src/scenario/lint.ts
    - src/scenario/validate-all.ts
    - src/engine/further.ts
    - src/engine/grading.ts
    - src/aircraft/da50rg/further.ts
    - src/aircraft/da50rg/scenes.ts
    - src/aircraft/da50rg/cues.ts
    - src/aircraft/da50rg/quantities.ts
    - src/aircraft/da50rg/checklist-catalog.ts
    - src/ui/debrief-text.ts
    - src/ui/session.ts
    - src/ui/screens/Debrief.tsx
    - src/ui/App.tsx
    - src/ui/panel/windscreen/scenes.tsx
    - src/ui/panel/frames/SyntheticVision.tsx
    - src/ui/panel/frames/PfdFrame.tsx
    - scenarios/landing/pack.toon
    - scenarios/engine/eng-fire-in-flight.toon
    - scenarios/fire/takeoff-fire-no-abort.toon
    - docs/GRADING.md
    - docs/PANEL-REVIEW.md
    - README.md
    - .claude/CLAUDE.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
decisions:
  - "The 09-02 object form of follow_on is gone; one list shape, weight required (0 to 100)."
  - "The draw lives in src/engine/follow-on.ts; variants.ts is untouched, so every variant draw is bit-identical."
  - "A target without an aircraft entry falls back to the generic label; a shipped-file test requires an entry for every shipped target."
  - "continueToFollowOn(ref?) recomputes the offer from the session's own level and result; an absent ref is taken only where exactly one target is offered."
  - "The note of the emergency landing now reads 'No landing situation follows from this one.' and shows only where no follow-on is named (owner review item 16)."
  - "A scenario id that is also a scene id of the aircraft (ditching) is not a scenario fact for the blueprint gate; the exemption is pinned by a test."
  - "Wave bands run across the whole view (constant lateral extent), not along lines through the vanishing point."
metrics:
  duration: "two sessions (the session limit stopped the first inside task 3); two whole local Playwright runs of about 32 minutes and one Linux run of 47 minutes"
  completed: 2026-11-03
status: complete
requirements-completed: [CNT-06, SES-09, PNL-28]
commits: 5
plan_head_before: b05c97c1456405ffbc08d3bbb9933e10e62495fc
plan_head_after: eb17144
actuals:
  tokens: 38000
  tasks: 3
  commits: 5
---

# Phase 9 Plan 04: The weighted follow-on, the Realistic draw and the ditching Summary

ENGINE FIRE IN FLIGHT and T/O FIRE NO ABORT now lead into two situations: on Easy and Medium the debrief shows an Emergency landing button and a Ditching button and the pilot chooses, on Realistic one generic button draws by weight (two in three the engine-off landing, one in three the ditching) with a seed that is recorded with the run and kept by Retry, and the landing starts at once; DITCHING is booklet page 10 typed as printed, an engine-out glide over a sea whose wave bands come toward the pilot on the windscreen and the PFD, graded on the gear (critical) and the flaps (standard).

`commits: 5` is the measured count from `plan_head_before` to `plan_head_after` plus the summary commit that follows: four are mine (`8508870`, `2ed630a`, `70e31cf`, `eb17144`); the coordinator's `7f9902d` (plan 09-05) landed in between and is not counted in `plan_head_after`'s own work. The final documents commit follows this file.

## What was built

**Task 1, the machinery (`8508870`).** `schema.ts`: `FollowOnTarget` (pack, scenario, weight 0 to `MAX_WEIGHT`), `follow_on` a record from a conduct id to one to four targets (`MAX_FOLLOW_ON_TARGETS`). Lint L33 keeps its three key rules and adds a target listed twice and a weight total of 0; `validate-all.ts` hands L34 one entry per list item at the line of the item. Aircraft data: `followOn.targets` (pack, scenario, label, title) per conduct option, `defineFurther` rejects an empty text and a target listed twice, `FurtherSet.followOnTarget`. Engine: `followOnFromSeed` (first `mulberry32` value times the weight total, cumulative, the last positive target as the rounding fallback, RangeError for an empty list or a zero total), `Recording.followOn`, `offersRealistic`. UI: `followOnOffer` returns a button list (one per target with the aircraft text on Easy and Medium, one generic button without a ref on Realistic), `followOnTargets`, `furtherNote` suppressed whenever targets exist; `Debrief.tsx` renders the list (`data-follow-on` on the Easy and Medium buttons) and the reaction-time line only for a run with an onset (`hadOnset`); `session.continueToFollowOn(ref?)` draws with the injected rng on Realistic, records `{ seed, from }` in the new `followOn` signal and the recording, keeps it through `retrySeeds` (third record); `offersRealistic` replaces the `onset === undefined` guards in `openBriefing`, `setLevel` and the `LevelPick` prop. Test hook `followOn()` added to the e2e session hook. The two fire sources and the fixture `landing-source.toon` moved to the list form.

**Task 2, the ditching (`2ed630a`).** `scenarios/landing/ditching.toon`: rows 1 to 10, the two boxed rows of the swell and wind note, the boxed touchdown note, the boxes EVACUATE through doors and When outside inflate life vests (raft), typed from the photo of page 10 and compared with an independent hand-typed copy in `tests/checklist-reference.ts` (`tests/checklist-text.test.ts`). Graded: row 7 Landing Gear UP (critical, the gear starts down), row 8 Flaps LDG (standard). Engine-out from the first frame (`engine_stopped` 1, rpm, load, oil pressure, fuel flow and fuel pressure 0, OIL PRES shown), glide 77 kt and minus 300 fpm from 450 ft, `terrain_ft` 0, `finish` at altitude 0, `conduct: none`. Scene `ditching`, `WATER_LEVEL_FT` 0, cue `water_near` (`WATER_SIGHT_FT` 600), `waterGeometry` and the sea palette in `water.ts`, `SeaScene` in the windscreen and `SeaWaves` in the synthetic vision, `fieldLevel` renamed to the neutral `artLevel` and filled by `PfdFrame` from the cue of the scene, catalog entry DITCHING after EMERGENCY LANDING (ENGINE OFF), `ditching` in `landingScenes`, the target entry for the follow-on button.

**Task 3, wiring, docs, gates (`70e31cf`, `eb17144`).** The two fire sources name `landing-engine-off` (2) and `ditching` (1). Tests: the declared table of `shipped-further`, an aircraft entry and a positive weight total for every shipped target, the draw over the real source files, the blueprint check of the target labels. e2e: one button per target on Easy and Medium for both sources with Retry in each target, the Realistic draw per target through `forceFollowOn` (one generic button, no briefing, no level card, recorded seed that draws the target from the source file, Retry keeps it, no timing line), a landing from the chooser on Realistic. Documents: GRADING.md (R23 rewritten, R24 new, scenes and cues, the ditching section), PANEL-REVIEW.md (items 4, 5, 6, 16 rewritten, 18 to 25 new), README, CLAUDE.md, REQUIREMENTS, ROADMAP, the catalog todo.

## The debrief note (owner review item 16)

Decision: keep the mechanism, change the one aircraft-data line. Where a scenario names no follow-on for the final conduct (ELEC FIRE FLIGHT with the emergency landing picked) the debrief shows "No landing situation follows from this one."; the old sentence "The emergency landing itself is not trained yet." was no longer true. The note never shows where buttons are offered (`furtherNote` checks the declared targets). Alternative for the owner: remove the note altogether (delete `debriefNote`, one line plus the two tests that name it).

## Deviations from Plan

**1. [Rule 1 - Bug] The blueprint gate flagged the scenario id `ditching`.** The scene id and the scenario id are both `ditching` (owner decisions R-01 and R-03), and the UI names scene ids like all others. Fix: `tests/blueprint.test.ts` exempts scenario ids that are scene ids of the aircraft and pins the list to exactly `['ditching']`. The gate also flagged the target label as a literal inside component names; renamed the components `SeaScene` and `SeaWaves`. Commit `2ed630a`.

**2. [Rule 1 - Bug in specs] The conduct spec of `e2e/further.spec.ts` expected one follow-on button.** The first whole local run (task 3 gate) had 7 failures, one per project, all this case; I had run the sweep specs after task 2, when the file still had one target, and did not re-run `further.spec.ts` after the second target arrived. Fix in `eb17144`: the spec reads the target count from the shipped file. `further.spec.ts` then passed on all seven projects (112 cases).

**3. [Plan detail] Wave bands run across the whole view.** The plan said bands follow the law of `fieldGeometry`; the distance law is the same, but the first version drew the band sides along lines through the vanishing point, which showed as a stepped pyramid. Bands now have a constant lateral extent of 1.7 half widths (`WATER_LATERAL`). The band distances were tuned after screenshots (near edge 10, 14, 19, 27, 37, 50 at the start of the cue, so the waves show at level 0.25) and are listed in PANEL-REVIEW item 20.

**4. [Plan detail] Where the e2e cases live.** The Easy and Medium and the Realistic flows are written once over the target list from the shipped file and sit in `e2e/landing.spec.ts` (task 3 named it); `e2e/follow-on.spec.ts` was rewritten for the list and still carries the no-button cases. The Realistic cases run for both sources and every target (`@hooks`). No case was skipped or loosened.

**5. [Plan detail] No session test for the RangeError of the draw.** A file whose weights add up to 0 cannot be opened (L33 rejects it when the source is loaded), so the load failure of reason invalid cannot be reached through a lint-checked source; the RangeError itself is covered in `tests/follow-on-draw.test.ts` (empty list, zero total).

**6. [Plan detail] P-01.** The tree matched the end state of 09-03 as the plan describes it (one landing file, EMERGENCY LANDING first in its group, the object form in the two sources, ELEC FIRE FLIGHT without a follow-on). One difference: `landing.spec.ts` used `LANDINGS[0]`; it now finds `landing-engine-off` by id because the ditching joins the list.

**7. [Process] ROADMAP.md.** The 09-05 planner's uncommitted edits in `ROADMAP.md` and `09-CONTEXT.md` were left alone. The 09-04 commit staged HEAD's `ROADMAP.md` with only my two changes (`[x] 09-04`, row 4/4); the closing commit changes the row to 4/5 (09-05 planned) as the coordinator asked, again staging only that line.

## Verification

- `rm -rf node_modules/.vitest-cache && npx vitest run`: 93 files, 4456 tests, all passed (09-03 ended at 91 and 4360; `tests/follow-on-draw.test.ts` and `tests/water-geometry.test.ts` are new). `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (12 scenario files, 0 problems): clean. `BASE_PATH=/procedure-trainer-da-50/ npm run build`: `pack-landing-*.js` is in `dist/assets` and in the `sw.js` precache list (`tests/pwa-precache.test.ts` passes). `tests/fixtures/recordings.json` and `tests/grading.test.ts` are unchanged.
- Playwright, local, whole suite, first run (before `eb17144`): 3276 passed, 917 skipped, 7 failed (deviation 2).
- Playwright, local, whole suite, all seven projects (`PW_PORT=4408`, second run on `eb17144`): 3283 passed, 916 skipped, 1 failed. The one failure is `e2e/lever-skins.spec.ts:144` on phone-portrait, which died with the harness error `Cannot find parent object browser@... to create debugger@...` after 210 ms (a Playwright browser-object crash late in a 32 minute run, no assertion); it passed in the first whole run and in the Linux run, and 5 of 5 repeats of the spec on phone-portrait passed (`--repeat-each=5`); a class of its own, not a product failure and not skipped. Per project passed: desktop-chromium 549, desktop-webkit 522, phone-chromium 535, phone-webkit 437, tablet-chromium 446, tablet-webkit 437, phone-portrait 357 (plus the one failure).
- Linux image `mcr.microsoft.com/playwright:v1.64.1-noble` (`git archive` of `eb17144` into the session scratchpad, `npm ci`, `CI=1`, `--retries=0 --workers=4`, whole suite, 47 minutes): 3253 passed, 947 skipped, 0 failed, 0 flaky. Per project passed: desktop-chromium 549, desktop-webkit 522, phone-chromium 535, phone-webkit 427, tablet-chromium 446, tablet-webkit 427, phone-portrait 347. The 30 skips more than on macOS are the explicit `process.platform === 'linux'` WebKit touch skips of `e2e/run-help.spec.ts` and `e2e/sound.spec.ts` (Phase 7, 10 cases on each of the three touch WebKit projects); none of the 09-04 cases is among them, all landing and follow-on cases ran and passed in the image.
- Screenshots (scratch spec, deleted before the commit, in the session scratchpad `shots/`): `09-04-ditching-approach-start.png`, `09-04-ditching-approach-middle.png`, `09-04-ditching-approach-near.png` (a real Easy run at 0, 50 and 84 s), `09-04-debrief-two-buttons.png` (FAIL debrief of ENGINE FIRE IN FLIGHT with Retry, Emergency landing, Ditching, Next situation, Back to panel) and `09-04-ditching-checklist-sheet.png` (the printed rows 1 to 10 and the boxed rows as the sheet shows them).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-09-08: only typed rows are in `scenarios/landing/ditching.toon`, no photo or `.input/` path is in git or the documents (the review items name the page as "your photo of booklet page 10"). T-09-09: the typing was read against the photo twice (file and independent copy), every graded row, plain row and instructor-review value is in PANEL-REVIEW items 18 to 24. T-09-10: the draw is a pure integer function of the recorded seed (`tests/follow-on-draw.test.ts`, session replay case). T-09-11: L33 and L34 reject a duplicate, a zero total and an unknown target. T-09-12: `continueToFollowOn` recomputes the offer and ignores the argument on Realistic.

## Unverified / for the owner

- The typing of page 10 was checked by me against the photo and against a second copy that I typed from the same photo; it is not an independent human read (PANEL-REVIEW item 18).
- The look of the sea (colours, speed of the bands, how much of it shows above the glare shield) was judged from screenshots on desktop chromium only; the specs ran on all projects (item 20).
- The weights 2 and 1, the severities (gear critical, flaps standard), the 450 ft start and the constant minus 300 fpm are instructor-review values (items 19, 20, 22, 23).
- The level card hint "No briefing. The failure starts by itself." is unchanged and fits a landing poorly (item 24).
- The debrief with two buttons was looked at on desktop chromium only; the specs check the buttons on every project.
- Next situation after the engine-off landing now opens the ditching (catalog order, page 10 after page 9).

## Self-Check: PASSED

Created files exist (`src/engine/follow-on.ts`, `src/ui/panel/windscreen/water.ts`, `scenarios/landing/ditching.toon`, `tests/follow-on-draw.test.ts`, `tests/water-geometry.test.ts`); commits `8508870`, `2ed630a`, `70e31cf` and `eb17144` are ancestors of HEAD; no scratch spec is in the tree (`e2e/zz-*.spec.ts` deleted, the scripts live in the session scratchpad); `.planning/config.json` and `state.json` are untouched, nothing was pushed, no prettier run touched `docs/`.
