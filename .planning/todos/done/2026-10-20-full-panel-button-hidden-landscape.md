---
created: 2026-10-20
title: "Full panel" button is covered by the footer disclaimer on a landscape phone
area: ui
source: 01-UAT test 5 (user finding)
---

On a phone in landscape the 44 px "Full panel" button (top right, shown only while zoomed) ends up behind the footer disclaimer, so the user cannot tap it. Double-tap and pinch-out still work.

Fix direction: stack the button above the footer (z-index and safe-area/inset), or move it away from the footer area; keep it 44 px. Add an e2e check on the landscape phone projects that the button is hit-testable (elementFromPoint at its centre) while zoomed. Related to the single-tap zoom-out todo, which may make the button less critical.

## Resolved

Closed by plan 01.1-07 (the button stands above the footer) and plan 01.1-26 (it takes the corner that covers no control; strict all-region gate, tablet-chromium project).
