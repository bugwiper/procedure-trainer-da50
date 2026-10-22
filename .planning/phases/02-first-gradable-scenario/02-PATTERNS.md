# Phase 2: First Gradable Scenario - Pattern Map

**Mapped:** 2026-10-22
**Files analyzed:** 27 (new and modified)
**Analogs found:** 22 / 27 (5 have no codebase analog; use RESEARCH.md code examples)

All analog paths are git-tracked (checked with `git ls-files`). Line numbers refer to the current branch.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/engine/store.ts` (modify: baseline, `reset`, `onReset`, freeze events) | store | event-driven | itself (`deriveState` l.31-39, `retract` l.108-126) | exact |
| `src/engine/clock.ts` | utility | transform | `src/engine/store.ts` `dispatch` RangeError style (l.79-81) | partial |
| `src/engine/predicates.ts` | utility | transform | `src/engine/indicators.ts` `evaluateIndicator` (l.112-123) | role-match |
| `src/engine/quantities.ts` | model | transform | `src/engine/indicators.ts` (`defineIndicators` + spec/def split) | role-match |
| `src/engine/grading.ts` | service | batch (log replay) | `deriveState` in `store.ts` (pure replay of log) | partial |
| `src/scenario/schema.ts` | model | transform | none in repo (use RESEARCH Pattern 2/3 and Code Ex. 3) | none |
| `src/scenario/toon-index.ts` | utility | transform | none (RESEARCH Code Example 1) | none |
| `src/scenario/parse.ts` | service | request-response | none (RESEARCH Code Example 2) | none |
| `src/scenario/lint.ts` | service | transform | `src/engine/indicators.ts` `defineIndicators` validation loop (l.55-106) | role-match |
| `src/scenario/packs.ts` | service (interface) | request-response | none (RESEARCH Pattern 6) | none |
| `src/scenario/packs-vite.ts` | provider | file-I/O (lazy) | `src/ui/about/About.tsx` l.2 (`?raw` import) | partial |
| `src/aircraft/da50rg/quantities.ts` | config/data | transform | `src/aircraft/da50rg/indicators.ts`; bands in `MfdFrame.tsx` l.200-231 | role-match |
| `src/aircraft/da50rg/cas.ts` | config/data | transform | `src/aircraft/da50rg/indicators.ts` | role-match |
| `src/ui/bridge.ts` (modify: clock injection, quantities, cas, onReset) | provider | event-driven | itself | exact |
| `src/ui/session.ts` | store (signals) | event-driven | `src/ui/App.tsx` l.13-14 module-level signals | role-match |
| `src/ui/ack.ts` | utility | file-I/O (localStorage) | none (RESEARCH Pattern 9) | none |
| `src/ui/screens/Ack.tsx`, `Briefing.tsx`, `Menu.tsx`, `Debrief.tsx` | component (modal) | request-response | `src/ui/about/About.tsx` | exact |
| `src/ui/App.tsx` (modify: footer button, overlays, legroom control area) | component | event-driven | itself l.67-80 | exact |
| `src/ui/stage.css` (modify: modal z-index > 30) | config | n/a | itself (z-index at l.106 about, l.155 zoom-out) | exact |
| `src/ui/panel/frames/PfdFrame.tsx` (modify: CAS chip) | component | transform | itself (static `pointer-events="none"` frame) | exact |
| `src/ui/panel/frames/MfdFrame.tsx` (modify: feed OIL TEMP/PRES) | component | transform | itself `OIL_TEMP`/`OIL_PRES` GaugeSpec l.200-231 | exact |
| `scenarios/engine/pack.toon`, `eng-oil-temp-green.toon` | data | n/a | RESEARCH Code Example 3 | none |
| `scripts/validate-scenarios.mjs` | utility (CLI) | batch | none (RESEARCH Pattern 6) | none |
| `tests/*.test.ts` (grading, parse, lint, packs seam, toon conformance, store baseline, literal gate) | test | n/a | `tests/store.test.ts`, `tests/indicators.test.ts`, `tests/content-policy.test.ts` | exact |
| `e2e/support/open.ts` + `e2e/*.spec.ts` (`gotoPanel`, seeded ack) | test | n/a | `e2e/about.spec.ts` l.9-12, `e2e/support/touch.ts` | role-match |
| `playwright.config.ts` (modify: storageState ack seed) | config | n/a | itself l.1-20 (`LOCAL_BASE`, `baseURL`) | exact |
| `vite.config.ts` (modify: `build.rolldownOptions` codeSplitting) | config | n/a | itself | exact |
| `.github/workflows/deploy.yml` (add `npm run validate`) | config | n/a | itself l.27-32 | exact |

## Pattern Assignments

### `src/engine/store.ts` (store, event-driven) - modify

**Analog:** itself. Add a baseline without creating events (RESEARCH Pattern 4).

**Current `deriveState`** (l.31-39), extend with an optional third parameter `baseline`:
```typescript
export function deriveState(
  registry: Registry,
  events: readonly ControlEvent[],
): Record<ControlId, StateId> {
  const state: Record<ControlId, StateId> = {};
  for (const def of registry.controls) state[def.id] = def.default;
  for (const event of events) state[event.id] = event.value;
  return state;
}
```
Overlay order: defaults, then `baseline`, then events.

**Retract must pass the baseline** (l.117-123):
```typescript
const remaining = this.log.slice(0, seq);
const next = deriveState(this.registry, remaining);   // <- add this.baseline
...
this.log.length = seq;
this.state = new Map(Object.entries(next));
```

**Listener-set pattern to copy for `onReset`** (l.46, 148-153):
```typescript
private readonly retractListeners = new Set<(event: ControlEvent, restored: StateId) => void>();
onRetract(listener: ...): () => void {
  this.retractListeners.add(listener);
  return () => { this.retractListeners.delete(listener); };
}
```
Iterate with `[...set]` as in `dispatch` l.91. `reset(baseline)` validates ids with `this.registry.get(id)` and `legalStates(def).includes(value)` (same checks as `dispatch` l.82-84), clears `log.length = 0`, sets `consumed = -1`, rebuilds `state`, notifies. Throw `RangeError`/`Error` for programmer errors (style of l.79-81, 120-121). WR-07: freeze events (`Object.freeze({...})` at l.89) and return frozen copies from `events()`.

Error message style: `` `markConsumed needs an integer from ${String(...)} ...` `` (l.141): always wrap numbers with `String()` (lint rule).

---

### `src/engine/clock.ts` (utility, transform)

**Analog:** `store.ts` argument validation (l.79-81):
```typescript
if (!Number.isFinite(t) || t < 0) {
  throw new RangeError(`dispatch time must be a finite number >= 0 (got ${String(t)})`);
}
```
Copy for `advance(dtMs)`. No `Date`, `performance`, timers (ESLint `no-restricted-globals` in `eslint.config.js` forbids them under `src/engine`). Header comment style: first lines state purity ("Pure TypeScript, no DOM, no framework, no clock", `indicators.ts` l.5).

---

### `src/engine/predicates.ts` (utility, transform)

**Analog:** `src/engine/indicators.ts` `evaluateIndicator` (l.112-123): a pure function over a snapshot plus flags that only passes declared inputs.
```typescript
export function evaluateIndicator(
  def: IndicatorDef,
  snapshot: Readonly<Record<ControlId, StateId>>,
  flags: Readonly<Record<string, boolean>> = {},
): boolean {
  const controls: Record<ControlId, StateId> = {};
  for (const id of def.reads) {
    const value = snapshot[id];
    if (value !== undefined) controls[id] = value;
  }
  return def.lit({ controls, flags });
}
```
Imports pattern (l.7-8): `import type { ControlId, Registry, StateId } from './registry';`. Honour `noUncheckedIndexedAccess` (always check `undefined`). Travel maths: `Math.round(pos * 1000) / 10` (float hazard, RESEARCH Pitfall 6); detent `pos` comes from `POWER_STEPS` in `src/engine/detents.ts` via the registry control `detents`.

---

### `src/engine/quantities.ts` and `src/aircraft/da50rg/quantities.ts` / `cas.ts` (model + data)

**Analog:** engine type/define split (`IndicatorSpec` -> `IndicatorDef` + `defineIndicators(registry, input)`, `indicators.ts` l.19-106) with the aircraft file supplying data (`src/aircraft/da50rg/indicators.ts` imports `defineIndicators`, `DA50RG`, exports `DA50RG_INDICATORS`). Copy: `Error` subclass (`IndicatorError`, l.48), duplicate-id checks (l.69-71), `Object.freeze` of defs (l.97-105), lookup `get`.

**Band numbers to derive from one source** (MfdFrame.tsx l.215-226; do not duplicate):
```typescript
const OIL_TEMP: GaugeSpec = {
  label: 'Oil temp', unit: '°C', value: 15, min: -25, max: 150,
  // AFM 02-05: yellow -25..50, green 50-115, yellow 115-125, red above 125.
  bands: [ { from: -25, to: 50, color: YELLOW }, { from: 50, to: 115, color: GREEN },
           { from: 115, to: 125, color: YELLOW }, { from: 125, to: 150, color: RED } ],
};
```
The aircraft `quantities.ts` should hold band data; MfdFrame derives its `Band[]` from it. Layer boundary: `src/aircraft/**` has the same purity rule as `src/engine`, so no colour hex there, only band names (green/yellow/red).

---

### `src/engine/grading.ts` (service, batch replay)

**Analog:** `deriveState` + `retract` replay of an event list. Replay events in log order starting from baseline, evaluating predicates after each event (RESEARCH Pattern 3). Use `ControlEvent` (`store.ts` l.7-13) fields `seq, t, id, value`; order by log index, not `t`. Output must be JSON-serialisable and deterministic (tests compare `toEqual` / `JSON.stringify` of two runs). No store listeners (WR-01/02 not triggered).

---

### `src/scenario/lint.ts` (service, transform)

**Analog:** `defineIndicators` cross-reference validation (`indicators.ts` l.61-96): iterate specs, check each referenced id with `registry.get(id) !== undefined`, check states with `legalStates`, collect messages. Difference: lint returns `{line, col, message}[]` (no throw), locating via `locate(indexToon(text), path)`.
```typescript
if (registry.get(read) === undefined) {
  throw new IndicatorError(`indicator "${spec.id}" reads "${read}", which is not a control`);
}
```

---

### `src/scenario/packs-vite.ts` (provider, lazy file I/O)

**Analog (partial):** `src/ui/about/About.tsx` l.2 `import policy from '../../../docs/CONTENT-POLICY.md?raw';`. Use `import.meta.glob(..., { query: '?raw', import: 'default' })` per RESEARCH Pattern 6 (manifests eager, scenarios lazy). Vite env typing already used: `import.meta.env.VITE_TEST_HOOKS` in `bridge.ts` l.75 (so `vite/client` types are in place). Only this file may contain `import.meta.glob` for scenarios (gate test).

---

### `src/ui/bridge.ts` (provider, event-driven) - modify

**Analog:** itself. Extend `createPanelBridge`.

**Signal wiring to copy for `onReset`** (l.45-56):
```typescript
for (const [id, value] of Object.entries(store.snapshot())) signals.set(id, signal(value));
store.subscribe((event) => { const s = signals.get(event.id); if (s !== undefined) s.value = event.value; });
store.onRetract((event, restored) => { const s = signals.get(event.id); if (s !== undefined) s.value = restored; });
```
Add `store.onReset(() => { for (const [id, v] of Object.entries(store.snapshot())) { const s = signals.get(id); if (s) s.value = v; } })`.

**Clock injection** (l.102-104), replace the hard-wired wall clock:
```typescript
actuate(id, value) { return store.dispatch(id, value, performance.now()); },
```
-> `now: () => number` option, default `performance.now()` (bridge is UI, allowed). `flags` record (l.59) and `computed` lamps (l.60-73) show the pattern for a `quantities` signal and a `cas` computed (use `computed` from `@preact/signals`). Test hook (l.75-86) is the place to expose `quantities`/`session` for `@hooks` specs; keep it behind `VITE_TEST_HOOKS === '1'`. Existing test: `tests/bridge.test.ts`.

---

### `src/ui/screens/{Ack,Briefing,Menu,Debrief}.tsx` (component, modal)

**Analog:** `src/ui/about/About.tsx` (exact).
```typescript
import { useLayoutEffect, useRef } from 'preact/hooks';
export function About({ onClose }: { readonly onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div class="about" role="dialog" aria-modal="true" aria-labelledby="about-title" data-testid="about">
      <h2 id="about-title">About this trainer</h2>
      ...
      <button ref={closeRef} type="button" class="about-close" data-testid="about-close" onClick={onClose}>Close</button>
```
Copy: focus the primary button in `useLayoutEffect`, `role="dialog" aria-modal`, `data-testid` on root and buttons, text rendered as children (never raw HTML, T-01-15). Differences: Ack must NOT close on Escape or backdrop; Briefing/Debrief use Escape only if harmless. Overlays are DOM siblings of `.panel-area`, never inside the SVG.

---

### `src/ui/App.tsx` (component) - modify

**Analog:** itself. Module-level UI-only signals (l.13-14) are the pattern for `session.ts`:
```typescript
const bridge = createPanelBridge(DA50RG, DA50RG_INDICATORS);
const aboutOpen = signal(false);
```
Footer (l.67-79) is where "Procedure complete" goes (rendered only in `running`, `min-height: 44px`):
```tsx
<footer class="footer">
  <span data-testid="training-aid-notice">Training aid only, not the AFM</span>
  <button type="button" class="footer-link" data-testid="about-open" onClick={() => { aboutOpen.value = true; }}>
```
Overlay mount pattern (l.80): `{aboutOpen.value ? <About onClose={closeAbout} /> : null}`. Scenario control area for the co-pilot legroom (D-14 amended) is a panel-region concern: place as a DOM or SVG region using the existing region/frame mechanism (see `PanelShell.tsx`/frames); check UI-SPEC for exact placement. Keep `attachZoomGestures` listeners untouched.

---

### `src/ui/stage.css` - modify

z-index map: `.about` 20 (l.106), `.zoom-out` 30 (l.155), rotate-hint 10 (l.201), panel 1 (l.68). New modals (ack, briefing, debrief) need z-index above 30, or hide the Full panel button while a modal is open (RESEARCH Pitfall 9).

---

### `src/ui/panel/frames/PfdFrame.tsx` (component) - modify

**Analog:** itself. Frame is presentational: `<g data-pfd pointer-events="none">`, region-local coordinates, constants at top (`ATT_X=100, ATT_Y=34, ATT_W=295, ATT_H=232`; tape rect at x=405). Props: `({ region }: FrameProps)` where `FrameProps` is exported by `./MfdFrame` and already carries `bridge`; read `bridge.cas.value` for chips. Place chip right edge ~x 396, y ~200-215, black rect + red text (colours as local constants like `WHITE`/`LABEL` l.5-8). Must pass art-fit and text-overlap gates (`e2e/art-fit.spec.ts`, `e2e/static-text.spec.ts`; pfd/mfd regions are excluded from the static-text gate for instrument data).

---

### `src/ui/panel/frames/MfdFrame.tsx` (component) - modify

Gauge specs `OIL_PRES` (l.200) and `OIL_TEMP` (l.215) have static `value`; drive from `bridge` quantities signals while keeping `Band[]` derived from `src/aircraft/da50rg/quantities.ts`.

---

### Tests

**Analog `tests/store.test.ts`** (inline fixture registry, `defineRegistry`, `PanelStore`):
```typescript
import { describe, expect, it } from 'vitest';
import { defineRegistry, legalStates } from '../src/engine/registry';
import { deriveState, PanelStore } from '../src/engine/store';
const VIEW_BOX = { w: 100, h: 100 };
const REGION = { id: 'deice', name: 'DE-ICE', bounds: { x: 0, y: 0, w: 100, h: 100 } };
```
Use for baseline/reset/retract tests: reset `{ 'lv.power': 'p75' }`, actuate and retract another control, POWER stays p75 (Pitfall 1). Grading tests use the real `DA50RG` registry (`../src/aircraft/da50rg/panel`) plus fixtures under `tests/fixtures/`.

**Analog `tests/content-policy.test.ts`** (fs-reading gates):
```typescript
const root = fileURLToPath(new URL('../', import.meta.url));
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
function walk(dir: string): string[] { ... }
```
Use for: glob-seam gate (only `packs-vite.ts` contains `import.meta.glob`), no scenario literals (`lv.power`, `eng_oil_temp`, `125`) in `src/engine|scenario|ui`, validate-every-`.toon` test.

**Analog `tests/indicators.test.ts`**: derive-logic tests plus definition-invariant tests with `ControlSpec`/`RegionDef` inline fixtures.

**E2E analog `e2e/about.spec.ts`**:
```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('panel')).toBeVisible();
});
async function activate(el: Locator, hasTouch: boolean) { if (hasTouch) await el.tap(); else await el.click(); }
```
All 22 specs use `page.goto('./')`; per D-14 amendment there is no menu overlay, so only the first-run ack needs seeding (Playwright `use.storageState` with `origins[].localStorage` key `da50.ack`, computed from `LOCAL_BASE`/`PW_BASE_URL` in `playwright.config.ts` l.6-9). New ack spec uses a fresh context. `@hooks` in the title for specs reading `window.__panel`.

---

## Shared Patterns

### Purity boundary
**Source:** header of `src/engine/indicators.ts` l.1-5, `eslint.config.js` (no-restricted-globals/imports/properties). **Apply to:** all of `src/engine/*`, `src/scenario/{schema,parse,lint,toon-index}.ts`, `src/aircraft/da50rg/{quantities,cas}.ts`. No `Date`, `performance`, timers, DOM, `Math.random`. `src/scenario/packs-vite.ts` is the one place with Vite globals.

### Registry-referenced validation
**Source:** `indicators.ts` l.72-86 (`registry.get`, `legalStates`). **Apply to:** `lint.ts`, `store.reset`.

### Errors
Programmer errors throw (`RangeError`, `Error` subclass such as `IndicatorError` l.48), numbers via `String(x)`. Author errors (scenario text) return `{line, col, path, message}` lists, never throw (RESEARCH Pattern 1).

### Modal dialogs
**Source:** `About.tsx`. **Apply to:** Ack, Briefing, Menu, Debrief.

### Signals in UI
**Source:** `App.tsx` l.13-14 module-level `signal(...)`; `bridge.ts` `signal`/`computed`. **Apply to:** `session.ts` (screen state, no router, D-18).

### Test hook
**Source:** `bridge.ts` l.75-86 gated by `import.meta.env.VITE_TEST_HOOKS === '1'`. **Apply to:** any new hook data (session state, quantities).

### Static-label owner rules
No text on the panel changes with control state; CAS chips live in the PFD glass (instrument data), not on plates.

## No Analog Found

| File | Role | Data Flow | Reason / Use Instead |
|---|---|---|---|
| `src/scenario/schema.ts` | model | transform | No Zod in repo yet; RESEARCH Pattern 2, Code Example 3, `z.strictObject` + `z.discriminatedUnion` |
| `src/scenario/toon-index.ts` | utility | transform | RESEARCH Code Example 1 (tested prototype), port to strict TS |
| `src/scenario/parse.ts` | service | request-response | RESEARCH Code Example 2 |
| `src/scenario/packs.ts` | interface | request-response | RESEARCH Pattern 6 (`PackProvider`, `AccessPolicy`, `OpenAccessPolicy`) |
| `src/ui/ack.ts` | utility | localStorage | RESEARCH Pattern 9 (wrapped try/catch, version key `da50.ack`) |
| `scripts/validate-scenarios.mjs` | CLI | batch | RESEARCH Pattern 6 (Vite `createServer` + `ssrLoadModule`) |
| `scenarios/**/*.toon` | data | n/a | RESEARCH Code Example 3 |

## Metadata

**Analog search scope:** `src/engine`, `src/ui`, `src/ui/about`, `src/ui/panel/frames`, `src/aircraft/da50rg`, `tests`, `e2e`, `playwright.config.ts`
**Files read:** store.ts, bridge.ts, App.tsx, indicators.ts, About.tsx, PfdFrame.tsx (head), MfdFrame.tsx (gauge specs), tests (store, indicators, content-policy heads), e2e/about.spec.ts, playwright.config.ts
**Pattern extraction date:** 2026-10-22
