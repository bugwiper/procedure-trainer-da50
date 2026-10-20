// Store-to-signals bridge: one signal per control id, so a widget re-renders alone.
// The UI never mutates state directly; every change goes through PanelStore.dispatch.

import { signal } from '@preact/signals';
import type { ReadonlySignal, Signal } from '@preact/signals';
import { legalStates } from '../engine/registry';
import type { ControlId, Registry, StateId } from '../engine/registry';
import { PanelStore } from '../engine/store';
import type { ControlEvent, DispatchResult } from '../engine/store';

/** Read-only view for e2e specs; exists only in the e2e build (VITE_TEST_HOOKS=1). */
export interface PanelTestHook {
  events(): ControlEvent[];
  state(): Record<ControlId, StateId>;
  legal(): Record<ControlId, StateId[]>;
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
  /** Supplies t = performance.now(); the engine never reads a clock. */
  actuate(id: ControlId, value: StateId): DispatchResult;
}

export function createPanelBridge(registry: Registry): PanelBridge {
  const store = new PanelStore(registry);
  const signals = new Map<ControlId, Signal<StateId>>();
  for (const [id, value] of Object.entries(store.snapshot())) signals.set(id, signal(value));

  store.subscribe((event) => {
    const s = signals.get(event.id);
    if (s !== undefined) s.value = event.value;
  });

  if (import.meta.env.VITE_TEST_HOOKS === '1') {
    window.__panel = {
      events: () => store.events().map((e) => ({ ...e })),
      state: () => ({ ...store.snapshot() }),
      legal: () =>
        Object.fromEntries(registry.controls.map((def) => [def.id, [...legalStates(def)]])),
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
    actuate(id, value) {
      return store.dispatch(id, value, performance.now());
    },
  };
}
