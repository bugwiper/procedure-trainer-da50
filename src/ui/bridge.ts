// Store-to-signals bridge: one signal per control id, so a widget re-renders alone.
// The UI never mutates state directly; every change goes through PanelStore.dispatch.

import { computed, signal } from '@preact/signals';
import type { ReadonlySignal, Signal } from '@preact/signals';
import type { ActiveCas, CasRuleSet } from '../engine/cas';
import type { CueSet } from '../engine/cues';
import { evaluateIndicator } from '../engine/indicators';
import type { IndicatorSet } from '../engine/indicators';
import type { PredicateContext } from '../engine/predicates';
import type { QuantityId, QuantitySet } from '../engine/quantities';
import { legalStates } from '../engine/registry';
import type { ControlId, Registry, StateId } from '../engine/registry';
import { PanelStore } from '../engine/store';
import type { ControlEvent, DispatchResult, RetractResult } from '../engine/store';

/** Read-only view for e2e specs; exists only in the e2e build (VITE_TEST_HOOKS=1). */
export interface PanelTestHook {
  events(): ControlEvent[];
  state(): Record<ControlId, StateId>;
  legal(): Record<ControlId, StateId[]>;
  indicators(): Record<string, 'lit' | 'off'>;
  /** A plain copy of the current quantity values. */
  quantities(): Record<QuantityId, number>;
}

declare global {
  interface Window {
    __panel?: PanelTestHook;
  }
}

/** What the bridge needs of an aircraft beyond its registry; DA50RG_ENV satisfies it. */
export interface BridgeAircraft {
  readonly quantities: QuantitySet;
  /** The CAS rule table; without it no message is ever active. */
  readonly cas?: CasRuleSet;
  /** The visual cues of the windscreen; without them no level is ever reported. */
  readonly cues?: CueSet;
}

export interface PanelBridge {
  readonly registry: Registry;
  readonly store: PanelStore;
  /** Throws Error for an unknown id. */
  stateOf(id: ControlId): ReadonlySignal<StateId>;
  /** Derived lamps of the aircraft, if any; never controls, never graded (PD-07). */
  readonly indicators: IndicatorSet | undefined;
  /** Lit or not, computed from the lever signals only. Throws Error for an unknown id. */
  indicatorOf(id: string): ReadonlySignal<boolean>;
  /** Supplies t = performance.now(); the engine never reads a clock. */
  actuate(id: ControlId, value: StateId): DispatchResult;
  /** Removes the last event from the log (R3-Z3); the signals and lamps follow. See PanelStore.retract. */
  retract(seq: number): RetractResult;
  /** Named quantity values (D-08); base values at start, empty without an aircraft. */
  readonly quantities: ReadonlySignal<Readonly<Record<QuantityId, number>>>;
  /**
   * Replaces the quantity values (the simulation's output, one call per step). The signal changes
   * only when at least one value differs, so a step that moves nothing re-renders nothing.
   */
  setQuantities(values: Readonly<Record<QuantityId, number>>): void;
  /** Named flags of the active reactions (for example deice.max_active); empty outside a run. */
  readonly flags: ReadonlySignal<Readonly<Record<string, boolean>>>;
  /**
   * Replaces the flags (the simulation's output, one call per step). The signal changes only when
   * a flag name or value differs, so a step that changes no flag re-renders no lamp.
   */
  setFlags(values: Readonly<Record<string, boolean>>): void;
  /**
   * Starts a run from a scenario baseline (SCN-03) without an event: the log is emptied, every
   * control signal and lamp follows, the quantities are the base values overlaid with the given
   * ones. Throws RangeError, changing nothing, for an illegal baseline. See PanelStore.reset.
   */
  reset(
    controls: Readonly<Record<ControlId, StateId>>,
    quantities?: Readonly<Record<QuantityId, number>>,
  ): void;
  /**
   * Active CAS messages (D-06, D-08): the aircraft rules evaluated over the quantities and the
   * control states, warnings first. Derived, never set; empty without an aircraft rule table.
   */
  readonly cas: ReadonlySignal<readonly ActiveCas[]>;
  /**
   * The level 0 to 1 of every visual cue (Phase 5, W-05), derived from the quantities; empty
   * without an aircraft cue table. They follow the quantities, so a cue stays as a run left it
   * until RESET, like the gauges.
   */
  readonly cueLevels: ReadonlySignal<Readonly<Record<string, number>>>;
  /** Event times come from now() (a virtual clock); null restores performance.now. */
  setTimeSource(now: (() => number) | null): void;
}

export function createPanelBridge(
  registry: Registry,
  indicators?: IndicatorSet,
  aircraft?: BridgeAircraft,
): PanelBridge {
  const store = new PanelStore(registry);
  const signals = new Map<ControlId, Signal<StateId>>();
  for (const [id, value] of Object.entries(store.snapshot())) signals.set(id, signal(value));

  store.subscribe((event) => {
    const s = signals.get(event.id);
    if (s !== undefined) s.value = event.value;
  });

  // A retract restores the control's value from the replayed log, so every derived lamp follows.
  store.onRetract((event, restored) => {
    const s = signals.get(event.id);
    if (s !== undefined) s.value = restored;
  });

  // A reset sets the baseline without events, so every control signal is refreshed from the store.
  store.onReset(() => {
    for (const [id, value] of Object.entries(store.snapshot())) {
      const s = signals.get(id);
      if (s !== undefined) s.value = value;
    }
  });

  const baseQuantities = (): Readonly<Record<QuantityId, number>> =>
    aircraft === undefined ? {} : aircraft.quantities.baseValues();
  const quantities = signal<Readonly<Record<QuantityId, number>>>(baseQuantities());
  let timeSource: () => number = () => performance.now();

  // The rules may read the baseline (travel_rel), which changes on a reset without a control event.
  const resets = signal(0);
  store.onReset(() => {
    resets.value += 1;
  });
  const casRules = aircraft?.cas;
  const cas = computed<readonly ActiveCas[]>(() => {
    if (aircraft === undefined || casRules === undefined) return [];
    void resets.value;
    const controls: Record<ControlId, StateId> = {};
    const baseline: Record<ControlId, StateId> = {};
    const given = store.baseline();
    for (const id of casRules.controlsRead) {
      const s = signals.get(id);
      if (s !== undefined) controls[id] = s.value;
      const start = given[id] ?? registry.get(id)?.default;
      if (start !== undefined) baseline[id] = start;
    }
    const ctx: PredicateContext = { controls, baseline, quantities: quantities.value };
    return casRules.active(ctx, { registry, quantities: aircraft.quantities });
  });

  const cueSet = aircraft?.cues;
  const cueLevels = computed<Readonly<Record<string, number>>>(() =>
    cueSet === undefined ? {} : cueSet.levels(quantities.value),
  );

  // Flags (for example deice.max_active) are the simulation's output, set once per run step; they
  // are empty at creation, after a reset and outside a run.
  const flags = signal<Readonly<Record<string, boolean>>>({});
  const lamps = new Map<string, ReadonlySignal<boolean>>();
  for (const def of indicators?.indicators ?? []) {
    lamps.set(
      def.id,
      computed(() => {
        const controls: Record<ControlId, StateId> = {};
        for (const id of def.reads) {
          const s = signals.get(id);
          if (s !== undefined) controls[id] = s.value;
        }
        return evaluateIndicator(def, controls, flags.value);
      }),
    );
  }

  if (import.meta.env.VITE_TEST_HOOKS === '1') {
    window.__panel = {
      events: () => store.events().map((e) => ({ ...e })),
      state: () => ({ ...store.snapshot() }),
      legal: () =>
        Object.fromEntries(registry.controls.map((def) => [def.id, [...legalStates(def)]])),
      indicators: () =>
        Object.fromEntries(
          [...lamps].map(([id, lamp]): [string, 'lit' | 'off'] => [id, lamp.value ? 'lit' : 'off']),
        ),
      quantities: () => ({ ...quantities.peek() }),
    };
  }

  return {
    registry,
    store,
    stateOf(id) {
      const s = signals.get(id);
      if (s === undefined) throw new Error(`unknown control id "${id}"`);
      return s;
    },
    indicators,
    indicatorOf(id) {
      const lamp = lamps.get(id);
      if (lamp === undefined) throw new Error(`unknown indicator id "${id}"`);
      return lamp;
    },
    actuate(id, value) {
      return store.dispatch(id, value, timeSource());
    },
    retract(seq) {
      return store.retract(seq);
    },
    quantities,
    setQuantities(values) {
      const current = quantities.peek();
      const keys = Object.keys(values);
      const same =
        keys.length === Object.keys(current).length &&
        keys.every((key) => Object.hasOwn(current, key) && current[key] === values[key]);
      if (!same) quantities.value = { ...values };
    },
    flags,
    setFlags(values) {
      const current = flags.peek();
      const keys = Object.keys(values);
      const same =
        keys.length === Object.keys(current).length &&
        keys.every((key) => Object.hasOwn(current, key) && current[key] === values[key]);
      if (!same) flags.value = { ...values };
    },
    cas,
    cueLevels,
    reset(controls, given = {}) {
      store.reset(controls);
      quantities.value = { ...baseQuantities(), ...given };
      if (Object.keys(flags.peek()).length > 0) flags.value = {};
    },
    setTimeSource(now) {
      timeSource = now ?? (() => performance.now());
    },
  };
}
