---
phase: 01-deployed-playable-panel
plan: 02
subsystem: docs
tags: [content-policy, afm, copyright, readme]
requires: []
provides:
  - docs/CONTENT-POLICY.md with eight sections and an owner-decided verbatim limit (12 words)
  - README.md linking the policy with the training-aid notice
affects: [phase-02-scenarios, plan-06-about-screen-and-hygiene-test]
tech-stack:
  added: []
  patterns: [policy anchors (headings) relied on by later hygiene test]
key-files:
  created: [docs/CONTENT-POLICY.md, README.md]
  modified: [docs/CONTENT-POLICY.md]
key-decisions:
  - "Verbatim checklist step line limit: one printed line, at most 12 whitespace-separated words (project owner, 2026-10-20, option-a)"
  - "A line counts as verbatim when its wording matches the AFM line apart from whitespace and letter case"
requirements-completed: [CNT-03]
status: complete
commits: 2
plan_head_before: 12b09ab
plan_head_after: 7ed451f
actuals:
  tokens: 4000
  tasks: 3
  commits: 2
metrics:
  completed: 2026-10-20
---

# Phase 1 Plan 02: Content Policy Summary

AFM content policy (CNT-03) committed and linked from a new README, with the project owner's 12-word limit for verbatim checklist step lines recorded before any procedure text exists in the repo.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Tracer: policy, README, hygiene gate | 75df789 |
| 2 | Decision checkpoint: verbatim limit | no commit; resolved by the project owner (option-a: one checklist line, at most 12 words) |
| 3 | Write the chosen limit into the policy | 7ed451f |

## Outcome

- `docs/CONTENT-POLICY.md` has the title, sections 1 to 8, and the subsection "### Verbatim checklist step lines: limit" at the end of section 2, with the countable sentence, the verbatim-equality sentence, one compliant and one non-compliant invented example, and the decision record "Decided by the project owner on 2026-10-20 (option-a)."
- `README.md` links the policy and carries the training-aid notice.
- Hygiene gate: no tracked PDF, nothing tracked under `.input/`, `.input/` still git-ignored.

## Verification

- Policy structure and README link and AFM revision string: ok
- Hygiene (`git ls-files` shows no PDF or `.input/` file; `git check-ignore .input/` succeeds): ok
- "limit recorded" check for Task 3: ok

## Deviations from Plan

None - plan executed exactly as written. The only variation: the plan's verification one-liners were split into separate commands because the sandbox refuses compound git commands.

## Auth gates

None. The Task 2 decision checkpoint was resolved by the project owner in the orchestrator chat.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- docs/CONTENT-POLICY.md and README.md exist
- Commits 75df789 and 7ed451f exist on the branch
