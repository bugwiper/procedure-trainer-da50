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

## ENG OIL TEMP checklist (supplied by the owner as a photo, 2026-10-23)

This one is not a numbered table but a bulleted decision tree with its own symbols, so the format needs a second form next to the numbered table (a nested outline with the printed symbols). Title ENG OIL TEMP, caution OIL TEMPERATURE HIGH. Text as printed, with its structure:

- Check oil pressure
  - If too low:
    - Reduce power
    - Open cowl flap
    - Be prepared for loss of oil and engine failure
    - Be prepared for emergency landing (continuation line without an arrow)
  - If in green range:
    - Reduce power
    - Open cowl flap
    - Increase airspeed
    - Check oil temp in green range
      - If not returning to green range:
        - land at nearest suitable airfield

The printed bullets differ per level (arrow, diamond with arrow, double arrow, circle, square); keep them as the printed markers if they render in the panel font, otherwise pick equivalent glyphs and list them for the owner. The shipped scenario already has two branches (oil pressure too low, in green range), so the grading structure exists; the display structure must follow this tree.
