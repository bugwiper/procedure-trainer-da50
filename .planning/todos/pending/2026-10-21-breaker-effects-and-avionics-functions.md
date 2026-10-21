---
created: 2026-10-21
title: Deferred behaviour of the circuit breakers and the avionics units (breaker effects, DISPLAY BACKUP, audio, autopilot, glass-display menu functions, arming gate)
area: panel, engine
source: 01.2-02 to 01.2-09 (breaker kind, glass shape, avionics units), UI-SPEC 01.2 D-02, D-05, D-06, Q2-01 and Q2-05 in docs/PANEL-REVIEW.md, plan 01.2-09
---

Phase 01.2 draws the 51 circuit breakers, the glass display shape and the three avionics units (audio panel, backup EFIS, autopilot panel) with their knob and key columns. Every breaker moves and is recorded; the avionics keys, knobs and buttons are art. The behaviour below was deliberately not built. Reason for the deferral: no reaction layer and no engine clock exist before the scenario phases, the engine rule in CLAUDE.md forbids real timers in the engine or the UI (tick events with an injected clock only), and none of it is needed to draw or grade the panel yet. Building it now would be thrown away or guessed.

## To build when scenarios need it

1. **Breaker effects on systems and lamps (Phase 3 reaction layer).** A pulled breaker should switch off or degrade the system it protects (for example PITOT removes pitot heat, GEAR WARN silences the gear warning, a bus breaker takes its equipment away). Today `cb.*` controls only record `in` or `out`; no lamp, gauge or other control reads them. Each effect belongs with the scenario that needs it, as declarative reactions in the scenario YAML, not as code in the panel. Breaker ids are flat `cb.name` (P2-11) so scenarios can reference them already.
2. **DISPLAY BACKUP function.** The red button on the audio panel is inert art (`data-display-backup`, no registry entry). A display-failure scenario will need a registry control `btn.display_backup` (momentary or latching, to be decided from the aircraft documentation) and the glass behaviour behind it (what the PFD and MFD show after the press). Add the registry entry, the reference row and the label-table row together.
3. **Audio panel functions.** The 21 keys and their lamp slivers (three are drawn lit as in one photo) have no function. Which lamps follow which key presses is not modelled.
4. **Autopilot panel functions.** The 12 keys and 4 knobs (and the NOSE UP / NOSE DN keys) do nothing. The LEVEL button of the gear block is likewise inert (U-11 of the first review).
5. **Glass-display menu structures.** The 23 inert softkeys, the other legend tabs, the FMS and CRS/BARO knobs, the RANGE joystick and the direct-to, MENU, FPL, PROC, CLR and ENT keys open no pages and no menus. Only `sw.mfd_page` switches the MFD between its map page and its engine page. Menu pages would be glass content and need their own static text review (G-0.1).
6. **Optional arming gate for breaker taps (Q2-05).** At the full view on a phone a breaker hit is about 4.5 px, so a stray touch can pull one. Default taken: no gate (literal D-02); the region zoom is the phone answer. If the owner wants a mitigation: a widget-level gate in `src/ui/panel/widgets/CircuitBreaker.tsx` that falls through to the region zoom while the on-screen hit side is under about 20 px. The tap-size rule in `viewport.ts` already knows the on-screen size.
7. **Width decision cost (Q2-01).** Resolved by the owner: the panel space is 2180 x 1300. The recorded cost is about 8 percent smaller full-view scale on tablet and portrait phone. Revisit only if the morning review finds the tablet or portrait view too small; the way back is described in P2-01 of `docs/PANEL-REVIEW.md`.

## Layout finding of the final gates (tablet)

On a tablet in landscape (the `tablet-webkit` project, iPad viewport; it reproduces with the same viewport in chromium, so it is not an engine problem) the case "the Full panel button covers no breaker hit in any breaker region" in `e2e/breaker.spec.ts` fails for the region `cb_main`: the button covers the hit of `cb.main_pump`, the right breaker of row A3 (region `cb_essential`, group main), which is still in view when the MAIN region is zoomed. The two chromium gate projects (desktop, phone landscape) pass. Options: move the Full panel button on tablet-sized viewports, or scope the case to the hits of the zoomed region and accept that a neighbouring breaker is covered until the user zooms into its own region. Not fixed in plan 09 (no source change allowed there).

## Cleanup candidates (not done, src is out of scope of the documents plan)

- `UnitHousing` in `src/ui/panel/frames/UnitHousing.tsx` is no longer registered in `Panel.tsx` since plan 08 (the three housed units draw their own housing). Its helpers `HousingRect` and `UnitGroup` are used; the `UnitHousing` function and its two describe blocks in `tests/avionics.test.ts` can go in a later cleanup (P2-15).

## Open questions

- Q2-05: arming gate for breaker taps? Default taken: no.
- The ratings, label wording and the pulled look of the breakers are photo-derived (U2-06, U2-08); the straight-on close-ups the owner will add may move rows by 3 to 8 units (U2-30).
