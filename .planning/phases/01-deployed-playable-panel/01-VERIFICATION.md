---
phase: 01-deployed-playable-panel
verified: 2026-10-20T11:30:00Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - ".github/workflows/deploy.yml"
  - ".planning/phases/01-deployed-playable-panel/01-01-PLAN.md"
  - ".planning/phases/01-deployed-playable-panel/01-01-SUMMARY.md"
  - ".planning/phases/01-deployed-playable-panel/01-02-PLAN.md"
  - ".planning/phases/01-deployed-playable-panel/01-02-SUMMARY.md"
  - ".planning/phases/01-deployed-playable-panel/01-03-PLAN.md"
  - ".planning/phases/01-deployed-playable-panel/01-03-SUMMARY.md"
  - ".planning/phases/01-deployed-playable-panel/01-04-PLAN.md"
  - ".planning/phases/01-deployed-playable-panel/01-04-SUMMARY.md"
  - ".planning/phases/01-deployed-playable-panel/01-05-PLAN.md"
  - ".planning/phases/01-deployed-playable-panel/01-05-SUMMARY.md"
  - ".planning/phases/01-deployed-playable-panel/01-06-PLAN.md"
  - ".planning/phases/01-deployed-playable-panel/01-06-SUMMARY.md"
  - ".planning/phases/01-deployed-playable-panel/01-07-PLAN.md"
  - ".planning/phases/01-deployed-playable-panel/01-07-SUMMARY.md"
  - ".planning/phases/01-deployed-playable-panel/01-08-PLAN.md"
  - ".planning/phases/01-deployed-playable-panel/01-08-SUMMARY.md"
  - ".planning/phases/01-deployed-playable-panel/01-09-PLAN.md"
  - ".planning/phases/01-deployed-playable-panel/01-09-SUMMARY.md"
  - "docs/CONTENT-POLICY.md"
  - "src/aircraft/da50rg/panel.ts"
  - "src/engine/detents.ts"
  - "src/engine/registry.ts"
  - "src/engine/store.ts"
  - "src/ui/panel/ControlWidget.tsx"
  - "src/ui/panel/Panel.tsx"
  - "src/ui/panel/viewport.ts"
  - "src/ui/panel/widgets/DetentLever.tsx"
  - "src/ui/panel/widgets/GuardedToggle.tsx"
  - "src/ui/panel/widgets/MomentaryButton.tsx"
  - "src/ui/panel/widgets/Toggle.tsx"
  - "src/ui/panel/zoom.ts"
  - "vite.config.ts"
covered_digest: "v3:sha256:2df2a6fda39c2669b08dc23a9a6d9474f988821acb1f23701551253e81178879"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Real iPhone, iOS Safari: open https://bugwiper.github.io/procedure-trainer-da50/ in landscape. Flip a toggle (ENGINE MASTER), lift the ALTERNATE guard then flip ALTERNATE, hold ENGINE START, tap and drag the POWER lever, drag EMERGENCY GEAR EXTENSION past its midpoint, tap a region background to zoom, pinch, pan, double-tap to zoom out."
    expected: "Every control shows its new state; lever drags snap on release without page scroll, page zoom or long-press callout; pinch and pan work on the panel; a lever drag while zoomed is never hijacked by pan; no stray control state change from background taps."
    why_human: "Playwright WebKit cannot emulate multi-touch pinch, touch pan or touch lever drags (those specs are skipped on webkit projects); only Chromium emulation covers them."
  - test: "Real Android phone, Chrome: same sequence as above, plus rotate to portrait and back."
    expected: "Same as above; portrait shows the dismissible 'Rotate to landscape' hint; rotation never changes any control state."
    why_human: "Real touch hardware and browser chrome behaviour (address-bar resize, pull-to-refresh, overscroll) cannot be reproduced by emulation."
  - test: "Real tablet (iPad Safari or Android tablet): open the live site, operate one control of each kind by touch, zoom into a region and out."
    expected: "Whole panel fits with no horizontal scroll; every control kind works by touch; region zoom brings controls to a comfortable tap size."
    why_human: "Tablet touch behaviour and real screen sizes."
  - test: "Smallest landscape phone, zoomed into the tiny under-panel regions (UNDER PANEL L/C/R)."
    expected: "Controls can be operated without accidentally triggering the background zoom/pan gesture; adequate background clearance remains."
    why_human: "Plan 01-07 SUMMARY flags very little background clearance there; geometry tests pass but ergonomics need a hand check."
  - test: "Portrait phone: pinch the panel down to a 200-unit-wide view and operate small controls."
    expected: "Every control reaches at least 44 px via pinch (region tap alone stays below 44 px for the widest regions on portrait by design, D-02/D-21)."
    why_human: "Roadmap SC6 says 'on a phone ... at full tap size'; portrait region-tap is a documented exception relying on pinch plus rotate hint. Owner should confirm this reading is acceptable."
  - test: "Compare the panel against the real DA50 RG (or the private .input photos): control positions and grouping, incl. under-panel and pedestal."
    expected: "Relative placement matches the aircraft (PNL-08). Specifically confirm the de-ice ALTERNATE label, position and states against the FIKI/de-ice supplement (open item D-07b)."
    why_human: "Layout fidelity is checked in code against a reference table derived by the author from private photos; correctness of that table versus the aircraft is a human domain judgement. The reference photos are not in the repo."
  - test: "Judgment-tier prohibitions (non-authoritative LLM verdict recorded as: no violation found; flagged for human review): (1) no state conveyed by colour alone, (2) no non-existent control such as a propeller/mixture lever or ground-idle gate, (3) nothing implying approval by Diamond/Garmin or substitution for the AFM."
    expected: "Visual inspection of the live panel confirms each: every state change also moves the graphic and changes the state text; pedestal shows only POWER 0-100 % and COWL FLAP; footer notice 'Training aid only, not the AFM' is visible on every screen."
    why_human: "ADR-550 D4: judgment-tier prohibitions are soft-gated and never silently passed."
---

# Phase 1: Deployed Playable Panel - Verification Report

**Phase Goal:** Users can open the deployed site on desktop, tablet or phone and operate a DA50 RG panel (switches, guarded switches, levers, buttons) by mouse or touch.
**Verified:** 2026-10-20
**Status:** human_needed
**Re-verification:** No, initial verification
**Verified HEAD:** local 08353d8 (docs-only commit ahead of origin/main c973830; CI on c973830 is green and is the deployed commit)

All automated evidence supports goal achievement. No gaps found. Only real-device and domain-fidelity checks remain, which cannot be done programmatically.

## Goal Achievement

### ROADMAP Success Criteria (the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Push to main deploys via GitHub Actions to a public Pages URL at its subpath; build base comes from the environment | VERIFIED | `.github/workflows/deploy.yml` has verify, e2e and deploy jobs (deploy `needs: [verify, e2e]`, `if: main`), build step sets `BASE_PATH: "/${{ github.event.repository.name }}/"`. `vite.config.ts` `resolveBase()` reads only `BASE_PATH`, default `/`, rejects values not starting and ending with `/`. GitHub API: runs on c973830, a53b482, 65c150b all `completed/success`. Live URL `https://bugwiper.github.io/procedure-trainer-da50/` returns 200; its HTML references `/procedure-trainer-da50/assets/index-*.js/.css` (both 200). `tests/build-base.test.ts` and `tests/workflow.test.ts` pass. |
| 2 | Whole panel scaled to fit on desktop, tablet, phone with no horizontal scroll; regions exist as data | VERIFIED (real devices pending) | `REGIONS` (13 entries) in `src/aircraft/da50rg/panel.ts`; `Panel.tsx` iterates `registry.regions` and `region.controlIds`. `e2e/layout.spec.ts` "no horizontal scroll and the whole panel is visible" passes on all six projects (desktop chromium/webkit, phone landscape chromium/webkit, tablet webkit, phone portrait). Viewport meta present in live HTML. |
| 3 | Flip switches, lift guard, step levers, press buttons by mouse or touch; state visible; registry ids; only legal states | VERIFIED (real iOS/Android pending) | Four widgets exist and are wired through `ControlWidget.tsx` (toggle, guarded-toggle, detent-lever, momentary-button; `guard` drawn by GuardedToggle; exhaustive `never` check). 23 registry controls. Store (`src/engine/store.ts`) dispatch rejects unknown, illegal-state, blocked (guard closed) and unchanged values without logging. e2e: toggle, guard, lever, button specs pass on all projects (touch-hold and WebKit touch drags skipped by design, see human items). Live suite run: 159 passed, 51 skipped by project conditions. |
| 4 | Safety controls guarded/confirm-to-actuate; neutral taps change nothing and emit no event | VERIFIED | Only guarded switch is de-ice ALTERNATE (`deice.ts`, only `guarded-toggle` in controls). `lv.emerg_gear` is `dragOnly` (no marker targets, red PULL handle). `Panel.tsx` carries no pointer handlers; only widget hit rects do (grep: handlers only in widgets and App buttons). `e2e/neutral.spec.ts` (@hooks) asserts zero events after taps on background, frames, artwork, gaps, footer on every project; passes. SUMMARY reports a regression probe that proved the test can fail. |
| 5 | Written content policy in repo before any procedure text | VERIFIED | `docs/CONTENT-POLICY.md` (8 sections: 12-word verbatim limit counted in whitespace tokens, never-commit list, mandatory source metadata, repo visibility, legal status) linked from README; also rendered in-app via About (`?raw` import). `git ls-files` shows no PDF and nothing under `.input/`; `git log --all` shows none ever; `.input/` in `.gitignore`. `tests/content-policy.test.ts` passes. No procedure text exists anywhere in the repo yet. |
| 6 | Layout matches real DA50 RG; phone region zoom to full tap size without layout change | VERIFIED in code (fidelity vs aircraft and phone ergonomics pending human) | `tests/layout.test.ts` (reference ordering + true-proportion table within 3 units, no overlap, PFD/MFD both 495x367) passes. Zoom changes only the root `viewBox` (`zoom.ts`/`viewport.ts`); `zoom.ts` imports no bridge and calls no actuate. `tests/zoom.test.ts` asserts per-region 44 px guarantee on the 734x343 landscape phone profile. `e2e/zoom.spec.ts` passes: region tap/click zoom, Full panel, double tap out, pinch/pan (Chromium touch), lever drag not hijacked, zoom emits no events. |

**Score:** 6/6 roadmap criteria verified by automated evidence; 0 behavior-unverified truths (cancel/ordering invariants such as "drag back to start appends no event", "ENGINE START returns to RELEASED on cancel", "zoom emits no events" have passing named e2e tests).

### Plan must-haves (selected high-risk items, spot-checked in code and tests)

| Plan | Truth | Status | Evidence |
|------|-------|--------|----------|
| 01-01 | Base path only from BASE_PATH; refuses malformed | VERIFIED | `vite.config.ts` lines 5-12; `tests/build-base.test.ts` |
| 01-01 | Exact-pinned dependencies | VERIFIED | `package.json`: all 15 direct deps are exact versions (no `^`/`~`) |
| 01-01 | engine/aircraft purity lint | VERIFIED | `eslint.config.js` `no-restricted-imports`; `npm run lint` clean; `store.ts` takes `t` from caller, no clock |
| 01-02 | Verbatim limit decided by owner, countable | VERIFIED | Policy section 2: 12 words, "Decided by the project owner on 2026-10-20 (option-a)" |
| 01-03 | Event log: one event per accepted flip, none for rejects | VERIFIED | `store.ts` dispatch; `tests/store.test.ts` |
| 01-04 | Actions pinned by 40-char SHA, read-only token, no persisted creds, no test hook in prod | VERIFIED | `deploy.yml` (SHA pins, `permissions: contents: read`, `persist-credentials: false`, `pages/id-token: write` on deploy only); live bundle contains no `__panel` (grep count 0) while containing ALTERNATE STATIC, EMERGENCY GEAR, ENGINE START, FADEC TEST, Full panel |
| 01-05 | Drag below 4 px / cancel / unchanged detent appends nothing; in-progress drag never stored | VERIFIED | `DetentLever.tsx` (`MIN_DRAG_PX`, drag position in local signal, `bridge.actuate` only on release/marker tap); `e2e/lever.spec.ts` @hooks |
| 01-05 | No propeller/mixture lever or ground-idle gate | VERIFIED | `pedestal.ts` header comment and controls: POWER (0-100 %, 5 % steps) and COWL FLAP only |
| 01-06 | B612 self-hosted, no third-party requests | VERIFIED | `main.tsx` imports `@fontsource/b612*`; grep of `src` and `index.html` finds no external http(s) URL; `e2e/glass.spec.ts` font test passes |
| 01-06 | Portrait rotate hint only on portrait phone | VERIFIED | `layout.spec.ts` "rotate hint shows on a portrait phone only" passes |
| 01-07 | Guard lifts on first tap, switch moves on second, guard stays up | VERIFIED | `GuardedToggle.tsx` (switch hit rect rendered only when guard open; store interlock as defence in depth); `guard.spec.ts` passes |
| 01-07 | 23 controls, no skipped PNL-08 relation | VERIFIED | 23 control ids in `src/aircraft`; `layout.test.ts` 79 tests, 0 skipped per SUMMARY; full unit run 185 passed |
| 01-08 | Registry/store invariants test-first | VERIFIED | `tests/registry.test.ts`, `tests/store.test.ts` (guard interlock block) pass |
| 01-09 | Zoom arbitration: control pointers own their gesture; no pan/pinch during control drag | VERIFIED | `zoom.ts` `onDown`: `TAP_TARGET_SELECTOR`, `controlPointers` set, ignore new background pointers while a control pointer is active; e2e "a lever drag while zoomed is never hijacked" passes |
| 01-07 | Public URL serves complete panel; non-hook specs pass against it | VERIFIED | Re-ran `PW_BASE_URL=https://bugwiper.github.io/procedure-trainer-da50/ npx playwright test`: 159 passed, 51 skipped, 0 failed |
| 01-07 | Real devices (iPhone, Android, tablet) operate all control kinds | UNCERTAIN | Cannot be verified here; routed to human_verification |

### Behavioral spot-checks and gates run in this verification

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Type-check | `npm run typecheck` | clean | PASS |
| Lint | `npm run lint` | clean | PASS |
| Format | `npm run format:check` | all files formatted | PASS |
| Unit tests | `npm test` | 9 files, 185 tests passed | PASS |
| E2E (local e2e build at subpath, 6 device projects) | `npm run e2e` | 199 passed, 59 skipped (documented project conditions), 0 failed | PASS |
| E2E against live site (no @hooks) | `PW_BASE_URL=... npx playwright test` | 159 passed, 51 skipped, 0 failed | PASS |
| Live HTTP | curl index and JS bundle | 200, 200 | PASS |
| Hook absent from production bundle | grep `__panel` in live JS | 0 matches | PASS |
| CI on deployed commit | GitHub Actions API | c973830 `completed/success` | PASS |
| Private-file hygiene | `git ls-files`, `git log --all --name-only` | no PDF, no `.input/` ever tracked | PASS |

Skipped e2e cases are explicit `test.skip` with reasons: touch hold cannot be held in Playwright, WebKit cannot emulate touch drags/pinch (Chromium-only specs), desktop-only mouse paths, and phone-portrait region zoom (covered by pinch + rotate hint). They are reflected in the human verification list.

### Requirements Coverage

All eight phase IDs appear in PLAN frontmatter and are accounted for.

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| PLT-01 | 01-01, 01-04, 01-07 | SATISFIED | deploy.yml, BASE_PATH-only base, live site, green CI |
| CNT-03 | 01-02, 01-06 | SATISFIED | docs/CONTENT-POLICY.md, README link, in-app About, hygiene test |
| PNL-01 | 01-03, 01-05, 01-06, 01-07 | SATISFIED (touch on real devices pending) | four widget kinds, e2e on all projects |
| PNL-02 | 01-03, 01-05, 01-08 | SATISFIED | `defineRegistry`, id pattern, kind prefixes, legal states, 185 unit tests |
| PNL-05 | 01-01, 01-03, 01-06, 01-09 | SATISFIED | regions as data, no horizontal scroll on six projects |
| PNL-06 | 01-03, 01-05, 01-07, 01-08, 01-09 | SATISFIED | guard interlock, drag-only emergency gear, neutral-area spec, zoom emits no events |
| PNL-08 | 01-03, 01-05, 01-07 | SATISFIED in code; fidelity versus aircraft pending human | layout.test.ts reference table |
| PNL-09 | 01-09 | SATISFIED on landscape; portrait via pinch (human confirm) | viewport/zoom modules, zoom unit + e2e |

No orphaned requirements: REQUIREMENTS.md maps exactly PLT-01, CNT-03, PNL-01, PNL-02, PNL-05, PNL-06, PNL-08, PNL-09 to Phase 1, and all are claimed by at least one plan.

Housekeeping (not a gap): REQUIREMENTS.md traceability still shows these as `Pending` / unchecked, and ROADMAP shows Phase 1 "In Progress" and plan checkboxes; the orchestrator should update them on phase completion.

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers in `src`, `tests`, `e2e`, `docs`, `README.md` or `.github`. Empty-state grep hits are widget-local signals, overwritten by pointer events. PFD/MFD gauge values are static by decision D-11 (live data is PNL-04, Phase 3), not a Phase 1 stub.

### Prohibitions (ADR-550)

| Prohibition | Tier | Result |
|-------------|------|--------|
| No AFM beyond limit, page images, `.input/`, logos, traced artwork committed | test | Enforced by `tests/content-policy.test.ts` (passes) and git history scan (clean) |
| No relocation/enlargement of controls for touch size | test | Enforced by `tests/layout.test.ts` reference table (passes) |
| No control event for neutral tap, blocked request, unchanged value or in-progress drag | test | Enforced by `neutral.spec.ts`, `lever.spec.ts`, `store.test.ts` (pass) |
| No state by colour alone | judgment | NON-AUTHORITATIVE: no violation found (widgets move graphic and show `data-state-text`). Flagged for human review (unverified-prohibition) |
| No non-existent control (prop/mixture lever, ground-idle gate) | judgment | NON-AUTHORITATIVE: no violation found in `pedestal.ts`. Flagged for human review |
| No implication of approval/certification; footer notice visible | judgment | NON-AUTHORITATIVE: notice present in App footer and About; policy states non-affiliation. Flagged for human review |

### Human Verification Required

See the `human_verification` frontmatter list. Summary:

1. Real iPhone (iOS Safari): all control kinds, lever drags, pinch and pan, no page scroll or callouts.
2. Real Android (Chrome): same plus rotation.
3. Real tablet: touch operation and region zoom.
4. Smallest landscape phone, under-panel regions: ergonomics and background clearance.
5. Portrait phone: confirm pinch-to-44 px satisfies SC6 (region tap alone does not on portrait).
6. Fidelity of layout versus the aircraft, and ALTERNATE de-ice label/states (open item D-07b).
7. Judgment-tier prohibitions: visual confirmation.

### Gaps Summary

No gaps. The phase goal is met in the codebase and on the live site: deployed through Actions at the subpath, registry-driven panel with all four control kinds, guard interlock, neutral-area guarantee, region zoom, and the content policy committed before any procedure text. Remaining items are device-level and domain-fidelity checks that automated tooling cannot decide.

---

_Verified: 2026-10-20_
_Verifier: Claude (gsd-verifier)_
