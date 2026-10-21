---
created: 2026-10-21
title: Review warnings hardening (WR-01, WR-02, WR-04, WR-05, WR-06, WR-07 and the info items)
area: engine, ui
source: .planning/phases/01.1-panel-shape-controls-and-indicator-lights/01.1-REVIEW.md and 01.1-REVIEW-DISPOSITION.md (code review of 2026-10-21, standard depth)
---

CR-01 (right and middle mouse buttons operated knobs and lever handles) and WR-03 (a pinch-in on a narrow zoomed view snapped wider) are fixed. The rest is open. Do the engine items before the Phase 3 reaction layer attaches listeners; the rest is scheduled explicitly.

## Engine, before Phase 3 (`src/engine/store.ts`, `src/engine/registry.ts`)

- **WR-01** A throwing store listener leaves the event committed but skips later listeners and replaces the dispatch result (same in `retract`: the log is already shortened). Isolate each listener, collect errors, report after all ran. Caller to check: `src/ui/panel/tap-intent.ts` reads a thrown retract as a refusal and then actuates the second tap.
- **WR-02** `retract` and `markConsumed` address an event by `seq`, a log position that the next event reuses. Give events a monotonic unique id (or compare event identity against the newest log entry). Related to the consumed-event rule in `2026-10-21-retract-consumed-events-phase3.md`.
- **WR-07** `events()` and dispatch hand out the mutable event objects that sit in the log. Freeze events with the WR-02 change.
- **WR-04** `defineRegistry` does not validate hit size (finite, positive), `guardOpenHit`, `track.length` against the hit along the track, region bounds inside the viewBox, a control footprint inside its region, and the arrays inside specs are not deep-frozen. Latent until YAML packs or scenario-driven control lists exist (Phase 2 or later).

## UI

- **WR-05** Controls are `<g role="img">` with pointer handlers only: not focusable, not keyboard operable (`widgets/Toggle.tsx`, `CircuitBreaker.tsx`, `MomentaryButton.tsx`, `Rotary.tsx`, `DetentLever.tsx`, `GuardedToggle.tsx`, `Panel.tsx`). Needs the correct roles (`switch`, `button`, `slider`), `tabindex` and Enter/Space calling the same press targets as the gesture layer. Matches v2 requirement PNL-V2-02; decide the schedule.
- **WR-06** The Full panel button (`z-index` 30) paints above the About overlay (20) in `src/ui/stage.css`; the dialog has no focus trap and does not return focus to its opener (`src/ui/about/About.tsx`, `src/ui/App.tsx`). Small CSS and dialog fix.

## Info items (housekeeping, IN-01 to IN-07 in the review)

Event timestamps are dispatch time, not the pointer time (matters once hold durations are graded; decide before Phase 3 consumes durations); module-level zoom state in `zoom.ts`; placards and the temperature triangle drop silently on an unresolved reference (`PanelShell.tsx`); `?regions=1` is reachable in production; 28 px footer targets; duplicated geometry; a gauge division. Read the exact list in `01.1-REVIEW.md`.
