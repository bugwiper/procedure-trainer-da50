---
phase: "1"
slug: "deployed-playable-panel"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-19"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.0.5 (unit, node env) + Playwright 1.64.1 (e2e, chromium + webkit) |
| **Config file** | none — Wave 0 installs (`vite.config.ts` `test` key, `playwright.config.ts`) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run typecheck && npm run lint && npm test && npm run e2e` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (+ `npm run typecheck` when types change)
- **After every plan wave:** Run `npm run typecheck && npm run lint && npm test && npm run e2e`
- **Before `/gsd-verify-work`:** Full suite must be green in CI, then the manual real-device checklist
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Filled from the PLAN.md task IDs (2026-10-19). Requirement → test mapping follows RESEARCH.md § Validation Architecture; the research's single `e2e/controls.spec.ts` is split per control kind (`toggle`, `guard`, `lever`, `button`) so parallel plans own separate spec files.

| Task ID | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|-------------|----------|-----------|-------------------|-------------|--------|
| 01-01-T2 | PLT-01, PNL-05 | App loads at subpath, no horizontal scroll, viewport meta | e2e | `npx playwright test e2e/smoke.spec.ts` | ❌ W0 (created in 01-01) | ⬜ pending |
| 01-01-T2 | PLT-01 | Exact pins, no unexpected install scripts | script | pin-check `node -e` command in 01-01 Task 2 | n/a | ⬜ pending |
| 01-01-T3 | (boundary) | Engine/aircraft purity lint fires | lint | `npm run lint` + boundary probe in 01-01 Task 3 | ❌ W0 | ⬜ pending |
| 01-02-T1 | CNT-03 | Policy headings, README link, repo hygiene | shell | grep/git commands in 01-02 Task 1 | ❌ (created in 01-02) | ⬜ pending |
| 01-02-T3 | CNT-03 | Owner-approved countable verbatim limit | shell | grep command in 01-02 Task 3 | ❌ | ⬜ pending |
| 01-03-T1 | PNL-01, PNL-02 | ENGINE MASTER and MFD PAGE by mouse and tap; one event per flip | e2e | `npx playwright test e2e/toggle.spec.ts` | ❌ W0 | ⬜ pending |
| 01-03-T2 | PNL-05 | Region/control geometry, hit rects don't overlap, 44 px floor | unit | `npx vitest run tests/layout.test.ts` | ❌ W0 | ⬜ pending |
| 01-08-T1 | PNL-06 | Guard interlock, blocked attempts emit no event | unit | `npx vitest run tests/store.test.ts -t guard` | ❌ W0 | ⬜ pending |
| 01-08-T2 | PNL-02 | Registry invariants | unit | `npx vitest run tests/registry.test.ts` | ❌ W0 | ⬜ pending |
| 01-08-T2 | PNL-02 | Store reaches only legal states | unit | `npx vitest run tests/store.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-T1 | PLT-01 | Actions SHA-pinned, token scope | unit | `npx vitest run tests/workflow.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-T1 | PLT-01 | Build honours `BASE_PATH`; deploy build has no test hook | unit/script | `npx vitest run tests/build-base.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-T3 | PLT-01 | Deployed Pages URL loads and operates | e2e (live) | `PW_BASE_URL=<live> npx playwright test e2e/smoke.spec.ts e2e/toggle.spec.ts` | ❌ | ⬜ pending |
| 01-05-T1 | PNL-01 | POWER lever drag-snap and detent tap (mouse, Chromium touch) | e2e | `npx playwright test e2e/lever.spec.ts` | ❌ W0 | ⬜ pending |
| 01-05-T2 | PNL-01, PNL-02 | Detent snap math, tie rule, lever inventory | unit | `npx vitest run tests/detents.test.ts` | ❌ W0 | ⬜ pending |
| 01-06-T1 | PNL-01 | MFD page softkey switches Map/Engine pages | e2e | `npx playwright test e2e/glass.spec.ts` | ❌ W0 | ⬜ pending |
| 01-06-T3 | CNT-03 | Content policy present, linked, `.input` ignored, no raw HTML | unit | `npx vitest run tests/content-policy.test.ts` | ❌ W0 | ⬜ pending |
| 01-06-T3 | PNL-05 | No horizontal scroll, regions visible, 44 px targets, rotate hint | e2e | `npx playwright test e2e/layout.spec.ts e2e/about.spec.ts` | ❌ W0 | ⬜ pending |
| 01-07-T1 | PNL-01, PNL-06 | De-ice ALTERNATE (the only guarded switch, D-07b): guard must be lifted; guard stays up | e2e | `npx playwright test e2e/guard.spec.ts` | ❌ W0 | ⬜ pending |
| 01-07-T2 | PNL-01 | Momentary buttons never stick | e2e | `npx playwright test e2e/button.spec.ts` | ❌ W0 | ⬜ pending |
| 01-07-T2 | PNL-06 | Neutral taps emit no event | e2e | `npx playwright test e2e/neutral.spec.ts` | ❌ W0 | ⬜ pending |
| 01-07-T4 | PLT-01 | Full panel live (after the Task 3 publish confirmation); all non-hook specs pass against Pages URL | e2e (live) | `PW_BASE_URL=<live> npx playwright test` | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json`, lockfile, `vite.config.ts`, tsconfig set, `eslint.config.js`, `playwright.config.ts`, `.prettierrc`
- [ ] `tests/registry.test.ts`, `store.test.ts`, `detents.test.ts`, `layout.test.ts`, `content-policy.test.ts`, `build-base.test.ts`, `workflow.test.ts`
- [ ] `e2e/smoke.spec.ts`, `layout.spec.ts`, `controls.spec.ts`, `neutral.spec.ts`
- [ ] Framework install: `npm ci` then `npx playwright install --with-deps chromium webkit`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deployed Pages URL loads | PLT-01 | Needs GitHub remote + Pages enabled | Push to main, open the Pages URL, confirm panel renders |
| Real iOS Safari + Android drag/tap/guard | PNL-01 | WebKit emulation cannot drag; not real iOS | Device checklist at end of phase |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
