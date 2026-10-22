---
phase: 02-first-gradable-scenario
plan: 11
subsystem: ui-session-briefing
tags: [briefing, checklist-outline, debrief, session, modal, playwright]

requires:
  - phase: 02-first-gradable-scenario
    provides: session machine and debrief (plan 06), branchStatuses and GradeResult (plan 02), modal shell and clock driver (plan 09), session area (plan 10)
provides:
  - briefing screen of the session (newSituation, startRun, backToPanel) over the unchanged panel
  - buildOutline view model and the hook-free recursive ChecklistOutline, shared by briefing and debrief
  - Briefing modal with source, revision, disclaimer, non-graded outline and exam note
  - debrief in outline form, pocket-card fixture and tests/outline.test.ts
affects: [02-12, 02-13]

actuals:
  tokens: 15000
  tasks: 2
  commits: 2

plan_head_before: 3a00b6ad3ecb4d61b4b6d2c5ab489e213ad5708b
plan_head_after: 973567f0f79dcb7c2dfd9e35349303638fb9eae5

tech-stack:
  added: []
  patterns:
    - "One recursive hook-free outline component rendered from a pure view model; branch statuses and verdicts come from the engine, the view evaluates nothing"
    - "Exam rule in the view model: the briefing form drops steps, groups and the children of a branch that does not apply"

key-files:
  created:
    - src/ui/outline.ts
    - src/ui/screens/ChecklistOutline.tsx
    - src/ui/screens/Briefing.tsx
    - tests/outline.test.ts
    - tests/fixtures/scenarios/pocket-card.toon
  modified:
    - src/ui/session.ts
    - src/ui/App.tsx
    - src/ui/stage.css
    - src/ui/screens/Debrief.tsx
    - tests/session.test.ts
    - e2e/scenario.spec.ts
    - e2e/clock.spec.ts

key-decisions:
  - "The briefing scenario lives in its own session signal (briefing: scenario plus engine branch statuses), not in scenario; scenario stays the scenario of the current or last run, so Back to panel leaves the last run exactly as it was"
  - "The group node is flattened in the outline: its steps appear at the group's level (Table O1); plan 13 adds the order line when it needs the group"
  - "Footer session height applies for every screen except free (briefing, running, debrief)"

requirements-completed: [SES-01, SCN-03, SCN-07, PLT-04]

coverage:
  - id: D1
    description: "NEW SITUATION opens a briefing over the unchanged panel with title, situation, source and revision, document line with checked date, disclaimer, non-graded outline, exam note, Start run and Back to panel"
    requirement: SES-01
    verification:
      - kind: e2e
        ref: "e2e/scenario.spec.ts#the briefing shows source, disclaimer and the outline over the unchanged panel"
        status: pass
      - kind: unit
        ref: "tests/session.test.ts#newSituation"
        status: pass
    human_judgment: false
  - id: D2
    description: "Start run sets the initial state on the full panel; Back to panel and Escape change nothing; the run clock starts at Start run"
    requirement: SES-01
    verification:
      - kind: e2e
        ref: "e2e/scenario.spec.ts#Start run starts in the initial state on the full panel"
        status: pass
      - kind: e2e
        ref: "e2e/scenario.spec.ts#leaving the briefing by button / escape changes nothing"
        status: pass
      - kind: e2e
        ref: "e2e/clock.spec.ts#the run clock does not exist during the briefing and starts at Start run"
        status: pass
    human_judgment: false
  - id: D3
    description: "Briefing and debrief render one recursive outline: briefing hides steps, groups and the children of a not-applicable branch; the debrief shows tags, verdicts, Not graded and muted children; nesting is real list nesting up to 3 branch levels"
    requirement: SCN-03
    verification:
      - kind: unit
        ref: "tests/outline.test.ts"
        status: pass
      - kind: e2e
        ref: "e2e/scenario.spec.ts#the debrief shows the outline with verdicts, Not graded and the branch that does not apply"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every scenario shows its source, revision and disclaimer in the briefing"
    requirement: SCN-07
    verification:
      - kind: e2e
        ref: "e2e/scenario.spec.ts#the briefing shows source, disclaimer and the outline over the unchanged panel"
        status: pass
    human_judgment: false
  - id: D5
    description: "The action row stays reachable on a phone in landscape and long lines wrap without horizontal scroll"
    requirement: PLT-04
    verification:
      - kind: e2e
        ref: "e2e/scenario.spec.ts#the briefing action row is reachable without scrolling the page"
        status: pass
    human_judgment: true
    rationale: "Wrapping of long lines at 375 px portrait is checked for the debrief card only (scrollWidth); reading comfort of the briefing on a real phone is a judgment call"

duration: 25min
completed: 2026-10-22
status: complete
---

# Phase 2 Plan 11: Briefing and recursive checklist outline Summary

**NEW SITUATION now opens a briefing (title, situation, `Source: AFM 03-08 ENG OIL TEMP, issue 018`, document with checked date, disclaimer, the non-graded decision card, exam note) over the unchanged panel; Start run begins the run, Back to panel or Escape leaves untouched; briefing and debrief both render one recursive, engine-fed `ChecklistOutline`.**

## Performance

- **Duration:** about 25 min
- **Tasks:** 2 (tracer, then one TDD task)
- **Files:** 12 changed (5 created)

## Accomplishments

- `src/ui/session.ts`: screen `briefing`; `newSituation` now ends there holding the opened scenario and `branchStatuses` in the new `briefing` signal; `startRun()` (briefing to running through the existing start, an illegal baseline falls back to free with a load failure) and `backToPanel()`; both are no-ops in every other screen.
- `src/ui/outline.ts`: `buildOutline(scenario, branches, mode, result?)` per Table O1, walking the procedure with the path scheme of `branchStatuses`; the briefing form drops steps, groups and the children of a not-applicable branch; the debrief form has tags, verdicts (`verdictOf`), "Not graded" and muted children without tag or verdict.
- `src/ui/screens/ChecklistOutline.tsx`: hook-free recursive renderer; a decision holds its branches in a nested `ul`, a branch holds its children in one; "Not applicable" and "Not graded" are visible words; steps keep `data-testid="debrief-row"` and `data-verdict`.
- `src/ui/screens/Briefing.tsx` on the modal shell (id `briefing`, Escape is Back to panel, Start run first so it takes focus). `App.tsx` mounts it, the footer is 52 px from the briefing until the debrief closes, Procedure complete is rendered (under the scrim) while briefing or running.
- `src/ui/screens/Debrief.tsx`: the flat verdict rows are replaced by a "Steps" section with the outline in debrief form; the old row styles are removed from `stage.css`, outline and briefing styles added.
- `tests/fixtures/scenarios/pocket-card.toon` (decision with two branches, populated not-applicable "If too low:", open "If not returning to green range:" holding a decision with one more branch, 3 branch levels) and `tests/outline.test.ts` (23 cases: fixture lints, both view-model forms, verdict mapping, muted children, real `ul` nesting depth, text-only rendering of a hostile string, no flat `.steps.map` in any view).
- e2e (`desktop-chromium`, `phone-chromium`): one shared `startRun` helper (NEW SITUATION, then Start run) for every earlier case in `scenario.spec.ts` and `clock.spec.ts`, plus Table E2 rows 1 to 5.

## Task Commits

1. Task 1 (tracer): `697b3dd` feat(02-11): NEW SITUATION opens the briefing with source, disclaimer and the decision card
2. Task 2: `973567f` feat(02-11): the debrief renders the recursive checklist outline, pinned by a pocket-card fixture

Tracer gate: the Task 1 verify set (scenario, session-area and clock specs on both projects, session unit tests, typecheck) was re-run end to end after the commit and passed before Task 2 started.

## Assumptions taken

- The plan told the debrief form of `buildOutline` to arrive test-first in Task 2, but it is one function with the briefing form, so it was written together with it in Task 1. RED was therefore observed where it was still red: the view tests (`Debrief.tsx` reads `.steps.map`, does not use the outline) and the Table E2 row 5 e2e case failed before `Debrief.tsx` was changed; the view-model cases passed at once.
- The plan's prohibition "STATE.md is not edited" conflicts with the dispatch instruction to update STATE.md and ROADMAP.md; the dispatch (sequential run on the phase branch) was followed.
- A group node does not appear in the outline model; its steps are emitted at the group's level. Plan 13's order line will need the group id, which the model can carry then.
- Outline rows carry no `aria-label` for lines and branches (their visible text already reads "{text}, Not graded" or "{label} Not applicable"); graded steps keep the "{tag}, {text}, {verdict}" label of the earlier debrief.
- Back to panel from the briefing returns the footer to its idle height (the briefing opens the 52 px session footer, leaving it shrinks again); only control states, log, chips and last run are guaranteed unchanged.

## Deviations from Plan

None - plan executed exactly as written (see Assumptions taken for the ordering of the debrief form and the STATE.md instruction).

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. T-02-20 mitigated: scenario strings are text children only (`tests/outline.test.ts` renders a hostile line as text; the raw-HTML gate of `tests/content-policy.test.ts` passes over the new files). T-02-21 mitigated: the briefing form drops steps, groups and the children of not-applicable branches (unit and e2e assert it). No package was installed (T-02-SC).

## Next Phase Readiness

Plan 12 (choose situation, leave-run confirm, error and empty states) can reuse the `briefing` session signal: a list row ends in the same briefing as NEW SITUATION. Plan 13 completes the debrief on top of the outline (order line under an ordered group, harmful actions) and runs the exam-silence gate over the briefing.

## Self-Check: PASSED

Created files exist (`src/ui/outline.ts`, `src/ui/screens/ChecklistOutline.tsx`, `src/ui/screens/Briefing.tsx`, `tests/outline.test.ts`, `tests/fixtures/scenarios/pocket-card.toon`); commits `697b3dd` and `973567f` are ancestors of HEAD and the plan commit ledger measures 2 commits; `grep -c "Steps outside the panel (not graded in this version)" src/ui/screens/Briefing.tsx` is 1, `grep -c startRun src/ui/session.ts` is 2, `grep -c buildOutline src/ui/outline.ts` is 2, `grep -c ChecklistOutline src/ui/screens/Debrief.tsx` is 2; `npx vitest run` (2131 passed), `npm run typecheck`, `npm run lint`, `npm run format:check` exit 0; `PW_PORT=4331 npx playwright test e2e/scenario.spec.ts e2e/session-area.spec.ts e2e/clock.spec.ts --project=desktop-chromium --project=phone-chromium` passed (38).
