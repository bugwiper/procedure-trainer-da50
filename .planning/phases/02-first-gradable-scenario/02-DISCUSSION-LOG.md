# Phase 2: First Gradable Scenario - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-21
**Phase:** 2 - First Gradable Scenario
**Areas discussed:** Oil-Temp procedure (content), grading logic, flow and screens, scenario format / pack access / validation

---

## Oil-Temp procedure (content)

| Question | Options | Selected |
|----------|---------|----------|
| Which variant is the first scenario | OIL PRES green (recommended) / OIL PRES too low / both via initial state | Free text: "Engine Oil Temperature High (ENG OIL TEMP)"; clarified as the main case with OIL PRES green, blueprint for all scenarios |
| How "reduce POWER" is checked | below initial (recommended) / fixed maximum / band | "At least 10 percent reduction", clarified: 10 percentage points below the initial value |
| Steps without a panel control | non-graded checklist lines (recommended) / omit / confirmation button | Non-graded checklist lines |
| Forbidden actions | ENGINE MASTER off and POWER up (recommended) / POWER up only / none | POWER up only |
| Instruments in Phase 2 | message only / message plus fixed red oil temperature | Message plus fixed red oil temperature (above 125 degrees C) |
| Where the message appears | PFD static red (recommended) / MFD / both | PFD, right side, about one third from the bottom, left of the altitude tape, red text in a black block |

**Notes:** Owner stressed the first scenario is the blueprint for all later ones: nothing hard-coded, configurable data. Later the owner supplied the pocket checklist card; both panel steps confirmed critical, unordered group, initial POWER 75 percent and COWL FLAP closed confirmed, source = AFM 03-08 Issue 018, condition blocks in the schema now.

---

## Grading logic

| Question | Selected |
|----------|----------|
| When a step is credited | Target state holds at the end (recommended) |
| Effect of a forbidden action | Shown in the debrief only (not the recommended "immediate FAIL") |
| Order violation in an ordered group | Only groups marked order-critical cause FAIL (recommended) |
| Standard/optional steps | Only critical steps decide PASS (recommended) |

---

## Flow and screens

| Question | Selected |
|----------|----------|
| How a situation starts | Panel first, menu on top (not the recommended start screen) |
| Where "Procedure complete" sits | In the footer bar (recommended) |
| Debrief extras | Verdicts only (not the recommended action timeline) |
| First-run acknowledgment | Once, again when the text version changes (recommended) |

---

## Scenario format, packs, validation

| Question | Selected |
|----------|----------|
| Authoring format | **TOON only** (not the recommended YAML); risks noted: parser maturity, line-numbered errors, editor support |
| Pack organisation | Pack folder with manifest (recommended) |
| Validation | Command plus test, in-app loading later (recommended) |
| Aircraft state in the scenario | Named aircraft-state quantities (recommended) |

---

## Claude's Discretion

Schema field names and condition vocabulary; manifest shape and TOON validation path; visual details of menu, briefing and debrief; optional per-action flag that lets a forbidden action fail the run.

## Deferred Ideas

Second scenario variant (OIL PRES too low), graded non-panel steps (Phase 7), in-app file loading and authoring guide (Phase 7), live temperature behaviour and escalation (Phase 3), action timeline in the debrief.
