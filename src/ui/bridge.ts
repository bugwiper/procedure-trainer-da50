// Store-to-signals bridge: one signal per control id, so a widget re-renders alone.
// The UI never mutates state directly; every change goes through PanelStore.dispatch.

import { computed, signal } from '@preact/signals';
import type { ReadonlySignal, Signal } from '@preact/signals';
import { evaluateIndicator } from '../engine/indicators';
import type { IndicatorSet } from '../engine/indicators';
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
}

declare global {
  interface Window {
    __panel?: PanelTestHook;
  }
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
}

export function createPanelBridge(registry: Registry, indicators?: IndicatorSet): PanelBridge {
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

  // Flags (for example gear.in_transit) are an empty record in this phase; Phase 3 feeds them.
  const flags: Readonly<Record<string, boolean>> = {};
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
        return evaluateIndicator(def, controls, flags);
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
      return store.dispatch(id, value, performance.now());
    },
    retract(seq) {
      return store.retract(seq);
    },
  };
}
