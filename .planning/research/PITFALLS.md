# Pitfalls Research

**Domain:** Web-based cockpit procedure trainer (interactive SVG panel, TOON-authored scenarios, action-order grading, static hosting on GitHub Pages, later paid scenario packs)
**Researched:** 2026-10-19
**Confidence:** MEDIUM overall. GitHub Pages terms/limits verified against official docs (HIGH). Garmin trademark position only partly verified (MEDIUM: Garmin manuals state marks may not be used without express permission; no simulator-specific policy found). Touch/SVG, grading, and schema pitfalls come from established engineering practice and domain reasoning (MEDIUM). Legal items are not legal advice and need a lawyer before monetization.

Phase labels below assume a roadmap shaped roughly as:
- P1 Foundations (repo, Vite/TS, deploy pipeline, schema + engine core)
- P2 Panel and interaction (SVG panel, controls, responsive/touch)
- P3 Scenario engine and grading (state machine, reactions, debrief)
- P4 Content and authoring (TOON pack, validation tooling, AFM sourcing)
- P5 Polish, legal, release (disclaimers, a11y, QA on devices)
- P6 Gate and monetization (access layer, license keys, packs)
Adjust names to the actual roadmap; the mapping is what matters.

## Critical Pitfalls

### Pitfall 1: Grading logic hard-wired to a flat "list of actions" instead of a state-based model

**What goes wrong:**
Grading is implemented as "did action X appear in the event log, in the right position". Real emergency checklists do not fit: the same switch can be toggled several times, a lever can be moved through intermediate positions, an action may already be satisfied by the initial state, "ALTERNATOR - OFF then ON" is a sequence on one control, and some actions are only meaningful relative to a condition ("if fire persists"). Users get marked wrong for correct behavior (or right for harmful behavior), and trust in "accurate, objective feedback" (the Core Value) collapses.

**Why it happens:**
The event-log model is the simplest thing that works for 3 demo scenarios. The edge cases appear only when authoring the 4th–10th scenario or when a real pilot tries it.

**How to avoid:**
- Define each action as a predicate on control state, not as a click event: `{control: fuel_shutoff, state: CLOSED}`. An action is "satisfied" at the first moment the predicate becomes true after the scenario's action window opens.
- Decide and document explicitly, in a grading spec, the semantics for: (a) predicate already true at scenario start (treat as pre-satisfied vs. requires "touch"; recommend per-action flag `must_actuate`), (b) toggle-away-and-back (last-state-wins for state predicates; but record for forbidden actions that ANY transient entry into a forbidden state counts), (c) intermediate lever positions (use discrete detents in the model, never continuous values for graded controls), (d) repeated actions (idempotent), (e) actions on a sibling control that achieve the same state (e.g. two ways to shed load), (f) timing windows (relative to annunciation, not scenario start), (g) conditional branches ("IF smoke persists...").
- Order constraints: model as a partial order (groups: `ordered`, `unordered`, `any_of`), evaluated on the first satisfaction timestamp of each action. Prefer "A before B" pairwise constraints scored per pair, rather than whole-sequence equality, so a single swap yields one order violation, not N.
- Forbidden/harmful actions: record at the moment of entering the state, even if reverted; they are graded separately from "missing".
- Make the grader a pure function `grade(scenario, timeline) -> Debrief` with a golden-file test suite (one timeline fixture per edge case above). This makes grading verifiable without the UI.

**Warning signs:**
- Grader reads raw DOM/click events rather than the simulated state timeline.
- Author needs a code change to express "either of these two ways".
- Debrief says "missed" for something the pilot visibly did.
- Tests only cover the happy path per scenario.

**Phase to address:**
P1 (state-model decision) and P3 (grader + golden tests). Spec must be written before the first scenario is authored.

---

### Pitfall 2: Scripted reactions (timers + triggers) become nondeterministic and untestable

**What goes wrong:**
Timer-driven escalation ("temperature falls after actions, engine fails if ignored") is implemented with `setTimeout`/`setInterval` tied to wall-clock. Background tab throttling (browsers clamp timers to >=1 s, and intensive throttling after ~5 min hidden), phone lock/sleep, and tab switch cause the scenario to either freeze or jump forward and escalate unfairly. Exam mode grading becomes dependent on device performance. Race conditions arise when a user action and a timer fire in the same tick. Cyclic trigger chains (A triggers B triggers A) hang the engine.

**Why it happens:**
Scenarios are modeled as "real time" because that is how the aircraft behaves, and the engine is written against browser timers directly.

**How to avoid:**
- Drive the scenario from a single injectable clock (`now()` via `requestAnimationFrame` delta or an explicit tick) with a deterministic event queue; never call `setTimeout` from scenario logic. Use monotonic time (`performance.now()`), not `Date.now()`.
- Pause the sim clock on `visibilitychange`/`pagehide` (and show a "paused" overlay), and resume without catch-up. Make this explicit in Exam mode (paused time does not count).
- Process the queue in a defined order (user actions first, then timers due at the same tick), and write that order into the schema docs.
- Validate reaction graphs at load time: detect cycles, unreachable reactions, and triggers referencing unknown controls/annunciators. Cap reactions fired per tick.
- Test scenarios with a headless simulated clock ("replay a timeline fixture") in CI.

**Warning signs:**
- `setTimeout` appears in scenario/engine code.
- "Works on my laptop, escalates instantly on the phone."
- Flaky tests that need real sleeps.

**Phase to address:**
P3 (engine). Clock injection must exist before any timers are authored; retrofitting is a rewrite.

---

### Pitfall 3: Scenario schema designed for the current three scenarios, then breaks on the fourth (and on non-developer authors)

**What goes wrong:**
Typical failures:
1. Schema too loose: free-form strings for control IDs/state values. Typos (`oil_temp_hi` vs `oil_temp_high`) silently produce a scenario that can never be completed or never fails.
2. Schema too tight: cannot express AFM idioms (memory items vs. checklist items, "if X then Y", multi-option branches, notes/warnings/cautions, conditional steps), forcing hacks and breaking changes.
3. No `schemaVersion`; a later change invalidates all community/paid packs.
4. TOON footguns for non-developers: numeric-looking strings (`issue: 018`, `1.10`) decode as numbers unless quoted, array counts `[N]` that do not match the rows, comments that are not full lines starting with `#`, indentation errors, duplicate keys. `OFF`/`ON` switch positions are extremely common in cockpits, so state values must stay enumerated strings. The format is a Working Draft spec, so an unpinned parser upgrade can silently change decoding.
5. Authoring errors are reported as a stack trace or a bare schema error without file/line.

**Why it happens:**
Schema authored top-down from the demo content; no thought to author tooling; parser defaults not examined.

**How to avoid:**
- Pin `@toon-format/toon` exactly (4.4.0) and run the decoder conformance test before any upgrade; decode in strict mode so array counts must match; reject duplicate keys; quote numeric-looking strings (`issue: "018"`). Better: make panel state values enumerated strings (`state: "OFF"`) and require them by schema (string type), so an accidental number or boolean fails validation loudly. Never auto-format scenario files with the library encoder (it drops comments).
- Define the schema once in TypeScript (e.g. Zod or Valibot); the TS type is inferred from it, and a JSON Schema can be emitted as a documentation artifact (there is no editor schema support for TOON). Single source of truth; avoid maintaining a hand-written JSON Schema and a separate TS type.
- Cross-reference validation beyond the schema: every control/annunciator/gauge ID must exist in a **panel registry**; every action target state must be a legal state of that control; every `after`/`group` reference must resolve; every required action must be reachable (not blocked by a forbidden precondition). Produce errors with file, line/column, and a "did you mean" suggestion.
- Ship a CLI/`npm run validate:scenarios` that runs in CI and as a pre-commit hook; run the same validator at load time in dev with a visible error overlay.
- Include `schemaVersion` from day one plus a migration policy; keep scenario content separable from engine version.
- Add first-class fields for AFM idioms up front, even if v1 UI uses few: step type (`memory`/`checklist`/`note`/`warning`), `condition`, `any_of`, `source` (document, revision, section/page), `disclaimer`, `lastReviewed`.
- Write the schema docs with a "scenario authoring guide" and one fully-annotated example; test the guide by having someone non-technical author a scenario.

**Warning signs:**
- A scenario loads without error but cannot be completed.
- Authors keep asking "what are the valid control names?".
- Schema changes touch every scenario file.
- TOON containing unquoted numeric-looking strings or state values that are not enumerated strings.

**Phase to address:**
P1 (schema design + parser choice), P4 (validation CLI, authoring guide, error UX). Panel registry must exist in P2 before cross-ref validation is complete.

---

### Pitfall 4: Panel controls and scenario IDs coupled to SVG structure instead of a model

**What goes wrong:**
Control state lives in the DOM/SVG (class names, `transform` attributes). Scenarios reference SVG element IDs exported from a design tool (Inkscape/Figma/Illustrator auto-generated IDs like `g1234`, `path-5`). Re-exporting the panel renames IDs, collapsing every scenario. Rendering and state are interleaved so tests need a browser, and the gate/grading layers cannot reuse the state model.

**Why it happens:**
It is quick to "just toggle a class on the element". Design-tool export is treated as the source of truth.

**How to avoid:**
- Separate the three layers: **panel definition** (registry: control ID, type, legal states, detents, label), **aircraft state store** (plain TS, no DOM), **SVG view** (binds stable `data-control-id` attributes to the store, renders from state). Scenarios and grader only know registry IDs.
- Set stable semantic IDs in the SVG source; add a build/CI check that every registry ID has exactly one SVG element and vice versa (fail on missing/duplicate).
- Optimize/export SVG with a deterministic pipeline (SVGO configured with `cleanupIds` off or an ID whitelist) so exports do not rename IDs.
- Prefer hand-structured SVG (or programmatically generated from the registry) over a single huge exported blob for interactive elements.

**Warning signs:**
- Scenarios contain strings like `g3829`.
- Re-saving the SVG in the editor breaks tests.
- Controls "reset" themselves after re-render.

**Phase to address:**
P1 (layering decision), P2 (registry + ID audit).

---

### Pitfall 5: Touch/mobile interaction on a dense SVG panel is treated as "mouse events that also work on touch"

**What goes wrong:**
- Tiny hit targets: real switches/buttons are a few mm; scaled to a phone they are ~10 px. Wrong switches get toggled (and, in Exam mode, graded as harmful actions).
- Using `click` + `mouseenter`/`mousedown` handlers: 300 ms delay, double-tap-zoom triggers, ghost clicks, `hover` states stuck on touch.
- Levers/knobs (throttle, prop, mixture, cowl flap) that need drag are implemented with mouse events; on touch the page scrolls/pans instead, or pinch-zoom fights the control. iOS Safari ignores `touch-action` on some SVG elements historically and needs the attribute/style applied to the HTML container; pointer capture on SVG children can behave inconsistently.
- Panel pan/zoom (needed on phones) conflicts with control gestures: a drag on a lever vs. a drag to pan. Accidental actuation during pan.
- Coordinate math wrong when SVG is scaled via `viewBox`/CSS: use `getScreenCTM().inverse()` conversion; naive `offsetX` breaks under scaling/rotation/nested transforms.
- Hit area equals the visual glyph only; thin strokes (gauge needles, guard covers) are hard to hit. `pointer-events` default on SVG hits only painted areas, not transparent holes.
- Orientation change, address-bar collapse on iOS (`100vh` bug), and safe-area insets (notch) cause the panel to resize mid-scenario; `resize` handlers recompute layout and lose drag state.
- Disabled text selection/long-press callout/context menu not suppressed: long-press on a button opens iOS magnifier or "Save image".
- No haptic/visual confirmation of a touch actuation, so users double-tap and toggle twice.

**Why it happens:**
Development and testing occur on desktop with mouse; the phone requirement is validated only by responsive devtools emulation, which does not reproduce real touch quirks.

**How to avoid:**
- Use Pointer Events (`pointerdown/move/up/cancel`) exclusively, with `setPointerCapture`, and `touch-action: none` on interactive controls and `touch-action: manipulation` elsewhere (kills double-tap zoom). Handle `pointercancel`.
- Provide an invisible, oversized hit rect for each control (minimum ~44x44 CSS px *after* scaling; verify at the smallest supported zoom). Do this in the registry/view layer so it is uniform.
- Define an explicit interaction model for small screens: **mode toggle** between "pan/zoom the panel" and "operate controls", or auto-zoom to a panel region on tap ("zoom to engine controls"), or a dedicated region-based layout (engine panel / avionics / overhead). Do not rely on a single gesture to both pan and actuate.
- For levers: detent-based with tap-to-select-position or drag with snapping; large drag handle; discrete states match the grading model (Pitfall 1).
- Convert coordinates with `SVGGraphicsElement.getScreenCTM()`; unit test the math under scale/offset.
- Use `100dvh`/`svh`, listen to `visualViewport`, debounce resize, and preserve state across resize.
- Add `-webkit-user-select: none; -webkit-touch-callout: none;`, prevent context menu on the panel.
- Add an "undo last action"/confirm for guarded controls in Training mode only; never in Exam.
- Provide clear pressed/state feedback (and optional `navigator.vibrate`, noting iOS Safari does not support it).
- Test on real iPhone Safari, iPad Safari, and Android Chrome from the first interactive phase. Add Playwright projects with WebKit and touch emulation, but treat them as supplementary.

**Warning signs:**
- Code uses `onclick`/`mousedown`/`mouseover`.
- No `touch-action` CSS anywhere.
- "It works in Chrome devtools mobile mode."
- Misclick reports in Exam mode; users pinch-zooming the whole page.

**Phase to address:**
P2 (interaction model chosen before building controls; retrofit is expensive). Real-device QA gate in P2 exit criteria and again in P5.

---

### Pitfall 6: SVG performance and rendering problems on phones and during gauge animation

**What goes wrong:**
A detailed panel exported from a design tool is a multi-MB SVG with thousands of nodes, filters (blur, drop-shadow), masks, and gradients. Mobile Safari stutters or crashes; gauge needle animations using CSS `transform` on SVG elements without `transform-box`/`transform-origin` set rotate around the wrong point (differing behavior between browsers, historically Safari/Firefox); `filter` and `mix-blend-mode` on SVG are expensive. Text rendering differs by platform fonts, shifting layout of annunciator text.

**Why it happens:**
Focus on visual fidelity; no budget or profile on mid-range phones.

**How to avoid:**
- Set a size/complexity budget (e.g. < 300 KB gzipped for panel SVG, < ~2k nodes, no filters/blur on interactive layers); enforce in CI (SVGO + a size check).
- Animate with `transform` on `<g>` using explicit `transform-box: fill-box; transform-origin: center` (or rotate via the `rotate(angle cx cy)` attribute), and update only the elements whose state changed (render from state diff, not whole-panel re-render). Use `requestAnimationFrame`, avoid layout thrash.
- Embed fonts (or convert annunciator text to a webfont subset such as a monospace-style font under a clear license) rather than relying on system fonts; check font license for redistribution.
- Split static background (rasterized or flattened) from interactive/animated layers.

**Warning signs:**
- First paint > 2 s on mid-range Android; fans spin on desktop during idle.
- Needle rotates around the SVG origin (0,0) in Safari.

**Phase to address:**
P2 (budget + animation pattern), P5 (profiling pass).

---

### Pitfall 7: AFM content copyright, accuracy, and revision drift

**What goes wrong:**
- The AFM (Airplane Flight Manual) is a copyrighted document of Diamond Aircraft (and EASA-approved content). Copying checklist text verbatim into a public GitHub repo and later selling it inside paid packs is a copyright/commercial-use risk that is **not** solved by a per-scenario "source" field. "User enters it, user is responsible" does not hold once the product owner publishes the repo and sells packs: the publisher is the distributor.
- Procedures vary by AFM revision, serial number range, installed equipment, and avionics (G1000 NXi software version). A scenario is silently outdated after a revision; pilots then train a wrong procedure. Liability and reputation risk.
- Procedures are altered (shortened, "simplified") for the quiz UI and no longer match the AFM, while still labeled as AFM-derived.
- Paying customers may assume content is Diamond-approved.

**Why it happens:**
Domain-expert content flow ("I copy from my AFM") is treated as the author's private matter; legal review is deferred until monetization, by which time the repo history is full of AFM text.

**How to avoid:**
- Treat verbatim AFM text as a legal risk item now. Options, in order of preference: (1) write scenarios as the author's own paraphrase/structured action description (control + target state) rather than copying checklist prose; (2) obtain written permission/licence from Diamond Aircraft for the text and for use of the name; (3) keep AFM-verbatim text out of the public repo (private content repository/pack loaded separately), at minimum for any paid pack. Facts (which switch to which position) are generally less protected than the expression, but this is a jurisdiction-dependent point to confirm with a lawyer (flag for legal review before P6).
- Mandatory per-scenario metadata: `source.document`, `source.revision`/date, `source.section`, `appliesTo` (aircraft/serial/avionics), `lastVerifiedBy`, `lastVerifiedDate`. Show source and revision in the debrief and on the scenario start screen.
- Show a persistent "Training aid only. Always follow the current approved AFM and your instructor." notice at app start, in the debrief, and in the footer; require an acknowledgement on first use (stored locally). Keep ToS/disclaimer text reviewed by a lawyer before monetization.
- Include a scenario-level `status: draft|verified`; the app hides/labels draft scenarios; CI fails if a scenario in a release pack lacks source/revision.
- Provide a "report an error in this procedure" link (GitHub issue template or mailto) and a changelog of content corrections.
- Never imply endorsement: "not affiliated with or endorsed by Diamond Aircraft."

**Warning signs:**
- TOON files contain long verbatim AFM paragraphs.
- Source field is a free text "AFM".
- No revision stated anywhere in the UI.
- Repo is public while content is paid.

**Phase to address:**
P1 (decide content policy before any AFM text enters the repo/git history; rewriting history is painful), P4 (metadata enforced in schema), P5 (disclaimer UX), P6 (legal review gate before any sale).

---

### Pitfall 8: Trademark/IP exposure through panel imagery and naming (Garmin G1000 NXi, Diamond)

**What goes wrong:**
- Reproducing Garmin screens/bezels (PFD/MFD layouts, softkey labels, G1000 logo, "NXi" branding) or Diamond's logos and DA50 cockpit photographs/line art in the panel, even if "functional layout", can draw takedown/C&D notices, especially once monetized. Garmin's published position is that its trademarks may not be used without express permission; no permissive simulator-use policy was found (so do not assume one exists). Official AFM/POH figures and Garmin pilot's-guide screenshots are copyrighted.
- Using Garmin-derived assets or traced screenshots as the SVG basis: tracing a copyrighted image does not remove the copyright.
- Product names: using "G1000", "NXi", "Diamond", "DA50" in the app title/domain/repo/store listing as if official. Using the aircraft model name descriptively ("for the DA50 RG") is typically defensible nominative use, but logos and stylized marks are not, and domain names/app names that suggest affiliation are risky.
- Assets bundled from third parties (icons, fonts, gauge artwork from sim communities, MSFS/X-Plane assets) with incompatible licences.

**Why it happens:**
Realism is tempting; images are found on the web; "functional layout only" is stated as policy but not enforced in the asset workflow.

**How to avoid:**
- Hard rule: all panel artwork is original (generic glass-display placeholder with generic fonts/colors). Do not trace screenshots. Name displays generically ("PFD", "MFD"/"ENGINE"), avoid Garmin logos, softkey layouts copied one-to-one, and distinctive bezel designs.
- Keep a `docs/ASSETS.md` register: every asset, origin, licence, author; CI check that new files under `assets/` have a register entry. Prefer fonts under OFL.
- Add trademark attribution/disclaimer: "DA50, Diamond are trademarks of Diamond Aircraft Industries. Garmin and G1000 NXi are trademarks of Garmin Ltd. This product is not affiliated with, endorsed or sponsored by them."
- Do not use the aircraft maker's name in the product's brand/domain/app title; use a neutral brand (e.g. "<YourBrand> Procedure Trainer for DA50 RG"), with descriptive reference in the body text.
- If the product later wants real avionics fidelity, seek written permission before building it.

**Warning signs:**
- Designer asks for "a screenshot to trace".
- Repo/domain/title includes "G1000" or Diamond logo.
- Assets without recorded provenance.

**Phase to address:**
P2 (asset rules before art is created), P5 (attributions), P6 (naming/branding before launch/store listing).

---

### Pitfall 9: Client-side "license enforcement" on static hosting is bypassable, and the design pretends otherwise

**What goes wrong:**
- Paid scenario packs are shipped as static files in the same deploy (`/packs/pro.toon`) and "unlocked" by a client check (`if (hasKey) ...`). Anyone can fetch the file by URL, read it in DevTools, or view the repo (public Pages repos expose everything). A hardcoded key/validation algorithm in the JS bundle is reverse-engineered in minutes; key generators (HMAC with secret in the client) leak.
- Locked content "hidden" via CSS/obfuscated JS is not locked.
- Licence state in `localStorage` is trivially editable and also lost on cache clear/Safari ITP (7-day cap on script-writable storage for some contexts), annoying legitimate buyers who lose their unlock.
- Free Pages plan requires a public repo: all content, including future paid packs, is public in git history. Once committed, it's in history permanently.
- Building DRM-like complexity (obfuscation, fingerprinting) wastes effort; the realistic threat is casual sharing, not determined attackers, and the market (pilots/flight schools) is small and honesty-driven.

**Why it happens:**
"Gate-ready" is interpreted as "write the check now" without a server to hold secrets.

**How to avoid:**
- Acknowledge in design docs: static hosting cannot enforce; the gate is deterrence plus honest-customer convenience. Choose the acceptable level of leakage up front.
- Architect the **access-check abstraction** as an async interface: `AccessProvider.canOpen(packId) -> Promise<Grant>` and `PackLoader.load(packId, grant) -> Promise<Pack>`. v1 implementation: `AllowAll`. Future: a tiny serverless endpoint (Cloudflare Worker, Netlify/Vercel function, Lemon Squeezy/Paddle/Stripe + webhook) that verifies a licence key and returns the pack (or a decryption key / signed URL) so the pack **is not in the public static output**.
- If staying fully static, use encrypted packs (AES-GCM via Web Crypto; the key derived from the licence key, PBKDF2/Argon2-style), with ciphertext publicly hosted: weak against key sharing but protects against casual URL fetch. Verify purchase-time keys with signatures (Ed25519: public key in the client, private key held only by seller's tooling), never HMAC with a shared secret in the client.
- Keep paid content out of the public repo from day one of authoring it: separate private repo/submodule, built into an artifact at deploy time (or served from a separate paid host). Free-pack content only in the public repo. Do not "plan to move it later".
- Plan licence recovery: email-based re-issuance, key re-entry, and a documented offline/PWA behavior. Do not rely on localStorage alone as the sole record.
- Do not process payments on GitHub Pages (see Pitfall 10); use a hosted checkout (Stripe Payment Links, Lemon Squeezy, Paddle, Gumroad) that redirects back or emails a key.
- Remember GDPR/EU consumer rules if selling to EU pilots (Diamond is Austrian/EU-centric): VAT/OSS, withdrawal-right waiver for digital content, privacy policy. A merchant-of-record (Paddle/Lemon Squeezy) removes most VAT burden.

**Warning signs:**
- Pack files in `public/` or the repo that's published.
- A function named `isLicenseValid(key)` containing a secret or a constant.
- "We will hide it with obfuscation."
- Unlock state only in `localStorage`.

**Phase to address:**
P1 (access abstraction interface and content repo separation), P6 (actual enforcement/provider). Decision on repo visibility must be made in P1.

---

### Pitfall 11 (placed here for numbering): GitHub Pages terms disallow commercial/e-commerce use

**What goes wrong:**
GitHub's official limits page states Pages is "not intended for or allowed to be used as free web hosting to run your online business, e-commerce site, or any other website that is primarily directed at either facilitating commercial transactions or providing commercial software as a service", and that sites should not handle sensitive transactions (passwords, card details). The project plans to sell scenario packs. Moving to monetization on the same Pages site risks being forced off the host (GitHub may stop serving the site) with live paying customers and a branded URL they bought into.

**Why it happens:**
Pages is chosen for v1 (fine for a free tool) and monetization is bolted on later without revisiting hosting.

**How to avoid:**
- Treat GitHub Pages as v1-free hosting only. Put the app behind a custom domain you own from the start (so the host can be swapped with a DNS change, no URL change, no broken bookmarks/licence links).
- Make the deploy host-agnostic (static `dist/` artifact; `base` config via env var). Plan the move to Cloudflare Pages / Netlify / Vercel / S3+CloudFront before the first paid pack. Payment must be handled by a third-party hosted checkout; the app only receives a key.
- Also be aware of soft limits: 1 GB site, 100 GB/month bandwidth, 10 min deploy timeout. Pack assets (audio, images) can hit these if packs grow; keep assets lean.

**Warning signs:**
- A "Buy" button appears in the Pages-hosted app with a forms/payment integration.
- Hard-coded `username.github.io/repo` URLs in docs, licence emails, or shared links.

**Phase to address:**
P1 (custom domain + host-agnostic build), P6 (migrate hosting before selling).

---

### Pitfall 10: GitHub Pages deployment gotchas (base path, SPA routing, caching)

**What goes wrong:**
- Project sites are served from `https://user.github.io/<repo>/`. Vite defaults to `base: '/'`, so JS/CSS/asset URLs 404 after deploy (blank page). Conversely, setting `base: '/<repo>/'` breaks local dev links if not mirrored in the router, and breaks again when switching to a custom domain at root.
- `fetch('/scenarios/oil-temp.toon')` with a leading slash ignores the base path and 404s in production. Same for images referenced in CSS/inline SVG `<image href>`, `<use href="/sprite.svg#id">`, and service worker scope.
- Dynamically computed asset URLs (e.g. scenarios discovered via string-built paths) are not rewritten by Vite and won't be included in `dist/`. TOON files placed in `public/` are not hashed or fingerprinted, so they are cached stale.
- SPA deep-links (`/scenario/engine-fire`) return GitHub's 404 page because Pages has no rewrite rules. Workarounds: hash routing (`#/scenario/...`), or a `404.html` that redirects to `index.html` (served with HTTP 404 status; bad for SEO and some crawlers, fine for an app). 404.html must be in `public/` to end up in `dist/`.
- Case-sensitivity: macOS/Windows dev is case-insensitive; Pages (Linux) is not. `Panel.svg` vs `panel.svg` works locally, 404s in prod.
- Jekyll processing: Pages runs Jekyll by default for branch-based deploys and ignores files/dirs starting with `_` (e.g. `_scenarios/`). Add `.nojekyll`, or deploy via the GitHub Actions workflow (recommended; `actions/upload-pages-artifact` + `actions/deploy-pages`), which also avoids the 10-builds/hour soft limit.
- Browser/CDN caching: Pages sends `Cache-Control: max-age=600`; after a deploy, users get a mix of old HTML and new hashed chunks or old scenario files. Lazy-loaded chunks of the previous build 404 for users with the old HTML open (white screen on navigation).
- Custom domain setup: the `CNAME` file must be in the deployed output (put it in `public/`) or the domain resets on each deploy; HTTPS enforcement takes time to provision.
- Service worker/PWA (if added for offline): caches stale builds; broken updates on iOS.

**Why it happens:**
It works at `localhost:5173/`; the first deploy is the first time base/path/caching questions are tested.

**How to avoid:**
- Decide on routing in P1: for a mostly single-screen trainer, use hash routing or no router (state-based views) to eliminate the 404 problem entirely. Only add the `404.html` redirect hack if pretty URLs are required.
- Set `base` from an env var (`VITE_BASE`), use `import.meta.env.BASE_URL` for all runtime URLs, and import scenario TOON files through Vite (`import.meta.glob('./scenarios/*.toon', { query: '?raw', eager: false })`, parsed at runtime; no build-time scenario plugin) so they get hashed and bundled instead of fetched from hard-coded paths.
- Deploy with GitHub Actions (not the `gh-pages` branch), include `.nojekyll` anyway, add `CNAME` to `public/`.
- Add a CI smoke test that serves `dist/` under a subpath (e.g. `npx serve` with a rewrite or Playwright against a static server mounted at `/<repo>/`) and asserts the app boots and a scenario loads. Also run a lowercase/case-sensitivity check (lint the file references on Linux CI).
- Include a build version/hash in the UI footer and a "new version available, reload" handler for chunk-load errors (`vite:preloadError` event).
- Keep sources under Pages size limits; no large video/audio.

**Warning signs:**
- Blank page with 404s for `/assets/index-*.js` on first deploy.
- `fetch('/...` anywhere in code.
- Scenario TOON in `public/` loaded by hard-coded URL.
- Users report "need hard refresh".

**Phase to address:**
P1 (deploy pipeline in the very first phase, deployed hello-world before features), P5 (cache/version handling).

---

### Pitfall 12: Training mode vs Exam mode leak: hints, checklist visibility, and feedback revealing answers

**What goes wrong:**
- "Checklist can be shown/hidden" implemented in the DOM: in Exam mode the hidden checklist is still in the DOM/devtools or in the JS state/console logs; scenario TOON (including required actions) is plainly downloadable. Not a security issue for training value (self-assessment), but it undermines credibility for flight-school use of "Exam mode" as an assessment.
- Subtle feedback leakage in Exam mode: annunciator/gauge reactions that only happen after the correct action (the panel itself gives the answer), button enabled/disabled states, sound cues, or a score counter; also the random scenario picker biasing repeats so users memorise the sequence rather than the procedure.
- Rote memorisation of click order vs. understanding: training value reduces if users can repeat the same scenario with identical random seeds.
- Training immediate-feedback that blocks natural slips: marking wrong action instantly and preventing continuation teaches a different procedure flow than the real world (where errors can compound).

**Why it happens:**
Mode is treated as a UI toggle rather than a first-class policy object.

**How to avoid:**
- Define a `ModePolicy` object (visibility of checklist, immediate feedback, hints, timer, retries, score display) consumed by UI; Exam disables all non-diegetic feedback.
- Acknowledge in docs that Exam mode is self-assessment (client-side; answers inspectable), not proctored; do not market it as certifying.
- Vary scenario parameters (initial values, which sub-fault) via schema-defined variants to reduce memorising; do not allow the engine to leak via console logging in production builds.
- In Training mode, let errors play out and show them in the debrief; offer an optional "hint" that costs points.

**Warning signs:**
- Mode-specific `if` statements scattered through components.
- Exam mode UI differs from Training only by hiding one panel.

**Phase to address:**
P3 (mode policy), P5 (QA of exam leak paths).

---

### Pitfall 13: Debrief that is technically correct but pedagogically misleading (or unsafe)

**What goes wrong:**
- Scoring that yields a "pass" while a critical memory item was missed or a harmful action was performed (e.g. 90% score after shutting off the wrong fuel/avionics). A percentage score hides criticality.
- Debrief ignores reasoning: shows "missed: Fuel selector OFF" without the AFM reference/step.
- Reaction timings (e.g. oil temp falls after action) look like a real aircraft performance model; pilots might infer real-world numbers or timings from a scripted simplification. Emergency-specific behaviour (time-to-fire-spread, glide distance) can mislead.
- Content misuse: someone uses the app as a substitute for type-rating training.

**Why it happens:**
Generic quiz scoring patterns reused for safety-critical content.

**How to avoid:**
- Weighted/severity-tiered grading: each action has `criticality: memory|critical|normal|optional`; any critical miss or any harmful action = automatic "not satisfactory", independent of percentage. Report categories separately (missed required, order violations, harmful, optional).
- Debrief lists each item with its AFM source/step reference and the user's actual timeline.
- State in the UI: "Scripted simplification; not a performance model. Timings and values are illustrative."
- Keep scoring terms neutral ("satisfactory/needs work"), not "certified".

**Warning signs:**
- Only one numeric score.
- Debrief lacks source references.

**Phase to address:**
P3 (grading output design), P4 (criticality authoring), P5 (disclaimers).

---

### Pitfall 14: Liability and disclaimer treated as boilerplate footer text

**What goes wrong:**
A single footer disclaimer, no ToS, no acknowledgment, no version/date; app displays anything as "official procedure". In the event of an incident or complaint, there is no evidence that users were warned, no limitation of liability, and for EU/DACH users, standard liability exclusions may be restricted by law (consumer law; mandatory liability for intent/gross negligence cannot be disclaimed). Monetization increases exposure (paid product = higher expectations).

**Why it happens:**
Disclaimers feel like legal chores; deferred to "before launch".

**How to avoid:**
- First-run acknowledgment modal (stored locally with version), persistent short disclaimer, and per-scenario source/revision shown (Pitfall 7).
- Draft Terms of Use + Privacy Policy + Impressum (if operating from Germany/Austria/Switzerland, an Impressum is a legal requirement for commercial sites) before any sale; have a lawyer review the liability clauses for the jurisdiction. Consider business liability insurance if selling.
- No claims of approval by EASA/FAA/Diamond; no "certified training device" wording.
- Analytics/telemetry (if added) require a GDPR-compliant consent banner; default to no analytics in v1 or use cookieless analytics.

**Warning signs:**
- Disclaimer only in README.
- Words like "official", "approved", "certified" in copy.

**Phase to address:**
P5 (disclaimer/first-run UX), P6 (ToS, Impressum, privacy, lawyer review gate).

---

### Pitfall 15: Accessibility and input-method omissions that make the "trainer" unusable for some users

**What goes wrong:**
SVG interactive elements are not focusable; no keyboard operation; no ARIA labels/roles; annunciator changes are not announced; colors-only information (red/amber on black) fails contrast/colorblind users; no reduced-motion handling; text too small on phones. Mobile screen readers cannot operate an SVG panel at all unless elements have roles.

**Why it happens:**
Panel is a "picture"; accessibility is treated as optional.

**How to avoid:**
- Give each control `role="button"|"switch"|"slider"`, `tabindex="0"`, `aria-label` from the registry, keyboard handlers (Space/Enter/arrow keys for levers); visible focus ring; live region for annunciations/hints.
- Check contrast of annunciator text, add shape/text redundancy (label text, not just colour).
- Respect `prefers-reduced-motion`.
- This is also beneficial for automated E2E tests (query by role/label).

**Warning signs:**
- Playwright tests have to use CSS selectors for controls.
- Tab key skips the panel.

**Phase to address:**
P2 (roles in the control component), P5 (audit).

---

### Pitfall 16: Persistence and progress tracking built ad hoc (matters for "repeat to improve" metric)

**What goes wrong:**
The success metric is repeat attempts improving debrief scores, yet attempts are not stored, or stored in `localStorage` without versioning, causing data loss on schema change; Safari ITP can purge script-writable storage after 7 days without interaction in some contexts (installed PWAs are exempt); private mode clears it; storage quota errors are unhandled; history becomes incompatible when scenarios change (a score for "v1 of scenario" compared to v2).

**How to avoid:**
- Versioned storage wrapper (`storageVersion`, migrations), try/catch quota handling, store `scenarioId + scenarioVersion/contentHash` with each attempt, store the raw timeline (compact) so debriefs can be recomputed when grading improves.
- Provide export/import of progress (JSON) as a stopgap for no-backend.
- Be honest in UI that progress is device-local.

**Warning signs:**
- Direct `localStorage.setItem` calls scattered in components.
- Attempt records have only a score.

**Phase to address:**
P3 (timeline recording), P5 (progress UI), P6 (licence storage shares the wrapper).

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Scenario references SVG element IDs directly | Fast first demo | Panel redesign breaks all content (Pitfall 4) | Never |
| Event-log grading | Simple | Wrong grades on edge cases; rewrite of grader and all scenarios (Pitfall 1) | Never for Exam mode; maybe a throwaway spike |
| `setTimeout` in scenario logic | Quick reactions | Non-deterministic, untestable (Pitfall 2) | Never |
| Hand-written JSON schema + separate TS types | None really | Drift between validator and engine | Never; generate one from the other |
| Verbatim AFM text in repo | Fast authoring | Copyright exposure; git history permanent (Pitfall 7) | Only in a private, non-published repo |
| Paid packs in public `public/` folder | Trivial gating | Pack publicly downloadable forever (Pitfall 9) | Never for paid content |
| Hard-coded `/` URLs | Works locally | Breaks on Pages subpath (Pitfall 10) | Never |
| Single global state object mutated from the view | Quick UI | Cannot unit-test grading, cannot replay timeline | Only in the first spike |
| Skipping real-device touch testing | Saves time | Late discovery of unusable panel on phones (Pitfall 5) | Never beyond P2 |
| Roll-your-own licence-key crypto | Feels quick | Trivially broken; support burden | Never; use signatures or a hosted licence service |
| One monolithic exported SVG | Pixel look | Perf/ID instability (Pitfalls 4, 6) | Only for static background layer |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Pages | Branch-based deploy with Jekyll; `base` unset | Actions-based deploy, `.nojekyll`, `base` via env, test under subpath |
| GitHub Pages custom domain | `CNAME` not in build output | Put `CNAME` in `public/` |
| GitHub Pages + commerce | Embedding checkout/payment forms on the Pages site | Hosted checkout (merchant of record), host app elsewhere before selling (ToS) |
| TOON parsing | Floating parser version, non-strict decode, unquoted numeric-looking strings, library encoder on authored files | Exact pin + conformance test, strict decode (`[N]` counts must match), quoted enum strings, comments only as full `#` lines |
| Vite + TOON | Fetching TOON at runtime from `public/` | Import via Vite (`?raw` + runtime parser, no build-time plugin) for hashing/bundling |
| Payment/licence provider | Trusting a client-side "paid" flag | Server-verified licence key (serverless function) returning a grant/decryption key |
| Web Crypto (if encrypted packs) | Using ECB, static IV, key embedded in JS | AES-GCM with random IV, key derived from licence key; treat as deterrent only |
| Fonts | System fonts for glass display text | Embedded OFL-licensed webfont subset |
| iOS Safari | Assuming Pointer Events + `touch-action` behave like Chrome | Test on real device; apply `touch-action` on HTML wrapper and SVG |
| Service worker/PWA | Cache-first for everything | Versioned precache with update prompt; do not cache licence checks |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full-panel re-render on every state change | Jank, battery drain | Per-control subscriptions; update changed nodes only | Immediately on mid-range phones with ~100+ controls |
| SVG filters/blur/masks on large areas | Scroll/zoom lag, Safari crash | Avoid filters; pre-flatten decorative layers | Phones, >1 filtered large group |
| Large multi-MB SVG (design-tool export) | Slow load, high memory | Size budget; SVGO; split layers | First load on 3G/4G, low-RAM Android |
| Timers per gauge (one rAF loop each) | CPU spin when idle | One shared loop; stop when nothing animates | Idle tabs, phones |
| Runtime TOON parse of all packs at startup | Slow start | Lazy-load per scenario; parse on demand | When packs exceed tens of scenarios |
| Recomputing grading on every action | Visible lag in Training immediate feedback | Incremental evaluation of the predicate set | Only large scenarios; unlikely |
| Pages bandwidth soft limit (100 GB/month) | Site throttled/contacted | Lean assets; CDN in front when paid | Unlikely at v1 scale; relevant if viral/flight-school rollout |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Rendering scenario text (names, hints, source) as HTML via `innerHTML` | XSS from a malicious/imported TOON pack (community or customer-supplied packs) | Render as text; if rich text needed, sanitize (DOMPurify) with allowlist; CSP header via `<meta>` |
| Evaluating scenario content as code | Code execution | TOON decodes to plain data only; never `eval` or `new Function` scenario text; validate with the strict Zod schema |
| Licence key checked client-side with embedded secret | Free key generation | Asymmetric signatures; verification keys only in client |
| Licence key in URL query string | Key leaks via referrer/history/shared links | Enter in form; clear from URL; `Referrer-Policy: no-referrer` meta |
| Third-party scripts (analytics, fonts CDN) loaded from Pages with no SRI | Supply-chain/ privacy exposure, GDPR (Google Fonts) | Self-host fonts; minimal third parties; SRI where unavoidable |
| User-imported scenario packs with huge scenario files | Tab freeze | Limit file size and nesting depth; validate with timeouts (TOON has no anchors or aliases) |
| Secrets committed to the public repo (API tokens for the payment provider) | Account compromise | Secrets only in provider/serverless env; secret scanning enabled |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Panel unreadable on phone (everything shrunk) | Unusable; wrong taps | Region zoom/"focus areas", landscape-first layout, minimum hit-target rules |
| No indicator which controls are actionable in Training | Frustration | Optional highlight toggle in Training only |
| Annunciation appears with no sound/attention cue | Unrealistic; missed cues | Optional master caution flash/chime (muted by default, user-triggered audio due to autoplay policies) |
| Audio plays only after user gesture (autoplay policy, iOS) | Silent annunciation | Unlock AudioContext on first tap (the "start scenario" button) |
| Scenario starts instantly after a tap | Pilot not oriented | "Briefing" screen: aircraft state, conditions, "begin" |
| Debrief only lists text | Hard to learn | Timeline view with expected vs actual, link each item to AFM reference |
| Random scenario repeats same one | Feels broken | No-repeat shuffle bag |
| Exam timer pressure without pause | Unfair on phone interrupts (calls) | Auto-pause on visibility change, flagged in debrief |
| Hidden swipe gestures for pan/zoom | Users do not discover | Explicit on-screen zoom/pan controls |
| Disclaimer modal every time | Annoys; users dismiss blindly | Once per disclaimer version plus persistent footer |

## "Looks Done But Isn't" Checklist

- [ ] **Deployed site:** Often missing base path/case-sensitivity correctness — verify by loading the Pages URL fresh in a private window and deep-link refresh
- [ ] **Touch support:** Often missing `touch-action`, pointercancel, hit areas — verify on a real iPhone and a real Android phone (portrait + landscape + rotation mid-scenario)
- [ ] **Scenario validation:** Often missing cross-reference checks (control IDs, states, group refs) — verify by deliberately typoing an ID and confirming a file:line error
- [ ] **TOON safety:** Often missing the exact pin and strict decoding — verify a scenario with a numeric-looking string or a wrong array count is rejected with a clear file:line message
- [ ] **Grading:** Often missing edge cases — verify golden tests exist for pre-satisfied, toggle-back, forbidden-then-revert, any-of, partial-order, repeated actions
- [ ] **Reactions:** Often missing deterministic clock and pause — verify background the tab 2 minutes then return: no escalation jump
- [ ] **Exam mode:** Often leaks hints — verify no checklist in DOM, no logging, no feedback cues
- [ ] **Debrief:** Often only a percentage — verify a critical-miss run yields "not satisfactory" regardless of score
- [ ] **AFM sourcing:** Often missing revision/applicability — verify every shipped scenario shows source, revision, last-verified date
- [ ] **Assets:** Often missing provenance — verify ASSETS register covers every file, no Garmin/Diamond marks
- [ ] **Disclaimers:** Often only in README — verify first-run acknowledgment, footer, debrief notice, trademark notice
- [ ] **Gate-ready:** Often only a boolean — verify pack loading goes through the async access interface and a paid pack is not present in the published `dist/`
- [ ] **Offline/stale builds:** Often broken after redeploy — verify old tab + new deploy does not white-screen (chunk-load error handler)
- [ ] **Accessibility:** Often missing keyboard operation — verify full scenario completable via keyboard only
- [ ] **Persistence:** Often unversioned — verify storage migrates and survives a schema bump

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Scenarios bound to SVG IDs | HIGH | Introduce registry; write a one-off migration script mapping old IDs to registry IDs; re-validate all packs |
| Event-log grader | HIGH | Add state timeline recording; rewrite grader as pure function; re-author ambiguous scenarios; regression tests |
| Nondeterministic timers | MEDIUM | Wrap engine in injected clock; replace setTimeout call sites; add replay tests |
| AFM text already in public history | HIGH | Rewrite history (git filter-repo) and force-push; rotate forks awareness; replace with paraphrase or obtain permission; DMCA responsiveness plan |
| Garmin/Diamond takedown notice | MEDIUM | Replace artwork with generic assets (cheap if functional-layout policy was kept); rename; respond promptly |
| Paid packs leaked via static files | HIGH | Move packs behind serverless gate; rotate content/keys; accept earlier copies are out; provide updates/versions as the value-add |
| Pages ToS action against commercial site | MEDIUM | Point custom domain DNS to new host (cheap only if custom domain + host-agnostic build exist; otherwise HIGH) |
| Schema change breaking packs | MEDIUM | Ship `schemaVersion` migrators; keep old-version loader for one major version |
| Touch UX unusable | HIGH | Redesign interaction model (zoom regions); retrofit hit areas; re-test devices |
| Blank page after deploy (base path) | LOW | Set `base`, redeploy; add subpath smoke test to CI |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Event-log grading | P1 decision, P3 build | Golden grading fixtures pass for all edge cases |
| 2 Nondeterministic reactions | P3 | Replay tests with fake clock; background-tab test |
| 3 Schema/TOON authoring errors | P1 (schema), P4 (tooling) | Validator rejects typo/boolean/cycle fixtures with file:line; non-developer authors a scenario |
| 4 Coupling to SVG IDs | P1 layering, P2 registry | CI check registry<->SVG ID parity |
| 5 Touch/mobile interaction | P2 | Real-device test matrix passes; no misactuation during pan |
| 6 SVG performance | P2, P5 | Size budget in CI; profiling on mid-range Android |
| 7 AFM copyright/accuracy | P1 policy, P4 schema, P6 legal gate | No verbatim AFM in published repo; source/revision on every scenario |
| 8 Garmin/Diamond IP | P2 asset rules, P6 branding | ASSETS register complete; neutral naming; attribution present |
| 9 Client-side licence weakness | P1 interface + repo separation, P6 enforcement | Paid pack absent from public dist; async AccessProvider in use |
| 10 Pages deploy gotchas | P1 (first deploy early), P5 | Subpath smoke test in CI; deep-link/refresh test; chunk-error handler |
| 11 Pages commercial-use terms | P1 (custom domain, host-agnostic), P6 (migrate) | Domain under own control; hosting switch rehearsed before first sale |
| 12 Mode leaks | P3, P5 | Exam-mode audit checklist |
| 13 Misleading debrief | P3, P4 | Critical-miss fixture yields not satisfactory |
| 14 Liability/disclaimer | P5, P6 | First-run ack, ToS/Impressum, lawyer review done before sale |
| 15 Accessibility | P2, P5 | Keyboard-only run-through; axe checks |
| 16 Persistence | P3, P5 | Storage migration test; attempt records recomputable |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| P1 Foundations | Deploying only at the end; base path surprises; deciding repo visibility late | Deploy hello-world to Pages with subpath smoke test on day one; choose content-repo separation and custom domain now |
| P2 Panel/interaction | Mouse-first controls; tiny hit areas; ID coupling; tracing real avionics | Pointer Events, registry, hit-area standards, original artwork only |
| P3 Engine/grading | Flat action log; wall-clock timers | State-predicate model, injected clock, golden tests |
| P4 Content/authoring | TOON number coercion, verbatim AFM, missing metadata | pinned strict parser, validator CLI, mandatory source/revision/criticality fields |
| P5 Polish/legal | Disclaimers as afterthought; a11y; stale-deploy white screens | First-run ack, audit pass, preload-error handler |
| P6 Gate/monetization | Believing the client gate protects content; Pages ToS; EU/VAT; AFM/trademark clearance | Server-verified grants, packs outside public output, migrate host, merchant of record, legal review |

## Items Needing Deeper Phase Research

- P2: real-device touch behaviour of pointer capture/`touch-action` on SVG in current iOS Safari; pick final small-screen interaction model (zoom-to-region vs. pan mode). Prototype before committing.
- P3: grading semantics spec (pre-satisfied, any-of, conditional steps) reviewed against 2-3 actual DA50 AFM emergency checklists to ensure the schema can express them.
- P6: licence/payment provider selection (merchant of record, serverless verification), VAT/Impressum, and whether paid content can legally include AFM-derived procedures (ask Diamond Aircraft / lawyer).
- Trademark: no simulator-specific Garmin/Diamond policy was found; written clarification is the only authoritative answer. Do not assume permissiveness.

## Sources

- GitHub Docs, "GitHub Pages limits" (https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): prohibited commercial/e-commerce/SaaS use; 1 GB site, 100 GB/month soft bandwidth, 10 builds/hour soft limit (not applied to Actions deploys), 10-minute deploy timeout. Confidence HIGH (official, fetched 2026-10-19).
- Garmin product manual "Trademark Notices" pages (www8.garmin.com/manuals/webhelp/...): Garmin marks "may not be used without express permission of Garmin". No simulator-specific policy located. Confidence MEDIUM. Microsoft msfs-avionics-mirror README notes third-party trademark use is subject to the third parties' policies (LOW-MEDIUM, secondary).
- Community/Vite guidance on GitHub Pages: `base` must match `/<repo>/` for project sites; Pages has no rewrite rules so SPA deep-links need hash routing or a 404.html redirect, and 404.html must be placed in `public/` to reach `dist/` (dev.to "Handling 404 error in SPA deployed on GitHub Pages", OpenReplay "fix cannot get SPA deployment"). Confidence MEDIUM (community sources; consistent with Vite docs on `base`).
- Established engineering knowledge, not freshly verified in this session (MEDIUM/LOW; validate during the relevant phase): TOON Working Draft spec stability (hence the exact parser pin and conformance test); Pointer Events/`touch-action` behaviour on iOS Safari; browser timer throttling in background tabs; Safari ITP storage limits; `transform-box` behaviour for SVG rotation; Pages Jekyll underscore-directory handling and `.nojekyll`; GDPR/Impressum requirements; copyright treatment of procedural facts vs. expression (jurisdiction-dependent, needs legal advice).

---
*Pitfalls research for: web-based cockpit procedure trainer (DA50 RG), static hosted, TOON scenarios, future paid packs*
*Researched: 2026-10-19*
