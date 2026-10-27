---
phase: 05-windscreen-and-failure-cues
verified: 2026-10-27T12:00:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - .planning/phases/05-windscreen-and-failure-cues/05-01-PLAN.md
  - .planning/phases/05-windscreen-and-failure-cues/05-01-SUMMARY.md
  - .planning/phases/05-windscreen-and-failure-cues/05-02-PLAN.md
  - .planning/phases/05-windscreen-and-failure-cues/05-02-SUMMARY.md
  - .planning/phases/05-windscreen-and-failure-cues/05-03-PLAN.md
  - .planning/phases/05-windscreen-and-failure-cues/05-03-SUMMARY.md
  - scenarios/engine/eng-fire-in-flight.toon
  - src/aircraft/da50rg/cues.ts
  - src/aircraft/da50rg/physics.ts
  - src/aircraft/da50rg/quantities.ts
  - src/engine/cues.ts
  - src/scenario/lint.ts
  - src/ui/audio/aural.ts
  - src/ui/audio/driver.ts
  - src/ui/audio/sounds.ts
  - src/ui/audio/web-audio.ts
  - src/ui/panel/viewport.ts
  - src/ui/panel/windscreen/CabinSmoke.tsx
  - src/ui/panel/windscreen/Ice.tsx
  - src/ui/panel/windscreen/OilStreaks.tsx
  - src/ui/panel/windscreen/Windscreen.tsx
  - src/ui/panel/windscreen/frame.tsx
  - src/ui/panel/windscreen/roll-series.ts
  - src/ui/panel/windscreen/scenes.tsx
  - src/ui/panel/zoom.ts
covered_digest: "v3:sha256:c86d9fae044668ba27fbc91e29e72308a440e09602ae149ea89258e8f4e878d9"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 5: Windscreen and failure cues Verification Report

**Phase Goal:** A windscreen area above the panel shows the situation (parked in front of a hangar, takeoff roll, cruise over simple landscape) and failure cues driven by the simulation quantities: engine fire flames and smoke outside, cabin smoke partly hiding the instrument panel, a freezing windscreen with ice crystals and milky vision that warm air removes slowly and the WIND SHIELD spray removes visibly (pilot side only). A Realistic run without briefing gives the pilot something to see; the scene and the onset cue of each scenario are declared in scenario data and checked by lint. Owner extras: oil streaks, stopped propeller, cloud scene, aural cues (Web Audio), a moving runway.
**Verified:** 2026-10-27
**Status:** passed
**Re-verification:** No, initial verification (lean form, as for phases 3.1 and 4). The owner reviewed the scenes, layout, runway animation, overhead strip and propeller live on 2026-10-27 and approved them; the review list in `docs/PANEL-REVIEW.md` "Phase 5: owner review" is accepted.

The roadmap block lists no numbered success criteria, so the truths are derived from the goal and PNL-17, PNL-18, PNL-19, SCN-12. The owner direct fixes after plan 05-03 (runway edge lights, overhead strip as roll bar only, runway texture, seamless roll loop in `roll-series.ts`, spinning propeller as a faint disc with the blade only when stopped) are included.

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                                  | Status   | Evidence                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The panel space grows upward by a windscreen without moving any part; full view, zoom, pinch and pan use the extent; the windscreen is its own region (PNL-17)                          | VERIFIED | `extent` in `registry.ts` (defaults to the viewBox), `viewport.ts` and `zoom.ts` take the extent (`fullView`, `viewRect`, `zoomOut`, pan clamp); `Panel.tsx` uses the extent as the SVG viewBox. Layout, zoom and tap-size gates in vitest pass; `windscreen.spec.ts` passes on desktop and phone.                                                    |
| 2   | Scenes parked, takeoff roll, cruise and cloud exist as flat vector art without text; a scenario names its scene, an unknown id is rejected (PNL-17, SCN-12 L22)                        | VERIFIED | `scenes.tsx` (`SCENES`, `isSceneId`), `lint.ts` L22, `session.scene` (briefing, run, free flag). `?scene=` e2e for all four scenes and the fallback, "a started scenario shows the cruise scene" on easy, medium and Realistic, briefing shows the scene: all pass. The four shipped scenarios say `scene: cruise`.                               |
| 3   | The take-off roll moves, loops without a visible restart and stands still under reduced motion                                                                                        | VERIFIED | `roll-series.ts` (self-similar series, `ROLL_TEMPLATE_FAR` 1.205 below `ROLL_RATIO` 1.267), `RollMarks` in `scenes.tsx`, `w-roll` keyframes in `stage.css`, `prefers-reduced-motion` rule; `windscreen.test.ts` checks the loop on the same data; e2e "marks scroll, and stand still with reduced motion" passes. Looked at live by the owner.     |
| 4   | Engine fire flames and smoke come from `fire_intensity` on every level; Realistic shows nothing at the start and the flames within the bound (PNL-18)                                   | VERIFIED | `cues.ts` (`flames`, 0 to 60), `Flames` in `cue-layers.tsx`, `bridge.cueLevels` derived from the quantities (not the DOM). E2E "Engine Fire on Realistic shows no flames at the start and flames within 15 s" passes on both projects.                                                                                                              |
| 5   | Cabin smoke, windscreen ice with slow warm-air melt and the WIND SHIELD spray (pilot side only, clears within about a second), stopped propeller and oil streaks follow the simulation; smoke never blocks a press (PNL-18) | VERIFIED | `physics.ts`: lag `smoke_density`, rate models `ice_pilot`/`ice_copilot`/`oil_film`, reaction `windshield_spray` (10 s, pilot half only: `icePerMinute(inputs, true)`); `CabinSmoke` has `pointer-events="none"`, rendered over the regions; `Ice`, `OilStreaks`, `Disc`/`StoppedBlade` layers. `tests/windscreen-physics.test.ts`, `tests/cues.test.ts` and `e2e/cues.spec.ts` pass. Preview flags only set display values; the spray and warm air act in a simulated run (e2e covers the run), as the owner was told. |
| 6   | Aural cues are Web Audio synthesis: a caution bing, a warning tone with repeat, an engine drone that follows rpm; off by default, remembered, only in a live run, never feedback on right or wrong (PNL-19) | VERIFIED | `aural.ts` (pure rules), `driver.ts` (silent on the free panel, in a modal, in a hidden tab), `web-audio.ts` (context created in the tap), `sounds.ts` (one swappable bank), `sound-pref.ts`, footer `sound-toggle`. `aural.test.ts`, `web-audio.test.ts`, `sound-pref.test.ts` and `e2e/sound.spec.ts` (tone and engine pitch requested, 0 after ENGINE MASTER off, footer on one line) pass. The audible quality is not machine-checkable (headless). |
| 7   | A scenario declares its onset cues in data; lint rejects an unknown or duplicate cue, a cue visible at the Realistic start, a cue a do-nothing run does not show in time, and an onset with neither annunciation nor cue (SCN-12 L23, L24); Engine Fire declares `flames` | VERIFIED | `schema.ts` `Onset.cues` (max 4), `lint.ts` L23 (id check, start level, first-shown time at both window ends against the bound) and L24; `eng-fire-in-flight.toon` has `cues[1]: flames`; `scenario-lint.test.ts` and fixture `smoke-onset.toon` cover the rules. |

**Score:** 7/7 truths verified (0 present, behavior-unverified). The audible quality of the sounds and the visual look are human judgements already given by the owner (see Human Verification).

### Required Artifacts

| Artifact                                                                                        | Expected                             | Status   | Details                                                   |
| ----------------------------------------------------------------------------------------------- | ------------------------------------ | -------- | --------------------------------------------------------- |
| `src/ui/panel/windscreen/*` (Windscreen, frame, scenes, Ice, CabinSmoke, OilStreaks, cue-layers, roll-series, geometry) | the windscreen layer                 | VERIFIED | all imported and rendered from `Panel.tsx` / `Windscreen.tsx`; no stubs, no debt markers |
| `src/engine/cues.ts`, `src/aircraft/da50rg/cues.ts`, `scenes.ts`                                | cue and scene tables                 | VERIFIED | `DA50RG_ENV` carries `cues` and `scenes`; the bridge reads them |
| `src/ui/audio/*`                                                                                | aural rules, driver, player, bank    | VERIFIED | attached in `App.tsx`; test hook only in the e2e build    |
| `src/aircraft/da50rg/physics.ts`, `quantities.ts`                                               | smoke, ice, oil quantities, spray reaction | VERIFIED | hidden quantities with `SLOW_SCALE`, models and reaction wired |
| `src/scenario/lint.ts`, `schema.ts`                                                             | L22 to L24, `scene`, `onset.cues`    | VERIFIED | in `checkScenario`; `npm run validate` clean              |

### Key Link Verification

| From                      | To                              | Via                                                     | Status | Details                                                         |
| ------------------------- | ------------------------------- | ------------------------------------------------------- | ------ | --------------------------------------------------------------- |
| simulation quantities     | `Windscreen` layers             | `bridge.cueLevels` (computed) to `Panel.tsx`            | WIRED  | levels are a pure function of the quantities                    |
| `btn.deice_windshield`    | spray streaks and pilot-side ice | reaction flag `deice.windshield_spray` to `bridge.flags` | WIRED  | flag read in `physics.ts` and `Panel.tsx`                       |
| scenario `scene`/`onset.cues` | session scene / lint L22 to L24 | `session.scene`, `env.scenes`, `env.cues`               | WIRED  | defaults to `env.scenes.default`                                |
| run CAS and rpm           | `attachAural`                   | `bridge.cas`, `bridge.quantities`, `session.clock`      | WIRED  | `App.tsx`; effect on modal and screen changes                   |

### Data-Flow Trace (Level 4)

| Artifact        | Data Variable                  | Source                                   | Produces Real Data | Status  |
| --------------- | ------------------------------ | ---------------------------------------- | ------------------ | ------- |
| `Flames`        | `cues.flames`                  | `fire_intensity` lag model               | Yes                | FLOWING |
| `CabinSmoke`    | `cues.cabin_smoke`             | `smoke_density` behind `smoke_source`    | Yes                | FLOWING |
| `Ice`           | `ice_*_side`, `spray`          | rate models and reaction flag            | Yes                | FLOWING |
| `OilStreaks`    | `cues.oil_streaks`             | `oil_film` behind `oil_leak`             | Yes                | FLOWING |
| engine drone    | `rpm`                          | `rpm` quantity via `engineSound`         | Yes                | FLOWING |

Only the Engine Fire scenario drives a cue in the shipped packs; smoke, ice and oil are driven by parameters no shipped scenario sets yet (Phase 5.1), and are proven by tests, fixture and preview flags. This is by design, not a gap.

### Behavioral Spot-Checks and Test Runs

| Behavior                                   | Command                                                                                                        | Result                                  | Status |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------ |
| Whole unit suite (cache cleared)           | `rm -rf node_modules/.vitest-cache && npx vitest run`                                                          | 61 files, 3189 tests passed             | PASS   |
| Scenario files                             | `npm run validate`                                                                                             | 4 scenario files checked, 0 problems    | PASS   |
| Windscreen, cues and sound specs           | `npx playwright test e2e/windscreen.spec.ts e2e/cues.spec.ts e2e/sound.spec.ts --project=desktop-chromium --project=phone-chromium` | 76 passed, 0 failed                     | PASS   |

### Probe Execution

SKIPPED (the phase declares no probe scripts).

### Requirements Coverage

| Requirement | Source Plan   | Description                                                      | Status    | Evidence                  |
| ----------- | ------------- | ---------------------------------------------------------------- | --------- | ------------------------- |
| PNL-17      | 05-01, 05-03  | windscreen area, scenes, panel space grows, gates hold           | SATISFIED | truths 1 to 3             |
| PNL-18      | 05-01, 05-02  | failure cues from the quantities, never the DOM                  | SATISFIED | truths 4 and 5            |
| PNL-19      | 05-03         | Web Audio aural cues, off by default, live run only              | SATISFIED | truth 6                   |
| SCN-12      | 05-01, 05-02  | scene and onset cues in data, lint L22 to L24                    | SATISFIED | truths 2 and 7            |

No orphaned requirements: `REQUIREMENTS.md` maps exactly these four to Phase 5.

### Anti-Patterns Found

None. No `TBD`, `FIXME`, `XXX` or `TODO` in the changed windscreen, audio, cue and preview files. The `Math.round` calls in `Ice.tsx` run at module load on a fixed seed table (art, not engine code).

### Human Verification (accepted)

Already done by the owner on 2026-10-27, so they do not block `passed`:

1. Windscreen scenes, layout, runway animation, overhead strip, propeller: reviewed live and approved.
2. Smoke, ice, oil and sound: checked through the preview URL flags, no problems reported.

Notes carried with the acceptance: the audible quality of the sounds was not machine-checkable (headless); the WIND SHIELD spray and warm air act only inside a simulated run (no icing scenario before Phase 5.1; the e2e covers the run); the preview flags set display values only.

### Deferred Items

Not gaps: ground and takeoff emergencies, pedals, the icing scenario and other new scenarios (Phase 5.1); night and dusk scenes (todo `2026-10-27-night-dusk-scenes.md`); real audio recordings (the owner may supply them, the bank is swappable); the free-panel simulation (Phase 6); earlier known open items.

### Gaps Summary

None. All derived truths are verified in the code, the unit suite, the validator and the sampled e2e specs.

### Code review notes

No blocker found in the changed source. Findings, severity-tagged:

- **LOW** `src/aircraft/da50rg/physics.ts` (`icePerMinute`): after the 10 s spray the pilot side accretes again at the full rate while `ice_accretion` is above 0. This is documented (no exit-from-icing model before 5.1), but an icing scenario in 5.1 must set `ice_accretion` back to 0 or the spray will only clear the glass for a short moment.
- **LOW** `src/ui/App.tsx`: `?scene=` is read in the production build too (only known ids are accepted). Harmless, but the comment calls it a development flag; the same holds for `?q=` and `?flags=`.
- **LOW** `src/ui/audio/driver.ts`: while a modal is open or the tab is hidden `auralStep` is not called, so a caution that appears and clears inside that time is never sounded and `known` is stale on return. Intended (no sound while blocked), noted so nobody expects a catch-up bing.
- **INFO** `src/aircraft/da50rg/cues.ts` / `lint.ts`: `prop_stopped` runs over one rpm (99 to 100), the layer treats any level above 0 as stopped while `cueVisible` needs 0.1. Consistent in use (no scenario declares `prop_stopped` as an onset cue); if one ever does, L23 will measure the time to rpm below about 99.1 rather than below 100.

## Verdict

Phase 5 goal achieved. Ready to proceed.

---

_Verified: 2026-10-27_
_Verifier: Claude (gsd-verifier)_
