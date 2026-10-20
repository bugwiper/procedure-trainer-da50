---
created: 2026-10-20
title: Single tap on panel background while zoomed should zoom fully out
area: ui
source: 01-UAT test 4 (user finding)
---

Phase 1 behaviour (plan 01-09): tapping a region background zooms in; while zoomed, a single background tap does nothing and only double-tap/double-click, pinch-out or the "Full panel" button zoom out.

Requested: while zoomed (including intermediate zoom levels), a single tap on any panel background should zoom fully out, so one gesture toggles in and out.

Care points: drags and pinches must still pan/zoom without triggering it; taps on controls still belong to the control; update tests/zoom.test.ts and e2e/zoom.spec.ts (the "double tap zooms out" case and the note that only taps while zoomed count toward a double tap).
