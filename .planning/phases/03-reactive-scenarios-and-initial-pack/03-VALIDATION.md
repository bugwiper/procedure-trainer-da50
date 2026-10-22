---
phase: "03"
slug: reactive-scenarios-and-initial-pack
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-22"
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: the Validation Architecture section of `03-RESEARCH.md`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.5 (node environment) for engine, schema, lint, replay; Playwright 1.64.1 for flows |
| **Config file** | `vite.config.ts` (vitest key), `playwright.config.ts` |
| **Quick run command** | `npm run typecheck && npx vitest run <affected files>` |
| **Full suite command** | `npm run typecheck && npm run lint && npx vitest run && npm run validate` (then `npm run build:e2e` and `npx playwright test --project=desktop-chromium`) |
| **Estimated runtime** | quick ~20 s, full Vitest ~60 s |

---

## Sampling Rate

- **After every task commit:** `npm run typecheck` plus the one or two affected Vitest files
- **After every plan wave:** `npx vitest run`, `npm run validate`, affected Playwright specs on `desktop-chromium`
- **Before `/gsd-verify-work`:** typecheck, lint, format check, full Vitest, validate, production build, chromium projects, one WebKit attempt
- **Max feedback latency:** 60 seconds for unit checks

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| SCN-06 | `stepSim` deterministic; incremental equals `simulate`; seeded onset; mulberry32 known answer | unit | `npx vitest run tests/sim.test.ts` | ❌ W0 |
| SCN-06 | No fault effect before `onsetAt`; realistic start equals base state | unit | `npx vitest run tests/sim.test.ts` | ❌ W0 |
| SCN-06 | Outcome fires after `hold_s` only while the predicate holds; shown in `GradeResult.outcome` | unit | `npx vitest run tests/grading.test.ts` | extend |
| SCN-06 | Retract: unfired reaction cancelled; fired reaction becomes `consumed` | unit | `npx vitest run tests/run.test.ts` | ❌ W0 |
| SCN-06 | Fixed-step clock driver: whole steps, remainder carried, pause on hidden tab/modal | unit | `npx vitest run tests/clock-driver.test.ts` | extend |
| PNL-04 | Every engine-page gauge bound to a named quantity; band colours from data | unit | `npx vitest run tests/avionics.test.ts tests/bridge.test.ts` | extend |
| PNL-04 | Oil temperature ramps up after onset and falls after correct actions | unit | `npx vitest run tests/physics.test.ts` | ❌ W0 |
| PNL-04 | Needle moves on the production build during a run | e2e | `npx playwright test e2e/run-reaction.spec.ts --project=desktop-chromium` | ❌ W0 |
| PNL-07 | Transponder code entry commits one event; 7700 step credited; layout gates | unit + e2e | `npx vitest run tests/xpdr.test.ts tests/layout.test.ts`; `npx playwright test e2e/xpdr.spec.ts` | ❌ W0 |
| CNT-01 | Three scenarios: validate clean; golden PASS, do-nothing FAIL, wrong-order FAIL, forbidden FAIL | unit | `npx vitest run tests/grading.test.ts tests/packs.test.ts`; `npm run validate` | extend |
| CNT-01 | Chooser reaches each scenario; blueprint gate covers all scenarios | unit + e2e | `npx vitest run tests/blueprint.test.ts tests/packs.test.ts`; `npx playwright test e2e/scenario.spec.ts` | extend |
| 1a | Realistic level: no briefing, onset in window, reaction time from onset | e2e + unit | `npx playwright test e2e/scenario.spec.ts`; `npx vitest run tests/session.test.ts` | extend |

---

## Wave 0 Requirements

- [ ] `tests/sim.test.ts`: determinism, onset, outcomes, PRNG known answer
- [ ] `tests/run.test.ts`: store-backed run, retract rebuild, `markConsumed`
- [ ] `tests/physics.test.ts`: physics validation, base state, response directions
- [ ] `tests/xpdr.test.ts`: code-entry control, entry buffer, registry and layout rows
- [ ] `e2e/run-reaction.spec.ts`, `e2e/xpdr.spec.ts`
- [ ] Fixtures in `tests/fixtures/recordings.json` per new scenario
- [ ] Update `tests/bridge.test.ts`, `tests/session.test.ts`, `tests/predicates.test.ts`, `tests/avionics.test.ts` (idle to base), `tests/blueprint.test.ts`, `e2e/scenario.spec.ts` (Realistic enabled)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Physics constants, outcome thresholds, forbidden lists feel right | SCN-06, CNT-01 | Instructor judgement (assumptions A1-A11) | Owner runs each scenario on desktop and phone and confirms |
| Fuel valve and ECS shut-off positions | CNT-01 | Layout fidelity needs owner-confirmed positions | Owner confirms or keeps them as ungraded lines |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
