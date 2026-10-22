---
phase: 02-first-gradable-scenario
plan: 13
subsystem: debrief-and-gates
tags: [debrief, harmful-actions, order-lines, replay, exam-silence, blueprint, documents, final-gates]

requires:
  - phase: 02-first-gradable-scenario
    provides: grading and GradeResult (plan 02), session machine and debrief (plan 06), modal shell (plan 09), recursive outline (plan 11), leave-run, error and empty dialogs (plan 12)
provides:
  - src/ui/debrief-text.ts with reasonLines, formatClock, orderLine, harmfulLine (pure copy rules, Table T1)
  - order item in the debrief outline (Order kept / Order wrong lines under every ordered group)
  - the "Harmful actions (n)" section of the debrief with "{text} at m:ss" rows or "None."
  - e2e/replay.spec.ts (UI verdicts equal a node regrade of the recorded log; exam silence) and tests/blueprint.test.ts (no scenario facts in application code)
  - CLAUDE.md architecture, README sections, "Phase 2: owner review" section and its tests
affects: [phase 2 verification, phase 3 planning]

requirements-completed: [SES-03, SES-04, SCN-04, SCN-08]

actuals:
  tokens: 60000
  tasks: 3
  commits: 3

plan_head_before: 4f98e418857a45e63814b33e0cecc8882375f38d
plan_head_after: c332f01a5c25cd28703825f8add4c8c49f9708e8

tech-stack:
  added: []
  patterns:
    - "Debrief copy rules are pure functions of the GradeResult and the group data; the view only places them"
    - "The blueprint gate derives its forbidden literals from the parsed scenario file and the CAS rule table, so it follows the data"
    - "Replay identity is proven on the built app: the spec regrades window.__panel.events() in node with checkScenario and DA50RG_ENV and deep-equals the UI result"

key-files:
  created:
    - src/ui/debrief-text.ts
    - tests/debrief-text.test.ts
    - tests/blueprint.test.ts
    - e2e/replay.spec.ts
  modified:
    - src/ui/outline.ts
    - src/ui/screens/ChecklistOutline.tsx
    - src/ui/screens/Debrief.tsx
    - tests/outline.test.ts
    - e2e/scenario.spec.ts
    - .claude/CLAUDE.md
    - README.md
    - docs/PANEL-REVIEW.md
    - tests/panel-review.test.ts

key-decisions:
  - "An ordered group gets its order line as a separate outline item of kind order after the group's steps (the outline has no group node); unordered and muted groups get none"
  - "orderLine takes (group, result): the step texts of the violation come from the group's own steps, so the scenario argument of Table T1 is not needed"
  - "The exam-silence case treats the rotate hint (role status) as the one allowed status element and checks dialog, alertdialog, alert and aria-live as absent"

duration: 40min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 13: Complete debrief, replay and silence gates, documents, final gates Summary

**The debrief now lists reasons, an order line under every ordered group and the harmful actions with their virtual-clock time (increase POWER, then reduce it: PASS with "Increase power at 0:0x"); the built app is shown to give the same verdicts as a node replay of its recorded log and to stay silent during a run; scenario facts are kept out of application code by a gate; documents and the owner review list are brought up to date; all chromium gates are green.**

## Performance

- **Duration:** about 40 min
- **Tasks:** 3 (tracer, gates, documents and final gates)
- **Files:** 13 changed (4 created)

## Accomplishments

- `src/ui/debrief-text.ts`: `reasonLines` (PASS line, or one line per cause, each cause once, singular and plural), `formatClock` (whole seconds rounded down as m:ss), `orderLine` (none, "Order kept" or one "Order wrong: {expected} was expected before {before}" per violation) and `harmfulLine` ("{text} at m:ss").
- `src/ui/outline.ts` and `ChecklistOutline.tsx`: a new `order` item rendered as a meta line under the steps of an ordered group, debrief form only.
- `src/ui/screens/Debrief.tsx`: reasons from `reasonLines`; after the Steps section the heading "Harmful actions (n)" with one row per entry in log order or "None."; the order result, steps, harmful actions, action row of the UI-SPEC.
- `e2e/replay.spec.ts`: the golden run with a harmful POWER increase and one double tap on ENGINE MASTER (zoom and retract) is regraded in node and deep-equals `__panelSession.result()`, the retracted tap absent from the log; the exam case finds no aria-live, alert, alertdialog, dialog or status element (rotate hint excepted), result null, footer text unchanged apart from the run button.
- `tests/blueprint.test.ts`: scenario id, step and group ids, forbidden ids, the control ids of the steps and triggers, the CAS id and message must not occur in `src/engine`, `src/scenario` or `src/ui`; the CAS threshold must not occur as a number in `src/engine` or `src/scenario`. A planted literal was checked to fail the gate.
- Documents: CLAUDE.md architecture (scenario layer, engine additions, aircraft data, UI session layer) and one convention bullet on scenario files; README sections "Running a situation" and "Scenario files" and the `npm run validate` line; PANEL-REVIEW section "Phase 2: owner review" (15 items: U-05, U-09, U-13, U-15, U-16, content policy check, THROTTLE against POWER, grading semantics, debrief, exam silence, scenario files, assumptions of plans 01 to 13, gate results, WebKit outcome, publishing) and the updated last-section test.

## Task Commits

1. Task 1 (tracer): `a879567` feat(02-13): debrief reasons, order lines and harmful actions with their time
2. Task 2: `3143f5d` test(02-13): replay identity, exam silence and the blueprint gate
3. Task 3: `c332f01` docs(02-13): phase 2 architecture, README, owner review section and final gate results

Tracer gate: the Task 1 verify set (debrief-text and outline unit tests; scenario spec on desktop and phone chromium, 34 passed) passed after the work and before the commit, and again as part of the final suite before Task 2 started.

## Verification

- `npx vitest run`: 44 files, 2185 tests passed.
- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (1 scenario file checked, 0 problems) and `npm run build` exit 0.
- Chromium e2e with `PW_PORT=4333` on desktop-chromium, phone-chromium and tablet-chromium: 712 passed, 257 skipped, 0 failed (desktop 272 passed, phone 264, tablet 176).
- WebKit, one attempt (desktop-webkit, phone-webkit, tablet-webkit, phone-portrait): 710 passed, 580 skipped, 2 failed, recorded and not gated.
  - `phone-webkit` `e2e/avionics.spec.ts` "a single tap on standby_efis ..." failed with a harness error ("Cannot find parent object browser"); it passed when run again alone.
  - `phone-portrait` `e2e/scenario.spec.ts` "NEW SITUATION starts ENG OIL TEMP in its initial state" expects the idle footer lower than 52 px but the portrait phone footer wraps to 56 px. Pre-existing from plan 06, portrait is not a panel layout; no spec changed.
- Acceptance criteria: `grep -c "Harmful actions" src/ui/screens/Debrief.tsx` 1; `grep -c formatClock src/ui/debrief-text.ts` 2; `grep -c "@hooks" e2e/replay.spec.ts` 3; `grep -c "Phase 2: owner review" docs/PANEL-REVIEW.md` 1; `grep -c "packs-vite" .claude/CLAUDE.md` 1; `grep -c "npm run validate" README.md` 2.

## Assumptions taken

- `orderLine(group, result)` has two parameters, not the three of Table T1: the step texts come from the group itself, so the scenario is not needed.
- The order line is its own outline item (the outline model has no group node, as plan 11 recorded); "Order kept" is recognised by the text of the rule.
- The harmful rows use the class `outline-list` and the testids `debrief-harmful-heading`, `debrief-harmful-row` and `debrief-harmful-none`; the earlier testids are unchanged.
- The replay spec retracts a tap with a double tap on ENGINE MASTER (`sw.engine_master`), a latching control that no scenario reads.
- The blueprint gate scans raw file text including comments; it passed without any change to application code, so no comment had to move.
- `docs/PANEL-REVIEW.md` is not formatted by Prettier (it is outside `format:check`); it was edited by hand to keep the diff small.
- The plan's prohibition "STATE.md is not edited" conflicts with the dispatch instruction to update STATE.md and ROADMAP.md; the dispatch was followed (state verbs only, no hand edits).
- Exam silence includes the Leave run, load-error and empty dialogs only by absence: they appear only on a user press, never during an unattended run (note from plan 12).

## Deviations from Plan

None - plan executed exactly as written (apart from the assumptions above).

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. T-02-25 mitigated (replay spec deep-equals the regraded log, retracted tap included), T-02-26 mitigated (blueprint gate derived from data; proven to fail on a planted literal), T-02-27 mitigated (review section uses short names only, no quotes, no private paths; panel-review and content-policy hygiene cases pass). No package was installed (T-02-SC).

## Next Phase Readiness

Phase 2 has all 13 plans done. Open for the owner: the human check of the plan (first render on a real phone and a tablet against the list in the "Phase 2: owner review" section of `docs/PANEL-REVIEW.md`) and the instructor review of `docs/GRADING.md`. Phase 3 (reactions, live values, escalation) can build on the tick-based clock and the grading replay.

## Self-Check: PASSED

`src/ui/debrief-text.ts`, `tests/debrief-text.test.ts`, `tests/blueprint.test.ts` and `e2e/replay.spec.ts` exist; commits `a879567`, `3143f5d` and `c332f01` are ancestors of HEAD and the plan ledger measures 3 commits.
