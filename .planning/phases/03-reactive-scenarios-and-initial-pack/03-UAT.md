---
status: complete
phase: 03-reactive-scenarios-and-initial-pack
source: 03-01-SUMMARY.md to 03-10-SUMMARY.md, docs/PANEL-REVIEW.md "Phase 3: owner review"
started: 2026-10-23T00:00:00Z
updated: 2026-10-23T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Gauge movement and its speed
expected: Oil temperature climbs while ignored, falls after POWER down and cowl flap open; time scale acceptable.
result: issue
reported: "Fuer medium passen die Zeitkonstanten. Fuer realistic dauert der Start etwas zu lange und dann schaut man ewig zu wie die temp langsam steigt. Das sollte etwas frueher beginnen, evtl. bereits im gelben Bereich und dann auch innerhalb von ca 10 Sekunden in den roten Bereich mit CAS Meldung kommen. Grundprinzip aber schon sehr ueberzeugend."
severity: minor

### 2. Base readings in the green on all twelve MFD gauges
expected: On the free panel every MFD engine-page gauge reads green at the cruise values.
result: pass

### 3. The three outcomes and their wording
expected: Each ignored run ends as FAIL and the debrief opens by itself with the first reason line (overheating, main bus loss, fire spread).
result: pass

### 4. The realistic flow
expected: Realistic starts at once with no briefing, the failure starts 5 to 20 s later, the debrief names the situation and shows the reaction time; doing the checklist before the onset does not pass.
result: pass

### 5. The Engine Fire realistic cue
expected: Known problem from the first live test: no recognisable cue. Judge what is needed (see todo realistic-level-visual-cues).
result: issue
reported: "Engine Fire on Realistic is not solvable: nothing visible happens at onset and without a briefing the pilot does not know what is expected (first live test). Owner idea: windscreen with static fire and smoke."
severity: major

### 6. The transponder
expected: Rests on 7000, keys 0 to 7 and CLR usable on the phone, enter 7700 in Engine Fire, readout visible.
result: pass
note: "Accepted as is for now; the transponder will later move into the PFD (owner)." 

### 7. ALTN 1 FAIL stays on after ALTERNATOR 1 OFF
expected: Say whether the real caution goes out.
result: pass
note: "Owner: the caution stays on because the alternator is broken. Current behaviour is right." 

### 8. The forbidden lists and their debrief names
expected: Harmful actions listed by name in the debrief for each scenario.
result: pass

### 9. FUEL selector, ECS SHUTOFF and cowl flap as drawn
expected: Selector on one arc NORMAL, EMERGENCY, OFF (OFF at 180), no turn through the left sector; ECS SHUTOFF pulls visibly; cowl flap lever, lamps and placard look right.
result: pass
note: "Owner: all readable, looks good. Asked whether the FUEL OFF selector not stopping the engine is intentional (clarification pending: free panel or in a run)." 

### 10. Engine Fire steps and the squawk in the briefing and debrief
expected: Easy checklist shows the panel steps; debrief rows show FUEL OFF, ECS pulled and the optional squawk.
result: pass
note: "Owner: passes, but checklist formatting is not right yet (see gap). Transponder note: with ELECT. MASTER off the transponder is dead too, so the optional squawk step makes no sense in Engine Fire; fine as a blueprint for now, scenarios get refined in later phases." 

### 11. The MAX run only during a run
expected: MAX on HIGH lights the top amber lamp for 120 s in a run, dark on the free panel.
result: pass

### 12. Order of the new procedures
expected: Say where the real sequence matters (Electrical and Engine Fire are unordered now).
result: pass
note: "Owner: order does not matter in these scenarios; Engine Fire steps are all hardware actions (ECS shut-off works with ELECT. MASTER off). Keep unordered. ALTN 1 FAIL may become a branching scenario with several causes (see scenario variants todo)." 

## Summary

total: 12
passed: 10
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "On Realistic the failure shows quickly: the onset comes soon, the reading starts in the yellow band and reaches red with the CAS message within about 10 s; Medium keeps its time constants"
  status: resolved
  reason: "User reported: the start takes a bit too long on Realistic, then one watches the temperature rise slowly for ever"
  severity: minor
  test: 1
  root_cause: ""
  artifacts: []
  missing:
    - "Shorter onset window for Realistic (scenario data, currently 5 to 20 s)"
    - "Correction (user): on Realistic the failure starts the reading just below the yellow band, so yellow is reached a few seconds after the scenario starts"
    - "Rise from onset to red and CAS message in about 10 s on Realistic only, Easy and Medium unchanged (scenario or level data, not a global time constant)"
  debug_session: ""
  resolved_by: "03-11 and commits 039e81c, e42ed3c"
  resolved_at: "2026-10-23"
  accepted_by_owner: "2026-10-23"

- truth: "On Realistic every failure shows a recognisable cue at the onset, including Engine Fire"
  status: deferred
  reason: "User reported (first live test, test 5): Engine Fire on Realistic is not solvable, nothing happens first and the pilot does not know what is expected"
  severity: major
  test: 5
  root_cause: "Engine Fire has no CAS message; the only cue is slowly rising temperatures. No cue mechanism exists in the scenario schema."
  artifacts:
    - path: ".planning/todos/pending/2026-10-23-realistic-level-visual-cues.md"
      issue: "design decision pending (windscreen above the panel, or pop-up)"
  missing:
    - "Windscreen area above the panel with static cues (fire, smoke, iced windscreen later), or an interim cue"
    - "Onset cue declared in the scenario data and checked by lint (L14 extension)"
  debug_session: ""
  deferred_to: "Phase 6 (windscreen and failure cues), owner decision 2026-10-23"

- truth: "Checklists in briefing and debrief look and read like the official checklist: numbered table, item and number left-aligned, desired action right-aligned, full-width comment lines between two numbers (for example the carry-out line), wording 1:1 as in the AFM"
  status: resolved
  reason: "User reported (test 10): checklist formatting is too jumbled; must be tabular and numbered like the official one; 1:1 accurate, no rephrasing or paraphrasing; copyright is not a concern, the AFM and checklists are public"
  severity: major
  test: 10
  root_cause: "Scenario steps are own-wording short lines (content policy: own words, short lines) and the outline lists them as plain lines without the official numbering, desired-action column or comment rows."
  artifacts:
    - path: ".planning/todos/pending/2026-10-23-checklist-verbatim-table.md"
      issue: "owner decision overrides the own-words rule of docs/CONTENT-POLICY.md for checklists"
  missing:
    - "Scenario format: a numbered row has number, item (left) and desired action (right); comment rows span the line between rows"
    - "Verbatim checklist text from the official checklist for all three scenarios"
    - "Update docs/CONTENT-POLICY.md, .claude/CLAUDE.md convention and the lint or tests that cap step lines at 10 words"
    - "Briefing and debrief outline renders it as a table"
  debug_session: ""
  resolved_by: "03-13, 03-14"
  resolved_at: "2026-10-23"
  accepted_by_owner: "2026-10-23"

- truth: "A gauge value in the yellow band gets a yellow box behind its label and its numeric value with black text and a yellow pointer on the bar; a value in the red band gets a red label box with white text and a red pointer"
  status: resolved
  reason: "User reported (after test 12, with photos of the real engine page: Oil Pres in yellow, Fuel Qty in red): the real display marks an out-of-range value with a coloured box and a pointer in the band colour; the trainer does not"
  severity: minor
  test: 1
  root_cause: "MfdFrame/ArcGauge/BarGauge colour the band but do not restyle the label, the value box or the pointer by the current band."
  artifacts:
    - path: "src/ui/panel/frames/BarGauge.tsx"
      issue: "label box, value box and pointer do not follow the live band"
    - path: "src/ui/panel/frames/ArcGauge.tsx"
      issue: "same for the arc gauges, if the real page does it there too (check the photo)"
    - path: ".input/mfd-oil-pres-yellow.png, .input/mfd-fuel-qty-red.png, .input/mfd-engine-page-full.webp"
      issue: "owner photos, private, not committed"
  missing:
    - "Yellow: label and value on a yellow box, black text, yellow pointer. Red: label box red, white text, red pointer. Green: unchanged."
    - "Driven by the live quantity band (derived from the simulated value); no text changes, only colours (rule G-0 holds)"
    - "Unit tests on the pure band-to-style mapping and an e2e check on the oil temperature run"
    - "The full engine page layout (combined gauges, fuel flow, fuel calculator, oxygen, de-ice, rudder trim) is NOT part of this gap: it goes to the physics fidelity phase"
  debug_session: ""
  resolved_by: "03-12"
  resolved_at: "2026-10-23"
  accepted_by_owner: "2026-10-23"
