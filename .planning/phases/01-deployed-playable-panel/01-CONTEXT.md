# Phase 1: Deployed Playable Panel - Context

**Gathered:** 2026-10-19
**Status:** Ready for planning

<domain>
## Phase Boundary

A live GitHub Pages site where a responsive DA50 RG panel can be operated by mouse or touch (switches, guarded switches, detented levers, buttons). Panel is generated from a control registry with stable ids and legal states; panel regions are data. Deploy via GitHub Actions with host-agnostic base path. A written content policy for AFM-derived text exists before any procedure text is committed. No scenarios, grading or live gauges in this phase.

</domain>

<decisions>
## Implementation Decisions

### Panel layout & regions
- **D-01:** One single fixed landscape "instrument panel" coordinate space (one root SVG viewBox, scaled to fit). No tabbed/stacked regions.
- **D-02:** Phone portrait: fit whole panel to width and show a non-blocking "rotate to landscape" hint. Region zoom/pan is v2 (PNL-V2-01); use large invisible hit targets so small controls stay operable.
- **D-03:** Region data model = `{ id, name, bounds (viewBox rect), controlIds[] }`; renderer iterates regions. Enough for later region zoom without a rewrite.
- **D-04:** Regions present in Phase 1: PFD (static placeholder), Engine page/MFD (frame), Switch bank, Pedestal/quadrant.

### Control set & interaction
- **D-05:** Detented levers (throttle, prop, cowl flap) are operated by pointer-drag along a track with snap to nearest detent on release, using Pointer Events + setPointerCapture; tapping a detent marker jumps to it.
- **D-06:** Guarded switch: the guard is a separate control with its own state. Tap guard to lift, then tap the switch. Guard stays up until tapped again (no auto-close). Switch cannot actuate while guard is closed.
- **D-07:** Phase 1 ships only a small demonstrative set of guarded/confirm-to-actuate controls; the real safety-control set is scoped by Phase 2/3 scenarios.
- **D-08:** Registry uses typed control kinds: toggle, guarded-toggle, detent-lever, momentary-button. Each entry has id, kind, label, region, position, legal states, default. Renderer picks widget by kind; controls can only reach their defined legal states.
- **D-09:** Control state lives in the aircraft/panel state model, not the DOM. Taps on neutral areas produce no control event.

### Visual style & fidelity
- **D-10:** Flat/schematic dark-cockpit look: dark panel, simple vector shapes, clear placard-style ALL CAPS labels.
- **D-11:** Gauges and glass areas are static frames with plausible idle values in Phase 1; live state binding arrives in Phase 3 (PNL-04).
- **D-12:** Font: B612 / B612 Mono, self-hosted via @fontsource; import only weights used.
- **D-13:** State feedback = lever/switch position change + colour/lit indicator + small state text (e.g. ON/OFF) so it reads on small screens and for colour-blind users.

### Content policy (CNT-03)
- **D-14:** Repo stays public in v1; policy states paid content will move to a private source before any paid pack (BUS-V2-01).
- **D-15:** Short verbatim AFM checklist step lines are allowed; narrative/explanatory text must be paraphrased. Each scenario carries AFM source and revision. Compliance remains the content author's responsibility.
- **D-16:** Policy lives in `docs/CONTENT-POLICY.md`, linked from README/authoring guide, and surfaced via a link in the app footer/About together with the "training aid, not AFM" notice.

### Claude's Discretion
- Exact panel coordinates, widget art details, hit-target sizing, concrete switch/lever inventory beyond the demo set, and tooling layout of the registry file.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project
- `.planning/PROJECT.md` — core value, constraints, out-of-scope
- `.planning/REQUIREMENTS.md` — PLT-01, CNT-03, PNL-01, PNL-02, PNL-05, PNL-06
- `.planning/ROADMAP.md` §Phase 1 — goal and success criteria
- `.claude/CLAUDE.md` — pinned stack (Vite 8, Preact 11 + signals, TS ~6.0.3, base path handling, Pointer Events, 100dvh)
- `.planning/research/` — stack and pitfall research

No external AFM specs are committed; none should be before the content policy exists.

</canonical_refs>

<code_context>
## Existing Code Insights

Greenfield: no source code exists yet.

### Reusable Assets
- None.

### Established Patterns
- Stack conventions from `.claude/CLAUDE.md`: engine/state framework-agnostic in `src/engine`, UI via signals; state-based screens, no History-API router; hit targets >= ~44 px on phones.

### Integration Points
- Control registry and panel state model will be consumed by Phase 2's scenario validation and grading.

</code_context>

<specifics>
## Specific Ideas

No specific references beyond the decisions above.

</specifics>

<deferred>
## Deferred Ideas

- Phone region zoom/pan (already PNL-V2-01).
- Live gauge binding (Phase 3).

</deferred>

---

*Phase: 1-Deployed Playable Panel*
*Context gathered: 2026-10-19*
