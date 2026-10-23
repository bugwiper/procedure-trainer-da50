# Research notes: pitfalls that still apply

Condensed from the initial project research (removed in the cleanup; see git history for the full text). Stack rationale is in `STACK.md`.

## Engine and scenarios

- Grade a state-based model replayed from the event log, not a flat list of actions. Order, forbidden and harmful actions are constraints over the log (`docs/GRADING.md`).
- Reactions and timers run on the virtual clock only. No real timers in the engine, or tests and debrief replay become non-deterministic.
- The scenario schema must survive the fourth scenario and non-developer authors: strict objects, line-numbered errors, cross-reference lint, no scenario facts in engine or UI code.
- Control and scenario ids belong to a model (the registry), never to the SVG structure.

## Panel and input

- Touch is not "mouse events that also work": one Pointer Events path, `touch-action: none` on drag controls, 44 px hit targets, pan and pinch arbitration (gesture contract in CLAUDE.md).
- Keep the SVG element budget in check on phones; animate with attribute updates through signals, not tree re-renders. Do not assert layout in happy-dom.
- Test touch on WebKit and on real devices (open todo: real iPad check).

## Content, legal, safety

- AFM text: no copying beyond the owner-decided limits (`docs/CONTENT-POLICY.md`); the AFM revision can drift, so record which revision a scenario follows.
- No maker names or marks on the panel (brand rule); no real photos or AFM text in the repo.
- The disclaimer (training aid, not a replacement for the AFM) is a real gate, not footer boilerplate: acknowledged on first run, repeated in the debrief.
- A debrief must not mislead: PASS means the recorded actions met the stored procedure, nothing more. State what is not graded.

## Hosting and gating

- GitHub Pages: base path, no History API routing, cache behaviour after deploys; the terms discourage commercial use, so paid packs need an external host.
- Client-side licence checks on static hosting are bypassable; design for that (seam in `STACK.md`), do not pretend otherwise.

## Learning loop (Phase 7)

- Training and Exam mode must not leak the answer: hints, checklist visibility and feedback differ per mode and are decided by `level`, never by the grade.
- Progress tracking (repeat to improve) should be one small persistence module from the start, not ad hoc `localStorage` calls.
- Accessibility basics for the trainer: visible focus and pressed states, contrast of annunciators, keyboard path for the non-panel steps.
