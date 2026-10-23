<!-- GSD:project-start source:PROJECT.md -->

## Project

**DA50 RG Procedure Trainer**

A web-based 2D cockpit procedure trainer for the Diamond DA50 RG, including emergency situations. The user sees an interactive panel (gauges, glass-display areas, annunciations, switches, levers, buttons). A "new situation" starts a quiz-style scenario (e.g. "OIL TEMP HIGH" annunciated like in the real aircraft), and the user must perform the correct checklist actions by operating the panel. Performance is graded against stored required, optional and ordered actions.

**Core Value:** The user can run an emergency scenario by actually operating the panel controls, and gets accurate, objective feedback on whether they performed the AFM procedure correctly.

### Constraints

- **Tech stack**: TypeScript + Vite, SVG-rendered panel — static output suited to GitHub Pages, scalable graphics for all screen sizes
- **Hosting**: GitHub Pages (static only) — no server-side enforcement in v1
- **Devices**: desktop, tablet, phone — touch and mouse input, responsive scaling
- **Content format**: TOON scenario files with schema validation and line-numbered errors — manual extensibility
- **Safety/legal**: Clearly marked as training aid, not replacing AFM — liability

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Node.js | 24 LTS in CI (local 26.x fine) | Build/test runtime | Vite 8 needs `^20.19 \|\| >=22.12`; Vitest 5 needs `^22.12 \|\| ^24 \|\| >=26`. Node 24 satisfies everything. Node 20 does NOT satisfy Vitest 5. | HIGH |
| TypeScript | **`~6.0.3` (pin to 6.0.x, NOT 7)** | Language / type-check | TS 7.0 (native Go port, released 2026-07-08) ships **no programmatic API**; typescript-eslint 8.71.2 declares peer `typescript >=4.8.4 <6.1.0`. Microsoft itself tells API-dependent tooling to stay on 6.0. 6.0.3 passed type-check in the probe with `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`. Revisit when TS 7.1 + typescript-eslint support land. Vite/esbuild-style transpilation does not use `tsc`, so build speed is unaffected. | HIGH |
| Vite | 8.3.x | Dev server, bundler (Rolldown-based in v8), static build | Brief mandates it; first-class GitHub Pages guide; `import.meta.glob` gives lazy per-pack chunks (needed for gate-ready pack separation). | HIGH |
| Preact | 11.0.1 (stable `latest`) | UI/rendering of SVG panel and screens | See "UI framework" rationale below. ~3 KB runtime, JSX renders SVG natively, signals give fine-grained gauge updates. Probe bundle (Preact + signals + zod + one component) was 33 KB gzip, before the parser. Fallback if any ecosystem lib balks at v11: `preact@10.29.x`. | MEDIUM |
| @preact/signals | 2.11.3 | Reactive aircraft/panel state bound to SVG attributes | Peer range explicitly includes `preact >=11.0.0-0`. Updating a needle rotation re-renders only that attribute, not the component tree. | MEDIUM |
| @preact/preset-vite | 2.10.6 | Vite plugin for Preact (JSX, HMR) | Peer range lists Vite 8. Verified building in probe. | HIGH |
| @toon-format/toon | 4.4.0 (pinned exactly) | Parse scenario TOON files | TOON is a Working Draft spec (11 releases in 11 months), so the version is pinned exactly and a conformance test guards every upgrade. `decode` in strict mode throws `ToonDecodeError` with a 1-based line; schema errors get line and column from the project's own path-to-line index (`src/scenario/toon-index.ts`). Non-developer authors need line numbers. | MEDIUM |
| Zod | 4.6.7 | Scenario schema = single source of truth (validation + TS types + JSON Schema) | `z.strictObject` catches typos like `requird:` (verified: "Unrecognized key ... line 9, col 5"). `z.infer` gives engine types for free. `z.toJSONSchema()` stays an optional documentation artifact for the authoring guide (there is no editor schema support for TOON). `z.discriminatedUnion` models the action/condition/reaction variants cleanly. | HIGH |
| Plain TypeScript pure-function engine (no library) | - | Scenario evaluation: action matching, ordering, forbidden actions, timed reactions, scoring | See "State machine / rules engine" rationale. Deterministic, framework-free, trivially unit-testable with a virtual clock. | HIGH (as a design decision) |
| GitHub Pages via GitHub Actions | actions: checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5 | Hosting + CI/CD | Official Vite guide workflow (fetched 2026-10-19). Pin by commit SHA as the guide does. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fontsource/b612 + @fontsource/b612-mono | 5.3.0 (OFL-1.1) | Self-hosted B612 font (Airbus, designed for cockpit displays) | Glass-display/annunciator text that reads like an avionics screen; self-hosted so no third-party request and works offline. Import only the weights used. |
| vite-plugin-pwa | 2.0.0 (peer: Vite up to 8, workbox 7.4) | Service worker / offline install | Add in a late phase. Pilots train in hangars/airplanes with poor connectivity; installable PWA on phone/tablet is a real value-add. Not v1-blocking. |
| svgo | 4.1.0 | Optimise any hand-drawn SVG artwork (Inkscape/Figma exports) | Only if panel artwork is imported as static SVG. Prefer procedural gauge components; use SVGO via a one-off script, not a runtime dependency. |
| @axe-core/playwright | 4.14.0 (MPL-2.0) | Accessibility checks in e2e | Optional; cheap guardrail for contrast on annunciators and touch-target sizes. |
| @testing-library/preact | 3.2.4 | Component tests | Only if component-level tests are wanted. Prefer engine unit tests + Playwright; skip unless needed. |
| Web Crypto API (built into browsers) | - | AES-GCM decrypt of paid packs, optional Ed25519/HMAC | Only when gating is implemented (post-v1). Zero dependency. |
| Web Audio API (built in) | - | Aural alerts/chimes | No library needed for a few synthesized tones. |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Vitest | 5.0.5 | Unit tests (engine, schema, scenario files) | Run in `node` environment for engine/schema; `happy-dom` only for the few DOM tests. Requires Node `^22.12 \|\| ^24 \|\| >=26`. Import `defineConfig` from `vitest/config` so the `test` key type-checks. |
| @playwright/test | 1.64.1 | E2E incl. touch/mobile viewports | Projects for chromium, webkit and mobile emulation (use Playwright's built-in `devices` registry: a phone and a tablet). `webServer` runs `vite preview` so tests hit the production build with the real `base`. |
| ESLint | 10.13.0 | Lint (flat config) | Verified working with TS 6.0.3 type-aware rules (`projectService: true`). |
| typescript-eslint | 8.71.2 | TS lint rules | Peer TS `<6.1.0`, which is why TS is pinned to 6.0.x. |
| @eslint/js | 10.0.1 | Base ESLint rules | |
| Prettier | 3.9.10 | Formatting | Format code, JSON and Markdown. Never format TOON scenario files with the library encoder: it drops comments. |
| happy-dom | 21.0.3 | Lightweight DOM for Vitest | Preferred over jsdom for speed; SVG support is adequate for non-layout tests. Do not assert on geometry/layout in it (use Playwright). |

## Detailed Rationale for the Key Questions

### UI framework: Preact 11 + signals (over vanilla / Svelte / React)

- The panel is a few hundred SVG elements whose attributes (needle angle, lever position, annunciator fill, switch state) are driven by a single state object. That is a textbook fit for declarative rendering with fine-grained reactivity, and a poor fit for hand-rolled DOM updates (vanilla gets messy once the checklist overlay, mode switching, debrief screen and responsive layout exist).
- **Preact** renders SVG via normal JSX, adds ~3 KB, needs no compiler beyond the JSX transform, and signals bind directly to attributes (`<line transform={rot}>` re-renders only that attribute). Keeps the whole app small enough for phones on bad connections.
- **Svelte 5** is a legitimate alternative (excellent reactivity, great for SVG), but: `@sveltejs/vite-plugin-svelte` 7.x is tied to Svelte `^5.46.4` and Vite 8, and Svelte's language tooling (svelte-check/Volar) is explicitly among the tools that are staying on TS 6.0 while TS 7 has no API. Not a blocker, just more moving parts for no payoff here. Choose it instead only if the team already prefers it.
- **React 19** (19.3.1) works but costs ~10x the runtime and needs memoization discipline to keep a gauge-heavy SVG tree cheap. No benefit for this app; its ecosystem (component kits, routers) is irrelevant for a custom SVG panel.
- Keep the **engine and aircraft-state model framework-agnostic** (plain TS in `src/engine`, no JSX/preact imports). The UI layer subscribes via signals. This keeps the framework decision cheap to reverse.
- No router. Screens (menu / scenario briefing / running / debrief) are app state. If deep links are ever wanted, use hash routing; never rely on History API paths on GitHub Pages (404 on refresh).

### State machine / rules engine: do NOT use XState for scenario evaluation

- Scenarios are **data (TOON), not code**. XState machines are defined in code; to drive them from TOON you must write a TOON-to-machine compiler, i.e. build your own interpreter anyway, plus learn XState's quirks.
- The evaluation is not a classic FSM. It is "match a stream of user actions against required / optional / ordered-group / unordered / forbidden constraints and fire timed or triggered reactions". Natural model: `step(state, event) -> state` where `event` is `{type:'userAction', control, value, t}` or `{type:'tick', t}`; derived grading is a pure function over the recorded action log. Order constraints are a small piece of logic, not a statechart.
- Determinism and testability: with a virtual clock (`tick(dtMs)` events, no `setTimeout` inside the engine) you can unit test "temperature escalates to engine failure if ignored for 45 s" instantly, and replay a recorded run for debrief.
- Bundle/complexity cost with no gain.
- Conditions in TOON are a small **declarative DSL validated by Zod** (e.g. `{ when: { control: oil_temp_gauge, op: gt, value: 240 } }`, `{ after: 30s, if: not_done: [action_id] }`). Never `eval`/`new Function` expressions from TOON; scenario files are authored by non-developers and may later be user-supplied.
- A separate `scenario-lint` pass (run in Vitest and CI) checks **cross-references** the schema cannot: every `control` ID exists in the panel's control registry, every `action_id` referenced exists, no unreachable reactions, ordered groups reference real actions. Implement with `superRefine` where context is local, otherwise a plain function.

### TOON + validation: `@toon-format/toon` 4.4.0 + Zod 4.6.7 (not Ajv)

- `@toon-format/toon` 4.4.0, pinned exactly: `decode` in strict mode throws `ToonDecodeError` with a 1-based line for syntax errors; schema errors (Zod issue paths) get line and column from the project's own path-to-line index (`src/scenario/toon-index.ts`), so validation errors can say "line 9, col 5". For non-developer authors this is the difference between usable and not.
- TOON pitfalls: pin the version exactly and run the conformance test before any upgrade (Working Draft spec); strict decoding means array counts `[N]` must match the rows; quote numeric-looking strings (`issue: "018"`); comments are full lines starting with `#` only; no tabular rows and no root arrays in scenario files; never auto-format scenario files with the library encoder (it drops comments).
- Zod over Ajv (8.20.0): schema, TS types and JSON Schema from one definition. Ajv makes JSON Schema the source of truth and then needs `json-schema-to-ts` or hand-written types. Choose Ajv only if authors are expected to maintain the JSON Schema by hand.
- Use `z.strictObject` everywhere in scenario schemas so typos fail loudly.
- **Authoring feedback:** there is no editor schema support for TOON. Authors get `npm run validate` (reports file:line:col) and the Vitest check that validates every shipped scenario file. `z.toJSONSchema(Scenario)` stays an optional documentation artifact for the Phase 7 authoring guide.
- **Loading strategy:** Pack manifests `/scenarios/*/pack.toon` are globbed eagerly and scenario files `/scenarios/*/*.toon` lazily with `{ query: '?raw', import: 'default' }`, grouped into one chunk per pack (Vite 8 `build.rolldownOptions.output.codeSplitting`), then parse+validate at runtime. Runtime parsing is required anyway once packs can be encrypted (decrypt to text, then parse). Back it with a CI/Vitest test that loads and validates **every** scenario file so a bad scenario file fails the build, not the user.
- Do not add a build-time scenario plugin for TOON. It would parse at build time, skip your line-number error reporting, and fight the encrypted-pack path; the runtime parse keeps line-numbered errors.

### Testing: Vitest 5.0.5 + Playwright 1.64.1

- Vitest: most value is in engine tests (matching, ordering, forbidden, timers/reactions, scoring) and "every scenario file validates" tests. No browser needed. Vite-native, shares `vite.config.ts`.
- Playwright: smoke the real built site, click/tap controls on mobile-emulation projects, check the pan/zoom path on a phone viewport, run one full scenario to debrief. Use `webkit` (iOS Safari engine) since touch/pointer-event and viewport-unit quirks are the main phone risk. Keep screenshot assertions (`toHaveScreenshot`) to Linux CI only, because fonts/antialiasing differ per OS.
- Skip Cypress, Jest, Karma (no advantage; Jest needs transform config with Vite 8/ESM).

### Responsive SVG panel mechanics (no library needed for most of it)

- One root `<svg viewBox="0 0 W H" preserveAspectRatio="xMidYMid meet">` scaled by CSS (`height: 100dvh`; avoid `100vh` on mobile Safari). Panel is a single coordinate space; "functional layout" regions are `<g>` groups.
- Input via **Pointer Events** (`pointerdown/move/up` + `setPointerCapture`) for mouse, touch and pen with one code path; set CSS `touch-action: none` on draggable controls (levers, knobs) so the browser does not hijack drags as scroll. Ensure hit targets are >= ~44 px in screen space on phones (invisible larger hit rect over small controls).
- Phone pan/zoom: implement by manipulating the root `viewBox` (about 100 lines: two-pointer pinch, one-pointer pan on empty background, double-tap to fit). A library (`@panzoom/panzoom` 4.6.2, last published 2026-04) is the fallback, but generic pan/zoom libraries tend to fight per-control drag gestures; custom keeps gesture arbitration in your hands. MEDIUM confidence; decide in the panel phase.
- Do not use `svg-pan-zoom` (3.6.2) or `panzoom` (9.4.4): old, not touch-gesture-arbitrating, and add little over a viewBox implementation.
- Control state (switch positions, lever detents) lives in the aircraft-state model, **not** in the DOM, so Playwright and engine tests can drive it without gestures.

### Deployment: GitHub Pages via Actions

- Settings > Pages > Source = **GitHub Actions**.
- `vite.config.ts`: `base: '/procedure-trainer-da-50/'` (or `'./'`) for a project site; `'/'` only with a custom domain / user site. Always load assets through `import.meta.env.BASE_URL` / Vite asset imports, never absolute `/foo.png`.
- Add `typecheck`, `lint`, `test` (Vitest) steps before `build`; run Playwright against `vite preview` in a separate job (needs `npx playwright install --with-deps`).
- Node: use `node-version: 24` explicitly (the guide uses `lts/*`; pin so Vitest 5's engine range stays satisfied).
- Dependabot/Renovate: **ignore TypeScript major updates** so the repo is not auto-bumped to 7.x while typescript-eslint cannot use it.

### License-key / gating options on static hosting (design now, implement later)

- Define two interfaces: `EntitlementProvider { canAccess(packId): Promise<boolean>; … }` and `PackRepository { listPacks(); loadPack(packId): Promise<string /*TOON text*/> }`. UI asks the provider; only `PackRepository` knows where bytes come from. v1 implementation: `FreeEntitlements` (always true) + a repository over `import.meta.glob` lazy chunks (one chunk per pack folder).
- Store pack metadata (id, title, free/paid flag, scenario count) separately from pack content so a locked pack can be listed without loading its scenarios.

## Installation

# Scaffold (manual; do not use `npm create vite` templates, they may pull a different TS major)

# Core (runtime)

# Dev

# Browsers for Playwright

# Later / optional

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Preact 11 + signals | Svelte 5 (+ vite-plugin-svelte 7.3.1) | Team prefers compiled reactivity/`.svelte` files; accept svelte-check/TS-6 tooling constraint |
| Preact 11 + signals | Vanilla TS + tiny pub/sub | Panel proves to be the only UI and screens are trivial; maximal bundle minimalism |
| Preact 11 + signals | React 19 | Hiring/ecosystem reasons only; none apply here |
| Preact 11 | Preact 10.29.x | A library you need does not yet support Preact 11 |
| Pure-TS reducer engine | XState 5.33.3 | Reactions evolve into hierarchical/parallel statecharts coded by developers, not authored in TOON |
| `@toon-format/toon` 4.4.0 | A hand-written parser for the TOON subset | Only if the Working Draft spec churn makes the pinned library unmaintainable; the conformance corpus makes a swap safe |
| Zod 4.6.7 | Ajv 8.20.0 | JSON Schema is the hand-maintained source of truth, or schema shared with non-TS tooling |
| TypeScript 6.0.x | TypeScript 7.0.2 (native) | Optional faster `tsc` type-check only: install as an extra alias (`"@typescript/native": "npm:typescript@^7.0.2"`) while `typescript` stays 6.x for tooling. Not worth it for a project this size. |
| Custom viewBox pan/zoom | @panzoom/panzoom 4.6.2 | Gesture arbitration turns out simple and you want to save time |
| Vitest + Playwright | Vitest Browser Mode (`@vitest/browser-playwright`) | If component tests in a real browser are wanted; not needed initially |
| Edge function gating | Encrypted packs (static) | Want zero infrastructure and accept shared-key leakage risk |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| TypeScript 7.x as the project's `typescript` | No programmatic API; typescript-eslint peer is `<6.1.0`; Svelte/Volar tooling also stays on 6.0 | `typescript@~6.0.3`; optionally alias 7 for `tsc` only |
| `npx tsc` ambiguity with aliases | Probe finding: aliasing both `typescript` -> `@typescript/typescript6` and a second `typescript@^7` package leaves `.bin/tsc` pointing at a 6.x compat shim, so the "TS 7 check" silently ran 6.0.3 | Simply pin TS 6.0.x; if TS 7 is wanted, call its binary by explicit path |
| XState for TOON-driven scenario grading | Needs a TOON-to-machine compiler; not an FSM-shaped problem | Pure-TS reducer + virtual clock |
| `eval` / `new Function` / expression strings in scenario files | Security and author-error surface; unreviewable by non-developers | Declarative condition DSL validated by Zod |
| Real timers (`setTimeout`) inside the engine | Non-deterministic tests, impossible replay for debrief | Tick events with injected clock; UI drives ticks |
| Floating TOON versions, the library encoder on scenario files, tabular rows | The spec is a Working Draft; the encoder drops comments; tabular rows and root arrays are outside the supported subset | Exact pin `@toon-format/toon` 4.4.0 + conformance test; hand-written files |
| Build-time scenario plugins for TOON | Build-time parse bypasses line-number errors and the encrypted-pack path | `?raw` glob + runtime `@toon-format/toon` + Zod, with CI validation test |
| React Router / History-API routing | GitHub Pages 404s on refresh | State-based screens, or hash routing |
| Canvas or WebGL for the panel | Not resolution-independent via CSS, no DOM hit-testing/a11y, more code | SVG |
| Heavy SVG pan/zoom libs (`svg-pan-zoom`, `panzoom`) | Old; conflict with per-control drag | viewBox manipulation (or `@panzoom/panzoom` as fallback) |
| Committing paid pack plaintext to the public repo | Defeats any paywall regardless of client-side gating | Private source repo -> CI builds ciphertext/edge-served packs |
| `100vh` for full-screen panel | Mobile Safari URL-bar jump | `100dvh` |
| Hover-only affordances / mouse-only events | Tablets and phones | Pointer Events, visible focus/pressed states |
| Hard-coding a freemium paywall into UI components | Makes later gating a refactor | `EntitlementProvider` / `PackRepository` seam from day one |

## Stack Patterns by Variant

- Add a Cloudflare Worker (or similar) behind `EntitlementProvider`, validating Lemon Squeezy/other license keys and serving pack text.
- Because Pages cannot enforce anything; everything else in the stack is unchanged.
- Encrypted packs (AES-GCM via Web Crypto) + passphrase delivered post-purchase.
- Because it is fully static and removes casual copying without infrastructure.
- Add an in-app "load scenario file" (file input / drag-drop) running the same `@toon-format/toon` + Zod pipeline and showing line-numbered errors.
- Because the validator is already isomorphic; this is a very cheap, high-value authoring feature.
- Add `vite-plugin-pwa` 2.0.0 and precache app shell + free packs.
- Because the app is entirely static.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| vite@8.3.4 | node `^20.19 \|\| >=22.12` | Rolldown-based; `esbuild` peer is optional |
| vitest@5.0.5 | vite `^6.4 \|\| ^7 \|\| ^8`; node `^22.12 \|\| ^24 \|\| >=26` | Node 20 unsupported |
| @preact/preset-vite@2.10.6 | vite 2.x-8.x, `@babel/core` 7 | Verified building with Vite 8 |
| @preact/signals@2.11.3 | preact `>=10.25 \|\| >=11.0.0-0` | OK with Preact 11 |
| preact@11.0.1 | - | Probe: builds, type-checks (`jsxImportSource: preact`), 33 KB gz with other deps |
| typescript-eslint@8.71.2 | typescript `>=4.8.4 <6.1.0`; eslint `^8.57 \|\| ^9 \|\| ^10` | Hard blocker for TS 7 |
| eslint@10.13.0 | node `^20.19 \|\| ^22.13 \|\| >=24` | Flat config only |
| @sveltejs/vite-plugin-svelte@7.3.1 | vite `^8`, svelte `^5.46.4` | Only if Svelte chosen |
| @playwright/test@1.64.1 | node >= 20 | Install browsers with `--with-deps` in CI |
| vite-plugin-pwa@2.0.0 | vite up to 8, workbox ^7.4.1 | Later phase |
| zod@4.6.7 | TS 5+ strict | `z.toJSONSchema`, `z.strictObject` used in probe |

## Sources

- npm registry (`npm view`, 2026-10-19) - all versions, `engines`, `peerDependencies`, dist-tags above. HIGH.
- Probe project (Vite 8.3.4 + Preact 11.0.1 + preset-vite 2.10.6 + signals + Zod 4.6.7 + Vitest 5.0.5 + ESLint 10.13 + typescript-eslint 8.71.2 + TS 6.0.3): build, type-check, type-aware lint and test passed. HIGH. The TOON parser (`@toon-format/toon` 4.4.0, strict decode with line-numbered errors) was adopted in phase 2 (decision D-19); see the phase 2 research.
- Microsoft TypeScript 7.0 announcement - https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/ (no API in 7.0, API expected in 7.1, `@typescript/typescript6` alias, new defaults/hard errors). HIGH.
- Vite static deploy guide - https://vite.dev/guide/static-deploy.html (GitHub Pages workflow, `base`, pinned action SHAs/versions). HIGH.
- GitHub Releases API (checkout v7.0.1, setup-node v7.1.0, configure-pages v6.0.0, upload-pages-artifact v5.0.0, deploy-pages v5.0.1). HIGH.
- XState setup/TypeScript docs - https://stately.ai/docs/setup (setup() typing pattern; typegen dropped in v5). MEDIUM (rationale for not using it is own judgment).
- Lemon Squeezy License API docs - https://docs.lemonsqueezy.com/api/license-api and live curl CORS probe (OPTIONS 204 + `access-control-allow-origin: *`; POST validate returns JSON). HIGH for API shape/CORS; LOW for post-Stripe-migration license-key future (vendor-competitor blog sources, e.g. https://fungies.io/lemon-squeezy-stripe-acquisition-saas-founders-2026/).
- MDN SubtleCrypto.verify - https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify (Ed25519 listed; per-browser Ed25519 support not confirmed). MEDIUM.
- Gumroad license verify: documented as POST without auth, browser CORS not confirmed (curl probe returned no response). LOW.
- Cloudflare Worker specifics: general knowledge, not exercised. LOW-MEDIUM.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

- **Counts are derived, never literals.** Inventory counts (controls, lamps, regions, plates, breakers) come from independent reference tables in `tests/` (`tests/layout-reference.ts`, the label and review tables) and are compared with the registry; a changed number is a data edit plus a table edit, not a literal in a spec. Panel space is 2180 x 1300 (`VIEWBOX` in `src/aircraft/da50rg/panel.ts`, mirrored as `PANEL_VIEWBOX` in the test reference).
- **Data-driven registry.** A control is data with a `kind` (`toggle`, `guarded-toggle`, `guard`, `detent-lever`, `momentary-button`, `rotary`, `circuit-breaker`) and a skin; widgets, hit footprints, labels and tests read the registry. Controls, lamps, regions and plates are added by data, not by widget code. Control state lives in the store, never in the DOM.
- **Owner rules (G-0).** Static labels only: no text on the panel changes with a control state (state shows by position or lamp only; a pulled breaker shows a raised cap and a white ring, no IN/OUT text). A lamp exists only where the original has one. Parts stay inside their plates. Every label that is not known for sure is listed in `docs/PANEL-LABELS.md` and `docs/PANEL-REVIEW.md`.
- **Brand rule.** The panel reads GO-AROUND (not the maker name), no real maker names on the panel, no RUBIN mark; DA50RG is kept. Gated by `tests/brand.test.ts`, `tests/panel-shell.test.ts`, `e2e/brand.spec.ts`.
- **No real photos or AFM text committed.** Reference photos and the AFM live in `.input/` (private, git-ignored); documents describe layout facts only and refer to photos by short name (see `docs/CONTENT-POLICY.md`).
- **Gesture contract (PNL-15).** A control acts on release. A single click or tap never zooms; a double click or double tap zooms into the region and, while zoomed, fully out. On a latching control the first tap actuates and the recognised pair (350 ms, 24 px, same control) retracts it from the log. Slops: 10 px touch and pen, 5 px mouse, then the press becomes a pan; a second finger pinches, also over controls. Momentary buttons commit after 100 ms held still and never zoom; drag controls (lever handles, knob bodies) start at 4 px. Only the main mouse button operates controls.
- **Tests.** Vitest (`tests/*.test.ts`, node environment) holds layout, reference-table and static-text gates plus pure engine and arbiter cases. Playwright specs in `e2e/` hit the production build; specs that read `window.__panel` carry `@hooks` in the title (the hook exists only in the e2e build, `VITE_TEST_HOOKS=1`) and are excluded in live mode (`PW_BASE_URL`). `PW_PORT` selects the preview port for parallel worktrees. Waiting between two quick taps on one control uses the shared pair-window helper.
- **Scenario files.** TOON format 1 under `scenarios/<pack>/`, one `pack.toon` per pack, hand-written (the library encoder drops comments). `npm run validate` checks every pack against the schema and the control registry and prints `file:line:col: message`; the CI runs it and the unit tests load every shipped file, so a bad scenario file fails the build, not the user. Content limits are in `docs/CONTENT-POLICY.md`; grading rules in `docs/GRADING.md`.
- **Physics arithmetic.** Pure engine, aircraft and scenario code uses only `+ - * /`, clamping and quantising to the quantity's resolution, so a live run and a replay agree to the last digit; ESLint forbids `Math.random`, `Math.exp`, `Math.pow` and the exponent operator there. Randomness enters only as a seed drawn by the UI and recorded with the run (`mulberry32`, integer arithmetic).
- **Git.** Phase branches `gsd/phase-NN-slug`; Conventional Commits with the plan id as scope for plan work (`feat(01.1-37): ...`, `test(...)`, `docs(01.1-41): ...`), `fix(panel): ...` for review fixes; planning documents under `.planning/`. Nothing is pushed by agents; publishing is the owner's step.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

- `src/engine`: pure TypeScript, no framework, no clock, no timers. `registry.ts` (control and region definitions, validation by `defineRegistry`), `store.ts` (`PanelStore`: `dispatch`, append-only event log, `deriveState`, `retract` of the newest event, `markConsumed` watermark (raised by the run when a reaction fires), `onRetract`), `indicators.ts` (lamps derived from control state), `rotary.ts` and `detents.ts` (knob and lever geometry). Phase 2 added `predicates.ts` (the closed predicate vocabulary: state, state_in, travel, travel_rel, quantity, band), `quantities.ts` (named readings with ranges and colour bands), `cas.ts` (rule-derived annunciations), `grading.ts` (`grade` and `branchStatuses`: a pure replay of the recorded log into PASS or FAIL with step, branch, order and harmful-action detail; rules in `docs/GRADING.md`), `clock.ts` (virtual clock, advanced by the UI only), `env.ts` (the aircraft a scenario is checked against), and in `store.ts` the scenario baseline and `reset` (a run starts without a single event). Phase 3 added `physics.ts` (the generic model and reaction types and `definePhysics`; the models themselves are aircraft data), `sim.ts` (`STEP_MS` 100, the pure stepper `stepSim`, `simulate`, hold timers and outcomes, `mulberry32` and the seeded onset), `run.ts` (the live `Run`: the virtual clock plus the simulation over the store log; it calls `markConsumed` when a reaction fires and rebuilds by replay when an applied event is retracted), the `code-entry` control kind in `registry.ts` (the transponder keys) and the rotary skin `selector-bar`; `grading.ts` now replays `simulate` (outcome, reaction time from the onset).
- `src/aircraft/da50rg`: the DA50 RG panel as data. `panel.ts` (viewBox, 33 regions, device profiles, registry assembly), `controls/*` (95 controls by family: lights, de-ice, engine, gear-flaps, pedestal, switch-bank, under-panel, knobs, buttons, mfd, breakers, squawk), `indicators.ts` (13 lamps), `plates.ts`, `placards.ts`, `bus-boxes.ts`, `avionics.ts` (inert PFD/MFD columns, audio panel, standby EFIS, autopilot panel). Phase 2 added `quantities.ts`, `cas.ts` (the CAS rule table) and `aircraft.ts` (`DA50RG_ENV`, the environment scenarios are checked and graded against). Phase 3 grew them: `quantities.ts` holds fourteen quantities (the twelve MFD gauges, the hidden `alt2_amps` and `battery_pct`) plus the hidden fire quantity, each with unit, range, base (the cruise equilibrium) and bands; `physics.ts` holds a model for every quantity, the scenario parameters (`oil_cooling`, `alt1_output`, `engine_fire`), the electrical bus, the fire model, the fuel cut of the FUEL selector and the de-ice MAX reaction; `cas.ts` has three rules (ENG OIL TEMP, OIL PRES, ALTN 1 FAIL); `controls/squawk.ts` is the simplified transponder `kp.squawk`, the FUEL selector `sw.fuel_valve` is in `controls/knobs.ts` and the ECS SHUTOFF `lv.ecs_shutoff` (skin `pull-ecs`) in `controls/under-panel.ts`.
- `src/ui`: Preact and signals. `bridge.ts` connects store to signals (and the test hook), `App.tsx`, `about/`. `panel/`: `Panel.tsx`, `PanelShell.tsx` and `BusPanelArt.tsx` (static art), `widgets/` (one per kind), `skins/` (shapes), `frames/` (glass and avionics art), `press-arbiter.ts` (pure press machine), `press-targets.ts`, `tap-intent.ts` (slops and pair decision), `zoom.ts` (pointer glue, view signal, Full panel corner), `viewport.ts` (pure zoom, pan, pinch and footprint maths), `session-area.ts` (the session pad in the co-pilot legroom: NEW SITUATION and CHOOSE SITUATION). The session layer: `session.ts` (the screen machine free, choosing, briefing, running, debrief; start, complete and leave a run, a run completes itself when an outcome fires; also the level, easy, medium or realistic, asked on its own card before the briefing (`levelPicked`) and never an input of `grade`; no DOM), `clock-driver.ts` (real frames into whole 100 ms simulation steps with a remainder carry, paused by a hidden tab or an open modal), the run (`session.run`), the bridge's `quantities` and `flags` signals fed by every run step, the level Realistic (no briefing, a seeded onset, recorded with the run; the level is still never an input of `grade`) in `session.ts`, `modals.ts` and `screens/` (the shared modal shell with its input shield, first-run acknowledgment in `ack.ts` and `Ack.tsx`, `Briefing.tsx`, `Debrief.tsx`, `Confirm.tsx` for leaving a run, load error and empty states), `outline.ts` with `screens/ChecklistOutline.tsx` (the recursive checklist outline: the briefing form lists the checklist with the panel steps, the debrief form adds tags, verdicts and order lines) and `debrief-text.ts` (the pure copy rules: reason lines, order lines and harmful rows, no clock text).
- `src/scenario`: the scenario layer, pure TypeScript. Scenario files are TOON text under `scenarios/<pack>/` with a `pack.toon` manifest per pack. `schema.ts` (Zod format 1), `parse.ts` (strict decode plus schema, issues with line and column), `toon-index.ts` (path to line and column), `lint.ts` (`checkScenario`: cross-references against the aircraft environment; it also rejects a scenario a do-nothing run would pass, L11), `packs.ts` (the pack seam: `PackProvider` and `AccessPolicy`, `listPacks`, `openScenario`), `packs-vite.ts` (the only module that globs scenario files, one chunk per pack), `validate-all.ts` (the core of `npm run validate`) and `disclaimers.ts`. Phase 3 added to the format (still format 1, every new section optional or empty by default) `parameters` (lint L12), `outcomes` (L13) and `onset` (L14); packs `engine` (ENG OIL TEMP, ENGINE FIRE) and `electrical` (ALTN 1 FAIL). No scenario fact (id, step, control id of a step, CAS message or threshold) may appear in `src/engine`, `src/scenario` or `src/ui`: `tests/blueprint.test.ts` derives the list from the shipped scenario and fails the build.
- Since Phase 3 the quantities are simulated during a run (fixed 100 ms steps; a run starts with the base values on Realistic and with the scenario's values on Easy and Medium), ignored failures escalate to a named outcome that ends the run as FAIL, and handled failures recover. The simulation runs only during a scenario run: the free panel shows static base values. Steps and forbidden items stay control-only; end states with physics are Phase 4. Deferred engine behaviours (ANNUN-TEST, the WIND SHIELD spray, the ICE LIGHT effect, the ELT lamp, the other breaker effects, a simulation on the free panel) are in `.planning/todos/pending/`.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
