---
gsd_state_version: "1.0"
current_phase: "01.1"
current_phase_name: Panel shape, controls and indicator lights
status: executing
stopped_at: Completed 01.1-06-PLAN.md
last_updated: "2026-10-20T16:06:05.688Z"
last_activity: 2026-10-20
last_activity_desc: Phase 01 complete, transitioned to Phase 2
state_head: fc79582b8a80c5eb48eb249977475c82c243148b
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 20
  completed_plans: 15
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-19)

**Core value:** The user can run an emergency scenario by actually operating the panel controls, and gets accurate, objective feedback on whether they performed the AFM procedure correctly.
**Current focus:** Phase 01 — Deployed Playable Panel

## Current Position

Phase: 01.1 (Panel shape, controls and indicator lights) — READY TO EXECUTE
Plan: Not started
Status: Ready to execute
Last activity: 2026-10-20 — Phase 01 complete, transitioned to Phase 2

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

### Pending Todos

None yet.

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

Last session: 2026-10-20T16:06:05.572Z
Stopped at: Completed 01.1-06-PLAN.md
Resume file: None
