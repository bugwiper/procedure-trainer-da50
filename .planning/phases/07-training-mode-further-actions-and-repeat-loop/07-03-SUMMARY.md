---
phase: 07-training-mode-further-actions-and-repeat-loop
plan: 03
subsystem: ui, docs
tags: [retry, next-situation, readme-guide, phase-end, owner-review]

requires:
  - phase: 07-01
    provides: mode axis, run view of the pad, hint
  - phase: 07-02
    provides: further actions, decisions in the recording, shipped declarations
provides:
  - "session.retry and session.nextSituation, retrySeeds (the one function that decides which seeds a retry keeps)"
  - "Retry, Next situation and Back to panel in the debrief"
  - "README section Writing a scenario with a complete worked example parsed and linted by tests/readme-guide.test.ts"
  - "docs/PANEL-REVIEW.md section Phase 7: owner review (11 items, D-13 table), GRADING.md retry rules, requirements and roadmap updated"
affects: [phase-8]

actuals:
  tokens: 21800
  tasks: 3
  commits: 3
plan_head_before: 5b25263e76c7d016c56b10a0240c48037e461ddd
plan_head_after: 0200a1cbdf86633a382b47d54e8a4705c10adf9d

tech-stack:
  added: []
  patterns:
    - "One exported pure function (retrySeeds) decides a rule the owner may change; start() takes optional seeds and then draws nothing"
    - "A README example is a real fenced block (info string toon example) that a test runs through checkScenario"

key-files:
  created:
    - e2e/loop.spec.ts
    - tests/readme-guide.test.ts
    - .planning/todos/pending/2026-11-01-phase-7-deferred.md
  modified:
    - src/ui/session.ts
    - src/ui/App.tsx
    - src/ui/screens/Debrief.tsx
    - tests/session.test.ts
    - tests/modal.test.ts
    - tests/panel-review.test.ts
    - README.md
    - docs/GRADING.md
    - docs/PANEL-REVIEW.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .claude/CLAUDE.md

key-decisions:
  - "Retry reuses both recorded seeds (onset with its seed on Realistic, variant on every level) and draws nothing; the owner's alternative is a change of retrySeeds and its test"
  - "Next situation goes through the free-panel cleanup (RESET semantics) after the next scenario loaded, keeps mode and level, and on Realistic without an onset shows the level card with the mode kept"
  - "Debrief buttons: Retry is the one primary button (first), Next situation and Back to panel are secondary"
  - "The README example is a toy (HOT OIL TOY) built from the ENG OIL TEMP structure in own wording, with a cue and parameter (oil_streaks, oil_leak) that pass lint L23"

requirements-completed: [SES-06, CNT-02]

duration: 85min
completed: 2026-11-01
status: complete
---

# Phase 7 Plan 03: Retry, Next situation, README guide and phase end Summary

**From the debrief a pilot can retry the same situation (same cause, same onset, clean start, same mode and level) or move to the next one in listing order; a developer can add a scenario by following a README section whose complete example is linted by a test; the phase documents, the requirements and the roadmap are updated and every final gate is green.**

## Accomplishments

- `src/ui/session.ts`: `retrySeeds(onset, variant)` (exported, pure), `start(opened, realistic, seeds?)` (with seeds nothing is drawn; without them the draws and their order are unchanged), `retry()` (debrief only, not while busy; cleans up like closeDebrief, then a normal start of the scenario of the debrief; an illegal baseline is a load failure), `nextSituation()` (debrief only, not busy; entry after the current one in `listChoices` order, wrapping; `openBriefing` got a keep flag that runs the free-panel cleanup, keeps mode and level, starts the run at once on Realistic with an onset, shows the level card on Realistic without one, else the briefing).
- `Debrief.tsx` and `App.tsx`: Retry (primary, first), Next situation, Back to panel.
- `README.md`: new section Writing a scenario (where files go, TOON rules, the worked example, the predicate table, `npm run validate` with a real failing message, variants, scene and cues, flight profile, further section and ground rule, how the hints are derived, how to play). The old Scenario files section is folded in; Running a situation corrected (mode card, pad, further actions, Retry and Next situation).
- `tests/readme-guide.test.ts` (8 cases): one heading, one `toon example` that passes `checkScenario(DA50RG_ENV)`, every `toon fragment` decodes, the scene, cue and further option lists equal the aircraft data both ways, the ids the examples use exist, every `npm run` script named exists, the section covers the topics.
- Documents: `docs/PANEL-REVIEW.md` section Phase 7: owner review (11 numbered items), `docs/GRADING.md` (a retry is a new run; section Retry and next situation), SES-02, SES-05, SES-06 and CNT-02 ticked with the new SES-05 text, ROADMAP criteria 2 and 4 reworded, three plans listed, progress row 3/3 Executed, awaiting UAT (phase checkbox left for the owner's UAT), deferred todo, one Phase 7 sentence in `.claude/CLAUDE.md`, Session area sentence in PANEL-REVIEW points to Phase 7.

## Task commits

| Task | Commit  | Content |
| ---- | ------- | ------- |
| 1 Tracer | 163acc4 | retry, nextSituation, retrySeeds, debrief buttons, 15 unit cases, `e2e/loop.spec.ts` (5 specs) |
| 2 | 7490cc0 | README section, `tests/readme-guide.test.ts` |
| 3 | 0200a1c | PANEL-REVIEW, GRADING, panel-review test, requirements, roadmap, todo, CLAUDE.md |

## Verification (final gates, this machine, macOS)

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run validate` (10 files, 0 problems): clean.
- `rm -rf node_modules/.vitest-cache && npx vitest run`: 80 files, 3958 tests passed (07-02 ended at 79 files, 3928).
- Playwright, whole suite, PW_PORT=4395, all seven projects in one run: 3612 specs (516 per project, 50 files), 2707 passed, 905 skipped (by design), 0 failed, 0 flaky, 20.5 min. No Linux-specific failure of the known kind appeared (this run was local). The per-project passed and skipped split was not recorded (line reporter); each project ran its 516 specs.
- Task checks on desktop-chromium and phone-chromium: `loop` (10), `scenario`, `variants`, `replay`, `further` (68) pass.
- Visual check (D-18): scratch spec, screenshots of the debrief with the three buttons on desktop-chromium, phone-chromium and phone-portrait; the buttons read, nothing is cut off; on the narrow portrait phone they wrap onto two rows right-aligned (Retry and Next situation on the first, Back to panel on the second). Scratch spec deleted, nothing under `e2e/` left over. Mutation check of the guide test: breaking the example (`is: opened`) makes `tests/readme-guide.test.ts` fail with the line, column and message.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/modal.test.ts` calls `Debrief` directly**
- **Found during:** Task 1 (typecheck after adding the required `onRetry` and `onNext` props)
- **Fix:** passed the two props, and updated the case that read the one primary button (the action row is now a fragment of three buttons, the case checks their order and handlers). **Commit:** 163acc4

**2. [Rule 1 - Bug in own test] a pack loads all its files at once**
- **Found during:** Task 1 (unit cases of the load failure and the busy guard)
- **Issue:** the provider's pack load reads every file of the pack, so a failing neighbour file fails the first start, and one call loads three files.
- **Fix:** the failure is set after the first run (the rig reads files at call time) and the busy case compares the loads of one call against a single-call rig. Test-only. **Commit:** 163acc4

### Plan variations (no change against the decisions)

- `tests/panel-review.test.ts`: the Phase 6.1 describe took everything to the end of the file as its section; it now ends at the next heading (needed so Phase 7 can be last), and its title case reads "follows Phase 6" instead of "is the last section". The heading-order case now ends with Phase 7.
- Retry's seeds are read from the live signals with the recording as fallback (both hold the same records in the debrief).
- Back to panel became a secondary-style button (it was the primary one); the test ids are unchanged.
- No `STATE.md`/`state.json` update: the brief forbids touching `.planning/state.json`, and earlier plan summaries did not update `STATE.md` either.

## Known Stubs

None.

## Owner review points

Listed in `docs/PANEL-REVIEW.md` "Phase 7: owner review" (items 1 to 11): card order, pad rows, hint rule and placement, portrait bottom sheet, the Further actions rules (last pick, single use, clock pause), the D-13 table and the missing "either call" role (icing), the ground rule, the emergency-landing note, the retry seed rule and the next-situation rule, the README section, what was not added.

## Threat Flags

None new. T-07-06 is mitigated by cases in `tests/session.test.ts` (both methods ignored outside the debrief and while busy; a retry goes through the same start and the same baseline check). T-07-07: the README example is own wording, `tests/content-policy.test.ts` and `tests/docs-format.test.ts` pass.

## Self-Check: PASSED

Created files exist (`e2e/loop.spec.ts`, `tests/readme-guide.test.ts`, `.planning/todos/pending/2026-11-01-phase-7-deferred.md`); commits 163acc4, 7490cc0 and 0200a1c are on the branch; `.planning/config.json` and `.planning/state.json` are untouched by the plan commits; nothing is pushed.
