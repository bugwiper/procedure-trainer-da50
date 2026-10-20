---
status: complete
phase: 01-deployed-playable-panel
source: [01-VERIFICATION.md]
started: 2026-10-20T09:08:55Z
updated: 2026-10-20T09:28:18Z
---

## Current Test

[testing complete]

## Tests

### 1. Real iPhone, iOS Safari
expected: all control kinds, lever drags, pinch, pan and double-tap zoom-out work by touch (Playwright WebKit cannot emulate these)
result: pass

### 2. Real Android phone, Chrome
expected: same sequence as test 1, plus rotating between portrait and landscape
result: skipped
reason: no Android phone available (accepted by the owner 2026-10-20: early prototype phase)

### 3. Real tablet
expected: touch operation of each control kind and region zoom
result: skipped
reason: no tablet available (accepted by the owner 2026-10-20: early prototype phase)

### 4. Smallest landscape phone, under-panel regions
expected: tapping the background of the tiny under-panel regions zooms in despite very little background clearance (about 1.5 px)
result: pass
note: "Finding (UX, not a failure): once zoomed into a region, a single background tap does nothing, while double-tap always toggles back. User prefers single tap on the background while zoomed (including intermediate zoom levels) to zoom fully out."

### 5. Portrait phone tap size
expected: region tap alone stays under 44 px for the widest regions by design; pinch to a 200-unit-wide view reaches 44 px. Owner confirms this satisfies ROADMAP success criterion 6
result: pass
note: "Finding (UX, not a failure): on a phone in landscape the Full panel button is hidden behind the footer disclaimer. Zoom level itself is fine."

### 6. Layout fidelity against the real aircraft
expected: control positions match the aircraft (reference table came from private photos not in the repo); confirm the de-ice ALTERNATE label, position and states against the supplement (open item D-07b)
result: pass
note: "Finding (appearance, not a failure): function of buttons, switches and levers fits the real DA50. Several switch shapes differ from the aircraft: ELECT. MASTER is a big red rocker, ELT a small red rocker, ESS BUS a medium red rocker, the others white; alternators are already accurate. A general concern about the overall panel appearance is to be discussed after the UAT."

### 7. Judgment-tier prohibitions
expected: no state shown by colour alone, no non-existent controls, no implied Diamond or Garmin approval (the verifier found no violation but flagged these for human review)
result: pass
note: "Finding (scope, not a failure): some controls are missing that may become relevant when scenarios are extended. Open question: widen the control set now or extend per scenario later; related to the owner concern about overall panel appearance, to be discussed after the UAT."

## Summary

total: 7
passed: 5
issues: 0
pending: 0
skipped: 2
blocked: 0

## Gaps
