import { useSignal } from '@preact/signals';
import { SESSION_LAYOUT, labelAnchorX, labelBaseline } from '../session-area';
import type { LocalRect } from '../session-area';
import { registerPressTarget } from '../press-targets';
import type { PressTarget } from '../press-targets';

const FACE = '#1b2127';
const RIM = '#3a424b';
const RIM_PRESSED = '#8fb8e6';
const LABEL = '#e6e9ed';
const FOCUS = '#8fb8e6';

export interface SessionButtonProps {
  /** Region-local rectangle (SESSION_LAYOUT). */
  readonly rect: LocalRect;
  /** The printed caps label, size 14. */
  readonly label: string;
  readonly ariaLabel: string;
  /** Stable key of the hit element (data-session-hit). */
  readonly id: string;
  readonly onActivate: () => void;
  /** Keeps the pressed rim (a load started by this button is still running). */
  readonly held?: boolean;
  /** performance.now() time before which an activation is ignored (the 400 ms shield of a new view). */
  readonly ignoreUntil?: number;
}

/**
 * The press target of a session button: class action, drives the pressed rim through setPending
 * and calls onActivate on the first release inside the slop. It never records anything: a session
 * button is not a registry control and never touches the store (T-02-08).
 */
export function makeSessionPress(
  onActivate: () => void,
  setPending: (on: boolean) => void,
): PressTarget {
  return {
    cls: 'action',
    setPending,
    tap() {
      onActivate();
      return null;
    },
  };
}

/**
 * Session button (UI-SPEC "Session Control Area"): a dark face with a rim, a caps label and a
 * transparent hit rectangle. Acts on release through the gesture layer (never listens to click),
 * and by keyboard (Enter and Space). Static label: nothing on it changes with state, only the rim
 * while a press is pending.
 */
export function SessionButton({
  rect,
  label,
  ariaLabel,
  id,
  onActivate,
  held = false,
  ignoreUntil,
}: SessionButtonProps) {
  const pending = useSignal(false);
  // Pointer release and keyboard share one rule: a press inside the shield of a new view is dropped.
  const activate = () => {
    if (ignoreUntil !== undefined && performance.now() < ignoreUntil) return;
    onActivate();
  };
  const press = makeSessionPress(activate, (on) => {
    pending.value = on;
  });
  const rimPressed = pending.value || held;
  const { x, y, w, h } = rect;
  return (
    <g
      class="session-button"
      data-session-button={id}
      data-pressed={rimPressed ? 'true' : undefined}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill={FACE}
        stroke={rimPressed ? RIM_PRESSED : RIM}
        stroke-width={rimPressed ? 3 : 2}
        pointer-events="none"
      />
      <text
        x={labelAnchorX(rect)}
        y={labelBaseline(rect)}
        text-anchor="middle"
        font-size={SESSION_LAYOUT.label.size}
        fill={LABEL}
        pointer-events="none"
      >
        {label}
      </text>
      {/* Keyboard focus outline: width 4, 4 outside the rim; shown by stage.css on :focus-visible. */}
      <rect
        class="session-focus"
        x={x - 4}
        y={y - 4}
        width={w + 8}
        height={h + 8}
        rx={14}
        fill="none"
        stroke={FOCUS}
        stroke-width={4}
        pointer-events="none"
      />
      <rect
        data-session-hit={id}
        x={x}
        y={y}
        width={w}
        height={h}
        fill="transparent"
        pointer-events="all"
        ref={(el: SVGRectElement | null) => registerPressTarget(el, press)}
      />
    </g>
  );
}
