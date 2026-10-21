import { useSignal } from '@preact/signals';
import type { CircuitBreakerDef, StateId } from '../../../engine/registry';
import type { DispatchResult } from '../../../engine/store';
import type { WidgetProps } from '../ControlWidget';
import { registerPressTarget, seqOf } from '../press-targets';
import type { PressTarget } from '../press-targets';
import { BreakerBody } from '../skins/Breaker';
import { tapTarget } from './Toggle';

/** What a press target needs from its widget; everything is read at call time. */
export interface BreakerPressDeps {
  readonly def: Pick<CircuitBreakerDef, 'id' | 'states'>;
  readonly stateOf: () => StateId;
  readonly actuate: (id: string, value: StateId) => DispatchResult;
  readonly setPending: (on: boolean) => void;
}

/**
 * The press target of a breaker (R3-Z2): a latch target whose tap toggles in and out through the
 * toggle rule and returns the sequence number of the event, or null when nothing was recorded.
 * Pure and hook-free; the pending visual is driven by the gesture layer through setPending.
 */
export function makeBreakerPress(deps: BreakerPressDeps): PressTarget {
  const { def, stateOf, actuate, setPending } = deps;
  return {
    cls: 'latch',
    setPending,
    tap() {
      const current = stateOf();
      const target = tapTarget(def.states, current, 0.5);
      return target === current ? null : seqOf(actuate(def.id, target));
    },
  };
}

/**
 * Circuit-breaker widget (PNL-12, D-02, D-03). A single tap toggles between in and out; there is
 * no confirmation and no animation. The state reads from the cap position and the white ring (and
 * the data-state and aria-label for tests and assistive technology), never from printed text
 * (G-0.1). Pointer contract (R3-Z2, as the toggle): the widget owns no pointer; the hit rectangle
 * registers a latch press target and the gesture layer acts on the lift, never on click (RESEARCH
 * Pattern 5). Only the hit rectangle is a control; the body is pointer-events none.
 */
export function CircuitBreaker({ def, bridge }: WidgetProps<CircuitBreakerDef>) {
  const pressed = useSignal(false);

  const state = bridge.stateOf(def.id).value;
  const stateLabel = def.states.find((st) => st.id === state)?.label ?? '';

  const press = makeBreakerPress({
    def,
    stateOf: () => bridge.stateOf(def.id).peek(),
    actuate: (id, value) => bridge.actuate(id, value),
    setPending: (on) => {
      pressed.value = on;
    },
  });

  return (
    <g
      data-control-id={def.id}
      data-kind={def.kind}
      data-state={state}
      data-group={def.group}
      data-rating={def.rating}
      data-pressed={pressed.value ? 'true' : undefined}
      role="img"
      aria-label={`CIRCUIT BREAKER ${def.label}: ${stateLabel}`}
      transform={`translate(${def.x} ${def.y})`}
    >
      <BreakerBody def={def} state={state} pressed={pressed.value} />
      <rect
        data-hit={def.id}
        x={-def.hit.w / 2}
        y={-def.hit.h / 2}
        width={def.hit.w}
        height={def.hit.h}
        fill="transparent"
        pointer-events="all"
        ref={(el: SVGRectElement | null) => registerPressTarget(el, press)}
      />
    </g>
  );
}
