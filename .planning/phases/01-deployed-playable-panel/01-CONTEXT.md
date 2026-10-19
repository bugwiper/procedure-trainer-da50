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

- **D-04a:** The MFD region has two static pages: Map with a small engine-gauge strip on the left, and the full Engine page. A registry control (MFD page button/softkey) toggles between them; the page is panel state (gradable later). Live gauge values still come in Phase 3.
- **D-04b:** Reference photos of the real aircraft are in `.input/` (git-ignored, private). Use them only as visual reference for layout, gauge set/order/colour bands and annunciation wording; redraw as original functional SVG, never embed or trace them (Garmin/Diamond IP, public repo).

### Control set & interaction
- **D-05:** Detented levers (throttle, prop, cowl flap) are operated by pointer-drag along a track with snap to nearest detent on release, using Pointer Events + setPointerCapture; tapping a detent marker jumps to it.
- **D-05a (amends D-05, 2026-10-19 after research):** The DA50 RG has no prop lever (single POWER lever; ECU governs prop). Demo detent levers are: POWER (ground idle behind a detent / flight idle / max), FLAPS selector, landing gear selector, and COWL FLAP modelled as a detent lever (real actuation type to be confirmed later). No prop lever on the panel. Roadmap success criterion 3's "(throttle, prop, cowl flap)" is read as this set.
- **D-07a (refines D-07) — SUPERSEDED by D-07b:** ~~Demo guarded-toggles are the ELT switch and ELECT. MASTER.~~
- **D-07b (user correction, 2026-10-19, supersedes D-07a):** ELT and ELECT. MASTER are red but NOT guarded; they are plain toggles. The cockpit's only guarded switch is the ALTERNATE switch on the de-ice panel (far left of the panel). Phase 1 adds a minimal de-ice panel region containing only that guarded ALTERNATE switch as the single guarded-toggle (other de-ice controls stay out of scope). It exercises the D-06 guard flow; FIKI scenarios later reuse it.
- **D-07c (user request + new reference photos IMG_0650.JPG and DA50_virtual.jpg, 2026-10-19):** The panel model must also capture the left panel and the under-panel controls:
  - Left panel, lower left (engine area): FADEC switch (AUTO / FORCE B) with FADEC TEST button; ALTERNATOR 1 and ALTERNATOR 2 switches (ON/OFF); bottom row left-to-right: (prop) DE-ICE switch, FUEL TRANS selector (OFF/ON), EMERG FUEL PUMP, ENGINE START button, ENGINE MASTER, ESS BUS, ELECT. MASTER, AV MASTER, PITOT/STALL HEAT. All plain kinds (toggle / momentary-button); none guarded (D-07b).
  - De-ice panel (top far left) stays limited to the guarded ALTERNATE switch in Phase 1 (D-07b); its other controls (mode selector, windshield, ice light, pump, annun test) are deferred with FIKI.
  - New under-panel region (below the instrument panel, data like the other regions): ALTERNATE STATIC valve left of the pilot's left knee; EMERGENCY GEAR EXTENSION lever left of the centre pedestal (pilot's right knee); ALTERNATE AIR lever right of the centre pedestal (copilot's left knee).
  - Pedestal: COWL FLAP is a pedestal lever with OPEN/CLOSED (resolves the D-05a open point); POWER lever on the pedestal.
  - Planner assumptions to flag (confirm later with the user/AFM): alternate static and alternate air as 2-position levers (CLOSED/OPEN or NORMAL/ALTERNATE); emergency gear extension as a 2-position lever (NORMAL/EMERGENCY) treated as a safety-consequence control under PNL-06 (confirm-to-actuate or deliberate pull, no stray-tap actuation).
  - Photos remain visual reference only (D-04b): redraw schematically, never embed/trace.
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
- Full de-ice (TKS/FIKI) panel controls and FIKI emergency scenarios. Source: FIKI supplement `.input/FIKI_AFM.pdf` (private, git-ignored; paraphrase per content policy). Highly relevant for later scenario phases.

</deferred>

---

*Phase: 1-Deployed Playable Panel*
*Context gathered: 2026-10-19*
