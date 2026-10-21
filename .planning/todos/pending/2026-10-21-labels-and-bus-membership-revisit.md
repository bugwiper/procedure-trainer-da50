---
created: 2026-10-21
title: Revisit label and default-state assumptions and the breaker bus membership when scenarios are defined
area: panel, content
source: 01.1-UAT.md test 8 and 01.2-UAT.md test 6 (skipped, deferred); docs/PANEL-LABELS.md Q-01..Q-14; docs/PANEL-REVIEW.md Q2-01..Q2-10, U2-01..U2-37, P2-06..P2-15
---

The owner accepted the assumed labels, defaults and sizes without corrections and could not yet confirm the bus membership of the pump boxes, the lower row and the flap strip or the avionics proposals. Nothing blocks work; the assumptions stay listed in `docs/PANEL-LABELS.md` and `docs/PANEL-REVIEW.md`.

When the first scenarios are written (Phase 2 and 3), check against the AFM for each control and breaker the scenario uses: the label wording and rating, the default state, the bus the breaker belongs to (flat ids `cb.*` stay, group only affects drawing), and whether the ANNUN-TEST position springs back (Q-02). Correct by data edit in `src/aircraft/da50rg/controls/*.ts` and the matching reference row in `tests/layout-reference.ts`. The straight-on close-ups the owner will add may move breaker rows by 3 to 8 units (U2-30).
