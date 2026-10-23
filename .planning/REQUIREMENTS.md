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

### Session & Debrief

- [x] **SES-01**: User can start a "new situation" (random or selected) with a short briefing
- [ ] **SES-02**: Training mode lets the user show/hide the checklist and get hints
- [x] **SES-03**: Exam mode is silent and the user ends it with "Procedure complete"
- [x] **SES-04**: Debrief shows PASS/FAIL (a missed critical step fails), per-step verdicts, order violations and harmful actions
- [ ] **SES-05**: A "Further actions" section offers non-panel actions as a fixed list, e.g. monitor oil pressure, declare MAYDAY, brief passengers, plus a graded landing-decision ladder (continue flight / safety landing on suitable field / emergency landing on next field / outlanding if necessary)
- [ ] **SES-06**: User can retry the scenario or move to the next situation
- [x] **SES-07**: A running scenario survives a failing step listener (the error is shown and the run ends cleanly) and a run that reaches the 30-minute cap ends exactly as its replay does

### Content

- [x] **CNT-01**: Initial pack contains Oil Temp High, Electrical Failure and Engine Fire scenarios
- [ ] **CNT-02**: An authoring guide explains how to add scenarios and validate them
- [x] **CNT-03**: A content policy for AFM-derived text (paraphrased vs verbatim, public vs private repo) is decided before any procedure text is committed
- [x] **CNT-04**: The pack contains an ALTN 2 FAIL scenario with its checklist as printed and several causes behind the one message

### Platform & Business

- [x] **PLT-01**: GitHub Actions deploys to GitHub Pages; build is host-agnostic (base path from environment)
- [ ] **PLT-02**: App installs as a PWA and works offline
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
| SES-01 | Phase 2 | Complete |
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
| PNL-04 | Phase 3 | Complete |
| PNL-07 | Phase 3 | Complete |
| CNT-01 | Phase 3 | Complete |
| SES-02 | Phase 7 | Pending |
| SES-05 | Phase 7 | Pending |
| SES-06 | Phase 7 | Pending |
| CNT-02 | Phase 7 | Pending |
| PLT-02 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 42 total (28 + PNL-08, PNL-09 added 2026-10-19; PNL-10..PNL-15 added 2026-10-20 for the full panel replica; SCN-09, SCN-10, SES-07 added 2026-10-23 for phase 3.1; SCN-11, PNL-16, CNT-04 added 2026-10-23 for phase 4)
- Mapped to phases: 42
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-19*
*Last updated: 2026-10-21 after phases 1, 1.1 and 1.2 (PNL-09..PNL-15 worded to the built result; PNL-07 stays pending in Phase 3)*
