# Phase 1: Deployed Playable Panel - Research

**Researched:** 2026-10-19
**Domain:** Static TypeScript/Vite/Preact SPA with an interactive SVG instrument panel (pointer/touch input), deployed to GitHub Pages via Actions; content-policy documentation
**Confidence:** HIGH for toolchain, deploy and input-handling findings (probed this session); MEDIUM for iOS Safari behaviour (not testable here, needs real-device UAT); MEDIUM for panel layout numbers (discretionary)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Panel layout & regions**
- **D-01:** One single fixed landscape "instrument panel" coordinate space (one root SVG viewBox, scaled to fit). No tabbed/stacked regions.
- **D-02:** Phone portrait: fit whole panel to width and show a non-blocking "rotate to landscape" hint. Region zoom/pan is v2 (PNL-V2-01); use large invisible hit targets so small controls stay operable.
- **D-03:** Region data model = `{ id, name, bounds (viewBox rect), controlIds[] }`; renderer iterates regions. Enough for later region zoom without a rewrite.
- **D-04:** Regions present in Phase 1: PFD (static placeholder), Engine page/MFD (frame), Switch bank, Pedestal/quadrant.
- **D-04a:** The MFD region has two static pages: Map with a small engine-gauge strip on the left, and the full Engine page. A registry control (MFD page button/softkey) toggles between them; the page is panel state (gradable later). Live gauge values still come in Phase 3.
- **D-04b:** Reference photos of the real aircraft are in `.input/` (git-ignored, private). Use them only as visual reference for layout, gauge set/order/colour bands and annunciation wording; redraw as original functional SVG, never embed or trace them (Garmin/Diamond IP, public repo).

**Control set & interaction**
- **D-05:** Detented levers (throttle, prop, cowl flap) are operated by pointer-drag along a track with snap to nearest detent on release, using Pointer Events + setPointerCapture; tapping a detent marker jumps to it.
- **D-06:** Guarded switch: the guard is a separate control with its own state. Tap guard to lift, then tap the switch. Guard stays up until tapped again (no auto-close). Switch cannot actuate while guard is closed.
- **D-07:** Phase 1 ships only a small demonstrative set of guarded/confirm-to-actuate controls; the real safety-control set is scoped by Phase 2/3 scenarios.
- **D-08:** Registry uses typed control kinds: toggle, guarded-toggle, detent-lever, momentary-button. Each entry has id, kind, label, region, position, legal states, default. Renderer picks widget by kind; controls can only reach their defined legal states.
- **D-09:** Control state lives in the aircraft/panel state model, not the DOM. Taps on neutral areas produce no control event.

**Visual style & fidelity**
- **D-10:** Flat/schematic dark-cockpit look: dark panel, simple vector shapes, clear placard-style ALL CAPS labels.
- **D-11:** Gauges and glass areas are static frames with plausible idle values in Phase 1; live state binding arrives in Phase 3 (PNL-04).
- **D-12:** Font: B612 / B612 Mono, self-hosted via @fontsource; import only weights used.
- **D-13:** State feedback = lever/switch position change + colour/lit indicator + small state text (e.g. ON/OFF) so it reads on small screens and for colour-blind users.

**Content policy (CNT-03)**
- **D-14:** Repo stays public in v1; policy states paid content will move to a private source before any paid pack (BUS-V2-01).
- **D-15:** Short verbatim AFM checklist step lines are allowed; narrative/explanatory text must be paraphrased. Each scenario carries AFM source and revision. Compliance remains the content author's responsibility.
- **D-16:** Policy lives in `docs/CONTENT-POLICY.md`, linked from README/authoring guide, and surfaced via a link in the app footer/About together with the "training aid, not AFM" notice.

### Claude's Discretion
- Exact panel coordinates, widget art details, hit-target sizing, concrete switch/lever inventory beyond the demo set, and tooling layout of the registry file.

### Deferred Ideas (OUT OF SCOPE)
- Phone region zoom/pan (already PNL-V2-01).
- Live gauge binding (Phase 3).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLT-01 | GitHub Actions deploys to GitHub Pages; build is host-agnostic (base path from environment) | Verified Pages workflow with SHA-pinned actions (setup-node SHA corrected, see Standard Stack); `BASE_PATH` env in `vite.config.ts`; verified build output rewrites asset URLs; subpath e2e smoke; human steps (create public repo, Pages source = Actions) |
| CNT-03 | Content policy for AFM-derived text decided before any procedure text is committed | Policy outline in "Content Policy Doc Contents"; repo-hygiene test (no tracked PDFs / `.input/`); in-app About screen renders the policy via `?raw` |
| PNL-01 | Operate switches, guarded switches, detented levers and buttons by mouse or touch | Pointer Events model per control kind; probe-verified touch-action finding; WebKit/Chromium test limits |
| PNL-02 | Panel generated from a control registry; stable id and legal states | Registry types + `defineRegistry` invariants + reducer; unit-test list |
| PNL-05 | Scales to desktop/tablet/phone without horizontal scroll; regions are data | viewBox + `100dvh` shell, region data model with region-local coordinates, no-horizontal-scroll e2e at multiple viewports |
| PNL-06 | Safety-consequence controls guarded/confirm; neutral taps never graded | Guard interlock in reducer (defence in depth), no handlers on background, event-log-unchanged e2e test |
</phase_requirements>

## Summary

Phase 1 is a greenfield walking skeleton: scaffold the pinned stack (Vite 8.3.4, Preact 11.0.1, @preact/signals 2.11.3, TS 6.0.3, Vitest 5.0.5, Playwright 1.64.1), get a trivial page deployed to GitHub Pages first, then grow it into a registry-generated, pointer-operable SVG panel. All pinned versions in `.claude/CLAUDE.md` were re-confirmed against the npm registry today, and a scratch project (outside the repo) proved that the stack builds, type-checks, lints (including an ESLint boundary that bans DOM/Preact in `src/engine`), unit-tests, and rewrites asset URLs for a base path supplied by the `BASE_PATH` environment variable.

Three findings change how the planner should write tasks. (1) `touch-action` set on an SVG **child** element is ignored: in a Chromium touch-drag probe the drag was cancelled with `pointercancel` unless `touch-action: none` was on the root `<svg>` (or an HTML ancestor). (2) Playwright's WebKit "iPhone" emulation delivers taps (as pointer events of type `touch`) only if the page has `<meta name="viewport" content="width=device-width, initial-scale=1">`, and WebKit cannot emulate touch drags at all, so drag verification on iOS must be a manual real-device check. (3) The AFM (private, in `.input/`) shows the DA50 RG has a **single POWER lever** (ground idle / flight idle detent / max) and no separate propeller lever, which conflicts with the "throttle, prop, cowl flap" wording in the roadmap success criterion; this needs a user decision (Open Question 1).

**Primary recommendation:** Slice the phase as a walking skeleton: (a) scaffold + CI + deployed hello page + subpath smoke test first; (b) pure `src/engine` registry/store/reducer with unit tests; (c) data-driven panel renderer with one widget per kind and a root-SVG `touch-action: none` input model; (d) e2e + real-device UAT; with the content policy document landing in the first wave (it is independent).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Control registry, legal states, interlocks, event emission | Browser (pure TS `src/engine`) | — | Framework/DOM-free so Phase 2 grading and Vitest can reuse it unchanged (D-09) |
| Panel state store (`id -> state`) | Browser (pure TS) | UI bridge (signals) | State is not DOM; UI mirrors it into signals |
| SVG rendering, widgets, scaling | Browser (Preact + SVG) | — | Static site, no server tier |
| Pointer/touch input, drag math, hit targets | Browser (UI layer) | — | Only UI knows screen geometry; it emits `set` intents only |
| Region/layout data | Browser (`src/aircraft/da50rg` data module) | — | Data, not logic; consumed by renderer and layout tests |
| Hosting + base path | CDN / Static (GitHub Pages) | CI (build env supplies `BASE_PATH`) | Pages serves a subpath; build stays host-agnostic |
| Build/test/deploy | CI (GitHub Actions) | — | Verify then deploy; Pages artifact |
| Content policy / disclaimer | Docs (repo) | Browser (About screen via `?raw`) | Must exist in repo; in-app copy avoids host-dependent links |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vite | 8.3.4 | Dev server, bundler | Pinned by CLAUDE.md; npm confirms 8.3.4 [VERIFIED: npm registry, `npm view vite version`] |
| preact | 11.0.1 | UI/SVG rendering | Pinned; npm confirms [VERIFIED: npm registry] |
| @preact/signals | 2.11.3 | Per-control reactive state in UI | Pinned; npm confirms [VERIFIED: npm registry] |
| @preact/preset-vite | 2.10.6 | JSX + HMR | Built successfully with Vite 8 in scratch probe [VERIFIED: scratch probe this session] |
| typescript | ~6.0.3 (6.0.3 installed in probe) | Type-check | `npm view typescript` latest is 7.0.2, so `typescript` must be pinned explicitly to `~6.0.3` (typescript-eslint 8.71.2 peer `<6.1.0`) [VERIFIED: npm registry + CLAUDE.md] |
| @fontsource/b612, @fontsource/b612-mono | 5.3.0 (OFL-1.1) | Self-hosted fonts | License field confirmed OFL-1.1; latin subset files exist for weights 400 and 700 [VERIFIED: node_modules/@fontsource/b612/package.json + files listing] |

### Supporting (dev)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 5.0.5 | Unit tests (engine, registry, layout geometry, repo hygiene) | Import `defineConfig` from `vitest/config` (probe passed) |
| @playwright/test | 1.64.1 | E2E, mobile/touch projects, subpath smoke | Chromium + WebKit installed fine on this Mac (webkit v2370) |
| eslint 10.13.0, @eslint/js 10.0.1, typescript-eslint 8.71.2 | as listed | Lint + `src/engine` boundary | Flat config, `projectService: true` works with solution-style tsconfig (probe) |
| prettier | 3.9.10 | Formatting | |
| happy-dom | 21.0.3 | Only if a DOM unit test is unavoidable | Prefer pure-geometry tests in `node` env |
| @types/node | 24.x (24.19.2 current) | Types for `process` in `vite.config.ts`, `playwright.config.ts`, hygiene tests | **Required**: with TS 6 `types` defaults to none; probe failed with `TS2591: Cannot find name 'process'` until node types are added (scope them to the node tsconfig only) [VERIFIED: scratch probe] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `process.env.BASE_PATH` in vite.config | `loadEnv(mode, '.', '')` | Avoids @types/node in the config only, but node types are needed for tests/Playwright anyway; use `process.env` |
| `?raw` markdown rendered as text for About | markdown renderer lib | Extra dependency and an XSS surface for no Phase 1 benefit; render as text |
| Link to GitHub blob URL for the policy | in-app About with `?raw` | Blob URL ties the build to one host; `?raw` keeps it host-agnostic (D-16 still satisfied) |

**Installation:**
```bash
# Scaffold manually (do not use `npm create vite`)
npm init -y   # then set "type": "module", scripts, engines.node ">=22.12"
npm i preact@11.0.1 @preact/signals@2.11.3 @fontsource/b612@5.3.0 @fontsource/b612-mono@5.3.0
npm i -D vite@8.3.4 @preact/preset-vite@2.10.6 typescript@~6.0.3 vitest@5.0.5 \
  @playwright/test@1.64.1 eslint@10.13.0 typescript-eslint@8.71.2 @eslint/js@10.0.1 \
  prettier@3.9.10 @types/node@24
npx playwright install --with-deps chromium webkit   # CI; locally omit --with-deps
```
Commit `package-lock.json` (CI uses `npm ci`). npm 11.20 prints an `install-scripts` gate notice; in the probe the only package with an install script was optional `fsevents` (macOS), so nothing needs approving [VERIFIED: scratch probe, `npm install-scripts ls`].

**Version verification:** all versions above were re-queried with `npm view` on 2026-10-19 and match CLAUDE.md; `typescript` dist-tag latest = 7.0.2 (do NOT take it), `typescript@6` resolves to 6.0.3.

## Package Legitimacy Audit

Run with `gsd-tools query package-legitimacy check --ecosystem npm ...` on 2026-10-19.

| Package | Registry | Latest published | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|------------------|--------------|-------------|---------|-------------|
| vite | npm | 2026-10-08 | ~118.8M | github.com/vitejs/vite | SUS (`too-new`) | Approved with consolidated checkpoint |
| preact | npm | 2026-10-08 | ~23.1M | github.com/preactjs/preact | SUS (`too-new`) | Approved with consolidated checkpoint |
| @preact/signals | npm | 2026-09-30 | ~1.6M | github.com/preactjs/signals | SUS (`too-new`) | Approved with consolidated checkpoint |
| @preact/preset-vite | npm | 2026-07-18 | ~453K | github.com/preactjs/preset-vite | OK | Approved |
| typescript | npm | 2026-07-08 | ~184M | github.com/microsoft/TypeScript | OK | Approved |
| vitest | npm | 2026-10-15 | ~76.6M | (vitest-dev) | SUS (`too-new`) | Approved with consolidated checkpoint |
| @playwright/test | npm | 2026-10-14 | ~46.0M | (microsoft/playwright) | SUS (`too-new`) | Approved with consolidated checkpoint |
| eslint | npm | 2026-10-16 | ~95.3M | (eslint/eslint) | SUS (`too-new`) | Approved with consolidated checkpoint |
| typescript-eslint | npm | 2026-10-12 | ~55.4M | (typescript-eslint) | SUS (`too-new`) | Approved with consolidated checkpoint |
| @eslint/js | npm | 2026-02-06 | ~83.5M | eslint | OK | Approved |
| prettier | npm | 2026-10-10 | ~82.3M | (prettier/prettier) | SUS (`too-new`) | Approved with consolidated checkpoint |
| happy-dom | npm | 2026-10-15 | ~12.8M | (capricorn86/happy-dom) | SUS (`too-new`) | Optional; approved with checkpoint |
| @types/node | npm | 2026-10-09 | ~276M | DefinitelyTyped | SUS (`too-new`) | Approved with consolidated checkpoint |
| zod | npm | 2026-10-12 | ~213M | colinhacks/zod | SUS (`too-new`) | **Not needed in Phase 1** (schema work is Phase 2) |
| yaml | npm | 2026-09-11 | ~142M | eemeli/yaml | OK | **Not needed in Phase 1** |
| @fontsource/b612, /b612-mono | npm | 2026-07-19 | ~5K / ~6.5K | fontsource | OK | Approved (low downloads is normal for a font package; OFL-1.1 confirmed) |

**Packages removed due to SLOP:** none.
**Packages flagged SUS:** vite, preact, @preact/signals, vitest, @playwright/test, eslint, typescript-eslint, prettier, happy-dom, @types/node. Every `SUS` here carries exactly one reason, `too-new` (latest version published within the last few weeks), while the packages have 12M-276M weekly downloads and long-standing source repos; no postinstall scripts (`postinstall: null` in all signals; the `@fontsource` packages also have no postinstall). This is the heuristic firing on routine recent releases, not a hallucination signal. **Planner: add ONE consolidated `checkpoint:human-verify` before the first `npm install` (user reviews the pinned dependency list in the plan and the resulting `package-lock.json` diff) rather than one checkpoint per package.** Pin exact versions as listed (no `^`) so a freshly published release cannot slip in.
Postinstall check: `npm view @fontsource/b612 scripts.postinstall` and `npm view vite scripts.postinstall` returned empty [VERIFIED: npm registry].

## Architecture Patterns

### System Architecture Diagram

```
 Pointer/touch on SVG widget (root <svg> has touch-action:none)
        |
        v
 Widget handler (UI)  --- transient drag position stays UI-local (signal, never logged)
        |  intent: set(controlId, stateId)   [only widgets emit; background has NO handler]
        v
 PanelStore.dispatch()  (src/engine, pure TS)
   1. lookup ControlDef in Registry  --unknown id--> reject
   2. stateId in def.states?         --no--> reject
   3. interlock check (guard closed?)--blocked--> reject (UI-only "blocked" feedback, NO ControlEvent)
   4. value unchanged?               --yes--> no-op (NO ControlEvent)
   5. apply -> state map; append ControlEvent {seq, t, id, value, source:'user'}
        |
        +--> subscribers --> UI bridge: per-control signals --> widgets re-render (position, colour, label text)
        +--> EventLog (array; Phase 2 grader reads it)

 Build/deploy:  git push main -> Actions: npm ci -> typecheck -> lint -> vitest -> vite build (BASE_PATH env)
                -> (separate job) playwright vs `vite preview` at subpath -> upload-pages-artifact -> deploy-pages

 Layout data:  regions[] {id,name,bounds,controlIds}  +  controls[] {region, local x/y}
                       |
                       v  renderer iterates regions: <g transform=translate(bounds.x,bounds.y)> controls </g>
```

### Recommended Project Structure
```
.github/
  workflows/deploy.yml            # verify -> e2e -> deploy
  dependabot.yml                  # ignore typescript major+minor
docs/CONTENT-POLICY.md
README.md                         # links policy, dev commands
index.html                        # includes <meta viewport>
public/.nojekyll                  # harmless belt-and-braces
src/
  engine/                         # PURE TS: no preact, no DOM globals (ESLint-enforced)
    registry.ts                   # ControlDef union, defineRegistry(), validation
    store.ts                      # PanelStore: state map, dispatch, subscribe, event log
    detents.ts                    # snapToDetent, projectToTrack (pure geometry)
    types.ts
  aircraft/da50rg/                # DATA (ESLint-bounded like engine)
    controls.ts                   # control definitions (demo set)
    regions.ts                    # region definitions
    layout.ts                     # VIEWBOX, per-control local positions if kept separate
  ui/
    App.tsx, stage.css            # shell: svg + footer + rotate hint
    panel/Panel.tsx               # iterates regions
    panel/widgets/{Toggle,GuardedToggle,DetentLever,MomentaryButton}.tsx
    panel/frames/{PfdFrame,MfdFrame,ArcGauge,BarGauge}.tsx
    bridge.ts                     # store -> signals
    about/About.tsx               # notice + policy text via ?raw
  main.tsx
tests/                            # vitest (node env)
e2e/                              # playwright specs
scripts/                          # optional: check-budget.mjs
```
`src/engine` (per CLAUDE.md) replaces the `core/` name used in ARCHITECTURE.md; `src/aircraft/**` gets the same ESLint boundary.

### Pattern 1: Registry with discriminated kinds and a validating builder
**What:** control definitions are plain data; `defineRegistry()` throws at import time (and in Vitest) on invariant violations. `guarded-toggle` expands into two registry controls (`<id>` and `<id>.guard`) so the guard is "a separate control with its own state" (D-06) and is individually addressable later.
**Id convention (stable, never derived from SVG):** `^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$`, prefixed by kind family: `sw.*`, `lv.*`, `btn.*`; guard = `<switchId>.guard`.
```typescript
// src/engine/types.ts  (design proposal, not copied from a source)
export type ControlId = string;
export type StateId = string;
interface Base { id: ControlId; label: string; region: string; x: number; y: number; } // x,y region-local
export interface StateDef { id: StateId; label: string }          // label shown as small state text (D-13)
export type ControlDef =
  | (Base & { kind: 'toggle'; states: readonly [StateDef, StateDef]; default: StateId })
  | (Base & { kind: 'guarded-toggle'; states: readonly [StateDef, StateDef]; default: StateId })
  | (Base & { kind: 'guard'; states: readonly [StateDef, StateDef]; default: StateId; guards: ControlId }) // derived
  | (Base & { kind: 'detent-lever'; detents: readonly { id: StateId; label: string; pos: number }[]; // pos 0..1 along track
              default: StateId; track: { length: number; axis: 'v' | 'h' } })
  | (Base & { kind: 'momentary-button'; states: readonly [StateDef, StateDef]; default: StateId }); // released, pressed
```
`defineRegistry` invariants (each is a unit test): ids unique; id matches regex; `default` is a legal state; region exists; every `guard.guards` target is a `guarded-toggle`; detent `pos` strictly increasing within 0..1; `controlIds[]` of each region equals the set of controls with that `region` (D-03 and D-08 both state the relation, so **derive** `region.controlIds` from controls in the builder, or test parity, never hand-maintain both).

### Pattern 2: Pure reducer/store with interlocks, no-op suppression, event log
```typescript
// src/engine/store.ts (sketch)
export type ControlEvent = { seq: number; t: number; id: ControlId; value: StateId; source: 'user' | 'scenario' };
export type DispatchResult = { ok: true; event: ControlEvent } | { ok: false; reason: 'unknown' | 'illegal-state' | 'blocked' | 'unchanged' };

dispatch(id: ControlId, value: StateId, t: number): DispatchResult {
  const def = this.registry.get(id);
  if (!def) return { ok: false, reason: 'unknown' };
  if (!isLegalState(def, value)) return { ok: false, reason: 'illegal-state' };
  if (this.isBlocked(def)) return { ok: false, reason: 'blocked' };   // guarded switch with guard closed
  if (this.state[id] === value) return { ok: false, reason: 'unchanged' };
  this.state[id] = value;
  const event = { seq: this.log.length, t, id, value, source: 'user' as const };
  this.log.push(event); this.listeners.forEach((l) => l(event));
  return { ok: true, event };
}
```
`t` is injected (caller passes a clock value); no `Date.now()` in `src/engine` (virtual clock arrives in Phase 2, SCN-08). Momentary button: `pressed` on pointerdown, `released` on pointerup/pointercancel/lostpointercapture; both are events; Phase 2 decides which transition grades.
Guard rule recommendation: `<switch>` blocked while guard state is `closed`; closing a guard is blocked while the switch is not in its default position (physical interlock; prevents a "closed guard over an actuated switch" state that would confuse later grading) [ASSUMED, see A5].

### Pattern 3: Responsive single-viewBox shell (no horizontal scroll, `dvh`)
```css
/* stage.css: page never scrolls; panel fits; footer is HTML below the SVG */
html, body, #app { margin: 0; height: 100%; overflow: hidden; overscroll-behavior: none; background: #0b0d10; }
.stage { position: fixed; inset: 0; height: 100vh; height: 100dvh; display: flex; flex-direction: column; }
.panel-svg { flex: 1 1 auto; min-height: 0; width: 100%; display: block;
  touch-action: none;                 /* MUST be on the root <svg> (see Pitfall 1) */
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.footer { flex: 0 0 auto; touch-action: manipulation; }
```
`<svg viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid meet">`. Recommended logical size 1600x800 (2:1) because landscape phones are about 2.1:1 (e.g. 844x390) so little letterboxing, and desktop 16:9 simply gets side bars [ASSUMED, discretionary]. Do not add `viewport-fit=cover` (avoids notch/safe-area handling). Rotate hint: HTML element (not inside the SVG), shown by `@media (orientation: portrait) and (max-width: 700px)`, `pointer-events: none` except its dismiss button, dismissed via a signal (no storage).
Hit-target rule: a ResizeObserver (rAF-throttled) keeps `scale = min(clientWidth/1600, clientHeight/800)` in a signal; each widget's invisible hit rect is `max(designHit, 44/scale)` capped at half the nearest neighbour pitch. Arithmetic: 44 px equals ~101 viewBox units on a landscape phone (scale ~0.43) but ~180 units on a portrait phone (scale ~0.24), so 44 px is unattainable for dense groups in portrait; that is exactly why D-02 accepts the hint plus large hit rects, and the cap prevents overlaps.

### Pattern 4: Region-local coordinates
Each control's `x,y` are relative to its region; the renderer wraps a region in `<g transform="translate(bounds.x bounds.y)">`. Later region zoom (PNL-V2-01) is then just animating the root `viewBox` to `bounds`. Illustrative region bounds for 1600x800 (planner may adjust): PFD `{20,20,520,380}`, MFD `{560,20,620,380}`, Switch bank `{1210,20,370,380}`, Pedestal/quadrant `{20,430,1560,350}` [ASSUMED, informed by the layout in the private reference photos: PFD left, MFD right, switch/breaker bank far right, lower rocker/button row, centre-console lever area].

### Pattern 5: Pointer handling per widget
- Only handle `e.isPrimary` pointers; ignore the rest (multi-touch).
- **Toggle / guard / guarded switch:** `pointerdown` -> pressed visual + remember pointer id and start point; `pointerup` with movement < 10 px and no cancel -> `dispatch(...)`. `pointercancel` -> clear pressed visual, dispatch nothing. Do **not** also listen to `click`: after a tap the browser still fires `click` (probe log for a WebKit/Chromium tap: `pointerdown:touch, touchstart, pointerup:touch, touchend, click`), so using both double-fires.
- **Momentary button:** dispatch `pressed` on `pointerdown`; dispatch `released` on `pointerup`/`pointercancel`/`lostpointercapture` (once), so a stuck "pressed" state is impossible.
- **Detent lever:** `pointerdown` on the handle -> `setPointerCapture(e.pointerId)`; `pointermove` -> project pointer onto the track and store the transient position in a UI-local signal (not panel state, not logged); `pointerup` -> `snapToDetent(pos)` -> `dispatch`; `pointercancel` -> revert to committed detent, dispatch nothing. Tapping a detent marker (its own hit rect, >= 44 px) dispatches that detent immediately; a pointerup on the handle with < 4 px travel is a no-op.
- Pointer to SVG coordinate: use `svg.getScreenCTM().inverse()` with a `DOMPoint`; never `offsetX`.
```typescript
// src/engine/detents.ts  (pure; unit-tested)
export function snapToDetent(pos: number, detents: readonly { id: string; pos: number }[]): string {
  let best = detents[0]!; let bestD = Math.abs(pos - best.pos);
  for (const d of detents) { const dd = Math.abs(pos - d.pos); if (dd < bestD) { best = d; bestD = dd; } }
  return best.id;
}
// src/ui: const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse()); // local needs region offset
```
- Guard overlap: while the guard is **closed** its hit rect covers the switch and the switch hit rect gets `pointer-events: none` (a tap on the cover can only lift the guard); while **open** the guard graphic lifts and its hit rect shrinks to a small tab beside the switch so the switch is reachable and a second tap on the tab closes it. The store interlock still enforces the rule if the UI is wrong.
- Neutral areas: no handlers on the root `<svg>`, region `<g>`s or backgrounds; widgets expose `data-control-id` and `data-state` for tests (mirror of the store, never the source).
- Feedback (D-13): position change + colour/lit indicator + state text from `StateDef.label` (e.g. ON/OFF). A `blocked` result may show a UI-only shake/flash but is not a ControlEvent.

### Pattern 6: Signals bridge
`bridge.ts` creates one `signal<StateId>` per control id, updates it from `store.subscribe`; each widget reads only its own signal so re-render is per-widget. Engine never imports `@preact/*` (ESLint `no-restricted-imports`, verified firing in probe).

### Pattern 7: Static glass frames with live-binding-ready API
PFD placeholder and MFD frames are plain SVG. Build `ArcGauge`/`BarGauge` taking `value`, `min`, `max`, `bands[]` as props (idle values hard-coded by the caller in Phase 1; Phase 3 passes signals). Rotate needles with the `transform="rotate(a cx cy)"` **attribute** (not CSS `transform-origin`) for cross-browser correctness (Pitfall 6 in project PITFALLS). Colour bands/limits may follow the AFM engine-marking table (numeric limits are facts) but the artwork is original; add the AFM section as a source comment. MFD page: registry `toggle` `sw.mfd_page` with states `map` / `engine`, rendered as a softkey skin (D-04a); the MFD shows the Map page (plus left engine strip) or the full Engine page based on that state.

### Anti-Patterns to Avoid
- **Handlers or state in DOM attributes/classes:** state lives in the store (D-09).
- **`click`+`pointerup` both wired:** double actuation.
- **Hard-coded `/` URLs** (`fetch('/x')`, `<img src="/x">`, absolute font URLs): break on the subpath. Use Vite asset imports or `import.meta.env.BASE_URL`.
- **Hand-maintaining `region.controlIds` and `control.region` separately.**
- **Putting `Date.now()`/`setTimeout` in `src/engine`.**
- **Inventing a control that does not exist in the aircraft** (see Open Question 1: no PROP lever).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Screen-to-SVG coordinates | `offsetX` / manual scale math | `getScreenCTM().inverse()` + `DOMPoint` | Correct under viewBox scaling/letterboxing |
| Pointer unification | separate mouse/touch code | Pointer Events + `setPointerCapture` | One code path (CLAUDE.md) |
| Fonts | system font stack for glass text | `@fontsource/b612*` latin 400/700 subsets | Self-hosted, offline, OFL |
| Full-height layout | `100vh` hacks | `height: 100dvh` with `100vh` fallback | iOS URL-bar jump (needs Safari 15.4+; fallback covers older) [ASSUMED version] |
| Markdown rendering for About | markdown lib / `innerHTML` | Render the `?raw` policy text as text (`white-space: pre-wrap`) | No dependency, no XSS surface |
| Panel pan/zoom | custom viewBox pan/zoom | Nothing: out of scope (PNL-V2-01) | Data model already supports it later |
| Deploy plumbing | custom gh-pages push scripts | Official Pages Actions workflow | Documented, SHA-pinned |

**Key insight:** the risky parts of this phase are not clever algorithms but platform edges (base path, touch-action, WebKit input), all of which are solved by the platform's own primitives used correctly.

## Common Pitfalls

### Pitfall 1: `touch-action` on SVG child elements is ignored
**What goes wrong:** a finger drag on a lever fires `pointerdown, pointermove, pointercancel` and the browser pans instead.
**Why:** in the Chromium (Pixel 7 emulation) probe, `touch-action: none` on the `<rect>` alone gave `down,move,CANCEL`; on the root `<svg>` (alone or together with the rect) the drag completed (`down,move x6,up`); `manipulation` on the root still cancelled [VERIFIED: scratch probe, Playwright 1.64.1 Chromium + CDP `Input.dispatchTouchEvent`]. MDN lists the property as applying to "all elements except non-replaced inline elements, table rows, ..." without mentioning SVG [CITED: developer.mozilla.org/en-US/docs/Web/CSS/touch-action].
**How to avoid:** `touch-action: none` on the root `<svg>` (the panel never scrolls in v1) and `overscroll-behavior: none` on html/body; keep footer/About outside the SVG with `touch-action: manipulation`. Consequence: browser pinch-zoom is disabled over the panel (acceptable for a fixed-fit panel; revisit in PNL-V2-01).
**Warning signs:** `pointercancel` during drags; page scrolls/rubber-bands under a finger. Whether iOS Safari honours it identically is unverified here, so it is a real-device UAT item [ASSUMED, A2].

### Pitfall 2: WebKit mobile emulation needs `<meta name="viewport">`
**What goes wrong:** `page.touchscreen.tap()` in WebKit with the iPhone 15 device produced **no events at all** on a page without the meta tag; with `<meta name="viewport" content="width=device-width, initial-scale=1">` the same tap produced `pointerdown:touch, touchstart, pointerup:touch, touchend, click` [VERIFIED: scratch probe, Playwright 1.64.1 WebKit].
**How to avoid:** keep the meta tag in `index.html`; a missing tag also means iOS lays the page out at 980 px wide (real-device bug), so add an e2e assertion that `window.innerWidth` is about the device width.

### Pitfall 3: WebKit cannot emulate touch drags
`new Touch(...)` throws `Illegal constructor` in Playwright WebKit [VERIFIED: probe]; Chromium can drag via CDP `Input.dispatchTouchEvent` (verified). So: lever **drag** is e2e-tested with `page.mouse` on desktop projects and with CDP touch on the Chromium mobile project; WebKit mobile projects test **taps** (toggle, guard, detent-marker jump, buttons). Real iOS drag is a manual UAT item. Playwright WebKit is not iOS Safari (engine, not platform), so it never replaces real-device checks.

### Pitfall 4: Base path / smoke test traps
- `vite build` with `BASE_PATH=/procedure-trainer-da-50/` rewrote `index.html` to `/procedure-trainer-da-50/assets/index-*.js` and `.css`; fonts are emitted under `assets/` via the CSS import [VERIFIED: scratch probe build].
- `vite preview` redirects `/` to the base (HTTP 302) and returns **200 for unknown paths under the base** (SPA fallback) [VERIFIED: probe curl], so a smoke test must assert real content/asset responses, not status codes of arbitrary URLs.
- In Playwright with a `baseURL` that includes a path, `page.goto('/')` goes to the host root; use `page.goto('./')` with `baseURL` ending in `/` [ASSUMED: standard URL resolution].
- Case-sensitivity: Linux CI is case-sensitive; keep `forceConsistentCasingInFileNames` on and avoid mixed-case asset names.

### Pitfall 5: TS 6 defaults and tooling
`types` no longer auto-includes `@types/*` (probe error `TS2591` for `process`). Use `tsconfig.base.json` + `tsconfig.app.json` (`types: ["vite/client"]`, include `src`) + `tsconfig.node.json` (`types: ["node","vite/client"]`, include config files/tests/e2e/scripts) + solution-style root `tsconfig.json` with `references`; `tsc -b` passes and typescript-eslint `projectService` resolves files through it. JS config files need `tseslint.configs.disableTypeChecked` (probe error: "eslint.config.js was not found by the project service") [VERIFIED: scratch probe].

### Pitfall 6: Hit rect overlap and hit-target sizing
Guard covers + switch rects overlap by design; see Pattern 5. Cap enlarged rects by neighbour pitch and unit-test "no two enabled hit rects of different controls overlap" geometrically at a minimum scale.

### Pitfall 7: Stuck pressed / dangling pointer capture
Always handle `pointercancel` and `lostpointercapture`; clear transient drag state. A resize/rotation mid-drag must not change committed state.

### Pitfall 8: Pages-specific
Free-plan Pages needs a **public** repo; Settings -> Pages -> Source = GitHub Actions is a manual step; there is currently **no git remote** in this repo (`git remote -v` empty). First deploy cannot be verified until the user creates the GitHub repo and pushes (human-action checkpoint).

## Code Examples

### vite.config.ts (host-agnostic base from env)
```typescript
// Verified building in scratch probe (Vite 8.3.4, vitest 5.0.5, TS 6.0.3)
import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: process.env['BASE_PATH'] ?? '/',   // CI sets /<repo>/; local and other hosts default to '/'
  plugins: [preact()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```
Scripts: `"build": "vite build"`, `"build:e2e": "VITE_TEST_HOOKS=1 BASE_PATH=/procedure-trainer-da-50/ vite build --outDir dist-e2e"`, `"preview:e2e": "vite preview --outDir dist-e2e --port 4173"`, `"typecheck": "tsc -b"`, `"lint": "eslint ."`, `"test": "vitest run"`, `"e2e": "playwright test"`. Use a cross-platform way to set env (or run only on Linux CI/macOS); the repo name in `build:e2e` is a test fixture constant, not the deploy base.

### GitHub Actions workflow
Action refs from Vite's static-deploy guide [CITED: vite.dev/guide/static-deploy.html]; every SHA re-checked with `git ls-remote` today. **Correction:** the guide's setup-node SHA (`8207627...`) is tag `v7.0.0`; the current `v7` tag (= v7.1.0) is `949feb2413d6458794dcd2491c4babbbce0c15c1` and matches CLAUDE.md's "setup-node v7" [VERIFIED: git ls-remote]. Other SHAs match the guide.
```yaml
name: CI and Deploy
on:
  push: { branches: [main] }
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: true
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
        env: { BASE_PATH: "/${{ github.event.repository.name }}/" }
      - uses: actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6
        if: github.ref == 'refs/heads/main'
      - uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5
        if: github.ref == 'refs/heads/main'
        with: { path: ./dist }
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium webkit
      - run: npm run e2e
  deploy:
    if: github.ref == 'refs/heads/main'
    needs: [verify, e2e]
    runs-on: ubuntu-latest
    permissions: { pages: write, id-token: write }
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1
```
The `e2e` job builds its own `dist-e2e` through Playwright's `webServer` (test hook enabled, fixed fixture base) so the deployed artifact never contains the test hook. `base` is derived from `github.event.repository.name`, so the repo name is not hard-coded anywhere.

### playwright.config.ts (projects)
```typescript
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173/procedure-trainer-da-50/', trace: 'on-first-retry' },
  webServer: { command: 'npm run build:e2e && npm run preview:e2e', url: 'http://localhost:4173/procedure-trainer-da-50/', reuseExistingServer: !process.env['CI'] },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop-webkit',   use: { ...devices['Desktop Safari'] } },
    { name: 'phone-chromium',   use: { ...devices['Pixel 7 landscape'] } },
    { name: 'phone-webkit',     use: { ...devices['iPhone 15 landscape'] } },
    { name: 'tablet-webkit',    use: { ...devices['iPad (gen 11) landscape'] } },
    { name: 'phone-portrait',   use: { ...devices['iPhone 15'] } },
  ],
});
```
Device names confirmed present in 1.64.1: `iPhone 15`, `iPhone 15 landscape`, `Pixel 7`, `Pixel 7 landscape`, `iPad (gen 11)`, `iPad (gen 11) landscape`, `Galaxy Tab S9` [VERIFIED: probe listing of `devices` keys]. Specs read state through `data-control-id`/`data-state` and, for "no event emitted", through `window.__panel.events` exposed only when `import.meta.env.VITE_TEST_HOOKS` is set (dead-code-eliminated in the deploy build).

### dependabot.yml
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
    ignore:
      - dependency-name: typescript
        update-types: ["version-update:semver-major", "version-update:semver-minor"]
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```

### ESLint boundary (verified firing in probe)
```javascript
{ files: ['src/engine/**/*.ts', 'src/aircraft/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', { patterns: ['preact', 'preact/*', '@preact/*', '**/ui/**'] }],
    'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'setTimeout', 'setInterval', 'requestAnimationFrame'],
  } }
```
Probe result: importing `@preact/signals` and using `window` in `src/engine/bad.ts` yielded two errors [VERIFIED: scratch probe]. Add `Date` handling (`no-restricted-properties` for `Date.now`, `performance.now`) if desired.

## Content Policy Doc Contents (CNT-03, `docs/CONTENT-POLICY.md`)

Land this in the first wave; it is independent of the app. It must be decided and committed before any plan commits procedure text. Required sections (derived from D-14, D-15, D-16 and PITFALLS 7/8):
1. **Status and purpose:** training aid, not a substitute for the approved AFM; not affiliated with or endorsed by Diamond Aircraft or Garmin; trademark attribution (DA50, Diamond; Garmin, G1000 NXi) [from PITFALLS 8].
2. **What may be committed:** (a) facts such as control positions, limits and procedure ordering expressed as structured data; (b) **short verbatim checklist step lines** (D-15), defined concretely: one step = one line naming an action and target state, no warnings/cautions/notes verbatim, no figures/tables/pages, no continuous run of a whole procedure copied as prose; (c) all narrative/explanatory text paraphrased in the author's own words. The exact quantitative limit on "short" is a user decision (A4, Open Question 3).
3. **What must never be committed:** the AFM PDF or extracts, page images, photos from `.input/`, Garmin/Diamond logos, traced or screenshot-derived artwork. `.input/` stays git-ignored (it is in `.gitignore` today [VERIFIED: .gitignore contents `.input/`, `.DS_Store`, `node_modules/`, `dist/`]).
4. **Per-scenario metadata (forward-looking, enforced in Phase 2 schema):** AFM document number, issue/revision, section/page, last-verified date; the AFM in `.input` is "AFM DA 50 C, Doc 9.01.01-E, Issue 018, 01-Apr-2025" [VERIFIED: .input/afm-notes.md], which is the revision this project is being built against.
5. **Repo visibility (D-14):** public in v1; before any paid pack (BUS-V2-01) paid content moves to a private source and only built output is published; once text is in public git history it is effectively permanent, so uncertain text must not be committed.
6. **Responsibility (D-15):** compliance with copyright remains the content author's responsibility; not legal advice; legal review before monetisation (BUS-V2-03); hosting migration before any sale (BUS-V2-02, GitHub Pages terms bar commercial use per project PITFALLS).
7. **Artwork rule (D-04b):** all panel artwork original; reference photos only for layout/gauge order/colour bands/annunciation wording.
8. **Error reports/corrections process** (issue link), kept short.

Surfacing (D-16): README link; an `About` screen opened from the footer (`Training aid, not the AFM · About and content policy`) that shows the trademark/not-AFM notice and the policy text imported with `import policy from '../../docs/CONTENT-POLICY.md?raw'`, rendered as text. Hygiene tests (Vitest, node): `docs/CONTENT-POLICY.md` exists and contains the headings above; README links it; `git ls-files` lists no `*.pdf` and nothing under `.input/`; the footer source contains the notice string.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `100vh` full-screen | `100dvh` (with `100vh` fallback) | Safari 15.4+ [ASSUMED] | Avoids URL-bar jump |
| Mouse + touch handlers | Pointer Events + capture | widely available | One code path |
| `typescript` latest | pin TS 6.0.x | TS 7.0 shipped 2026-07-08 without an API | typescript-eslint peer `<6.1.0` [CITED: CLAUDE.md] |
| `npm create vite` templates | manual scaffold | project decision | Avoids a different TS major |

**Deprecated/outdated:** the Vite guide's setup-node SHA is one patch behind the `v7` tag (use v7.1.0 SHA above).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Repo will be named `procedure-trainer-da-50` and be public on a plan that supports Pages | Pitfall 8, workflow | None for code (base derives from repo name); deploy blocked if private on a free plan |
| A2 | Real iOS Safari honours `touch-action: none` on the root `<svg>` and pointer capture behaves as in Chromium | Pitfall 1, Pattern 5 | Lever drag may scroll/cancel on iPhone; fallback is tap-to-jump detent markers (already required) plus an HTML wrapper `touch-action: none` |
| A3 | 1600x800 (2:1) is the right logical panel aspect | Pattern 3/4 | Letterboxing larger on desktop; trivial to change (data) |
| A4 | "Short verbatim step line" = one action line, no warnings/notes/figures | Content policy | User/legal may want a stricter or looser limit; policy text must be confirmed |
| A5 | Closing a guard is blocked while the guarded switch is in a non-default state | Pattern 2 | A different realism choice; cheap to flip, affects unit tests |
| A6 | Safari supports `dvh` from 15.4 | State of the Art | Fallback to `100vh` already present |
| A7 | Cowl flap actuation type (switch vs lever vs other) | Open Question 1 | Wrong widget kind for that control; registry-only change |
| A8 | Chromium Pixel 7 emulation is a fair proxy for Android Chrome touch behaviour | Pitfall 3 | Real-device Android UAT still required (already planned) |
| A9 | `page.goto('./')` resolves under a path-bearing `baseURL` (URL standard) | Pitfall 4 | Smoke test navigates to wrong page; caught on first run |
| A10 | Optional CSP `<meta>` is not required in Phase 1 | Security Domain | Low; can be added later |

## Open Questions

1. **"Prop" lever does not exist on this aircraft; cowl flap type unclear.**
   - What we know: the AFM (private, section 07-23 "Engine Operating Controls") describes a **single power lever** with positions Ground Idle (behind a detent), Flight Idle, and MAX (take-off power), the ECU governs prop speed; the same section lists ELECT. MASTER, ENGINE MASTER, START button, FADEC FORCE B switch and FADEC TEST button [VERIFIED: private AFM extraction, `.input/DA50RG_AFM.pdf`, section 07-23, paraphrased]. The emergency procedures reference a "cowl flap" with an indicator light and open/closed positions, and a COWL FLAP circuit breaker is visible in the reference photo [VERIFIED: pdftotext of AFM section 03-21; `.input/IMG_7761.JPG`], but the extracted text does not say how the cowl flap is selected.
   - What's unclear: whether the user wants a "prop" lever shown at all, and how the cowl flap is physically operated.
   - Recommendation: build the detent-lever demo set as **POWER lever (GI / FI / intermediate / MAX), COWL FLAP (open/closed, confirm control type), landing-gear selector (UP/DOWN), FLAPS selector (UP/T/O/LDG)** and do not add a propeller lever to the panel (a non-existent control would train the wrong thing). Ask the user to confirm; the roadmap criterion wording ("throttle, prop, cowl flap") should be read as "detented levers incl. the power lever and cowl flap".
2. **Which controls are guarded/confirm-to-actuate in the demo set (D-07)?**
   - What we know: reference photos show a red toggle at the ELT switch and a red ELECT. MASTER rocker; whether either has a real guard is not established from the photos.
   - Recommendation: choose 1-2 consequential controls (e.g. ENGINE MASTER or EMERG FUEL PUMP, and an ELT-style switch) as demo guarded-toggles, labelled as demonstration set; final safety set is scoped in Phase 2/3. Flag as discretionary.
3. **Exact verbatim limit for the content policy (A4).** Ask the user to confirm the proposed concrete wording before the policy is committed; recommend noting "no legal review yet".
4. **Real devices:** which iPhone/Android/tablet will be used for UAT, and who runs it (human-verify at end of phase per `human_verify_mode: end-of-phase`).
5. **Circuit breakers (not in D-08).** The reference photo shows large banks of pull/push circuit breakers (ESSENTIAL/MAIN/AVIONICS BUS). The Electrical Failure scenario in Phase 3 will likely need them. Out of scope for Phase 1, but keep the `ControlDef` union open (add a `circuit-breaker` kind later without touching existing code).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test | yes | v26.12.0 (CI uses 24) | none needed |
| npm | install | yes | 11.20.0 | none needed |
| git | repo | yes | present | none |
| Git remote / GitHub repo | Pages deploy (PLT-01) | **no remote configured** | `git remote -v` empty | Human must create public repo and push; local `vite preview` subpath check meanwhile |
| GitHub CLI `gh` | optional automation | no | not found | Use the web UI for repo/Pages settings |
| Playwright browsers (chromium, webkit v2370) | e2e | yes (installed in cache during research) | 1.64.1 | `npx playwright install` |
| poppler `pdftotext` | reading the private AFM (research only) | yes | /opt/homebrew/bin | not needed by the build |

**Missing dependencies with no fallback:** a GitHub remote (blocks verifying criterion 1 on the real Pages URL).
**Missing dependencies with fallback:** `gh` (use the web UI).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 5.0.5 (unit, node env) + Playwright 1.64.1 (e2e, chromium + webkit) |
| Config file | `vite.config.ts` (`test` key) and `playwright.config.ts` (none exist; Wave 0) |
| Quick run command | `npm test` (`vitest run`) |
| Full suite command | `npm run typecheck && npm run lint && npm test && npm run e2e` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLT-01 | Build honours `BASE_PATH`; same build works at `/` and a subpath | unit/script + e2e | `npx vitest run tests/build-base.test.ts` (runs `vite build` with env into a temp dir, asserts index.html asset URLs start with the base) and `npx playwright test e2e/smoke.spec.ts` (loads `./`, asserts panel svg present, no failed asset responses, no console errors) | Wave 0 |
| PLT-01 | Workflow is valid and actions are SHA-pinned | unit | `npx vitest run tests/workflow.test.ts` (reads `.github/workflows/deploy.yml`, asserts every `uses:` is a 40-hex SHA) | Wave 0 |
| PLT-01 | Deployed Pages URL loads | manual | human opens the Pages URL after first push (needs remote) | manual-only (no remote yet) |
| CNT-03 | Policy exists, linked, `.input` ignored, no PDFs tracked | unit | `npx vitest run tests/content-policy.test.ts` | Wave 0 |
| PNL-02 | Registry invariants (unique stable ids, defaults legal, regions exist, region.controlIds parity, detents ordered, guard targets valid) | unit | `npx vitest run tests/registry.test.ts` | Wave 0 |
| PNL-02 | Store only reaches legal states; unknown/illegal rejected; no-op emits nothing | unit | `npx vitest run tests/store.test.ts` | Wave 0 |
| PNL-06 | Guard interlock: switch blocked while guard closed, allowed when open; guard-close blocked when switch actuated; blocked attempts add no event | unit | `npx vitest run tests/store.test.ts -t guard` | Wave 0 |
| PNL-01 | `snapToDetent` / `projectToTrack` pure math | unit | `npx vitest run tests/detents.test.ts` | Wave 0 |
| PNL-05 | Regions inside viewBox; controls inside their region; hit rects (at min scale) do not overlap | unit | `npx vitest run tests/layout.test.ts` | Wave 0 |
| PNL-05 | No horizontal page scroll at desktop/tablet/phone landscape/portrait viewports | e2e | `npx playwright test e2e/layout.spec.ts` (`document.documentElement.scrollWidth <= innerWidth`, svg bbox inside viewport) | Wave 0 |
| PNL-01 | Toggle flips by mouse and by tap; label text and `data-state` change | e2e | `npx playwright test e2e/controls.spec.ts` (all projects) | Wave 0 |
| PNL-01/06 | Guard flow: tap switch with guard closed does nothing; lift guard; actuate; guard stays up | e2e | same spec | Wave 0 |
| PNL-01 | Lever: tap detent marker (all projects); drag-snap with `page.mouse` (desktop) and CDP touch (phone-chromium) | e2e | same spec | Wave 0 |
| PNL-06 | Tapping neutral background/regions leaves `window.__panel.events` length unchanged | e2e | `npx playwright test e2e/neutral.spec.ts` | Wave 0 |
| PNL-01 | Real iOS Safari + Android drag, tap, guard, rotate hint | manual UAT | checklist in plan; end-of-phase | manual-only (WebKit emulation cannot drag; not real iOS) |

### Sampling Rate
- **Per task commit:** `npm test` (+ `npm run typecheck` when types change)
- **Per wave merge:** `npm run typecheck && npm run lint && npm test && npm run e2e`
- **Phase gate:** full suite green in CI, then the manual real-device checklist, before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `package.json`, lockfile, `vite.config.ts`, tsconfig set, `eslint.config.js`, `playwright.config.ts`, `.prettierrc`
- [ ] `tests/registry.test.ts`, `store.test.ts`, `detents.test.ts`, `layout.test.ts`, `content-policy.test.ts`, `build-base.test.ts`, `workflow.test.ts`
- [ ] `e2e/smoke.spec.ts`, `layout.spec.ts`, `controls.spec.ts`, `neutral.spec.ts`
- [ ] Framework install: `npm ci` then `npx playwright install --with-deps chromium webkit`
- [ ] Optional size budget (Pitfall 6 in project research): script asserting gzipped `dist/assets/*.js` stays under an agreed limit (probe app: 8.5 kB gzip JS; fonts ~13-21 kB each woff2)

## Security Domain

`security_enforcement` is enabled (ASVS level 1, block on high).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No accounts/backend in v1 |
| V3 Session Management | no | None |
| V4 Access Control | no | Static public content; PackProvider seam is Phase 2 |
| V5 Input Validation | limited | No user text input and no scenario parsing in this phase; control ids/states validated by the registry; render all text as text, never `innerHTML` (About policy text via `?raw` shown as text) |
| V6 Cryptography | no | None |
| V10/V14 Build and supply chain | yes | SHA-pinned actions, least-privilege `permissions` (job-level `pages: write`/`id-token: write` only on deploy), `npm ci` with committed lockfile, exact version pins, Dependabot, no secrets in repo |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Compromised/unpinned GitHub Action | Tampering | Pin by commit SHA (verified); Dependabot for `github-actions` |
| Malicious new npm release | Tampering | Exact pins, lockfile review checkpoint, no postinstall in direct deps (verified) |
| XSS via rendered text | Tampering | Preact escapes by default; never `dangerouslySetInnerHTML`/`innerHTML` |
| Test hook shipped to production | Information disclosure | `VITE_TEST_HOOKS` only in the e2e build; assert absence in the deploy build (grep `__panel` in `dist/`) |
| Overbroad workflow token | Elevation of privilege | Top-level `contents: read`; deploy job only gets Pages permissions |
| Third-party requests (fonts) | Information disclosure | Self-hosted fontsource, no CDN |

Optional hardening (A10): a CSP `<meta>` limited to `default-src 'self'` can be added later; note `frame-ancestors` cannot be set via meta.

## Suggested Slicing (for the planner; walking skeleton)

1. **Wave 1a:** Scaffold + lint/type/test tooling + minimal page + `deploy.yml` + `dependabot.yml` + smoke e2e at subpath (includes consolidated dependency checkpoint and a human-action checkpoint: create public repo, push, set Pages source to Actions, confirm the URL loads).
2. **Wave 1b (parallel, no code dependency):** `docs/CONTENT-POLICY.md` + README + `content-policy.test.ts` (confirm A4 wording with the user first).
3. **Wave 2:** `src/engine` registry/store/detent math + all unit tests (no UI).
4. **Wave 2 (parallel):** DA50 aircraft data: regions, demo controls, layout + layout geometry tests (depends on registry types only).
5. **Wave 3:** Panel shell and widgets (toggle, guarded toggle, momentary button), static PFD/MFD frames, MFD page toggle, footer/About, rotate hint.
6. **Wave 3/4:** Detent lever widget and drag handling.
7. **Wave 4:** Remaining e2e specs, real-device UAT checklist (human-verify, end of phase).

## Sources

### Primary (HIGH confidence)
- npm registry via `npm view` and `gsd-tools query package-legitimacy check` (2026-10-19): versions, publish dates, downloads, postinstall.
- Scratch probe projects outside the repo (Vite 8.3.4 + Preact 11.0.1 + TS 6.0.3 + Vitest 5.0.5 + ESLint 10.13.0 + typescript-eslint 8.71.2 + Playwright 1.64.1 Chromium/WebKit): build with `BASE_PATH`, `tsc -b`, ESLint boundary, `vite preview` base behaviour, touch-action and pointer-event probes.
- `git ls-remote` on actions/checkout, setup-node, configure-pages, upload-pages-artifact, deploy-pages (tag-to-SHA verification).
- Private AFM extraction (`.input/DA50RG_AFM.pdf`, sections 07-23, 03-21; `.input/afm-notes.md`) and reference photos (`IMG_0738.jpg`, `IMG_7761.JPG`): control inventory facts (paraphrased only).
- `.claude/CLAUDE.md`, CONTEXT.md, REQUIREMENTS.md, STATE.md, `.planning/research/ARCHITECTURE.md` and `PITFALLS.md`.

### Secondary (MEDIUM confidence)
- https://vite.dev/guide/static-deploy.html: Pages workflow, `base` guidance (SHAs cross-checked, one corrected).
- https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action: applicability text (does not mention SVG).
- WebKit Bugzilla 220196 (pointer capture on iOS, mostly fixed in Safari 15.5): from search result summary.

### Tertiary (LOW confidence)
- Search result summaries about Playwright `touchscreen.tap` (only used to frame the probes; behaviour itself was probed).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, versions re-queried and a build/type-check/lint/test probe passed.
- Architecture: HIGH for engine/registry/store design (follows locked decisions); MEDIUM for coordinates and aspect ratio (discretionary).
- Pitfalls: HIGH for the probe-verified ones (touch-action on child, WebKit viewport meta, `process` types, preview behaviour); MEDIUM for iOS Safari real-device behaviour.

**Research date:** 2026-10-19
**Valid until:** 2026-11-02 (fast-moving toolchain; re-check `npm view` pins and the action SHAs if planning slips)
