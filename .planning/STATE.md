---
gsd_state_version: "1.0"
current_phase: "01.2"
current_phase_name: Circuit breakers, G1000 shapes and avionics panels
current_plan: 9
status: executing
stopped_at: Completed 01.1-39-PLAN.md (round 3 gap closure, plans 33..41 on the 01.2 branch)
last_updated: "2026-10-21T18:56:14.903Z"
last_activity: 2026-10-21
last_activity_desc: "Plan 01.1-39 complete (round 3 gap closure, R3-Z2: momentary controls commit after 100 ms held still, drag controls keep their gesture and can be pinched over); plans 01.1-40..41 follow on the 01.2 branch"
state_head: 2c4036891c646eaa77aaee851eb720c8fcc2f4d9
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 58
  completed_plans: 56
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-19)

**Core value:** The user can run an emergency scenario by actually operating the panel controls, and gets accurate, objective feedback on whether they performed the AFM procedure correctly.
**Current focus:** Phase 01.2 — Circuit breakers, G1000 shapes and avionics panels

## Current Position

Phase: 01.2 (Circuit breakers, G1000 shapes and avionics panels) — EXECUTING
Current Plan: 9
Total Plans in Phase: 9
Status: All 9 plans of phase 01.2 complete; next is the verification step. Plan 09 (documents only, no src change) extended the label table with the avionics static labels, wrote the review list with Q2-01..Q2-10, U2-01..U2-37, P2-06..P2-15 and the section Round 3 (owner entry point), updated the README (92 controls, 13 lamps, 30 regions) and ran all gates: typecheck, lint, format, 1499 unit tests, build, 255 chromium e2e passed, live-conditions rehearsal 205 passed, WebKit 419 of 420 passed (one tablet layout finding: the Full panel button covers cb.main_pump while the MAIN region is zoomed; recorded in Round 3 and the todo). Earlier plans:  Plan 01 widened the panel space to 2180 x 1300 (right side only). Plan 02 added the circuit-breaker kind (flat cb. ids, states in and out) with one real breaker, cb.pitot, and derived the inventory gates from independent tables. Plan 03 built the bus panel frame: regions cb_main, cb_low, cb_strip (23 regions), the bus-panel plate, the three stair-step outlines with titles, three blank plugs, three pump boxes and the lower-row sub-panel, all as data (bus-boxes.ts) drawn by BusPanelArt. Plan 04 filled the grid with all 51 breakers (92 controls), with an independent reference, relation and containment gates, a label-clearance gate and an all-breaker e2e (1347 svg elements, budget 2500). Plan 05 gave both displays the 41-unit bezel lip, 12 triangle softkeys each (only sw.mfd_page is a control, 23 keys are inert art, new region pfd_softkeys, 24 regions), a glass header strip, a content band and a 12-slot legend row, with an e2e glass zone gate and a widened brand gate (1577 svg elements, budget 2500). Plan 06 added the six view-only avionics regions (pfd_bezel_left, pfd_bezel_right, audio_panel, standby_efis, autopilot_panel, mfd_bezel_right; 30 regions), reworked the centre-stack plate and added three unit plates (13 plates), replaced the placeholder outlines by region-owned housings announced as not operable, and added an e2e gate proving a tap only zooms (1604 svg elements, budget 2500). Plan 07 drew the three bezel knob and key columns as inert data-driven art (BEZEL_COLUMNS, BezelColumnFrame: 12 knobs, 2 joysticks, 3 swap buttons, 12 keys, each column group within 150 elements; 1773 svg elements, budget 2500). Plan 08 drew the audio panel (21 keys, 21 lamp slivers with 3 lit, volume knob, red DISPLAY BACKUP button), the backup EFIS (attitude display, tape display, knob) and the autopilot panel (4 knobs, swap button, 12 keys) as inert data-driven art (AUDIO_PANEL, STANDBY_EFIS, AUTOPILOT_PANEL; each group within 150 elements; 2023 svg elements, budget 2500; PNL-13 complete). Nothing was pushed; publishing is the owner's step. Phase 01.1 (23 plans) is complete.
Round 2 gap closure: STATE.md now also tracks the round-2 gap plans 24..31 of phase 01.1, which execute sequentially on this phase 01.2 branch (plan and SUMMARY files stay in the 01.1 directory). Done: plan 01.1-24 (shared e2e zoom helper, behaviour-neutral), plan 01.1-25 (R2-Z1: a single click or tap never zooms, a double click or double tap on the background zooms in and out, a double tap on a control stays two control taps), plan 01.1-26 (R2-T1: the Full panel button takes the corner that covers no control, tablet-chromium project in the chromium gate), plan 01.1-27 (R2-4.2: the parking brake is a hinged flap, flat released and a 60 degree wedge pulled, one tap toggles, tapToggle plus parking-flap as registry data), plan 01.1-28 (R2-4.1: the FAN has four direct click spots), plan 01.1-29 (R2-5.2: the engine strip as in the aircraft, FADEC and ALTERNATOR bracket groups with AUTO, FORCE B, TEST, ON, OFF and the framed numerals 1 and 2 as plate text, the four controls nameless, sw.fadec states ordered force_b then auto, gate that every shell label lies on a plate), plan 01.1-30 (R2-1.1: ON above OFF printed once per side of the four light rockers, left of LANDING and right of STROBE, as plate text at the heights of the upper and lower rocker halves, no drawing code changed). Plan 01.1-31 (documents, wording, final gates): README, PNL-15, PNL-09 and ROADMAP criterion 4 state the double-tap contract; docs/PANEL-REVIEW.md ends with "Round 4: morning review" (the owner entry point) and PANEL-LABELS follows the round 2 build; R2-5.1 is verified by a named e2e test; gates green on the three chromium projects (416 passed, live rehearsal 329 passed, vitest 1609); WebKit tried once with two findings recorded and left unfixed (the Full panel button catches the second tap on phone-webkit, the FAN f3 glyph centre sits on a spot edge). Round 2 gap closure (plans 24 to 31) is finished; phase 01.1 has 31 of 31 plans. Plan 01.1-32 (two WebKit findings of plan 31: the Full panel button ignores the stray click, FAN test points inside the spots) is done; the full WebKit run is 0 failed.
Round 3 gap closure (owner review of the live site at 8e4aa70, findings R3-* at the end of 01.1-OWNER-FINDINGS-R2.md): plans 01.1-33..41 execute sequentially on this phase 01.2 branch (plan and SUMMARY files stay in the 01.1 directory). Done: plan 01.1-33 (R3-1.1: the bus titles are plain unstroked text over a plate-coloured cut rectangle, busTitleCut as data, no shell text may carry a stroke, gate runs on every landscape project and passed on desktop-webkit and phone-webkit). Plan 01.1-34 (R3-4.1: the pulled parking brake is one four-point plate hinged on the level bottom line, shorter parallel top edge shifted right, in the flap's grey; the wedge is gone; a geometry gate pins the sketch relations; top edge 0.7 of the base is a middle value between the owner's words and the sketch, recorded for the owner's review). Plan 01.1-35 (R3-Z3, engine side: PanelStore.retract removes the last event from the log and rebuilds the state from the log with deriveState; markConsumed and a consumed watermark are the Phase 3 seam, refused with consumed, not-last or unknown-event; onRetract and bridge.retract keep signals and lamps in step; a seeded random walk over the real registry gates it; nothing calls retract yet, plan 40 wires the gesture; todo 2026-10-21-retract-consumed-events-phase3 documents the rule). Plan 01.1-36 (R3-Z2 core: press-arbiter.ts is one pure machine for every pointer, with the four target classes background, latch, momentary and own, slops 10 px touch and pen and 5 px mouse from slopPx, a 100 ms momentary hold as a deadline that tick commits, a stale sweep per pointer kind and a pinch that also starts over controls; zoom.ts is capture-phase glue over it; every hit is still classified own, no widget changed; 55 unit cases, the zoom, neutral, avionics and knob e2e pass unchanged on the three chromium projects). Plan 01.1-37 (R3-Z2: press-targets.ts is the registry of press targets; zoom.ts classifies a pointerdown by the registered target and calls pending, tap and discard on it; toggles, rockers, bats, softkey toggles, circuit breakers, the guard cover and the guarded switch own no pointer any more and act on release, a drag beyond the slop pans the zoomed view and does nothing at the full view, a second finger pinches also over them; every migrated control has an e2e tap, pan, pinch and slop-boundary case in e2e/press.spec.ts). Plan 01.1-38 (R3-Z2: the tap-toggle parking brake flap, the lever marker rectangles and the FAN click spots are latch press targets built by pure factories makeTapTogglePress, makeMarkerPress and makeSpotPress and registered by ref; their pointer handlers, local slop and marker capture are gone; the lever handle and the knob body keep their own gesture until plan 39; the drag-only EMERGENCY GEAR EXTENSION still has no marker and a tap on it changes nothing; the brake group shows data-pressed while pending; the e2e case table has the brake, the flaps T/O marker and the FAN f2 spot; whole suite green on the three chromium projects, 490 passed, vitest 1773). Every latching control of the panel now acts on release. Plan 01.1-39 (R3-Z2: the six momentary controls are registered as momentary press targets by the pure factory makeMomentaryPress and own no pointer; the hold timer lives in zoom.ts as one setTimeout rescheduled from the machine's nextDeadline after every call, delay from event timestamps and tick called with the deadline value; a press commits after 100 ms held still, a quick lift is press then release, movement beyond the slop or a second finger before the commit discards it with no event and becomes a pan or a pinch, after the commit moves and other pointers are ignored and the lift or a cancel releases once; the lever handles and knob bodies are own targets with the shared DRAG_START_PX of 4 px and a discard hook, so a second finger can still pinch before the drag has travelled that far, and MIN_DRAG_PX is gone; zoom.ts no longer captures a pending own pointer on the svg; a classification gate checks the data-press class of every hit and detent element; whole suite green on the three chromium projects, 578 passed, vitest 1779). Next: plans 01.1-40 (double click or tap on a latching control zooms and retracts, wording) and 01.1-41 (documents and final gates). Nothing was pushed.
Last activity: 2026-10-21 — Plan 01.1-39 complete (round 3 gap closure, momentary controls hold 100 ms, drag controls keep their gesture)

Progress: [█░░░░░░░░░] 14%

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: -
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 9 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01.1 P01 | 6min | 3 tasks | 14 files |
| Phase 01.1 P02 | 8min | 3 tasks | 13 files |
| Phase 01.1 P03 | 12min | 3 tasks | 12 files |
| Phase 01.1 P04 | 9 min | 3 tasks | 9 files |
| Phase 01.1 P05 | 10 min | 3 tasks | 6 files |
| Phase 01.1 P06 | 25min | 3 tasks | 6 files |
| Phase 01.1 P07 | 20 min | 2 tasks | 6 files |
| Phase 01.1 P08 | 55min | 3 tasks | 9 files |
| Phase 01.1 P09 | 40min | 3 tasks | 7 files |
| Phase 01.1 P10 | 25 min | 2 tasks | 3 files |
| Phase 01.1 P11 | 90min | 4 tasks | 3 files |
| Phase 01.1 P12 | 20min | 3 tasks | 4 files |
| Phase 01.1 P13 | 25min | 2 tasks | 13 files |
| Phase 01.1 P14 | 20min | 2 tasks | 9 files |
| Phase 01.1 P15 | 10min | 3 tasks | 12 files |
| Phase 01.1 P16 | 35min | 3 tasks | 12 files |
| Phase 01.1 P17 | 15min | 2 tasks | 9 files |
| Phase 01.1 P18 | approx 25min | 2 tasks | 22 files |
| Phase 01.1 P19 | 30min | 2 tasks | 18 files |
| Phase 01.1 P20 | 35min | 3 tasks | 20 files |
| Phase 01.1 P21 | n/a | 3 tasks | 30 files |
| Phase 01.1 P23 | 25min | 3 tasks | 9 files |
| Phase 01.2 P01 | 10 min | 2 tasks | 14 files |
| Phase 01.2 P02 | 30min | 3 tasks | 23 files |
| Phase 01.2 P03 | 15min | 3 tasks | 13 files |
| Phase 01.2 P04 | 25min | 3 tasks | 11 files |
| Phase 01.2 P05 | 11min | 3 tasks | 19 files |
| Phase 01.2 P06 | 15min | 3 tasks | 12 files |
| Phase 01.2 P07 | 25min | 3 tasks | 6 files |
| Phase 01.2 P08 | 40min | 3 tasks | 10 files |
| Phase 01.2 P09 | 30min | 3 tasks | 6 files |
| Phase 01.1 P24 | 10min | 2 tasks | 3 files |
| Phase 01.1 P25 | 25min | 2 tasks | 7 files |
| Phase 01.1 P26 | 25min | 2 tasks | 9 files |
| Phase 01.1 P27 | 10min | 2 tasks | 12 files |
| Phase 01.1 P28 | 20min | 2 tasks | 11 files |
| Phase 01.1 P29 | 25min | 3 tasks | 14 files |
| Phase 01.1 P30 | 15min | 2 tasks | 4 files |
| Phase 01.1 P31 | unattended | 3 tasks | 10 files |
| Phase 01.1 P33 | approx 20min | 2 tasks | 5 files |
| Phase 01.1 P34 | approx 15min | 2 tasks | 3 files |
| Phase 01.1 P35 | approx 15min | 2 tasks | 5 files |
| Phase 01.1 P36 | approx 25min | 2 tasks | 5 files |
| Phase 01.1 P37 | 35min | 2 tasks | 10 files |
| Phase 01.1 P38 | 30min | 2 tasks | 5 files |
| Phase 01.1 P39 | 35min | 2 tasks | 7 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Project mode is vertical MVP; every phase ends with an end-to-end user capability, not a technical layer.
- [Roadmap]: Research's 6 horizontal phases re-sliced into 5 vertical ones (deployed panel; first gradable scenario; reactions + full pack; training loop + authoring; PWA/hardening).
- [Roadmap]: CNT-03 (content policy) sits in Phase 1 so it lands before any AFM-derived text is committed in Phase 2.
- [Roadmap]: Phase 2 delivers Exam-style flow plus the full debrief (SES-03, SES-04) so the core value is demonstrable early; Training mode follows in Phase 4.
- [Roadmap]: Scripted reactions (SCN-06) and gauge response (PNL-04) are their own slice in Phase 3, where the three real scenarios stress the DSL.
- [Phase 01.1]: PD-01: pedestal split into env_control and pedestal regions (44 px POWER on phone)
- [Phase 01.1]: PD-02: de-ice split into deice and deice_switches regions (44 px per detent)
- [Phase 01.1]: PD-06: hit rects narrowed (sw.fadec 66 wide, under-panel levers 44 wide) for 7 units of background clearance
- [Phase 01.1]: Brand text letter spacing set via style string because .panel-svg text CSS overrides the attribute
- [Phase 01.1]: RUBIN centre-anchored at (1232, 625) to stay clear of the UP flap lamp; Defs.tsx also exports DEF_IDS
- [Phase 01.1]: PD-05: FAN knob centre (1032, 896), within 8 units of the UI-SPEC centre, so its 80 x 40 footprint clears the environmental sliders
- [Phase 01.1]: Knob layout follows footprint shape: footprint at least twice as wide as high puts placard left and state text right, otherwise placard above and state text below
- [Phase 01.1]: Registry skin vocabularies are exported const arrays and re-checked at runtime so data cast around the types still fails at load
- [Phase 01.1]: PD-07: indicators (lt. lamps) are outside the control registry; never dispatched or graded. Phase 3 feeds flags (gear.in_transit) through IndicatorInputs.flags
- [Phase 01.1]: PD-03: UI-SPEC id sw.deice_mode registered as lv.deice_mode (detent lever needs lv. prefix)
- [Phase 01.1]: PD-05: TEMPERATURE slider centred 4 units right of UI-SPEC x (global 1096) to clear the FAN knob
- [Phase 01.1]: PD-04: STALL/GEAR TEST registered as btn.stall_gear_test (spring-return three-state momentary), centred 7 units right of the UI-SPEC x
- [Phase 01.1]: 01.1-07: single background tap while zoomed zooms fully out; suppression (350 ms / 24 px) kept and cleared when the view changes by other means
- [Phase 01.1]: PD-08: compact bat variant for footprints under 39 tall (de-ice bats): throw 8, name Micro 6 above the footprint, state text 8 inside it, no lamp dot; guard placard is two lines right of the cover
- [Phase 01.1]: PD-09: lever names drawn above the highest handle position (inside the region); skinned legends right of the handle; MODE state text left of the track
- [Phase 01.1]: 01.1-10: docs/PANEL-REVIEW.md is the owner first-render review list; tests/panel-review.test.ts keeps it complete against layout-reference review rows and the UI-SPEC
- [Phase 01.1]: Rocker raised half drawn as tilted face with tagged side wall; rockerExtent absorbs the 3-unit lift in the 4-unit bezel pad
- [Phase 01.1]: Plan 14: levers and buttons show state by position only; horizontal slider legends print below the handle and never hide
- [Phase 01.1]: Plan 16: plates are data (PLATES); the flap region and plate grow upward by shrinking the softkey region to end at 608; lever names clamped at the region top sit at baseline 6.5
- [Phase 01.1]: Plan 17: GEAR TEST lights all four gear lamps; gear plate top 580 drawn under the PFD bezels
- [Phase 01.1]: Plan 18: the bus panel starts at x 1836 so the ELT placards on the strip plate stay visible; ELT is maintained, rests ARMED (Q-01 default)
- [Phase 01.1]: Plan 19: levers may be nameless and choose their legends; pedestal placards drawn after every plate; throttle label THROTTLE with id lv.power
- [Phase 01.1]: Plan 20: environmental group boxes and plate title are shell art (plates.ts), so all four environmental controls are nameless; FAN has OFF plus three stops with fan symbols
- [Phase 01.1]: Plan 21: the 120 s MAX run is deferred to the engine phase; lt.deice_max reads the unset flag deice.max_active (no engine clock in phase 01.1)
- [Phase 01.1]: Plan 01.1-22: the ICE LIGHT and PUMP toggles are 69 tall (thirds of 23 units) so the pinch-in tap-size gate keeps 44 px; one fixed bat throw (BAT_THROW 14) for every bat
- [Phase 01.1]: Plan 01.1-22: a guarded toggle without rocker size and colour draws the bat toggle (ALTERNATE: states on, off, guarded position up); the guard cover is the only red part
- [Phase 01.2]: 01.2-01: panel space widened from 2000 to 2180 x 1300 on the right only (owner decision U-01, P2-01); MIN_VIEW_WIDTH stays 200 (P2-02)
- [Phase 01.2]: 01.2-02: circuit-breaker kind with flat cb. ids; pulled state is a raised cap plus white ring with no state text (owner rule G-0.1, P2-03); inventory counts derived from independent tables
- [Phase 01.2]: Bus membership is the data attribute group; outline polygons are data in bus-boxes.ts, ids carry no bus segment (P2-04)
- [Phase 01.2]: All 51 breaker positions, labels and ratings follow Table C1/C2 exactly; no label fix needed; counts derive from CB_REFERENCE
- [Phase 01.2]: 01.2-05: softkeys print a triangle only; the legend Engine stands on the glass tab above the key (Q-10 amended)
- [Phase 01.2]: 01.2-07: MFD right column derived from the PFD right table by a +915 x shift; PUSH CRSR baseline moved 573 to 572 for the art-fit gate
- [Phase 01.2]: 01.2-08: ColumnElement unchanged; UnitElement adds the red button kind; EFIS readouts above the tapes keep five numerals per tape
- [Phase 01.2]: Plan 09: documents only, no src change; UnitHousing cleanup and the tablet Full-panel-button overlap on cb.main_pump are recorded (P2-15, todo), not fixed
- [Phase 01.1]: Plan 26: Full panel button takes tr, br or bl by a pure rule over control footprints; tablet-chromium project added to the chromium gate
- [Phase 01.1]: Plan 27: PARKING BRAKE is a tap-toggle hinged flap (tapToggle option plus parking-flap skin as registry data); LeverBody delegates to FlapBody, wall computed from hinge, length and a 60 degree constant
- [Phase 01.1]: Plan 29: sw.fadec orders force_b then auto so the default auto is drawn up (AUTO above, FORCE B below); engine strip words are plate text, parts nameless
- [Phase 01.1]: Plan 30: ON and OFF printed once per side of the four light rockers (left of LANDING, right of STROBE) as plate text; ON at the upper rocker half, OFF at the lower

### Pending Todos

- `.planning/todos/pending/2026-10-20-deice-panel-rework.md`: owner correction from the first-render review, the de-ice unit must be reworked (3-position mini toggle plus MAX button, three lamps, merged ICE LIGHT/ANNUN-TEST and PUMP toggles).
- `.planning/todos/pending/2026-10-20-rotary-spec-hooks-tag.md`: add `@hooks` to the rotary spec at line 257 so the live suite passes.

### Blockers/Concerns

- [Phase 1]: Run a real-device spike (iOS Safari pointer capture and touch-action on SVG). Region zoom is v2 (PNL-V2-01) but v1 phone use needs a layout that is still usable, so decide the v1 small-screen model during Phase 1.
- [Phase 1]: Decide repo visibility, paraphrase-only vs verbatim policy, and a host-agnostic build. GitHub Pages terms bar commerce, so migrate hosting before any sale (BUS-V2-02).
- [Phase 2]: Write the grading semantics spec (state predicates, partial order, forbidden-on-entry, critical-miss fail) with golden fixtures before authoring the first scenario YAML. Review it with a DA50 instructor; confirm the "holds at end" default and ordered-group strictness.
- [Phase 2]: The user supplies DA50 RG AFM procedures, CAS texts and the control inventory. Derive the registry from them. Confirm memory-item deadlines (keep `within_s` optional).
- [Phase 3]: Authoring all three real scenarios will likely force schema revisions. Do not freeze the schema for external authors (CNT-02) until all three are written.
- [Setup]: REQUIREMENTS.md previously said 30 v1 requirements, but only 28 IDs are defined. Corrected to 28 during roadmap creation.

### Roadmap Evolution

- Phase 1.1 inserted after Phase 1: Panel appearance (switch shapes/colours per real DA50: ELECT. MASTER big red rocker, ELT small red, ESS BUS medium red, others white), control inventory for upcoming scenarios, graphical panel rework, single-tap zoom-out and hidden Full panel button fixes. Must settle layout before Phase 2.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-21T18:56:14.666Z
Stopped at: Completed 01.1-39-PLAN.md (round 3 gap closure, plans 33..41 on the 01.2 branch)
Resume file: None
