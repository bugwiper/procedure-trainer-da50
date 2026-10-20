---
status: testing
phase: 01-deployed-playable-panel
source: [01-VERIFICATION.md]
started: 2026-10-20T09:08:55Z
updated: 2026-10-20T09:08:55Z
---

## Current Test

number: 1
name: Real iPhone, iOS Safari
expected: |
  Open https://bugwiper.github.io/procedure-trainer-da50/ . Every control kind works by touch (toggles, lever drags, ALTERNATE guard, ENGINE START / FADEC TEST hold), tap a region zooms in, pinch and pan work, double-tap zooms out; no page scroll, no zoom bounce, no long-press callouts.
awaiting: user response

## Tests

### 1. Real iPhone, iOS Safari
expected: all control kinds, lever drags, pinch, pan and double-tap zoom-out work by touch (Playwright WebKit cannot emulate these)
result: [pending]

### 2. Real Android phone, Chrome
expected: same sequence as test 1, plus rotating between portrait and landscape
result: [pending]

### 3. Real tablet
expected: touch operation of each control kind and region zoom
result: [pending]

### 4. Smallest landscape phone, under-panel regions
expected: tapping the background of the tiny under-panel regions zooms in despite very little background clearance (about 1.5 px)
result: [pending]

### 5. Portrait phone tap size
expected: region tap alone stays under 44 px for the widest regions by design; pinch to a 200-unit-wide view reaches 44 px. Owner confirms this satisfies ROADMAP success criterion 6
result: [pending]

### 6. Layout fidelity against the real aircraft
expected: control positions match the aircraft (reference table came from private photos not in the repo); confirm the de-ice ALTERNATE label, position and states against the supplement (open item D-07b)
result: [pending]

### 7. Judgment-tier prohibitions
expected: no state shown by colour alone, no non-existent controls, no implied Diamond or Garmin approval (the verifier found no violation but flagged these for human review)
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
