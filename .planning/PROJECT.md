# DA50 RG Procedure Trainer

## What This Is

A web-based 2D cockpit procedure trainer for the Diamond DA50 RG, including emergency situations. The user sees an interactive panel (gauges, glass-display areas, annunciations, switches, levers, buttons). A "new situation" starts a quiz-style scenario (e.g. "OIL TEMP HIGH" annunciated like in the real aircraft), and the user must perform the correct checklist actions by operating the panel. Performance is graded against stored required, optional and ordered actions.

## Core Value

The user can run an emergency scenario by actually operating the panel controls, and gets accurate, objective feedback on whether they performed the AFM procedure correctly.

## Business Context

- **Customer**: DA50 RG pilots and students (flight schools, type-rating trainees)
- **Revenue model**: Undecided; v1 free. Later likely one-time unlock of scenario packs (license key/purchase). Subscription deferred.
- **Success metric**: Pilots completing scenarios and repeating them to improve debrief scores
- **Strategy notes**: Architecture must be gate-ready (access-check layer around scenario packs) without a v1 backend

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Interactive 2D DA50 RG panel (functional layout, not pixel-accurate): engine/flight display areas, gauges, annunciator/alert area, switches, levers (throttle/prop/cowl flap etc.), buttons
- [ ] Controls respond to click/touch (flip switches, move levers, press buttons) and update simulated aircraft state; no flight model
- [ ] Scenarios start via "new situation" quiz flow; random or selected scenario
- [ ] Scenario definitions in YAML config files, validated by schema, extendable manually without code changes
- [ ] Scenario defines initial panel state, annunciations/alerts, and action checklist: required actions, optional actions, order-constrained groups, unordered actions, forbidden/harmful actions
- [ ] Scripted reactions: scenario-defined state changes triggered by user actions or timers (e.g. temperature falls after actions, escalates to engine failure if ignored or past redline)
- [ ] Checklist can be shown/hidden
- [ ] Training mode (checklist/hints, optionally immediate feedback) and Exam mode (silent, debrief at end)
- [ ] End-of-scenario debrief: missed required actions, order violations, harmful actions, optional actions done
- [ ] Initial scenario pack: Oil Temp High, Electrical Failure, Engine Fire
- [ ] Procedures sourced from the official DA50 RG AFM, entered by the user, with source/disclaimer field per scenario
- [ ] English-only UI and content
- [ ] Responsive: works on desktop, tablet and phone (panel scales/pans on small screens)
- [ ] Static hosting on GitHub Pages
- [ ] Gate-ready architecture: scenario packs separable behind an access-check abstraction for later one-time unlock

### Out of Scope

- Flight model / flight physics — scenarios use scripted state changes only
- Pixel-accurate Garmin G1000 NXi replica — functional layout only; avoids IP/effort
- User accounts, backend, payments in v1 — deferred; design must allow later
- Subscription model — one-time unlock more likely; needs backend
- Multi-language support — English matches real annunciations and AFM
- Official certification/approval as a training device — training aid only, not a substitute for AFM or instructor

## Context

- Aircraft: Diamond DA50 RG (glass cockpit, single-engine piston). Emergency procedures per AFM.
- User enters AFM-derived procedures; accuracy and licensing/copyright of AFM text is their responsibility, so scenario files should carry a source and disclaimer.
- Content extensibility through YAML is a core design driver; non-developers should be able to author scenarios.
- VS Code project, repo in /Users/pascalbetz/projects/procedure-trainer-da-50.

## Constraints

- **Tech stack**: TypeScript + Vite, SVG-rendered panel — static output suited to GitHub Pages, scalable graphics for all screen sizes
- **Hosting**: GitHub Pages (static only) — no server-side enforcement in v1
- **Devices**: desktop, tablet, phone — touch and mouse input, responsive scaling
- **Content format**: YAML scenario files with schema validation — manual extensibility
- **Safety/legal**: Clearly marked as training aid, not replacing AFM — liability

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Functional (not high-fidelity) panel | Faster, avoids IP issues, procedure focus | — Pending |
| Scripted reactions, no flight model | Meets training goal at low complexity | — Pending |
| Grading at end (Exam) plus Training mode | Supports learning and testing | — Pending |
| Free v1, gate-ready packs | Keeps GitHub Pages simple, allows later one-time unlock | — Pending |
| TypeScript + Vite + SVG | Static, responsive, testable | — Pending |
| AFM-sourced procedures entered by user | Accuracy; user owns content responsibility | — Pending |
| Phone support included | User requirement; affects panel layout design | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-19 after initialization*
