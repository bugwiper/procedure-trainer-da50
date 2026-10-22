---
phase: 02-first-gradable-scenario
verified: 2026-10-22T13:40:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/02-first-gradable-scenario/02-01-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-01-SUMMARY.md
  - .planning/phases/02-first-gradable-scenario/02-02-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-02-SUMMARY.md
  - .planning/phases/02-first-gradable-scenario/02-03-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-03-SUMMARY.md
  - .planning/phases/02-first-gradable-scenario/02-04-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-04-SUMMARY.md
  - .planning/phases/02-first-gradable-scenario/02-05-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-05-SUMMARY.md
  - .planning/phases/02-first-gradable-scenario/02-06-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-06-SUMMARY.md
  - .planning/phases/02-first-gradable-scenario/02-07-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-07-SUMMARY.md
  - .planning/phases/02-first-gradable-scenario/02-08-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-08-SUMMARY.md
  - .planning/phases/02-first-gradable-scenario/02-09-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-09-SUMMARY.md
  - .planning/phases/02-first-gradable-scenario/02-10-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-10-SUMMARY.md
  - .planning/phases/02-first-gradable-scenario/02-11-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-11-SUMMARY.md
  - .planning/phases/02-first-gradable-scenario/02-12-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-12-SUMMARY.md
  - .planning/phases/02-first-gradable-scenario/02-13-PLAN.md
  - .planning/phases/02-first-gradable-scenario/02-13-SUMMARY.md
  - docs/GRADING.md
  - scenarios/engine/eng-oil-temp-green.toon
  - scenarios/engine/pack.toon
  - src/engine/grading.ts
  - src/scenario/lint.ts
  - src/scenario/packs-vite.ts
  - src/scenario/packs.ts
  - src/ui/App.tsx
  - src/ui/ack.ts
  - src/ui/session.ts
covered_digest: "v3:sha256:a745a78c5e7b2e91ceeeabe5c3ce7e31652b5befaff8484cfacb749ff6ee632a"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Open the deployed build on a real phone and a real tablet (iOS Safari and Android). Accept the notice, tap NEW SITUATION, read the briefing, press Start run, operate power lever and cowl flap with touch, press Procedure complete."
    expected: "Briefing and debrief cards fit the screen with the action row reachable, session buttons are tappable, the ENG OIL TEMP chip is readable, no accidental zoom, PASS shows after the golden run."
    why_human: "Real-device look and touch feel cannot be checked by emulation (Playwright desktop-chromium only was run here)."
  - test: "Read the UI wording against 02-UI-SPEC.md: acknowledgment dialog, briefing labels ('Steps outside the panel (not graded in this version)', exam note), debrief headings, leave-run confirm, error and empty messages."
    expected: "Wording matches the owner's intent and tone; the chip text 'ENG OIL TEMP' (the real CAS message) is accepted as the 'OIL TEMP HIGH' alert of the roadmap wording."
    why_human: "Wording and tone are a judgement call."
  - test: "Instructor review of docs/GRADING.md rules R1-R9 and of the checklist content in scenarios/engine/eng-oil-temp-green.toon (which steps are critical, which line is not graded, the power-reduction threshold of 10 percent of travel, the forbidden 'increase power')."
    expected: "A DA50 instructor confirms the rules and the severity assignment are acceptable for the procedure."
    why_human: "Domain correctness of the grading semantics against the AFM needs an instructor."
---

# Phase 2: First Gradable Scenario Verification Report

**Phase Goal:** Users can start one real emergency (Oil Temp High), run the procedure by operating the panel, finish with "Procedure complete" and receive an objective PASS/FAIL debrief.
**Verified:** 2026-10-22
**Status:** human_needed
**Re-verification:** No, initial verification

## Gate Results (run by the verifier)

| Gate | Result |
| ---- | ------ |
| `npx vitest run` | 44 files, 2185 tests passed |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run validate` | "1 scenario files checked, 0 problems" |
| Playwright desktop-chromium (`scenario`, `ack`, `replay` specs, against a fresh `build:e2e`) | 21 of 21 passed |
| `npm run validate -- tests/fixtures/broken` | exit with line:col errors for unknown control, unknown key, missing file |

No source file was modified; only `dist-e2e/` (git-ignored) was rebuilt.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | First-run acknowledgment (once), source/revision/disclaimer in every briefing | VERIFIED | `src/ui/ack.ts` (versioned localStorage key, fail-closed, session fallback), `Ack` mounted in `App.tsx` on `ackRequired`; `Briefing.tsx` prints `source.section/issue/document/verified` and `DISCLAIMERS[...].short`; `e2e/ack.spec.ts` passes (fresh visitor once, older version asks again); `tests/ack.test.ts` |
| 2 | NEW SITUATION (random or chosen) shows a briefing; panel opens in initial state with the alert in the alert area | VERIFIED | `session.ts` `newSituation/openChooser/chooseScenario` then `startRun` calls `bridge.reset(initial.controls, initial.quantities)`; CAS rule `eng_oil_temp` (text `ENG OIL TEMP`) derived from quantities and rendered by `CasChips` in `PfdFrame`; e2e "NEW SITUATION starts ENG OIL TEMP in its initial state", "CHOOSE SITUATION ...", "chip shows during the run" pass. Lint L10 ties scenario annunciations to firing rules. Wording is the real CAS text, see human item 2 |
| 3 | Operate controls, silent exam, end with "Procedure complete"; credit by resulting state, not clicks | VERIFIED | `Procedure complete` button in `App.tsx` calls `session.complete()` which grades `bridge.store.events()`; `grade()` evaluates predicates on resulting control state after the last event (golden `toggle-back` FAIL: cowl flap opened then closed is not credited; `travel_rel` relative to baseline). No audio code in `src`; e2e "exam stays silent" passes |
| 4 | Debrief PASS/FAIL, per-step verdicts, order violations, harmful actions; deterministic replay; golden, do-nothing, wrong-order, forbidden replays | VERIFIED | `Debrief.tsx`, `debrief-text.ts`, `outline.ts`; `tests/grading.test.ts` pins golden, do-nothing, forbidden, forbidden-reverted, toggle-back, wrong-order exactly (`toEqual`) plus JSON-identical determinism; `e2e/replay.spec.ts` "UI verdicts equal a node replay of the recorded log" passes; `docs/GRADING.md` documents R1-R9 |
| 5 | Scenario is TOON, loaded only via PackProvider/AccessPolicy; validate gives line-numbered errors and rejects unknown control ids | VERIFIED | `import.meta.glob` appears only in `src/scenario/packs-vite.ts` (gated by `tests/packs.test.ts`); `session.ts` uses `openScenario(packs, env, ref)` with `AccessPolicy` (fail closed on throw); `npm run validate` on broken fixtures prints `bad-control.toon:53:19 ... unknown control "lv.no_such_control"` |

**Score:** 5/5 truths verified, 0 behavior-unverified (state transitions and ordering are exercised by named unit tests and passing Playwright specs).

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `scenarios/engine/eng-oil-temp-green.toon`, `pack.toon` | VERIFIED | 76 and 8 lines, real content (decision, ordered/unordered group, forbidden, branches) |
| `src/engine/grading.ts` | VERIFIED | pure `grade`, `branchStatuses`; wired from `session.ts` |
| `src/scenario/{schema,parse,lint,toon-index,packs,packs-vite,validate-all}.ts`, `scripts/validate-scenarios.mjs` | VERIFIED | wired to app and CLI; one shared check |
| `src/ui/session.ts`, `clock-driver.ts`, `screens/*` | VERIFIED | session machine drives briefing, running, debrief, confirm, error and empty states |
| `src/engine/clock.ts` (VirtualClock) | VERIFIED | no real timers in engine (ESLint boundary passes) |
| `docs/GRADING.md` | VERIFIED | rules match `grade()` as read |

### Key Links

| From | To | Status |
| ---- | -- | ------ |
| `App.tsx` | `VITE_PACKS` then `createSession` | WIRED |
| `session.start` | `bridge.reset`, `bridge.setTimeSource`, `VirtualClock` | WIRED |
| `session.complete` | `grade()` over `bridge.store.events()` | WIRED |
| `PfdFrame` | `CasChips` from `bridge.cas` (derived from quantities and DA50RG_CAS) | WIRED |

### Data-Flow Trace

Oil temperature 128 in scenario `initial.quantities` flows through `bridge.reset` to the quantity set, the CAS rule (`> 125`) and the MFD gauges (e2e "MFD oil gauges read the scenario values" passes). Debrief reads `GradeResult` from the real recording. FLOWING.

### Requirements Coverage

All 13 IDs are claimed by at least one plan frontmatter and marked Complete in REQUIREMENTS.md. No orphans (SCN-06 maps to Phase 3).

| Requirement | Source Plans | Status |
| ----------- | ------------ | ------ |
| SCN-01 | 02-01, 02-03, 02-05, 02-07 | SATISFIED (schema, strict parse, line-numbered errors) |
| SCN-02 | 02-05, 02-07 | SATISFIED (`npm run validate`, lint L1-L10 against registry) |
| SCN-03 | 02-01, 02-04, 02-08, 02-11 | SATISFIED (initial controls/quantities, annunciations, checklist outline) |
| SCN-04 | 02-02, 02-13 | SATISFIED (critical/standard/optional, forbidden, ordered/unordered groups) |
| SCN-05 | 02-02, 02-06 | SATISFIED (state-based predicates, golden toggle-back) |
| SCN-07 | 02-01, 02-11 | SATISFIED (source, revision, disclaimer in file and briefing) |
| SCN-08 | 02-02, 02-09, 02-13 | SATISFIED (VirtualClock, pure grade, replay identity) |
| PNL-03 | 02-08 | SATISFIED (CAS chip in the alert area) |
| SES-01 | 02-04, 02-06, 02-10, 02-11, 02-12 | SATISFIED |
| SES-03 | 02-06, 02-13 | SATISFIED |
| SES-04 | 02-06, 02-13 | SATISFIED |
| PLT-03 | 02-02, 02-07, 02-12 | SATISFIED (single glob owner, AccessPolicy, OPEN_ACCESS) |
| PLT-04 | 02-09, 02-11 | SATISFIED |

### Anti-Patterns

No `TBD`/`FIXME`/`XXX` markers in `src`, `scripts`, `scenarios`, `e2e` or `docs/GRADING.md`. No stubs found in the files read.

### Advisory findings from 02-REVIEW.md (warnings, not gaps)

None of these breaks a must-have for the shipped scenario; they should be scheduled before Phase 3 adds scenarios.

| ID | Note |
| -- | ---- |
| WR-01 | Lint does not require at least one applicable critical step per scenario. The shipped scenario does fail a do-nothing run (tested), but a future file could pass vacuously. Add lint rule L11 before Phase 3 (three new scenarios) |
| WR-02 | `npm run validate` crashes (exit 1, stack trace) on a directory named `*.toon` and skips symlinked pack folders |
| WR-03 | Validation output echoes unescaped scenario text (CI log command injection, log-only impact) |
| WR-04 | Clock driver can add up to 1 s of virtual time per tab return; affects harmful-action times only, not verdicts. Matters for Phase 3 timed reactions |
| WR-05 | `configure-pages` step in the verify job likely lacks `pages` permission; first push to main may fail the deploy |

## Human Verification Required

1. **Real phone and tablet run-through.** Test: on real iOS Safari and Android, accept the notice, NEW SITUATION, Start run, operate power and cowl flap by touch, Procedure complete. Expected: all cards fit with action row reachable, correct PASS for the golden run. Why human: real-device look and touch feel.
2. **UI-SPEC wording and alert text.** Test: read dialogs, briefing, debrief, confirm and error text against `02-UI-SPEC.md`. Expected: wording accepted; chip reads "ENG OIL TEMP" (the real CAS text) where the roadmap says "OIL TEMP HIGH". Why human: wording judgement.
3. **Instructor review of `docs/GRADING.md` and the scenario file.** Test: a DA50 instructor reads rules R1-R9 and the severity, threshold and forbidden assignments. Expected: confirmed acceptable. Why human: domain correctness against the AFM.

## Gaps Summary

No gaps. All five roadmap success criteria are verified against the code, the four automated gates and 21 Playwright specs pass, and every requirement ID is accounted for. Status is `human_needed` solely because of the three human-judgement items above.

---

_Verified: 2026-10-22_
_Verifier: Claude (gsd-verifier)_
