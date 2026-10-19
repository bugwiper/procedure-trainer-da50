# Requirements: DA50 RG Procedure Trainer

**Defined:** 2026-10-19
**Core Value:** The user can run an emergency scenario by actually operating the panel controls, and gets accurate, objective feedback on whether they performed the AFM procedure correctly.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Panel & Interaction

- [ ] **PNL-01**: User can operate switches, guarded switches, detented levers (e.g. throttle, prop, cowl flap) and buttons by mouse or touch
- [ ] **PNL-02**: Panel is generated from a control registry; every control has a stable id and defined legal states
- [ ] **PNL-03**: Alert/annunciation area shows scenario-driven messages (e.g. "OIL TEMP HIGH")
- [ ] **PNL-04**: Engine gauges and displays respond to simulated aircraft state
- [ ] **PNL-05**: Panel scales to desktop, tablet and phone screens without horizontal page scroll; panel regions (e.g. PFD, engine page, switch bank, pedestal) are part of the data model so region zoom can be added later without a rewrite
- [ ] **PNL-06**: Controls with safety consequences are guarded or confirm-to-actuate, and stray touches on neutral areas are never graded as forbidden actions
- [ ] **PNL-07**: A simplified transponder section lets the user enter a squawk code (no full G1000 menu structure)

### Scenario Engine

- [ ] **SCN-01**: Scenarios are YAML files validated against a schema, with line-numbered errors
- [ ] **SCN-02**: A validate command checks every scenario file against the control registry
- [ ] **SCN-03**: A scenario defines initial panel state, annunciations and the displayed checklist
- [ ] **SCN-04**: Actions can be critical-required, standard-required, optional or forbidden, placed in ordered or unordered groups
- [ ] **SCN-05**: Actions are matched on resulting control/aircraft state, not on raw clicks
- [ ] **SCN-06**: Scripted reactions: timers, ramps, triggers on user actions, and escalation to named outcomes (e.g. engine failure if oil temp exceeds red line)
- [ ] **SCN-07**: Each scenario carries source, revision and disclaimer metadata
- [ ] **SCN-08**: Engine uses a virtual, pausable clock so grading and replay are deterministic

### Session & Debrief

- [ ] **SES-01**: User can start a "new situation" (random or selected) with a short briefing
- [ ] **SES-02**: Training mode lets the user show/hide the checklist and get hints
- [ ] **SES-03**: Exam mode is silent and the user ends it with "Procedure complete"
- [ ] **SES-04**: Debrief shows PASS/FAIL (a missed critical step fails), per-step verdicts, order violations and harmful actions
- [ ] **SES-05**: A "Further actions" section offers non-panel actions as a fixed list, e.g. monitor oil pressure, declare MAYDAY, brief passengers, plus a graded landing-decision ladder (continue flight / safety landing on suitable field / emergency landing on next field / outlanding if necessary)
- [ ] **SES-06**: User can retry the scenario or move to the next situation

### Content

- [ ] **CNT-01**: Initial pack contains Oil Temp High, Electrical Failure and Engine Fire scenarios
- [ ] **CNT-02**: An authoring guide explains how to add scenarios and validate them
- [ ] **CNT-03**: A content policy for AFM-derived text (paraphrased vs verbatim, public vs private repo) is decided before any procedure text is committed

### Platform & Business

- [ ] **PLT-01**: GitHub Actions deploys to GitHub Pages; build is host-agnostic (base path from environment)
- [ ] **PLT-02**: App installs as a PWA and works offline
- [ ] **PLT-03**: Scenario packs load only through a PackProvider/AccessPolicy seam, open in v1
- [ ] **PLT-04**: First-run training-aid acknowledgment is shown, and each scenario shows its source/disclaimer

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Panel

- **PNL-V2-01**: Phone region zoom/pan (pinch or zoom control) with enlarged hit targets
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
| PLT-01 | Phase 1 | Pending |
| CNT-03 | Phase 1 | Pending |
| PNL-01 | Phase 1 | Pending |
| PNL-02 | Phase 1 | Pending |
| PNL-05 | Phase 1 | Pending |
| PNL-06 | Phase 1 | Pending |
| SCN-01 | Phase 2 | Pending |
| SCN-02 | Phase 2 | Pending |
| SCN-03 | Phase 2 | Pending |
| SCN-04 | Phase 2 | Pending |
| SCN-05 | Phase 2 | Pending |
| SCN-07 | Phase 2 | Pending |
| SCN-08 | Phase 2 | Pending |
| PNL-03 | Phase 2 | Pending |
| SES-01 | Phase 2 | Pending |
| SES-03 | Phase 2 | Pending |
| SES-04 | Phase 2 | Pending |
| PLT-03 | Phase 2 | Pending |
| PLT-04 | Phase 2 | Pending |
| SCN-06 | Phase 3 | Pending |
| PNL-04 | Phase 3 | Pending |
| PNL-07 | Phase 3 | Pending |
| CNT-01 | Phase 3 | Pending |
| SES-02 | Phase 4 | Pending |
| SES-05 | Phase 4 | Pending |
| SES-06 | Phase 4 | Pending |
| CNT-02 | Phase 4 | Pending |
| PLT-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 28 total (previously stated as 30; the defined IDs total 28)
- Mapped to phases: 28
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-19*
*Last updated: 2026-10-19 after roadmap creation*
