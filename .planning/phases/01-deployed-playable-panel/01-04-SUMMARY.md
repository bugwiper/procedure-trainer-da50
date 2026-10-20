---
phase: 01-deployed-playable-panel
plan: 04
subsystem: infra
tags: [github-actions, github-pages, ci, supply-chain, playwright, vite-base-path]
requires:
  - phase: 01-01
    provides: toolchain, BASE_PATH-driven vite config, Playwright harness with PW_BASE_URL live mode
  - phase: 01-03
    provides: operable ENGINE MASTER toggle used by the live checks
provides:
  - CI and Deploy workflow (verify, e2e, deploy) with SHA-pinned actions and a read-only token
  - Dependabot config (npm and github-actions weekly, TypeScript major/minor ignored)
  - tests/workflow.test.ts supply-chain and permission gate
  - tests/build-base.test.ts host-agnostic base path and test-hook-absence gate
  - Public repository bugwiper/procedure-trainer-da50 with a green deploy
  - Live site https://bugwiper.github.io/procedure-trainer-da50/ serving the panel
affects: [01-07]
tech-stack:
  added: []
  patterns:
    - Base path derived in CI from github.event.repository.name, never written into the repo
    - Workflow security properties asserted as Vitest text tests
    - Live verification reuses the e2e specs through PW_BASE_URL (non-@hooks only)
key-files:
  created:
    - .github/workflows/deploy.yml
    - .github/dependabot.yml
    - tests/workflow.test.ts
    - tests/build-base.test.ts
  modified:
    - README.md
key-decisions:
  - "Initial publish used a one-time user-authorised force-with-lease instead of the plan's no-force rule (see Deviations)"
  - "Public repository name is procedure-trainer-da50 (without the hyphen before 50); safe because the base comes from the repository name"
patterns-established:
  - "Publishing pushes require the user's SHA-prefix confirmation; only a README-only fast-forward follow-up is covered by it"
requirements-completed: [PLT-01]
duration: not measured (spans a human checkpoint)
completed: 2026-10-20
status: complete
commits: 2
plan_head_before: e8fb1f9
plan_head_after: a53b48227708268c35dbc4b8a4a7ed527fb5e025
actuals:
  tokens: 14000
  tasks: 3
  commits: 2
---

# Phase 1 Plan 04: CI and Deploy to GitHub Pages Summary

**GitHub Actions pipeline (typecheck, lint, format, unit tests, subpath build, e2e) gating a SHA-pinned Pages deploy, live at https://bugwiper.github.io/procedure-trainer-da50/ with ENGINE MASTER operable on desktop and phone.**

Note: `commits` counts the plan's own code commits (the workflow commit and the README follow-up); the SUMMARY commit is added afterwards and is local only. The hashes quoted below are the post-rewrite hashes (author email rewritten before the first push).

## Accomplishments

- Task 1 (commit ca8ecf8): `deploy.yml` with jobs verify, e2e and deploy; every `uses:` pinned to a 40-hex SHA; top-level `contents: read`; `pages: write` and `id-token: write` only on the deploy job; `persist-credentials: false` on checkout; Pages artifact and deploy only on `refs/heads/main`; `BASE_PATH` taken from `github.event.repository.name`. `dependabot.yml` added. Two Vitest gates enforce all of this plus base-path behaviour (`/assets/` vs `/procedure-trainer-da-50/assets/`, rejection of a malformed base) and absence of the `__panel` test hook in the deployed build, with a positive control. Local rehearsal passed before the checkpoint.
- Task 2: publish manifest and hygiene gate (no PDF, nothing under `.input/` tracked or in history, `.input/` ignored) shown to the user; the user confirmed publishing.
- Task 3: orchestrator pushed main; CI and Deploy went green; live site returned 200; live Playwright run passed; README follow-up pushed fast-forward and its CI run went green.

## Publish confirmation

- **Confirmed SHA prefix:** 13adfefbe7e3 (full 13adfefbe7e3def5db4d0fbe280384da85b69e80)
- **Repository:** git@github.com:bugwiper/procedure-trainer-da50.git (public; live URL https://bugwiper.github.io/procedure-trainer-da50/)
- **Date:** 2026-10-20
- **User's words:** "publish 13adfefbe7e3 git@github.com:bugwiper/procedure-trainer-da50.git (force over 762ddc9)", then "yes"
- **Scope:** commit 13adfefbe7e3 with its history, and exactly one README-only follow-up (a53b482, pushed as a fast-forward after `git diff --name-only 13adfefbe7e3 HEAD` listed only README.md). Nothing else was pushed by this plan; this SUMMARY stays local until the orchestrator merges it.

## Verification results

- Live Playwright (`PW_BASE_URL=https://bugwiper.github.io/procedure-trainer-da50/`, smoke and toggle specs, non-@hooks): 12 passed on desktop-chromium, phone-chromium and phone-webkit.
- CI and Deploy run 39383945875 on 13adfefbe7e3: success on attempt 2.
- CI and Deploy run 39385132438 on a53b48227708268c35dbc4b8a4a7ed527fb5e025 (README follow-up): success on attempt 1.
- `origin/main` equals the local README follow-up commit a53b482 (fast-forward from 13adfef, no force).
- `npm run format:check` passes (it covers src, tests, e2e only, not README.md).

## Deviations from Plan

**1. [User-authorised exception] Force push for the initial publish**
- **Found during:** Task 3 step 2 (done by the orchestrator)
- **Issue:** The plan forbids `--force` and `--force-with-lease` and says to stop if the remote already has commits. The new GitHub repository held two stub README commits (create/delete README) at 762ddc9.
- **Fix:** The user explicitly named the override ("force over 762ddc9"). The orchestrator ran `git push --force-with-lease=main:762ddc967059a3674b47dbc966538d033e0325be origin HEAD:main`, which could only overwrite exactly that stub commit. This is a one-time exception to threat T-01-12, authorised by the user in this run. The follow-up README push used plain `git push origin HEAD:main` (fast-forward only).
- **Files modified:** none (remote state only)

**2. [Process] History author/committer email rewritten before the first push**
- **Issue:** Before publishing, the user chose to rewrite author and committer email to mueckenputzer@outlook.com. Phase 01 docs quoting old commit SHAs were repointed (13adfef is the repointing commit).
- **Impact:** All commit hashes in earlier SUMMARY files and logs refer to the rewritten history.

**3. [Environment] First CI run failed because Pages was not enabled**
- **Issue:** Run 39383945875 attempt 1 failed only in the deploy step because Pages source was not yet set to GitHub Actions. The user enabled it and the re-run (attempt 2) succeeded. This is the case the plan anticipated in Task 3 step 3, not a workflow defect.

**4. [Naming] Repository name differs from the suggested one**
- The user created `procedure-trainer-da50`. No change was needed: `BASE_PATH` comes from `github.event.repository.name`, and `deploy.yml` contains no repository name literal. The local Playwright default (`LOCAL_BASE`) still uses `/procedure-trainer-da-50/`, which is independent of the deployed name.

## Known Stubs

None.

## Threat Flags

None. The workflow, token scope, pinning and test-hook absence are covered by T-01-08 to T-01-10 and T-01-26. T-01-11 (first public push) was mitigated by the hygiene gate and SHA confirmation. T-01-12 was relaxed once by user authorisation (Deviation 1).

## Issues Encountered

- An SSH warning (`Identity file ... id_ed25519_private not accessible`) appears on git operations to origin; it is harmless, the push still succeeded.
- The unauthenticated GitHub API polling stayed well under the 60 requests per hour limit.

## Self-Check: PASSED

- FOUND: .github/workflows/deploy.yml, .github/dependabot.yml, tests/workflow.test.ts, tests/build-base.test.ts, README.md (Live site line and badge)
- FOUND commits: ca8ecf8, a53b482 (both ancestors of HEAD); a53b482 is on origin/main
