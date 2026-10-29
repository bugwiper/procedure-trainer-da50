---
phase: 06-fuel-tank-and-engine-fidelity-and-the-engine-page
plan: 04
subsystem: CAS cautions, oil pressure, phase end
tags: [cas, pitot-stall-heat, oil-pressure, variants, documentation]
requires: [06-03]
provides: [pitot_heat, stall_heat, stall_heat_ground rules, stall_heat_timer_s, oil pressure tables, icing heat_off variant]
key-files:
  created:
    - src/aircraft/da50rg/oil-pressure-curve.ts
    - tests/heat-cas.test.ts
    - tests/oil-pressure.test.ts
    - e2e/heat.spec.ts
  modified:
    - src/aircraft/da50rg/{cas,quantities,physics}.ts
    - scenarios/icing/icing-unintentional.toon
    - scenarios/engine/eng-oil-temp-green.toon
    - tests/{cas,fire-scenarios,physics,grading,scenario-lint,scenario-tracer,session}.test.ts
    - e2e/icing.spec.ts
    - docs/{GRADING,PANEL-REVIEW,PANEL-LABELS}.md
    - README.md, .claude/CLAUDE.md
    - .planning/{REQUIREMENTS,ROADMAP,STATE}.md and three todos
status: complete
commits: 4
plan_head_before: 7d1159ca01a4f044e671f7f39646861f08c13223
plan_head_after: 12311fc8d98bde99c34b80317c7f5afb85f5ceb6
actuals:
  tokens: 45000
  tasks: 3
  commits: 4
metrics:
  completed: 2026-10-29
---

# Phase 6 Plan 04: pitot and stall heat cautions, oil pressure, phase end

PITOT HEAT and STALL HEAT cautions on the rocker with a 5 s ground cut-out, the oil pressure as two tables of the oil temperature and the lever, the icing situation with its heat-off start as the single variant `heat_off`, and the phase-end documents. (`commits: 4` counts the plan's work commits; this summary is the fifth.)

## What was built

- **Task 1 (tracer, 9d44d57):** rules `pitot_heat`, `stall_heat` (state checks, rocker off) and `stall_heat_ground` (band `cut` of the hidden `stall_heat_timer_s`, 0 to 60 s, warm to `STALL_HEAT_CUTOUT_S` 5), a rate model that counts 1 s per s on the ground with the heat on and resets within one step otherwise. The icing file moved into the commit because it no longer lints without the two listed messages.
- **Task 2 (f14d2f6):** `oil-pressure-curve.ts` (idle table, slope table), `oilPressureTarget` reads both at the live oil temperature; ENG OIL TEMP starts at 4.16 bar (the model value at 128 C and lever 75, green).
- **Task 3 (494bc01, 12311fc):** icing e2e (two chips at the Easy start, gone with the heat on, Realistic shows them after the onset), a ground-situation e2e, and the documents: GRADING.md (phase 6 index, "Pitot and stall heat", "Oil pressure"), PANEL-REVIEW.md items 24 to 29, PANEL-LABELS.md message rows, README, CLAUDE.md, requirements PNL-21..24 and SCN-14..16 ticked, roadmap (plans ticked, phase left for UAT), STATE.md position, todos.

## Deviations from Plan

1. **Stale plan text adapted.** The engine page is bare numbers with a new pointer shape, the glass header follows `sw.av_master` (06-02b, 06-02c) and every shipped scenario has a flight profile (06-03); none of this touched the plan's work. The deferred e2e failure of 06-03 was fixed by 7d1159c before this plan and passed again here.
2. **[Rule 3] Existing tests pinned the old 5 bar of ENG OIL TEMP** (`grading`, `scenario-lint`, `scenario-tracer`, `session`) and the cas tests' contexts had no `sw.pitot_stall_heat` state (the state predicate throws on a missing control). Updated to 4.16 and a context with the rocker; `physics.test.ts` "oil pressure rises with the load" now asserts the green band at levers 50 and 100 (the pressure at fixed oil temperature is in `tests/oil-pressure.test.ts`). Not in the plan's file list.
3. **The Realistic start of ENG OIL TEMP keeps the base 5 bar.** The onset block may not set `oil_pressure_bar` (lint L15: a start-decided branch reads it), so the Realistic run starts at 5 and settles toward the model value; it stays green.
4. **The icing file moved into the Task 1 commit** (see above); two todo renames (`git mv`, staged) were swept into the e2e commit 494bc01 by a plain `git commit`. No history was rewritten.
5. **The plan's H-03 holds, with the reading of Realistic:** the chip is 5.1 s after the onset (parameters, `ground_roll` among them, are set by the onset), tested per shipped ground file.

No plan conflict: lint accepts the single variant, rule L14 is satisfied, and `tests/fixtures/recordings.json` and every recorded grade are unchanged.

## Verification

Cleared Vitest cache: 71 files, 3599 passed. typecheck, lint, format:check exit 0; `npm run validate`: 10 scenario files, 0 problems. Full Playwright, fresh `PW_PORT=4527`, all seven projects: 2388 passed, 881 skipped, 0 failed (desktop-chromium 416, desktop-webkit 394, phone-chromium 407, phone-webkit 310, tablet-chromium 318, tablet-webkit 310, phone-portrait 233 passed).

## Known Stubs

None. Not built on purpose: a heat fault input, the electrical dependence of the heat, fuel scenarios, the alternator test (needs the owner's pages), the emergency landing (Phase 7).

## Self-Check: PASSED

Created files exist; commits 9d44d57, f14d2f6, 494bc01 and 12311fc are on the branch.
