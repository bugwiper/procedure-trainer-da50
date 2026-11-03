# Requirements: DA50 RG Procedure Trainer

**Defined:** 2026-10-19
**Core Value:** The user can run an emergency scenario by actually operating the panel controls, and gets accurate, objective feedback on whether they performed the AFM procedure correctly.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Panel & Interaction

- [x] **PNL-01**: User can operate switches, guarded switches, detented levers (e.g. power lever, flaps, gear, cowl flap) and buttons by mouse or touch
- [x] **PNL-02**: Panel is generated from a control registry; every control has a stable id and defined legal states
- [x] **PNL-03**: Alert/annunciation area shows scenario-driven messages (e.g. "OIL TEMP HIGH")
- [x] **PNL-04**: Engine gauges and displays respond to simulated aircraft state
- [x] **PNL-05**: Panel scales to desktop, tablet and phone screens without horizontal page scroll; panel regions (e.g. PFD, engine page, switch bank, pedestal) are part of the data model so region zoom can be added later without a rewrite
- [x] **PNL-06**: Controls with safety consequences are guarded or confirm-to-actuate, and stray touches on neutral areas are never graded as forbidden actions
- [x] **PNL-08**: Panel layout reproduces the real DA50 RG positions (which control is where, relative placement and grouping, incl. under-panel controls) closely enough to build position memory for emergencies; touch sizing must never relocate a control
- [x] **PNL-09**: On every device (phone first), the user can zoom into a panel region (pinch, or double click or double tap on the background or a latching control) with enlarged hit targets, without changing the true layout (promoted from PNL-V2-01; the gesture contract itself is PNL-15)
- [x] **PNL-07**: A simplified transponder section lets the user enter a squawk code (no full G1000 menu structure)
- [x] **PNL-10**: The panel visually reproduces the real DA50 RG (instrument panel outline, centre console, under-panel areas) in kind-of real shapes and real colours; brand marks are replaced (GARMIN with GO-AROUND; no airframe maker mark is drawn, the RUBIN placeholder was removed on owner request; DA50RG kept)
- [x] **PNL-11**: Every switch, rocker, push button, lever and knob exists at its real position in kind-of real shape and colour; all of them work by mouse or touch (state shown by position and lamp only; labels are static placards and no text changes with a control state, owner rule G-0.1, which supersedes the earlier "position and text" wording); the light switches are white rockers and movable
- [x] **PNL-12**: Every circuit breaker of the Essential, Main and Avionics bus exists at its real position as a control kind with states in and out (pushed in by default, pulled out shows a raised cap with a white ring and no state text, owner rule G-0.1, overriding the first IN/OUT text wording); tap toggles. The set is 51 breakers (flat `cb.*` ids): 38 in the three bus boxes, 10 in the lower row and 3 on the flap strip. Breaker effects on systems are deferred to Phase 3 (todo)
- [x] **PNL-13**: The G1000 NXi PFD and MFD appear in their well-known shape incl. all softkeys (inert except the MFD page softkey and the engine page); the audio panel, autopilot panel and the static backup EFIS, with the knob and key columns beside both displays, are visible in their real positions (buttons not functional; DISPLAY BACKUP and the glass menus are deferred)
- [x] **PNL-14**: The gear indicator is three separate green lights (each green or off; all three green = down and locked) plus a separate red light (red or off; on for unsafe or in transition; all off for up and locked; GEAR TEST lights all four); the flap lights (UP, T/O, LDG) follow flap state; lamps are derived from control state and nothing pulses; transition timing arrives with Phase 3
- [x] **PNL-15**: A single click or tap never zooms; a double click (mouse) or double tap (touch) zooms into the tapped region and, while zoomed, zooms fully out again (also from intermediate pinch levels), on the panel background and on a latching control (toggle, rocker, breaker, guard, brake flap, lever marker, FAN spot): the first tap actuates at once and the recognised pair retracts it from the action log, so the control ends in its original state, and a pair across two different controls is not a double tap; a double press on a momentary or drag control stays two presses and never zooms (a momentary control commits after 100 ms held still); a press that moves beyond 10 px (touch) or 5 px (mouse) or gains a second finger pans or pinches the view instead of operating the control; the "Full panel" button is never hidden by the footer and never covers a control
- [x] **PNL-16**: The MFD engine page shows the electrical system in one Electrical box: an Amps bar with one pointer for each alternator (1 and 2) and a Volts bar, with the yellow and red alert styling of the other gauges and static marks only
- [x] **PNL-17**: A windscreen area above the instrument panel shows the situation of the scenario (parked in front of a hangar, takeoff roll, cruise over simple landscape, cloud for icing) as flat vector art with no text; the panel space grows upward without moving any existing part, the full view always includes the windscreen and it is its own zoom region, so the zoom, layout and tap-size gates still hold on desktop, tablet and phone
- [x] **PNL-18**: Failure cues are drawn from the simulation quantities, never from the DOM: engine fire flames and smoke outside the windscreen, cabin smoke over the instrument panel that never blocks a press, windscreen ice that warm air from the windscreen air control removes slowly and the WIND SHIELD spray clears on the pilot side only, and the cheap extras (stopped propeller, oil streaks)
- [x] **PNL-19**: Aural cues are synthesised with Web Audio (a caution tone, one short bing, a warning tone, an engine drone that follows the rpm), are off until the user turns them on with a control that is not a panel label, and sound only during a live run
- [x] **PNL-20**: The pilot's footwell has toe brakes (the service brakes, not the parking brake) on two pedals; the take-off roll has a ground speed that POWER above idle raises and the brakes lower, and the roll scene runs at that speed and stands at 0; the transponder sits in the co-pilot footwell beside the situation buttons; the red door lock lever at the far left opens the door and the oval emergency window above it is a separate control that opens by a click
- [x] **PNL-21**: The MFD engine page has the layout of the real page in three columns (Load and RPM arcs; Oil Pres, Oil Temp, Coolant Temp and Gearbox Temp bars and Rudder Trim; a Fuel box with one combined left and right quantity bar, Fuel Temp for both tanks, Fuel Press, FFlow GPH and a Fuel Calculator; the Electrical, Oxygen, De-Ice with its Endurance and Total Service boxes); the layout is data, every label is static, fuel, oil, coolant and gearbox readings follow the simulation, oxygen, rudder trim and total service are static display values
- [x] **PNL-22**: The de-ice fluid quantity (tank 8.3 US gal) and its Norm and High endurance follow the de-ice mode (3 and 6 gal/h), the MAX run (0.4 gal per activation) and the WIND SHIELD spray (40 ml per activation), and ANNUN TEST on the ICE LIGHT switch lights the de-ice lamps
- [x] **PNL-23**: Inside a situation the PFD airspeed, altitude, vertical speed, pitch and bank come from simulated quantities (a rolling horizon, sliding tapes, a vertical speed readout; heading stays static) while the free panel keeps its static readings
- [x] **PNL-24**: Whenever PITOT/STALL HEAT is off the PFD shows two yellow messages, PITOT HEAT and STALL HEAT; on the ground the stall heat cuts out a few seconds after the heat is on and STALL HEAT returns, airborne it does not
- [x] **PNL-25**: The PFD shows the active CAS messages in one vertical column at the lower right of the glass: black rows with thin level-coloured type, about half as wide as before, joined without a gap, the most severe on top (warning, caution, advisory), the column growing upward with each further message; texts and levels are unchanged; the heat cautions read the printed tags PITOT HT OFF and STALL HT OFF (plan 07-06, 2026-11-02, pending the phase UAT)
- [x] **PNL-26**: The PFD has synthetic vision under the whole glass (the sky and terrain of the situation's scene, a runway on the take-off roll and the apron on the parked scene) that follows pitch and bank, with translucent speed and altitude tapes over it and a plain compass over a translucent backing, without map and without deviation bar
- [x] **PNL-27**: A narrow vertical speed scale (plus and minus 3000 fpm, ticks every 500, numerals 1, 2 and 3) stands right of the altitude tape in place of the VS box, with a moving black readout box that carries the bare number, and the barometer setting under the tape reads QNH in hPa in turquoise from a static display value that a situation may set
- [ ] **PNL-28**: A scene `outlanding` shows one off-airport landing field in the windscreen and in the synthetic vision of the PFD, growing toward the pilot as the altitude falls toward the terrain height; both read one cue (`field_near`, a level from the altitude) and one geometry function, the field is part of the scene and not chosen by the user, no text is drawn, and the free panel keeps its default scene (planned for Phase 9, plan 09-01)

### Scenario Engine

- [x] **SCN-01**: Scenarios are TOON files validated against a schema, with line-numbered errors
- [x] **SCN-02**: A validate command checks every scenario file against the control registry
- [x] **SCN-03**: A scenario defines initial panel state, annunciations and the displayed checklist
- [x] **SCN-04**: Actions can be critical-required, standard-required, optional or forbidden, placed in ordered or unordered groups
- [x] **SCN-05**: Actions are matched on resulting control/aircraft state, not on raw clicks
- [x] **SCN-06**: Scripted reactions: timers, ramps, triggers on user actions, and escalation to named outcomes (e.g. engine failure if oil temp exceeds red line)
- [x] **SCN-07**: Each scenario carries source, revision and disclaimer metadata
- [x] **SCN-08**: Engine uses a virtual, pausable clock so grading and replay are deterministic
- [x] **SCN-09**: A scenario can declare several causes (variants) behind one failure, each with its own start state, parameters and applying steps; one is drawn by seed on every level, recorded with the run, replayed by the grader and named in the debrief after the run
- [x] **SCN-10**: The simulation can change a control by itself (a circuit breaker that pops at the onset, or pops again when pushed in while the fault is present), identically in the live run and in every replay
- [x] **SCN-11**: The electrical system is a bus model (main, essential, battery, hot and avionics buses, bus tie relay, alternators, ESS BUS, ELECT. MASTER, breakers, battery) derived from control states and parameters; the ALTN 1 FAIL and ALTN 2 FAIL cautions come from an alternator control unit model, not from a current threshold
- [x] **SCN-12**: A scenario declares its scene and its onset cues in data; lint rejects an unknown scene or cue, a cue visible at the Realistic start, a cue a do-nothing Realistic run does not show in time, and an onset that lists neither an annunciation nor a cue (L22 to L24)
- [x] **SCN-13**: A checklist can be shown as the booklet or the AFM prints it: number or letter row marks, comment rows, a boxed reference, italic sub-headings, WARNING and CAUTION blocks (the shipped fire, take-off and icing checklists follow the booklet edition 4.1, plan 05.1-04); lint keeps the marks in one run and the comment styles to the table form
- [x] **SCN-14**: The fuel system is a model: two tanks of 26 US gal, the FUEL selector picks the tank, the common-rail return always flows into the left tank, FUEL TRANS pumps 60 US gal/h from the right to the left tank with a white FUEL TRANS advisory on the PFD, fuel flow, gallons used, calculator values and the fuel temperatures (left outside air temperature + 8 C, right left minus a situation-dependent difference of 3 C by default, limits -25 and +60 C) derive from the simulated state with + - * / only
- [x] **SCN-15**: A scenario scripts its situation in data (start quantities and an optional profile section of parameters in force from the first second: the flight state level, climb, descent, bank, stopped and the engine-stopped glide, the outside air temperature and the fuel temperature difference), identically in the live run and in every replay; lint rule L25 checks the profile against the aircraft
- [x] **SCN-16**: The oil pressure follows the oil temperature and the POWER setting: hot oil lowers it (the lower green third at the cruise setting, possibly yellow at ground idle), a cold engine at idle is already in the upper yellow band and any power added on a cold engine drives it into red; the shape is a table in the aircraft data and the bands stay in the quantity data
- [ ] **SCN-17**: A scenario can end by itself when a declared condition holds (`finish`, for example the aircraft has reached the field): the run completes as if the pilot had pressed Procedure complete at that time, graded by the unchanged grade function and identical in the live run and in every replay, with lint L32 rejecting a finish that does not resolve, holds at the start or is not reached by a do-nothing run; the profile can stop the engine from the first second (`engine_stopped`) so the existing glide regime applies (planned for Phase 9, plans 09-01 and 09-02)

### Session & Debrief

- [x] **SES-01**: User can start a "new situation" (random or selected) with a short briefing; the selected list is the grouped chooser (the three printed groups of the booklet as tabs, three situations per page, in the order of the booklet) (reworked after the owner walkthrough 2026-11-02, plan 07-06, pending the phase UAT)
- [x] **SES-02**: During a run the user can show the scenario checklist, with the steps done so far marked; on Realistic the user chooses the checklist from the three printed groups (every catalog entry, greyed where no situation exists), the rows the program does not check can be ticked, the chosen checklist is marked from the pilot's real actions (reworked after the owner walkthrough 2026-11-02, plan 07-06, pending the phase UAT) and a hint shows the situation
- [x] **SES-03**: A run says nothing about the solution and the user ends it with "Procedure complete"
- [x] **SES-04**: Debrief shows PASS/FAIL (a missed critical step fails), per-step verdicts, order violations and harmful actions
- [x] **SES-05**: The optional further actions (inform ATC with MAYDAY or PAN PAN PAN, brief passengers, flight conduct) are toggle buttons in the pilot footwell, any combination, with three Avoid actions (Avoid IMC, Avoid NVFR, Avoid icing) that are never required and never fail and a debrief note outside the verdict (reworked again in plan 07-06, 2026-11-02); a scenario declares which are required, recommended, optional or harmful and which flight conduct is correct (or none, on the ground), and the selections are graded with the panel actions at Procedure complete and shown in the debrief (reworked after the owner walkthrough 2026-11-02, pending the phase UAT)
- [x] **SES-06**: User can retry the scenario or move to the next situation
- [x] **SES-07**: A running scenario survives a failing step listener (the error is shown and the run ends cleanly) and a run that reaches the 30-minute cap ends exactly as its replay does
- [x] **SES-08**: CHOOSE SITUATION lists any number of situations in pages of four with a NEXT PAGE button
- [ ] **SES-09**: When the conduct selected at the end of a graded run is the emergency landing and the scenario declares a follow-on for it (`follow_on` in the `further` section, lint L33 and L34), the debrief offers the button Emergency landing, which opens the follow-on situation through the pack seam with the level kept; nothing is carried over and each situation is graded on its own; a situation on a landing scene declares `conduct: none` and shows no conduct or Avoid buttons (planned for Phase 9, plans 09-02 and 09-03)

### Content

- [x] **CNT-01**: Initial pack contains Oil Temp High, Electrical Failure and Engine Fire scenarios
- [x] **CNT-02**: An authoring guide explains how to add scenarios and validate them
- [x] **CNT-03**: A content policy for AFM-derived text (paraphrased vs verbatim, public vs private repo) is decided before any procedure text is committed
- [x] **CNT-04**: The pack contains an ALTN 2 FAIL scenario with its checklist as printed and several causes behind the one message
- [x] **CNT-05**: The pack contains Engine Fire on Ground, Electrical Fire with Smoke on Ground (engine running or stopped), Smoke and Fire During Take-Off (abort and no abort), Electrical Fire in Flight and Unintentional Flight Into Icing, each with its printed AFM page, its scene and its cues
- [ ] **CNT-06**: A pack `landing` holds the emergency landing situations without engine power and with engine power, each with its printed booklet page typed verbatim (the panel rows graded on the panel, the other rows plain lines the user ticks on the sheet), each an entry of the group NON-ANNUNCIATED EMERGENCY PROCEDURES with the printed tag; ENGINE FIRE IN FLIGHT and T/O FIRE NO ABORT lead to the first and ELEC FIRE FLIGHT to the second (planned for Phase 9, plan 09-03; waits for the owner's booklet pages 9 and 10)

### Platform & Business

- [x] **PLT-01**: GitHub Actions deploys to GitHub Pages; build is host-agnostic (base path from environment)
- [x] **PLT-02**: App installs as a PWA and works offline (as built by plans 08-01 to 08-03, 2026-11-03; the owner's device round, `docs/DEVICE-CHECKLIST.md`, and the phase UAT are pending)
- [x] **PLT-03**: Scenario packs load only through a PackProvider/AccessPolicy seam, open in v1
- [x] **PLT-04**: First-run training-aid acknowledgment is shown, and each scenario shows its source/disclaimer

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Panel

- ~~**PNL-V2-01**: Phone region zoom/pan~~ → promoted to v1 as PNL-09 (2026-10-19)
- **PNL-V2-02**: Keyboard operation and ARIA accessibility

### Session

- **SES-V2-01**: Local history and debrief timeline
- **SES-V2-02**: Conditional and time-bound (memory item) steps, scenario variants

### Business

- **BUS-V2-01**: Paid pack unlock (private-repo build, encrypted packs, license check)
- **BUS-V2-02**: Migrate hosting off GitHub Pages before first sale
- **BUS-V2-03**: Terms, Impressum/privacy, legal review, Diamond/Garmin clarification

### Content

- **CNT-V2-01**: Additional scenario packs (e.g. partial engine failure, normal procedures)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Flight model / physics | Scripted state changes meet the training goal |
| Pixel-accurate G1000 NXi replica or menu structure | IP/effort; functional layout only |
| Bundled verbatim AFM text | Copyright exposure; policy decided in CNT-03 |
| Gamified scoring, leaderboards | Misleading debrief; objective verdicts preferred |
| Accounts, backend, payments in v1 | Pages is static; gate seam keeps the option open |
| Multi-language | English matches real annunciations and AFM |
| Certification/approval claims | Training aid only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLT-01 | Phase 1 | Complete |
| CNT-03 | Phase 1 | Complete |
| PNL-01 | Phase 1 | Complete |
| PNL-02 | Phase 1 | Complete |
| PNL-05 | Phase 1 | Complete |
| PNL-06 | Phase 1 | Complete |
| PNL-08 | Phase 1 | Complete |
| PNL-09 | Phase 1 | Complete |
| PNL-10 | Phase 01.1 | Complete |
| PNL-11 | Phase 01.1 | Complete |
| PNL-12 | Phase 01.2 | Complete |
| PNL-13 | Phase 01.2 | Complete |
| PNL-14 | Phase 01.1 | Complete |
| PNL-15 | Phase 01.1 | Complete |
| SCN-01 | Phase 2 | Complete |
| SCN-02 | Phase 2 | Complete |
| SCN-03 | Phase 2 | Complete |
| SCN-04 | Phase 2 | Complete |
| SCN-05 | Phase 2 | Complete |
| SCN-07 | Phase 2 | Complete |
| SCN-08 | Phase 2 | Complete |
| PNL-03 | Phase 2 | Complete |
| SES-01 | Phase 2 | Complete (grouped chooser reworked in plan 07-06, pending the phase UAT) |
| SES-03 | Phase 2 | Complete |
| SES-04 | Phase 2 | Complete |
| PLT-03 | Phase 2 | Complete |
| PLT-04 | Phase 2 | Complete |
| SCN-06 | Phase 3 | Complete |
| SCN-09 | Phase 3.1 | Complete |
| SCN-10 | Phase 3.1 | Complete |
| SES-07 | Phase 3.1 | Complete |
| SCN-11 | Phase 4 | Complete |
| PNL-16 | Phase 4 | Complete |
| CNT-04 | Phase 4 | Complete |
| PNL-17 | Phase 5 | Complete |
| PNL-18 | Phase 5 | Complete |
| PNL-19 | Phase 5 | Complete |
| SCN-12 | Phase 5 | Complete |
| PNL-20 | Phase 5.1 | Complete |
| SCN-13 | Phase 5.1 | Complete |
| SES-08 | Phase 5.1 | Complete |
| CNT-05 | Phase 5.1 | Complete |
| PNL-21 | Phase 6 | Complete |
| PNL-22 | Phase 6 | Complete |
| PNL-23 | Phase 6 | Complete |
| PNL-24 | Phase 6 | Complete |
| PNL-25 | Phase 6.1 | Complete (printed CAS tags reworked in plan 07-06, pending the phase UAT) |
| PNL-26 | Phase 6.1 | Complete |
| PNL-27 | Phase 6.1 | Complete |
| SCN-14 | Phase 6 | Complete |
| SCN-15 | Phase 6 | Complete |
| SCN-16 | Phase 6 | Complete |
| PNL-04 | Phase 3 | Complete |
| PNL-07 | Phase 3 | Complete |
| CNT-01 | Phase 3 | Complete |
| SES-02 | Phase 7 | Complete (as built, reworked after the owner walkthrough 2026-11-02 and in plan 07-06, pending the phase UAT) |
| SES-05 | Phase 7 | Complete (as built, reworked after the owner walkthrough 2026-11-02 and in plan 07-06, pending the phase UAT) |
| SES-06 | Phase 7 | Complete (as built, pending the phase UAT) |
| CNT-02 | Phase 7 | Complete (as built, pending the phase UAT) |
| PLT-02 | Phase 8 | Complete (as built, pending the phase UAT and the owner's device round) |
| PNL-28 | Phase 9 | Planned |
| SCN-17 | Phase 9 | Planned |
| SES-09 | Phase 9 | Planned |
| CNT-06 | Phase 9 | Planned (waits for the owner's booklet pages) |

**Coverage:**
- v1 requirements: 64 total (PNL-28, SCN-17, SES-09, CNT-06 added 2026-11-03 for phase 9, emergency landing situations; before that 60: 28 + PNL-08, PNL-09 added 2026-10-19; PNL-10..PNL-15 added 2026-10-20 for the full panel replica; SCN-09, SCN-10, SES-07 added 2026-10-23 for phase 3.1; SCN-11, PNL-16, CNT-04 added 2026-10-23 for phase 4; PNL-17, PNL-18, PNL-19, SCN-12 added 2026-10-27 for phase 5; PNL-20, SCN-13, SES-08, CNT-05 added 2026-10-27 for phase 5.1; PNL-21, PNL-22, PNL-23, PNL-24, SCN-14, SCN-15, SCN-16 added 2026-10-28 for phase 6; PNL-25, PNL-26, PNL-27 added 2026-11-01 for the inserted phase 6.1, PFD fidelity)
- Mapped to phases: 64 (PNL-28, SCN-17, SES-09 and CNT-06 planned in phase 9, 2026-11-03; PNL-20, SCN-13, SES-08 and CNT-05 complete in phase 5.1, 2026-10-27; the seven requirements of phase 6 are complete as built by plans 06-01 to 06-04, 2026-10-29, pending the phase UAT; PNL-25 to PNL-27 complete as built by plans 06.1-01 to 06.1-03, 2026-11-01, pending the phase UAT; SES-02, SES-05, SES-06 and CNT-02 complete as built by plans 07-01 to 07-06 (07-04 and 07-05 rework SES-02, SES-03 and SES-05 after the owner walkthrough, 07-06 reworks SES-01, SES-02, SES-05 and PNL-25 after his second round), 2026-11-02, pending the phase UAT; PLT-02 complete as built by plans 08-01 to 08-03, 2026-11-03, pending the phase UAT and the owner's device round)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-19*
*Last updated: 2026-11-03 after planning phase 9 (PNL-28, SCN-17, SES-09, CNT-06 added); phase 8 built earlier the same day (PLT-02: offline worker, manifest, icons, update flow, device checklist)*
