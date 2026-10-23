---
created: 2026-10-23
title: Checklists verbatim and as numbered table
area: content
source: owner UAT of phase 3, test 10
---

## Owner decision (2026-10-23)

Checklists must reproduce the official checklist 1:1: no rephrasing, no paraphrasing, because the wording matters for training. Copyright is not a concern: the AFM and its checklists are publicly available. This overrides the own-words rule in `docs/CONTENT-POLICY.md` and the "no AFM text committed" convention in `.claude/CLAUDE.md` for checklist text. The rest of the AFM (long prose) is not asked for.

## Format (blueprint)

- Each checklist row has a number, an item and a desired action. Number and item are left-aligned, the desired action is right-aligned (like the printed checklist, with dotted leaders if it looks right).
- Between two consecutive numbers a comment row may span the whole line, for example the "Carry out: EMERGENCY LANDING (ENGINE OFF)" line, or "Select appropriate emergency landing area".
- Rows that are not panel actions (airspeed, front windows, doors) stay visible in the table but are not graded.

## Work

1. Scenario schema: a checklist structure with numbered rows (number, item, desired action) and comment rows, keeping the graded steps linked to rows (the panel steps are graded, others are display only). Lint: numbering is consecutive, every graded step belongs to a row.
2. Replace the shipped checklist lines of all three scenarios with the verbatim official text (the owner supplied photos of ALTN 1 FAIL, ALTN 2 FAIL and Engine Fire in flight; ENG OIL TEMP needs its page).
3. Briefing (Easy) and debrief render the table (`src/ui/outline.ts`, `src/ui/screens/ChecklistOutline.tsx`).
4. Update `docs/CONTENT-POLICY.md`, the convention lines in `.claude/CLAUDE.md`, and any test or lint that caps a step line at 10 words or forbids AFM wording; keep the private-photo rule (photos stay in `.input/`).
5. Related: the optional squawk step in Engine Fire is unrealistic (ELECT. MASTER off kills the transponder); keep it as a blueprint until the scenarios are refined in later phases.
