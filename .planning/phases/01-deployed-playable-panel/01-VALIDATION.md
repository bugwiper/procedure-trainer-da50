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

To be filled from PLAN.md task IDs. Requirement → test mapping (from RESEARCH.md § Validation Architecture):

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| PLT-01 | Build honours `BASE_PATH` | unit/script | `npx vitest run tests/build-base.test.ts` | ❌ W0 | ⬜ pending |
| PLT-01 | Actions SHA-pinned | unit | `npx vitest run tests/workflow.test.ts` | ❌ W0 | ⬜ pending |
| PLT-01 | App loads at subpath | e2e | `npx playwright test e2e/smoke.spec.ts` | ❌ W0 | ⬜ pending |
| CNT-03 | Content policy present, `.input` ignored | unit | `npx vitest run tests/content-policy.test.ts` | ❌ W0 | ⬜ pending |
| PNL-02 | Registry invariants | unit | `npx vitest run tests/registry.test.ts` | ❌ W0 | ⬜ pending |
| PNL-02 | Store reaches only legal states | unit | `npx vitest run tests/store.test.ts` | ❌ W0 | ⬜ pending |
| PNL-06 | Guard interlock, blocked attempts emit no event | unit | `npx vitest run tests/store.test.ts -t guard` | ❌ W0 | ⬜ pending |
| PNL-01 | Detent snap math | unit | `npx vitest run tests/detents.test.ts` | ❌ W0 | ⬜ pending |
| PNL-05 | Region/control geometry, hit rects don't overlap | unit | `npx vitest run tests/layout.test.ts` | ❌ W0 | ⬜ pending |
| PNL-05 | No horizontal scroll across viewports | e2e | `npx playwright test e2e/layout.spec.ts` | ❌ W0 | ⬜ pending |
| PNL-01/06 | Toggle, guard, lever, button by mouse and tap | e2e | `npx playwright test e2e/controls.spec.ts` | ❌ W0 | ⬜ pending |
| PNL-06 | Neutral taps emit no event | e2e | `npx playwright test e2e/neutral.spec.ts` | ❌ W0 | ⬜ pending |

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
