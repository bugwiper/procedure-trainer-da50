---
created: 2026-10-21
title: Reactions must mark consumed events so the log-level retract refuses them (Phase 3 rule)
area: engine
source: 01.1-35 (log-level retract, owner finding R3-Z3 in 01.1-OWNER-FINDINGS-R2.md, Round 3), plan 01.1-40 (the UI gesture)
---

Plan 01.1-35 gave `PanelStore` (`src/engine/store.ts`) a log-level retract: `retract(seq)` removes the LAST event from the action log (it appends no counter-event) and rebuilds the state from the log with `deriveState`. The UI uses it so a double click on a latching control zooms without leaving the first actuation behind (R3-Z3). This note is documentation for the planner of the reaction phase, not work for phase 01.1.

## The rule for Phase 3

- When the reaction layer consumes an event (a timer, ramp or trigger fired because of that event, for example the de-ice MAX run, a gear transit or an escalation), it must call `store.markConsumed(seq)` for that event, up to and including the newest event it used.
- `retract` then refuses every event at or below the watermark with the reason `consumed`, and refuses everything that is not the newest event with `not-last`. A retract is only valid for the newest event, and only until a reaction has consumed it.
- Nothing in phase 01.1 calls `markConsumed`: no reaction exists yet, and `src/ui` must not call it either (the gesture layer only calls `retract`).
- The pair window (350 ms, 24 px, same control) stays a UI rule of the gesture tracker. The engine has no clock and never receives a time for a retract, so a reaction that fires inside the pair window is protected by the watermark, not by a time check.

## What to check when building the reaction layer

1. Every path where a reaction reads an event from the log also raises the watermark (a test per reaction kind: after the reaction fires, `retract` of that event gives `consumed`).
2. A reaction that is armed by an event and later undone by a retract must not leave its timer running: either the reaction consumes the event only when it fires, or the reaction layer listens to `onRetract` and cancels what the removed event armed. Decide this with the reaction design; the store offers `onRetract(listener)` for it.
3. Sequence numbers are positions in the current log: after a retract the next accepted event takes the same seq again, so a reaction must not keep a seq as a long-lived key without the watermark check.
4. The debrief and the grading read the log only (`events()`); a retracted tap never happened and is not in it.
