---
phase: 09-emergency-landing-situations
plan: 03
subsystem: printed emergency landing situation, pack landing, follow-on declarations, phase documents and gates
tags: [landing-engine-off, pack-landing, follow_on, catalog, shipped-landing]
requires: ["09-01", "09-02"]
provides:
  - "pack landing with the one printed situation LANDING ENGINE OFF (booklet page 9, EMERGENCY LANDING (ENGINE OFF)), typed verbatim"
  - "catalog entry EMERGENCY LANDING (ENGINE OFF), first of NON-ANNUNCIATED EMERGENCY PROCEDURES"
  - "follow_on of ENGINE FIRE IN FLIGHT and T/O FIRE NO ABORT into the landing; ELEC FIRE FLIGHT accepts the precautionary landing and has no follow-on"
  - "tests/shipped-landing.test.ts, the printed reference of page 9, e2e/landing.spec.ts"
affects: [09-04]
tech-stack:
  added: []
  patterns:
    - "a printed boxed table typed as boxed comment rows (text at the left, value in the action slot)"
key-files:
  created:
    - scenarios/landing/pack.toon
    - scenarios/landing/landing-engine-off.toon
    - tests/shipped-landing.test.ts
    - e2e/landing.spec.ts
  modified:
    - scenarios/engine/eng-fire-in-flight.toon
    - scenarios/fire/takeoff-fire-no-abort.toon
    - scenarios/fire/elec-fire-flight.toon
    - src/aircraft/da50rg/checklist-catalog.ts
    - src/engine/cas.ts
    - src/ui/panel/frames/CasChips.tsx
    - tests/checklist-catalog-reference.ts
    - tests/checklist-reference.ts
    - tests/scenario-tracer.test.ts
    - tests/shipped-further.test.ts
    - tests/panel-review.test.ts
    - e2e/follow-on.spec.ts
    - e2e/fire.spec.ts
    - e2e/checklist.spec.ts
    - e2e/further.spec.ts
    - docs/GRADING.md
    - docs/PANEL-REVIEW.md
    - README.md
    - .claude/CLAUDE.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .planning/phases/09-emergency-landing-situations/09-03-PLAN.md
decisions:
  - "Owner answer of 2026-11-03 applied (it overrides the plan): option C, only the engine-off situation ships; everything about landing-engine-power is dropped."
  - "ELEC FIRE FLIGHT gets no follow-on and accepts conduct_precautionary (owner: with engine power this is rather an alternate landing); the follow-on planned for it in D-04 and D-07 is dropped."
  - "The start is a dead engine from the first frame (the 09-02 fixture decision), not a spin-down: the page begins after the failure and no late message is needed."
  - "The Approach speed KIAS table is four boxed comment rows; row 15 follows it as printed."
  - "FLIGHT IDLE (FI) is graded as the lever at 10 percent travel or less (travel predicate), standard; the panel marks no FI position."
  - "The gliding speed row stays a plain line: no control sets the speed and no predicate on airspeed_kt would be a pilot action."
metrics:
  duration: "about 6 hours wall clock including three whole-suite runs (the session limit interrupted once)"
  completed: 2026-11-03
status: complete
requirements-completed: [CNT-06]
commits: 6
plan_head_before: d69c42de0bebee85add4df8ac1273ece13cbb468
plan_head_after: a641fa1
actuals:
  tokens: 70000
  tasks: 3
  commits: 6
---

# Phase 9 Plan 03: The printed engine-off emergency landing Summary

A pilot who ends ENGINE FIRE IN FLIGHT or T/O FIRE NO ABORT on the emergency landing continues through the debrief button into LANDING ENGINE OFF, the booklet page 9 checklist typed as printed, glides at 94 kt with a dead engine toward the field, prepares on the panel and the sheet, and passes at Procedure complete or at the field; a pilot who does nothing fails.

`commits: 6` is the measured count from `plan_head_before` to HEAD. Four are mine (`dfe2ab9`, `29ff213`, `473981a`, `a641fa1`); two are the coordinator's `docs(09)` commits for plan 09-04 (`d240e8e`, `1f566a3`) that landed in between. The final summary commit follows this file.

## Owner answer applied (overrides the plan)

1. Task 1 (owner checkpoint) is satisfied: the owner delivered booklet page 9 (EMERGENCY LANDING (ENGINE OFF)), page 10 (DITCHING, not part of this plan) and a page that is not used. Answer C: the booklet has no checklist for an emergency landing with engine power, so only the engine-off situation ships. Removed from the plan: scenario file, pack entry, catalog entry, tests, e2e and docs of landing-engine-power. Task 3 reduced to the sweep of the generic specs (below). The plan text (`09-03-PLAN.md`: files list, an "Owner answer" section) and `09-CONTEXT.md` (a "Resolved 2026-11-03" line under the open question) say so.
2. ELEC FIRE FLIGHT: no follow-on, `conduct_precautionary` accepted instead of `conduct_emergency`. Noted in the PANEL-REVIEW Phase 7 table (item 9 table, item 18 table) and in the Phase 9 section (item 14); the unit declaration table and the e2e golden changed with it. D-04 and D-07 of the context are superseded.
3. `09-CONTEXT.md` also carries the coordinator's own uncommitted edits (rework decisions R-01 to R-09 for plan 09-04) and `09-04-PLAN.md` is untracked; they are not mine and were left uncommitted, including my one-line "Resolved" addition to the context, so the coordinator commits the file as a whole.

## What was built

**The situation.** `scenarios/landing/landing-engine-off.toon`: heading, rows 1 to 15 with their printed actions, the comment line "On final / before touchdown:" before rows 12 to 14, the boxed table (heading row Approach speed KIAS, then Flaps UP 94, Flaps T/O 85, Flaps LDG 77) after row 14, row 15 after it. Typed from the photo and compared row by row with an independent hand-typed copy in `tests/checklist-reference.ts` (`tests/checklist-text.test.ts` reads both). Graded on the panel: row 3 Power lever FI (travel 10 percent or less, standard), row 4 Engine master OFF (critical), row 9 Fuel valve OFF (critical), row 10 Emergency fuel pump OFF (standard), row 11 Fuel transfer pump OFF (standard), row 12 Doors UNLATCH as the door release lever open (standard), row 14 Flaps T/O or LDG (state_in, standard), row 15 Electric master OFF (critical); every row its own unordered group. Plain lines ticked on the sheet: 1, 2, 5 to 8, 13. Start: dead engine from the first frame (rpm, load, oil pressure, fuel flow and pressure 0, OIL PRES shown), emergency fuel pump and fuel transfer pump on (the restart attempt; lint rejects a step that is true at the start, so they must start on) with the FUEL TRANS advisory at the first frame (`fuel_trans_active` 1). Glide 94 kt, minus 900 fpm, from 2900 ft (1500 ft above the terrain, field in sight): a do-nothing run reaches the field after about 100 s. Further actions: conduct none, MAYDAY recommended, PAN PAN PAN optional, brief passengers recommended. `finish` at the terrain height.

**Wiring.** Pack `landing` (title Emergency landing, manifest title LANDING ENGINE OFF, 18 characters). Catalog entry EMERGENCY LANDING (ENGINE OFF) first in the emergency group (page 9 before page 16), plus the independent reference and the listing order (Next situation after ALTN 2 FAIL opens the landing). `follow_on` data edit in `eng-fire-in-flight.toon` and `takeoff-fire-no-abort.toon`; the golden recordings and `tests/grading.test.ts` are untouched.

**Tests.** `tests/shipped-landing.test.ts` (9 cases, files found from the manifests: lint clean, terrain not set, finish and conduct none, do-nothing reaches the finish between 60 s and 600 s, every panel row names a registry control, the file's own panel steps pass, omitting any critical step fails, do nothing fails with all critical rows missed, every follow-on target of every shipped scenario exists and is a landing). `tests/shipped-further.test.ts` got a follow-on column, rows for the landing and the changed ELEC FIRE FLIGHT, and the ground-or-landing-scene rule. Blueprint gate: confirmed it fails when a scenario id is planted in `src/engine` (plant removed). `e2e/landing.spec.ts` (5 cases): ENGINE FIRE solved on the panel, debrief PASS with the button, briefing with the level card skipped, the footwell shows the three calls and no conduct or Avoid button, the scene and PFD field, rpm 0, the panel steps, PASS with the Further rows; T/O FIRE NO ABORT into the same landing and PASS; a do-nothing run ends by itself with the finish text, FAIL and the critical rows Missed; no button without the emergency landing; ELEC FIRE FLIGHT accepts the alternate landing and shows no button.

**The sweep (task 3 reduced).** Specs that loop over the shipped scenarios needed these changes, none loosened: `e2e/follow-on.spec.ts` switched from the wire patch to the shipped target (title read from the target's own pack; the no-follow-on case now uses ELEC FIRE FLIGHT); `e2e/fire.spec.ts` ELEC FIRE FLIGHT golden picks `conduct_precautionary`; `e2e/checklist.spec.ts` gets the landing in its table loop and accepts a boxed row without a reference; `e2e/further.spec.ts` expects the follow-on button instead of the note for the engine fire; `tests/scenario-tracer.test.ts` (pack list), `tests/checklist-catalog-reference.ts` (listing order). The loop, pack, run-help, scenario and pwa-offline specs needed no change and pass with the new entry.

## Deviations from Plan

**1. [Rule 3 - Blocking] The blueprint gate found the CAS message of the new start state.** Listing FUEL TRANS in the scenario made two comments (`src/engine/cas.ts`, `src/ui/panel/frames/CasChips.tsx`) forbidden literals; reworded to "the message of the transfer pump" (comments only, commit `dfe2ab9`).

**2. [Rule 1 - Bug in specs] Two specs not yet aware of the new content.** The first whole local run had 14 failures, all of two specs (the printed-table spec for a boxed row without a reference, 7 projects; the conduct spec expecting the old note for the engine fire, 7 projects). Fixed in `a641fa1`; the second whole run is clean.

**3. [Plan detail] Table as boxed comment rows.** The schema has no table node; the icing file's pipe rows render as plain text, so the page's frame is carried by four boxed comment rows (stacked, not one frame). Listed for the owner (PANEL-REVIEW item 12).

**4. [Plan detail] Task 3 reduced, task 2 e2e extended.** See the owner answer. The e2e does not read `.input/` and the docs name the photos only as "your photo of booklet page 9".

Nothing else differs. `.planning/config.json` and `.planning/state.json` were not touched, nothing was pushed, no scratch spec or prettier run on `docs/` remains.

## Verification

- `rm -rf node_modules/.vitest-cache && npx vitest run`: 91 files, 4360 tests, all passed (09-02 ended at 90 and 4339). `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (11 scenario files, 0 problems): clean. `BASE_PATH=/procedure-trainer-da-50/ npm run build`: `pack-landing-*.js` is in `dist/assets` and in the `sw.js` precache list (`tests/pwa-precache.test.ts` passes). `tests/fixtures/recordings.json` and `tests/grading.test.ts` unchanged.
- Playwright, local, whole suite, all seven projects (`PW_PORT=4407`, clean second run): 3171 passed, 917 skipped, 0 failed. Per project passed and skipped: desktop-chromium 533 and 51, desktop-webkit 506 and 78, phone-chromium 519 and 65, phone-webkit 421 and 163, tablet-chromium 430 and 154, tablet-webkit 421 and 163, phone-portrait 341 and 243.
- Linux image `mcr.microsoft.com/playwright:v1.64.1-noble` (`git archive` of `a641fa1` into the session scratchpad, `npm ci`, `CI=1`, `--retries=0 --workers=4`, whole suite): 3141 passed, 947 skipped, 0 failed, 0 flaky. Per project passed and skipped: desktop-chromium 533 and 51, desktop-webkit 506 and 78, phone-chromium 519 and 65, phone-webkit 411 and 173, tablet-chromium 430 and 154, tablet-webkit 411 and 173, phone-portrait 331 and 253. The 30 skips more than on macOS are the known Linux WebKit touch class (the pad taps of CHECKLIST, HINT and Sound specs, Phase 7); the 35 landing and 35 follow-on cases all ran and passed in the image.
- Screenshots (scratch spec, deleted before the commit; saved in the session scratchpad `shots/`): `09-03-fire-debrief.png` (FAIL debrief with Retry, Emergency landing, Next situation, Back to panel), `09-03-landing-briefing.png`, `09-03-landing-approach-start.png`, `09-03-landing-approach-60s.png`, `09-03-landing-approach-92s.png` (field growing in the windscreen and the PFD), `09-03-landing-sheet.png` and `09-03-landing-sheet-bottom.png` (the sheet with the printed table as four boxed rows and row 15 after it), `09-03-landing-debrief.png` and `09-03-landing-debrief-bottom.png` (finish line, rows, Further actions).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-09-05: only typed rows are in `scenarios/`, no photo or path to `.input/` is in git, docs name the page only as booklet page 9. T-09-06: the typing is checked row by row against an independent hand-typed copy and the file header and PANEL-REVIEW items 10 to 13 list every choice. T-09-07: no stand-in text; `scenarios/landing/` appeared only after the owner's delivery.

## Unverified / for the owner

- The typing was checked against the photo by me and by the reference table; a second human read against the page is item 10 of PANEL-REVIEW Phase 9.
- FI as 10 percent travel, the severities, the start state with both pumps on, the 100 s glide (2900 ft, minus 900 fpm) and the stacked boxed table are instructor-review choices (items 11 to 13).
- The debrief note "The emergency landing itself is not trained yet." still shows where a scenario names no follow-on (for example the emergency landing picked in ELEC FIRE FLIGHT); the sentence is no longer quite true (item 16).
- The look of the boxed table and the debrief on a very narrow phone was checked only on desktop chromium by eye; the specs ran on all projects.
- Next situation after ALTN 2 FAIL now opens the landing (catalog order, as the owner asked for page order).

## Self-Check: PASSED

Created files exist (`scenarios/landing/pack.toon`, `scenarios/landing/landing-engine-off.toon`, `tests/shipped-landing.test.ts`, `e2e/landing.spec.ts`); commits `dfe2ab9`, `29ff213`, `473981a` and `a641fa1` are ancestors of HEAD; no scratch file is in the tree; `.planning/config.json` and `state.json` are untouched (still modified in the working tree from before this plan).
