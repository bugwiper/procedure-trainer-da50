# Workflow (lightweight, from 2026-10-23)

GSD is used at phase level only. Removed plans, research and discussion logs of earlier phases are in git history.

## Phase plan or direct fix

- **Phase plan:** a new capability, changes across several files, new scenario content, anything the roadmap lists as a phase. Steps: short spec, about three larger plans, execute (one SUMMARY per plan), UAT with the owner at the end, one code review per phase. No plan-checker.
- **Direct fix:** small fixes, tuning, doc corrections, review findings. One Conventional Commit plus a targeted test. No PLAN, no SUMMARY.
- A direct fix that grows past a few files becomes a todo or a plan.

## Where things live

- `ROADMAP.md` phases and goals; `REQUIREMENTS.md` requirement ids; `STATE.md` current position; `PROJECT.md` scope and key decisions.
- Open work and deferred ideas: `.planning/todos/pending/` (move to `done/` when closed).
- Decisions: owner decisions stay where they were made (phase CONTEXT or UI-SPEC, ids cited from `docs/`); new ones go into the phase spec or the todo, and into `docs/GRADING.md`, `docs/PANEL-LABELS.md` or `docs/PANEL-REVIEW.md` when they change the product.
- Stack rationale: `research/STACK.md`; pitfalls that still apply: `research/NOTES.md`.

## Commits and publishing

- Conventional Commits. Plan work uses the plan id as scope (`feat(03-04): ...`), review fixes `fix(panel): ...`, phase closing `docs(03): ...`, cleanups `docs(cleanup): ...`.
- Phase branches `gsd/phase-NN-slug`.
- Agents never push. Publishing is the owner's step, after an explicit yes.

## Private material

- Reference photos and the AFM live in `.input/` (private, git-ignored). Never commit them, never quote AFM text beyond `docs/CONTENT-POLICY.md`; documents describe layout facts and name photos by short name.

## Saving tokens

- Run targeted tests (`npx vitest run tests/<file>`) for a small fix; the whole suite and e2e only at plan or phase end. No full e2e for a small fix.
- Do not read whole large files (`docs/PANEL-REVIEW.md` is about 150 KB): grep, then read the range.
- Delegate long reads, full test runs and e2e runs to a subagent and take back only the result.
- Keep `.claude/CLAUDE.md` lean; put detail into `docs/` or `.planning/`, not into the always-loaded file.
- Do not duplicate: one SUMMARY per plan, no restating of code in documents.

## Lessons from phases 3 to 5 (keep)

- **Clear the Vitest cache before the final run:** `rm -rf node_modules/.vitest-cache`. A stale transform cache hid new scenario files and made a failing test look green; CI (fresh clone) then failed.
- **CI runs everything:** all Playwright projects (desktop, phone, tablet in chromium and webkit, plus phone-portrait). Geometry gates are font- and size-sensitive; for layout changes run static-text, art-fit, layout, zoom and session-area on all of them, and allow font slack (macOS against the Linux runner differ by under a unit).
- **WebKit remembers a failed dynamic import:** the "pack that cannot be loaded" retry case is skipped on WebKit (see the hardening todo).
- **Never run blanket git reverts** (`git checkout -- .`, `git restore .`, `git reset --hard`, `git clean`): an agent once wiped the owner's uncommitted tool state. Commit by explicit path.
- **Delegate runs to subagents, verify yourself:** after every agent report run the whole vitest with a cleared cache and `git log`; agents report green when a stale cache hides a failure.
- **Limits:** the owner's rule is to pause at 98 percent of the 5-hour limit (and the weekly limit); check `get_usage` before dispatching a plan (a plan costs about 10 to 30 percent of the 5-hour window); wake up after the reset with a scheduled wakeup. The owner may also just nudge.
- **Publishing:** only the owner pushes `main` (CI deploys it); ask before any push, push a fast-forward with `git push origin 'HEAD:refs/heads/main'`, quote the refspec (zsh).
- **Where things are:** roadmap and phases `.planning/ROADMAP.md`, state `.planning/STATE.md`, open ideas `.planning/todos/pending/`, owner review lists `docs/PANEL-REVIEW.md`, grading and authoring notes `docs/GRADING.md`, private photos and AFM `.input/`.
