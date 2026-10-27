---
phase: 05-windscreen-and-failure-cues
plan: 03
subsystem: ui
tags: [web-audio, sound, scenes, cloud, runway, documentation]
requires:
  - phase: 05-windscreen-and-failure-cues
    provides: windscreen layer, scene ids, cue table, preview flags
provides:
  - footer control Sound (off by default, remembered, live run only) and the aural rules, sounds, Web Audio glue and driver in src/ui/audio
  - scene cloud and a scrolling take-off roll (CSS only, none under reduced motion)
  - phase 5 documentation (GRADING sections, PANEL-REVIEW Phase 5 list, README, CLAUDE.md), requirements and todos
affects: [Phase 5.1 scenarios and the runway speed from the ground speed, a later swap to audio recordings]
status: complete
actuals:
  tokens: 32000
  tasks: 3
  commits: 4
plan_head_before: 4405f3eda37fad643252201d37f0277c3cd52521
plan_head_after: 5bfd62da39c74f52e0ee8f54de21e328beb789ab
tech-stack:
  added: []
  patterns: [sounds behind one module with a name per sound, injected audio context factory, driver that polls the run each frame, CSS-only perspective scroll by per-mark scale about the vanishing point]
key-files:
  created: [src/ui/audio/aural.ts, src/ui/audio/sounds.ts, src/ui/audio/web-audio.ts, src/ui/audio/sound-pref.ts, src/ui/audio/driver.ts, tests/aural.test.ts, tests/sound-pref.test.ts, tests/web-audio.test.ts, e2e/sound.spec.ts, .planning/todos/pending/2026-10-27-night-dusk-scenes.md, .planning/todos/done/2026-10-23-realistic-level-visual-cues-phase5.md]
  modified: [src/ui/App.tsx, src/ui/stage.css, src/aircraft/da50rg/scenes.ts, src/ui/panel/windscreen/scenes.tsx, tests/windscreen.test.ts, tests/scenario-lint.test.ts, tests/panel-review.test.ts, e2e/windscreen.spec.ts, docs/GRADING.md, docs/PANEL-REVIEW.md, README.md, .claude/CLAUDE.md, .planning/REQUIREMENTS.md]
key-decisions:
  - "Owner answers of 2026-10-27 stand: a caution is one short bing, the warning tone stays three pulses with the 4 s repeat (five at most), and the three sounds sit in one swappable module (caution, warning, engine)."
  - "The engine drone is silent below 100 rpm, because the run-down tail never reaches exactly 0."
requirements-completed: [PNL-17, PNL-18, PNL-19, SCN-12]
completed: 2026-10-27
---

# Phase 5 Plan 03: Aural cues, cloud scene, moving runway and phase documentation Summary

The footer Sound control turns on Web Audio cues that play only in a live run: one bing for a caution, a three-pulse repeating tone for a warning and an engine drone that follows the rpm. The cloud scene exists, the take-off roll scrolls, and the phase is documented.

## What changed

- Task 1 (tracer, 73ccb04): `aural.ts` (pure tone and repeat rules, `engineSound`), `sounds.ts` (one entry per name: caution, warning, engine, so recordings can replace them), `web-audio.ts` (context behind an injected factory, created inside the Sound tap or at the first press after a reload), `sound-pref.ts` (`da50.sound`, memory fallback), `driver.ts` (per-frame look at the run, silent on the free panel, in a modal and in a hidden tab). Footer button `sound-toggle` with `aria-pressed` and a constant label; the e2e build exposes `window.__panelAudio`.
- Task 2 (c1c6671, 52886ee): scene id `cloud` (one grey-white sheet, soft bands) and `RollMarks` on the take-off roll: each mark scales about the vanishing point to the next mark's place by a CSS animation, one named period `--w-roll-period` (0.9 s), none under reduced motion.
- Task 3 (5bfd62d): GRADING sections "Scenes and cues for authors (phase 5)" and "Instructor review (phase 5, 2026-10-27)", PANEL-REVIEW "Phase 5: owner review" (eight items, preview flags `?scene=`, `?q=`, `&flags=`), README, one CLAUDE.md sentence, region count corrected to 34, PNL-17, PNL-18, PNL-19 and SCN-12 marked complete with the tooling, the visual-cues todo split (done file, pending keeps Phase 5.1), the de-ice todo item 3 marked done, the night and dusk scenes todo.

## Checks

- Full vitest (61 files, 3175 tests, cache cleared), typecheck, lint, format:check and `npm run validate` (4 files) pass; `tests/fixtures/recordings.json` unchanged. `tests/validate-cli.test.ts` once timed out under the load of a parallel Playwright run and passes alone and on the final full run.
- Playwright, the whole suite on desktop, phone, tablet and phone-portrait chromium: 1151 passed, 481 skipped, 0 failed. The sound, zoom, layout, art-fit, static-text, session-area, windscreen, cues and scenario specs on desktop, phone and tablet webkit: 256 passed, 0 failed.
- Footer: still one line on the phone landscape profile (734 px), in a run too (height 60, unchanged), after tighter gaps in a narrow landscape media query.
- Panel svg element count: the takeoff-roll scene has more elements than before (15 marks of 4 elements) but only one scene renders; the budget gate passes.

## Deviations from Plan

- Caution is one single bing instead of the two-note chime (owner answer).
- [Rule 1 - Bug] The engine sound is silent below 100 rpm, not only at 0: the rpm run-down tail never reaches exactly 0, so the plan's "falls to 0" never came true.
- [Rule 3 - Blocking] A touch tap on a non-interactive footer text sent no pointer event to the arming listeners in iPhone WebKit; the first-press arming also listens for `click`.
- [Rule 3 - Blocking] With Sound in the footer the in-run footer wrapped on the 734 px phone profile (60 to 80 px); a narrow-landscape media query tightens gaps, run-button padding and letter spacing.
- Edge marks are separate small bars beside the runway edge lines, scrolling with the centre dashes (the solid edge lines stay); the centre dashes sit behind the strut and show little.
- Prettier reflowed the old text of `docs/PANEL-REVIEW.md` once by mistake; that file was restored by path and only the new section kept.

## Known Stubs

None.

## Threat Flags

None. No new network surface; the audio context is created only after a user gesture, and the sound choice is one storage key.

## Self-Check: PASSED

Files and the four commits (73ccb04, c1c6671, 52886ee, 5bfd62d) exist.
