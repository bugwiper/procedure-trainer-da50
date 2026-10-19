# Phase 1: Deployed Playable Panel - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-19
**Phase:** 1-Deployed Playable Panel
**Areas discussed:** Panel layout & regions, Control set & interaction feel, Visual style & fidelity, Content policy (CNT-03)

---

## Panel layout & regions

| Option | Selected |
|--------|----------|
| Single fixed instrument panel | ✓ |
| Stacked/tabbed regions | |
| Two-row layout | |

**Phone:** Fit + rotate hint ✓ (alternatives: fit only, landscape-lock prompt)
**Region model:** id + bounds + control ids ✓ (alternative: nested transforms)
**Regions:** PFD placeholder, Engine page/MFD, Switch bank, Pedestal/quadrant (all selected)

---

## Control set & interaction feel

**Levers:** Drag along track with detent snap ✓ (alternatives: tap-to-step, both)
**Guards:** Tap guard to lift, then tap switch; guard stays up ✓ (alternatives: auto-close, single-control two-tap)
**Safety set:** Only a small demo set now ✓
**Registry:** Typed kinds ✓ (alternative: generic state machine)

---

## Visual style & fidelity

**Style:** Flat/schematic dark cockpit ✓
**Gauges:** Static frames with idle values ✓
**Font:** B612 / B612 Mono ✓
**Feedback:** Position + colour + state label ✓

---

## Content policy (CNT-03)

**AFM text:** User first asked for clarification; after explanation chose short verbatim step lines allowed (alternative: paraphrase only).
**Repo:** Public now, revisit before paid packs ✓
**Surface:** docs/CONTENT-POLICY.md and app footer/About link ✓

---

## Claude's Discretion

Exact coordinates, widget art, hit-target sizing, inventory beyond demo set.

## Deferred Ideas

Phone region zoom (v2), live gauge binding (Phase 3).
